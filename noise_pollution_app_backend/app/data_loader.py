"""
Data loading utilities for the Noise Pollution Monitoring API.

This module handles loading CSV data into global variables for use across the application.
"""

import pandas as pd

# Global data variables
zones = None
observations = None
reports = None
decisions = None
hotspots = None
interventions = None
plans = None

def load_data():
    """
    Load all CSV data into global variables.
    """
    global zones, observations, reports, decisions, hotspots, interventions, plans
    zones = pd.read_csv('data/zones.csv')
    observations = pd.read_csv('data/noise_observations.csv')
    reports = pd.read_csv('data/incident_reports.csv')
    decisions = pd.read_csv('data/moderation_decisions.csv')
    hotspots = pd.read_csv('data/hotspots.csv')
    interventions = pd.read_csv('data/interventions.csv')
    plans = pd.read_csv('data/plans.csv')
