"""Role-brief API and retained scorecard/version regression tests; no model calls."""
from decimal import Decimal

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from test_auth import harness, ORIGIN  # noqa: F401
from app.db.soft_delete import soft_delete
from app.models import Administrator, EligibilityRule, RatingAnchor, ScreeningCriterion, VacancyAssignment, VacancyConfiguration
from app.schemas.vacancy import ConfigurationInput, UpdateConfigurationInput
from app.services import vacancies as service

BASE = "/staff/vacancies"


def brief():
    return {"title": "Junior AI Engineer", "jd": "Develop an internal AI chatbot.",
        "responsibilities": "Implement and test chatbot features with guidance.",
        "seniority": "junior", "location": "Maluri, Cheras", "employment_type": "full_time"}


def scorecard(weights=("60.00", "40.00")):
    """Synthetic internal result fixture, not an implemented AI generator or public API."""
    return {**brief(), "mandatory_rules": [{"name": "Required certification", "requirement": "Documented certification or unknown pending clarification."}],
        "criteria": [{"name": f"Skill {i}", "description": "Assess demonstrated evidence.", "weight": weight,
            "anchors": [{"rating": n, "description": f"Observable evidence level {n}."} for n in range(5)]}
            for i, weight in enumerate(weights)]}


def seed_scorecard(db, vacancy_id, version_id, actor_id, payload=None):
    vacancy = service.scoped(db, vacancy_id, actor_id, lock=True)
    version = service.get_version(db, vacancy, version_id)
    return service.replace_draft(db, vacancy, version,
        UpdateConfigurationInput(**(payload or scorecard()), revision=version.revision))


def headers(h, who="hr"):
    assert h.login(who=who).status_code == 200
    return {"Origin": ORIGIN, "X-CSRF-Token": h.client.get("/auth/csrf").json()["csrf_token"]}


def created(h, payload=None, who="hr", with_scorecard=False):
    head = headers(h, who)
    response = h.client.post(BASE, headers=head, json=payload or brief())
    assert response.status_code == 201, response.text
    result = response.json()
    if with_scorecard:
        result = seed_scorecard(h.db, result["id"], result["versions"][0]["id"], h.users[who].id)
    return result, result["versions"][0], head


def approve(h, vacancy, version, head):
    return h.client.post(f"{BASE}/{vacancy['id']}/versions/{version['id']}/approve", headers=head, json={"revision": version["revision"]})


def test_role_brief_saves_without_any_scorecard(harness):
    h = harness
    vacancy, version, head = created(h, {"title": "AI Engineer"})
    assert version["criteria"] == [] and version["mandatory_rules"] == []
    assert version["scorecard_state"] == "awaiting_generation"
    assert version["scorecard_generation_available"] is False
    assert version["role_brief_errors"]
    response = h.client.put(f"{BASE}/{vacancy['id']}/versions/{version['id']}", headers=head, json={**brief(), "revision": 1})
    assert response.status_code == 200, response.text
    saved = response.json()["versions"][0]
    assert saved["jd"] == brief()["jd"] and saved["location"] == "Maluri, Cheras"
    assert saved["role_brief_errors"] == [] and saved["scorecard_errors"]
    assert saved["revision"] == 2 and saved["criteria"] == []
    assert approve(h, vacancy, saved, head).status_code == 422
    assert h.client.get(BASE).json()["items"][0]["id"] == vacancy["id"]
    assignment = h.db.scalar(select(VacancyAssignment).where(VacancyAssignment.vacancy_id == vacancy["id"]))
    assert assignment.user_id == h.users["hr"].id


@pytest.mark.parametrize("field,value", [("criteria", []), ("mandatory_rules", []), ("missing_evidence_policy", "clarify_then_manual_review"), ("approved_by", 1), ("status", "approved"), ("created_by", 1)])
def test_public_writes_reject_scorecard_and_privilege_fields(harness, field, value):
    h = harness
    vacancy, version, head = created(h)
    assert h.client.post(BASE, headers=head, json={**brief(), field: value}).status_code == 422
    assert h.client.put(f"{BASE}/{vacancy['id']}/versions/{version['id']}", headers=head, json={**brief(), "revision": 1, field: value}).status_code == 422


