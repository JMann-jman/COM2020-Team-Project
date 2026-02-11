"""
Routes for the Quiet Quest gamification feature.

Provides endpoints for listing missions, submitting answers,
and tracking user progress.
"""

from flask import Blueprint, request, jsonify
from ..auth import check_role
from .. import data_loader

quest_bp = Blueprint('quest', __name__)

# In-memory progress store keyed by user_id (lightweight; resets on restart)
_progress = {}


def _get_user_id():
    return request.headers.get('X-User-Id', 'anonymous')


def _user_progress(user_id):
    if user_id not in _progress:
        _progress[user_id] = {'completed': {}}
    return _progress[user_id]


# ---------- routes ----------

@quest_bp.route('/missions', methods=['GET'])
def get_missions():
    """Return all missions grouped by tier."""
    if not check_role('community'):
        return jsonify({'error': 'Unauthorized'}), 403

    user_id = _get_user_id()
    prog = _user_progress(user_id)

    missions = data_loader.missions
    result = {}
    for _, row in missions.iterrows():
        tier = int(row['tier'])
        mission = {
            'mission_id': row['mission_id'],
            'tier': tier,
            'title': row['title'],
            'question': row['question'],
            'options': str(row['options']).split('|'),
            'grading_type': row['grading_type'],
            'hint': row['hint'],
            'completed': row['mission_id'] in prog['completed'],
            'correct': prog['completed'].get(row['mission_id'], {}).get('correct', None),
        }
        result.setdefault(tier, []).append(mission)

    return jsonify(result)


@quest_bp.route('/missions/<mission_id>/answer', methods=['POST'])
def submit_answer(mission_id):
    """Check a user's answer for a mission."""
    if not check_role('community'):
        return jsonify({'error': 'Unauthorized'}), 403

    user_id = _get_user_id()
    prog = _user_progress(user_id)

    missions = data_loader.missions
    mission_row = missions[missions['mission_id'] == mission_id]
    if mission_row.empty:
        return jsonify({'error': 'Mission not found'}), 404

    mission = mission_row.iloc[0]
    body = request.get_json(silent=True) or {}
    user_answer = body.get('answer', '').strip()

    if not user_answer:
        return jsonify({'error': 'No answer provided'}), 400

    correct_answer = str(mission['answer_key']).strip()
    is_correct = user_answer == correct_answer

    prog['completed'][mission_id] = {
        'correct': is_correct,
        'tier': int(mission['tier']),
        'user_answer': user_answer,
    }

    return jsonify({
        'correct': is_correct,
        'correct_answer': correct_answer,
        'explanation': mission['explanation'],
    })


@quest_bp.route('/quest/progress', methods=['GET'])
def get_progress():
    """Return the user's quest progress."""
    if not check_role('community'):
        return jsonify({'error': 'Unauthorized'}), 403

    user_id = _get_user_id()
    prog = _user_progress(user_id)

    tier_counts = {1: 0, 2: 0, 3: 0}
    for mid, info in prog['completed'].items():
        tier = info.get('tier', 0)
        if tier in tier_counts and info.get('correct'):
            tier_counts[tier] += 1

    return jsonify({
        'completed': prog['completed'],
        'tier_progress': {str(k): v for k, v in tier_counts.items()},
        'total_completed': sum(tier_counts.values()),
    })


@quest_bp.route('/quest/reset', methods=['POST'])
def reset_progress():
    """Reset user's quest progress (useful for testing)."""
    user_id = _get_user_id()
    _progress[user_id] = {'completed': {}}
    return jsonify({'status': 'reset'})