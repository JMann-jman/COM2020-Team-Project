"""
Routes for intervention plans in the Noise Pollution Monitoring API.

This module defines blueprints for creating, updating, and comparing intervention plans.
"""

from flask import Blueprint, request, jsonify
import pandas as pd
from ..auth import check_role
from ..data_loader import interventions, plans, zones

plan_bp = Blueprint('plan', __name__)

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
    global plans
    if not check_role('planner'):
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json
    zone_id = data['zone_id']
    interventions_selected = data['interventions']
    notes = data.get('notes', '')

    selected = interventions[interventions['intervention_id'].isin(interventions_selected)]
    cost = selected['cost_band'].map({'low': 1000, 'medium': 5000, 'high': 10000}).sum()
    impact = selected['impact_range_db'].str.split('-').apply(lambda x: (float(x[0]) + float(x[1])) / 2).sum()

    new_plan = pd.DataFrame({
        'plan_id': [f'P{len(plans)+1:03d}'],
        'zone_id': [zone_id],
        'interventions_selected': [interventions_selected],
        'budget': [cost],
        'status': ['planned'],
        'expected_impact': [impact],
        'created_by': ['planner'],
        'notes': [notes]
    })
    plans = pd.concat([plans, new_plan], ignore_index=True)
    plans.to_csv('data/plans.csv', index=False)
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
    global plans
    if not check_role('planner'):
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json
    status = data['status']
    notes = data.get('notes', '')

    plans.loc[plans['plan_id'] == plan_id, 'status'] = status
    if notes:
        plans.loc[plans['plan_id'] == plan_id, 'notes'] = notes
    plans.to_csv('data/plans.csv', index=False)
    return jsonify({'message': 'Plan updated'}), 200

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

    scenario_plans = plans[plans['plan_id'].isin(plan_ids)]
    total_cost = scenario_plans['budget'].sum()
    total_impact = scenario_plans['expected_impact'].sum()
    coverage = len(scenario_plans) / len(zones) * 100
    return jsonify({
        'total_cost': total_cost,
        'total_impact': total_impact,
        'coverage': coverage
    }), 200
