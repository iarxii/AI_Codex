# Chat Database Setup for GP HealthMedAgentix

This document describes how to set up and use the SQLite database for storing chat conversations and messages in the GP HealthMedAgentix project.

---

## 1. Database Location
- The SQLite database file is named `chat.db` and is located in the `db_lite` directory at the project root.

## 2. Creating the Database
You can create the database and tables using the SQLite CLI:

```sh
cd db_lite
sqlite3 chat.db
```

Once inside the SQLite shell, run the following commands:

```sql
CREATE TABLE Conversation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Message (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER,
  sender TEXT,
  provider TEXT,
  content TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(conversation_id) REFERENCES Conversation(id)
);
```

- Type `.tables` to verify the tables were created.
- Type `.exit` to leave the SQLite shell.

## 3. Schema Overview
- **Conversation**: Stores each chat session (id, title, created_at).
- **Message**: Stores each message (id, conversation_id, sender, provider, content, timestamp).
- Each message is linked to a conversation via `conversation_id`.

## 4. SQLite Limits
- **Max database size**: ~281 TB
- **Max rows per table**: 2^64 (theoretical)
- **Max columns per table**: 2000 (default)
- **Max row size**: ~1 GB
- **Concurrent writes**: One at a time (reads are concurrent)

## 5. Usage
- Use this database for prototyping and small to medium production workloads.
- For high concurrency or very large datasets, consider migrating to a server-based RDBMS.

---

For schema diagrams, see `chat_schema.md` in this directory.
