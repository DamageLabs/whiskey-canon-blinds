import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db, schema } from '../db/index.js';
import { eq, desc } from 'drizzle-orm';
import {
  AuthRequest,
  generateAccessToken,
  generateRefreshToken,
  authenticateUser,
  verifyToken,
  JwtPayload,
} from '../middleware/auth.js';
import { authLimiter, verificationLimiter, exportLimiter } from '../middleware/rateLimit.js';
import { validateEmail, normalizeEmail, validatePassword } from '../utils/validation.js';
import {
  generateVerificationCode,
  getCodeExpiration,
  getPasswordResetCodeExpiration,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '../services/email.js';

// Constants for attempt limiting
const MAX_VERIFICATION_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout after max attempts

// Calculate exponential backoff delay (2^attempts seconds, max 30 seconds)
function getBackoffDelay(attempts: number): number {
  return Math.min(Math.pow(2, attempts) * 1000, 30000);
}
import { logAuditEvent, getClientInfo } from '../services/audit.js';

const router = Router();

// Configure multer for avatar uploads
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'dist', 'uploads', 'avatars');
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req: AuthRequest, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${req.userId}-${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  },
});

// Register a new user (sends verification email, no tokens until verified)
router.post('/register', authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, password, and display name are required' });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.errors[0] });
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.error });
    }

    const normalizedEmail = normalizeEmail(email);

    // Check if user exists
    const existing = await db.query.users.findFirst({
      where: eq(schema.users.email, normalizedEmail),
    });

    if (existing) {
      // If user exists but is not verified, allow re-registration (update password and resend code)
      if (!existing.emailVerified) {
        const verificationCode = generateVerificationCode();
        const verificationCodeExpiresAt = getCodeExpiration();
        const passwordHash = await bcrypt.hash(password, 12);

        await db.update(schema.users)
          .set({
            passwordHash,
            displayName,
            verificationCode,
            verificationCodeExpiresAt,
          })
          .where(eq(schema.users.id, existing.id));

        const emailResult = await sendVerificationEmail(normalizedEmail, verificationCode, displayName);
        if (!emailResult.success) {
          return res.status(500).json({ error: emailResult.error || 'Failed to send verification email' });
        }

        return res.status(200).json({
          message: 'Verification code sent to your email',
          requiresVerification: true,
          email: normalizedEmail,
          ...(emailResult.devCode && { devCode: emailResult.devCode }),
        });
      }
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const verificationCodeExpiresAt = getCodeExpiration();

    // Create user (unverified)
    const userId = uuidv4();
    const now = new Date();

    await db.insert(schema.users).values({
      id: userId,
      email: normalizedEmail,
      passwordHash,
      displayName,
      emailVerified: false,
      verificationCode,
      verificationCodeExpiresAt,
      createdAt: now,
    });

    // Send verification email
    const emailResult = await sendVerificationEmail(normalizedEmail, verificationCode, displayName);
    if (!emailResult.success) {
      // Delete user if email fails
      await db.delete(schema.users).where(eq(schema.users.id, userId));
      return res.status(500).json({ error: emailResult.error || 'Failed to send verification email' });
    }

    return res.status(201).json({
      message: 'Verification code sent to your email',
      requiresVerification: true,
      email: normalizedEmail,
      ...(emailResult.devCode && { devCode: emailResult.devCode }),
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// Verify email with alphanumeric code
router.post('/verify-email', verificationLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    const normalizedEmail = normalizeEmail(email);

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, normalizedEmail),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Check if account is locked due to too many attempts
    if (user.verificationLockedUntil && user.verificationLockedUntil > new Date()) {
      const remainingSeconds = Math.ceil((user.verificationLockedUntil.getTime() - Date.now()) / 1000);
      return res.status(429).json({
        error: `Too many failed attempts. Please try again in ${remainingSeconds} seconds.`,
        lockedUntil: user.verificationLockedUntil.toISOString(),
      });
    }

    // Check code (case-insensitive comparison)
    const codeMatches = user.verificationCode?.toUpperCase() === code.toUpperCase();

    if (!codeMatches) {
      // Increment attempt counter
      const newAttempts = (user.verificationAttempts || 0) + 1;
      const updates: { verificationAttempts: number; verificationLockedUntil?: Date } = {
        verificationAttempts: newAttempts,
      };

      // Lock account if max attempts reached
      if (newAttempts >= MAX_VERIFICATION_ATTEMPTS) {
        updates.verificationLockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await db.update(schema.users)
          .set(updates)
          .where(eq(schema.users.id, user.id));
        return res.status(429).json({
          error: 'Too many failed attempts. Account locked for 15 minutes.',
          lockedUntil: updates.verificationLockedUntil.toISOString(),
        });
      }

      await db.update(schema.users)
        .set(updates)
        .where(eq(schema.users.id, user.id));

      const remainingAttempts = MAX_VERIFICATION_ATTEMPTS - newAttempts;
      return res.status(400).json({
        error: `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
      });
    }

    // Check expiration
    if (!user.verificationCodeExpiresAt || user.verificationCodeExpiresAt < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    // Mark as verified and clear code/attempts
    await db.update(schema.users)
      .set({
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpiresAt: null,
        verificationAttempts: 0,
        verificationLockedUntil: null,
      })
      .where(eq(schema.users.id, user.id));

    // Generate tokens (user is now verified)
    const userRole = (user.role as 'user' | 'admin') || 'user';
    const accessToken = generateAccessToken({ userId: user.id, email: normalizedEmail, role: userRole });
    const refreshToken = generateRefreshToken({ userId: user.id, email: normalizedEmail, role: userRole });

    // Store refresh token
    await db.insert(schema.refreshTokens).values({
      id: uuidv4(),
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    });

    // Set cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Log registration completion
    const clientInfo = getClientInfo(req);
    await logAuditEvent({
      action: 'user.register',
      userId: user.id,
      ...clientInfo,
      metadata: { email: normalizedEmail },
    });

    return res.json({
      user: {
        id: user.id,
        email: normalizedEmail,
        displayName: user.displayName,
        role: userRole,
      },
      accessToken,
    });
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

// Resend verification code
router.post('/resend-verification', verificationLimiter, async (req: AuthRequest, res: Response) => {
  console.log('[Auth] Resend verification request:', req.body);
  try {
    const { email } = req.body;

    if (!email) {
      console.log('[Auth] Resend verification: no email provided');
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = normalizeEmail(email);

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, normalizedEmail),
    });

    if (!user) {
      // Don't reveal if user exists for security
      return res.json({ message: 'If that email exists, a new verification code has been sent.' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Generate new code
    const verificationCode = generateVerificationCode();
    const verificationCodeExpiresAt = getCodeExpiration();

    await db.update(schema.users)
      .set({
        verificationCode,
        verificationCodeExpiresAt,
      })
      .where(eq(schema.users.id, user.id));

    // Send email
    const emailResult = await sendVerificationEmail(normalizedEmail, verificationCode, user.displayName);
    if (!emailResult.success) {
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    return res.json({
      message: 'If that email exists, a new verification code has been sent.',
      ...(emailResult.devCode && { devCode: emailResult.devCode }),
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).json({ error: 'Failed to resend verification' });
  }
});

// Request password reset
router.post('/forgot-password', authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = normalizeEmail(email);

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, normalizedEmail),
    });

    // Always return success message to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If that email exists, a password reset code has been sent.' });
    }

    // Generate reset code (with shorter expiration for security)
    const resetCode = generateVerificationCode();
    const resetCodeExpiresAt = getPasswordResetCodeExpiration();

    await db.update(schema.users)
      .set({
        resetPasswordCode: resetCode,
        resetPasswordCodeExpiresAt: resetCodeExpiresAt,
        resetPasswordAttempts: 0,
        resetPasswordLockedUntil: null,
      })
      .where(eq(schema.users.id, user.id));

    // Send email
    const emailResult = await sendPasswordResetEmail(normalizedEmail, resetCode, user.displayName);
    if (!emailResult.success) {
      return res.status(500).json({ error: 'Failed to send password reset email' });
    }

    return res.json({
      message: 'If that email exists, a password reset code has been sent.',
      ...(emailResult.devCode && { devCode: emailResult.devCode }),
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// Reset password with code
router.post('/reset-password', verificationLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, code, and new password are required' });
    }

    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.errors[0] });
    }

    const normalizedEmail = normalizeEmail(email);

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, normalizedEmail),
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    // Check if account is locked due to too many attempts
    if (user.resetPasswordLockedUntil && user.resetPasswordLockedUntil > new Date()) {
      const remainingSeconds = Math.ceil((user.resetPasswordLockedUntil.getTime() - Date.now()) / 1000);
      return res.status(429).json({
        error: `Too many failed attempts. Please try again in ${remainingSeconds} seconds.`,
        lockedUntil: user.resetPasswordLockedUntil.toISOString(),
      });
    }

    // Check code (case-insensitive comparison)
    const codeMatches = user.resetPasswordCode?.toUpperCase() === code.toUpperCase();

    if (!codeMatches) {
      // Increment attempt counter
      const newAttempts = (user.resetPasswordAttempts || 0) + 1;
      const updates: { resetPasswordAttempts: number; resetPasswordLockedUntil?: Date } = {
        resetPasswordAttempts: newAttempts,
      };

      // Lock account if max attempts reached
      if (newAttempts >= MAX_VERIFICATION_ATTEMPTS) {
        updates.resetPasswordLockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await db.update(schema.users)
          .set(updates)
          .where(eq(schema.users.id, user.id));
        return res.status(429).json({
          error: 'Too many failed attempts. Account locked for 15 minutes.',
          lockedUntil: updates.resetPasswordLockedUntil.toISOString(),
        });
      }

      await db.update(schema.users)
        .set(updates)
        .where(eq(schema.users.id, user.id));

      const remainingAttempts = MAX_VERIFICATION_ATTEMPTS - newAttempts;
      return res.status(400).json({
        error: `Invalid reset code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
      });
    }

    // Check expiration
    if (!user.resetPasswordCodeExpiresAt || user.resetPasswordCodeExpiresAt < new Date()) {
      return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password and clear reset code/attempts
    await db.update(schema.users)
      .set({
        passwordHash,
        resetPasswordCode: null,
        resetPasswordCodeExpiresAt: null,
        resetPasswordAttempts: 0,
        resetPasswordLockedUntil: null,
      })
      .where(eq(schema.users.id, user.id));

    // Invalidate all refresh tokens for security
    await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.userId, user.id));

    // Log password reset
    const clientInfo = getClientInfo(req);
    await logAuditEvent({
      action: 'user.password_reset',
      userId: user.id,
      ...clientInfo,
    });

    return res.json({ message: 'Password reset successfully. Please log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Login
router.post('/login', authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, email.toLowerCase()),
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user account is deleted (soft delete)
    if (user.deletedAt) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'Email not verified',
        requiresVerification: true,
        email: user.email,
      });
    }

    // Generate tokens with user's role
    const userRole = (user.role as 'user' | 'admin') || 'user';
    const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: userRole });
    const refreshToken = generateRefreshToken({ userId: user.id, email: user.email, role: userRole });

    // Store refresh token
    await db.insert(schema.refreshTokens).values({
      id: uuidv4(),
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    });

    // Set cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Log successful login
    const clientInfo = getClientInfo(req);
    await logAuditEvent({
      action: 'user.login',
      userId: user.id,
      ...clientInfo,
    });

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        favoriteCategory: user.favoriteCategory,
        experienceLevel: user.experienceLevel,
        isProfilePublic: user.isProfilePublic ?? true,
        role: userRole,
      },
      accessToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', async (req: AuthRequest, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Verify token
    let decoded: JwtPayload;
    try {
      decoded = verifyToken(refreshToken) as JwtPayload;
    } catch {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Check if token exists in database
    const storedToken = await db.query.refreshTokens.findFirst({
      where: eq(schema.refreshTokens.token, refreshToken),
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    // Get user's current role from database
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, decoded.userId),
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const userRole = (user.role as 'user' | 'admin') || 'user';

    // Generate new access token with current role
    const accessToken = generateAccessToken({ userId: decoded.userId, email: decoded.email, role: userRole });

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    return res.json({ accessToken });
  } catch (error) {
    console.error('Refresh error:', error);
    return res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Logout
router.post('/logout', async (req: AuthRequest, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    let userId: string | undefined;

    if (refreshToken) {
      // Get user ID before deleting token
      const storedToken = await db.query.refreshTokens.findFirst({
        where: eq(schema.refreshTokens.token, refreshToken),
      });
      userId = storedToken?.userId;

      await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.token, refreshToken));
    }

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('participantToken');

    // Log logout
    if (userId) {
      const clientInfo = getClientInfo(req);
      await logAuditEvent({
        action: 'user.logout',
        userId,
        ...clientInfo,
      });
    }

    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user
router.get('/me', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, req.userId!),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      favoriteCategory: user.favoriteCategory,
      experienceLevel: user.experienceLevel,
      isProfilePublic: user.isProfilePublic ?? true,
      role: user.role || 'user',
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update display name
router.patch('/me/display-name', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { displayName } = req.body;

    if (!displayName || typeof displayName !== 'string') {
      return res.status(400).json({ error: 'Display name is required' });
    }

    const trimmedName = displayName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 30) {
      return res.status(400).json({ error: 'Display name must be between 2 and 30 characters' });
    }

    await db.update(schema.users)
      .set({ displayName: trimmedName })
      .where(eq(schema.users.id, req.userId!));

    return res.json({ message: 'Display name updated successfully', displayName: trimmedName });
  } catch (error) {
    console.error('Update display name error:', error);
    return res.status(500).json({ error: 'Failed to update display name' });
  }
});

