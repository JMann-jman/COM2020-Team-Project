import json

from conftest import headers


def test_noise_data_zone_filter(client):
    response = client.get('/api/noise_data?zones=Z01', headers=headers('community'))
    assert response.status_code == 200
    rows = response.get_json()
    assert len(rows) > 0
    assert all(row['zone_id'] == 'Z01' for row in rows)


def test_noise_data_source_filter_sensor(client):
    response = client.get('/api/noise_data?source=Sensor', headers=headers('community'))
    assert response.status_code == 200
    rows = response.get_json()
    assert len(rows) > 0
    assert all(row['source'] == 'sensor' for row in rows)


def test_noise_data_category_filter(client):
    response = client.get('/api/noise_data?categories=traffic', headers=headers('community'))
    assert response.status_code == 200
    rows = response.get_json()
    assert len(rows) > 0
    assert all(row['category_tag'] == 'traffic' for row in rows)


def test_noise_data_time_window_filter_last_24h(client):
    response = client.get('/api/noise_data?time_window=Last%2024%20hours', headers=headers('community'))
    assert response.status_code == 200
    rows = response.get_json()
    assert isinstance(rows, list)


def test_hotspots_returns_top_10_by_default(client):
    response = client.get('/api/hotspots', headers=headers('community'))
    assert response.status_code == 200
    rows = response.get_json()
    assert len(rows) <= 10
    if len(rows) > 1:
        assert rows[0]['severity_score'] >= rows[1]['severity_score']


def test_hotspots_severity_formula_fields_present(client):
    response = client.get('/api/hotspots?top=3', headers=headers('community'))
    assert response.status_code == 200
    rows = response.get_json()
    assert len(rows) > 0
    row = rows[0]
    assert 'avg_noise_db' in row
    assert 'validated_report_count' in row
    assert row['severity_score'] >= row['avg_noise_db']


def test_submit_incident_report_success(client):
    payload = {
        'zone_id': 'Z03',
        'category': 'traffic',
        'time_window': 'day',
        'description': 'loud road noise'
    }
    response = client.post('/api/reports', data=json.dumps(payload), headers=headers('community'))
    assert response.status_code == 201
    body = response.get_json()
    assert body['message'] == 'Report submitted'
    assert 'is_duplicate' in body


def test_submit_duplicate_is_flagged_but_accepted(client):
    payload = {
        'zone_id': 'Z04',
        'category': 'music',
        'time_window': 'evening',
        'description': 'repeated loud music'
    }
    first = client.post('/api/reports', data=json.dumps(payload), headers=headers('community'))
    second = client.post('/api/reports', data=json.dumps(payload), headers=headers('community'))
    assert first.status_code == 201
    assert second.status_code == 201
    assert second.get_json()['is_duplicate'] is True


def test_dedup_rule_same_zone_time_any_category_flags(client):
    payload1 = {
        'zone_id': 'Z05',
        'category': 'music',
        'time_window': 'evening',
        'description': 'first report'
    }
    payload2 = {
        'zone_id': 'Z05',
        'category': 'traffic',
        'time_window': 'evening',
        'description': 'different category same zone/time'
    }
    client.post('/api/reports', data=json.dumps(payload1), headers=headers('community'))
    response = client.post('/api/reports', data=json.dumps(payload2), headers=headers('community'))
    assert response.status_code == 201
    assert response.get_json()['is_duplicate'] is True


def test_moderation_updates_report_status(client):
    submit_payload = {
        'zone_id': 'Z06',
        'category': 'traffic',
        'time_window': 'morning',
        'description': 'moderation target'
    }
    submit_response = client.post('/api/reports', data=json.dumps(submit_payload), headers=headers('community'))
    assert submit_response.status_code == 201

    reports_response = client.get('/api/reports', headers=headers('planner'))
    report_id = reports_response.get_json()[-1]['report_id']

    moderate_payload = {'decision': 'valid', 'reason': 'clear description'}
    moderate_response = client.put(
        f'/api/reports/{report_id}',
        data=json.dumps(moderate_payload),
        headers=headers('planner')
    )
    assert moderate_response.status_code == 200

    latest_reports = client.get('/api/reports', headers=headers('planner')).get_json()
    moderated = [r for r in latest_reports if r['report_id'] == report_id][0]
    assert moderated['status'] == 'valid'


def test_create_plan_success(client):
    payload = {
        'zone_id': 'Z01',
        'interventions': ['INT001', 'INT002'],
        'notes': 'pytest plan'
    }
    response = client.post('/api/plans', data=json.dumps(payload), headers=headers('planner'))
    assert response.status_code == 201
    body = response.get_json()
    assert 'plan_id' in body


def test_export_csv_observations_filtered(client):
    response = client.get('/api/export/csv?type=observations&zones=Z01&source=Sensor', headers=headers('community'))
    assert response.status_code == 200
    assert 'text/csv' in response.content_type


def test_export_pdf_reports(client):
    response = client.get('/api/export/pdf?type=reports', headers=headers('community'))
    assert response.status_code == 200
    assert 'application/pdf' in response.content_type


def test_role_protection_blocks_planner_route_for_community(client):
    payload = {
        'zone_id': 'Z01',
        'interventions': ['INT001'],
        'notes': 'unauthorized attempt'
    }
    response = client.post('/api/plans', data=json.dumps(payload), headers=headers('community'))
    assert response.status_code == 403
