import { Resend } from 'resend';

const APP_NAME = 'Whiskey Canon';

// Lazy-initialize Resend client to ensure env vars are loaded
let resendClient: Resend | null = null;
function getResendClient(): Resend | null {
  if (resendClient) return resendClient;
  if (process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
    console.log('[Email] Resend client initialized');
  }
  return resendClient;
}

function getFromEmail(): string {
  return process.env.FROM_EMAIL || 'Whiskey Canon <onboarding@resend.dev>';
}

// Generate a 6-digit verification code
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Code expires in 15 minutes
export function getCodeExpiration(): Date {
  return new Date(Date.now() + 15 * 60 * 1000);
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
    console.log('===========================================');
    console.log(`[DEV MODE] Verification code for ${email}: ${code}`);
    console.log('===========================================');
    return { success: true, devCode: code };
  }

  try {
    console.log(`[Email] Sending verification email to ${email}`);
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
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1f2937;">${code}</span>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            This code will expire in 15 minutes. If you didn't create an account, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            ${APP_NAME} - Blind whiskey tasting made simple
          </p>
        </div>
      `,
    });
    console.log(`[Email] Sent successfully:`, result);
    return { success: true };
  } catch (error) {
    console.error('[Email] Failed to send verification email:', error);
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
    console.log('===========================================');
    console.log(`[DEV MODE] Password reset code for ${email}: ${code}`);
    console.log('===========================================');
    return { success: true, devCode: code };
  }

  try {
    console.log(`[Email] Sending password reset email to ${email}`);
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
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1f2937;">${code}</span>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            This code will expire in 15 minutes. If you didn't request a password reset, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            ${APP_NAME} - Blind whiskey tasting made simple
          </p>
        </div>
      `,
    });
    console.log(`[Email] Sent successfully:`, result);
    return { success: true };
  } catch (error) {
    console.error('[Email] Failed to send password reset email:', error);
    return { success: false, error: 'Failed to send password reset email' };
  }
}
