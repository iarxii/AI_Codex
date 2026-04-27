from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from typing import List
from pydantic import BaseModel
from datetime import datetime

from backend.db.session import get_db
from backend.db.models import Conversation, Message, User
from backend.api.auth import get_current_user

router = APIRouter()

class MessageRead(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime
    metadata_json: str | None = None

    class Config:
        from_attributes = True

class ConversationRead(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ConversationDetail(ConversationRead):
    messages: List[MessageRead]

class ConversationCreate(BaseModel):
    title: str = "New Conversation"

@router.get("/", response_model=List[ConversationRead])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Conversation)
        .filter_by(user_id=current_user.id)
        .order_by(desc(Conversation.updated_at))
    )
    return result.scalars().all()

@router.post("/", response_model=ConversationRead)
async def create_conversation(
    conv_in: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    new_conv = Conversation(
        title=conv_in.title,
        user_id=current_user.id
    )
    db.add(new_conv)
    await db.commit()
    await db.refresh(new_conv)
    return new_conv

@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .filter_by(id=conversation_id, user_id=current_user.id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return conv

class ConversationUpdate(BaseModel):
    title: str

@router.put("/{conversation_id}", response_model=ConversationRead)
async def update_conversation(
    conversation_id: int,
    conv_in: ConversationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Conversation)
        .filter_by(id=conversation_id, user_id=current_user.id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conv.title = conv_in.title
    await db.commit()
    await db.refresh(conv)
    return conv

@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Conversation)
        .filter_by(id=conversation_id, user_id=current_user.id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    await db.delete(conv)
    await db.commit()
    return {"message": "Conversation deleted"}
