import asyncio
from backend.db.session import AsyncSessionLocal
from backend.db.models import User
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(User))
        users = res.scalars().all()
        print("--- REGISTERED USERS ---")
        for u in users:
            print(f"Username: {u.username}")
            print(f"Name: {u.first_name} {u.surname}")
            print(f"Profession: {u.profession}")
            print(f"Settings: {u.settings_json[:50] if u.settings_json else 'None'}")
            print("-" * 20)

if __name__ == "__main__":
    asyncio.run(check())