def test_existing_scorecard_readonly_preserved_on_noop_save_and_approval(harness):
    h = harness
    vacancy, version, head = created(h, with_scorecard=True)
    assert version["scorecard_state"] == "ready" and not version["approval_errors"]
    assert version["criteria"][0]["anchors"][3]["points"] == "45.00"
    response = h.client.put(f"{BASE}/{vacancy['id']}/versions/{version['id']}", headers=head, json={**brief(), "revision": version["revision"]})
    saved = response.json()["versions"][0]
    assert saved["criteria"] == version["criteria"] and saved["mandatory_rules"] == version["mandatory_rules"]
    assert saved["scorecard_state"] == "ready"
    result = approve(h, vacancy, saved, head)
    assert result.status_code == 200, result.text
    approved = result.json()["versions"][0]
    assert approved["approved_by"] == h.users["hr"].id and len(approved["approved_at"]) == 19
    assert approve(h, vacancy, approved, head).status_code == 409


def test_role_edit_invalidates_only_draft_scorecard_preserving_approved_snapshot(harness):
    h = harness
    vacancy, version, head = created(h, with_scorecard=True)
    original = approve(h, vacancy, version, head).json()["versions"][0]
    clone = h.client.post(f"{BASE}/{vacancy['id']}/drafts", headers=head, json={"source_version_id": version["id"]})
    assert clone.status_code == 201
    draft = clone.json()["versions"][0]
    old_criterion = h.db.scalar(select(ScreeningCriterion).where(ScreeningCriterion.configuration_id == draft["id"]))
    old_id = old_criterion.id
    assert h.client.post(f"{BASE}/{vacancy['id']}/drafts", headers=head, json={}).status_code == 409
    response = h.client.put(f"{BASE}/{vacancy['id']}/versions/{draft['id']}", headers=head,
        json={**brief(), "jd": "Changed project requirements", "revision": draft["revision"]})
    assert response.status_code == 200
    saved = response.json()["versions"][0]
    assert saved["criteria"] == [] and saved["mandatory_rules"] == []
    assert saved["scorecard_state"] == "awaiting_generation"
    assert response.json()["versions"][1] == original
    assert h.db.scalar(select(ScreeningCriterion).where(ScreeningCriterion.id == old_id)) is None
    assert h.db.scalar(select(ScreeningCriterion).where(ScreeningCriterion.id == old_id).execution_options(include_deleted=True)).deleted_at
    assert approve(h, vacancy, saved, head).status_code == 422
    assert h.client.put(f"{BASE}/{vacancy['id']}/versions/{original['id']}", headers=head, json={**brief(), "revision": original["revision"]}).status_code == 409


def test_revision_conflict_archive_and_discard(harness):
    h = harness
    vacancy, version, head = created(h)
    path = f"{BASE}/{vacancy['id']}/versions/{version['id']}"
    assert h.client.put(path, headers=head, json={**brief(), "revision": 99}).status_code == 409
    deleted = h.client.request("DELETE", path, headers=head, json={"revision": 1})
    assert deleted.status_code == 200 and deleted.json()["versions"] == []
    assert h.db.scalar(select(VacancyConfiguration).where(VacancyConfiguration.id == version["id"]).execution_options(include_deleted=True)).deleted_at
    cloned = h.client.post(f"{BASE}/{vacancy['id']}/drafts", headers=head, json={}).json()
    assert cloned["versions"][0]["version"] == 2
    assert h.client.post(f"{BASE}/{vacancy['id']}/archive", headers=head).json()["status"] == "archived"
    assert h.client.get(f"{BASE}/{vacancy['id']}").status_code == 200
    assert h.client.get(BASE + "?status=archived").json()["total"] == 1
    assert h.client.post(f"{BASE}/{vacancy['id']}/drafts", headers=head, json={}).status_code == 409


def test_permissions_csrf_origin_and_cross_version_scope(harness):
    h = harness
    vacancy, version, head = created(h)
    assert h.client.post(BASE, json=brief()).status_code == 403
    assert h.client.post(BASE, headers={**head, "Origin": "https://attacker.invalid"}, json=brief()).status_code == 403
    other = h.client.post(BASE, headers=head, json=brief()).json()
    assert h.client.put(f"{BASE}/{other['id']}/versions/{version['id']}", headers=head, json={**brief(), "revision": 1}).status_code == 404
    for who, expected in [("manager", 404), ("bob", 403)]:
        their_headers = headers(h, who)
        assert h.client.get(f"{BASE}/{vacancy['id']}").status_code == expected
        assert h.client.put(f"{BASE}/{vacancy['id']}/versions/{version['id']}", headers=their_headers, json={**brief(), "revision": 1}).status_code == expected
    assert h.client.post(BASE, headers=their_headers, json=brief()).status_code == 403
    h.db.add(Administrator(user_id=h.users["manager"].id)); h.db.commit()
    headers(h, "manager")
    assert h.client.get(f"{BASE}/{vacancy['id']}").status_code == 404
    h.client.cookies.clear()
    assert h.client.get(BASE).status_code == 401


