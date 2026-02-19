"""
Routes for intervention plans in the Noise Pollution Monitoring API.

This file defines blueprints for creating, comparing, and updating intervention plans.
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
    data = request.get_json(silent=True) or {}
    status = str(data.get('status', '')).strip()
    notes = data.get('notes', '')

    if not status:
        return jsonify({'error': 'Missing required field: status'}), 400

    if status not in {'planned', 'in_progress', 'done'}:
        return jsonify({'error': 'Invalid status value'}), 400

    if plan_id not in set(data_loader.plans['plan_id'].astype(str)):
        return jsonify({'error': 'Plan not found'}), 404

    data_loader.plans.loc[data_loader.plans['plan_id'] == plan_id, 'status'] = status
    if notes:
        data_loader.plans.loc[data_loader.plans['plan_id'] == plan_id, 'notes'] = notes
    save_csv(data_loader.plans, build_csv_path(data_loader.DATA_DIR, 'plans.csv'))
    return jsonify({'message': 'Plan updated'}), 200

def _calculate_plan_comparison(plan_ids):
    """
    Calculate comparison metrics for multiple plans.
    
    Args:
        plan_ids (list): List of plan IDs to compare.
    
    Returns:
        dict: Comparison metrics and plan details.
    """
    scenario_plans = data_loader.plans[data_loader.plans['plan_id'].isin(plan_ids)]

    # Avoid division by zero
    total_zones = len(data_loader.zones) if len(data_loader.zones) > 0 else 1
    coverage = float(len(scenario_plans) / total_zones * 100) if len(data_loader.zones) > 0 else 0.0

    return {
        'plans': scenario_plans.to_dict(orient='records'),
        'total_cost': float(scenario_plans['budget'].sum()),
        'total_impact': float(scenario_plans['expected_impact'].sum()),
        'coverage': coverage
    }

@plan_bp.route('/plans/compare', methods=['GET'])
def compare_plans():
    """
    Compare multiple intervention plans.
    Query Parameters:
        plan_ids (list): List of plan IDs to compare.
    Returns:
        JSON: Comparison metrics and plan details.
    """
    if not check_role('planner'):
        return jsonify({'error': 'Unauthorized'}), 403
    plan_ids = request.args.getlist('plan_ids')
    return jsonify(_calculate_plan_comparison(plan_ids)), 200

@plan_bp.route('/scenarios', methods=['POST'])
def compare_scenarios():
    """
    Compare multiple intervention plans (scenarios).
    Request Body:
        plan_ids (list): List of plan IDs to compare.
    Returns:
        JSON: Comparison metrics (total cost, impact, coverage).
    """
    if not check_role('planner'):
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json
    plan_ids = data['plan_ids']
    comparison = _calculate_plan_comparison(plan_ids)
    return jsonify({
        'total_cost': comparison['total_cost'],
        'total_impact': comparison['total_impact'],
        'coverage': comparison['coverage']
    }), 200
