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
  const scoresRoutes = (await import('../../routes/scores.js')).default;

  const testApp = express();
  testApp.use(express.json());
  testApp.use(cookieParser());
  testApp.use('/api/auth', authRoutes);
  testApp.use('/api/sessions', sessionsRoutes);
  testApp.use('/api/scores', scoresRoutes);

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

async function createTestSession(moderatorToken: string) {
  const createResponse = await request(app)
    .post('/api/sessions')
    .set('Authorization', `Bearer ${moderatorToken}`)
    .send({
      name: 'Test Tasting Session',
      hostName: 'Moderator',
      theme: 'bourbon',
      whiskeys: [
        { name: 'Buffalo Trace', distillery: 'Buffalo Trace', proof: 90, pourSize: '0.5oz' },
        { name: 'Eagle Rare', distillery: 'Buffalo Trace', proof: 90, pourSize: '0.5oz' },
      ],
    });

  const sessionId = createResponse.body.id;
  const participantToken = createResponse.body.participantToken;
  const inviteCode = createResponse.body.inviteCode;

  const sessionResponse = await request(app)
    .get(`/api/sessions/${sessionId}`)
    .set('Authorization', `Bearer ${moderatorToken}`);

  return {
    sessionId,
    participantToken,
    inviteCode,
    whiskeys: sessionResponse.body.whiskeys,
  };
}

