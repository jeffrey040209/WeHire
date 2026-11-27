"""Role AND record-scope checks; no implicit HR/admin bypass."""
from typing import Annotated

from fastapi import Depends, HTTPException, Path
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import AuthContext, get_current_auth, require_csrf
from app.db.session import get_db_session
from app.models import Application, Vacancy, VacancyAssignment

STAFF_ROLES = frozenset({"hr", "hiring_manager"})


def require_staff(auth: AuthContext = Depends(get_current_auth)) -> AuthContext:
    if not auth.roles.intersection(STAFF_ROLES):
        raise HTTPException(403, "Staff access required")
    return auth


def require_candidate(auth: AuthContext = Depends(get_current_auth)) -> AuthContext:
    if auth.roles != frozenset({"candidate"}):
        raise HTTPException(403, "Candidate access required")
    return auth


def owned_application(application_id: Annotated[int, Path(gt=0)], auth: AuthContext = Depends(require_candidate),
                      db: Session = Depends(get_db_session)) -> Application:
    application = db.scalar(select(Application).join(Vacancy).where(
        Application.id == application_id, Application.candidate_user_id == auth.user.id,
    ))
    if application is None:
        raise HTTPException(404, "Application not found")
    return application


def require_admin(auth: AuthContext = Depends(get_current_auth)) -> AuthContext:
    if not auth.is_admin or not auth.roles.intersection(STAFF_ROLES):
        raise HTTPException(403, "Administrator access required")
    return auth


def require_admin_mutation(auth: AuthContext = Depends(require_csrf)) -> AuthContext:
    return require_admin(auth)


def staff_application(application_id: Annotated[int, Path(gt=0)], auth: AuthContext = Depends(require_staff),
                      db: Session = Depends(get_db_session)) -> Application:
    application = db.scalar(select(Application).join(Vacancy).join(
        VacancyAssignment, VacancyAssignment.vacancy_id == Application.vacancy_id,
    ).where(Application.id == application_id, VacancyAssignment.user_id == auth.user.id))
    if application is None:
        raise HTTPException(404, "Application not found")
    return application
