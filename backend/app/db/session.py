from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache

from sqlalchemy import Engine, URL, create_engine, make_url
from sqlalchemy.exc import ArgumentError
from sqlalchemy.orm import Session

from app.core.config import get_settings


def get_database_url() -> URL:
    """Read the secret only when a database operation is requested."""
    secret = get_settings().database_url
    if secret is None or not secret.get_secret_value().strip():
        raise RuntimeError("DATABASE_URL is required for database operations.")
    try:
        url = make_url(secret.get_secret_value())
    except (ArgumentError, ValueError):
        raise ValueError("DATABASE_URL is not a valid database connection URL.") from None
    if url.drivername != "postgresql+psycopg":
        raise ValueError("DATABASE_URL must use the postgresql+psycopg driver.")
    return url


@lru_cache
def get_engine() -> Engine:
    """Create the pool lazily; SQLAlchemy connects on first database use."""
    return create_engine(
        get_database_url(),
        pool_pre_ping=True,
        echo=False,
        hide_parameters=True,
        connect_args={"connect_timeout": 5},
    )


@contextmanager
def session_scope() -> Iterator[Session]:
    """Close every session and roll back failures; callers commit explicitly."""
    with Session(get_engine(), autoflush=False, expire_on_commit=False) as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise


def get_db_session() -> Iterator[Session]:
    """FastAPI dependency for future synchronous database routes."""
    with session_scope() as session:
        yield session


def dispose_engine() -> None:
    """Release an existing pool without creating one during app shutdown."""
    if get_engine.cache_info().currsize:
        get_engine().dispose()
        get_engine.cache_clear()
