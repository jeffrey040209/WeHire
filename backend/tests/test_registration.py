import pytest
from sqlalchemy import func, select

from test_auth import harness, ORIGIN, PASSWORD  # noqa: F401 -- both DB backends
from app.core import security
from app.db.soft_delete import soft_delete
from app.models import Administrator, Application, AuthSession, User, UserRole


def register(h, email="new-candidate@example.com", password=PASSWORD, **extra):
    return h.client.post("/auth/register", headers={"Origin":ORIGIN}, json={"email":email,"password":password,**extra})


def test_register_assigns_only_candidate_without_session_or_application(harness):
    h=harness
    response=register(h,email="New.Candidate@example.com")
    assert response.status_code==202
    assert set(response.json())=={"message"}
    assert response.headers["cache-control"]=="no-store"
    assert "set-cookie" not in response.headers
    assert PASSWORD not in response.text and "password_hash" not in response.text
    user=h.db.scalar(select(User).where(User.email=="new.candidate@example.com"))
    assert isinstance(user.id,int) and user.is_active
    assert security.verify_password(user.password_hash,PASSWORD)
    assert security.role_names(h.db,user.id)=={"candidate"}
    assert h.db.scalar(select(Administrator).where(Administrator.user_id==user.id)) is None
    assert h.db.scalar(select(AuthSession).where(AuthSession.user_id==user.id)) is None
    assert h.db.scalar(select(Application).where(Application.candidate_user_id==user.id)) is None
    assert h.client.get("/auth/me").status_code==401
    login=h.client.post("/auth/login",headers={"Origin":ORIGIN},json={"email":"new.candidate@example.com","password":PASSWORD})
    assert login.status_code==200 and login.json()["roles"]==["candidate"] and not login.json()["is_admin"]
    assert h.client.get("/admin/users").status_code==403
    assert h.client.get("/staff/access").status_code==403


@pytest.mark.parametrize("state",["candidate","staff","disabled","archived"])
def test_duplicates_are_generic_and_never_reset_restore_or_promote(harness,state):
    h=harness
    user=h.users["hr" if state=="staff" else "bob"]
    original_hash=user.password_hash
    if state=="disabled": user.is_active=False
    if state=="archived": soft_delete(h.db,user)
    h.db.commit()
    original_active=user.is_active
    original_deleted=user.deleted_at
    original_roles=security.role_names(h.db,user.id)
    new=register(h,email="brand-new@example.com")
    duplicate=register(h,email=user.email.upper(),password="different-registration-password-only")
    assert new.status_code==duplicate.status_code==202
    assert new.json()==duplicate.json()
    assert "set-cookie" not in duplicate.headers
    assert user.password_hash==original_hash and user.is_active==original_active and user.deleted_at==original_deleted
    assert security.role_names(h.db,user.id)==original_roles
    assert h.db.scalar(select(func.count()).select_from(User).where(User.email==user.email).execution_options(include_deleted=True))==1


@pytest.mark.parametrize("field,value",[
    ("role","hr"),("roles",["hiring_manager"]),("is_admin",True),("permissions",["all"]),
    ("user_id",1),("candidate_user_id",1),("application_id",1),("vacancy_id",1),
    ("ownership",{"candidate_user_id":1}),("email_verified",True),("is_active",True),
])
def test_registration_rejects_identity_role_permission_and_ownership_fields(harness,field,value):
    h=harness
    response=register(h,**{field:value})
    assert response.status_code==422
    assert PASSWORD not in response.text
    assert h.db.scalar(select(User).where(User.email=="new-candidate@example.com")) is None


@pytest.mark.parametrize("email,password",[
    ("invalid",PASSWORD),("",PASSWORD),("a"*255+"@example.com",PASSWORD),
    ("new@example.com","short"),("new@example.com","x"*129),("new@example.com",None),
    ("new@example.com",{"secret":PASSWORD}),
])
def test_registration_validates_email_password_without_echoing_secrets(harness,email,password):
    response=register(harness,email=email,password=password)
    assert response.status_code==422
    assert PASSWORD not in response.text


def test_registration_requires_exact_trusted_origin(harness):
    h=harness
    body={"email":"new@example.com","password":PASSWORD}
    assert h.client.post("/auth/register",json=body).status_code==403
    assert h.client.post("/auth/register",headers={"Origin":"https://attacker.invalid"},json=body).status_code==403
    assert h.db.scalar(select(User).where(User.email==body["email"])) is None


def test_registration_limits_email_and_ip_without_consuming_login_budget(harness):
    h=harness
    h.settings.auth_register_email_limit=1
    assert register(h).status_code==202
    # Case changes do not bypass the normalised-email limit.
    throttled=register(h,email="NEW-CANDIDATE@example.com")
    assert throttled.status_code==429 and int(throttled.headers["Retry-After"])>0
    assert h.login().status_code==200
    h.settings.auth_register_ip_limit=2
    assert register(h,email="another@example.com").status_code==429


def test_registration_counts_invalid_field_requests_and_ignores_forwarded_ip(harness):
    h=harness
    h.settings.auth_register_ip_limit=1
    assert register(h,role="hr").status_code==422
    response=h.client.post("/auth/register",headers={"Origin":ORIGIN,"X-Forwarded-For":"192.0.2.5"},json={"email":"another@example.com","password":PASSWORD})
    assert response.status_code==429


def test_registration_window_expiry(harness,monkeypatch):
    h=harness
    h.settings.auth_register_ip_limit=1
    fixed=security.now()
    monkeypatch.setattr(security,"now",lambda:fixed)
    assert register(h).status_code==202
    assert register(h,email="later@example.com").status_code==429
    from datetime import timedelta
    monkeypatch.setattr(security,"now",lambda:fixed+timedelta(seconds=h.settings.auth_register_window_seconds+1))
    assert register(h,email="later@example.com").status_code==202


def test_registered_candidate_isolation_and_no_public_staff_registration(harness):
    h=harness
    assert register(h).status_code==202
    user=h.db.scalar(select(User).where(User.email=="new-candidate@example.com"))
    h.db.add(Application(candidate_user_id=user.id,vacancy_id=h.vacancies[0].id))
    h.db.commit()
    own=h.db.scalar(select(Application).where(Application.candidate_user_id==user.id))
    assert h.client.post("/auth/login",headers={"Origin":ORIGIN},json={"email":user.email,"password":PASSWORD}).status_code==200
    for capability in ["resume-submission","disc-result-upload","clarification-response"]:
        assert h.client.get(f"/applications/{own.id}/access/{capability}").status_code==200
        assert h.client.get(f"/applications/{h.applications['bob'].id}/access/{capability}").status_code==404
    assert h.client.post("/admin/users",headers={"Origin":ORIGIN},json={"email":"staff@example.com","password":PASSWORD,"role":"hr"}).status_code==403
    for endpoint in ["/auth/register/staff","/auth/staff/register","/staff/register"]:
        assert h.client.post(endpoint,json={"email":"staff@example.com","password":PASSWORD,"role":"hr"}).status_code==404


def test_registration_does_not_replace_an_existing_staff_session(harness):
    h=harness
    h.login()
    before=h.client.get("/auth/me").json()
    assert register(h).status_code==202
    assert h.client.get("/auth/me").json()==before
