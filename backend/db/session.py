from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from .models import Base, User
from backend.config import settings
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def init_db():
    async with engine.begin() as conn:
        # await conn.run_sync(Base.metadata.drop_all) # Careful in prod
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as session:
        # Seed admin user if not exists
        from sqlalchemy import select
        result = await session.execute(select(User).filter_by(username="admin"))
        if not result.scalar_one_or_none():
            admin_user = User(
                username="admin",
                hashed_password=pwd_context.hash("admin123")
            )
            session.add(admin_user)
            await session.commit()
            print("Seeded admin user (admin / admin123)")

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
