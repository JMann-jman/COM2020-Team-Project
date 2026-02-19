"""
Routes for noise data and hotspots in the Noise Pollution Monitoring API.

This file defines blueprints for retrieving noise observations and hotspots.
"""

import pandas as pd
from flask import Blueprint, request, jsonify
from ..auth import check_role
from .. import data_loader

noise_bp = Blueprint('noise', __name__)

@noise_bp.route('/zones', methods=['GET'])
def get_zones():
    """
    Retrieve all zones.

    Returns:
        JSON: List of all zones.
    """
    if not check_role('community'):
        return jsonify({'error': 'Unauthorized'}), 403
    return jsonify(data_loader.zones.to_dict(orient='records'))

@noise_bp.route('/interventions', methods=['GET'])
def get_interventions():
    """
    Retrieve all available interventions.

    Returns:
        JSON: List of all interventions.
    """
    if not check_role('community'):
        return jsonify({'error': 'Unauthorized'}), 403
    return jsonify(data_loader.interventions.to_dict(orient='records'))

@noise_bp.route('/noise_data', methods=['GET'])
def get_noise_data():
    """
    Retrieve filtered noise data observations.

    Query Parameters:
        zones (list): List of zone IDs to filter by.
        categories (list): List of category tags to filter by.
        start_date (str): Start date for filtering (ISO format).
        end_date (str): End date for filtering (ISO format).
        source (str): Filter by source ('Sensor', 'Reports', or 'Both').
        time_window (str): Preset time window ('Last 24 hours', 'Last 7 days', 'Last 4 weeks').

    Returns:
        JSON: List of filtered noise observations.
    """
    from datetime import timedelta
    
    if not check_role('community'):
        return jsonify({'error': 'Unauthorized'}), 403
    zone_ids = request.args.getlist('zones')
    categories = request.args.getlist('categories')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    source = request.args.get('source', 'Both')
    time_window = request.args.get('time_window')

    filtered = data_loader.observations
    
    # Filter by zone
    if zone_ids:
        filtered = filtered[filtered['zone_id'].isin(zone_ids)]
    
    # Filter by categories
    if categories:
        filtered = filtered[filtered['category_tag'].isin(categories)]
    
    # Filter by source
    if source and source != 'Both':
        source_map = {'Sensor': 'sensor', 'Reports': 'report'}
        mapped_source = source_map.get(source, source.lower())
        filtered = filtered[filtered['source'] == mapped_source]
    
    # Handle time window or explicit date range
    if time_window:
        # Use the latest timestamp in the filtered dataset as reference "now"
        timestamps = pd.to_datetime(filtered['timestamp'])
        if len(timestamps) > 0:
            ref_time = timestamps.max()
            if time_window == 'Last 24 hours':
                start = ref_time - timedelta(hours=24)
            elif time_window == 'Last 7 days':
                start = ref_time - timedelta(days=7)
            elif time_window == 'Last 4 weeks':
                start = ref_time - timedelta(weeks=4)
            else:
                start = ref_time - timedelta(days=7)  # Default to 7 days
            filtered = filtered[(pd.to_datetime(filtered['timestamp']) >= start)]
    elif start_date and end_date:
        filtered = filtered[(pd.to_datetime(filtered['timestamp']) >= start_date) & (pd.to_datetime(filtered['timestamp']) <= end_date)]

    return jsonify(filtered.to_dict(orient='records'))

