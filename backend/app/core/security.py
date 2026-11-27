"""Opaque cookie authentication. Identity comes only from a verified DB session."""
from dataclasses import dataclass, field
from datetime import UTC, datetime
import hashlib
import hmac
import secrets

from email_validator import validate_email
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.passwords import SHA256PasswordHasher
from app.db.session import get_db_session
from app.models import Administrator, AuthSession, LoginRateLimit, Role, User, UserRole

COOKIE_NAME = "wehire_session"
password_hasher = SHA256PasswordHasher()
# Equal-cost verification for unknown accounts; never a usable account credential.
DUMMY_HASH = password_hasher.hash(secrets.token_urlsafe(32))


def now() -> datetime:
    return datetime.now(UTC)


def aware(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


def normalize_email(value: str) -> str:
    return validate_email(value.strip(), check_deliverability=False).normalized.casefold()


def hash_token(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def csrf_token(session_token: str) -> str:
    return hmac.new(session_token.encode(), b"wehire-csrf-v1", hashlib.sha256).hexdigest()


def verify_password(encoded: str, password: str) -> bool:
    return password_hasher.verify(encoded, password)


def role_names(db: Session, user_id: int) -> frozenset[str]:
    return frozenset(db.scalars(select(Role.name).join(UserRole, UserRole.role_id == Role.id).where(UserRole.user_id == user_id)))


def is_administrator(db: Session, user_id: int) -> bool:
    return db.scalar(select(Administrator.id).where(Administrator.user_id == user_id)) is not None


@dataclass
class AuthContext:
    user: User
    session: AuthSession
    roles: frozenset[str]
    token: str = field(repr=False)
    is_admin: bool = False


def get_current_auth(request: Request, db: Session = Depends(get_db_session)) -> AuthContext:
    token = request.cookies.get(COOKIE_NAME, "")
    if len(token) != 43:
        raise HTTPException(401, "Authentication required")
    record = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
    if record is None or record.deleted_at is not None or record.revoked_at is not None or aware(record.expires_at) <= now():
        raise HTTPException(401, "Authentication required")
    user = db.get(User, record.user_id)
    if user is None or user.deleted_at is not None or not user.is_active:
        raise HTTPException(401, "Authentication required")
    return AuthContext(user, record, role_names(db, user.id), token, is_administrator(db, user.id))


def require_trusted_origin(request: Request) -> None:
    # Exact browser Origin validation also protects login against login-CSRF.
    # Never derive trusted origins from client-controlled Host/Forwarded headers.
    if request.headers.get("origin") not in get_settings().cors_origins:
        raise HTTPException(403, "Untrusted request origin")


def require_csrf(request: Request, auth: AuthContext = Depends(get_current_auth)) -> AuthContext:
    require_trusted_origin(request)
    submitted = request.headers.get("x-csrf-token", "")
    if len(submitted) != 64 or not submitted.isascii() or not hmac.compare_digest(submitted, csrf_token(auth.token)):
        raise HTTPException(403, "Invalid CSRF token")
    return auth


def _consume_rate_limits(db: Session, buckets: list[tuple[str, int]], seconds: int, message: str) -> None:
    """Atomic fixed-window counters shared by all backend processes."""
    current = now()
    window = int(current.timestamp()) // seconds
    from datetime import timedelta
    expires = datetime.fromtimestamp((window + 1) * seconds, UTC)
    keys = sorted((hash_token(f"{key}:{window}"), limit) for key, limit in buckets)
    if db.get_bind().dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:  # SQLite is used only by focused unit tests.
        from sqlalchemy.dialects.sqlite import insert
    db.execute(update(LoginRateLimit).where(LoginRateLimit.expires_at < current - timedelta(days=1)).values(deleted_at=current))
    limited = False
    for key, limit in keys:
        stmt = insert(LoginRateLimit).values(bucket_hash=key, attempts=1, expires_at=expires)
        stmt = stmt.on_conflict_do_update(
            index_elements=[LoginRateLimit.bucket_hash],
            set_={"attempts": LoginRateLimit.attempts + 1, "updated_at": current},
        ).returning(LoginRateLimit.attempts)
        limited = db.scalar(stmt) > limit or limited
    # Persist successful, failed and throttled attempts across workers.
    db.commit()
    if limited:
        retry = max(1, int((expires - current).total_seconds()))
        raise HTTPException(429, message, headers={"Retry-After": str(retry)})


def consume_login_limits(db: Session, email: str, ip: str) -> None:
    settings = get_settings()
    _consume_rate_limits(db, [
        (f"account:{email}", settings.auth_login_account_limit),
        (f"ip:{ip}", settings.auth_login_ip_limit),
    ], settings.auth_login_window_seconds, "Too many sign-in attempts. Try again later.")


def limit_registration_ip(request: Request, db: Session = Depends(get_db_session)) -> None:
    # A dependency also counts valid-JSON requests whose fields fail validation.
    settings = get_settings()
    ip = request.client.host if request.client else "unknown"
    _consume_rate_limits(db, [(f"register:ip:{ip}", settings.auth_register_ip_limit)],
                        settings.auth_register_window_seconds, "Too many registration attempts. Try again later.")


def limit_registration_email(db: Session, email: str) -> None:
    settings = get_settings()
    _consume_rate_limits(db, [(f"register:email:{email}", settings.auth_register_email_limit)],
                        settings.auth_register_window_seconds, "Too many registration attempts. Try again later.")
