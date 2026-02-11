"""
Routes for incident reports in the Noise Pollution Monitoring API.

This module defines blueprints for submitting and moderating incident reports.
"""

import pandas as pd
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from ..auth import check_role
from ..data_loader import reports, decisions

report_bp = Blueprint('report', __name__)

@report_bp.route('/reports', methods=['POST'])
def submit_report():
    """
    Submit a new incident report.

    Request Body:
        zone_id (str): Zone where the incident occurred.
        category (str): Category of the noise.
        description (str): Description of the incident.

    Returns:
        JSON: Success message or duplicate flag.
    """
    global reports
    if not check_role('community'):
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json
    zone = data['zone_id']
    category = data['category']
    description = data['description']

    # Deduplication rules (at least 6)
    now = datetime.now()
    time_window = timedelta(hours=1)

    # Rule 1: Same zone + category + time window
    rule1 = reports[(reports['zone_id'] == zone) & (reports['category'] == category) & (pd.to_datetime(reports['timestamp']) > now - time_window)]

    # Rule 2: Same zone + category + description (exact match)
    rule2 = reports[(reports['zone_id'] == zone) & (reports['category'] == category) & (reports['description_stub'] == description)]

    # Rule 3: Same zone + time window (any category)
    rule3 = reports[(reports['zone_id'] == zone) & (pd.to_datetime(reports['timestamp']) > now - time_window)]

    # Rule 4: Same category + time window (any zone)
    rule4 = reports[(reports['category'] == category) & (pd.to_datetime(reports['timestamp']) > now - time_window)]

    # Rule 5: Same zone + description
    rule5 = reports[(reports['zone_id'] == zone) & (reports['description_stub'] == description)]

    # Rule 6: Same description + time window
    rule6 = reports[(reports['description_stub'] == description) & (pd.to_datetime(reports['timestamp']) > now - time_window)]

    if not rule1.empty or not rule2.empty or not rule3.empty or not rule4.empty or not rule5.empty or not rule6.empty:
        return jsonify({'message': 'Duplicate report flagged'}), 409

    new_report = pd.DataFrame({
        'report_id': [f'R{len(reports)+1:03d}'],
        'zone_id': [zone],
        'timestamp': [datetime.now()],
        'category': [category],
        'description_stub': [description],
        'status': ['pending']
    })
    reports = pd.concat([reports, new_report], ignore_index=True)
    reports.to_csv('data/incident_reports.csv', index=False)
    return jsonify({'message': 'Report submitted'}), 201

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
    global reports, decisions
    if not check_role('planner'):
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json
    decision = data['decision']
    reason = data['reason']

    reports.loc[reports['report_id'] == report_id, 'status'] = decision
    new_decision = pd.DataFrame({
        'decision_id': [f'D{len(decisions)+1:03d}'],
        'report_id': [report_id],
        'decision': [decision],
        'reason': [reason],
        'timestamp': [datetime.now()]
    })
    decisions = pd.concat([decisions, new_decision], ignore_index=True)
    decisions.to_csv('data/moderation_decisions.csv', index=False)
    reports.to_csv('data/incident_reports.csv', index=False)
    return jsonify({'message': 'Moderated'}), 200