// Update email
router.patch('/me/email', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and current password are required' });
    }

    // Validate new email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.error });
    }

    const normalizedEmail = normalizeEmail(email);

    // Get current user
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, req.userId!),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Check if email is already taken
    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.email, normalizedEmail),
    });

    if (existingUser && existingUser.id !== req.userId) {
      return res.status(409).json({ error: 'Email is already in use' });
    }

    const oldEmail = user.email;
    await db.update(schema.users)
      .set({ email: normalizedEmail })
      .where(eq(schema.users.id, req.userId!));

    // Log email change
    const clientInfo = getClientInfo(req);
    await logAuditEvent({
      action: 'user.email_change',
      userId: req.userId!,
      ...clientInfo,
      metadata: { oldEmail, newEmail: normalizedEmail },
    });

    return res.json({ message: 'Email updated successfully', email: normalizedEmail });
  } catch (error) {
    console.error('Update email error:', error);
    return res.status(500).json({ error: 'Failed to update email' });
  }
});

// Update password
router.patch('/me/password', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.errors[0] });
    }

    // Get current user
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, req.userId!),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db.update(schema.users)
      .set({ passwordHash })
      .where(eq(schema.users.id, req.userId!));

    // Invalidate all refresh tokens for security
    await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.userId, req.userId!));

    // Log password change
    const clientInfo = getClientInfo(req);
    await logAuditEvent({
      action: 'user.password_change',
      userId: req.userId!,
      ...clientInfo,
    });

    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    return res.status(500).json({ error: 'Failed to update password' });
  }
});