def test_only_assigned_hr_approves_retained_valid_scorecard(harness):
    h = harness
    vacancy, version, manager = created(h, who="manager", with_scorecard=True)
    assert approve(h, vacancy, version, manager).status_code == 403
    hr = headers(h)
    assert approve(h, vacancy, version, hr).status_code == 404
    h.db.add(VacancyAssignment(user_id=h.users["hr"].id, vacancy_id=vacancy["id"])); h.db.commit()
    assert approve(h, vacancy, version, hr).status_code == 200


def test_admin_rename_invalidates_draft_not_approved_history(harness):
    h = harness
    vacancy, version, head = created(h, with_scorecard=True)
    original = approve(h, vacancy, version, head).json()["versions"][0]
    h.db.add(Administrator(user_id=h.users["hr"].id)); h.db.commit()
    assert h.client.patch(f"/admin/vacancies/{vacancy['id']}", headers=head, json={"title": "New title"}).status_code == 200
    detail = h.client.get(f"{BASE}/{vacancy['id']}").json()
    assert detail["versions"][0]["criteria"] == []
    assert detail["versions"][1] == original
    assert h.client.delete(f"/admin/vacancies/{vacancy['id']}", headers=head).status_code == 204
    assert h.db.get(VacancyConfiguration, original["id"]).status == "approved"


@pytest.mark.parametrize("weights", [("100.01",), ("-1", "101"), ("NaN",), ("Infinity",), ("33.333", "66.667")])
def test_internal_scorecard_contract_rejects_invalid_weights(weights):
    with pytest.raises(ValidationError): ConfigurationInput(**scorecard(weights))


@pytest.mark.parametrize("kind", ["missing", "duplicate", "out_of_range", "blank", "duplicate_name"])
def test_internal_rubric_validation(kind):
    data = scorecard()
    if kind == "missing": data["criteria"][0]["anchors"].pop()
    elif kind == "duplicate": data["criteria"][0]["anchors"][1]["rating"] = 0
    elif kind == "out_of_range": data["criteria"][0]["anchors"][0]["rating"] = 5
    elif kind == "blank": data["criteria"][0]["anchors"][0]["description"] = " "
    elif kind == "duplicate_name": data["criteria"][1]["name"] = data["criteria"][0]["name"]
    if kind == "missing":
        validated = ConfigurationInput(**data)
        assert any("five rating anchors" in e for e in service.approval_errors(validated.model_dump()))
    else:
        with pytest.raises(ValidationError): ConfigurationInput(**data)


def test_exact_decimal_validation_and_points():
    valid = ConfigurationInput(**scorecard(("33.33", "33.33", "33.34", "0.00")))
    assert service.approval_errors(valid.model_dump()) == []
    invalid = ConfigurationInput(**scorecard(("99.99",)))
    assert "Criterion weights must total exactly 100%" in service.approval_errors(invalid.model_dump())
    assert service.points(Decimal("33.33"), 2) == Decimal("16.67")


def test_postgres_enforces_immutable_approved_contents(harness):
    h = harness
    if h.db.bind.dialect.name != "postgresql": pytest.skip("PostgreSQL trigger protection")
    vacancy, version, head = created(h, with_scorecard=True)
    assert approve(h, vacancy, version, head).status_code == 200
    record = h.db.get(VacancyConfiguration, version["id"])
    criterion = h.db.scalar(select(ScreeningCriterion).where(ScreeningCriterion.configuration_id == record.id))
    rule = h.db.scalar(select(EligibilityRule).where(EligibilityRule.configuration_id == record.id))
    anchor = h.db.scalar(select(RatingAnchor).where(RatingAnchor.criterion_id == criterion.id))
    for item, field, value in [(record, "title", "Overwrite"), (criterion, "weight", Decimal("1")), (rule, "requirement", "Changed"), (anchor, "description", "Changed")]:
        with pytest.raises(IntegrityError), h.db.begin_nested():
            setattr(item, field, value); h.db.flush()
    with pytest.raises(IntegrityError), h.db.begin_nested():
        h.db.add(EligibilityRule(configuration_id=record.id, position=10, name="Injected rule", requirement="Blocked")); h.db.flush()
    with pytest.raises(IntegrityError), h.db.begin_nested():
        soft_delete(h.db, record); h.db.flush()
