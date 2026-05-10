import asyncio
import json
import os
import sys

# Ensure backend is in path
sys.path.append(os.getcwd())

from backend.db.session import AsyncSessionLocal
from backend.db.models import CodexSpace
from sqlalchemy import select

async def seed():
    async with AsyncSessionLocal() as session:
        # 1. Update existing "Trading Space" to "FinTrader Analytics Lab"
        result = await session.execute(select(CodexSpace).filter_by(slug="trading-space"))
        trading = result.scalar_one_or_none()
        if trading:
            trading.name = "FinTrader Analytics Lab"
            trading.icon = "/media/AICode_FinTrader_Grad_Logo.png"
            trading.color = "#10b981"
            trading.config_json = json.dumps({"is_gpu_enabled": True})
            print("Updated Trading Space -> FinTrader Analytics Lab (Official Logo)")
        else:
            # Create if not exists
            new_trading = CodexSpace(
                slug="trading-space",
                name="FinTrader Analytics Lab",
                description="Real-time market analysis and financial sentiment tracking engine.",
                icon="/media/brand-icons/fintrader-lab.svg",
                color="#10b981",
                is_active=True,
                is_public=True,
                capacity=5,
                config_json=json.dumps({"is_gpu_enabled": True})
            )
            session.add(new_trading)
            print("Created FinTrader Analytics Lab")
        
        # 2. Update Gemma Code Lab
        result = await session.execute(select(CodexSpace).filter_by(slug="code-lab"))
        gemma = result.scalar_one_or_none()
        if gemma:
            gemma.icon = "/media/brand-icons/gemma.svg"
            gemma.color = "#446EFF"
            gemma.config_json = json.dumps({"is_gpu_enabled": True})
            print("Updated Gemma Code Lab icon and GPU status")
        else:
            new_gemma = CodexSpace(
                slug="code-lab",
                name="Gemma Code Lab",
                description="High-performance coding assistant powered by Google's Gemma 4.",
                icon="/media/brand-icons/gemma.svg",
                color="#446EFF",
                is_active=True,
                is_public=True,
                capacity=10,
                config_json=json.dumps({"is_gpu_enabled": True})
            )
            session.add(new_gemma)
            print("Created Gemma Code Lab")

        # 3. Add Placeholders (Coming Soon)
        placeholders = [
            {
                "slug": "health-tech",
                "name": "HealthTech Soft Lab",
                "description": "Specialized environment for healthcare data analysis and medical research assistance. (Coming Soon)",
                "icon": "AcademicCapIcon",
                "color": "#ef4444",
                "is_active": True,
                "is_public": True,
                "config_json": json.dumps({"is_gpu_enabled": False, "status": "coming-soon"})
            },
            {
                "slug": "art-gen",
                "name": "ArtGen Design Lab",
                "description": "Creative space for prompt engineering, UI/UX conceptualization and aesthetic exploration. (Coming Soon)",
                "icon": "SparklesIcon",
                "color": "#f59e0b",
                "is_active": True,
                "is_public": True,
                "config_json": json.dumps({"is_gpu_enabled": False, "status": "coming-soon"})
            },
            {
                "slug": "spirit-book",
                "name": "SpiritBook",
                "description": "Advanced conversational model for writing, copywriting and linguistic analysis. Future support for Audio Gen. (Coming Soon)",
                "icon": "/media/aicodex-spirit-bird-white.png",
                "color": "#6366f1",
                "is_active": True,
                "is_public": True,
                "config_json": json.dumps({"is_gpu_enabled": True, "status": "coming-soon"})
            }
        ]

        for p in placeholders:
            res = await session.execute(select(CodexSpace).filter_by(slug=p["slug"]))
            existing = res.scalar_one_or_none()
            if not existing:
                session.add(CodexSpace(**p))
                print(f"Added Placeholder: {p['name']}")
            else:
                for key, value in p.items():
                    setattr(existing, key, value)
                print(f"Updated Placeholder: {p['name']}")

        await session.commit()
        print("\nSpaces successfully seeded/updated.")

if __name__ == "__main__":
    asyncio.run(seed())
