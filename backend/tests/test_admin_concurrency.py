from concurrent.futures import ThreadPoolExecutor
import secrets

from fastapi.testclient import TestClient
from pydantic import SecretStr
import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.schema import CreateSchema

from app.api.routes import auth as auth_routes, setup as setup_routes
from app.core import security
from app.core.config import Settings
from app.db.base import Base
from app.db.session import get_db_session
from app.main import app
from app.models import Administrator, AdminSetup, Role, User, UserRole

PASSWORD = "synthetic-concurrency-password-only"
TOKEN = "synthetic-concurrency-bootstrap-key-only"
ORIGIN = "http://localhost:3012"


@pytest.fixture
def isolated_admin_engine(postgres_engine, monkeypatch):
    # New schema inside the dedicated test DB; never reset an existing schema.
    schema = "admin_concurrency_" + secrets.token_hex(6)
    with postgres_engine.begin() as connection:
        connection.execute(CreateSchema(schema))
    engine = postgres_engine.execution_options(schema_translate_map={None: schema})
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add_all([Role(name=name) for name in ["hr", "hiring_manager", "candidate"]])
        db.add(AdminSetup(id=1))
        db.commit()
    settings = Settings(_env_file=None, auth_cookie_secure=False, bootstrap_token=SecretStr(TOKEN))
    for module in [security, auth_routes, setup_routes]:
        monkeypatch.setattr(module, "get_settings", lambda: settings)
    def session():
        with Session(engine, expire_on_commit=False) as db:
            yield db
    app.dependency_overrides[get_db_session] = session
    try:
        yield engine
    finally:
        app.dependency_overrides.pop(get_db_session, None)
        # All owned test data/schema remain in the disposable test DB for inspection.


def test_concurrent_bootstrap_creates_exactly_one_administrator(isolated_admin_engine):
    def create(index):
        with TestClient(app) as client:
            return client.post("/setup/admin", headers={"Origin":ORIGIN}, json={
                "token":TOKEN, "email":f"first{index}@example.com", "password":PASSWORD,
            }).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(create, range(2)))
    assert sorted(results) == [201,409]
    with Session(isolated_admin_engine) as db:
        assert db.scalar(select(func.count()).select_from(Administrator)) == 1


def test_concurrent_disabling_cannot_remove_all_administrators(isolated_admin_engine):
    with Session(isolated_admin_engine) as db:
        role_id = db.scalar(select(Role.id).where(Role.name=="hr"))
        users = [User(email=f"admin{index}@example.com",password_hash=security.password_hasher.hash(PASSWORD)) for index in range(2)]
        db.add_all(users)
        db.flush()
        identifiers = [user.id for user in users]
        for user in users:
            db.add(UserRole(user_id=user.id,role_id=role_id))
            db.add(Administrator(user_id=user.id))
        db.get(AdminSetup,1).completed_at = security.now()
        db.commit()
    clients = [TestClient(app),TestClient(app)]
    headers = []
    try:
        for index, client in enumerate(clients):
            assert client.post("/auth/login",headers={"Origin":ORIGIN},json={"email":f"admin{index}@example.com","password":PASSWORD}).status_code==200
            headers.append({"Origin":ORIGIN,"X-CSRF-Token":client.get("/auth/csrf").json()["csrf_token"]})
        def disable_other(index):
            return clients[index].patch(f"/admin/users/{identifiers[1-index]}/status",headers=headers[index],json={"enabled":False}).status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(disable_other,range(2)))
        assert results.count(200)==1
        assert all(status in {200,401,409} for status in results)
        with Session(isolated_admin_engine) as db:
            assert db.scalar(select(func.count()).select_from(Administrator).join(User).where(User.is_active.is_(True)))==1
    finally:
        for client in clients:
            client.close()
