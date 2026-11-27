"""Explicit administrator-only metadata and account management."""
from typing import Annotated, Literal

from email_validator import EmailNotValidError
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.datetime_display import display_datetime
from app.core.permissions import require_admin, require_admin_mutation
from app.core.security import AuthContext, normalize_email, now, password_hasher, role_names
from app.db.session import get_db_session
from app.db.soft_delete import soft_delete
from app.models import Administrator, AdminSetup, Application, AuthSession, Role, User, UserRole, Vacancy, VacancyAssignment
from app.services.identity import add_role

router = APIRouter(prefix="/admin", tags=["administration"], dependencies=[Depends(require_admin)])
RecordId = Annotated[int, Path(gt=0)]
RoleName = Literal["hr", "hiring_manager", "candidate"]


class UserInput(BaseModel):
    email: str = Field(max_length=254)
    password: SecretStr = Field(min_length=6, max_length=128)
    role: RoleName
    is_admin: bool = False


class EnabledInput(BaseModel):
    enabled: bool


class RoleInput(BaseModel):
    role: RoleName


class PasswordInput(BaseModel):
    password: SecretStr = Field(min_length=6, max_length=128)


class VacancyInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class AssignmentInput(BaseModel):
    user_id: int = Field(gt=0)
    vacancy_id: int = Field(gt=0)


class ApplicationInput(BaseModel):
    candidate_user_id: int = Field(gt=0)
    vacancy_id: int = Field(gt=0)


def commit(db):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Record already exists or conflicts with related data") from None


def get_record(db, model, identifier, archived=False):
    record = db.scalar(select(model).where(model.id == identifier).execution_options(include_deleted=archived))
    if record is None:
        raise HTTPException(404, "Record not found")
    return record


def dates(record):
    return {key: display_datetime(getattr(record, key)) for key in ["created_at", "updated_at", "deleted_at"]}


def user_view(db, user):
    admin = db.scalar(select(Administrator.id).where(Administrator.user_id == user.id)) is not None
    return {"id": user.id, "email": user.email, "is_active": user.is_active,
            "roles": sorted(role_names(db, user.id)), "is_admin": admin, **dates(user)}


def page(db, statement, model, include_archived, limit, offset):
    if not include_archived:
        statement = statement.where(model.deleted_at.is_(None))
    count = db.scalar(select(func.count()).select_from(statement.subquery()).execution_options(include_deleted=include_archived))
    rows = list(db.scalars(statement.order_by(model.id).limit(limit).offset(offset).execution_options(include_deleted=include_archived)))
    return rows, count


def envelope(items, total):
    return {"items": items, "total": total, "timezone": "Asia/Kuala_Lumpur"}


def lock_admin_state(db):
    state = db.scalar(select(AdminSetup).where(AdminSetup.id == 1).execution_options(include_deleted=True).with_for_update())
    if state is None:
        raise HTTPException(503, "Apply database migrations first")
    return state


def admin_link(db, user_id):
    return db.scalar(select(Administrator).where(Administrator.user_id == user_id))


def protect_last_admin(db, user):
    lock_admin_state(db)
    if user.is_active and admin_link(db, user.id) is not None:
        count = db.scalar(select(func.count()).select_from(Administrator).join(User).where(User.is_active.is_(True)))
        if count <= 1:
            raise HTTPException(409, "Keep at least one active administrator")


@router.get("/summary")
def summary(db: Session = Depends(get_db_session)) -> dict:
    return {name: db.scalar(select(func.count()).select_from(model)) for name, model in [
        ("users", User), ("vacancies", Vacancy), ("applications", Application), ("assignments", VacancyAssignment),
    ]}


@router.get("/users")
def users(q: str = Query(default="", max_length=254), kind: Literal["all", "staff", "candidate"] = "all",
          include_archived: bool = False, limit: int = Query(default=25, ge=1, le=100),
          offset: int = Query(default=0, ge=0), db: Session = Depends(get_db_session)) -> dict:
    statement = select(User)
    if q:
        statement = statement.where(User.email.icontains(q, autoescape=True))
    if kind != "all":
        names = ["candidate"] if kind == "candidate" else ["hr", "hiring_manager"]
        statement = statement.where(User.id.in_(select(UserRole.user_id).join(Role).where(Role.name.in_(names))))
    records, total = page(db, statement, User, include_archived, limit, offset)
    return envelope([user_view(db, record) for record in records], total)


