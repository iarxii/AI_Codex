import asyncio
from backend.db.session import engine
from sqlalchemy import text

async def migrate():
    async with engine.begin() as conn:
        print("Adding 'role' column to users table...")
        await conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT \'user\''))
        print("Migration complete.")

if __name__ == "__main__":
    asyncio.run(migrate())
