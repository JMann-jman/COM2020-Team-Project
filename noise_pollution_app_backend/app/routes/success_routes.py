"""
Routes for success measures in the Noise Pollution Monitoring API.

This module defines blueprints for calculating and retrieving success metrics.
"""

from flask import Blueprint, jsonify
from ..auth import check_role
from ..data_loader import observations, hotspots, decisions

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
