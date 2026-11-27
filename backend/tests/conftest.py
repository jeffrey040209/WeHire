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
            with engine.begin() as connection:
                legacy_user = connection.scalar(text("INSERT INTO users (email, password_hash) VALUES ('migration-probe@example.com', 'unused-test-only') RETURNING id"))
                legacy_vacancy = connection.scalar(text("INSERT INTO vacancies (title) VALUES ('Retained legacy vacancy') RETURNING id"))
                legacy_assignment = connection.scalar(text("INSERT INTO vacancy_assignments (user_id, vacancy_id) VALUES (:user, :vacancy) RETURNING id"), {"user": legacy_user, "vacancy": legacy_vacancy})
                legacy_application = connection.scalar(text("INSERT INTO applications (candidate_user_id, vacancy_id) VALUES (:user, :vacancy) RETURNING id"), {"user": legacy_user, "vacancy": legacy_vacancy})
            command.upgrade(config, "head")
            with engine.begin() as connection:
                assert connection.scalar(text("SELECT title FROM vacancies WHERE id=:id"), {"id": legacy_vacancy}) == "Retained legacy vacancy"
                assert connection.scalar(text("SELECT version FROM vacancy_configurations WHERE vacancy_id=:id"), {"id": legacy_vacancy}) == 1
                assert connection.scalar(text("SELECT id FROM vacancy_assignments WHERE user_id=:user AND vacancy_id=:vacancy"), {"user": legacy_user, "vacancy": legacy_vacancy}) == legacy_assignment
                assert connection.scalar(text("SELECT id FROM applications WHERE candidate_user_id=:user AND vacancy_id=:vacancy"), {"user": legacy_user, "vacancy": legacy_vacancy}) == legacy_application
                # Retain migration probes as archived rows, invisible to normal fixture queries.
                for table, key, value in [("users", "id", legacy_user), ("vacancies", "id", legacy_vacancy),
                    ("vacancy_assignments", "id", legacy_assignment), ("applications", "id", legacy_application),
                    ("vacancy_configurations", "vacancy_id", legacy_vacancy)]:
                    connection.execute(text(f"UPDATE {table} SET deleted_at=now() WHERE {key}=:id"), {"id": value})
            with engine.connect() as connection:
                assert connection.scalar(text("SELECT id FROM login_rate_limits WHERE bucket_hash='migration-preservation-probe'")) == probe_id
            command.upgrade(config, "head")
            command.check(config)
            yield engine
        finally:
            engine.dispose()
