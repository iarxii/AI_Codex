from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from backend.db.session import get_db, pwd_context
from backend.db.models import User
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
    
    return {"message": f"Password reset to '{temp_pass}'"}
