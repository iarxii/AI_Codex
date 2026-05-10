import sqlite3
import os

# Try relative path first
db_path = "projects/iarxii/AI_Codex/backend/data/aicodex.db"
if not os.path.exists(db_path):
    db_path = "backend/data/aicodex.db"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# List tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print(f"Tables: {tables}")

if ('users',) in tables:
    cursor.execute("SELECT id, username, role, is_active FROM users")
    users = cursor.fetchall()
    print("Users in DB:")
    for u in users:
        print(u)
else:
    print("Users table NOT found!")

conn.close()
