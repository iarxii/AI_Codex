import sqlite3
import os

db_path = "production_aicodex.db"
print(f"Scrubbing DB at: {os.path.abspath(db_path)}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 1. Check users
cursor.execute("SELECT id, username, role FROM users")
users = cursor.fetchall()
print("Current users:")
for u in users:
    print(u)

# 2. Check for nexus-architect
cursor.execute("SELECT id, username, role FROM users WHERE username = 'nexus-architect'")
nexus = cursor.fetchone()

if nexus:
    print(f"Found nexus-architect: {nexus}")
    if nexus[2] != 'super_admin':
        print("Promoting nexus-architect to super_admin...")
        cursor.execute("UPDATE users SET role = 'super_admin' WHERE username = 'nexus-architect'")
else:
    print("WARNING: nexus-architect NOT FOUND in database!")

# 3. Delete admin
print("Deleting 'admin' user...")
cursor.execute("DELETE FROM users WHERE username = 'admin'")

conn.commit()
print("Scrubbing complete.")

# Verify
cursor.execute("SELECT id, username, role FROM users")
print("Remaining users:")
for u in cursor.fetchall():
    print(u)

conn.close()
