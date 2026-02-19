import shutil
import sys
from pathlib import Path

import pytest


@pytest.fixture()
def app(tmp_path, monkeypatch):
    project_root = Path(__file__).resolve().parents[1]
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
    source_data_dir = project_root / 'data'
    test_data_dir = tmp_path / 'data'
    shutil.copytree(source_data_dir, test_data_dir)

    import app.data_loader as data_loader

    monkeypatch.setattr(data_loader, 'DATA_DIR', str(test_data_dir))

    from app import create_app

    flask_app = create_app()
    flask_app.config['TESTING'] = True
    return flask_app


@pytest.fixture()
def client(app):
    return app.test_client()


def headers(role='community', user_id='pytest-user'):
    return {
        'Role': role,
        'X-User-Id': user_id,
        'Content-Type': 'application/json'
    }
