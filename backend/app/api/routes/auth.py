from datetime import timedelta
import secrets

from email_validator import EmailNotValidError
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, SecretStr
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app.core.security import (
    COOKIE_NAME, DUMMY_HASH, AuthContext, consume_login_limits, csrf_token, get_current_auth,
    hash_token, normalize_email, now, password_hasher, require_csrf, require_trusted_origin,
    is_administrator, role_names, verify_password, limit_registration_email, limit_registration_ip,
)
from app.db.session import get_db_session
from app.models import AuthSession, Role, User, UserRole

router = APIRouter(prefix="/auth", tags=["authentication"])


class LoginInput(BaseModel):
    email: str
    password: SecretStr


def identity(auth: AuthContext) -> dict:
    return {"id": auth.user.id, "email": auth.user.email, "roles": sorted(auth.roles), "is_admin": auth.is_admin}


@router.post("/login", dependencies=[Depends(require_trusted_origin)])
def login(payload: LoginInput, request: Request, response: Response,
          db: Session = Depends(get_db_session)) -> dict:
    try:
        email = normalize_email(payload.email) if len(payload.email) <= 254 else "invalid"
    except EmailNotValidError:
        email = "invalid"
    consume_login_limits(db, email, request.client.host if request.client else "unknown")
    password = payload.password.get_secret_value()
    user = db.scalar(select(User).where(User.email == email))
    valid = verify_password(user.password_hash if user else DUMMY_HASH, password if len(password) <= 1024 else "")
    if not valid or user is None or not user.is_active or len(password) > 1024:
        raise HTTPException(401, "Invalid email or password")
    if password_hasher.check_needs_rehash(user.password_hash):
        user.password_hash = password_hasher.hash(password)
    # Signing in rotates/revokes any previous session presented by this browser.
    old_token = request.cookies.get(COOKIE_NAME, "")
    if old_token:
        old = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(old_token)))
        if old:
            old.revoked_at = now()
    token = secrets.token_urlsafe(32)
    current = now()
    settings = get_settings()
    record = AuthSession(user_id=user.id, token_hash=hash_token(token), created_at=current,
                         expires_at=current + timedelta(seconds=settings.auth_session_seconds))
    db.add(record)
    db.commit()
    response.set_cookie(COOKIE_NAME, token, max_age=settings.auth_session_seconds,
                        httponly=True, secure=settings.auth_cookie_secure, samesite="lax", path="/")
    return identity(AuthContext(user, record, role_names(db, user.id), token, is_administrator(db, user.id)))


@router.get("/me")
def me(auth: AuthContext = Depends(get_current_auth)) -> dict:
    return identity(auth)


@router.get("/csrf")
def csrf(auth: AuthContext = Depends(get_current_auth)) -> dict:
    return {"csrf_token": csrf_token(auth.token)}


@router.post("/logout", status_code=204)
def logout(response: Response, auth: AuthContext = Depends(require_csrf),
           db: Session = Depends(get_db_session)) -> None:
    auth.session.revoked_at = now()
    db.commit()
    response.delete_cookie(COOKIE_NAME, path="/", secure=get_settings().auth_cookie_secure,
                           httponly=True, samesite="lax")


class CandidateRegistrationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=254)
    password: SecretStr = Field(min_length=6, max_length=128)


REGISTRATION_MESSAGE = "Registration request received. Try signing in with your details, or contact your WeHire administrator if you need help."


@router.post("/register", status_code=202, dependencies=[Depends(require_trusted_origin), Depends(limit_registration_ip)])
def register_candidate(payload: CandidateRegistrationInput, db: Session = Depends(get_db_session)) -> dict:
    try:
        email = normalize_email(payload.email)
    except EmailNotValidError:
        raise HTTPException(422, "Enter a valid email address") from None
    limit_registration_email(db, email)
    # Fixed server-selected role; never accept identity/permission/application fields.
    role_id = db.scalar(select(Role.id).where(Role.name == "candidate"))
    if role_id is None:
        raise HTTPException(503, "Registration is temporarily unavailable")
    encoded = password_hasher.hash(payload.password.get_secret_value())
    existing = db.scalar(select(User.id).where(User.email == email).execution_options(include_deleted=True))
    if existing is None:
        user = User(email=email, password_hash=encoded)
        db.add(user)
        try:
            db.flush()
            db.add(UserRole(user_id=user.id, role_id=role_id))
            db.commit()
        except IntegrityError:
            db.rollback()
            # Concurrent registrations of the same email have the same public result.
            if db.scalar(select(User.id).where(User.email == email).execution_options(include_deleted=True)) is None:
                raise HTTPException(503, "Registration is temporarily unavailable") from None
    # Same response for new/existing/disabled/archived accounts. Do not reset,
    # restore or sign in an existing user, or claim applications based on email.
    return {"message": REGISTRATION_MESSAGE}
