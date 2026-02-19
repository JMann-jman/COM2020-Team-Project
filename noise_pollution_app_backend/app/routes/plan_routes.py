"""
Routes for intervention plans in the Noise Pollution Monitoring API.

This file defines blueprints for creating and updating intervention plans.
"""

import pandas as pd
from flask import Blueprint, request, jsonify
from ..auth import check_role
from .. import data_loader
from ..utils import generate_id, save_csv, build_csv_path

plan_bp = Blueprint('plan', __name__)

@plan_bp.route('/plans', methods=['GET'])
def get_plans():
    """
    Retrieve all intervention plans.

    Query Parameters:
        zone_id (str): Filter by zone ID.
        status (str): Filter by status (planned, in_progress, done).

    Returns:
        JSON: List of plans.
    """
    if not check_role('community'):
        return jsonify({'error': 'Unauthorized'}), 403
    zone_id = request.args.get('zone_id')
    status = request.args.get('status')
    
    filtered = data_loader.plans
    if zone_id:
        filtered = filtered[filtered['zone_id'] == zone_id]
    if status:
        filtered = filtered[filtered['status'] == status]
    
    return jsonify(filtered.to_dict(orient='records'))

@plan_bp.route('/plans', methods=['POST'])
def create_plan():
    """
    Create a new intervention plan.

    Request Body:
        zone_id (str): Zone for the plan.
        interventions (list): List of intervention IDs.
        notes (str, optional): Additional notes.

    Returns:
        JSON: Success message with plan ID.
    """
    if not check_role('planner'):
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json
    
    # Validate required fields
    if not data or 'zone_id' not in data or 'interventions' not in data:
        return jsonify({'error': 'Missing required fields: zone_id and interventions'}), 400
    
    zone_id = data['zone_id']
    interventions_selected = data['interventions']
    
    if not interventions_selected or not isinstance(interventions_selected, list):
        return jsonify({'error': 'interventions must be a non-empty list'}), 400
    
    notes = data.get('notes', '')

    selected = data_loader.interventions[data_loader.interventions['intervention_id'].isin(interventions_selected)]
    cost = selected['cost_band'].map({'low': 1000, 'medium': 5000, 'high': 10000}).sum()
    if 'impact_range_db_low' in selected.columns and 'impact_range_db_high' in selected.columns:
        impact = ((selected['impact_range_db_low'].astype(float) + selected['impact_range_db_high'].astype(float)) / 2).sum()
    else:
        impact = selected['impact_range_db'].str.split('-').apply(lambda x: (float(x[0]) + float(x[1])) / 2).sum()

    new_plan = pd.DataFrame({
        'plan_id': [generate_id('P', data_loader.plans)],
        'zone_id': [zone_id],
        'interventions_selected': [interventions_selected],
        'budget': [cost],
        'status': ['planned'],
        'expected_impact': [impact],
        'created_by': ['planner'],
        'notes': [notes]
    })
    data_loader.plans = pd.concat([data_loader.plans, new_plan], ignore_index=True)
    save_csv(data_loader.plans, build_csv_path(data_loader.DATA_DIR, 'plans.csv'))
    return jsonify({'message': 'Plan created', 'plan_id': new_plan['plan_id'].iloc[0]}), 201

@plan_bp.route('/plans/<plan_id>', methods=['PUT'])
def update_plan_status(plan_id):
    """
    Update the status of an intervention plan.

    Args:
        plan_id (str): ID of the plan to update.

    Request Body:
        status (str): New status ('planned', 'in_progress', 'done').
        notes (str, optional): Additional notes.

    Returns:
        JSON: Success message.
    """
    if not check_role('planner'):
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json
    status = data['status']
    notes = data.get('notes', '')

    data_loader.plans.loc[data_loader.plans['plan_id'] == plan_id, 'status'] = status
    if notes:
        data_loader.plans.loc[data_loader.plans['plan_id'] == plan_id, 'notes'] = notes
    save_csv(data_loader.plans, build_csv_path(data_loader.DATA_DIR, 'plans.csv'))
    return jsonify({'message': 'Plan updated'}), 200


