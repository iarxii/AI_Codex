from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from .models import Base, User
from backend.config import settings
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

engine = create_async_engine(settings.async_database_url)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def migrate_db(conn):
    """Simple migration to add missing columns to users table for SQLite."""
    if settings.DB_TYPE != "sqlite":
        return

    from sqlalchemy import text
    result = await conn.execute(text("PRAGMA table_info(users)"))
    existing_columns = {row[1] for row in result.fetchall()}
    
    required_columns = {
        "title": "VARCHAR(20)",
        "first_name": "VARCHAR(100)",
        "surname": "VARCHAR(100)",
        "dob": "DATETIME",
        "gender": "VARCHAR(50)",
        "pronouns": "VARCHAR(50) DEFAULT 'Prefer not to say'",
        "country": "VARCHAR(100)",
        "profession": "VARCHAR(100)",
        "role": "VARCHAR(20) DEFAULT 'user'",
        "settings_json": "TEXT"
    }
    
    for col, col_definition in required_columns.items():
        if col not in existing_columns:
            print(f"[MIGRATION] Adding column {col} to users table...")
            await conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_definition}"))

async def init_db():
    try:
        async with engine.begin() as conn:
            # Create pgvector extension if it doesn't exist (only for Postgres)
            if settings.DB_TYPE == "postgres":
                from sqlalchemy import text
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            
            # await conn.run_sync(Base.metadata.drop_all) # Careful in prod
            await conn.run_sync(Base.metadata.create_all)
            
            # Run manual migrations for SQLite
            await migrate_db(conn)
            
        async with AsyncSessionLocal() as session:
            # Seed admin user if not exists
            from sqlalchemy import select
            if settings.SEED_ADMIN:
                result = await session.execute(select(User).filter_by(username="admin"))
                existing_admin = result.scalar_one_or_none()
                if not existing_admin:
                    admin_user = User(
                        username="admin",
                        hashed_password=pwd_context.hash("admin123"),
                        role="super_admin"
                    )
                    session.add(admin_user)
                    print("Seeded admin user (admin / admin123)")
                else:
                    existing_admin.hashed_password = pwd_context.hash("admin123")
                    print("Updated existing admin user password hash")
                await session.commit()
    except Exception as e:
        print(f"Warning: Database initialization failed. Server starting without DB connectivity. Error: {e}")

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
