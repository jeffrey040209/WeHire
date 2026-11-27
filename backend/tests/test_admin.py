from datetime import UTC, datetime
import re

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import select

from test_auth import harness, ORIGIN, PASSWORD  # noqa: F401 -- reuse both DB backends
from app.api.routes import setup as setup_routes
from app.core.datetime_display import display_datetime
from app.core.security import now, verify_password
from app.db.soft_delete import soft_delete
from app.main import app
from app.models import Administrator, AdminSetup, Application, User, UserRole, VacancyAssignment

SETUP_TOKEN = "synthetic-private-bootstrap-key-for-tests-only"


def prepare_state(h, monkeypatch):
    state = h.db.scalar(select(AdminSetup).where(AdminSetup.id == 1).execution_options(include_deleted=True))
    if state is None:
        state = AdminSetup(id=1)
        h.db.add(state)
    h.settings.bootstrap_token = SecretStr(SETUP_TOKEN)
    monkeypatch.setattr(setup_routes, "get_settings", lambda: h.settings)
    h.db.commit()
    return state


@pytest.fixture
def administrator(harness, monkeypatch):
    h = harness
    state = prepare_state(h, monkeypatch)
    state.completed_at = now()
    h.db.add(Administrator(user_id=h.users["hr"].id))
    h.db.commit()
    assert h.login().status_code == 200
    csrf = h.client.get("/auth/csrf").json()["csrf_token"]
    h.headers = {"Origin": ORIGIN, "X-CSRF-Token": csrf}
    return h


def test_staff_and_candidates_do_not_gain_admin_access(harness):
    h = harness
    assert h.client.get("/admin/users").status_code == 401
    for name in ["hr", "manager", "bob"]:
        h.login(who=name)
        assert h.client.get("/auth/me").json()["is_admin"] is False
        assert h.client.get("/admin/users").status_code == 403
        csrf = h.client.get("/auth/csrf").json()["csrf_token"]
        assert h.client.post("/admin/users", headers={"Origin": ORIGIN, "X-CSRF-Token": csrf}, json={"email":"attack@example.com","password":PASSWORD,"role":"hr","is_admin":True}).status_code == 403


def test_admin_user_creation_and_password_redaction(administrator):
    h = administrator
    response = h.client.post("/admin/users", headers=h.headers, json={"email":"New.Staff@example.com","password":PASSWORD,"role":"hiring_manager"})
    assert response.status_code == 201
    user = response.json()
    assert user["email"] == "new.staff@example.com" and not user["is_admin"]
    assert user["roles"] == ["hiring_manager"]
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}", user["created_at"])
    assert "password" not in user and "password_hash" not in user
    assert PASSWORD not in response.text
    stored = h.db.get(User, user["id"])
    assert verify_password(stored.password_hash, PASSWORD)
    assert h.client.post("/admin/users", headers=h.headers, json={"email":user["email"],"password":PASSWORD,"role":"hr"}).status_code == 409
    bad = h.client.post("/admin/users", headers=h.headers, json={"email":"bad@example.com","password":{"secret":PASSWORD},"role":"hr"})
    assert bad.status_code == 422 and PASSWORD not in bad.text


def test_mutations_require_csrf_and_trusted_origin(administrator):
    h = administrator
    body = {"title":"Secure vacancy"}
    assert h.client.post("/admin/vacancies", headers={"Origin":ORIGIN}, json=body).status_code == 403
    assert h.client.post("/admin/vacancies", headers={**h.headers,"Origin":"https://attacker.invalid"}, json=body).status_code == 403
    assert h.client.post("/admin/vacancies", headers=h.headers, json=body).status_code == 201


def test_last_administrator_cannot_be_removed_or_locked_out(administrator):
    h = administrator
    identifier = h.users["hr"].id
    assert h.client.patch(f"/admin/users/{identifier}/status", headers=h.headers, json={"enabled":False}).status_code == 409
    assert h.client.put(f"/admin/users/{identifier}/administrator", headers=h.headers, json={"enabled":False}).status_code == 409
    assert h.client.delete(f"/admin/users/{identifier}", headers=h.headers).status_code == 409
    assert h.client.delete(f"/admin/users/{identifier}/roles/hr", headers=h.headers).status_code == 409
    assert h.client.get("/auth/me").json()["is_admin"] is True


def test_admin_delegation_is_explicit_and_candidate_boundary_is_preserved(administrator):
    h = administrator
    candidate_id = h.users["bob"].id
    manager_id = h.users["manager"].id
    assert h.client.put(f"/admin/users/{candidate_id}/administrator", headers=h.headers, json={"enabled":True}).status_code == 409
    assert h.client.post(f"/admin/users/{candidate_id}/roles", headers=h.headers, json={"role":"hr"}).status_code == 409
    assert h.client.put(f"/admin/users/{manager_id}/administrator", headers=h.headers, json={"enabled":True}).json()["is_admin"] is True
    assert h.client.patch(f"/admin/users/{manager_id}/status", headers=h.headers, json={"enabled":False}).status_code == 200
    assert h.client.put(f"/admin/users/{h.users['hr'].id}/administrator", headers=h.headers, json={"enabled":False}).status_code == 409


