from enum import StrEnum

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import owned_application, require_staff, staff_application
from app.core.security import AuthContext
from app.db.session import get_db_session
from app.models import Application, Vacancy, VacancyAssignment

router = APIRouter(tags=["access foundation"])


class CandidateCapability(StrEnum):
    resume_submission = "resume-submission"
    disc_result_upload = "disc-result-upload"
    clarification_response = "clarification-response"


@router.get("/staff/access")
def staff_access(auth: AuthContext = Depends(require_staff), db: Session = Depends(get_db_session)) -> dict:
    vacancies = db.scalars(select(Vacancy).join(VacancyAssignment).where(
        VacancyAssignment.user_id == auth.user.id,
    ).order_by(Vacancy.title))
    return {"vacancies": [{"id": v.id, "title": v.title} for v in vacancies]}


@router.get("/staff/applications/{application_id}/access")
def staff_application_access(application: Application = Depends(staff_application)) -> dict:
    return {"application_id": application.id, "vacancy_id": application.vacancy_id, "allowed": True}


@router.get("/applications/{application_id}/access/{capability}")
def candidate_access(capability: CandidateCapability, application: Application = Depends(owned_application)) -> dict:
    # This proves permission only. No uploads, responses, scores or DISC processing yet.
    return {"application_id": application.id, "capability": capability.value, "allowed": True}
