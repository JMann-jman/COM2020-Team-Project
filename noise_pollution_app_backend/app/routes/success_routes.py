"""
Routes for success measures in the Noise Pollution Monitoring API.

This file defines blueprints for calculating and retrieving success metrics.
"""

import os
from flask import Blueprint, jsonify
from ..auth import check_role
from .. import data_loader

success_bp = Blueprint('success', __name__)

@success_bp.route('/success_measures', methods=['GET'])
def success_measures():
    """
    Calculate success measures for the noise pollution monitoring system.

    Returns:
        JSON: Metrics including hotspot validity, reporting quality, and community understanding.
    """
    if not check_role('maintainer'):
        return jsonify({'error': 'Unauthorized'}), 403

    # Hotspot validity: Fraction of hotspots that align with top 5 high-noise zones
    observations = data_loader.observations
    hotspots = data_loader.hotspots
    decisions = data_loader.decisions

    high_noise_zones = observations.groupby('zone_id')['value_db'].mean().nlargest(5).index.tolist()
    hotspot_zones = hotspots['zone_id'].tolist()
    # Avoid division by zero
    hotspot_validity = len(set(high_noise_zones) & set(hotspot_zones)) / len(hotspot_zones) if len(hotspot_zones) > 0 else 0

    # Reporting quality: Ratio of duplicate decisions to total moderation decisions
    duplicate_decisions = decisions[decisions['decision'] == 'duplicate']
    reporting_quality = len(duplicate_decisions) / len(decisions) if len(decisions) > 0 else 0

    # Community understanding: Placeholder for community engagement rate (mocked)
    community_understanding = 0.8  # Placeholder

    return jsonify({
        'hotspot_validity': hotspot_validity,
        'reporting_quality': reporting_quality,
        'community_understanding': community_understanding
    })


@success_bp.route('/maintenance/status', methods=['GET'])
def maintenance_status():
    """Return dataset/testing readiness details for maintainer users."""
    if not check_role('maintainer'):
        return jsonify({'error': 'Unauthorized'}), 403

    files = [
        'zones.csv',
        'zone_adjacency.csv',
        'noise_observations.csv',
        'incident_reports.csv',
        'moderation_decisions.csv',
        'interventions.csv',
        'plans.csv',
        'missions.csv'
    ]
    file_status = {}
    for filename in files:
        path = os.path.join(data_loader.DATA_DIR, filename)
        exists = os.path.exists(path)
        file_status[filename] = {
            'exists': exists,
            'last_modified_utc': os.path.getmtime(path) if exists else None
        }

    return jsonify({
        'data_counts': {
            'zones': int(len(data_loader.zones)),
            'observations': int(len(data_loader.observations)),
            'reports': int(len(data_loader.reports)),
            'decisions': int(len(data_loader.decisions)),
            'interventions': int(len(data_loader.interventions)),
            'plans': int(len(data_loader.plans)),
            'missions': int(len(data_loader.missions))
        },
        'files': file_status
    })


@success_bp.route('/maintenance/reload', methods=['POST'])
def maintenance_reload_data():
    """Allow maintainers to reload dataset files without restarting the service."""
    if not check_role('maintainer'):
        return jsonify({'error': 'Unauthorized'}), 403

    data_loader.load_data()
    return jsonify({'message': 'Data reloaded successfully'}), 200