// Upload avatar
router.post('/me/avatar', authenticateUser, avatarUpload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get current user to check for existing avatar
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, req.userId!),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete old avatar file if exists
    if (user.avatarUrl) {
      const oldPath = path.join(process.cwd(), user.avatarUrl);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Save new avatar URL
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    await db.update(schema.users)
      .set({ avatarUrl })
      .where(eq(schema.users.id, req.userId!));

    return res.json({ message: 'Avatar uploaded successfully', avatarUrl });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Delete avatar
router.delete('/me/avatar', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, req.userId!),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.avatarUrl) {
      // Delete the file
      const filePath = path.join(process.cwd(), user.avatarUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Clear the URL in database
      await db.update(schema.users)
        .set({ avatarUrl: null })
        .where(eq(schema.users.id, req.userId!));
    }

    return res.json({ message: 'Avatar deleted successfully' });
  } catch (error) {
    console.error('Avatar delete error:', error);
    return res.status(500).json({ error: 'Failed to delete avatar' });
  }
});

// Export all personal data (GDPR compliance) - rate limited (expensive query)
router.get('/me/export', exportLimiter, authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Get user data
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all sessions where user is moderator
    const moderatedSessions = await db.query.sessions.findMany({
      where: eq(schema.sessions.moderatorId, userId),
    });

    // Get all participations with session details in a single JOIN query
    const participationsWithSessions = await db
      .select({
        participation: schema.participants,
        session: {
          id: schema.sessions.id,
          name: schema.sessions.name,
        },
      })
      .from(schema.participants)
      .innerJoin(schema.sessions, eq(schema.participants.sessionId, schema.sessions.id))
      .where(eq(schema.participants.userId, userId));

    // Get all scores with whiskey and session details in a single JOIN query
    const scoresWithDetails = await db
      .select({
        score: schema.scores,
        whiskey: {
          id: schema.whiskeys.id,
          name: schema.whiskeys.name,
          distillery: schema.whiskeys.distillery,
          age: schema.whiskeys.age,
          proof: schema.whiskeys.proof,
        },
        session: {
          id: schema.sessions.id,
          name: schema.sessions.name,
        },
      })
      .from(schema.scores)
      .innerJoin(schema.participants, eq(schema.scores.participantId, schema.participants.id))
      .innerJoin(schema.whiskeys, eq(schema.scores.whiskeyId, schema.whiskeys.id))
      .innerJoin(schema.sessions, eq(schema.scores.sessionId, schema.sessions.id))
      .where(eq(schema.participants.userId, userId));

    // Get followers and following
    const followers = await db.query.follows.findMany({
      where: eq(schema.follows.followingId, userId),
    });
    const following = await db.query.follows.findMany({
      where: eq(schema.follows.followerId, userId),
    });

    // Build export data
    const exportData = {
      exportDate: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        bio: user.bio,
        favoriteCategory: user.favoriteCategory,
        experienceLevel: user.experienceLevel,
        isProfilePublic: user.isProfilePublic,
        role: user.role,
        createdAt: user.createdAt,
      },
      social: {
        followersCount: followers.length,
        followingCount: following.length,
        followers: followers.map(f => ({ id: f.followerId, followedAt: f.createdAt })),
        following: following.map(f => ({ id: f.followingId, followedAt: f.createdAt })),
      },
      sessions: {
        moderated: moderatedSessions.map(s => ({
          id: s.id,
          name: s.name,
          theme: s.theme,
          status: s.status,
          scheduledAt: s.scheduledAt,
          createdAt: s.createdAt,
        })),
        participated: participationsWithSessions.map(p => ({
          sessionId: p.participation.sessionId,
          sessionName: p.session.name,
          joinedAt: p.participation.joinedAt,
          status: p.participation.status,
        })),
      },
      tastingNotes: scoresWithDetails.map(s => ({
        id: s.score.id,
        session: {
          id: s.session.id,
          name: s.session.name,
        },
        whiskey: {
          id: s.whiskey.id,
          name: s.whiskey.name,
          distillery: s.whiskey.distillery,
          age: s.whiskey.age,
          proof: s.whiskey.proof,
        },
        scores: {
          nose: s.score.nose,
          palate: s.score.palate,
          finish: s.score.finish,
          overall: s.score.overall,
          total: s.score.totalScore,
        },
        notes: {
          nose: s.score.noseNotes,
          palate: s.score.palateNotes,
          finish: s.score.finishNotes,
          general: s.score.generalNotes,
        },
        identityGuess: s.score.identityGuess,
        isPublic: s.score.isPublic,
        lockedAt: s.score.lockedAt,
      })),
    };

    // Log data export
    const clientInfo = getClientInfo(req);
    await logAuditEvent({
      action: 'data.export',
      userId,
      ...clientInfo,
      metadata: { exportType: 'full' },
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="whiskey-canon-data-export-${new Date().toISOString().split('T')[0]}.json"`);
    return res.json(exportData);
  } catch (error) {
    console.error('Export data error:', error);
    return res.status(500).json({ error: 'Failed to export data' });
  }
});

// Export tasting history as CSV or JSON - rate limited (expensive query)
router.get('/me/export/tastings', exportLimiter, authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const format = (req.query.format as string) || 'csv';

    // Single JOIN query to get all tasting data with whiskey and session details
    const tastingData = await db
      .select({
        score: schema.scores,
        whiskey: {
          name: schema.whiskeys.name,
          distillery: schema.whiskeys.distillery,
          age: schema.whiskeys.age,
          proof: schema.whiskeys.proof,
        },
        session: {
          name: schema.sessions.name,
        },
      })
      .from(schema.scores)
      .innerJoin(schema.participants, eq(schema.scores.participantId, schema.participants.id))
      .innerJoin(schema.whiskeys, eq(schema.scores.whiskeyId, schema.whiskeys.id))
      .innerJoin(schema.sessions, eq(schema.scores.sessionId, schema.sessions.id))
      .where(eq(schema.participants.userId, userId))
      .orderBy(desc(schema.scores.lockedAt));

    // Transform to tasting records
    const tastings = tastingData.map(t => ({
      date: t.score.lockedAt ? new Date(t.score.lockedAt).toISOString().split('T')[0] : '',
      sessionName: t.session.name || '',
      whiskeyName: t.whiskey.name || '',
      distillery: t.whiskey.distillery || '',
      age: t.whiskey.age || '',
      proof: t.whiskey.proof || '',
      noseScore: t.score.nose,
      palateScore: t.score.palate,
      finishScore: t.score.finish,
      overallScore: t.score.overall,
      totalScore: t.score.totalScore,
      noseNotes: t.score.noseNotes || '',
      palateNotes: t.score.palateNotes || '',
      finishNotes: t.score.finishNotes || '',
      generalNotes: t.score.generalNotes || '',
      identityGuess: t.score.identityGuess || '',
    }));

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Date',
        'Session',
        'Whiskey',
        'Distillery',
        'Age',
        'Proof',
        'Nose Score',
        'Palate Score',
        'Finish Score',
        'Overall Score',
        'Total Score',
        'Nose Notes',
        'Palate Notes',
        'Finish Notes',
        'General Notes',
        'Identity Guess',
      ];

      const escapeCSV = (value: string | number | null | undefined): string => {
        const str = String(value ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const rows = tastings.map(t => [
        t.date,
        t.sessionName,
        t.whiskeyName,
        t.distillery,
        t.age,
        t.proof,
        t.noseScore,
        t.palateScore,
        t.finishScore,
        t.overallScore,
        t.totalScore,
        t.noseNotes,
        t.palateNotes,
        t.finishNotes,
        t.generalNotes,
        t.identityGuess,
      ].map(escapeCSV).join(','));

      const csv = [headers.join(','), ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="tasting-history-${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    } else {
      // Return JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="tasting-history-${new Date().toISOString().split('T')[0]}.json"`);
      return res.json({ tastings, exportDate: new Date().toISOString() });
    }
  } catch (error) {
    console.error('Export tastings error:', error);
    return res.status(500).json({ error: 'Failed to export tasting history' });
  }
});

