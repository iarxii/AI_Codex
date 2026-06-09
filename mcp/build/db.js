"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = initializeDatabase;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
let db;
async function initializeDatabase() {
    // This will open the database file relative to your project root.
    db = await (0, sqlite_1.open)({
        filename: './db_lite/chat.db',
        driver: sqlite3_1.default.Database
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
exports.default = db;
