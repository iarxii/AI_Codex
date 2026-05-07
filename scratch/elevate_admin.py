import asyncio
from backend.db.session import AsyncSessionLocal
from backend.db.models import User
from sqlalchemy import update

async def fix():
    async with AsyncSessionLocal() as session:
        print("Elevating 'admin' to 'super_admin'...")
        res = await session.execute(
            update(User)
            .where(User.username == 'admin')
            .values(role='super_admin')
        )
        await session.commit()
        print(f"Updated {res.rowcount} rows.")

if __name__ == "__main__":
    asyncio.run(fix())
