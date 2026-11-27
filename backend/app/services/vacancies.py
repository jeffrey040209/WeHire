"""Manual configuration lifecycle. All mutating workflows lock the stable vacancy row."""
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.datetime_display import display_datetime
from app.core.security import now
from app.crud import vacancies as store
from app.schemas.vacancy import ConfigurationInput, UpdateRoleBriefInput

FIELDS = ("title", "jd", "responsibilities", "seniority", "location", "employment_type", "missing_evidence_policy")


class VacancyError(Exception):
    def __init__(self, status: int, detail: str):
        self.status, self.detail = status, detail


def commit(db: Session):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise VacancyError(409, "Configuration changed concurrently; reload and try again") from None


def scoped(db, vacancy_id, actor_id, *, lock=False):
    vacancy = store.scoped_vacancy(db, vacancy_id, actor_id, lock=lock)
    if vacancy is None:
        raise VacancyError(404, "Vacancy not found")
    return vacancy


def editable(vacancy):
    if vacancy.status == "archived":
        raise VacancyError(409, "Archived vacancies are read-only")


def points(weight: Decimal, rating: int) -> Decimal:
    """Rubric definition only, not screening: weight × evidenced rating / 4, half-up to 2dp."""
    if not isinstance(rating, int) or isinstance(rating, bool) or rating not in range(5):
        raise ValueError("An evidenced integer rating from 0 to 4 is required")
    return (weight * Decimal(rating) / Decimal(4)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def content(db, record):
    return {**{name: getattr(record, name) for name in FIELDS},
        "mandatory_rules": [{"name": r.name, "requirement": r.requirement} for r in store.rules(db, record.id)],
        "criteria": [{"name": c.name, "description": c.description, "weight": c.weight,
            "anchors": [{"rating": a.rating, "description": a.description} for a in store.anchors(db, c.id)]}
            for c in store.criteria(db, record.id)]}


BRIEF_FIELDS = FIELDS[:-1]


def brief_errors(data):
    return [f"Complete {key.replace('_', ' ')}" for key in BRIEF_FIELDS if not data[key].strip()]


def scorecard_errors(data):
    errors = []
    if not data["criteria"]:
        errors.append("Awaiting AI scorecard generation")
    total = sum((c["weight"] for c in data["criteria"]), Decimal("0"))
    if total != Decimal("100"):
        errors.append("Criterion weights must total exactly 100%")
    for criterion in data["criteria"]:
        if not criterion["description"].strip():
            errors.append(f"Describe criterion: {criterion['name']}")
        if {a["rating"] for a in criterion["anchors"]} != set(range(5)):
            errors.append(f"Define all five rating anchors (0–4): {criterion['name']}")
    return errors


def approval_errors(data):
    return brief_errors(data) + scorecard_errors(data)


def version_view(db, record):
    data = content(db, record)
    brief_checks, scorecard_checks = brief_errors(data), scorecard_errors(data)
    scorecard_state = "awaiting_generation" if not data["criteria"] else "needs_review" if scorecard_checks else "ready"
    total = sum((c["weight"] for c in data["criteria"]), Decimal("0"))
    for criterion in data["criteria"]:
        for anchor in criterion["anchors"]:
            anchor["points"] = str(points(criterion["weight"], anchor["rating"]))
        criterion["weight"] = str(criterion["weight"])
    return {"id": record.id, "version": record.version, "revision": record.revision, "status": record.status,
        **data, "weight_total": str(total), "approval_errors": brief_checks + scorecard_checks,
        "role_brief_errors": brief_checks, "scorecard_errors": scorecard_checks,
        "scorecard_state": scorecard_state, "scorecard_generation_available": False,
        "rating_to_points": "weight × rating / 4; round half-up to 2 decimal places per criterion; sum rounded points",
        "unknown_evidence": "Eligibility: unknown. Criteria: no rating or points until clarification/human review; do not convert to zero or renormalise weights. An incomplete score must not be ranked as a completed score.",
        "created_by": record.created_by, "approved_by": record.approved_by,
        **{key: display_datetime(getattr(record, key)) for key in ("approved_at", "created_at", "updated_at", "deleted_at")}}


def vacancy_view(db, vacancy, *, full=True):
    versions = store.configurations(db, vacancy.id)
    approved = next((v for v in versions if v.status == "approved"), None)
    draft = next((v for v in versions if v.status == "draft"), None)
    result = {"id": vacancy.id, "title": vacancy.title, "status": vacancy.status,
        "draft_id": draft.id if draft else None, "approved_version_id": approved.id if approved else None,
        "approved_version": approved.version if approved else None,
        "created_at": display_datetime(vacancy.created_at), "updated_at": display_datetime(vacancy.updated_at),
        "deleted_at": display_datetime(vacancy.deleted_at), "timezone": "Asia/Kuala_Lumpur"}
    if full:
        result["versions"] = [version_view(db, v) for v in versions]
    return result


def create(db, payload, actor_id):
    vacancy = store.create(db, payload.title, actor_id)
    record = store.new_configuration(db, vacancy, actor_id, payload.model_dump(include=set(FIELDS)))
    commit(db)
    return vacancy_view(db, vacancy)


def get_version(db, vacancy, version_id):
    record = store.configuration(db, vacancy.id, version_id)
    if record is None:
        raise VacancyError(404, "Configuration not found")
    return record


def ensure_draft(record, revision):
    if record.status != "draft":
        raise VacancyError(409, "Approved versions are immutable; create a new draft")
    if record.revision != revision:
        raise VacancyError(409, "Draft has changed; reload before editing or approving")


def replace_draft(db, vacancy, record, payload):
    editable(vacancy)
    ensure_draft(record, payload.revision)
    if vacancy.status == "draft":
        vacancy.title = payload.title
    store.replace_contents(db, record, payload.model_dump(include=set(FIELDS)),
        [r.model_dump() for r in payload.mandatory_rules], [c.model_dump() for c in payload.criteria])
    commit(db)
    return vacancy_view(db, vacancy)


def save_brief(db, vacancy, record, payload):
    """Save human role details without requiring or accepting any scorecard fields.

    Changed role context invalidates only this draft's scorecard; archived content and
    approved snapshots remain retained. Regeneration will be implemented separately.
    """
    editable(vacancy)
    ensure_draft(record, payload.revision)
    values = payload.model_dump(include=set(BRIEF_FIELDS))
    changed = any(getattr(record, key) != value for key, value in values.items())
    store.save_brief(db, vacancy, record, values, invalidate_scorecard=changed)
    commit(db)
    return vacancy_view(db, vacancy)


def start_draft(db, vacancy, actor_id, source_version_id=None):
    editable(vacancy)
    versions = store.configurations(db, vacancy.id)
    if any(v.status == "draft" for v in versions):
        raise VacancyError(409, "A draft already exists; open it instead")
    source = get_version(db, vacancy, source_version_id) if source_version_id else (versions[0] if versions else None)
    values = content(db, source) if source else ConfigurationInput(title=vacancy.title).model_dump()
    rules, criteria = values.pop("mandatory_rules"), values.pop("criteria")
    record = store.new_configuration(db, vacancy, actor_id, values)
    store.add_contents(db, record.id, rules, criteria)
    return record


def clone(db, vacancy, actor_id, source_version_id=None):
    start_draft(db, vacancy, actor_id, source_version_id)
    commit(db)
    return vacancy_view(db, vacancy)


def rename_title(db, vacancy_id, actor_id, title):
    """Legacy admin title form follows the same atomic draft/version workflow."""
    vacancy = scoped(db, vacancy_id, actor_id, lock=True)
    editable(vacancy)
    draft = next((v for v in store.configurations(db, vacancy.id) if v.status == "draft"), None)
    if draft is None:
        draft = start_draft(db, vacancy, actor_id)
    values = {field: getattr(draft, field) for field in BRIEF_FIELDS}
    values["title"] = title
    save_brief(db, vacancy, draft, UpdateRoleBriefInput(**values, revision=draft.revision))
    return vacancy


def approve(db, vacancy, record, revision, actor_id):
    editable(vacancy)
    ensure_draft(record, revision)
    errors = approval_errors(content(db, record))
    if errors:
        raise VacancyError(422, "; ".join(errors))
    store.mark_approved(vacancy, record, actor_id, now())
    commit(db)
    return vacancy_view(db, vacancy)


def discard(db, vacancy, record, revision):
    editable(vacancy)
    ensure_draft(record, revision)
    store.discard(db, record)
    commit(db)
    return vacancy_view(db, vacancy)


def archive(db, vacancy):
    # Operational archive retains assignments and immutable version history for authorised staff.
    store.archive(vacancy)
    commit(db)
    return vacancy_view(db, vacancy)