def test_password_change_and_disable_revoke_existing_sessions(administrator):
    h = administrator
    candidate_id = h.users["bob"].id
    other = TestClient(app)
    try:
        assert other.post("/auth/login", headers={"Origin":ORIGIN}, json={"email":"bob@example.com","password":PASSWORD}).status_code == 200
        assert h.client.put(f"/admin/users/{candidate_id}/password", headers=h.headers, json={"password":"replacement-test-password-only"}).status_code == 204
        assert other.get("/auth/me").status_code == 401
        assert other.post("/auth/login", headers={"Origin":ORIGIN}, json={"email":"bob@example.com","password":"replacement-test-password-only"}).status_code == 200
        assert h.client.patch(f"/admin/users/{candidate_id}/status", headers=h.headers, json={"enabled":False}).status_code == 200
        assert other.get("/auth/me").status_code == 401
    finally:
        other.close()


def test_metadata_crud_and_soft_deletion(administrator):
    h = administrator
    vacancy = h.client.post("/admin/vacancies", headers=h.headers, json={"title":"Admin-created vacancy"}).json()
    identifier = vacancy["id"]
    assert h.client.patch(f"/admin/vacancies/{identifier}", headers=h.headers, json={"title":"Updated vacancy"}).status_code == 200
    assignment = h.client.post("/admin/assignments", headers=h.headers, json={"user_id":h.users["manager"].id,"vacancy_id":identifier}).json()
    assert h.client.delete(f"/admin/assignments/{assignment['id']}", headers=h.headers).status_code == 204
    restored = h.client.post("/admin/assignments", headers=h.headers, json={"user_id":h.users["manager"].id,"vacancy_id":identifier}).json()
    assert restored["id"] == assignment["id"]
    application = h.client.post("/admin/applications", headers=h.headers, json={"candidate_user_id":h.users["bob"].id,"vacancy_id":identifier}).json()
    assert isinstance(application["id"],int)
    assert h.client.post("/admin/applications", headers=h.headers, json={"candidate_user_id":h.users["manager"].id,"vacancy_id":identifier}).status_code == 409
    assert h.client.delete(f"/admin/vacancies/{identifier}", headers=h.headers).status_code == 204
    assert h.db.scalar(select(Application).where(Application.id==application["id"])) is None
    assert h.db.scalar(select(Application).where(Application.id==application["id"]).execution_options(include_deleted=True)) is not None
    active = h.client.get("/admin/vacancies").json()
    archived = h.client.get("/admin/vacancies?include_archived=true").json()
    assert identifier not in [item["id"] for item in active["items"]]
    assert identifier in [item["id"] for item in archived["items"]]
    assert archived["total"] == active["total"] + 1


def test_user_deletion_retains_rows_and_reserved_email(administrator):
    h = administrator
    identifier = h.users["bob"].id
    assert h.client.delete(f"/admin/users/{identifier}", headers=h.headers).status_code == 204
    assert h.db.scalar(select(User).where(User.id==identifier)) is None
    assert h.db.scalar(select(User).where(User.id==identifier).execution_options(include_deleted=True)).deleted_at is not None
    assert h.client.post("/admin/users", headers=h.headers, json={"email":"bob@example.com","password":PASSWORD,"role":"candidate"}).status_code == 409
    assert h.client.get("/admin/users?include_archived=true").json()["total"] == 4


def test_user_search_pagination_and_role_controls(administrator):
    h = administrator
    assert h.client.get("/admin/users?kind=candidate").json()["total"] == 2
    page = h.client.get("/admin/users?limit=1&offset=1").json()
    assert len(page["items"])==1 and page["total"]==4
    assert h.client.get("/admin/users?q=bob").json()["items"][0]["email"] == "bob@example.com"
    manager = h.users["manager"].id
    assert h.client.post(f"/admin/users/{manager}/roles", headers=h.headers, json={"role":"hr"}).status_code == 200
    assert h.client.delete(f"/admin/users/{manager}/roles/hr", headers=h.headers).status_code == 200
    assert h.client.get("/admin/summary").json()["users"] == 4


def test_initial_setup_is_token_protected_and_one_time(harness, monkeypatch):
    h = harness
    prepare_state(h, monkeypatch)
    assert h.client.get("/setup/status").json()=={"enabled":True,"completed":False}
    body={"token":SETUP_TOKEN,"email":"initial-admin@example.com","password":PASSWORD}
    assert h.client.post("/setup/admin", json=body).status_code == 403
    assert h.client.post("/setup/admin", headers={"Origin":ORIGIN}, json={**body,"token":"incorrect-key"}).status_code==403
    created=h.client.post("/setup/admin", headers={"Origin":ORIGIN}, json=body)
    assert created.status_code==201
    assert h.client.get("/setup/status").json()=={"enabled":False,"completed":True}
    assert h.client.post("/setup/admin", headers={"Origin":ORIGIN}, json={**body,"email":"second@example.com"}).status_code==409
    user=h.db.get(User,created.json()["id"])
    soft_delete(h.db,user)
    h.db.commit()
    assert h.client.get("/setup/status").json()["enabled"] is False


def test_setup_is_disabled_without_private_key_and_does_not_promote_existing_users(harness, monkeypatch):
    h=harness
    prepare_state(h,monkeypatch)
    h.settings.bootstrap_token=None
    assert h.client.get("/setup/status").json()["enabled"] is False
    h.settings.bootstrap_token=SecretStr(SETUP_TOKEN)
    response=h.client.post("/setup/admin",headers={"Origin":ORIGIN},json={"token":SETUP_TOKEN,"email":"hr@example.com","password":PASSWORD})
    assert response.status_code==409
    assert h.db.scalar(select(Administrator)) is None
    assert h.client.get("/setup/status").json()["enabled"] is True


def test_display_datetime_uses_requested_seconds_format_and_malaysia_timezone():
    assert display_datetime(datetime(2026,11,27,4,9,48,999999,tzinfo=UTC)) == "2026-11-27 12:09:48"
    assert display_datetime(None) is None
