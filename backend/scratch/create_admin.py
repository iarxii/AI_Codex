import asyncio
from backend.db.session import AsyncSessionLocal, pwd_context
from backend.db.models import User
from sqlalchemy import select

async def create_test_user():
    async with AsyncSessionLocal() as session:
        try:
            # Check if exists
            result = await session.execute(select(User).filter_by(username="admin_tester"))
            user = result.scalar_one_or_none()
            if user:
                print("User exists, promoting...")
                user.role = "super_admin"
            else:
                user = User(
                    username="admin_tester",
                    hashed_password=pwd_context.hash("Admin123!"),
                    first_name="Admin",
                    surname="Tester",
                    role="super_admin",
                    is_active=True
                )
                session.add(user)
            
            await session.commit()
            print("Successfully set up 'admin_tester' as super_admin!")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(create_test_user())
