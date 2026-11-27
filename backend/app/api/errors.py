"""HTTP-only mapping shared by vacancy and legacy administration routes."""
from fastapi import HTTPException

from app.services.vacancies import VacancyError


def vacancy_call(operation, *args, **kwargs):
    try:
        return operation(*args, **kwargs)
    except VacancyError as error:
        raise HTTPException(error.status, error.detail) from None
