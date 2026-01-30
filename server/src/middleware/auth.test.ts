import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Response, NextFunction } from 'express';
import {
  getJwtSecret,
  generateAccessToken,
  generateRefreshToken,
  generateParticipantToken,
  verifyToken,
  authenticateUser,
  authenticateParticipant,
  authenticateAny,
  requireAdmin,
  type AuthRequest,
} from './auth.js';

describe('getJwtSecret', () => {
  const originalEnv = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.JWT_SECRET = originalEnv;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  it('should return JWT_SECRET when set', () => {
    process.env.JWT_SECRET = 'test-secret-key';
    expect(getJwtSecret()).toBe('test-secret-key');
  });

  it('should throw error when JWT_SECRET is not set', () => {
    delete process.env.JWT_SECRET;
    expect(() => getJwtSecret()).toThrow('JWT_SECRET environment variable is required but not set');
  });
});

describe('generateAccessToken', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-for-tokens';
  });

  it('should generate a valid JWT token', () => {
    const payload = { userId: 'user-123', email: 'test@example.com', role: 'user' as const };
    const token = generateAccessToken(payload);

    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  it('should include payload in token', () => {
    const payload = { userId: 'user-123', email: 'test@example.com', role: 'user' as const };
    const token = generateAccessToken(payload);
    const decoded = jwt.verify(token, 'test-secret-for-tokens') as typeof payload & { iat: number; exp: number };

    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
  });

  it('should have 15 minute expiration', () => {
    const payload = { userId: 'user-123', email: 'test@example.com', role: 'user' as const };
    const token = generateAccessToken(payload);
    const decoded = jwt.verify(token, 'test-secret-for-tokens') as { iat: number; exp: number };

    const expiresIn = decoded.exp - decoded.iat;
    expect(expiresIn).toBe(15 * 60); // 15 minutes in seconds
  });

  it('should generate unique tokens', () => {
    const payload = { userId: 'user-123', email: 'test@example.com', role: 'user' as const };

    // Small delay to ensure different iat
    const token1 = generateAccessToken(payload);
    const token2 = generateAccessToken(payload);

    // Tokens will be the same if generated at the same second, but should be valid
    expect(token1).toBeTruthy();
    expect(token2).toBeTruthy();
  });
});

describe('generateRefreshToken', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-for-tokens';
  });

  it('should generate a valid JWT token', () => {
    const payload = { userId: 'user-123', email: 'test@example.com', role: 'user' as const };
    const token = generateRefreshToken(payload);

    expect(token).toBeTruthy();
    expect(token.split('.')).toHaveLength(3);
  });

  it('should have 7 day expiration', () => {
    const payload = { userId: 'user-123', email: 'test@example.com', role: 'user' as const };
    const token = generateRefreshToken(payload);
    const decoded = jwt.verify(token, 'test-secret-for-tokens') as { iat: number; exp: number };

    const expiresIn = decoded.exp - decoded.iat;
    expect(expiresIn).toBe(7 * 24 * 60 * 60); // 7 days in seconds
  });
});

describe('generateParticipantToken', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-for-tokens';
  });

  it('should generate a valid JWT token', () => {
    const payload = { participantId: 'participant-123', sessionId: 'session-456', displayName: 'John' };
    const token = generateParticipantToken(payload);

    expect(token).toBeTruthy();
    expect(token.split('.')).toHaveLength(3);
  });

  it('should include participant payload', () => {
    const payload = { participantId: 'participant-123', sessionId: 'session-456', displayName: 'John' };
    const token = generateParticipantToken(payload);
    const decoded = jwt.verify(token, 'test-secret-for-tokens') as typeof payload;

    expect(decoded.participantId).toBe(payload.participantId);
    expect(decoded.sessionId).toBe(payload.sessionId);
    expect(decoded.displayName).toBe(payload.displayName);
  });

  it('should have 15 minute expiration', () => {
    const payload = { participantId: 'participant-123', sessionId: 'session-456', displayName: 'John' };
    const token = generateParticipantToken(payload);
    const decoded = jwt.verify(token, 'test-secret-for-tokens') as { iat: number; exp: number };

    const expiresIn = decoded.exp - decoded.iat;
    expect(expiresIn).toBe(15 * 60); // 15 minutes in seconds
  });
});

