import asyncio
from backend.db.session import engine
from sqlalchemy import text

async def migrate():
    async with engine.begin() as conn:
        print("Migrating users table...")
        await conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS title VARCHAR(20)'))
        await conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)'))
        await conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS surname VARCHAR(100)'))
        await conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS dob TIMESTAMP'))
        await conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(50)'))
        await conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS pronouns VARCHAR(50) DEFAULT \'Prefer not to say\''))
        await conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100)'))
        await conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS profession VARCHAR(100)'))
        await conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS settings_json TEXT'))
        print("Migration complete.")

if __name__ == "__main__":
    asyncio.run(migrate())
