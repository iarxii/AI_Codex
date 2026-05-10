import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import update
from backend.db.models import User
from backend.config import settings
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_admin():
    engine = create_async_engine(settings.async_database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Check if user exists
        from sqlalchemy import select
        result = await session.execute(select(User).where(User.username == "admin_tester"))
        user = result.scalars().first()
        
        if not user:
            print("Creating user admin_tester...")
            user = User(
                username="admin_tester",
                hashed_password=pwd_context.hash("Password123!"),
                email="admin@tester.com",
                full_name="Admin Tester",
                role="super_admin", # Grant super_admin role
                is_active=True
            )
            session.add(user)
        else:
            print("User exists, promoting to super_admin...")
            user.role = "super_admin"
            user.is_active = True
            
        await session.commit()
        print("Success! admin_tester is now a super_admin.")

if __name__ == "__main__":
    asyncio.run(create_admin())
