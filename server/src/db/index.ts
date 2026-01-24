import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'whiskey.db');

// Ensure the data directory exists
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

// Initialize tables
export function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      theme TEXT NOT NULL,
      custom_theme TEXT,
      proof_min INTEGER,
      proof_max INTEGER,
      scheduled_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      moderator_id TEXT NOT NULL REFERENCES users(id),
      current_whiskey_index INTEGER NOT NULL DEFAULT 0,
      current_phase TEXT NOT NULL DEFAULT 'pour',
      invite_code TEXT NOT NULL UNIQUE,
      max_participants INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS whiskeys (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      display_number INTEGER NOT NULL,
      name TEXT NOT NULL,
      distillery TEXT NOT NULL,
      age INTEGER,
      proof REAL NOT NULL,
      price REAL,
      mashbill TEXT,
      region TEXT,
      pour_size TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id),
      display_name TEXT NOT NULL,
      joined_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      is_ready INTEGER NOT NULL DEFAULT 0,
      current_whiskey_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS scores (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      whiskey_id TEXT NOT NULL REFERENCES whiskeys(id) ON DELETE CASCADE,
      participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      nose INTEGER NOT NULL,
      palate INTEGER NOT NULL,
      finish INTEGER NOT NULL,
      overall INTEGER NOT NULL,
      total_score REAL NOT NULL,
      nose_notes TEXT,
      palate_notes TEXT,
      finish_notes TEXT,
      general_notes TEXT,
      identity_guess TEXT,
      locked_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_invite_code ON sessions(invite_code);
    CREATE INDEX IF NOT EXISTS idx_sessions_moderator ON sessions(moderator_id);
    CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);
    CREATE INDEX IF NOT EXISTS idx_whiskeys_session ON whiskeys(session_id);
    CREATE INDEX IF NOT EXISTS idx_scores_session ON scores(session_id);
    CREATE INDEX IF NOT EXISTS idx_scores_participant ON scores(participant_id);
  `);

  console.log('Database initialized');
}

export { schema };
