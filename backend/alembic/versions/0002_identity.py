"""Numeric identity/access records with retained soft-delete history."""
from alembic import op
import sqlalchemy as sa

revision = "0002_identity"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def identifier():
    return sa.Column("id", sa.Integer(), sa.Identity(start=1), primary_key=True)


def timestamps():
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    ]


def upgrade() -> None:
    op.create_table("users", identifier(),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(512), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *timestamps(), sa.CheckConstraint("email = lower(email)", name="email_lowercase"))
    roles = op.create_table("roles", identifier(),
        sa.Column("name", sa.String(32), nullable=False, unique=True), *timestamps(),
        sa.CheckConstraint("name IN ('hr', 'hiring_manager', 'candidate')", name="known_role"))
    op.bulk_insert(roles, [{"name": name} for name in ["hr", "hiring_manager", "candidate"]])
    op.create_table("user_roles", identifier(),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("role_id", sa.Integer(), sa.ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False),
        *timestamps(), sa.UniqueConstraint("user_id", "role_id"))
    op.create_table("sessions", identifier(),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)), *timestamps(),
        sa.CheckConstraint("expires_at > created_at", name="valid_expiry"))
    op.create_table("vacancies", identifier(),
        sa.Column("title", sa.String(200), nullable=False), *timestamps())
    op.create_table("vacancy_assignments", identifier(),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("vacancy_id", sa.Integer(), sa.ForeignKey("vacancies.id", ondelete="RESTRICT"), nullable=False),
        *timestamps(), sa.UniqueConstraint("user_id", "vacancy_id"))
    op.create_table("applications", identifier(),
        sa.Column("candidate_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("vacancy_id", sa.Integer(), sa.ForeignKey("vacancies.id", ondelete="RESTRICT"), nullable=False),
        *timestamps(), sa.UniqueConstraint("candidate_user_id", "vacancy_id"))
    op.create_table("login_rate_limits", identifier(),
        sa.Column("bucket_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False), *timestamps(),
        sa.CheckConstraint("attempts > 0", name="positive_attempts"))
    indexes = {
        "users": [], "roles": [], "user_roles": ["user_id", "role_id"],
        "sessions": ["user_id", "expires_at"], "vacancies": [],
        "vacancy_assignments": ["user_id", "vacancy_id"],
        "applications": ["candidate_user_id", "vacancy_id"],
        "login_rate_limits": ["expires_at"],
    }
    for table, columns in indexes.items():
        for column in [*columns, "deleted_at"]:
            op.create_index(f"ix_{table}_{column}", table, [column])


def downgrade() -> None:
    # Schema downgrade is explicit/destructive; normal app operations soft-delete.
    for name in ["login_rate_limits", "applications", "vacancy_assignments", "vacancies", "sessions", "user_roles", "roles", "users"]:
        op.drop_table(name)
