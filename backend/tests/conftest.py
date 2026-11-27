import os
from pathlib import Path
from unittest.mock import patch

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.core.config import Settings
from app.db import session as database


@pytest.fixture(scope="session")
def postgres_engine():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is not configured")
    settings = Settings(_env_file=None, database_url=url)
    with patch.object(database, "get_settings", lambda: settings):
        engine = create_engine(database.get_database_url(), hide_parameters=True)
        try:
            with engine.connect() as connection:
                assert connection.scalar(text("SELECT 1")) == 1
                assert inspect(connection).get_table_names() == [], "Use a NEW empty test database; nothing is reset."
            config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
            command.upgrade(config, "0001_baseline")
            with engine.connect() as connection:
                assert inspect(connection).get_table_names() == ["alembic_version"]
            command.upgrade(config, "0002_identity")
            # Verify the forward admin migration preserves an existing identity row.
            with engine.begin() as connection:
                probe_id = connection.scalar(text("INSERT INTO login_rate_limits (bucket_hash, attempts, expires_at) VALUES ('migration-preservation-probe', 1, '2099-01-01 00:00:00+00') RETURNING id"))
            command.upgrade(config, "head")
            with engine.connect() as connection:
                assert connection.scalar(text("SELECT id FROM login_rate_limits WHERE bucket_hash='migration-preservation-probe'")) == probe_id
            command.upgrade(config, "head")
            command.check(config)
            yield engine
        finally:
            engine.dispose()
