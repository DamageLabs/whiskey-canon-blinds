import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../db/schema.js';

// Validate and retrieve JWT secret - throws if not configured
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required but not set');
  }
  return secret;
}

// Validate JWT secret at startup
export function validateJwtSecret(): void {
  getJwtSecret();
}

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: UserRole;
  participantId?: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface ParticipantJwtPayload {
  participantId: string;
  sessionId: string;
  displayName: string;
}

// Middleware to authenticate registered users
export function authenticateUser(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.accessToken || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Middleware to require admin role
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Middleware to authenticate participants (can be guests)
export function authenticateParticipant(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.participantToken || req.headers['x-participant-token'];

  if (!token) {
    return res.status(401).json({ error: 'Participant authentication required' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as ParticipantJwtPayload;
    req.participantId = decoded.participantId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired participant token' });
  }
}

// Middleware that allows either user or participant auth
export function authenticateAny(req: AuthRequest, res: Response, next: NextFunction) {
  const userToken = req.cookies?.accessToken || req.headers.authorization?.split(' ')[1];
  const participantToken = req.cookies?.participantToken || req.headers['x-participant-token'];

  if (userToken) {
    try {
      const decoded = jwt.verify(userToken, getJwtSecret()) as JwtPayload;
      req.userId = decoded.userId;
      return next();
    } catch {
      // Try participant token
    }
  }

  if (participantToken) {
    try {
      const decoded = jwt.verify(participantToken, getJwtSecret()) as ParticipantJwtPayload;
      req.participantId = decoded.participantId;
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  return res.status(401).json({ error: 'Authentication required' });
}

// Generate tokens
export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '15m' });
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function generateParticipantToken(payload: ParticipantJwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '15m' });
}

export function verifyToken(token: string): JwtPayload | ParticipantJwtPayload {
  return jwt.verify(token, getJwtSecret()) as JwtPayload | ParticipantJwtPayload;
}
