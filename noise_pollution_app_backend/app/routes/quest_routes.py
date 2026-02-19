"""
Routes for the Quiet Quest gamification feature.

This file provides endpoints for listing missions, submitting answers,
and tracking user progress with badges.
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
        _progress[user_id] = {'completed': {}, 'badges': []}
    return _progress[user_id]


# ---------- badge definitions ----------
BADGES = [
    {'id': 'tier1_complete', 'name': 'Noise Novice', 'description': 'Complete all Tier 1 missions', 'icon': 'bi-star', 'tier': 1, 'required': 6},
    {'id': 'tier2_complete', 'name': 'Sound Analyst', 'description': 'Complete all Tier 2 missions', 'icon': 'bi-bar-chart', 'tier': 2, 'required': 6},
    {'id': 'tier3_complete', 'name': 'Quiet Champion', 'description': 'Complete all Tier 3 missions', 'icon': 'bi-trophy', 'tier': 3, 'required': 6},
    {'id': 'first_mission', 'name': 'First Step', 'description': 'Complete your first mission', 'icon': 'bi-flag', 'tier': 0, 'required': 1},
    {'id': 'perfect_tier1', 'name': 'Sharp Ear', 'description': 'Answer all Tier 1 missions correctly on first try', 'icon': 'bi-bullseye', 'tier': 1, 'required': 6},
]


def _check_badges(user_id):
    """Evaluate and award any newly earned badges."""
    prog = _user_progress(user_id)
    completed = prog['completed']
    earned_ids = {b['id'] for b in prog['badges']}
    newly_earned = []

    # Count completions per tier
    tier_counts = {1: 0, 2: 0, 3: 0}
    first_try_tier1 = 0
    for mid, info in completed.items():
        tier = info.get('tier', 0)
        if tier in tier_counts:
            tier_counts[tier] += 1
        if tier == 1 and info.get('first_try'):
            first_try_tier1 += 1

    total = sum(tier_counts.values())

    for badge in BADGES:
        if badge['id'] in earned_ids:
            continue
        if badge['id'] == 'first_mission' and total >= 1:
            newly_earned.append(badge)
        elif badge['id'] == 'tier1_complete' and tier_counts[1] >= 6:
            newly_earned.append(badge)
        elif badge['id'] == 'tier2_complete' and tier_counts[2] >= 6:
            newly_earned.append(badge)
        elif badge['id'] == 'tier3_complete' and tier_counts[3] >= 6:
            newly_earned.append(badge)
        elif badge['id'] == 'perfect_tier1' and first_try_tier1 >= 6:
            newly_earned.append(badge)

    for b in newly_earned:
        prog['badges'].append(b)

    return newly_earned


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

    already_completed = mission_id in prog['completed']
    first_try = not already_completed

    prog['completed'][mission_id] = {
        'correct': is_correct,
        'tier': int(mission['tier']),
        'first_try': first_try and is_correct,
        'user_answer': user_answer,
    }

    new_badges = _check_badges(user_id)

    return jsonify({
        'correct': is_correct,
        'correct_answer': correct_answer,
        'explanation': mission['explanation'],
        'new_badges': new_badges,
    })


@quest_bp.route('/quest/progress', methods=['GET'])
def get_progress():
    """Return the user's quest progress and badges."""
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
        'badges': prog['badges'],
        'tier_progress': {str(k): v for k, v in tier_counts.items()},
        'total_completed': sum(tier_counts.values()),
        'all_badges': BADGES,
    })


@quest_bp.route('/quest/reset', methods=['POST'])
def reset_progress():
    """Reset user's quest progress (useful for testing)."""
    if not check_role('community'):
        return jsonify({'error': 'Unauthorized'}), 403
    user_id = _get_user_id()
    _progress[user_id] = {'completed': {}, 'badges': []}
    return jsonify({'status': 'reset'})