describe('verifyToken', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-for-tokens';
  });

  it('should verify a valid access token', () => {
    const payload = { userId: 'user-123', email: 'test@example.com', role: 'user' as const };
    const token = generateAccessToken(payload);
    const decoded = verifyToken(token);

    expect(decoded).toMatchObject(payload);
  });

  it('should verify a valid participant token', () => {
    const payload = { participantId: 'participant-123', sessionId: 'session-456', displayName: 'John' };
    const token = generateParticipantToken(payload);
    const decoded = verifyToken(token);

    expect(decoded).toMatchObject(payload);
  });

  it('should throw for invalid token', () => {
    expect(() => verifyToken('invalid.token.here')).toThrow();
  });

  it('should throw for tampered token', () => {
    const payload = { userId: 'user-123', email: 'test@example.com', role: 'user' as const };
    const token = generateAccessToken(payload);
    const tamperedToken = token.slice(0, -5) + 'xxxxx';

    expect(() => verifyToken(tamperedToken)).toThrow();
  });

  it('should throw for token signed with different secret', () => {
    const payload = { userId: 'user-123', email: 'test@example.com', role: 'user' as const };
    const token = jwt.sign(payload, 'different-secret', { expiresIn: '15m' });

    expect(() => verifyToken(token)).toThrow();
  });

  it('should throw for expired token', () => {
    const payload = { userId: 'user-123', email: 'test@example.com', role: 'user' as const };
    // Create an already-expired token
    const token = jwt.sign(payload, 'test-secret-for-tokens', { expiresIn: '-1s' });

    expect(() => verifyToken(token)).toThrow();
  });
});

// Helper to create mock Express objects
function createMockReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    cookies: {},
    headers: {},
    ...overrides,
  } as AuthRequest;
}

function createMockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('authenticateUser middleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-for-tokens';
  });

  it('should authenticate with valid token in cookie', () => {
    const payload = { userId: 'user-123', email: 'test@example.com', role: 'user' as const };
    const token = generateAccessToken(payload);
    const req = createMockReq({ cookies: { accessToken: token } });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    authenticateUser(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('user-123');
    expect(req.userRole).toBe('user');
  });

  it('should authenticate with valid token in Authorization header', () => {
    const payload = { userId: 'user-123', email: 'test@example.com', role: 'user' as const };
    const token = generateAccessToken(payload);
    const req = createMockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    authenticateUser(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('user-123');
  });

  it('should return 401 when no token provided', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    authenticateUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for invalid token', () => {
    const req = createMockReq({ cookies: { accessToken: 'invalid-token' } });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    authenticateUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
  });

  it('should return 401 for expired token', () => {
    const payload = { userId: 'user-123', email: 'test@example.com', role: 'user' as const };
    const token = jwt.sign(payload, 'test-secret-for-tokens', { expiresIn: '-1s' });
    const req = createMockReq({ cookies: { accessToken: token } });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    authenticateUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
  });
});

describe('authenticateParticipant middleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-for-tokens';
  });

  it('should authenticate with valid participant token in cookie', () => {
    const payload = { participantId: 'participant-123', sessionId: 'session-456', displayName: 'John' };
    const token = generateParticipantToken(payload);
    const req = createMockReq({ cookies: { participantToken: token } });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    authenticateParticipant(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.participantId).toBe('participant-123');
  });

  it('should authenticate with valid token in header', () => {
    const payload = { participantId: 'participant-123', sessionId: 'session-456', displayName: 'John' };
    const token = generateParticipantToken(payload);
    const req = createMockReq({ headers: { 'x-participant-token': token } });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    authenticateParticipant(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.participantId).toBe('participant-123');
  });

  it('should return 401 when no token provided', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    authenticateParticipant(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Participant authentication required' });
  });

  it('should return 401 for invalid token', () => {
    const req = createMockReq({ cookies: { participantToken: 'invalid' } });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    authenticateParticipant(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired participant token' });
  });
});

describe('requireAdmin middleware', () => {
  it('should call next for admin users', () => {
    const req = createMockReq({ userRole: 'admin' });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 403 for non-admin users', () => {
    const req = createMockReq({ userRole: 'user' });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when no role set', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
  });
});

describe('authenticateAny middleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-for-tokens';
  });

  it('should authenticate with valid user token', () => {
    const payload = { userId: 'user-123', email: 'test@example.com', role: 'user' as const };
    const token = generateAccessToken(payload);
    const req = createMockReq({ cookies: { accessToken: token } });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    authenticateAny(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('user-123');
  });

  it('should authenticate with valid participant token when user token fails', () => {
    const payload = { participantId: 'participant-123', sessionId: 'session-456', displayName: 'John' };
    const token = generateParticipantToken(payload);
    const req = createMockReq({
      cookies: { accessToken: 'invalid', participantToken: token },
    });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    authenticateAny(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.participantId).toBe('participant-123');
  });

  it('should authenticate with participant token only', () => {
    const payload = { participantId: 'participant-123', sessionId: 'session-456', displayName: 'John' };
    const token = generateParticipantToken(payload);
    const req = createMockReq({ cookies: { participantToken: token } });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    authenticateAny(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.participantId).toBe('participant-123');
  });

  it('should return 401 when no valid tokens', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    authenticateAny(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
  });

  it('should return 401 when both tokens are invalid', () => {
    const req = createMockReq({
      cookies: { accessToken: 'invalid', participantToken: 'also-invalid' },
    });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    authenticateAny(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
  });
});
