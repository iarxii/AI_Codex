import asyncio
from sqlalchemy import text
from backend.db.session import engine

async def check_pgvector():
    print("Checking PostgreSQL connection and pgvector extension...")
    try:
        async with engine.connect() as conn:
            # Check version
            version = await conn.execute(text("SELECT version();"))
            print(f"PostgreSQL Version: {version.scalar()}")
            
            # Check extension
            ext = await conn.execute(text("SELECT extname FROM pg_extension WHERE extname = 'vector';"))
            if ext.scalar():
                print("[OK] pgvector extension is installed.")
            else:
                print("[MISSING] pgvector extension is NOT installed.")
                print("Attempting to install...")
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                await conn.commit()
                print("[OK] pgvector extension installed successfully.")
                
            # Check table
            await conn.execute(text("SELECT '[0,0,0]'::vector(3);"))
            print("[OK] Vector operations are working.")
            
    except Exception as e:
        print(f"[ERROR] {e}")

if __name__ == "__main__":
    asyncio.run(check_pgvector())
