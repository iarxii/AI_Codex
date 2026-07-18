"""
promote_business_owner.py
=========================
Grants the 'business_owner' role to an existing user in the AI_Codex database.
Run this once after deployment to enable invoicing access for the intended account.

Usage:
    python promote_business_owner.py <username>

Example:
    python promote_business_owner.py nexus-architect

The script reads .env from backend/.env (same as the FastAPI app).
"""

import asyncio
import sys
from pathlib import Path

# Allow running from repo root
sys.path.insert(0, str(Path(__file__).parent))

from backend.config import settings  # noqa: E402 — needs sys.path insert first
from backend.db.session import AsyncSessionLocal  # noqa: E402
from backend.db.models import User  # noqa: E402
from sqlalchemy import select  # noqa: E402


async def promote(username: str):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).filter_by(username=username))
        user = result.scalar_one_or_none()

        if not user:
            print(f"[ERROR] User '{username}' not found in the database.")
            return

        old_role = user.role
        if old_role == "business_owner":
            print(f"[INFO] '{username}' already has role 'business_owner'. No change needed.")
            return

        user.role = "business_owner"
        await session.commit()
        print(f"[OK] '{username}' promoted from '{old_role}' → 'business_owner'.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python promote_business_owner.py <username>")
        sys.exit(1)

    asyncio.run(promote(sys.argv[1]))
