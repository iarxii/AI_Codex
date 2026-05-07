from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
from backend.db.session import get_db
from backend.api.auth import get_current_user
from backend.db.models import User

router = APIRouter()

class ProfileUpdate(BaseModel):
    title: Optional[str] = None
    first_name: Optional[str] = None
    surname: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    pronouns: Optional[str] = None
    country: Optional[str] = None
    profession: Optional[str] = None

class SettingsUpdate(BaseModel):
    settings_json: str

@router.put("/profile")
async def update_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if data.title is not None: current_user.title = data.title
    if data.first_name is not None: current_user.first_name = data.first_name
    if data.surname is not None: current_user.surname = data.surname
    if data.gender is not None: current_user.gender = data.gender
    if data.pronouns is not None: current_user.pronouns = data.pronouns
    if data.country is not None: current_user.country = data.country
    if data.profession is not None: current_user.profession = data.profession
    
    if data.dob:
        from datetime import datetime
        try:
            current_user.dob = datetime.fromisoformat(data.dob.replace('Z', '+00:00'))
        except ValueError:
            pass
            
    await db.commit()
    return {"status": "success"}

@router.put("/settings")
async def update_settings(
    data: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    current_user.settings_json = data.settings_json
    await db.commit()
    return {"status": "success"}
