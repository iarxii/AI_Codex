from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc
from typing import List
from pydantic import BaseModel
from datetime import datetime

from backend.db.session import get_db
from backend.db.models import CodexSpace, CodexSpaceAccess, User, Conversation, Message
from backend.api.auth import get_current_user
from backend.api.conversations import ConversationRead
from backend.agent.space_config import get_space_config

router = APIRouter()

class SpaceRead(BaseModel):
    id: int
    slug: str
    name: str
    description: str
    icon: str | None
    color: str | None
    is_public: bool
    capacity: int
    config_json: str | None
    recommended_provider: str | None = None
    recommended_model: str | None = None

    class Config:
        from_attributes = True

class SpaceConversationRead(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    space_type: str
    space_name: str | None = None
    message_count: int = 0

    class Config:
        from_attributes = True

@router.get("/", response_model=List[SpaceRead])
async def list_accessible_spaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # All users can preview all active spaces
    stmt = select(CodexSpace).where(CodexSpace.is_active == True)
        
    result = await db.execute(stmt)
    spaces = result.scalars().unique().all()

    
    # Inject recommendations
    for s in spaces:
        s_config = get_space_config(s.slug)
        s.recommended_provider = s_config.get("recommended_provider")
        s.recommended_model = s_config.get("recommended_model")
        
    return spaces

@router.get("/{slug}", response_model=SpaceRead)
async def get_space(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(CodexSpace).filter_by(slug=slug, is_active=True))
    space = result.scalar_one_or_none()
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
        
    is_admin = current_user.role in ["admin", "super_admin"]
    if not is_admin and not space.is_public:
        access = await db.execute(select(CodexSpaceAccess).filter_by(space_id=space.id, user_id=current_user.id))
        if not access.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Access denied to this space")
            
    # Inject recommendations
    s_config = get_space_config(space.slug)
    space.recommended_provider = s_config.get("recommended_provider")
    space.recommended_model = s_config.get("recommended_model")
    
    return space

class SpaceConversationCreate(BaseModel):
    title: str = "New Conversation"

@router.post("/{slug}/conversations", response_model=ConversationRead)
async def create_space_conversation(
    slug: str,
    payload: SpaceConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(CodexSpace).filter_by(slug=slug, is_active=True))
    space = result.scalar_one_or_none()
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
        
    is_admin = current_user.role in ["admin", "super_admin"]
    
    # Exclusive Spaces Rule:
    # Only SpiritBook is accessible to standard users. All other specialized spaces are Exclusive.
    is_exclusive = slug not in ["spirit-book", "general"]
    
    if is_exclusive and not is_admin:
        raise HTTPException(
            status_code=403, 
            detail="Access denied to this Exclusive Space. A donation is required to unlock."
        )
            
    new_conv = Conversation(
        title=payload.title,
        user_id=current_user.id,
        space_type=space.slug
    )
    db.add(new_conv)
    await db.commit()
    await db.refresh(new_conv)
    return new_conv

@router.get("/{slug}/conversations", response_model=List[ConversationRead])
async def list_space_conversations(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(CodexSpace).filter_by(slug=slug, is_active=True))
    space = result.scalar_one_or_none()
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
        
    is_admin = current_user.role in ["admin", "super_admin"]
    
    is_exclusive = slug not in ["spirit-book", "general"]
    if is_exclusive and not is_admin:
        raise HTTPException(
            status_code=403, 
            detail="Access denied to this Exclusive Space. A donation is required to unlock."
        )

    result = await db.execute(
        select(Conversation)
        .filter_by(user_id=current_user.id, space_type=slug)
        .order_by(desc(Conversation.updated_at))
    )
    return result.scalars().all()

@router.get("/conversations/all", response_model=List[SpaceConversationRead])
async def list_all_space_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import func
    
    # Subquery for message count
    msg_count_subquery = (
        select(Message.conversation_id, func.count(Message.id).label("message_count"))
        .group_by(Message.conversation_id)
        .subquery()
    )
    
    stmt = (
        select(
            Conversation,
            CodexSpace.name.label("space_name"),
            func.coalesce(msg_count_subquery.c.message_count, 0).label("message_count")
        )
        .join(CodexSpace, Conversation.space_type == CodexSpace.slug)
        .outerjoin(msg_count_subquery, Conversation.id == msg_count_subquery.c.conversation_id)
        .where(and_(Conversation.user_id == current_user.id, Conversation.space_type != "general"))
        .order_by(desc(Conversation.updated_at))
    )
    
    result = await db.execute(stmt)
    rows = result.all()
    
    output = []
    for conv, space_name, message_count in rows:
        # We manually map because row objects don't automatically convert to pydantic with relationships well in this custom select
        output.append(SpaceConversationRead(
            id=conv.id,
            title=conv.title,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            space_type=conv.space_type,
            space_name=space_name,
            message_count=message_count
        ))
        
    return output
