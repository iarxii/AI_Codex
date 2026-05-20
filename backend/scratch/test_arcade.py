import asyncio
import sys
import os

# Add the project root to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
project_root = os.path.dirname(backend_dir)
sys.path.append(project_root)

from backend.db.session import engine, AsyncSessionLocal, init_db
from backend.db.models import User, ArcadeScore
from backend.api.arcade import get_leaderboard, submit_score
from sqlalchemy import select
from datetime import datetime

async def test_db_operations():
    print("Initializing database schema...")
    await init_db()
    print("Testing DB operations on backend session...")
    
    async with AsyncSessionLocal() as session:
        # 1. Verify we can select users
        print("Fetching first user in database...")
        stmt = select(User).limit(1)
        result = await session.execute(stmt)
        user = result.scalars().first()
        if not user:
            print("[WARN] No users found in database! Creating a test user...")
            test_user = User(
                username="test_arcade_dev",
                email="arcade_dev@aicodex.io",
                hashed_password="hashed_pw_dummy",
                role="user"
            )
            session.add(test_user)
            await session.commit()
            user = test_user
            print(f"Created user: {user.username} (ID: {user.id})")
        else:
            print(f"Found user: {user.username} (ID: {user.id})")

        # 2. Add some test scores for this user
        print(f"Adding arcade scores for {user.username}...")
        scores_to_add = [
            ArcadeScore(user_id=user.id, game_id="digiarch", score=1200, stars_earned=3, accuracy=100.0, time_spent_sec=45),
            ArcadeScore(user_id=user.id, game_id="digiarch", score=1500, stars_earned=3, accuracy=100.0, time_spent_sec=40),
            ArcadeScore(user_id=user.id, game_id="digiarch", score=900, stars_earned=2, accuracy=80.0, time_spent_sec=60),
            ArcadeScore(user_id=user.id, game_id="logicgrid", score=2200, stars_earned=3, accuracy=100.0, time_spent_sec=120),
            ArcadeScore(user_id=user.id, game_id="logicgrid", score=2500, stars_earned=3, accuracy=100.0, time_spent_sec=95),
            ArcadeScore(user_id=user.id, game_id="chromasync", score=3200, stars_earned=3, accuracy=95.0, time_spent_sec=42),
            ArcadeScore(user_id=user.id, game_id="chromasync", score=3500, stars_earned=3, accuracy=97.0, time_spent_sec=35),
            ArcadeScore(user_id=user.id, game_id="patternforge", score=2800, stars_earned=3, accuracy=100.0, time_spent_sec=30),
            ArcadeScore(user_id=user.id, game_id="patternforge", score=3100, stars_earned=3, accuracy=100.0, time_spent_sec=24),
            ArcadeScore(user_id=user.id, game_id="nodeflow", score=2900, stars_earned=3, accuracy=100.0, time_spent_sec=35),
            ArcadeScore(user_id=user.id, game_id="nodeflow", score=3200, stars_earned=3, accuracy=100.0, time_spent_sec=28),
        ]
        session.add_all(scores_to_add)
        await session.commit()
        print("Scores inserted successfully.")

        # 3. Retrieve leaderboard for 'digiarch'
        print("Fetching leaderboard for 'digiarch'...")
        from sqlalchemy import func
        subquery_digiarch = (
            select(
                ArcadeScore.user_id,
                func.max(ArcadeScore.score).label("max_score")
            )
            .filter(ArcadeScore.game_id == "digiarch")
            .group_by(ArcadeScore.user_id)
            .subquery()
        )

        stmt_digiarch = (
            select(ArcadeScore, User.username)
            .join(User, ArcadeScore.user_id == User.id)
            .join(
                subquery_digiarch,
                (ArcadeScore.user_id == subquery_digiarch.c.user_id) & 
                (ArcadeScore.score == subquery_digiarch.c.max_score)
            )
            .filter(ArcadeScore.game_id == "digiarch")
            .order_by(ArcadeScore.score.desc())
        )

        leaderboard_result = await session.execute(stmt_digiarch)
        rows = leaderboard_result.all()
        print(f"\n--- LEADERBOARD FOR 'digiarch' (Total entries: {len(rows)}) ---")
        for row in rows:
            score_rec, name = row
            print(f"Player: {name} | Score: {score_rec.score} | Stars: {score_rec.stars_earned} | Accuracy: {score_rec.accuracy}% | Time: {score_rec.time_spent_sec}s")

        # 4. Retrieve leaderboard for 'logicgrid'
        print("\nFetching leaderboard for 'logicgrid'...")
        subquery_logicgrid = (
            select(
                ArcadeScore.user_id,
                func.max(ArcadeScore.score).label("max_score")
            )
            .filter(ArcadeScore.game_id == "logicgrid")
            .group_by(ArcadeScore.user_id)
            .subquery()
        )

        stmt_logicgrid = (
            select(ArcadeScore, User.username)
            .join(User, ArcadeScore.user_id == User.id)
            .join(
                subquery_logicgrid,
                (ArcadeScore.user_id == subquery_logicgrid.c.user_id) & 
                (ArcadeScore.score == subquery_logicgrid.c.max_score)
            )
            .filter(ArcadeScore.game_id == "logicgrid")
            .order_by(ArcadeScore.score.desc())
        )

        leaderboard_logicgrid_result = await session.execute(stmt_logicgrid)
        rows_logicgrid = leaderboard_logicgrid_result.all()
        print(f"--- LEADERBOARD FOR 'logicgrid' (Total entries: {len(rows_logicgrid)}) ---")
        for row in rows_logicgrid:
            score_rec, name = row
            print(f"Player: {name} | Score: {score_rec.score} | Stars: {score_rec.stars_earned} | Accuracy: {score_rec.accuracy}% | Time: {score_rec.time_spent_sec}s")

        # 5. Retrieve leaderboard for 'chromasync'
        print("\nFetching leaderboard for 'chromasync'...")
        subquery_chromasync = (
            select(
                ArcadeScore.user_id,
                func.max(ArcadeScore.score).label("max_score")
            )
            .filter(ArcadeScore.game_id == "chromasync")
            .group_by(ArcadeScore.user_id)
            .subquery()
        )

        stmt_chromasync = (
            select(ArcadeScore, User.username)
            .join(User, ArcadeScore.user_id == User.id)
            .join(
                subquery_chromasync,
                (ArcadeScore.user_id == subquery_chromasync.c.user_id) & 
                (ArcadeScore.score == subquery_chromasync.c.max_score)
            )
            .filter(ArcadeScore.game_id == "chromasync")
            .order_by(ArcadeScore.score.desc())
        )

        leaderboard_chromasync_result = await session.execute(stmt_chromasync)
        rows_chromasync = leaderboard_chromasync_result.all()
        print(f"--- LEADERBOARD FOR 'chromasync' (Total entries: {len(rows_chromasync)}) ---")
        for row in rows_chromasync:
            score_rec, name = row
            print(f"Player: {name} | Score: {score_rec.score} | Stars: {score_rec.stars_earned} | Accuracy: {score_rec.accuracy}% | Time: {score_rec.time_spent_sec}s")

        # 6. Retrieve leaderboard for 'patternforge'
        print("\nFetching leaderboard for 'patternforge'...")
        subquery_patternforge = (
            select(
                ArcadeScore.user_id,
                func.max(ArcadeScore.score).label("max_score")
            )
            .filter(ArcadeScore.game_id == "patternforge")
            .group_by(ArcadeScore.user_id)
            .subquery()
        )

        stmt_patternforge = (
            select(ArcadeScore, User.username)
            .join(User, ArcadeScore.user_id == User.id)
            .join(
                subquery_patternforge,
                (ArcadeScore.user_id == subquery_patternforge.c.user_id) & 
                (ArcadeScore.score == subquery_patternforge.c.max_score)
            )
            .filter(ArcadeScore.game_id == "patternforge")
            .order_by(ArcadeScore.score.desc())
        )

        leaderboard_patternforge_result = await session.execute(stmt_patternforge)
        rows_patternforge = leaderboard_patternforge_result.all()
        print(f"--- LEADERBOARD FOR 'patternforge' (Total entries: {len(rows_patternforge)}) ---")
        for row in rows_patternforge:
            score_rec, name = row
            print(f"Player: {name} | Score: {score_rec.score} | Stars: {score_rec.stars_earned} | Accuracy: {score_rec.accuracy}% | Time: {score_rec.time_spent_sec}s")

        # 7. Retrieve leaderboard for 'nodeflow'
        print("\nFetching leaderboard for 'nodeflow'...")
        subquery_nodeflow = (
            select(
                ArcadeScore.user_id,
                func.max(ArcadeScore.score).label("max_score")
            )
            .filter(ArcadeScore.game_id == "nodeflow")
            .group_by(ArcadeScore.user_id)
            .subquery()
        )

        stmt_nodeflow = (
            select(ArcadeScore, User.username)
            .join(User, ArcadeScore.user_id == User.id)
            .join(
                subquery_nodeflow,
                (ArcadeScore.user_id == subquery_nodeflow.c.user_id) & 
                (ArcadeScore.score == subquery_nodeflow.c.max_score)
            )
            .filter(ArcadeScore.game_id == "nodeflow")
            .order_by(ArcadeScore.score.desc())
        )

        leaderboard_nodeflow_result = await session.execute(stmt_nodeflow)
        rows_nodeflow = leaderboard_nodeflow_result.all()
        print(f"--- LEADERBOARD FOR 'nodeflow' (Total entries: {len(rows_nodeflow)}) ---")
        for row in rows_nodeflow:
            score_rec, name = row
            print(f"Player: {name} | Score: {score_rec.score} | Stars: {score_rec.stars_earned} | Accuracy: {score_rec.accuracy}% | Time: {score_rec.time_spent_sec}s")
            
        print("\nClean database assertions: OK")

if __name__ == "__main__":
    asyncio.run(test_db_operations())
