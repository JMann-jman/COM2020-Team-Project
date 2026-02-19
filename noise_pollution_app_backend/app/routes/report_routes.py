"""
Routes for incident reports in the Noise Pollution Monitoring API.

This file defines blueprints for submitting and moderating incident reports.
"""

import pandas as pd
import re
from datetime import timedelta
from flask import Blueprint, request, jsonify
from ..auth import check_role
from .. import data_loader
from ..utils import save_csv, build_csv_path

report_bp = Blueprint('report', __name__)

def _next_sequential_id(series, prefix, width=5):
    pattern = re.compile(rf'^{re.escape(prefix)}(\d+)$')
    max_id = 0
    for value in series.dropna().astype(str):
        match = pattern.match(value.strip())
        if match:
            max_id = max(max_id, int(match.group(1)))
    return f'{prefix}{max_id + 1:0{width}d}'

def _normalize_zone_id(zone_id):
    if zone_id is None:
        return ''
    value = str(zone_id).strip().upper()
    if not value:
        return ''
    if value.startswith('Z') and value[1:].isdigit():
        return f"Z{int(value[1:]):02d}"
    if value.isdigit():
        return f"Z{int(value):02d}"
    return value

def _normalize_category(category):
    mapped = {
        'nightlife': 'music',
        'general': 'other'
    }
    value = str(category or '').strip().lower()
    return mapped.get(value, value)

def _normalize_time_window(time_window, timestamp_utc):
    tw = str(time_window or '').strip().lower()
    mapping = {
        'morning': 'morning(06-09)',
        'afternoon': 'day(09-17)',
        'day': 'day(09-17)',
        'evening': 'evening(17-22)',
        'night': 'night(00-06)',
        'late': 'late(22-24)'
    }
    if tw in mapping:
        return mapping[tw]
    if tw in mapping.values():
        return tw

    hour = timestamp_utc.hour
    if 6 <= hour < 9:
        return 'morning(06-09)'
    if 9 <= hour < 17:
        return 'day(09-17)'
    if 17 <= hour < 22:
        return 'evening(17-22)'
    if 22 <= hour < 24:
        return 'late(22-24)'
    return 'night(00-06)'

def _build_description_stub(zone_id, category, time_window):
    return f'Report of {category} noise in {zone_id} during {time_window}. (Synthetic; no personal data)'

def _time_window_from_timestamp(ts):
    parsed = pd.to_datetime(ts, utc=True, errors='coerce')
    if pd.isna(parsed):
        return 'day'
    hour = parsed.hour
    if 6 <= hour < 12:
        return 'morning'
    if 12 <= hour < 17:
        return 'afternoon'
    if 17 <= hour < 22:
        return 'evening'
    return 'night'

def _recompute_hotspots():
    obs = data_loader.observations.copy()
    reports = data_loader.reports.copy()

    # Base signal from measured observations
    obs_zone_mean = obs.groupby('zone_id')['value_db'].mean()

    # Validated reports increase hotspot confidence/severity
    valid_reports = reports[reports['status'] == 'valid'].copy()
    valid_count = valid_reports.groupby('zone_id').size() if not valid_reports.empty else pd.Series(dtype='int64')

    all_zone_ids = sorted(set(obs['zone_id'].dropna().unique()).union(set(reports['zone_id'].dropna().unique())))
    if not all_zone_ids:
        return

    rows = []
    for index, zone_id in enumerate(all_zone_ids, start=1):
        base_score = float(obs_zone_mean.get(zone_id, 0.0))
        report_boost = float(valid_count.get(zone_id, 0)) * 3.0
        severity = round(base_score + report_boost, 1)

        zone_reports = valid_reports[valid_reports['zone_id'] == zone_id]
        if not zone_reports.empty:
            latest_ts = zone_reports['timestamp'].iloc[-1]
            time_window = _time_window_from_timestamp(latest_ts)
            rationale = f'Based on sensor trend and {len(zone_reports)} validated reports'
        else:
            time_window = 'day'
            rationale = 'Based on sensor trend'

        rows.append({
            'hotspot_id': f'H{index:02d}',
            'zone_id': zone_id,
            'time_window': time_window,
            'severity_score': severity,
            'rationale': rationale
        })

    hotspots_df = pd.DataFrame(rows).sort_values('severity_score', ascending=False).reset_index(drop=True)
    hotspots_df['hotspot_id'] = [f'H{i+1:02d}' for i in range(len(hotspots_df))]

    data_loader.hotspots = hotspots_df
    save_csv(data_loader.hotspots, build_csv_path(data_loader.DATA_DIR, 'hotspots.csv'))

