"""Versioned, internal vacancy configurations; recruitment execution is separate."""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Identity, Index, Integer, Numeric, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SoftDeleteMixin


class VacancyLifecycle(SoftDeleteMixin, Base):
    """One-to-one extension keeps the original vacancies table/column order intact."""
    __tablename__ = "vacancy_lifecycles"
    __table_args__ = (CheckConstraint("status IN ('draft', 'approved', 'archived')", name="vacancy_status"),)
    id: Mapped[int] = mapped_column(Integer, Identity(start=1), primary_key=True)
    vacancy_id: Mapped[int] = mapped_column(ForeignKey("vacancies.id", ondelete="RESTRICT"), unique=True)
    status: Mapped[str] = mapped_column(String(16), default="draft", server_default="draft")


class VacancyConfiguration(SoftDeleteMixin, Base):
    __tablename__ = "vacancy_configurations"
    __table_args__ = (
        UniqueConstraint("vacancy_id", "version"),
        CheckConstraint("version > 0 AND revision > 0", name="positive_versions"),
        CheckConstraint("status IN ('draft', 'approved')", name="configuration_status"),
        CheckConstraint("missing_evidence_policy = 'clarify_then_manual_review'", name="missing_evidence_policy"),
        CheckConstraint("(status = 'draft' AND approved_by IS NULL AND approved_at IS NULL) OR (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)", name="approval_record"),
        Index("uq_vacancy_active_draft", "vacancy_id", unique=True,
              postgresql_where=text("status = 'draft' AND deleted_at IS NULL"),
              sqlite_where=text("status = 'draft' AND deleted_at IS NULL")),
    )
    id: Mapped[int] = mapped_column(Integer, Identity(start=1), primary_key=True)
    vacancy_id: Mapped[int] = mapped_column(ForeignKey("vacancies.id", ondelete="RESTRICT"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    revision: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    status: Mapped[str] = mapped_column(String(16), default="draft", server_default="draft")
    title: Mapped[str] = mapped_column(String(200))
    jd: Mapped[str] = mapped_column(Text, default="", server_default="")
    responsibilities: Mapped[str] = mapped_column(Text, default="", server_default="")
    seniority: Mapped[str] = mapped_column(String(32), default="", server_default="")
    location: Mapped[str] = mapped_column(String(200), default="", server_default="")
    employment_type: Mapped[str] = mapped_column(String(32), default="", server_default="")
    missing_evidence_policy: Mapped[str] = mapped_column(String(40), default="clarify_then_manual_review", server_default="clarify_then_manual_review")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), sort_order=900)


class EligibilityRule(SoftDeleteMixin, Base):
    __tablename__ = "eligibility_rules"
    __table_args__ = (CheckConstraint("position >= 0", name="rule_position"),)
    id: Mapped[int] = mapped_column(Integer, Identity(start=1), primary_key=True)
    configuration_id: Mapped[int] = mapped_column(ForeignKey("vacancy_configurations.id", ondelete="RESTRICT"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(200))
    requirement: Mapped[str] = mapped_column(Text)
    # Removing/replacing draft items retains historical rows, so positions may repeat when archived.


class ScreeningCriterion(SoftDeleteMixin, Base):
    __tablename__ = "screening_criteria"
    __table_args__ = (CheckConstraint("weight >= 0 AND weight <= 100", name="criterion_weight"),
        CheckConstraint("position >= 0", name="criterion_position"),)
    id: Mapped[int] = mapped_column(Integer, Identity(start=1), primary_key=True)
    configuration_id: Mapped[int] = mapped_column(ForeignKey("vacancy_configurations.id", ondelete="RESTRICT"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    weight: Mapped[Decimal] = mapped_column(Numeric(5, 2))


class RatingAnchor(SoftDeleteMixin, Base):
    __tablename__ = "rating_anchors"
    __table_args__ = (CheckConstraint("rating >= 0 AND rating <= 4", name="anchor_rating"),)
    id: Mapped[int] = mapped_column(Integer, Identity(start=1), primary_key=True)
    criterion_id: Mapped[int] = mapped_column(ForeignKey("screening_criteria.id", ondelete="RESTRICT"), index=True)
    rating: Mapped[int] = mapped_column(Integer)
    description: Mapped[str] = mapped_column(Text)
