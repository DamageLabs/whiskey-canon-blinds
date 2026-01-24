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

const router = Router();

// Register a new user
router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, password, and display name are required' });
    }

    // Check if user exists
    const existing = await db.query.users.findFirst({
      where: eq(schema.users.email, email.toLowerCase()),
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
      email: email.toLowerCase(),
      passwordHash,
      displayName,
      createdAt: now,
    });

    // Generate tokens (new users default to 'user' role)
    const accessToken = generateAccessToken({ userId, email: email.toLowerCase(), role: 'user' });
    const refreshToken = generateRefreshToken({ userId, email: email.toLowerCase(), role: 'user' });

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
        email: email.toLowerCase(),
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

export default router;
