import asyncio
from backend.db.session import AsyncSessionLocal, pwd_context
from backend.db.models import User
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).filter_by(username="admin"))
        user = result.scalar_one_or_none()
        if not user:
            print("Admin not found")
            return
        
        print(f"User: {user.username}")
        print(f"Hash: {user.hashed_password}")
        
        # Test verification
        is_correct = pwd_context.verify("admin123", user.hashed_password)
        print(f"Verify 'admin123': {is_correct}")
        
        # Identify scheme
        try:
            scheme = pwd_context.identify(user.hashed_password)
            print(f"Identified scheme: {scheme}")
        except Exception as e:
            print(f"Identification failed: {e}")

if __name__ == "__main__":
    asyncio.run(check())
