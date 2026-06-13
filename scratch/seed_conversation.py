import sys
import asyncio
import re
from pathlib import Path
from datetime import datetime

root_path = Path(__file__).resolve().parent.parent
sys.path.append(str(root_path))

from sqlalchemy import select
from backend.db.session import AsyncSessionLocal
from backend.db.models import User, Conversation, Message

def parse_markdown(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    pattern = r'(### User|### Spirit Bird)'
    parts = re.split(pattern, content)
    
    messages = []
    current_role = None
    
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if part == '### User':
            current_role = 'user'
        elif part == '### Spirit Bird':
            current_role = 'assistant'
        else:
            if current_role:
                messages.append({
                    'role': current_role,
                    'content': part
                })
    return messages

async def seed_for_user(session, user, parsed_messages):
    # Check if a seeded conversation already exists to avoid duplication
    title = "Spirit Bird Chat Reference (v1.1.0)"
    result = await session.execute(
        select(Conversation).filter_by(user_id=user.id, title=title)
    )
    existing_conv = result.scalar_one_or_none()
    if existing_conv:
        print(f"Conversation already seeded for user '{user.username}' (ID: {user.id}). Skipping.")
        return

    # Create new Conversation
    conv = Conversation(
        title=title,
        user_id=user.id,
        space_type="code-lab",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    session.add(conv)
    await session.flush() # Populate conv.id

    # Add all messages
    for msg_data in parsed_messages:
        msg = Message(
            conversation_id=conv.id,
            role=msg_data['role'],
            content=msg_data['content'],
            created_at=datetime.utcnow()
        )
        session.add(msg)
    
    print(f"Successfully seeded conversation (ID: {conv.id}) with {len(parsed_messages)} messages for user '{user.username}'.")

async def main():
    md_file = root_path / "vscode-extension" / "docs" / "testing" / "spirit-bird-chat_20260612.md"
    if not md_file.exists():
        print(f"Error: Markdown file not found at {md_file}")
        return
        
    print(f"Parsing {md_file}...")
    parsed_messages = parse_markdown(md_file)
    print(f"Parsed {len(parsed_messages)} messages.")

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        
        for user in users:
            await seed_for_user(session, user, parsed_messages)
        
        await session.commit()
    print("Database seeding complete!")

if __name__ == "__main__":
    asyncio.run(main())
