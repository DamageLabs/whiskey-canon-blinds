import { Resend } from 'resend';
import { randomBytes } from 'crypto';
import { logger } from '../utils/logger.js';

const APP_NAME = 'Whiskey Canon';

// Lazy-initialize Resend client to ensure env vars are loaded
let resendClient: Resend | null = null;
function getResendClient(): Resend | null {
  if (resendClient) return resendClient;
  if (process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
    logger.info('[Email] Resend client initialized');
  }
  return resendClient;
}

function getFromEmail(): string {
  return process.env.FROM_EMAIL || 'Whiskey Canon <onboarding@resend.dev>';
}

// Alphanumeric charset for verification codes (excludes confusing chars like 0/O, 1/l/I)
const CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

// Generate an alphanumeric verification code using cryptographic RNG
export function generateVerificationCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARSET[bytes[i] % CODE_CHARSET.length];
  }
  return code;
}

// Email verification code expires in 15 minutes
export function getCodeExpiration(): Date {
  return new Date(Date.now() + 15 * 60 * 1000);
}

// Password reset code expires in 5 minutes (more sensitive operation)
export function getPasswordResetCodeExpiration(): Date {
  return new Date(Date.now() + 5 * 60 * 1000);
}

export interface SendVerificationEmailResult {
  success: boolean;
  error?: string;
  devCode?: string; // Only returned in development mode without API key
}

export async function sendVerificationEmail(
  email: string,
  code: string,
  displayName: string
): Promise<SendVerificationEmailResult> {
  const resend = getResendClient();

  // Without API key, log the code (dev mode)
  if (!resend) {
    logger.dev('===========================================');
    logger.dev(`[DEV MODE] Verification code for ${email}: ${code}`);
    logger.dev('===========================================');
    return { success: true, devCode: code };
  }

  try {
    logger.debug(`[Email] Sending verification email to ${email}`);
    const result = await resend.emails.send({
      from: getFromEmail(),
      to: email,
      subject: `${APP_NAME} - Verify your email`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="color: #d97706; margin-bottom: 24px;">Welcome to ${APP_NAME}</h1>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Hi ${displayName},
          </p>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Thanks for signing up! Please use the following verification code to complete your registration:
          </p>
          <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #1f2937; font-family: monospace;">${code}</span>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            This code will expire in 15 minutes. Enter the code exactly as shown (case-insensitive). If you didn't create an account, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            ${APP_NAME} - Taste responsibly. Score honestly.
          </p>
        </div>
      `,
    });
    logger.debug(`[Email] Sent successfully:`, result);
    return { success: true };
  } catch (error) {
    logger.error('[Email] Failed to send verification email:', error);
    return { success: false, error: 'Failed to send verification email' };
  }
}

export async function sendPasswordResetEmail(
  email: string,
  code: string,
  displayName: string
): Promise<SendVerificationEmailResult> {
  const resend = getResendClient();

  // Without API key, log the code (dev mode)
  if (!resend) {
    logger.dev('===========================================');
    logger.dev(`[DEV MODE] Password reset code for ${email}: ${code}`);
    logger.dev('===========================================');
    return { success: true, devCode: code };
  }

  try {
    logger.debug(`[Email] Sending password reset email to ${email}`);
    const result = await resend.emails.send({
      from: getFromEmail(),
      to: email,
      subject: `${APP_NAME} - Reset your password`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="color: #d97706; margin-bottom: 24px;">Reset Your Password</h1>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Hi ${displayName},
          </p>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            We received a request to reset your password. Use the following code to set a new password:
          </p>
          <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #1f2937; font-family: monospace;">${code}</span>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            This code will expire in 5 minutes. Enter the code exactly as shown (case-insensitive). If you didn't request a password reset, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            ${APP_NAME} - Taste responsibly. Score honestly.
          </p>
        </div>
      `,
    });
    logger.debug(`[Email] Sent successfully:`, result);
    return { success: true };
  } catch (error) {
    logger.error('[Email] Failed to send password reset email:', error);
    return { success: false, error: 'Failed to send password reset email' };
  }
}

export async function sendSessionInviteEmail(
  email: string,
  sessionName: string,
  hostName: string,
  scheduledAt: Date,
  inviteCode: string,
  joinLink: string
): Promise<SendVerificationEmailResult> {
  const resend = getResendClient();

  const formattedDate = scheduledAt.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = scheduledAt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Without API key, log the invite (dev mode)
  if (!resend) {
    logger.dev('===========================================');
    logger.dev(`[DEV MODE] Session invite for ${email}`);
    logger.dev(`Session: ${sessionName}`);
    logger.dev(`Host: ${hostName}`);
    logger.dev(`Date: ${formattedDate} at ${formattedTime}`);
    logger.dev(`Invite Code: ${inviteCode}`);
    logger.dev(`Join Link: ${joinLink}`);
    logger.dev('===========================================');
    return { success: true };
  }

  try {
    logger.debug(`[Email] Sending session invite to ${email}`);
    const result = await resend.emails.send({
      from: getFromEmail(),
      to: email,
      subject: `${APP_NAME} - You're invited to ${sessionName}`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="color: #d97706; margin-bottom: 24px;">You're Invited!</h1>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            ${hostName} has invited you to join a blind whiskey tasting session.
          </p>

          <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); border: 2px solid #d97706; border-radius: 12px; padding: 24px; margin: 24px 0;">
            <h2 style="color: #78350f; margin: 0 0 12px 0; font-size: 24px;">${sessionName}</h2>
            <p style="color: #92400e; margin: 0; font-size: 16px;">
              <strong>When:</strong> ${formattedDate} at ${formattedTime}
            </p>
          </div>

          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Join the session using the invite code below:
          </p>

          <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1f2937; font-family: monospace;">${inviteCode}</span>
          </div>

          <div style="text-align: center; margin: 24px 0;">
            <a href="${joinLink}" style="display: inline-block; background: #d97706; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
              Join Session
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px;">
            Click the button above or enter the invite code at ${APP_NAME} to join. Make sure you have your whiskey pours ready!
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            ${APP_NAME} - Taste responsibly. Score honestly.
          </p>
        </div>
      `,
    });
    logger.debug(`[Email] Sent successfully:`, result);
    return { success: true };
  } catch (error) {
    logger.error('[Email] Failed to send session invite email:', error);
    return { success: false, error: 'Failed to send session invite email' };
  }
}
