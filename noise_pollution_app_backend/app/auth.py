"""
Authentication utilities for the Noise Pollution Monitoring API.

This module contains functions for role-based access control.
"""

from flask import request

def check_role(required_role):
    """
    Check if the user has the required role based on the 'Role' header.
    Implements role hierarchy: community < planner < maintainer.

    Args:
        required_role (str): The role required for access ('community', 'planner', 'maintainer').

    Returns:
        bool: True if the user has the required role or higher, False otherwise.
    """
    role_hierarchy = {'community': 0, 'planner': 1, 'maintainer': 2}
    user_role = request.headers.get('Role', 'community')
    
    if user_role not in role_hierarchy:
        return False
    if required_role not in role_hierarchy:
        return False
    
    return role_hierarchy[user_role] >= role_hierarchy[required_role]
