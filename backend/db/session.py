from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from .models import Base, User
from backend.config import settings
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

engine = create_async_engine(settings.async_database_url)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def init_db():
    try:
        async with engine.begin() as conn:
            # Create pgvector extension if it doesn't exist (only for Postgres)
            if settings.DB_TYPE == "postgres":
                from sqlalchemy import text
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            
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
    except Exception as e:
        print(f"Warning: Database initialization failed. Server starting without DB connectivity. Error: {e}")

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
