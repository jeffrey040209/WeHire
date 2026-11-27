"""Token-authorised, one-time administrator setup; not public registration."""
import hmac

from email_validator import EmailNotValidError
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import consume_login_limits, normalize_email, now, password_hasher, require_trusted_origin
from app.db.session import get_db_session
from app.models import Administrator, AdminSetup, User
from app.services.identity import add_role

router = APIRouter(prefix="/setup", tags=["initial setup"])


class SetupInput(BaseModel):
    token: SecretStr
    email: str = Field(max_length=254)
    password: SecretStr = Field(min_length=6, max_length=128)


def configured_token() -> str:
    value = get_settings().bootstrap_token
    return value.get_secret_value() if value is not None else ""


def has_admin_history(db: Session) -> bool:
    return db.scalar(select(Administrator.id).execution_options(include_deleted=True).limit(1)) is not None


@router.get("/status")
def status(db: Session = Depends(get_db_session)) -> dict:
    state = db.scalar(select(AdminSetup).where(AdminSetup.id == 1).execution_options(include_deleted=True))
    completed = state is not None and (state.completed_at is not None or state.deleted_at is not None)
    completed = completed or has_admin_history(db)
    return {"enabled": bool(state is not None and len(configured_token()) >= 32 and not completed), "completed": completed}


@router.post("/admin", status_code=201, dependencies=[Depends(require_trusted_origin)])
def create_first_admin(payload: SetupInput, request: Request, db: Session = Depends(get_db_session)) -> dict:
    consume_login_limits(db, "initial-administrator-setup", request.client.host if request.client else "unknown")
    expected = configured_token()
    if len(expected) < 32 or not hmac.compare_digest(expected.encode(), payload.token.get_secret_value().encode()):
        raise HTTPException(403, "Initial setup is unavailable or the setup key is invalid")
    # Lock a seeded singleton, not an absent user row, to serialize concurrent setup.
    state = db.scalar(select(AdminSetup).where(AdminSetup.id == 1).execution_options(include_deleted=True).with_for_update())
    if state is None:
        raise HTTPException(503, "Apply database migrations before initial setup")
    if state.completed_at is not None or state.deleted_at is not None or has_admin_history(db):
        raise HTTPException(409, "Initial setup has already been completed")
    try:
        email = normalize_email(payload.email)
    except EmailNotValidError:
        raise HTTPException(422, "Enter a valid email address") from None
    if db.scalar(select(User.id).where(User.email == email).execution_options(include_deleted=True)) is not None:
        raise HTTPException(409, "Account already exists; use a new administrator account email")
    user = User(email=email, password_hash=password_hasher.hash(payload.password.get_secret_value()))
    db.add(user)
    db.flush()
    add_role(db, user, "hr")
    db.add(Administrator(user_id=user.id))
    state.completed_at = now()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Setup could not be completed; refresh and try again") from None
    return {"id": user.id, "email": user.email}
