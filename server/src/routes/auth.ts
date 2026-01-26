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
