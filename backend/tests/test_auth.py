from dataclasses import dataclass
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.routes import auth as auth_routes
from app.core import security
from app.core.config import Settings
from app.db.base import Base
from app.db.session import get_db_session
from app.main import app
from app.models import Application, AuthSession, LoginRateLimit, Role, User, UserRole, Vacancy, VacancyAssignment

ORIGIN = "http://localhost:3012"
PASSWORD = "test-password-only-very-long"


@dataclass
class Harness:
    client: TestClient
    db: Session
    users: dict
    applications: dict
    vacancies: list
    settings: Settings

    def login(self, who="hr", password=PASSWORD, **kwargs):
        return self.client.post("/auth/login", json={"email": f"{who}@example.com", "password": password}, headers={"Origin": ORIGIN}, **kwargs)


@pytest.fixture(params=["sqlite", "postgres"])
def harness(request, monkeypatch):
    pg = request.param == "postgres"
    if pg:
        engine = request.getfixturevalue("postgres_engine")
        connection = engine.connect()
        transaction = connection.begin()
        db = Session(connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    else:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        @event.listens_for(engine, "connect")
        def enable_foreign_keys(dbapi_connection, connection_record):
            dbapi_connection.execute("PRAGMA foreign_keys=ON")
        Base.metadata.create_all(engine)
        db = Session(engine, expire_on_commit=False)
        db.add_all([Role(name=r) for r in ["hr", "hiring_manager", "candidate"]])
        db.commit()
    settings = Settings(_env_file=None, auth_cookie_secure=False, auth_login_account_limit=5, auth_login_ip_limit=30)
    monkeypatch.setattr(security, "get_settings", lambda: settings)
    monkeypatch.setattr(auth_routes, "get_settings", lambda: settings)
    encoded = security.password_hasher.hash(PASSWORD)
    users = {name: User(email=f"{name}@example.com", password_hash=encoded) for name in ["hr", "manager", "bob", "carol"]}
    db.add_all(users.values())
    vacancies = [Vacancy(title="Backend developer"), Vacancy(title="Product designer")]
    db.add_all(vacancies)
    db.flush()
    for name, role in [("hr", "hr"), ("manager", "hiring_manager"), ("bob", "candidate"), ("carol", "candidate")]:
        db.add(UserRole(user_id=users[name].id, role_id=db.scalar(select(Role.id).where(Role.name == role))))
    db.add(VacancyAssignment(user_id=users["hr"].id, vacancy_id=vacancies[0].id))
    applications = {"bob": Application(candidate_user_id=users["bob"].id, vacancy_id=vacancies[0].id), "carol": Application(candidate_user_id=users["carol"].id, vacancy_id=vacancies[1].id)}
    applications["carol_same_vacancy"] = Application(candidate_user_id=users["carol"].id, vacancy_id=vacancies[0].id)
    db.add_all(applications.values())
    db.commit()
    def override():
        yield db
    app.dependency_overrides[get_db_session] = override
    client = TestClient(app)
    try:
        yield Harness(client, db, users, applications, vacancies, settings)
    finally:
        client.close()
        app.dependency_overrides.clear()
        db.close()
        if pg:
            transaction.rollback()
            connection.close()
        else:
            engine.dispose()


def test_login_cookie_and_hashed_session(harness):
    h = harness
    response = h.login()
    assert response.status_code == 200
    assert response.json()["roles"] == ["hr"]
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie and "path=/" in cookie
    token = h.client.cookies.get(security.COOKIE_NAME)
    record = h.db.scalar(select(AuthSession))
    assert record.token_hash == security.hash_token(token) and record.token_hash != token
    assert h.users["hr"].password_hash.startswith("sha256$")
    assert token not in response.text and PASSWORD not in response.text
    assert response.headers["cache-control"] == "no-store"
    assert h.client.get("/auth/me").json()["id"] == h.users["hr"].id


def test_invalid_unknown_disabled_credentials_are_generic(harness):
    h = harness
    wrong = h.login(password="incorrect").json()
    missing = h.login(who="missing").json()
    h.users["bob"].is_active = False
    h.db.commit()
    disabled = h.login(who="bob").json()
    assert wrong == missing == disabled == {"detail": "Invalid email or password"}
    assert h.client.get("/auth/me").status_code == 401


def test_missing_invalid_and_forged_identity(harness):
    h = harness
    assert h.client.get("/auth/me", headers={"X-User-ID": str(h.users["hr"].id), "X-Role": "hr"}).status_code == 401
    h.client.cookies.set(security.COOKIE_NAME, "x" * 43)
    assert h.client.get("/auth/me").status_code == 401
    assert h.client.get("/staff/access").status_code == 401


@pytest.mark.parametrize("state", ["expired", "revoked", "disabled"])
def test_unusable_sessions(harness, state):
    h = harness
    assert h.login().status_code == 200
    record = h.db.scalar(select(AuthSession))
    if state == "expired":
        record.created_at = security.now() - timedelta(hours=2)
        record.expires_at = security.now() - timedelta(hours=1)
    elif state == "revoked":
        record.revoked_at = security.now()
    else:
        h.users["hr"].is_active = False
    h.db.commit()
    assert h.client.get("/auth/me").status_code == 401


def test_csrf_and_logout_revoke_server_session(harness):
    h = harness
    assert h.client.post("/auth/login", json={"email": "hr@example.com", "password": PASSWORD}).status_code == 403
    assert h.client.post("/auth/login", headers={"Origin": "https://attacker.invalid"}, json={"email": "hr@example.com", "password": PASSWORD}).status_code == 403
    assert h.login().status_code == 200
    token = h.client.cookies.get(security.COOKIE_NAME)
    assert h.client.post("/auth/logout", headers={"Origin": ORIGIN}).status_code == 403
    csrf = h.client.get("/auth/csrf").json()["csrf_token"]
    assert h.client.post("/auth/logout", headers={"Origin": "https://attacker.invalid", "X-CSRF-Token": csrf}).status_code == 403
    assert h.client.post("/auth/logout", headers={"Origin": ORIGIN, "X-CSRF-Token": csrf}).status_code == 204
    h.client.cookies.set(security.COOKIE_NAME, token)
    assert h.client.get("/auth/me").status_code == 401


def test_login_rotates_browser_session(harness):
    h = harness
    h.login()
    old = h.client.cookies.get(security.COOKIE_NAME)
    h.login()
    new = h.client.cookies.get(security.COOKIE_NAME)
    assert new != old
    h.client.cookies.clear()
    h.client.cookies.set(security.COOKIE_NAME, old)
    assert h.client.get("/auth/me").status_code == 401


def test_account_and_ip_rate_limits(harness):
    h = harness
    h.settings.auth_login_account_limit = 2
    for _ in range(2):
        assert h.login(password="wrong").status_code == 401
    limited = h.login()
    assert limited.status_code == 429 and int(limited.headers["Retry-After"]) > 0
    # Changing the submitted account cannot bypass the independent client-IP cap.
    h.settings.auth_login_ip_limit = 3
    assert h.login(who="another").status_code == 429
    assert len(list(h.db.scalars(select(LoginRateLimit)))) >= 2


@pytest.mark.parametrize("capability", ["resume-submission", "disc-result-upload", "clarification-response"])
def test_candidate_ownership(harness, capability):
    h = harness
    h.login(who="bob")
    own = str(h.applications["bob"].id)
    other = str(h.applications["carol"].id)
    other_same_vacancy = str(h.applications["carol_same_vacancy"].id)
    assert h.client.get(f"/applications/{own}/access/{capability}").status_code == 200
    assert h.client.get(f"/applications/{other}/access/{capability}", params={"candidate_user_id": str(h.users["carol"].id)}).status_code == 404
    assert h.client.get(f"/applications/{other_same_vacancy}/access/{capability}").status_code == 404
    assert h.client.get(f"/applications/{999999999}/access/{capability}").status_code == 404
    assert h.client.get("/staff/access").status_code == 403


def test_staff_role_and_assignment_both_required(harness):
    h = harness
    h.login()
    visible = h.client.get("/staff/access").json()["vacancies"]
    assert [v["id"] for v in visible] == [h.vacancies[0].id]
    assert h.client.get(f'/staff/applications/{h.applications["bob"].id}/access').status_code == 200
    assert h.client.get(f'/staff/applications/{h.applications["carol"].id}/access').status_code == 404
    assert h.client.get(f'/applications/{h.applications["bob"].id}/access/resume-submission').status_code == 403
    h.login(who="manager")
    assert h.client.get("/staff/access").json() == {"vacancies": []}
    assert h.client.get(f'/staff/applications/{h.applications["bob"].id}/access').status_code == 404
    h.db.add(VacancyAssignment(user_id=h.users["manager"].id, vacancy_id=h.vacancies[0].id))
    h.db.commit()
    assert h.client.get(f'/staff/applications/{h.applications["bob"].id}/access').status_code == 200
    h.db.delete(h.db.scalar(select(UserRole).join(Role).where(UserRole.user_id == h.users["manager"].id, Role.name == "hiring_manager")))
    h.db.commit()
    assert h.client.get("/staff/access").status_code == 403


def test_secure_cookie_mode_and_validation_redaction(harness):
    h = harness
    h.settings.auth_cookie_secure = True
    response = h.login()
    assert "secure" in response.headers["set-cookie"].lower()
    response = h.client.post("/auth/login", headers={"Origin": ORIGIN}, json={"email": "hr@example.com", "password": {"secret": PASSWORD}})
    assert response.status_code == 422 and PASSWORD not in response.text


def test_candidate_role_is_not_accepted_from_login_payload(harness):
    h = harness
    response = h.client.post("/auth/login", headers={"Origin": ORIGIN}, json={
        "email": "bob@example.com", "password": PASSWORD, "roles": ["hr"], "user_id": str(h.users["hr"].id),
    })
    assert response.status_code == 200 and response.json()["roles"] == ["candidate"]
    assert h.client.get("/staff/access").status_code == 403






def test_rate_window_expires(harness, monkeypatch):
    h = harness
    h.settings.auth_login_account_limit = 1
    fixed = security.now()
    monkeypatch.setattr(security, "now", lambda: fixed)
    assert h.login(password="wrong").status_code == 401
    assert h.login().status_code == 429
    monkeypatch.setattr(security, "now", lambda: fixed + timedelta(seconds=h.settings.auth_login_window_seconds + 1))
    assert h.login().status_code == 200


def test_forwarded_header_does_not_bypass_client_ip_limit(harness):
    h = harness
    h.settings.auth_login_ip_limit = 1
    for index, expected in [(1, 401), (2, 429)]:
        response = h.client.post("/auth/login", headers={"Origin": ORIGIN, "X-Forwarded-For": f"192.0.2.{index}"}, json={"email": f"missing{index}@example.com", "password": "wrong"})
        assert response.status_code == expected




def test_soft_deleted_users_cannot_sign_in_or_use_existing_sessions(harness):
    from app.db.soft_delete import soft_delete
    h = harness
    h.login(who="bob")
    user_id = h.users["bob"].id
    soft_delete(h.db, h.users["bob"])
    h.db.commit()
    assert h.client.get("/auth/me").status_code == 401
    assert h.login(who="bob").status_code == 401
    assert h.db.scalar(select(User).where(User.id == user_id)) is None
    archived = h.db.scalar(select(User).where(User.id == user_id).execution_options(include_deleted=True))
    assert archived is not None and archived.deleted_at is not None
    assert h.db.scalar(select(Application).where(Application.candidate_user_id == user_id)) is None
    assert h.db.scalar(select(Application).where(Application.candidate_user_id == user_id).execution_options(include_deleted=True)) is not None


def test_soft_deleted_vacancy_revokes_linked_access_but_preserves_rows(harness):
    h = harness
    h.login()
    vacancy_id = h.vacancies[0].id
    application_id = h.applications["bob"].id
    h.db.delete(h.vacancies[0])
    h.db.commit()
    assert h.client.get("/staff/access").json() == {"vacancies": []}
    assert h.client.get(f"/staff/applications/{application_id}/access").status_code == 404
    assert h.db.scalar(select(Vacancy).where(Vacancy.id == vacancy_id).execution_options(include_deleted=True)).deleted_at is not None
    archived = h.db.scalar(select(Application).where(Application.id == application_id).execution_options(include_deleted=True))
    assert archived is not None and archived.deleted_at is not None
    h.login(who="bob")
    assert h.client.get(f"/applications/{application_id}/access/resume-submission").status_code == 404


def test_soft_deleted_application_and_assignment_are_hidden(harness):
    h = harness
    h.login()
    application_id = h.applications["bob"].id
    h.db.delete(h.applications["bob"])
    link = h.db.scalar(select(VacancyAssignment).where(VacancyAssignment.user_id == h.users["hr"].id))
    h.db.delete(link)
    h.db.commit()
    assert h.client.get("/staff/access").json() == {"vacancies": []}
    assert h.client.get(f"/staff/applications/{application_id}/access").status_code == 404
    assert h.db.scalar(select(VacancyAssignment).where(VacancyAssignment.id == link.id).execution_options(include_deleted=True)).deleted_at is not None
    assert h.db.scalar(select(Application).where(Application.id == application_id).execution_options(include_deleted=True)).deleted_at is not None


def test_revoked_role_can_be_restored_without_duplicate_rows(harness):
    from app.services.identity import add_role
    h = harness
    h.login()
    link = h.db.scalar(select(UserRole).where(UserRole.user_id == h.users["hr"].id))
    original_id = link.id
    h.db.delete(link)
    h.db.commit()
    assert h.client.get("/staff/access").status_code == 403
    add_role(h.db, h.users["hr"], "hr")
    h.db.commit()
    links = list(h.db.scalars(select(UserRole).where(UserRole.user_id == h.users["hr"].id).execution_options(include_deleted=True)))
    assert len(links) == 1 and links[0].id == original_id and links[0].deleted_at is None
    assert h.client.get("/staff/access").status_code == 200


def test_soft_deleted_sessions_and_role_definitions_are_rejected(harness):
    h = harness
    h.login()
    role = h.db.scalar(select(Role).where(Role.name == "hr"))
    h.db.delete(role)
    h.db.commit()
    assert h.client.get("/staff/access").status_code == 403
    session = h.db.scalar(select(AuthSession))
    h.db.delete(session)
    h.db.commit()
    assert h.client.get("/auth/me").status_code == 401
    assert h.db.scalar(select(AuthSession).execution_options(include_deleted=True)).deleted_at is not None


def test_bulk_hard_deletion_is_rejected(harness):
    from sqlalchemy import delete
    h = harness
    with pytest.raises(ValueError, match="Permanent DELETE"):
        h.db.execute(delete(User).where(User.id == h.users["bob"].id))
    assert h.db.scalar(select(User).where(User.id == h.users["bob"].id)) is not None


def test_expired_throttle_counters_are_soft_deleted(harness, monkeypatch):
    h = harness
    current = security.now()
    old = LoginRateLimit(bucket_hash="old-counter-test", attempts=1, expires_at=current-timedelta(days=2))
    h.db.add(old)
    h.db.commit()
    h.login()
    assert h.db.scalar(select(LoginRateLimit).where(LoginRateLimit.bucket_hash == "old-counter-test")) is None
    archived = h.db.scalar(select(LoginRateLimit).where(LoginRateLimit.bucket_hash == "old-counter-test").execution_options(include_deleted=True))
    assert archived is not None and archived.deleted_at is not None


def test_numeric_ids_and_timestamp_column_order(harness):
    from sqlalchemy import DateTime, Integer, inspect
    h = harness
    assert isinstance(h.users["hr"].id, int) and h.users["hr"].id > 0
    assert isinstance(h.applications["bob"].id, int) and h.applications["bob"].id > 0
    inspector = inspect(h.db.connection())
    for table in Base.metadata.tables.values():
        columns = inspector.get_columns(table.name)
        assert columns[0]["name"] == "id" and isinstance(columns[0]["type"], Integer)
        assert [c["name"] for c in columns[-3:]] == ["created_at", "updated_at", "deleted_at"]
        saw_datetime = False
        for column in columns:
            if isinstance(column["type"], DateTime):
                saw_datetime = True
            else:
                assert not saw_datetime, f"Business column after datetime in {table.name}"