describe('Scores Integration Tests', () => {
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

  describe('POST /api/scores', () => {
    it('should submit a score for a whiskey', async () => {
      const { token: moderatorToken } = await createVerifiedUser('moderator@example.com', 'Moderator');
      const { sessionId, participantToken, whiskeys } = await createTestSession(moderatorToken);

      await request(app)
        .post(`/api/sessions/${sessionId}/start`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      const response = await request(app)
        .post('/api/scores')
        .set('x-participant-token', participantToken)
        .send({
          sessionId,
          whiskeyId: whiskeys[0].id,
          nose: 8,
          palate: 7,
          finish: 8,
          overall: 8,
          noseNotes: 'Vanilla, caramel',
          palateNotes: 'Smooth, oaky',
          finishNotes: 'Long and warm',
          generalNotes: 'Great bourbon',
          identityGuess: 'Buffalo Trace',
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.totalScore).toBeDefined();
      expect(response.body.lockedAt).toBeDefined();
    });

    it('should calculate weighted total score correctly', async () => {
      const { token: moderatorToken } = await createVerifiedUser('moderator@example.com', 'Moderator');
      const { sessionId, participantToken, whiskeys } = await createTestSession(moderatorToken);

      await request(app)
        .post(`/api/sessions/${sessionId}/start`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      const response = await request(app)
        .post('/api/scores')
        .set('x-participant-token', participantToken)
        .send({
          sessionId,
          whiskeyId: whiskeys[0].id,
          nose: 10,
          palate: 10,
          finish: 10,
          overall: 10,
        });

      // Weighted: nose(10*0.25) + palate(10*0.35) + finish(10*0.25) + overall(10*0.15) = 10
      expect(response.body.totalScore).toBe(10);
    });

    it('should reject scores outside valid range', async () => {
      const { token: moderatorToken } = await createVerifiedUser('moderator@example.com', 'Moderator');
      const { sessionId, participantToken, whiskeys } = await createTestSession(moderatorToken);

      await request(app)
        .post(`/api/sessions/${sessionId}/start`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      const response = await request(app)
        .post('/api/scores')
        .set('x-participant-token', participantToken)
        .send({
          sessionId,
          whiskeyId: whiskeys[0].id,
          nose: 11,
          palate: 7,
          finish: 8,
          overall: 8,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('between 1 and 10');
    });

    it('should reject duplicate score submission', async () => {
      const { token: moderatorToken } = await createVerifiedUser('moderator@example.com', 'Moderator');
      const { sessionId, participantToken, whiskeys } = await createTestSession(moderatorToken);

      await request(app)
        .post(`/api/sessions/${sessionId}/start`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      await request(app)
        .post('/api/scores')
        .set('x-participant-token', participantToken)
        .send({
          sessionId,
          whiskeyId: whiskeys[0].id,
          nose: 8,
          palate: 7,
          finish: 8,
          overall: 8,
        });

      const response = await request(app)
        .post('/api/scores')
        .set('x-participant-token', participantToken)
        .send({
          sessionId,
          whiskeyId: whiskeys[0].id,
          nose: 9,
          palate: 8,
          finish: 9,
          overall: 9,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already submitted');
    });

    it('should reject score for inactive session', async () => {
      const { token: moderatorToken } = await createVerifiedUser('moderator@example.com', 'Moderator');
      const { sessionId, participantToken, whiskeys } = await createTestSession(moderatorToken);

      const response = await request(app)
        .post('/api/scores')
        .set('x-participant-token', participantToken)
        .send({
          sessionId,
          whiskeyId: whiskeys[0].id,
          nose: 8,
          palate: 7,
          finish: 8,
          overall: 8,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('not active');
    });

    it('should reject score without authentication', async () => {
      const { token: moderatorToken } = await createVerifiedUser('moderator@example.com', 'Moderator');
      const { sessionId, whiskeys } = await createTestSession(moderatorToken);

      await request(app)
        .post(`/api/sessions/${sessionId}/start`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      const response = await request(app)
        .post('/api/scores')
        .send({
          sessionId,
          whiskeyId: whiskeys[0].id,
          nose: 8,
          palate: 7,
          finish: 8,
          overall: 8,
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/scores/session/:sessionId', () => {
    it('should return scores after reveal', async () => {
      const { token: moderatorToken } = await createVerifiedUser('moderator@example.com', 'Moderator');
      const { sessionId, participantToken, inviteCode, whiskeys } = await createTestSession(moderatorToken);

      await request(app)
        .post(`/api/sessions/${sessionId}/start`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      await request(app)
        .post('/api/scores')
        .set('x-participant-token', participantToken)
        .send({
          sessionId,
          whiskeyId: whiskeys[0].id,
          nose: 8,
          palate: 7,
          finish: 8,
          overall: 8,
        });

      const joinResponse = await request(app)
        .post('/api/sessions/join')
        .send({
          inviteCode,
          displayName: 'Guest Taster',
        });

      const guestParticipantToken = joinResponse.body.participantToken;

      await request(app)
        .post('/api/scores')
        .set('x-participant-token', guestParticipantToken)
        .send({
          sessionId,
          whiskeyId: whiskeys[0].id,
          nose: 7,
          palate: 8,
          finish: 7,
          overall: 7,
        });

      await request(app)
        .post(`/api/sessions/${sessionId}/reveal`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      const response = await request(app)
        .get(`/api/scores/session/${sessionId}`);

      expect(response.status).toBe(200);
      expect(response.body.results).toBeDefined();
      expect(response.body.results).toHaveLength(2);
      expect(response.body.participantCount).toBe(2);
      expect(response.body.results[0].whiskey).toBeDefined();
      expect(response.body.results[0].averageScore).toBeDefined();
      expect(response.body.results[0].ranking).toBeDefined();
    });

    it('should reject scores request before reveal', async () => {
      const { token: moderatorToken } = await createVerifiedUser('moderator@example.com', 'Moderator');
      const { sessionId, participantToken, whiskeys } = await createTestSession(moderatorToken);

      await request(app)
        .post(`/api/sessions/${sessionId}/start`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      await request(app)
        .post('/api/scores')
        .set('x-participant-token', participantToken)
        .send({
          sessionId,
          whiskeyId: whiskeys[0].id,
          nose: 8,
          palate: 7,
          finish: 8,
          overall: 8,
        });

      const response = await request(app)
        .get(`/api/scores/session/${sessionId}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('not yet revealed');
    });
  });

  describe('GET /api/scores/my-scores/:sessionId', () => {
    it('should return participant own scores', async () => {
      const { token: moderatorToken } = await createVerifiedUser('moderator@example.com', 'Moderator');
      const { sessionId, participantToken, whiskeys } = await createTestSession(moderatorToken);

      await request(app)
        .post(`/api/sessions/${sessionId}/start`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      await request(app)
        .post('/api/scores')
        .set('x-participant-token', participantToken)
        .send({
          sessionId,
          whiskeyId: whiskeys[0].id,
          nose: 8,
          palate: 7,
          finish: 8,
          overall: 8,
        });

      await request(app)
        .post('/api/scores')
        .set('x-participant-token', participantToken)
        .send({
          sessionId,
          whiskeyId: whiskeys[1].id,
          nose: 9,
          palate: 9,
          finish: 9,
          overall: 9,
        });

      const response = await request(app)
        .get(`/api/scores/my-scores/${sessionId}`)
        .set('x-participant-token', participantToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });
  });

  describe('Full Tasting Flow', () => {
    it('should complete a full tasting session with multiple participants', { timeout: 30000 }, async () => {
      const { token: moderatorToken } = await createVerifiedUser('moderator@example.com', 'Moderator');
      const { sessionId, participantToken: modParticipantToken, inviteCode, whiskeys } = await createTestSession(moderatorToken);

      const guest1Response = await request(app)
        .post('/api/sessions/join')
        .send({ inviteCode, displayName: 'Guest 1' });

      const guest2Response = await request(app)
        .post('/api/sessions/join')
        .send({ inviteCode, displayName: 'Guest 2' });

      const guest1Token = guest1Response.body.participantToken;
      const guest2Token = guest2Response.body.participantToken;

      await request(app)
        .post(`/api/sessions/${sessionId}/start`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      const scores = [
        { token: modParticipantToken, nose: 8, palate: 7, finish: 8, overall: 8 },
        { token: guest1Token, nose: 7, palate: 8, finish: 7, overall: 7 },
        { token: guest2Token, nose: 9, palate: 8, finish: 9, overall: 9 },
      ];

      for (const score of scores) {
        await request(app)
          .post('/api/scores')
          .set('x-participant-token', score.token)
          .send({
            sessionId,
            whiskeyId: whiskeys[0].id,
            ...score,
          });
      }

      await request(app)
        .post(`/api/sessions/${sessionId}/advance`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ whiskeyIndex: 1, phase: 'pour' });

      const scores2 = [
        { token: modParticipantToken, nose: 9, palate: 9, finish: 9, overall: 9 },
        { token: guest1Token, nose: 8, palate: 9, finish: 8, overall: 8 },
        { token: guest2Token, nose: 7, palate: 7, finish: 7, overall: 7 },
      ];

      for (const score of scores2) {
        await request(app)
          .post('/api/scores')
          .set('x-participant-token', score.token)
          .send({
            sessionId,
            whiskeyId: whiskeys[1].id,
            ...score,
          });
      }

      const revealResponse = await request(app)
        .post(`/api/sessions/${sessionId}/reveal`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      expect(revealResponse.status).toBe(200);
      expect(revealResponse.body.whiskeys).toHaveLength(2);
      expect(revealResponse.body.scores).toHaveLength(6);

      const resultsResponse = await request(app)
        .get(`/api/scores/session/${sessionId}`);

      expect(resultsResponse.status).toBe(200);
      expect(resultsResponse.body.results).toHaveLength(2);
      expect(resultsResponse.body.participantCount).toBe(3);

      expect(resultsResponse.body.results[0].ranking).toBe(1);
      expect(resultsResponse.body.results[1].ranking).toBe(2);

      const endResponse = await request(app)
        .post(`/api/sessions/${sessionId}/end`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      expect(endResponse.status).toBe(200);

      const sessionResponse = await request(app)
        .get(`/api/sessions/${sessionId}`);

      expect(sessionResponse.body.status).toBe('completed');
    });
  });
});
