"""Single-company identity and access foundations with numeric IDs and soft deletion."""
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Identity, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin


class User(SoftDeleteMixin, Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("email = lower(email)", name="email_lowercase"),)
    id: Mapped[int] = mapped_column(Integer, Identity(start=1), primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class Role(SoftDeleteMixin, Base):
    __tablename__ = "roles"
    __table_args__ = (CheckConstraint("name IN ('hr', 'hiring_manager', 'candidate')", name="known_role"),)
    id: Mapped[int] = mapped_column(Integer, Identity(start=1), primary_key=True)
    name: Mapped[str] = mapped_column(String(32), unique=True)


class UserRole(SoftDeleteMixin, Base):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id"),)
    id: Mapped[int] = mapped_column(Integer, Identity(start=1), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="RESTRICT"), index=True)


class AuthSession(SoftDeleteMixin, Base):
    __tablename__ = "sessions"
    __table_args__ = (CheckConstraint("expires_at > created_at", name="valid_expiry"),)
    id: Mapped[int] = mapped_column(Integer, Identity(start=1), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, sort_order=900)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), sort_order=901)


class Vacancy(SoftDeleteMixin, Base):
    __tablename__ = "vacancies"
    id: Mapped[int] = mapped_column(Integer, Identity(start=1), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    lifecycle: Mapped["VacancyLifecycle | None"] = relationship("VacancyLifecycle", uselist=False, lazy="selectin")

    @property
    def status(self) -> str:
        return self.lifecycle.status if self.lifecycle is not None else "draft"

    @status.setter
    def status(self, value: str) -> None:
        from app.models.vacancy import VacancyLifecycle
        if self.lifecycle is None:
            self.lifecycle = VacancyLifecycle(status=value)
        else:
            self.lifecycle.status = value


class VacancyAssignment(SoftDeleteMixin, Base):
    __tablename__ = "vacancy_assignments"
    __table_args__ = (UniqueConstraint("user_id", "vacancy_id"),)
    id: Mapped[int] = mapped_column(Integer, Identity(start=1), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    vacancy_id: Mapped[int] = mapped_column(ForeignKey("vacancies.id", ondelete="RESTRICT"), index=True)


class Application(SoftDeleteMixin, Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("candidate_user_id", "vacancy_id"),)
    id: Mapped[int] = mapped_column(Integer, Identity(start=1), primary_key=True)
    candidate_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    vacancy_id: Mapped[int] = mapped_column(ForeignKey("vacancies.id", ondelete="RESTRICT"), index=True)


class LoginRateLimit(SoftDeleteMixin, Base):
    __tablename__ = "login_rate_limits"
    __table_args__ = (CheckConstraint("attempts > 0", name="positive_attempts"),)
    id: Mapped[int] = mapped_column(Integer, Identity(start=1), primary_key=True)
    bucket_hash: Mapped[str] = mapped_column(String(64), unique=True)
    attempts: Mapped[int] = mapped_column(Integer)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, sort_order=900)


class Administrator(SoftDeleteMixin, Base):
    __tablename__ = "administrators"
    id: Mapped[int] = mapped_column(Integer, Identity(start=1), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), unique=True)


class AdminSetup(SoftDeleteMixin, Base):
    __tablename__ = "admin_setup"
    __table_args__ = (CheckConstraint("id = 1", name="singleton"),)
    id: Mapped[int] = mapped_column(Integer, Identity(start=1), primary_key=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), sort_order=900)
