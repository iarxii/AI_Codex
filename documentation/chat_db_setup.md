
# Database Migration & Setup Guide

This guide explains how to run database migrations for the GP HealthMedAgentix chat application using SQLite.

---

## 1. Database Location
- The SQLite database file is named `chat.db` and is located in the `db_lite` directory at the project root.

## 2. Running Migrations

1. **Open a terminal and navigate to the project root:**
  ```sh
  cd E:/webdev/AI_Codex
  ```

2. **Run the migration SQL script using sqlite3:**
   - **On Linux/macOS (bash):**
     ```sh
     sqlite3 db_lite/chat.db < db_lite/migrations/001_create_schema.sql
     ```
   - **On Windows PowerShell:**
     ```powershell
     Get-Content db_lite/migrations/001_create_schema.sql | sqlite3 db_lite/chat.db
     ```
   - This will create or update all tables as defined in the migration file.

3. **Verify the schema (optional):**
  ```sh
  sqlite3 db_lite/chat.db ".tables"
  sqlite3 db_lite/chat.db ".schema User"
  ```

## Notes
- You can add more migration scripts in the `db_lite/migrations/` folder and run them in order.
- If you need to reset the database, you can delete `chat.db` and re-run the migrations.
- For production, always back up your data before running migrations.

---

**Troubleshooting:**
- If you get an error about missing `sqlite3`, install it from https://www.sqlite.org/download.html or use your system's package manager.
- If you see errors about existing tables, the migration may have already been applied.

---

For more details, see the schema documentation in `documentation/chat_schema.md`.

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
