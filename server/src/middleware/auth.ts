import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../db/schema.js';

const JWT_SECRET = process.env.JWT_SECRET || 'whiskey-canon-secret-change-in-production';

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
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
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
    const decoded = jwt.verify(token, JWT_SECRET) as ParticipantJwtPayload;
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
      const decoded = jwt.verify(userToken, JWT_SECRET) as JwtPayload;
      req.userId = decoded.userId;
      return next();
    } catch {
      // Try participant token
    }
  }

  if (participantToken) {
    try {
      const decoded = jwt.verify(participantToken, JWT_SECRET) as ParticipantJwtPayload;
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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function generateParticipantToken(payload: ParticipantJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): JwtPayload | ParticipantJwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload | ParticipantJwtPayload;
}
