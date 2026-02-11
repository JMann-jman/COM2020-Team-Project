"""
Data Seeder for Noise Pollution Monitoring App.

This script generates synthetic data for the noise pollution monitoring system,
including zones, noise observations, incident reports, moderation decisions,
hotspots, interventions, and plans. The data is saved to CSV files
in the 'data' directory for use by the backend API.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

# Seed for reproducibility to ensure consistent data generation
np.random.seed(42)
random.seed(42)

# Zones
zones = []
zone_types = ['residential', 'campus', 'event']
for i in range(1, 13):
    zones.append({
        'zone_id': f'Z{i:02d}',
        'name': f'Zone {i}',
        'geometry_stub': f'Schematic for Zone {i}',
        'tags': random.choice(zone_types)
    })

zones_df = pd.DataFrame(zones)

# Generate noise observations: 10,000 records over 8 weeks
start_date = datetime(2023, 1, 1)
observations = []
for _ in range(10000):
    obs_id = f'O{len(observations)+1:05d}'
    zone_id = random.choice(zones_df['zone_id'].tolist())
    timestamp = start_date + timedelta(days=random.randint(0, 55), hours=random.randint(0, 23), minutes=random.randint(0, 59))
    source = random.choice(['sensor', 'report'])
    value_db = np.random.normal(60, 10)  # Mean 60 dB, std 10
    category_tag = random.choice(['traffic', 'construction', 'event', 'music', 'other'])
    observations.append({
        'obs_id': obs_id,
        'zone_id': zone_id,
        'timestamp': timestamp,
        'source': source,
        'value_db': round(value_db, 2),
        'category_tag': category_tag
    })

observations_df = pd.DataFrame(observations)

# Incident Reports: 600
reports = []
statuses = ['pending', 'under_review', 'valid', 'duplicate', 'invalid']
for i in range(1, 601):
    report_id = f'R{i:03d}'
    zone_id = random.choice(zones_df['zone_id'].tolist())
    timestamp = start_date + timedelta(days=random.randint(0, 55), hours=random.randint(0, 23))
    category = random.choice(['traffic', 'construction', 'event', 'music', 'other'])
    description_stub = f'Anonymous report of {category} noise in {zone_id}'
    status = random.choice(statuses)
    reports.append({
        'report_id': report_id,
        'zone_id': zone_id,
        'timestamp': timestamp,
        'category': category,
        'description_stub': description_stub,
        'status': status
    })

reports_df = pd.DataFrame(reports)

# Moderation Decisions: 300
decisions = []
decision_types = ['valid', 'duplicate', 'invalid']
for i in range(1, 301):
    decision_id = f'D{i:03d}'
    report_id = random.choice(reports_df['report_id'].tolist())
    decision = random.choice(decision_types)
    reason = f'Reason for {decision}'
    timestamp = datetime.now()
    decisions.append({
        'decision_id': decision_id,
        'report_id': report_id,
        'decision': decision,
        'reason': reason,
        'timestamp': timestamp
    })

decisions_df = pd.DataFrame(decisions)

# Hotspots: Top hotspots
hotspots = []
for i in range(1, 13):  # One per zone
    hotspot_id = f'H{i:02d}'
    zone_id = f'Z{i:02d}'
    time_window = random.choice(['morning', 'afternoon', 'evening', 'night'])
    severity_score = random.randint(50, 100)
    rationale = f'High noise in {time_window} due to {random.choice(["traffic", "events"])}'
    hotspots.append({
        'hotspot_id': hotspot_id,
        'zone_id': zone_id,
        'time_window': time_window,
        'severity_score': severity_score,
        'rationale': rationale
    })

hotspots_df = pd.DataFrame(hotspots)

# Interventions: 15
interventions = [
    {'intervention_id': 'I01', 'type': 'signage', 'cost_band': 'low', 'feasibility_score': 8, 'impact_range_db': '2-5', 'notes': 'Install quiet zone signs'},
    {'intervention_id': 'I02', 'type': 'barriers', 'cost_band': 'medium', 'feasibility_score': 6, 'impact_range_db': '5-10', 'notes': 'Noise barriers'},
    {'intervention_id': 'I03', 'type': 'scheduling_changes', 'cost_band': 'low', 'feasibility_score': 7, 'impact_range_db': '3-7', 'notes': 'Adjust event times'},
    {'intervention_id': 'I04', 'type': 'quiet_hours', 'cost_band': 'low', 'feasibility_score': 9, 'impact_range_db': '4-8', 'notes': 'Enforce quiet hours'},
    {'intervention_id': 'I05', 'type': 'maintenance', 'cost_band': 'medium', 'feasibility_score': 5, 'impact_range_db': '1-3', 'notes': 'Equipment maintenance'},
    {'intervention_id': 'I06', 'type': 'education', 'cost_band': 'low', 'feasibility_score': 8, 'impact_range_db': '1-4', 'notes': 'Community education'},
    {'intervention_id': 'I07', 'type': 'zoning', 'cost_band': 'high', 'feasibility_score': 4, 'impact_range_db': '5-15', 'notes': 'Change zoning laws'},
    {'intervention_id': 'I08', 'type': 'monitoring', 'cost_band': 'medium', 'feasibility_score': 7, 'impact_range_db': '0-2', 'notes': 'Increase monitoring'},
    {'intervention_id': 'I09', 'type': 'insulation', 'cost_band': 'high', 'feasibility_score': 5, 'impact_range_db': '6-12', 'notes': 'Building insulation'},
    {'intervention_id': 'I10', 'type': 'traffic_control', 'cost_band': 'medium', 'feasibility_score': 6, 'impact_range_db': '4-9', 'notes': 'Traffic calming'},
    {'intervention_id': 'I11', 'type': 'green_spaces', 'cost_band': 'high', 'feasibility_score': 6, 'impact_range_db': '2-6', 'notes': 'Add green buffers'},
    {'intervention_id': 'I12', 'type': 'curfews', 'cost_band': 'low', 'feasibility_score': 8, 'impact_range_db': '3-7', 'notes': 'Event curfews'},
    {'intervention_id': 'I13', 'type': 'subsidies', 'cost_band': 'medium', 'feasibility_score': 7, 'impact_range_db': '1-5', 'notes': 'Subsidize quiet tech'},
    {'intervention_id': 'I14', 'type': 'partnerships', 'cost_band': 'low', 'feasibility_score': 9, 'impact_range_db': '0-3', 'notes': 'Community partnerships'},
    {'intervention_id': 'I15', 'type': 'regulations', 'cost_band': 'high', 'feasibility_score': 3, 'impact_range_db': '7-20', 'notes': 'New noise regulations'}
]

interventions_df = pd.DataFrame(interventions)

# Plans/Scenarios: 200 pre-seeded
plans = []
for i in range(1, 201):
    plan_id = f'P{i:03d}'
    zone_id = random.choice(zones_df['zone_id'].tolist())
    interventions_selected = random.sample(interventions_df['intervention_id'].tolist(), random.randint(1, 5))
    budget = random.randint(1000, 10000)
    status = random.choice(['planned', 'in_progress', 'done'])
    expected_impact = random.randint(5, 20)
    created_by = 'planner'
    plans.append({
        'plan_id': plan_id,
        'zone_id': zone_id,
        'interventions_selected': interventions_selected,
        'budget': budget,
        'status': status,
        'expected_impact': expected_impact,
        'created_by': created_by
    })

plans_df = pd.DataFrame(plans)



# Save to CSV
zones_df.to_csv('data/zones.csv', index=False)
observations_df.to_csv('data/noise_observations.csv', index=False)
reports_df.to_csv('data/incident_reports.csv', index=False)
decisions_df.to_csv('data/moderation_decisions.csv', index=False)
hotspots_df.to_csv('data/hotspots.csv', index=False)
interventions_df.to_csv('data/interventions.csv', index=False)
plans_df['notes'] = [''] * len(plans_df)
plans_df.to_csv('data/plans.csv', index=False)

print("Data seeded successfully.")
