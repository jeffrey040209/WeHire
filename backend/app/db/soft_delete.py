"""Application-level soft deletion; retained rows are hidden from normal ORM queries."""
from datetime import UTC, datetime

from sqlalchemy import event, update
from sqlalchemy.orm import Session, with_loader_criteria

from app.db.base import SoftDeleteMixin
from app.models.identity import Administrator, Application, AuthSession, Role, User, UserRole, Vacancy, VacancyAssignment


@event.listens_for(Session, "do_orm_execute")
def enforce_soft_delete_scope(state):
    if state.is_delete:
        raise ValueError("Permanent DELETE through Session is disabled; use soft_delete().")
    if (state.is_select or state.is_update) and not state.execution_options.get("include_deleted", False):
        state.statement = state.statement.options(with_loader_criteria(
            SoftDeleteMixin, lambda model: model.deleted_at.is_(None), include_aliases=True,
        ))


def soft_delete(db: Session, record: SoftDeleteMixin) -> None:
    """Retain the record and revoke/soft-delete dependent access where appropriate."""
    if record.deleted_at is not None:
        return
    current = datetime.now(UTC)
    with db.no_autoflush:
        if isinstance(record, User):
            record.is_active = False
            for model, field in [(Administrator, Administrator.user_id), (UserRole, UserRole.user_id), (VacancyAssignment, VacancyAssignment.user_id),
                                 (Application, Application.candidate_user_id)]:
                db.execute(update(model).where(field == record.id).values(deleted_at=current))
            db.execute(update(AuthSession).where(AuthSession.user_id == record.id).values(
                revoked_at=current, deleted_at=current,
            ))
        elif isinstance(record, Vacancy):
            for model in [Application, VacancyAssignment]:
                db.execute(update(model).where(model.vacancy_id == record.id).values(deleted_at=current))
        elif isinstance(record, Role):
            db.execute(update(UserRole).where(UserRole.role_id == record.id).values(deleted_at=current))
        elif isinstance(record, AuthSession):
            record.revoked_at = current
        record.deleted_at = current


@event.listens_for(Session, "before_flush")
def turn_orm_deletes_into_soft_deletes(db, flush_context, instances):
    for record in list(db.deleted):
        if isinstance(record, SoftDeleteMixin):
            db.add(record)
            soft_delete(db, record)
