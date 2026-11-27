"""Opt-in real PostgreSQL migration checks; never reset existing data."""
from sqlalchemy import inspect, text

from app.db.base import Base


def test_postgresql_connection_and_migrations(postgres_engine) -> None:
    with postgres_engine.connect() as connection:
        assert set(inspect(connection).get_table_names()) == set(Base.metadata.tables) | {"alembic_version"}
        assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "0004_vacancy_scorecards"
        assert set(connection.scalars(text("SELECT name FROM roles"))) == {"hr", "hiring_manager", "candidate"}

        assert list(connection.execute(text("SELECT id, name FROM roles ORDER BY id"))) == [(1, "hr"), (2, "hiring_manager"), (3, "candidate")]
