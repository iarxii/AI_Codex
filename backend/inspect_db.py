import asyncio
from backend.db.session import AsyncSessionLocal
from backend.db.models import User
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        print("--- DATABASE USERS ---")
        for u in users:
            print(f"User: {u.username}, Hash Length: {len(u.hashed_password)}, Hash: {u.hashed_password}")
        print("-----------------------")

if __name__ == "__main__":
    asyncio.run(check())