// Update profile (bio, favorite category, experience level)
router.patch('/me/profile', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { bio, favoriteCategory, experienceLevel } = req.body;

    // Validate bio length
    if (bio !== undefined && bio !== null) {
      if (typeof bio !== 'string') {
        return res.status(400).json({ error: 'Bio must be a string' });
      }
      if (bio.length > 200) {
        return res.status(400).json({ error: 'Bio must be 200 characters or less' });
      }
    }

    // Validate favorite category
    const validCategories = ['bourbon', 'rye', 'scotch', 'irish', 'japanese', 'canadian', 'other', null, ''];
    if (favoriteCategory !== undefined && !validCategories.includes(favoriteCategory)) {
      return res.status(400).json({ error: 'Invalid whiskey category' });
    }

    // Validate experience level
    const validLevels = ['beginner', 'intermediate', 'advanced', 'expert', null, ''];
    if (experienceLevel !== undefined && !validLevels.includes(experienceLevel)) {
      return res.status(400).json({ error: 'Invalid experience level' });
    }

    // Build update object
    const updates: Record<string, string | null> = {};
    if (bio !== undefined) updates.bio = bio || null;
    if (favoriteCategory !== undefined) updates.favoriteCategory = favoriteCategory || null;
    if (experienceLevel !== undefined) updates.experienceLevel = experienceLevel || null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    await db.update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, req.userId!));

    return res.json({
      message: 'Profile updated successfully',
      ...updates,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
