"""
Authentication utilities for the Noise Pollution Monitoring API.

This module contains functions for role-based access control.
"""

from flask import request

def check_role(required_role):
    """
    Check if the user has the required role based on the 'Role' header.

    Args:
        required_role (str): The role required for access ('community', 'planner', 'maintainer').

    Returns:
        bool: True if the user has the required role or higher, False otherwise.
    """
    role = request.headers.get('Role', 'community')
    if role not in ['community', 'planner', 'maintainer']:
        return False
    if required_role == 'planner' and role != 'planner':
        return False
    return True