@noise_bp.route('/hotspots', methods=['GET'])
def get_hotspots():
    """
    Retrieve top noise hotspots calculated from live data.

    Severity score formula:
        (Average noise dB in window) + (Validated report count * 0.8)

    Query Parameters:
        top (int): Number of top hotspots to return (default: 10).

    Returns:
        JSON: List of top hotspots.
    """
    if not check_role('community'):
        return jsonify({'error': 'Unauthorized'}), 403
    top_n = int(request.args.get('top', 10))

    observations = data_loader.observations.copy()
    reports = data_loader.reports.copy()

    if observations.empty:
        return jsonify([])

    observation_ts = pd.to_datetime(observations['timestamp'], utc=True, errors='coerce')
    obs_with_ts = observations.loc[~observation_ts.isna()].copy()
    observation_ts = observation_ts.loc[~observation_ts.isna()]

    def to_window_label(hour):
        if 6 <= hour < 9:
            return 'morning(06-09)'
        if 9 <= hour < 17:
            return 'day(09-17)'
        if 17 <= hour < 22:
            return 'evening(17-22)'
        if 22 <= hour < 24:
            return 'late(22-24)'
        return 'night(00-06)'

    obs_with_ts['time_window'] = observation_ts.dt.hour.map(to_window_label)
    avg_noise = (
        obs_with_ts
        .groupby(['zone_id', 'time_window'])['value_db']
        .mean()
        .reset_index(name='avg_noise_db')
    )

    validated_reports = reports[reports['status'] == 'valid'].copy()
    if validated_reports.empty:
        validated_counts = pd.DataFrame(columns=['zone_id', 'time_window', 'validated_report_count'])
    else:
        normalized_window = validated_reports['time_window'].fillna('').astype(str).str.strip().str.lower()
        window_map = {
            'morning': 'morning(06-09)',
            'afternoon': 'day(09-17)',
            'day': 'day(09-17)',
            'evening': 'evening(17-22)',
            'night': 'night(00-06)',
            'late': 'late(22-24)',
            'morning(06-09)': 'morning(06-09)',
            'day(09-17)': 'day(09-17)',
            'evening(17-22)': 'evening(17-22)',
            'late(22-24)': 'late(22-24)',
            'night(00-06)': 'night(00-06)'
        }
        validated_reports['time_window'] = normalized_window.map(window_map).fillna('day(09-17)')
        validated_counts = (
            validated_reports
            .groupby(['zone_id', 'time_window'])
            .size()
            .reset_index(name='validated_report_count')
        )

    report_counts = reports.copy()
    if report_counts.empty:
        total_report_counts = pd.DataFrame(columns=['zone_id', 'time_window', 'report_count'])
    else:
        normalized_all_window = report_counts['time_window'].fillna('').astype(str).str.strip().str.lower()
        window_map = {
            'morning': 'morning(06-09)',
            'afternoon': 'day(09-17)',
            'day': 'day(09-17)',
            'evening': 'evening(17-22)',
            'night': 'night(00-06)',
            'late': 'late(22-24)',
            'morning(06-09)': 'morning(06-09)',
            'day(09-17)': 'day(09-17)',
            'evening(17-22)': 'evening(17-22)',
            'late(22-24)': 'late(22-24)',
            'night(00-06)': 'night(00-06)'
        }
        report_counts['time_window'] = normalized_all_window.map(window_map).fillna('day(09-17)')
        total_report_counts = (
            report_counts
            .groupby(['zone_id', 'time_window'])
            .size()
            .reset_index(name='report_count')
        )

    scored = avg_noise.merge(validated_counts, on=['zone_id', 'time_window'], how='left')
    scored['validated_report_count'] = scored['validated_report_count'].fillna(0).astype(int)
    scored = scored.merge(total_report_counts, on=['zone_id', 'time_window'], how='left')
    scored['report_count'] = scored['report_count'].fillna(0).astype(int)
    scored['severity_score'] = scored['avg_noise_db'] + (scored['validated_report_count'] * 0.8)

    scored = scored.sort_values('severity_score', ascending=False).head(top_n).reset_index(drop=True)
    scored['hotspot_id'] = [f'H{i+1:02d}' for i in range(len(scored))]
    scored['severity_score'] = scored['severity_score'].round(2)
    scored['avg_noise_db'] = scored['avg_noise_db'].round(2)
    scored['rationale'] = (
        'Average noise: ' + scored['avg_noise_db'].astype(str)
        + ' dB | Validated reports: ' + scored['validated_report_count'].astype(str)
    )

    return jsonify(scored[[
        'hotspot_id',
        'zone_id',
        'time_window',
        'severity_score',
        'avg_noise_db',
        'report_count',
        'validated_report_count',
        'rationale'
    ]].to_dict(orient='records'))
