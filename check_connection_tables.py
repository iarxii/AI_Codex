import sqlite3
conn = sqlite3.connect('data/aicodex.db')
cursor = conn.cursor()
cursor.execute('SELECT name FROM sqlite_master WHERE type="table" AND name LIKE "%connection%"')
tables = cursor.fetchall()
for t in tables:
    print(t[0])
conn.close()