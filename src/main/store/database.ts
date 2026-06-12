import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'conversations.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      image_base64 TEXT,
      visual_description TEXT,
      model_used TEXT NOT NULL,
      tokens_used INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_conv_ts ON conversations(timestamp DESC);
    CREATE VIRTUAL TABLE IF NOT EXISTS conversations_fts USING fts5(content, tokenize='unicode61');
  `);
}

export function closeDatabase() {
  if (db) db.close();
}
