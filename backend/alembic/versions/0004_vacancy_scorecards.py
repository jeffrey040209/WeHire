"""Add manual, versioned vacancy scorecards without replacing existing access records."""
from alembic import op
import sqlalchemy as sa

revision = "0004_vacancy_scorecards"
down_revision = "0003_admin_console"
branch_labels = None
depends_on = None


def timestamps():
    return [sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True))]


def identity():
    return sa.Column("id", sa.Integer(), sa.Identity(start=1), primary_key=True)


def fk(name, table, **kwargs):
    return sa.Column(name, sa.Integer(), sa.ForeignKey(table + ".id", ondelete="RESTRICT"), **kwargs)


def upgrade():
    # Extend the stable vacancy via a one-to-one table: no old table is rebuilt/reordered.
    op.create_table("vacancy_lifecycles", identity(), fk("vacancy_id", "vacancies", nullable=False, unique=True),
        sa.Column("status", sa.String(16), server_default="draft", nullable=False), *timestamps(),
        sa.CheckConstraint("status IN ('draft', 'approved', 'archived')", name="vacancy_status"))
    op.create_index("ix_vacancy_lifecycles_deleted_at", "vacancy_lifecycles", ["deleted_at"])
    op.execute("""INSERT INTO vacancy_lifecycles (vacancy_id, status)
                  SELECT id, CASE WHEN deleted_at IS NULL THEN 'draft' ELSE 'archived' END FROM vacancies ORDER BY id""")
    op.create_table("vacancy_configurations", identity(), fk("vacancy_id", "vacancies", nullable=False),
        sa.Column("version", sa.Integer(), nullable=False), sa.Column("revision", sa.Integer(), server_default="1", nullable=False),
        sa.Column("status", sa.String(16), server_default="draft", nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("jd", sa.Text(), server_default="", nullable=False),
        sa.Column("responsibilities", sa.Text(), server_default="", nullable=False),
        sa.Column("seniority", sa.String(32), server_default="", nullable=False),
        sa.Column("location", sa.String(200), server_default="", nullable=False),
        sa.Column("employment_type", sa.String(32), server_default="", nullable=False),
        sa.Column("missing_evidence_policy", sa.String(40), server_default="clarify_then_manual_review", nullable=False),
        fk("created_by", "users"), fk("approved_by", "users"), sa.Column("approved_at", sa.DateTime(timezone=True)), *timestamps(),
        sa.UniqueConstraint("vacancy_id", "version"),
        sa.CheckConstraint("version > 0 AND revision > 0", name="positive_versions"),
        sa.CheckConstraint("status IN ('draft', 'approved')", name="configuration_status"),
        sa.CheckConstraint("missing_evidence_policy = 'clarify_then_manual_review'", name="missing_evidence_policy"),
        sa.CheckConstraint("(status = 'draft' AND approved_by IS NULL AND approved_at IS NULL) OR (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)", name="approval_record"))
    op.create_index("uq_vacancy_active_draft", "vacancy_configurations", ["vacancy_id"], unique=True,
                    postgresql_where=sa.text("status = 'draft' AND deleted_at IS NULL"))
    op.create_table("eligibility_rules", identity(), fk("configuration_id", "vacancy_configurations", nullable=False),
        sa.Column("position", sa.Integer(), nullable=False), sa.Column("name", sa.String(200), nullable=False),
        sa.Column("requirement", sa.Text(), nullable=False), *timestamps(),
        sa.CheckConstraint("position >= 0", name="rule_position"))
    op.create_table("screening_criteria", identity(), fk("configuration_id", "vacancy_configurations", nullable=False),
        sa.Column("position", sa.Integer(), nullable=False), sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False), sa.Column("weight", sa.Numeric(5, 2), nullable=False), *timestamps(),
        sa.CheckConstraint("weight >= 0 AND weight <= 100", name="criterion_weight"),
        sa.CheckConstraint("position >= 0", name="criterion_position"))
    op.create_table("rating_anchors", identity(), fk("criterion_id", "screening_criteria", nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False), sa.Column("description", sa.Text(), nullable=False), *timestamps(),
        sa.CheckConstraint("rating >= 0 AND rating <= 4", name="anchor_rating"))
    for table, key in [("vacancy_configurations", "vacancy_id"), ("eligibility_rules", "configuration_id"),
                       ("screening_criteria", "configuration_id"), ("rating_anchors", "criterion_id")]:
        op.create_index(f"ix_{table}_{key}", table, [key])
        op.create_index(f"ix_{table}_deleted_at", table, ["deleted_at"])
    # Existing IDs/titles/assignments/applications remain untouched; archived rows also get retained drafts.
    op.execute("""INSERT INTO vacancy_configurations (vacancy_id, version, title, deleted_at)
                  SELECT id, 1, title, deleted_at FROM vacancies ORDER BY id""")
    op.execute("""
    CREATE FUNCTION wehire_guard_approved_configuration() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.status = 'approved' THEN
        RAISE EXCEPTION 'Approved configurations are immutable' USING ERRCODE = '23514';
      END IF;
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER guard_approved_configuration BEFORE UPDATE OR DELETE ON vacancy_configurations
      FOR EACH ROW EXECUTE FUNCTION wehire_guard_approved_configuration();
    CREATE FUNCTION wehire_guard_approved_content() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE parent_id integer; previous_id integer; parent_status text;
    BEGIN
      IF TG_TABLE_NAME = 'rating_anchors' THEN
        IF TG_OP <> 'DELETE' THEN SELECT configuration_id INTO parent_id FROM screening_criteria WHERE id = NEW.criterion_id; END IF;
        IF TG_OP <> 'INSERT' THEN SELECT configuration_id INTO previous_id FROM screening_criteria WHERE id = OLD.criterion_id; END IF;
      ELSE
        IF TG_OP <> 'DELETE' THEN parent_id := NEW.configuration_id; END IF;
        IF TG_OP <> 'INSERT' THEN previous_id := OLD.configuration_id; END IF;
      END IF;
      FOR parent_status IN SELECT status FROM vacancy_configurations WHERE id IN (parent_id, previous_id) ORDER BY id FOR UPDATE LOOP
        IF parent_status = 'approved' THEN
          RAISE EXCEPTION 'Approved scorecard contents are immutable' USING ERRCODE = '23514';
        END IF;
      END LOOP;
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END $$;
    """)
    for table in ["eligibility_rules", "screening_criteria", "rating_anchors"]:
        op.execute(f"CREATE TRIGGER guard_approved_content BEFORE INSERT OR UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION wehire_guard_approved_content()")


def downgrade():
    raise RuntimeError("This migration retains approved history. Use a reviewed forward migration; no destructive downgrade is provided.")
