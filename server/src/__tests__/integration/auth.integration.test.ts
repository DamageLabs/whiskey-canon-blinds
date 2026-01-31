import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../db/schema.js';

// Set JWT_SECRET for tests
process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests';

// Create test database instance that will be shared
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

  CREATE TABLE IF NOT EXISTS follows (
    id TEXT PRIMARY KEY,
    follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    UNIQUE(follower_id, following_id)
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

  const testApp = express();
  testApp.use(express.json());
  testApp.use(cookieParser());
  testApp.use('/api/auth', authRoutes);

  testApp.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Test server error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return testApp;
}

describe('Auth Integration Tests', () => {
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

  describe('POST /api/auth/register', () => {
    it('should register a new user and return verification required', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'ValidPassword123!',
          displayName: 'Test User',
        });

      expect(response.status).toBe(201);
      expect(response.body.requiresVerification).toBe(true);
      expect(response.body.email).toBe('test@example.com');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak',
          displayName: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('12 characters');
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'ValidPassword123!',
          displayName: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('email');
    });

    it('should reject registration with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should reject duplicate email registration for verified user', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'ValidPassword123!',
          displayName: 'Test User',
        });

      sqlite.exec(`UPDATE users SET email_verified = 1 WHERE email = 'test@example.com'`);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'AnotherPassword123!',
          displayName: 'Another User',
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already registered');
    });
  });

  describe('POST /api/auth/verify-email', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'verify@example.com',
          password: 'ValidPassword123!',
          displayName: 'Verify User',
        });
    });

    it('should verify email with correct code', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: 'verify@example.com',
          code: 'ABC123',
        });

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('verify@example.com');
      expect(response.body.accessToken).toBeDefined();
    });

    it('should reject verification with wrong code', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: 'verify@example.com',
          code: 'WRONG1',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid verification code');
    });

    it('should reject already verified email', async () => {
      await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: 'verify@example.com',
          code: 'ABC123',
        });

      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: 'verify@example.com',
          code: 'ABC123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already verified');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      // Register and verify the user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'login@example.com',
          password: 'ValidPassword123!',
          displayName: 'Login User',
        });

      // Manually verify in database to avoid creating a refresh token
      sqlite.exec(`UPDATE users SET email_verified = 1, verification_code = NULL WHERE email = 'login@example.com'`);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'ValidPassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('login@example.com');
      expect(response.body.accessToken).toBeDefined();
    });

    it('should reject login with wrong password', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'wrongpw@example.com',
          password: 'ValidPassword123!',
          displayName: 'Wrong Password User',
        });

      sqlite.exec(`UPDATE users SET email_verified = 1 WHERE email = 'wrongpw@example.com'`);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrongpw@example.com',
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject login for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'ValidPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject login for unverified user', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'unverified@example.com',
          password: 'ValidPassword123!',
          displayName: 'Unverified User',
        });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unverified@example.com',
          password: 'ValidPassword123!',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('not verified');
      expect(response.body.requiresVerification).toBe(true);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'me@example.com',
          password: 'ValidPassword123!',
          displayName: 'Me User',
        });

      const verifyResponse = await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: 'me@example.com',
          code: 'ABC123',
        });

      const token = verifyResponse.body.accessToken;

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('me@example.com');
      expect(response.body.displayName).toBe('Me User');
    });

    it('should reject request without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'logout@example.com',
          password: 'ValidPassword123!',
          displayName: 'Logout User',
        });

      const verifyResponse = await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: 'logout@example.com',
          code: 'ABC123',
        });

      const cookies = verifyResponse.headers['set-cookie'];

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies || []);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Logged out');
    });
  });

  describe('PATCH /api/auth/me/display-name', () => {
    it('should update display name', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'update@example.com',
          password: 'ValidPassword123!',
          displayName: 'Original Name',
        });

      const verifyResponse = await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: 'update@example.com',
          code: 'ABC123',
        });

      const token = verifyResponse.body.accessToken;

      const response = await request(app)
        .patch('/api/auth/me/display-name')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: 'New Name' });

      expect(response.status).toBe(200);
      expect(response.body.displayName).toBe('New Name');
    });

    it('should reject display name that is too short', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'short@example.com',
          password: 'ValidPassword123!',
          displayName: 'Short Test',
        });

      const verifyResponse = await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: 'short@example.com',
          code: 'ABC123',
        });

      const token = verifyResponse.body.accessToken;

      const response = await request(app)
        .patch('/api/auth/me/display-name')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: 'A' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('between 2 and 30');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'forgot@example.com',
          password: 'ValidPassword123!',
          displayName: 'Forgot User',
        });

      await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: 'forgot@example.com',
          code: 'ABC123',
        });
    });

    it('should send password reset email for existing user', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'forgot@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('reset code');
    });

    it('should return success for non-existent user (prevent enumeration)', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('If that email exists');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'reset@example.com',
          password: 'ValidPassword123!',
          displayName: 'Reset User',
        });

      await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: 'reset@example.com',
          code: 'ABC123',
        });

      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'reset@example.com' });
    });

    it('should reset password with valid code', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          email: 'reset@example.com',
          code: 'ABC123',
          newPassword: 'NewValidPassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('reset successfully');

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'reset@example.com',
          password: 'NewValidPassword123!',
        });

      expect(loginResponse.status).toBe(200);
    });

    it('should reject weak new password', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          email: 'reset@example.com',
          code: 'ABC123',
          newPassword: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('12 characters');
    });
  });
});
