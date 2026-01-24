import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import {
  AuthRequest,
  generateAccessToken,
  generateRefreshToken,
  authenticateUser,
  verifyToken,
  JwtPayload,
} from '../middleware/auth';
import { validateEmail, normalizeEmail } from '../utils/validation';

const router = Router();

// Register a new user
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
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const userId = uuidv4();
    const now = new Date();

    await db.insert(schema.users).values({
      id: userId,
      email: normalizedEmail,
      passwordHash,
      displayName,
      createdAt: now,
    });

    // Generate tokens (new users default to 'user' role)
    const accessToken = generateAccessToken({ userId, email: normalizedEmail, role: 'user' });
    const refreshToken = generateRefreshToken({ userId, email: normalizedEmail, role: 'user' });

    // Store refresh token
    await db.insert(schema.refreshTokens).values({
      id: uuidv4(),
      userId,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: now,
    });

    // Set cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(201).json({
      user: {
        id: userId,
        email: normalizedEmail,
        displayName,
        role: 'user',
      },
      accessToken,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Registration failed' });
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

export default router;
