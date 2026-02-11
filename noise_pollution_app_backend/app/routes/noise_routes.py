"""
Routes for noise data and hotspots in the Noise Pollution Monitoring API.

This module defines blueprints for retrieving noise observations and hotspots.
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

    Returns:
        JSON: List of filtered noise observations.
    """
    if not check_role('community'):
        return jsonify({'error': 'Unauthorized'}), 403
    zone_ids = request.args.getlist('zones')
    categories = request.args.getlist('categories')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    filtered = data_loader.observations
    if zone_ids:
        filtered = filtered[filtered['zone_id'].isin(zone_ids)]
    if categories:
        filtered = filtered[filtered['category_tag'].isin(categories)]
    if start_date and end_date:
        filtered = filtered[(pd.to_datetime(filtered['timestamp']) >= start_date) & (pd.to_datetime(filtered['timestamp']) <= end_date)]

    return jsonify(filtered.to_dict(orient='records'))

@noise_bp.route('/hotspots', methods=['GET'])
def get_hotspots():
    """
    Retrieve the top noise hotspots based on severity score.

    Query Parameters:
        top (int): Number of top hotspots to return (default: 5).

    Returns:
        JSON: List of top hotspots.
    """
    if not check_role('community'):
        return jsonify({'error': 'Unauthorized'}), 403
    top_n = int(request.args.get('top', 5))
    top_hotspots = data_loader.hotspots.sort_values('severity_score', ascending=False).head(top_n)
    return jsonify(top_hotspots.to_dict(orient='records'))
