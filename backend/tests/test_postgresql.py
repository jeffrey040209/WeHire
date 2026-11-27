"""Opt-in integration check; only use a dedicated empty development/test database."""
import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

from app.core.config import Settings
from app.db import session as database


@pytest.mark.skipif(not os.environ.get("TEST_DATABASE_URL"), reason="TEST_DATABASE_URL is not configured")
def test_postgresql_connection_and_baseline(monkeypatch) -> None:
    database.dispose_engine()
    settings = Settings(_env_file=None, database_url=os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(database, "get_settings", lambda: settings)
    engine = database.get_engine()
    try:
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT 1")) == 1
            assert inspect(connection).get_table_names() == [], "Use a new empty test database; nothing is reset."
        config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
        command.upgrade(config, "head")
        command.upgrade(config, "head")  # Applying the current baseline again is harmless.
        with engine.connect() as connection:
            assert inspect(connection).get_table_names() == ["alembic_version"]
            assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "0001_baseline"
    finally:
        database.dispose_engine()
