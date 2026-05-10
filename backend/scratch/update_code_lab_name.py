import asyncio
import os
import sys

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from sqlalchemy import select, update
from backend.db.session import AsyncSessionLocal
from backend.db.models import CodexSpace

async def update_space_name():
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(select(CodexSpace).filter_by(slug="code-lab"))
            space = result.scalar_one_or_none()
            if space:
                space.name = "Gemma 4 Code Lab"
                space.description = "Specialized coding environment optimized for the Gemma 4 family with MTP acceleration."
                await session.commit()
                print("Successfully updated Code Lab to Gemma 4 Code Lab in database.")
            else:
                print("Space with slug 'code-lab' not found.")
        except Exception as e:
            print(f"Error updating database: {e}")

if __name__ == "__main__":
    asyncio.run(update_space_name())