@router.post("/users", status_code=201)
def create_user(payload: UserInput, auth: AuthContext = Depends(require_admin_mutation), db: Session = Depends(get_db_session)) -> dict:
    if payload.is_admin and payload.role == "candidate":
        raise HTTPException(409, "Candidate accounts cannot be administrators")
    try:
        email = normalize_email(payload.email)
    except EmailNotValidError:
        raise HTTPException(422, "Enter a valid email address") from None
    if db.scalar(select(User.id).where(User.email == email).execution_options(include_deleted=True)) is not None:
        raise HTTPException(409, "Email is already reserved by an existing or archived account")
    user = User(email=email, password_hash=password_hasher.hash(payload.password.get_secret_value()))
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Email is already reserved by another account") from None
    add_role(db, user, payload.role)
    if payload.is_admin:
        lock_admin_state(db)
        db.add(Administrator(user_id=user.id))
    commit(db)
    return user_view(db, user)


@router.put("/users/{user_id}/administrator")
def set_administrator(user_id: RecordId, payload: EnabledInput, auth: AuthContext = Depends(require_admin_mutation), db: Session = Depends(get_db_session)) -> dict:
    lock_admin_state(db)
    user = get_record(db, User, user_id)
    if payload.enabled:
        if not user.is_active or not role_names(db, user.id).intersection({"hr", "hiring_manager"}):
            raise HTTPException(409, "Administrator access requires an active staff account")
        link = db.scalar(select(Administrator).where(Administrator.user_id == user.id).execution_options(include_deleted=True))
        if link:
            link.deleted_at = None
        else:
            db.add(Administrator(user_id=user.id))
    else:
        protect_last_admin(db, user)
        link = admin_link(db, user.id)
        if link:
            soft_delete(db, link)
    commit(db)
    return user_view(db, user)


@router.patch("/users/{user_id}/status")
def user_status(user_id: RecordId, payload: EnabledInput, auth: AuthContext = Depends(require_admin_mutation), db: Session = Depends(get_db_session)) -> dict:
    user = get_record(db, User, user_id)
    if not payload.enabled:
        protect_last_admin(db, user)
        db.execute(update(AuthSession).where(AuthSession.user_id == user.id).values(revoked_at=now()))
    user.is_active = payload.enabled
    commit(db)
    return user_view(db, user)


@router.put("/users/{user_id}/password", status_code=204)
def set_password(user_id: RecordId, payload: PasswordInput, auth: AuthContext = Depends(require_admin_mutation), db: Session = Depends(get_db_session)) -> None:
    user = get_record(db, User, user_id)
    user.password_hash = password_hasher.hash(payload.password.get_secret_value())
    db.execute(update(AuthSession).where(AuthSession.user_id == user.id).values(revoked_at=now()))
    commit(db)


@router.post("/users/{user_id}/roles")
def grant_role(user_id: RecordId, payload: RoleInput, auth: AuthContext = Depends(require_admin_mutation), db: Session = Depends(get_db_session)) -> dict:
    lock_admin_state(db)
    user = get_record(db, User, user_id)
    try:
        add_role(db, user, payload.role)
    except ValueError as error:
        raise HTTPException(409, str(error)) from None
    commit(db)
    return user_view(db, user)


@router.delete("/users/{user_id}/roles/{role}")
def revoke_role(user_id: RecordId, role: RoleName, auth: AuthContext = Depends(require_admin_mutation), db: Session = Depends(get_db_session)) -> dict:
    lock_admin_state(db)
    user = get_record(db, User, user_id)
    if admin_link(db, user.id) is not None and not (role_names(db, user.id) - {role}).intersection({"hr", "hiring_manager"}):
        raise HTTPException(409, "Remove administrator access before revoking the last staff role")
    link = db.scalar(select(UserRole).join(Role).where(UserRole.user_id == user_id, Role.name == role))
    if link is None:
        raise HTTPException(404, "Role assignment not found")
    soft_delete(db, link)
    commit(db)
    return user_view(db, user)


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: RecordId, auth: AuthContext = Depends(require_admin_mutation), db: Session = Depends(get_db_session)) -> None:
    user = get_record(db, User, user_id)
    protect_last_admin(db, user)
    soft_delete(db, user)
    commit(db)


@router.get("/vacancies")
def vacancies(q: str = Query(default="", max_length=200), include_archived: bool = False,
              limit: int = Query(default=25, ge=1, le=100), offset: int = Query(default=0, ge=0),
              db: Session = Depends(get_db_session)) -> dict:
    statement = select(Vacancy)
    if q:
        statement = statement.where(Vacancy.title.icontains(q, autoescape=True))
    records, total = page(db, statement, Vacancy, include_archived, limit, offset)
    return envelope([{"id": record.id, "title": record.title, **dates(record)} for record in records], total)


