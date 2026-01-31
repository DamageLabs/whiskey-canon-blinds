import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../db/schema.js';

// Set JWT_SECRET for tests
process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests';

// Create test database instance
const sqlite = new Database(':memory:');
sqlite.pragma('foreign_keys = ON');
const testDb = drizzle(sqlite, { schema });

// Initialize database schema
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

  CREATE TABLE IF NOT EXISTS follows (
    id TEXT PRIMARY KEY,
    follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    UNIQUE(follower_id, following_id)
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_invite_code ON sessions(invite_code);
  CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);
`);

// Mock socket.io
vi.mock('../../socket/index.js', () => ({
  getIO: () => ({
    to: () => ({
      emit: vi.fn(),
    }),
  }),
}));

// Mock email service
vi.mock('../../services/email.js', () => ({
  generateVerificationCode: () => 'ABC123',
  getCodeExpiration: () => new Date(Date.now() + 15 * 60 * 1000),
  getPasswordResetCodeExpiration: () => new Date(Date.now() + 15 * 60 * 1000),
  sendVerificationEmail: vi.fn().mockResolvedValue({ success: true, devCode: 'ABC123' }),
  sendPasswordResetEmail: vi.fn().mockResolvedValue({ success: true, devCode: 'ABC123' }),
}));

// Mock the db module to use our test database
vi.mock('../../db/index.js', () => ({
  db: testDb,
  schema,
}));

let app: Express;

async function createTestApp() {
  const authRoutes = (await import('../../routes/auth.js')).default;
  const sessionsRoutes = (await import('../../routes/sessions.js')).default;

  const testApp = express();
  testApp.use(express.json());
  testApp.use(cookieParser());
  testApp.use('/api/auth', authRoutes);
  testApp.use('/api/sessions', sessionsRoutes);

  testApp.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Test server error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return testApp;
}

async function createVerifiedUser(email: string, displayName: string) {
  await request(app)
    .post('/api/auth/register')
    .send({
      email,
      password: 'ValidPassword123!',
      displayName,
    });

  const verifyResponse = await request(app)
    .post('/api/auth/verify-email')
    .send({
      email,
      code: 'ABC123',
    });

  return {
    token: verifyResponse.body.accessToken,
    user: verifyResponse.body.user,
  };
}

describe('Sessions Integration Tests', () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(() => {
    sqlite.exec(`
      DELETE FROM audit_logs;
      DELETE FROM scores;
      DELETE FROM participants;
      DELETE FROM whiskeys;
      DELETE FROM sessions;
      DELETE FROM follows;
      DELETE FROM refresh_tokens;
      DELETE FROM users;
    `);
  });

  describe('POST /api/sessions', () => {
    it('should create a new session', async () => {
      const { token } = await createVerifiedUser('moderator@example.com', 'Moderator');

      const response = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Friday Night Tasting',
          hostName: 'The Moderator',
          theme: 'bourbon',
          whiskeys: [
            { name: 'Buffalo Trace', distillery: 'Buffalo Trace', proof: 90, pourSize: '0.5oz' },
            { name: 'Makers Mark', distillery: 'Makers Mark', proof: 90, pourSize: '0.5oz' },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.inviteCode).toBeDefined();
      expect(response.body.inviteCode).toHaveLength(6);
      expect(response.body.participantId).toBeDefined();
      expect(response.body.participantToken).toBeDefined();
    });

    it('should reject session creation without authentication', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          name: 'Test Session',
          hostName: 'Host',
          theme: 'bourbon',
          whiskeys: [{ name: 'Test', distillery: 'Test', proof: 90, pourSize: '0.5oz' }],
        });

      expect(response.status).toBe(401);
    });

    it('should reject session without whiskeys', async () => {
      const { token } = await createVerifiedUser('moderator@example.com', 'Moderator');

      const response = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Empty Session',
          hostName: 'Host',
          theme: 'bourbon',
          whiskeys: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('At least one whiskey');
    });

    it('should reject session with more than 6 whiskeys', async () => {
      const { token } = await createVerifiedUser('moderator@example.com', 'Moderator');

      const whiskeys = Array(7).fill(null).map((_, i) => ({
        name: `Whiskey ${i + 1}`,
        distillery: 'Test',
        proof: 90,
        pourSize: '0.5oz',
      }));

      const response = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Too Many Whiskeys',
          hostName: 'Host',
          theme: 'bourbon',
          whiskeys,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Maximum 6');
    });
  });

  describe('GET /api/sessions/:sessionId', () => {
    it('should get session details', async () => {
      const { token } = await createVerifiedUser('moderator@example.com', 'Moderator');

      const createResponse = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Session',
          hostName: 'Moderator',
          theme: 'bourbon',
          whiskeys: [{ name: 'Buffalo Trace', distillery: 'Buffalo Trace', proof: 90, pourSize: '0.5oz' }],
        });

      const sessionId = createResponse.body.id;

      const response = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(sessionId);
      expect(response.body.name).toBe('Test Session');
      expect(response.body.whiskeys).toHaveLength(1);
      expect(response.body.participants).toHaveLength(1);
      expect(response.body.isModerator).toBe(true);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .get('/api/sessions/non-existent-id');

      expect(response.status).toBe(404);
    });

    it('should hide whiskey details before reveal', async () => {
      const { token } = await createVerifiedUser('moderator@example.com', 'Moderator');

      const createResponse = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Session',
          hostName: 'Moderator',
          theme: 'bourbon',
          whiskeys: [{ name: 'Secret Whiskey', distillery: 'Secret Distillery', proof: 100, pourSize: '0.5oz' }],
        });

      const sessionId = createResponse.body.id;

      const response = await request(app)
        .get(`/api/sessions/${sessionId}`);

      expect(response.status).toBe(200);
      expect(response.body.whiskeys[0].name).toBeUndefined();
      expect(response.body.whiskeys[0].distillery).toBeUndefined();
    });
  });

  describe('POST /api/sessions/join', () => {
    it('should allow joining a session with invite code', async () => {
      const { token } = await createVerifiedUser('moderator@example.com', 'Moderator');

      const createResponse = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Join Test Session',
          hostName: 'Moderator',
          theme: 'bourbon',
          whiskeys: [{ name: 'Test', distillery: 'Test', proof: 90, pourSize: '0.5oz' }],
        });

      const inviteCode = createResponse.body.inviteCode;

      const response = await request(app)
        .post('/api/sessions/join')
        .send({
          inviteCode,
          displayName: 'Guest Taster',
        });

      expect(response.status).toBe(201);
      expect(response.body.sessionId).toBeDefined();
      expect(response.body.participantId).toBeDefined();
      expect(response.body.participantToken).toBeDefined();
      expect(response.body.isModerator).toBeFalsy(); // null or false for non-moderators
    });

    it('should reject invalid invite code', async () => {
      const response = await request(app)
        .post('/api/sessions/join')
        .send({
          inviteCode: 'INVALID',
          displayName: 'Guest',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should reject joining completed session', async () => {
      const { token } = await createVerifiedUser('moderator@example.com', 'Moderator');

      const createResponse = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Completed Session',
          hostName: 'Moderator',
          theme: 'bourbon',
          whiskeys: [{ name: 'Test', distillery: 'Test', proof: 90, pourSize: '0.5oz' }],
        });

      const inviteCode = createResponse.body.inviteCode;
      const sessionId = createResponse.body.id;

      sqlite.exec(`UPDATE sessions SET status = 'completed' WHERE id = '${sessionId}'`);

      const response = await request(app)
        .post('/api/sessions/join')
        .send({
          inviteCode,
          displayName: 'Late Guest',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('ended');
    });
  });

  describe('Session Flow - Start, Advance, Reveal, End', () => {
    let moderatorToken: string;
    let sessionId: string;
    let participantToken: string;

    beforeEach(async () => {
      const { token } = await createVerifiedUser('moderator@example.com', 'Moderator');
      moderatorToken = token;

      const createResponse = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({
          name: 'Flow Test Session',
          hostName: 'Moderator',
          theme: 'bourbon',
          whiskeys: [
            { name: 'Whiskey 1', distillery: 'Distillery 1', proof: 90, pourSize: '0.5oz' },
            { name: 'Whiskey 2', distillery: 'Distillery 2', proof: 95, pourSize: '0.5oz' },
          ],
        });

      sessionId = createResponse.body.id;
      participantToken = createResponse.body.participantToken;
    });

    it('should start a session', async () => {
      const response = await request(app)
        .post(`/api/sessions/${sessionId}/start`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('started');

      const sessionResponse = await request(app)
        .get(`/api/sessions/${sessionId}`);

      expect(sessionResponse.body.status).toBe('active');
    });

    it('should reject starting already started session', async () => {
      await request(app)
        .post(`/api/sessions/${sessionId}/start`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      const response = await request(app)
        .post(`/api/sessions/${sessionId}/start`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already started');
    });

    it('should reject non-moderator from starting session', async () => {
      const { token: otherToken } = await createVerifiedUser('other@example.com', 'Other User');

      const response = await request(app)
        .post(`/api/sessions/${sessionId}/start`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('moderator');
    });

    it('should advance session phase', async () => {
      await request(app)
        .post(`/api/sessions/${sessionId}/start`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      const response = await request(app)
        .post(`/api/sessions/${sessionId}/advance`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ phase: 'nose' });

      expect(response.status).toBe(200);
      expect(response.body.phase).toBe('nose');
    });

    it('should advance to next whiskey', async () => {
      await request(app)
        .post(`/api/sessions/${sessionId}/start`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      const response = await request(app)
        .post(`/api/sessions/${sessionId}/advance`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ whiskeyIndex: 1, phase: 'pour' });

      expect(response.status).toBe(200);
      expect(response.body.whiskeyIndex).toBe(1);
    });

    it('should reveal session results', async () => {
      await request(app)
        .post(`/api/sessions/${sessionId}/start`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      const response = await request(app)
        .post(`/api/sessions/${sessionId}/reveal`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.whiskeys).toBeDefined();
      expect(response.body.whiskeys).toHaveLength(2);
      expect(response.body.whiskeys[0].name).toBe('Whiskey 1');
    });

    it('should show whiskey details after reveal', async () => {
      await request(app)
        .post(`/api/sessions/${sessionId}/start`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      await request(app)
        .post(`/api/sessions/${sessionId}/reveal`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      const response = await request(app)
        .get(`/api/sessions/${sessionId}`);

      expect(response.status).toBe(200);
      expect(response.body.whiskeys[0].name).toBe('Whiskey 1');
      expect(response.body.whiskeys[0].distillery).toBe('Distillery 1');
    });

    it('should end a session', async () => {
      await request(app)
        .post(`/api/sessions/${sessionId}/start`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      const response = await request(app)
        .post(`/api/sessions/${sessionId}/end`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('ended');

      const sessionResponse = await request(app)
        .get(`/api/sessions/${sessionId}`);

      expect(sessionResponse.body.status).toBe('completed');
    });

    it('should pause and resume a session', async () => {
      await request(app)
        .post(`/api/sessions/${sessionId}/start`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      const pauseResponse = await request(app)
        .post(`/api/sessions/${sessionId}/pause`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      expect(pauseResponse.status).toBe(200);

      const resumeResponse = await request(app)
        .post(`/api/sessions/${sessionId}/resume`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      expect(resumeResponse.status).toBe(200);
    });
  });

  describe('GET /api/sessions', () => {
    it('should list user sessions', async () => {
      const { token } = await createVerifiedUser('moderator@example.com', 'Moderator');

      await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Session 1',
          hostName: 'Moderator',
          theme: 'bourbon',
          whiskeys: [{ name: 'W1', distillery: 'D1', proof: 90, pourSize: '0.5oz' }],
        });

      await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Session 2',
          hostName: 'Moderator',
          theme: 'rye',
          whiskeys: [{ name: 'W2', distillery: 'D2', proof: 95, pourSize: '0.5oz' }],
        });

      const response = await request(app)
        .get('/api/sessions')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });
  });
});
