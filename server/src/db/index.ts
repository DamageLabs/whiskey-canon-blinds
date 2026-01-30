import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import path from 'path';
import { logger } from '../utils/logger.js';

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
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);
    CREATE INDEX IF NOT EXISTS idx_participants_user ON participants(user_id);
    CREATE INDEX IF NOT EXISTS idx_whiskeys_session ON whiskeys(session_id);
    CREATE INDEX IF NOT EXISTS idx_scores_session ON scores(session_id);
    CREATE INDEX IF NOT EXISTS idx_scores_participant ON scores(participant_id);
    CREATE INDEX IF NOT EXISTS idx_scores_whiskey ON scores(whiskey_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

    -- Social features: Follows table
    CREATE TABLE IF NOT EXISTS follows (
      id TEXT PRIMARY KEY,
      follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      UNIQUE(follower_id, following_id)
    );

    CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
    CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

    -- Audit logs table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      user_id TEXT,
      target_user_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
  `);

  // Add new columns to existing tables (safe to run multiple times)
  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT;`);
  } catch {
    // Column already exists
  }

  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN bio TEXT;`);
  } catch {
    // Column already exists
  }

  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN favorite_category TEXT;`);
  } catch {
    // Column already exists
  }

  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN experience_level TEXT;`);
  } catch {
    // Column already exists
  }

  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';`);
  } catch {
    // Column already exists
  }

  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN is_profile_public INTEGER NOT NULL DEFAULT 1;`);
  } catch {
    // Column already exists
  }

  try {
    sqlite.exec(`ALTER TABLE scores ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;`);
  } catch {
    // Column already exists
  }

  // Email verification columns
  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;`);
  } catch {
    // Column already exists
  }

  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN verification_code TEXT;`);
  } catch {
    // Column already exists
  }

  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN verification_code_expires_at INTEGER;`);
  } catch {
    // Column already exists
  }

  // Password reset columns
  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN reset_password_code TEXT;`);
  } catch {
    // Column already exists
  }

  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN reset_password_code_expires_at INTEGER;`);
  } catch {
    // Column already exists
  }

  // Verification attempt tracking columns
  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN verification_attempts INTEGER NOT NULL DEFAULT 0;`);
  } catch {
    // Column already exists
  }

  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN verification_locked_until INTEGER;`);
  } catch {
    // Column already exists
  }

  // Password reset attempt tracking columns
  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN reset_password_attempts INTEGER NOT NULL DEFAULT 0;`);
  } catch {
    // Column already exists
  }

  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN reset_password_locked_until INTEGER;`);
  } catch {
    // Column already exists
  }

  // Soft delete column for users
  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN deleted_at INTEGER;`);
  } catch {
    // Column already exists
  }

  // Index for faster queries filtering out deleted users
  try {
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);`);
  } catch {
    // Index already exists
  }

  logger.info('Database initialized');
}

export { schema };
