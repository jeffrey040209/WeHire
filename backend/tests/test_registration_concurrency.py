from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from test_admin_concurrency import isolated_admin_engine  # noqa: F401 -- isolated PostgreSQL schema
from app.core import security
from app.main import app
from app.models import Administrator, User, UserRole

ORIGIN="http://localhost:3012"
PASSWORD="synthetic-parallel-registration-password"


def attempt(email):
    with TestClient(app) as client:
        response=client.post("/auth/register",headers={"Origin":ORIGIN},json={"email":email,"password":PASSWORD})
        return response.status_code,response.json()


def test_concurrent_duplicate_registration_is_generic_and_creates_one_candidate(isolated_admin_engine):
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(attempt,["parallel@example.com","PARALLEL@example.com"]))
    assert results[0]==results[1]
    assert results[0][0]==202
    with Session(isolated_admin_engine) as db:
        assert db.scalar(select(func.count()).select_from(User))==1
        assert db.scalar(select(func.count()).select_from(UserRole))==1
        user=db.scalar(select(User))
        assert security.role_names(db,user.id)=={"candidate"}
        assert db.scalar(select(Administrator)) is None


def test_concurrent_registration_email_limit_is_atomic(isolated_admin_engine):
    security.get_settings().auth_register_email_limit=2
    with ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(attempt,["limited@example.com"]*4))
    statuses=[result[0] for result in results]
    assert statuses.count(202)==2
    assert statuses.count(429)==2
    with Session(isolated_admin_engine) as db:
        assert db.scalar(select(func.count()).select_from(User))==1
