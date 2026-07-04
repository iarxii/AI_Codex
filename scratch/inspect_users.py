import sys
import asyncio
from pathlib import Path
root_path = Path(__file__).resolve().parent.parent
sys.path.append(str(root_path))

from sqlalchemy import select
from backend.db.session import AsyncSessionLocal
from backend.db.models import User

async def main():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        print(f"Total users: {len(users)}")
        for u in users:
            print(f"ID: {u.id} | Username: {u.username} | Role: {u.role}")

if __name__ == "__main__":
    asyncio.run(main())
