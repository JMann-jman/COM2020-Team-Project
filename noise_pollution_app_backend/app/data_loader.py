"""
Data loading utilities for the Noise Pollution Monitoring API.

This module handles loading CSV data into global variables for use across the application.
"""

import pandas as pd
import os

# Get the absolute path to the data directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')

# Global data variables
zones = None
observations = None
reports = None
decisions = None
hotspots = None
interventions = None
plans = None
missions = None

def load_data():
    """
    Load all CSV data into global variables.
    """
    global zones, observations, reports, decisions, hotspots, interventions, plans, missions
    zones = pd.read_csv(os.path.join(DATA_DIR, 'zones.csv'))
    observations = pd.read_csv(os.path.join(DATA_DIR, 'noise_observations.csv'))
    reports = pd.read_csv(os.path.join(DATA_DIR, 'incident_reports.csv'))
    decisions = pd.read_csv(os.path.join(DATA_DIR, 'moderation_decisions.csv'))
    hotspots = pd.read_csv(os.path.join(DATA_DIR, 'hotspots.csv'))
    interventions = pd.read_csv(os.path.join(DATA_DIR, 'interventions.csv'))
    plans = pd.read_csv(os.path.join(DATA_DIR, 'plans.csv'))
    missions = pd.read_csv(os.path.join(DATA_DIR, 'missions.csv'))
