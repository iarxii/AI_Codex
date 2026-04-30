import asyncio
from backend.db.session import AsyncSessionLocal, pwd_context
from backend.db.models import User
from sqlalchemy import select

async def create_test_user():
    async with AsyncSessionLocal() as session:
        try:
            # Check if exists
            result = await session.execute(select(User).filter_by(username="tester"))
            if result.scalar_one_or_none():
                print("Tester user already exists.")
                return
            
            user = User(
                username="tester",
                hashed_password=pwd_context.hash("tester123"),
                is_active=True
            )
            session.add(user)
            await session.commit()
            print("Successfully created 'tester' user!")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(create_test_user())
