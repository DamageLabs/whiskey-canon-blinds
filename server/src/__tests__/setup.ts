import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.js';
import authRoutes from '../routes/auth.js';
import sessionsRoutes from '../routes/sessions.js';
import scoresRoutes from '../routes/scores.js';
import participantsRoutes from '../routes/participants.js';
import adminRoutes from '../routes/admin.js';
import socialRoutes from '../routes/social.js';

// Test database instance
let testDb: BetterSQLite3Database<typeof schema>;
let sqlite: Database.Database;

/**
 * Creates an in-memory test database
 */
export function createTestDatabase() {
  sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  testDb = drizzle(sqlite, { schema });

  // Create all tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      bio TEXT,
      favorite_category TEXT,
      experience_level TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      is_profile_public INTEGER NOT NULL DEFAULT 1,
      email_verified INTEGER NOT NULL DEFAULT 0,
      verification_code TEXT,
      verification_code_expires_at INTEGER,
      reset_password_code TEXT,
      reset_password_code_expires_at INTEGER,
      verification_attempts INTEGER NOT NULL DEFAULT 0,
      verification_locked_until INTEGER,
      reset_password_attempts INTEGER NOT NULL DEFAULT 0,
      reset_password_locked_until INTEGER,
      deleted_at INTEGER,
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
      is_public INTEGER NOT NULL DEFAULT 0,
      locked_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS follows (
      id TEXT PRIMARY KEY,
      follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      UNIQUE(follower_id, following_id)
    );

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

    CREATE INDEX IF NOT EXISTS idx_sessions_invite_code ON sessions(invite_code);
    CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
  `);

  return testDb;
}

/**
 * Creates a test Express app instance
 */
export function createTestApp() {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Routes (without CSRF for testing)
  app.use('/api/auth', authRoutes);
  app.use('/api/sessions', sessionsRoutes);
  app.use('/api/scores', scoresRoutes);
  app.use('/api/participants', participantsRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/social', socialRoutes);

  // Error handling
  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Test server error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

/**
 * Get the test database instance
 */
export function getTestDb() {
  return testDb;
}

/**
 * Get the raw SQLite instance
 */
export function getTestSqlite() {
  return sqlite;
}

/**
 * Close the test database
 */
export function closeTestDatabase() {
  if (sqlite) {
    sqlite.close();
  }
}

/**
 * Clear all data from test database
 */
export function clearTestDatabase() {
  if (sqlite) {
    sqlite.exec(`
      DELETE FROM audit_logs;
      DELETE FROM follows;
      DELETE FROM scores;
      DELETE FROM participants;
      DELETE FROM whiskeys;
      DELETE FROM sessions;
      DELETE FROM refresh_tokens;
      DELETE FROM users;
    `);
  }
}
