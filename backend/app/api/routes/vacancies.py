"""HTTP transport for scoped, internal manual vacancy configuration."""
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session

from app.api.errors import vacancy_call as call
from app.core.permissions import require_staff
from app.core.security import AuthContext, require_csrf
from app.crud import vacancies as store
from app.db.session import get_db_session
from app.schemas.vacancy import CloneInput, RoleBriefInput, RevisionInput, UpdateRoleBriefInput
from app.services import vacancies as service

router = APIRouter(prefix="/staff/vacancies", tags=["vacancies"], dependencies=[Depends(require_staff)])
RecordId = Annotated[int, Path(gt=0)]


def mutation(auth: AuthContext = Depends(require_csrf)):
    return require_staff(auth)


def locked(vacancy_id, db, auth):
    return call(service.scoped, db, vacancy_id, auth.user.id, lock=True)


@router.get("")
def list_vacancies(q: str = Query(default="", max_length=200), status: Literal["draft", "approved", "archived"] | None = None,
                   limit: int = Query(default=25, ge=1, le=100), offset: int = Query(default=0, ge=0),
                   auth: AuthContext = Depends(require_staff), db: Session = Depends(get_db_session)):
    rows, total = store.list_assigned(db, auth.user.id, q, status, limit, offset)
    return {"items": [service.vacancy_view(db, r, full=False) for r in rows], "total": total}


@router.post("", status_code=201)
def create_vacancy(payload: RoleBriefInput, auth: AuthContext = Depends(mutation), db: Session = Depends(get_db_session)):
    return call(service.create, db, payload, auth.user.id)


@router.get("/{vacancy_id}")
def get_vacancy(vacancy_id: RecordId, auth: AuthContext = Depends(require_staff), db: Session = Depends(get_db_session)):
    return service.vacancy_view(db, call(service.scoped, db, vacancy_id, auth.user.id))


@router.post("/{vacancy_id}/drafts", status_code=201)
def create_draft(vacancy_id: RecordId, payload: CloneInput, auth: AuthContext = Depends(mutation), db: Session = Depends(get_db_session)):
    return call(service.clone, db, locked(vacancy_id, db, auth), auth.user.id, payload.source_version_id)


@router.put("/{vacancy_id}/versions/{version_id}")
def update_draft(vacancy_id: RecordId, version_id: RecordId, payload: UpdateRoleBriefInput,
                 auth: AuthContext = Depends(mutation), db: Session = Depends(get_db_session)):
    vacancy = locked(vacancy_id, db, auth)
    return call(service.save_brief, db, vacancy, call(service.get_version, db, vacancy, version_id), payload)


@router.post("/{vacancy_id}/versions/{version_id}/approve")
def approve(vacancy_id: RecordId, version_id: RecordId, payload: RevisionInput,
            auth: AuthContext = Depends(mutation), db: Session = Depends(get_db_session)):
    if "hr" not in auth.roles:
        raise HTTPException(403, "Assigned HR approval required")
    vacancy = locked(vacancy_id, db, auth)
    return call(service.approve, db, vacancy, call(service.get_version, db, vacancy, version_id), payload.revision, auth.user.id)


@router.delete("/{vacancy_id}/versions/{version_id}")
def discard(vacancy_id: RecordId, version_id: RecordId, payload: RevisionInput,
            auth: AuthContext = Depends(mutation), db: Session = Depends(get_db_session)):
    vacancy = locked(vacancy_id, db, auth)
    return call(service.discard, db, vacancy, call(service.get_version, db, vacancy, version_id), payload.revision)


@router.post("/{vacancy_id}/archive")
def archive(vacancy_id: RecordId, auth: AuthContext = Depends(mutation), db: Session = Depends(get_db_session)):
    return call(service.archive, db, locked(vacancy_id, db, auth))
