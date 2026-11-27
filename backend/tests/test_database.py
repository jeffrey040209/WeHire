from io import StringIO
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Column, Integer, MetaData, Table, create_engine, select
from sqlalchemy.pool import QueuePool

from app.core.config import Settings
from app.db import session as database
from app.main import app


def test_database_configuration_masks_secrets() -> None:
    settings = Settings(
        _env_file=None,
        database_url="postgresql+psycopg://test:unit-test-secret@localhost/test",
    )
    assert "unit-test-secret" not in repr(settings)
    assert "unit-test-secret" not in settings.model_dump_json()


@pytest.mark.parametrize(
    "url",
    [None, "not-a-url-unit-test-secret", "postgresql+psycopg://test:unit-test-secret@localhost:bad/test"],
)
def test_missing_or_invalid_configuration_has_safe_errors(monkeypatch, url) -> None:
    monkeypatch.setattr(database, "get_settings", lambda: Settings(_env_file=None, database_url=url))
    with pytest.raises((RuntimeError, ValueError)) as error:
        database.get_database_url()
    assert "unit-test-secret" not in str(error.value)


@pytest.mark.parametrize("url", [None, "postgresql+psycopg://test:unused@127.0.0.1:1/unavailable"])
def test_health_does_not_initialise_database_pool(monkeypatch, url) -> None:
    database.dispose_engine()
    monkeypatch.setattr(database, "get_settings", lambda: Settings(_env_file=None, database_url=url))
    create = MagicMock(side_effect=AssertionError("Health must not initialise a database pool"))
    monkeypatch.setattr(database, "create_engine", create)
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
    create.assert_not_called()


def test_sessions_require_commit_and_roll_back_failure(monkeypatch) -> None:
    # SQLite is used only to verify SQLAlchemy transaction lifecycle, not PostgreSQL compatibility.
    engine = create_engine("sqlite://", poolclass=QueuePool)
    records = Table("transaction_probe", MetaData(), Column("id", Integer, primary_key=True))
    records.create(engine)
    monkeypatch.setattr(database, "get_engine", lambda: engine)
    try:
        with database.session_scope() as session:
            session.execute(records.insert().values(id=1))
            session.commit()
        with database.session_scope() as session:
            session.execute(records.insert().values(id=2))
        with pytest.raises(RuntimeError, match="stop transaction"):
            with database.session_scope() as session:
                session.execute(records.insert().values(id=3))
                raise RuntimeError("stop transaction")
        with engine.connect() as connection:
            assert connection.execute(select(records.c.id)).scalars().all() == [1]
        assert engine.pool.checkedout() == 0
    finally:
        engine.dispose()


def test_baseline_generates_postgresql_sql_without_credentials(monkeypatch) -> None:
    monkeypatch.setattr(
        database,
        "get_settings",
        lambda: Settings(_env_file=None, database_url="postgresql+psycopg://test:unit%25secret@localhost/test"),
    )
    output = StringIO()
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"), output_buffer=output)
    command.upgrade(config, "0001_baseline", sql=True)
    sql = output.getvalue()
    assert "CREATE TABLE alembic_version" in sql
    assert "0001_baseline" in sql
    assert sql.count("CREATE TABLE") == 1
    assert "unit%25secret" not in sql