@router.post("/vacancies", status_code=201)
def create_vacancy(payload: VacancyInput, auth: AuthContext = Depends(require_admin_mutation), db: Session = Depends(get_db_session)) -> dict:
    title = payload.title.strip()
    if not title:
        raise HTTPException(422, "Enter a vacancy title")
    record = Vacancy(title=title)
    db.add(record)
    commit(db)
    return {"id": record.id, "title": record.title, **dates(record)}


@router.patch("/vacancies/{vacancy_id}")
def update_vacancy(vacancy_id: RecordId, payload: VacancyInput, auth: AuthContext = Depends(require_admin_mutation), db: Session = Depends(get_db_session)) -> dict:
    record = get_record(db, Vacancy, vacancy_id)
    if not payload.title.strip():
        raise HTTPException(422, "Enter a vacancy title")
    record.title = payload.title.strip()
    commit(db)
    return {"id": record.id, "title": record.title, **dates(record)}


@router.delete("/vacancies/{vacancy_id}", status_code=204)
def delete_vacancy(vacancy_id: RecordId, auth: AuthContext = Depends(require_admin_mutation), db: Session = Depends(get_db_session)) -> None:
    soft_delete(db, get_record(db, Vacancy, vacancy_id))
    commit(db)


@router.get("/assignments")
def assignments(include_archived: bool = False, limit: int = Query(default=25, ge=1, le=100),
                offset: int = Query(default=0, ge=0), db: Session = Depends(get_db_session)) -> dict:
    records, total = page(db, select(VacancyAssignment), VacancyAssignment, include_archived, limit, offset)
    items = []
    for record in records:
        user = get_record(db, User, record.user_id, archived=True)
        vacancy = get_record(db, Vacancy, record.vacancy_id, archived=True)
        items.append({"id": record.id, "user_id": user.id, "email": user.email, "vacancy_id": vacancy.id, "vacancy_title": vacancy.title, **dates(record)})
    return envelope(items, total)


@router.post("/assignments", status_code=201)
def assign_vacancy(payload: AssignmentInput, auth: AuthContext = Depends(require_admin_mutation), db: Session = Depends(get_db_session)) -> dict:
    user = get_record(db, User, payload.user_id)
    get_record(db, Vacancy, payload.vacancy_id)
    if not user.is_active or not role_names(db, user.id).intersection({"hr", "hiring_manager"}):
        raise HTTPException(409, "Choose an active staff account")
    record = db.scalar(select(VacancyAssignment).where(VacancyAssignment.user_id == user.id,
        VacancyAssignment.vacancy_id == payload.vacancy_id).execution_options(include_deleted=True))
    if record:
        record.deleted_at = None
    else:
        record = VacancyAssignment(user_id=user.id, vacancy_id=payload.vacancy_id)
        db.add(record)
    commit(db)
    return {"id": record.id, "user_id": record.user_id, "vacancy_id": record.vacancy_id}


@router.delete("/assignments/{assignment_id}", status_code=204)
def unassign_vacancy(assignment_id: RecordId, auth: AuthContext = Depends(require_admin_mutation), db: Session = Depends(get_db_session)) -> None:
    soft_delete(db, get_record(db, VacancyAssignment, assignment_id))
    commit(db)


@router.get("/applications")
def applications(include_archived: bool = False, limit: int = Query(default=25, ge=1, le=100),
                 offset: int = Query(default=0, ge=0), db: Session = Depends(get_db_session)) -> dict:
    records, total = page(db, select(Application), Application, include_archived, limit, offset)
    items = []
    for record in records:
        user = get_record(db, User, record.candidate_user_id, archived=True)
        vacancy = get_record(db, Vacancy, record.vacancy_id, archived=True)
        items.append({"id": record.id, "candidate_user_id": user.id, "email": user.email, "vacancy_id": vacancy.id, "vacancy_title": vacancy.title, **dates(record)})
    return envelope(items, total)


@router.post("/applications", status_code=201)
def create_application(payload: ApplicationInput, auth: AuthContext = Depends(require_admin_mutation), db: Session = Depends(get_db_session)) -> dict:
    user = get_record(db, User, payload.candidate_user_id)
    get_record(db, Vacancy, payload.vacancy_id)
    if not user.is_active or role_names(db, user.id) != frozenset({"candidate"}):
        raise HTTPException(409, "Choose an active candidate account")
    record = Application(candidate_user_id=user.id, vacancy_id=payload.vacancy_id)
    db.add(record)
    commit(db)
    return {"id": record.id, "candidate_user_id": record.candidate_user_id, "vacancy_id": record.vacancy_id}


@router.delete("/applications/{application_id}", status_code=204)
def delete_application(application_id: RecordId, auth: AuthContext = Depends(require_admin_mutation), db: Session = Depends(get_db_session)) -> None:
    soft_delete(db, get_record(db, Application, application_id))
    commit(db)
