"""Concurrent lifecycle changes are serialised on PostgreSQL, without resetting data."""
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from test_admin_concurrency import isolated_admin_engine  # noqa: F401
from test_vacancies import brief, seed_scorecard
from app.core import security
from app.main import app
from app.models import Role, User, UserRole

ORIGIN = "http://localhost:3012"
PASSWORD = "synthetic-vacancy-test-password"


def clients(engine):
    with Session(engine) as db:
        user = User(email="vacancy-editor@example.com", password_hash=security.password_hasher.hash(PASSWORD))
        db.add(user); db.flush()
        db.add(UserRole(user_id=user.id, role_id=db.scalar(select(Role.id).where(Role.name == "hr"))))
        db.commit()
    result = []
    for _ in range(2):
        client = TestClient(app)
        assert client.post("/auth/login", headers={"Origin": ORIGIN}, json={"email": "vacancy-editor@example.com", "password": PASSWORD}).status_code == 200
        head = {"Origin": ORIGIN, "X-CSRF-Token": client.get("/auth/csrf").json()["csrf_token"]}
        result.append((client, head))
    return result


def test_concurrent_save_and_approval_cannot_approve_stale_draft(isolated_admin_engine):
    sessions = clients(isolated_admin_engine)
    try:
        client, head = sessions[0]
        record = client.post("/staff/vacancies", headers=head, json=brief()).json()
        version = record["versions"][0]
        with Session(isolated_admin_engine, expire_on_commit=False) as db:
            actor = db.scalar(select(User.id).where(User.email == "vacancy-editor@example.com"))
            record = seed_scorecard(db, record["id"], version["id"], actor)
        version = record["versions"][0]
        path = f"/staff/vacancies/{record['id']}/versions/{version['id']}"
        def write(index):
            c, headers = sessions[index]
            if index == 0:
                return c.put(path, headers=headers, json={**brief(), "revision": 2, "title": "Changed title"}).status_code
            return c.post(path + "/approve", headers=headers, json={"revision": 2}).status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(write, range(2)))
        assert sorted(results) == [200, 409]
        saved = client.get(f"/staff/vacancies/{record['id']}").json()["versions"][0]
        if saved["status"] == "approved":
            assert saved["title"] == brief()["title"]
        else:
            assert saved["title"] == "Changed title" and saved["revision"] == 3
    finally:
        for client, _ in sessions: client.close()


def test_concurrent_clones_create_one_draft(isolated_admin_engine):
    sessions = clients(isolated_admin_engine)
    try:
        client, head = sessions[0]
        record = client.post("/staff/vacancies", headers=head, json=brief()).json()
        version = record["versions"][0]
        with Session(isolated_admin_engine, expire_on_commit=False) as db:
            actor = db.scalar(select(User.id).where(User.email == "vacancy-editor@example.com"))
            record = seed_scorecard(db, record["id"], version["id"], actor)
        version = record["versions"][0]
        assert client.post(f"/staff/vacancies/{record['id']}/versions/{version['id']}/approve", headers=head, json={"revision": 2}).status_code == 200
        def clone(index):
            c, headers = sessions[index]
            return c.post(f"/staff/vacancies/{record['id']}/drafts", headers=headers, json={}).status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(clone, range(2)))
        assert sorted(results) == [201, 409]
        assert len(client.get(f"/staff/vacancies/{record['id']}").json()["versions"]) == 2
    finally:
        for client, _ in sessions: client.close()
