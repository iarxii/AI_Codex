import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let db: Database | undefined;

export async function initializeDatabase() {
  // This will open the database file relative to your project root.
  db = await open({
    filename: './db_lite/chat.db',
    driver: sqlite3.Database
  });

  // We can create the 'users' table here if it doesn't already exist.
  // This makes your application easier to set up.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      address TEXT,
      phone TEXT
    );
  `);
}

export default db as Database;