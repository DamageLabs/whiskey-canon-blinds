import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a 6-character alphanumeric invite code
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars (0, O, 1, I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return uuidv4();
}

/**
 * Generate a unique participant ID
 */
export function generateParticipantId(): string {
  return uuidv4();
}

/**
 * Generate a unique whiskey ID
 */
export function generateWhiskeyId(): string {
  return uuidv4();
}

/**
 * Generate a unique score ID
 */
export function generateScoreId(): string {
  return uuidv4();
}

/**
 * Format invite code for display (XXX-XXX)
 */
export function formatInviteCode(code: string): string {
  if (code.length !== 6) return code;
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/**
 * Parse invite code from user input (handles XXX-XXX or XXXXXX)
 */
export function parseInviteCode(input: string): string {
  return input.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);
}

/**
 * Validate invite code format
 */
export function isValidInviteCode(code: string): boolean {
  const parsed = parseInviteCode(code);
  return parsed.length === 6 && /^[A-Z0-9]+$/.test(parsed);
}

/**
 * Create invite URL for sharing
 */
export function createInviteUrl(code: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/join/${code}`;
}
