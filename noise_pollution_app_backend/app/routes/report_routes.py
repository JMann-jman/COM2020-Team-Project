"""
Routes for incident reports in the Noise Pollution Monitoring API.

This module defines blueprints for submitting and moderating incident reports.
"""

import pandas as pd
import os
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from ..auth import check_role
from .. import data_loader
from ..utils import generate_id, save_csv, build_csv_path

report_bp = Blueprint('report', __name__)

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
        JSON: Success message or duplicate flag.
    """
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
    rule1 = data_loader.reports[(data_loader.reports['zone_id'] == zone) & (data_loader.reports['category'] == category) & (pd.to_datetime(data_loader.reports['timestamp']) > now - time_window)]

    # Rule 2: Same zone + category + description (exact match)
    rule2 = data_loader.reports[(data_loader.reports['zone_id'] == zone) & (data_loader.reports['category'] == category) & (data_loader.reports['description_stub'] == description)]

    # Rule 3: Same zone + time window (any category)
    rule3 = data_loader.reports[(data_loader.reports['zone_id'] == zone) & (pd.to_datetime(data_loader.reports['timestamp']) > now - time_window)]

    # Rule 4: Same category + time window (any zone)
    rule4 = data_loader.reports[(data_loader.reports['category'] == category) & (pd.to_datetime(data_loader.reports['timestamp']) > now - time_window)]

    # Rule 5: Same zone + description
    rule5 = data_loader.reports[(data_loader.reports['zone_id'] == zone) & (data_loader.reports['description_stub'] == description)]

    # Rule 6: Same description + time window
    rule6 = data_loader.reports[(data_loader.reports['description_stub'] == description) & (pd.to_datetime(data_loader.reports['timestamp']) > now - time_window)]

    if not rule1.empty or not rule2.empty or not rule3.empty or not rule4.empty or not rule5.empty or not rule6.empty:
        return jsonify({'message': 'Duplicate report flagged', 'is_duplicate': True}), 409

    new_report = pd.DataFrame({
        'report_id': [generate_id('R', data_loader.reports)],
        'zone_id': [zone],
        'timestamp': [datetime.now()],
        'category': [category],
        'description_stub': [description],
        'status': ['pending']
    })
    data_loader.reports = pd.concat([data_loader.reports, new_report], ignore_index=True)
    save_csv(data_loader.reports, build_csv_path(data_loader.DATA_DIR, 'incident_reports.csv'))
    return jsonify({'message': 'Report submitted', 'is_duplicate': False}), 201

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
    data = request.json
    decision = data['decision']
    reason = data['reason']

    data_loader.reports.loc[data_loader.reports['report_id'] == report_id, 'status'] = decision
    new_decision = pd.DataFrame({
        'decision_id': [generate_id('MOD', data_loader.decisions)],
        'report_id': [report_id],
        'decision': [decision],
        'reason': [reason],
        'timestamp': [datetime.now()]
    })
    data_loader.decisions = pd.concat([data_loader.decisions, new_decision], ignore_index=True)
    save_csv(data_loader.decisions, build_csv_path(data_loader.DATA_DIR, 'moderation_decisions.csv'))
    save_csv(data_loader.reports, build_csv_path(data_loader.DATA_DIR, 'incident_reports.csv'))
    return jsonify({'message': 'Moderated'}), 200