@report_bp.route('/reports', methods=['GET'])
def get_reports():
    """
    Retrieve all incident reports.

    Query Parameters:
        status (str): Filter by report status (pending, under_review, valid, duplicate, invalid).

    Returns:
        JSON: List of incident reports.
    """
    if not check_role('community'):
        return jsonify({'error': 'Unauthorized'}), 403
    status = request.args.get('status')
    
    filtered = data_loader.reports
    if status:
        filtered = filtered[filtered['status'] == status]
    
    return jsonify(filtered.to_dict(orient='records'))

@report_bp.route('/reports', methods=['POST'])
def submit_report():
    """
    Submit a new incident report.

    Request Body:
        zone_id (str): Zone where the incident occurred.
        category (str): Category of the noise.
        description (str): Description of the incident.

    Returns:
        JSON: Success message with duplicate flag.
    """
    if not check_role('community'):
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    zone = _normalize_zone_id(data.get('zone_id'))
    category = _normalize_category(data.get('category'))
    now = pd.Timestamp.now(tz='UTC')
    normalized_time_window = _normalize_time_window(data.get('time_window'), now)
    description_stub = _build_description_stub(zone, category, normalized_time_window)

    if not zone or not category:
        return jsonify({'error': 'Missing required fields: zone_id and category'}), 400

    # Deduplication rules (flag only; do not block submission)
    existing_reports = data_loader.reports.copy()
    report_times = pd.to_datetime(existing_reports['timestamp'], format='mixed', utc=True, errors='coerce')
    time_window = timedelta(hours=1)

    rule1 = existing_reports[(existing_reports['zone_id'] == zone) & (existing_reports['category'] == category) & (report_times > now - time_window)]
    rule2 = existing_reports[(existing_reports['zone_id'] == zone) & (existing_reports['category'] == category) & (existing_reports['description_stub'] == description_stub)]
    rule3 = existing_reports[(existing_reports['zone_id'] == zone) & (report_times > now - time_window)]
    rule4 = existing_reports[(existing_reports['category'] == category) & (report_times > now - time_window)]
    rule5 = existing_reports[(existing_reports['zone_id'] == zone) & (existing_reports['description_stub'] == description_stub)]
    rule6 = existing_reports[(existing_reports['description_stub'] == description_stub) & (report_times > now - time_window)]
    is_duplicate = any(not rule.empty for rule in [rule1, rule2, rule3, rule4, rule5, rule6])

    new_report = pd.DataFrame({
        'report_id': [_next_sequential_id(data_loader.reports['report_id'], 'REP', width=5)],
        'zone_id': [zone],
        'timestamp': [now.strftime('%Y-%m-%dT%H:%M:%SZ')],
        'category': [category],
        'time_window': [normalized_time_window],
        'description_stub': [description_stub],
        'status': ['under_review']
    })
    data_loader.reports = pd.concat([data_loader.reports, new_report], ignore_index=True)
    save_csv(data_loader.reports, build_csv_path(data_loader.DATA_DIR, 'incident_reports.csv'))
    return jsonify({'message': 'Report submitted', 'is_duplicate': bool(is_duplicate)}), 201

@report_bp.route('/reports/<report_id>', methods=['PUT'])
def moderate_report(report_id):
    """
    Moderate an incident report.

    Args:
        report_id (str): ID of the report to moderate.

    Request Body:
        decision (str): Moderation decision ('valid', 'duplicate', 'invalid').
        reason (str): Reason for the decision.

    Returns:
        JSON: Success message.
    """
    if not check_role('planner'):
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    decision = str(data.get('decision', '')).strip().lower()
    reason = str(data.get('reason', '')).strip() or 'clear description'

    if decision not in {'valid', 'duplicate', 'invalid'}:
        return jsonify({'error': 'Invalid decision value'}), 400

    if report_id not in set(data_loader.reports['report_id'].astype(str)):
        return jsonify({'error': 'Report not found'}), 404

    data_loader.reports.loc[data_loader.reports['report_id'] == report_id, 'status'] = decision
    new_decision = pd.DataFrame({
        'decision_id': [_next_sequential_id(data_loader.decisions['decision_id'], 'MOD', width=5)],
        'report_id': [report_id],
        'decision': [decision],
        'reason': [reason],
        'timestamp': [pd.Timestamp.now(tz='UTC').strftime('%Y-%m-%dT%H:%M:%SZ')]
    })
    data_loader.decisions = pd.concat([data_loader.decisions, new_decision], ignore_index=True)
    save_csv(data_loader.decisions, build_csv_path(data_loader.DATA_DIR, 'moderation_decisions.csv'))
    save_csv(data_loader.reports, build_csv_path(data_loader.DATA_DIR, 'incident_reports.csv'))
    _recompute_hotspots()
    return jsonify({'message': 'Moderated'}), 200
