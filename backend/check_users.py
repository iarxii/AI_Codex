import sqlite3
import os

db_path = "data/aicodex.db"
print(f"Checking DB at: {os.path.abspath(db_path)}")

if not os.path.exists(db_path):
    print("DB file NOT found!")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# List tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [t[0] for t in cursor.fetchall()]
print(f"Tables: {tables}")

if 'users' in tables:
    cursor.execute("SELECT id, username, role, is_active FROM users")
    users = cursor.fetchall()
    print("Users in DB:")
    for u in users:
        print(u)
else:
    print("Users table NOT found!")

conn.close()
