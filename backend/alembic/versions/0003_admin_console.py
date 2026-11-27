"""Explicit administrators and one-time setup state; never elevate existing users."""
from alembic import op
import sqlalchemy as sa

revision = "0003_admin_console"
down_revision = "0002_identity"
branch_labels = None
depends_on = None


def timestamps():
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    ]


def upgrade() -> None:
    op.create_table("administrators",
        sa.Column("id", sa.Integer(), sa.Identity(start=1), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, unique=True),
        *timestamps())
    setup = op.create_table("admin_setup",
        sa.Column("id", sa.Integer(), sa.Identity(start=1), primary_key=True),
        sa.Column("completed_at", sa.DateTime(timezone=True)), *timestamps(),
        sa.CheckConstraint("id = 1", name="singleton"))
    op.create_index("ix_administrators_deleted_at", "administrators", ["deleted_at"])
    op.create_index("ix_admin_setup_deleted_at", "admin_setup", ["deleted_at"])
    op.execute(setup.insert().values({}))


def downgrade() -> None:
    op.drop_table("administrators")
    op.drop_table("admin_setup")
