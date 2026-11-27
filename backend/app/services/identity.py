from sqlalchemy import select

from app.models import Role, UserRole

ROLES = {"hr", "hiring_manager", "candidate"}


def add_role(db, user, name):
    if name not in ROLES or not user.is_active or user.deleted_at is not None:
        raise ValueError("Choose a valid role and an active account.")
    # Preserve the candidate/staff account boundary even after a role is archived.
    history = set(db.scalars(select(Role.name).join(UserRole).where(
        UserRole.user_id == user.id,
    ).execution_options(include_deleted=True)))
    if history and ((name == "candidate") != ("candidate" in history)):
        raise ValueError("Candidate and staff roles must use separate accounts.")
    role = db.scalar(select(Role).where(Role.name == name))
    if role is None:
        raise ValueError("Apply migrations and use a non-deleted role.")
    link = db.scalar(select(UserRole).where(UserRole.user_id == user.id, UserRole.role_id == role.id).execution_options(include_deleted=True))
    if link:
        link.deleted_at = None
    else:
        db.add(UserRole(user_id=user.id, role_id=role.id))

