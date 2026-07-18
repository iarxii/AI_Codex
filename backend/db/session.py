from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from .models import Base, User, ArcadeScore
from sqlalchemy import select
from backend.config import settings
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

engine = create_async_engine(settings.async_database_url)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

# SQLite pragmas for performance and robustness against locked/full disk errors
from sqlalchemy import event
@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if settings.DB_TYPE == "sqlite":
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA temp_store=MEMORY")
            cursor.execute("PRAGMA synchronous=NORMAL")
        except Exception as e:
            print(f"[DB] Failed to set SQLite pragmas: {e}")
        finally:
            cursor.close()

async def migrate_db(conn):
    """Simple migration to add missing columns to users table for SQLite."""
    if settings.DB_TYPE != "sqlite":
        return

    from sqlalchemy import text
    result = await conn.execute(text("PRAGMA table_info(users)"))
    rows = result.fetchall()
    existing_columns = {row[1] for row in rows}
    print(f"[MIGRATION] Found existing columns in 'users': {existing_columns}")
    
    required_columns = {
        "email": "VARCHAR(150)",
        "phone": "VARCHAR(50)",
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

    result = await conn.execute(text("PRAGMA table_info(conversations)"))
    existing_columns_conv = {row[1] for row in result.fetchall()}
    if "space_type" not in existing_columns_conv:
        print("[MIGRATION] Adding column space_type to conversations table...")
        await conn.execute(text("ALTER TABLE conversations ADD COLUMN space_type VARCHAR(50) DEFAULT 'general'"))
        
    if "session_id" not in existing_columns_conv:
        print("[MIGRATION] Adding column session_id to conversations table...")
        await conn.execute(text("ALTER TABLE conversations ADD COLUMN session_id VARCHAR(100)"))
        try:
            await conn.execute(text("CREATE UNIQUE INDEX ix_conversations_session_id ON conversations(session_id)"))
        except Exception:
            pass

    # -- Invoicing tables (create_all handles new tables; migrate any missing cols here) --
    for inv_table, inv_cols in {
        "invoice_clients": {
            "owner_id": "INTEGER",
            "name": "VARCHAR(150)",
            "company": "VARCHAR(150)",
            "email": "VARCHAR(150)",
            "phone": "VARCHAR(50)",
            "billing_address": "TEXT",
            "vat_number": "VARCHAR(50)",
            "is_deleted": "BOOLEAN DEFAULT 0",
            "created_at": "DATETIME",
        },
        "invoices": {
            "share_token": "VARCHAR(64)",
            "paid_at": "DATETIME",
            "notes": "TEXT",
        },
        "invoice_items": {
            "sort_order": "INTEGER DEFAULT 0",
        },
        "invoice_payments": {
            "reference": "VARCHAR(120)",
        },
    }.items():
        try:
            result = await conn.execute(text(f"PRAGMA table_info({inv_table})"))
            rows = result.fetchall()
            if not rows:
                # Table doesn't exist yet — create_all will handle it on next run
                continue
            existing_inv_cols = {row[1] for row in rows}
            for col, col_def in inv_cols.items():
                if col not in existing_inv_cols:
                    print(f"[MIGRATION] Adding column {col} to {inv_table}...")
                    await conn.execute(text(f"ALTER TABLE {inv_table} ADD COLUMN {col} {col_def}"))
        except Exception as e:
            print(f"[MIGRATION] Warning: invoicing migration for {inv_table}: {e}")

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
            # Admin seeding is disabled for production security. 
            # Use established Administrator accounts (e.g. nexus-architect).
            
            # Seed Spaces (Independent of SEED_ADMIN to ensure catalog availability)
            from backend.db.models import CodexSpace
            spaces_to_seed = [
                {"slug": "general", "name": "General", "description": "Default workspace", "is_public": True},
                {"slug": "trading-space", "name": "Financial Trading Space", "description": "AI trading debate room", "is_public": False, "icon": "ChartBarIcon", "config_json": '{"premium": true}'},
                {"slug": "code-lab", "name": "Code Lab (Gemma 4)", "description": "Specialized coding environment optimized for the Gemma 4 family with MTP acceleration.", "is_public": False, "icon": "CodeBracketIcon", "config_json": '{"premium": true}'}
            ]
            for space_data in spaces_to_seed:
                result = await session.execute(select(CodexSpace).filter_by(slug=space_data["slug"]))
                existing_space = result.scalar_one_or_none()
                if not existing_space:
                    new_space = CodexSpace(**space_data)
                    session.add(new_space)
                    print(f"Seeded new space: {space_data['slug']}")
                else:
                    # Update existing space metadata
                    for key, value in space_data.items():
                        setattr(existing_space, key, value)
                    print(f"Updated existing space: {space_data['slug']}")
            
            await session.commit()
    except Exception as e:
        print(f"Warning: Database initialization failed. Server starting without DB connectivity. Error: {e}")

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
