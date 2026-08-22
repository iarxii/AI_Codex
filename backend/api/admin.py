from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from backend.db.session import get_db, pwd_context
from backend.db.models import User, CodexSpace, CodexSpaceAccess
from backend.api.auth import get_current_user

router = APIRouter()

# Dependency to check if user is an admin
async def get_current_admin(current_user: Annotated[User, Depends(get_current_user)]):
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have enough privileges"
        )
    return current_user

class UserUpdate(BaseModel):
    is_active: bool | None = None
    role: str | None = None

class UserAdminResponse(BaseModel):
    id: int
    username: str
    first_name: str | None
    surname: str | None
    role: str
    is_active: bool
    created_at: str

@router.get("/users", response_model=List[UserAdminResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    result = await db.execute(select(User).order_by(User.id))
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "first_name": u.first_name,
            "surname": u.surname,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat()
        } for u in users
    ]

@router.patch("/users/{user_id}", response_model=UserAdminResponse)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    result = await db.execute(select(User).filter_by(id=user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent changing roles of super_admins unless you are one
    if user.role == "super_admin" and admin.role != "super_admin":
        raise HTTPException(status_code=403, detail="Cannot modify a super admin")

    if user_update.is_active is not None:
        user.is_active = user_update.is_active
    
    if user_update.role is not None:
        # Validate role
        if user_update.role not in ["user", "admin", "super_admin"]:
            raise HTTPException(status_code=400, detail="Invalid role")
        
        # Only super_admins can create other admins/super_admins
        if admin.role != "super_admin" and user_update.role in ["admin", "super_admin"]:
             raise HTTPException(status_code=403, detail="Only super admins can promote users to admin")
             
        user.role = user_update.role

    await db.commit()
    await db.refresh(user)
    
    return {
        "id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "surname": user.surname,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat()
    }

@router.delete("/users/{user_id}", response_model=dict)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    result = await db.execute(select(User).filter_by(id=user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Only super_admins can delete users
    if admin.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can delete users")
        
    # Prevent self-deletion
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    await db.delete(user)
    await db.commit()
    
    return {"message": f"User {user.username} deleted successfully"}

@router.post("/users/{user_id}/reset-password")
async def reset_password(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    result = await db.execute(select(User).filter_by(id=user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.role == "super_admin" and admin.role != "super_admin":
        raise HTTPException(status_code=403, detail="Cannot reset password for super admin")

    # Hardcoded reset for now (in a real app, generate a temp pass or email link)
    temp_pass = "Reset123!"
    user.hashed_password = pwd_context.hash(temp_pass)
    await db.commit()
    
    return {"message": "Password reset successfully"}

# Space Admin Models
class SpaceCreate(BaseModel):
    slug: str
    name: str
    description: str
    icon: str | None = None
    color: str | None = None
    is_public: bool = False
    required_role: str = "user"
    capacity: int = 5
    config_json: str | None = None
    harness: str | None = None  # e.g. fintrader | gemma-sandbox | microsoft-agent | spirit-book-chat

class SpaceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    is_active: bool | None = None
    is_public: bool | None = None
    required_role: str | None = None
    capacity: int | None = None
    config_json: str | None = None
    harness: str | None = None

class SpaceAccessGrant(BaseModel):
    user_id: int

@router.post("/spaces", response_model=dict)
async def create_space(
    payload: SpaceCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    # Delegate validation + filesystem mechanics to codex_spaces submodule
    from codex_spaces.backend.space_scaffold import (
        validate_slug, validate_harness, build_config_json,
        scaffold_space_files, register_space_config, sync_spaces_to_gcs
    )
    import json as _json

    # Normalize slug
    raw_slug = payload.slug.strip().lower()
    try:
        validate_slug(raw_slug)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Validate harness
    harness = payload.harness.strip() if payload.harness else None
    if harness == "":
        harness = None
    try:
        validate_harness(harness)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Build canonical config_json (merges harness defaults + raw JSON)
    try:
        canonical_config_json = build_config_json(harness, payload.config_json)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Validate config_json is not silently invalid harness mismatch
    if canonical_config_json:
        try:
            _json.loads(canonical_config_json)
        except Exception:
            raise HTTPException(status_code=400, detail="config_json must be valid JSON")

    result = await db.execute(select(CodexSpace).filter_by(slug=raw_slug))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Space slug already exists")

    # Validate required_role / capacity
    if payload.required_role not in ("user", "admin", "super_admin"):
        raise HTTPException(status_code=400, detail="required_role must be user|admin|super_admin")
    if not (1 <= payload.capacity <= 100):
        raise HTTPException(status_code=400, detail="capacity must be 1..100")

    space = CodexSpace(
        slug=raw_slug,
        name=payload.name.strip(),
        description=payload.description.strip(),
        icon=payload.icon,
        color=payload.color,
        is_public=payload.is_public,
        required_role=payload.required_role,
        capacity=payload.capacity,
        config_json=canonical_config_json,
    )
    db.add(space)
    await db.commit()
    await db.refresh(space)

    # Filesystem scaffold + in-memory registry + GCS sync (best-effort, never block creation)
    try:
        scaffold_space_files(raw_slug, payload.name.strip(), payload.description.strip(), payload.icon, payload.color, canonical_config_json)
    except Exception as e:
        print(f"[ADMIN] scaffold_space_files failed for {raw_slug}: {e}")
    try:
        register_space_config(raw_slug, canonical_config_json)
    except Exception as e:
        print(f"[ADMIN] register_space_config failed for {raw_slug}: {e}")
    try:
        # Fire-and-forget GCS sync; don't await blocking I/O inside request if possible, but keep simple for now
        sync_spaces_to_gcs(raw_slug)
    except Exception as e:
        print(f"[ADMIN] sync_spaces_to_gcs warning for {raw_slug}: {e}")

    return {"message": "Space created successfully", "space_id": space.id, "slug": raw_slug, "config_json": canonical_config_json}

@router.patch("/spaces/{space_id}", response_model=dict)
async def update_space(
    space_id: int,
    payload: SpaceUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    result = await db.execute(select(CodexSpace).filter_by(id=space_id))
    space = result.scalar_one_or_none()
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    # Handle harness+config_json merge if either provided
    updates = payload.model_dump(exclude_unset=True)
    if "harness" in updates or "config_json" in updates:
        from codex_spaces.backend.space_scaffold import validate_harness, build_config_json, register_space_config
        harness = updates.pop("harness", None)
        raw_cfg = updates.get("config_json", space.config_json)
        # If harness explicitly passed (even None to clear), validate
        if "harness" in payload.model_fields_set:
            h = harness.strip() if isinstance(harness, str) and harness.strip() != "" else None
            try:
                validate_harness(h)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
            harness = h
        else:
            harness = None
            # Preserve existing harness from DB if not overriding
            try:
                import json as _j
                existing = _j.loads(space.config_json) if space.config_json else {}
                harness = existing.get("harness")
            except Exception:
                harness = None
        try:
            canonical = build_config_json(harness, raw_cfg if isinstance(raw_cfg, str) else None)
            updates["config_json"] = canonical
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    for key, value in updates.items():
        setattr(space, key, value)
        
    await db.commit()
    # Re-register in-memory config if config_json changed
    if "config_json" in updates:
        try:
            from codex_spaces.backend.space_scaffold import register_space_config
            register_space_config(space.slug, space.config_json)
        except Exception as e:
            print(f"[ADMIN] register_space_config on update failed for {space.slug}: {e}")
    return {"message": "Space updated successfully"}

@router.post("/spaces/{space_id}/access", response_model=dict)
async def grant_space_access(
    space_id: int,
    payload: SpaceAccessGrant,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    # Verify space
    space_res = await db.execute(select(CodexSpace).filter_by(id=space_id))
    if not space_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Space not found")
        
    # Verify user
    user_res = await db.execute(select(User).filter_by(id=payload.user_id))
    if not user_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")
        
    # Check existing
    access_res = await db.execute(select(CodexSpaceAccess).filter_by(space_id=space_id, user_id=payload.user_id))
    if access_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User already has access to this space")
        
    access = CodexSpaceAccess(
        space_id=space_id,
        user_id=payload.user_id,
        granted_by=admin.id
    )
    db.add(access)
    await db.commit()
    return {"message": "Access granted successfully"}

@router.delete("/spaces/{space_id}/access/{user_id}", response_model=dict)
async def revoke_space_access(
    space_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    access_res = await db.execute(select(CodexSpaceAccess).filter_by(space_id=space_id, user_id=user_id))
    access = access_res.scalar_one_or_none()
    if not access:
        raise HTTPException(status_code=404, detail="Access record not found")
        
    await db.delete(access)
    await db.commit()
    return {"message": "Access revoked successfully"}


@router.delete("/spaces/{space_id}", response_model=dict)
async def delete_space(
    space_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    # RBAC: only super_admin can delete spaces (prevents admin accidental deletion of production labs)
    if admin.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super_admins can delete spaces")
    result = await db.execute(select(CodexSpace).filter_by(id=space_id))
    space = result.scalar_one_or_none()
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    # Protect built-in spaces from deletion
    if space.slug in ("general", "trading-space", "code-lab"):
        raise HTTPException(status_code=400, detail=f"Protected space '{space.slug}' cannot be deleted (deactivate instead)")
    await db.delete(space)
    # Also cascade delete related access rows
    access_res = await db.execute(select(CodexSpaceAccess).filter_by(space_id=space_id))
    for acc in access_res.scalars().all():
        await db.delete(acc)
    await db.commit()
    # Best-effort filesystem + GCS cleanup via codex_spaces scaffold helper
    try:
        from backend.config import SPACES_DIR
        import shutil
        space_dir = SPACES_DIR / space.slug
        if space_dir.exists():
            shutil.rmtree(space_dir, ignore_errors=True)
            print(f"[ADMIN] Deleted space dir {space_dir}")
    except Exception as e:
        print(f"[ADMIN] Warning: failed to clean space dir for {space.slug}: {e}")
    # Hot-unregister from SPACE_CONFIGS
    try:
        from codex_spaces.backend.agent.space_config import SPACE_CONFIGS
        SPACE_CONFIGS.pop(space.slug, None)
        print(f"[ADMIN] Unregistered SPACE_CONFIGS['{space.slug}']")
    except Exception:
        pass
    # Sync DB to GCS
    try:
        from codex_spaces.backend.space_scaffold import sync_spaces_to_gcs
        sync_spaces_to_gcs()
    except Exception as e:
        print(f"[ADMIN] GCS sync warning after delete: {e}")
    return {"message": f"Space '{space.slug}' deleted successfully"}


@router.get("/spaces/{space_id}/access", response_model=dict)
async def list_space_access(
    space_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    space_res = await db.execute(select(CodexSpace).filter_by(id=space_id))
    space = space_res.scalar_one_or_none()
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    access_res = await db.execute(select(CodexSpaceAccess).filter_by(space_id=space_id))
    accesses = access_res.scalars().all()
    # Enrich with usernames
    result = []
    for acc in accesses:
        user_res = await db.execute(select(User).filter_by(id=acc.user_id))
        user = user_res.scalar_one_or_none()
        result.append({
            "access_id": acc.id,
            "user_id": acc.user_id,
            "username": user.username if user else "unknown",
            "granted_at": acc.granted_at.isoformat() if acc.granted_at else None,
            "granted_by": acc.granted_by,
        })
    return {"space_id": space_id, "slug": space.slug, "access": result}
