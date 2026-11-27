"""Manual vacancy input contracts. Caller cannot supply IDs, status or approval fields."""
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class RuleInput(Input):
    name: str = Field(min_length=1, max_length=200)
    requirement: str = Field(min_length=1, max_length=4000)


class AnchorInput(Input):
    rating: int = Field(ge=0, le=4, strict=True)
    description: str = Field(min_length=1, max_length=2000)


class CriterionInput(Input):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=4000)
    weight: Decimal = Field(ge=0, le=100, max_digits=5, decimal_places=2, allow_inf_nan=False)
    anchors: list[AnchorInput] = Field(default_factory=list, max_length=5)

    @model_validator(mode="after")
    def distinct_ratings(self):
        if len({a.rating for a in self.anchors}) != len(self.anchors):
            raise ValueError("Rating anchors must be unique")
        return self


class RoleBriefInput(Input):
    title: str = Field(min_length=1, max_length=200)
    jd: str = Field(default="", max_length=20000)
    responsibilities: str = Field(default="", max_length=20000)
    seniority: Literal["", "intern", "junior", "mid", "senior", "lead", "manager"] = ""
    location: str = Field(default="", max_length=200)
    employment_type: Literal["", "full_time", "part_time", "contract", "internship", "temporary"] = ""


class UpdateRoleBriefInput(RoleBriefInput):
    revision: int = Field(gt=0, strict=True)


class ConfigurationInput(RoleBriefInput):
    """Internal structured scorecard contract for future generation, not a public write body."""
    missing_evidence_policy: Literal["clarify_then_manual_review"] = "clarify_then_manual_review"
    mandatory_rules: list[RuleInput] = Field(default_factory=list, max_length=50)
    criteria: list[CriterionInput] = Field(default_factory=list, max_length=50)

    @field_validator("mandatory_rules", "criteria")
    @classmethod
    def distinct_names(cls, items):
        if len({item.name.casefold() for item in items}) != len(items):
            raise ValueError("Names must be unique within each group")
        return items


class UpdateConfigurationInput(ConfigurationInput):
    revision: int = Field(gt=0, strict=True)


class RevisionInput(Input):
    revision: int = Field(gt=0, strict=True)


class CloneInput(Input):
    source_version_id: int | None = Field(default=None, gt=0)
