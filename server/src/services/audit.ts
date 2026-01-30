import { db, schema } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'user.register'
  | 'user.password_change'
  | 'user.password_reset'
  | 'user.email_change'
  | 'user.role_change'
  | 'user.delete'
  | 'session.create'
  | 'session.delete'
  | 'data.export';

export interface AuditLogEntry {
  action: AuditAction;
  userId?: string;
  targetUserId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await db.insert(schema.auditLogs).values({
      id: uuidv4(),
      action: entry.action,
      userId: entry.userId || null,
      targetUserId: entry.targetUserId || null,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      createdAt: new Date(),
    });
  } catch (error) {
    // Log error but don't fail the request
    logger.error('Failed to log audit event:', error);
  }
}

// Helper to extract client info from request
export function getClientInfo(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): { ipAddress: string; userAgent: string } {
  const ip = req.ip ||
    (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    'unknown';
  const userAgent = (req.headers?.['user-agent'] as string) || 'unknown';
  return { ipAddress: ip, userAgent };
}
