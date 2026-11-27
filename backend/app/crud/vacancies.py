"""Persistence for vacancy records, assignments and version contents; caller owns transactions."""
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import EligibilityRule, RatingAnchor, ScreeningCriterion, Vacancy, VacancyAssignment, VacancyConfiguration, VacancyLifecycle


def scoped_vacancy(db: Session, vacancy_id: int, user_id: int, *, lock=False):
    statement = select(Vacancy).where(Vacancy.id == vacancy_id, Vacancy.id.in_(
        select(VacancyAssignment.vacancy_id).where(VacancyAssignment.user_id == user_id)))
    if lock:
        statement = statement.with_for_update()
    return db.scalar(statement)


def list_assigned(db: Session, user_id: int, q: str, status: str | None, limit: int, offset: int):
    statement = select(Vacancy).where(Vacancy.id.in_(select(VacancyAssignment.vacancy_id).where(VacancyAssignment.user_id == user_id)))
    if q:
        statement = statement.where(Vacancy.title.icontains(q, autoescape=True))
    if status:
        statement = statement.where(or_(Vacancy.lifecycle.has(VacancyLifecycle.status == status), ~Vacancy.lifecycle.has()) if status == "draft" else Vacancy.lifecycle.has(VacancyLifecycle.status == status))
    total = db.scalar(select(func.count()).select_from(statement.subquery()))
    return list(db.scalars(statement.order_by(Vacancy.id.desc()).limit(limit).offset(offset))), total


def create(db: Session, title: str, creator_id: int):
    vacancy = Vacancy(title=title, status="draft")
    db.add(vacancy)
    db.flush()
    db.add(VacancyAssignment(user_id=creator_id, vacancy_id=vacancy.id))
    db.flush()
    return vacancy


def configurations(db: Session, vacancy_id: int):
    return list(db.scalars(select(VacancyConfiguration).where(VacancyConfiguration.vacancy_id == vacancy_id).order_by(VacancyConfiguration.version.desc())))


def configuration(db: Session, vacancy_id: int, identifier: int):
    return db.scalar(select(VacancyConfiguration).where(VacancyConfiguration.id == identifier, VacancyConfiguration.vacancy_id == vacancy_id))


def new_configuration(db: Session, vacancy: Vacancy, actor_id: int, values: dict):
    number = (db.scalar(select(func.max(VacancyConfiguration.version)).where(
        VacancyConfiguration.vacancy_id == vacancy.id).execution_options(include_deleted=True)) or 0) + 1
    record = VacancyConfiguration(vacancy_id=vacancy.id, version=number, created_by=actor_id, **values)
    db.add(record)
    db.flush()
    return record


def rules(db: Session, config_id: int):
    return list(db.scalars(select(EligibilityRule).where(EligibilityRule.configuration_id == config_id).order_by(EligibilityRule.position, EligibilityRule.id)))


def criteria(db: Session, config_id: int):
    return list(db.scalars(select(ScreeningCriterion).where(ScreeningCriterion.configuration_id == config_id).order_by(ScreeningCriterion.position, ScreeningCriterion.id)))


def anchors(db: Session, criterion_id: int):
    return list(db.scalars(select(RatingAnchor).where(RatingAnchor.criterion_id == criterion_id).order_by(RatingAnchor.rating, RatingAnchor.id)))


def add_contents(db: Session, config_id: int, mandatory_rules: list, weighted_criteria: list):
    for position, rule in enumerate(mandatory_rules):
        db.add(EligibilityRule(configuration_id=config_id, position=position, **rule))
    for position, item in enumerate(weighted_criteria):
        values = dict(item)
        rating_anchors = values.pop("anchors")
        record = ScreeningCriterion(configuration_id=config_id, position=position, **values)
        db.add(record)
        db.flush()
        db.add_all([RatingAnchor(criterion_id=record.id, **anchor) for anchor in rating_anchors])
    db.flush()


def replace_contents(db: Session, record, values, mandatory_rules, weighted_criteria):
    from app.db.soft_delete import soft_delete
    for rule in rules(db, record.id):
        soft_delete(db, rule)
    for criterion in criteria(db, record.id):
        for anchor in anchors(db, criterion.id):
            soft_delete(db, anchor)
        soft_delete(db, criterion)
    for key, value in values.items():
        setattr(record, key, value)
    record.revision += 1
    db.flush()
    add_contents(db, record.id, mandatory_rules, weighted_criteria)


def mark_approved(vacancy, record, actor_id, approved_at):
    record.status, record.approved_by, record.approved_at = "approved", actor_id, approved_at
    record.revision += 1
    vacancy.title, vacancy.status = record.title, "approved"


def discard(db: Session, record):
    from app.db.soft_delete import soft_delete
    soft_delete(db, record)


def archive(vacancy):
    vacancy.status = "archived"


def save_brief(db: Session, vacancy, record, values: dict, *, invalidate_scorecard: bool):
    if vacancy.status == "draft":
        vacancy.title = values["title"]
    if invalidate_scorecard:
        replace_contents(db, record, values, [], [])
    else:
        # A no-op save must not silently remove an existing valid scorecard.
        record.revision += 1
        db.flush()
