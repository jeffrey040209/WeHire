from concurrent.futures import ThreadPoolExecutor
import secrets

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import Settings


def test_concurrent_login_limits_are_shared_and_atomic(postgres_engine, monkeypatch):
    settings = Settings(_env_file=None, auth_login_account_limit=2, auth_login_ip_limit=30)
    monkeypatch.setattr(security, "get_settings", lambda: settings)
    fixed = security.now()
    monkeypatch.setattr(security, "now", lambda: fixed)
    key = secrets.token_hex(16)
    def attempt(index):
        with Session(postgres_engine) as db:
            try:
                security.consume_login_limits(db, key + "@example.com", key)
                return 200
            except HTTPException as error:
                return error.status_code
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(attempt, range(8)))
    assert results.count(200) == 2
    assert results.count(429) == 6
