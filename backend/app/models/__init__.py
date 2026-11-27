"""Register all models and their ORM soft-delete policy."""
from app.models.identity import (
    Administrator, AdminSetup, Application, AuthSession, LoginRateLimit, Role, User, UserRole, Vacancy, VacancyAssignment,
)
from app.db import soft_delete as _soft_delete  # noqa: F401 -- register Session listeners

__all__ = ["Administrator", "AdminSetup", "Application", "AuthSession", "LoginRateLimit", "Role", "User", "UserRole", "Vacancy", "VacancyAssignment"]
