import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import {
  AuthRequest,
  generateAccessToken,
  generateRefreshToken,
  authenticateUser,
  verifyToken,
  JwtPayload,
} from '../middleware/auth.js';
import { validateEmail, normalizeEmail } from '../utils/validation.js';
import {
  generateVerificationCode,
  getCodeExpiration,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '../services/email.js';

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
router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, password, and display name are required' });
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

// Verify email with 6-digit code
router.post('/verify-email', async (req: AuthRequest, res: Response) => {
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

    // Check code
    if (user.verificationCode !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Check expiration
    if (!user.verificationCodeExpiresAt || user.verificationCodeExpiresAt < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    // Mark as verified and clear code
    await db.update(schema.users)
      .set({
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpiresAt: null,
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
router.post('/resend-verification', async (req: AuthRequest, res: Response) => {
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
router.post('/forgot-password', async (req: AuthRequest, res: Response) => {
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

    // Generate reset code
    const resetCode = generateVerificationCode();
    const resetCodeExpiresAt = getCodeExpiration();

    await db.update(schema.users)
      .set({
        resetPasswordCode: resetCode,
        resetPasswordCodeExpiresAt: resetCodeExpiresAt,
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
router.post('/reset-password', async (req: AuthRequest, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, code, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = normalizeEmail(email);

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, normalizedEmail),
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    // Check code
    if (user.resetPasswordCode !== code) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    // Check expiration
    if (!user.resetPasswordCodeExpiresAt || user.resetPasswordCodeExpiresAt < new Date()) {
      return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password and clear reset code
    await db.update(schema.users)
      .set({
        passwordHash,
        resetPasswordCode: null,
        resetPasswordCodeExpiresAt: null,
      })
      .where(eq(schema.users.id, user.id));

    // Invalidate all refresh tokens for security
    await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.userId, user.id));

    return res.json({ message: 'Password reset successfully. Please log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Login
router.post('/login', async (req: AuthRequest, res: Response) => {
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
      maxAge: 24 * 60 * 60 * 1000,
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

    if (refreshToken) {
      await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.token, refreshToken));
    }

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('participantToken');

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

    await db.update(schema.users)
      .set({ email: normalizedEmail })
      .where(eq(schema.users.id, req.userId!));

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

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
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

// Export all personal data (GDPR compliance)
router.get('/me/export', authenticateUser, async (req: AuthRequest, res: Response) => {
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

    // Get all participations
    const participations = await db.query.participants.findMany({
      where: eq(schema.participants.userId, userId),
    });

    // Get all scores for user's participations
    const participantIds = participations.map(p => p.id);
    const allScores = participantIds.length > 0
      ? await db.select().from(schema.scores).where(
          // Get scores for all participant IDs
          eq(schema.scores.participantId, participantIds[0])
        )
      : [];

    // For multiple participant IDs, fetch all scores
    const userScores: typeof allScores = [];
    for (const pid of participantIds) {
      const scores = await db.query.scores.findMany({
        where: eq(schema.scores.participantId, pid),
      });
      userScores.push(...scores);
    }

    // Get whiskey details for scores
    const whiskeyIds = [...new Set(userScores.map(s => s.whiskeyId))];
    const whiskeys: Record<string, typeof schema.whiskeys.$inferSelect> = {};
    for (const wid of whiskeyIds) {
      const whiskey = await db.query.whiskeys.findFirst({
        where: eq(schema.whiskeys.id, wid),
      });
      if (whiskey) whiskeys[wid] = whiskey;
    }

    // Get session details
    const sessionIds = [...new Set([
      ...participations.map(p => p.sessionId),
      ...moderatedSessions.map(s => s.id),
    ])];
    const sessionsMap: Record<string, typeof schema.sessions.$inferSelect> = {};
    for (const sid of sessionIds) {
      const session = await db.query.sessions.findFirst({
        where: eq(schema.sessions.id, sid),
      });
      if (session) sessionsMap[sid] = session;
    }

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
        participated: participations.map(p => {
          const session = sessionsMap[p.sessionId];
          return {
            sessionId: p.sessionId,
            sessionName: session?.name,
            joinedAt: p.joinedAt,
            status: p.status,
          };
        }),
      },
      tastingNotes: userScores.map(score => {
        const whiskey = whiskeys[score.whiskeyId];
        const session = sessionsMap[score.sessionId];
        return {
          id: score.id,
          session: {
            id: score.sessionId,
            name: session?.name,
          },
          whiskey: {
            id: score.whiskeyId,
            name: whiskey?.name,
            distillery: whiskey?.distillery,
            age: whiskey?.age,
            proof: whiskey?.proof,
          },
          scores: {
            nose: score.nose,
            palate: score.palate,
            finish: score.finish,
            overall: score.overall,
            total: score.totalScore,
          },
          notes: {
            nose: score.noseNotes,
            palate: score.palateNotes,
            finish: score.finishNotes,
            general: score.generalNotes,
          },
          identityGuess: score.identityGuess,
          isPublic: score.isPublic,
          lockedAt: score.lockedAt,
        };
      }),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="whiskey-canon-data-export-${new Date().toISOString().split('T')[0]}.json"`);
    return res.json(exportData);
  } catch (error) {
    console.error('Export data error:', error);
    return res.status(500).json({ error: 'Failed to export data' });
  }
});

// Export tasting history as CSV or JSON
router.get('/me/export/tastings', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const format = (req.query.format as string) || 'csv';

    // Get all participations for user
    const participations = await db.query.participants.findMany({
      where: eq(schema.participants.userId, userId),
    });

    // Get all scores for user's participations
    const participantIds = participations.map(p => p.id);
    const userScores: (typeof schema.scores.$inferSelect)[] = [];
    for (const pid of participantIds) {
      const scores = await db.query.scores.findMany({
        where: eq(schema.scores.participantId, pid),
      });
      userScores.push(...scores);
    }

    // Get whiskey and session details
    const whiskeyIds = [...new Set(userScores.map(s => s.whiskeyId))];
    const sessionIds = [...new Set(userScores.map(s => s.sessionId))];

    const whiskeys: Record<string, typeof schema.whiskeys.$inferSelect> = {};
    const sessions: Record<string, typeof schema.sessions.$inferSelect> = {};

    for (const wid of whiskeyIds) {
      const whiskey = await db.query.whiskeys.findFirst({
        where: eq(schema.whiskeys.id, wid),
      });
      if (whiskey) whiskeys[wid] = whiskey;
    }

    for (const sid of sessionIds) {
      const session = await db.query.sessions.findFirst({
        where: eq(schema.sessions.id, sid),
      });
      if (session) sessions[sid] = session;
    }

    // Build tasting data
    const tastings = userScores.map(score => {
      const whiskey = whiskeys[score.whiskeyId];
      const session = sessions[score.sessionId];
      return {
        date: score.lockedAt ? new Date(score.lockedAt).toISOString().split('T')[0] : '',
        sessionName: session?.name || '',
        whiskeyName: whiskey?.name || '',
        distillery: whiskey?.distillery || '',
        age: whiskey?.age || '',
        proof: whiskey?.proof || '',
        noseScore: score.nose,
        palateScore: score.palate,
        finishScore: score.finish,
        overallScore: score.overall,
        totalScore: score.totalScore,
        noseNotes: score.noseNotes || '',
        palateNotes: score.palateNotes || '',
        finishNotes: score.finishNotes || '',
        generalNotes: score.generalNotes || '',
        identityGuess: score.identityGuess || '',
      };
    });

    // Sort by date descending
    tastings.sort((a, b) => b.date.localeCompare(a.date));

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
