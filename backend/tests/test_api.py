from fastapi.testclient import TestClient
import pytest

from app.main import app


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def _generate_dataset(client: TestClient) -> str:
    payload = {
        'dataset': 'student_performance',
        'num_records': 200,
        'include_missing_values': True,
        'include_outliers': True,
        'difficulty': 'beginner',
        'missing_value_percentage': 5,
        'outlier_percentage': 2,
        'noise_level': 1.1,
    }
    response = client.post('/api/datasets/generate', json=payload)
    assert response.status_code == 200
    body = response.json()
    return body['dataset_id']


def test_health_and_readiness(client: TestClient) -> None:
    health = client.get('/api/health')
    readiness = client.get('/api/readiness')
    assert health.status_code == 200
    assert readiness.status_code == 200


def test_generate_and_paginated_rows(client: TestClient) -> None:
    dataset_id = _generate_dataset(client)

    rows = client.get(
        f'/api/datasets/{dataset_id}/rows/paginated',
        params={
            'page': 1,
            'page_size': 25,
            'search': 'yes',
            'sort_by': 'attendance',
            'sort_dir': 'desc',
            'filter_column': 'attendance',
            'numeric_min': 50,
        },
    )
    assert rows.status_code == 200
    body = rows.json()
    assert body['page'] == 1
    assert body['page_size'] == 25
    assert 'rows' in body


def test_invalid_pagination_validation(client: TestClient) -> None:
    dataset_id = _generate_dataset(client)
    rows = client.get(
        f'/api/datasets/{dataset_id}/rows/paginated',
        params={
            'page': 0,
            'page_size': 500,
        },
    )
    assert rows.status_code == 422


def test_sessions_crud(client: TestClient) -> None:
    created = client.post('/api/sessions', json={'name': 'Test Session', 'state_json': '{"k":1}'})
    assert created.status_code == 200
    session_id = created.json()['session_id']

    listed = client.get('/api/sessions')
    assert listed.status_code == 200
    assert any(item['session_id'] == session_id for item in listed.json())

    updated = client.put(f'/api/sessions/{session_id}', json={'name': 'Renamed Session', 'state_json': '{"k":2}'})
    assert updated.status_code == 200
    assert updated.json()['name'] == 'Renamed Session'

    duplicated = client.post(f'/api/sessions/{session_id}/duplicate')
    assert duplicated.status_code == 200

    deleted = client.delete(f'/api/sessions/{session_id}')
    assert deleted.status_code == 200


def test_progress_summary(client: TestClient) -> None:
    event = client.post('/api/progress/events', json={'module': 'practice', 'event_type': 'question_attempted', 'score': 1})
    assert event.status_code == 200

    summary = client.get('/api/progress/summary')
    assert summary.status_code == 200
    assert 'total_events' in summary.json()


def test_upload_dataset_and_explore(client: TestClient) -> None:
    csv_content = 'city,population,score\nA,1000,7.5\nB,2000,8.1\n'
    response = client.post(
        '/api/datasets/upload',
        data={'dataset_name': 'city_metrics'},
        files={'file': ('city_metrics.csv', csv_content, 'text/csv')},
    )
    assert response.status_code == 200
    body = response.json()
    assert body['dataset_name'] == 'city_metrics'
    assert body['rows'] == 2
    assert body['columns'] == 3

    dataset_id = body['dataset_id']
    rows = client.get(f'/api/datasets/{dataset_id}/rows/paginated', params={'page': 1, 'page_size': 10})
    assert rows.status_code == 200
    assert rows.json()['total_rows'] == 2
