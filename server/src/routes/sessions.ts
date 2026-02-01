import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { randomInt } from 'crypto';
import jwt from 'jsonwebtoken';
import PDFDocument from 'pdfkit';
import { db, schema } from '../db/index.js';
import { eq, and, gt, asc, desc, or } from 'drizzle-orm';
import {
  AuthRequest,
  authenticateUser,
  authenticateParticipant,
  authenticateAny,
  generateParticipantToken,
  getJwtSecret,
} from '../middleware/auth.js';
import { sessionJoinLimiter } from '../middleware/rateLimit.js';
import { getIO } from '../socket/index.js';
import { validateLength, INPUT_LIMITS } from '../utils/validation.js';
import { logger } from '../utils/logger.js';
import { sendSessionInviteEmail } from '../services/email.js';

const router = Router();

// Generate a 6-character invite code using cryptographic RNG
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(randomInt(0, chars.length));
  }
  return code;
}

// Create a new session (requires authenticated user)
router.post('/', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { name, hostName, theme, customTheme, proofMin, proofMax, maxParticipants, whiskeys, scheduledAt } = req.body;

    if (!name || !theme) {
      return res.status(400).json({ error: 'Name and theme are required' });
    }

    if (!hostName) {
      return res.status(400).json({ error: 'Host name is required' });
    }

    // Validate input lengths
    const nameLengthCheck = validateLength(name, INPUT_LIMITS.SESSION_NAME, 'Session name');
    if (!nameLengthCheck.valid) {
      return res.status(400).json({ error: nameLengthCheck.error });
    }

    const hostNameLengthCheck = validateLength(hostName, INPUT_LIMITS.DISPLAY_NAME, 'Host name');
    if (!hostNameLengthCheck.valid) {
      return res.status(400).json({ error: hostNameLengthCheck.error });
    }

    const themeLengthCheck = validateLength(theme, INPUT_LIMITS.SESSION_THEME, 'Theme');
    if (!themeLengthCheck.valid) {
      return res.status(400).json({ error: themeLengthCheck.error });
    }

    if (customTheme) {
      const customThemeLengthCheck = validateLength(customTheme, INPUT_LIMITS.SESSION_THEME, 'Custom theme');
      if (!customThemeLengthCheck.valid) {
        return res.status(400).json({ error: customThemeLengthCheck.error });
      }
    }

    if (!whiskeys || !Array.isArray(whiskeys) || whiskeys.length === 0) {
      return res.status(400).json({ error: 'At least one whiskey is required' });
    }

    if (whiskeys.length > 6) {
      return res.status(400).json({ error: 'Maximum 6 whiskeys allowed' });
    }

    // Validate whiskey field lengths
    for (const w of whiskeys) {
      if (w.name) {
        const whiskeyNameCheck = validateLength(w.name, INPUT_LIMITS.WHISKEY_NAME, 'Whiskey name');
        if (!whiskeyNameCheck.valid) {
          return res.status(400).json({ error: whiskeyNameCheck.error });
        }
      }
      if (w.distillery) {
        const distilleryCheck = validateLength(w.distillery, INPUT_LIMITS.WHISKEY_DISTILLERY, 'Distillery');
        if (!distilleryCheck.valid) {
          return res.status(400).json({ error: distilleryCheck.error });
        }
      }
    }

    const sessionId = uuidv4();
    const inviteCode = generateInviteCode();
    const now = new Date();

    // Parse scheduledAt or default to now
    let sessionScheduledAt = now;
    let initialStatus = 'waiting';

    if (scheduledAt) {
      const parsedDate = new Date(scheduledAt);
      if (!isNaN(parsedDate.getTime())) {
        sessionScheduledAt = parsedDate;
        // If scheduled for the future, set status to 'scheduled'
        if (parsedDate > now) {
          initialStatus = 'scheduled';
        }
      }
    }

    // Create session
    await db.insert(schema.sessions).values({
      id: sessionId,
      name,
      theme,
      customTheme,
      proofMin,
      proofMax,
      scheduledAt: sessionScheduledAt,
      status: initialStatus,
      moderatorId: req.userId!,
      currentWhiskeyIndex: 0,
      currentPhase: 'pour',
      inviteCode,
      maxParticipants,
      createdAt: now,
      updatedAt: now,
    });

    // Create whiskeys
    for (let i = 0; i < whiskeys.length; i++) {
      const w = whiskeys[i];
      await db.insert(schema.whiskeys).values({
        id: uuidv4(),
        sessionId,
        displayNumber: i + 1,
        name: w.name,
        distillery: w.distillery,
        age: w.age,
        proof: w.proof,
        price: w.price,
        mashbill: w.mashbill,
        region: w.region,
        pourSize: w.pourSize || '0.5oz',
      });
    }

    // Add moderator as a participant
    const participantId = uuidv4();
    await db.insert(schema.participants).values({
      id: participantId,
      sessionId,
      userId: req.userId!,
      displayName: hostName,
      joinedAt: now,
      status: 'waiting',
      isReady: true,
      currentWhiskeyIndex: 0,
    });

    // Generate participant token for the host
    const participantToken = generateParticipantToken({
      participantId,
      sessionId,
      displayName: hostName,
    });

    res.cookie('participantToken', participantToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    return res.status(201).json({
      id: sessionId,
      inviteCode,
      participantId,
      participantToken,
    });
  } catch (error) {
    logger.error('Create session error:', error);
    return res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get session by ID
router.get('/:sessionId', async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    const session = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionWhiskeys = await db.query.whiskeys.findMany({
      where: eq(schema.whiskeys.sessionId, sessionId),
    });

    const sessionParticipants = await db.query.participants.findMany({
      where: eq(schema.participants.sessionId, sessionId),
    });

    // Check if requester is the moderator
    let isModerator = false;
    let currentParticipantId: string | null = null;

    // Check via access token (user authentication)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
        if (decoded.userId === session.moderatorId) {
          isModerator = true;
        }
      } catch (err) {
        logger.debug('Access token verification failed:', err instanceof Error ? err.message : 'Unknown error');
      }
    }

    // Check via participant token
    const participantToken = req.headers['x-participant-token'] as string;
    if (participantToken) {
      try {
        const decoded = jwt.verify(participantToken, getJwtSecret()) as { participantId: string; sessionId: string };
        currentParticipantId = decoded.participantId;

        // Check if this participant is the moderator
        const participant = await db.query.participants.findFirst({
          where: eq(schema.participants.id, decoded.participantId),
        });

        if (participant?.userId && participant.userId === session.moderatorId) {
          isModerator = true;
        }
      } catch (err) {
        logger.debug('Participant token verification failed:', err instanceof Error ? err.message : 'Unknown error');
      }
    }

    // Only reveal whiskey details if status is 'reveal' or 'completed'
    const isRevealed = session.status === 'reveal' || session.status === 'completed';

    return res.json({
      ...session,
      isModerator,
      currentParticipantId,
      whiskeys: sessionWhiskeys.map((w) => ({
        id: w.id,
        displayNumber: w.displayNumber,
        pourSize: w.pourSize,
        // Only reveal identity after reveal
        ...(isRevealed && {
          name: w.name,
          distillery: w.distillery,
          age: w.age,
          proof: w.proof,
          price: w.price,
        }),
      })),
      participants: sessionParticipants.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        status: p.status,
        isReady: p.isReady,
        currentWhiskeyIndex: p.currentWhiskeyIndex,
      })),
    });
  } catch (error) {
    logger.error('Get session error:', error);
    return res.status(500).json({ error: 'Failed to get session' });
  }
});

// Join session by invite code
router.post('/join', sessionJoinLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { inviteCode, displayName } = req.body;

    if (!inviteCode || !displayName) {
      return res.status(400).json({ error: 'Invite code and display name are required' });
    }

    // Validate input lengths
    const inviteCodeLengthCheck = validateLength(inviteCode, INPUT_LIMITS.INVITE_CODE, 'Invite code');
    if (!inviteCodeLengthCheck.valid) {
      return res.status(400).json({ error: inviteCodeLengthCheck.error });
    }

    const displayNameLengthCheck = validateLength(displayName, INPUT_LIMITS.DISPLAY_NAME, 'Display name');
    if (!displayNameLengthCheck.valid) {
      return res.status(400).json({ error: displayNameLengthCheck.error });
    }

    const code = inviteCode.replace(/[^A-Z0-9]/gi, '').toUpperCase();

    const session = await db.query.sessions.findFirst({
      where: eq(schema.sessions.inviteCode, code),
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'completed') {
      return res.status(400).json({ error: 'Session has ended' });
    }

    // Check if user is the moderator trying to rejoin
    // Get userId from Authorization header if present
    let userId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
        userId = decoded.userId;
      } catch {
        // Invalid token, continue as guest
      }
    }

    const isModerator = userId && session.moderatorId === userId;

    // Check if moderator already has a participant record
    if (isModerator && userId) {
      const existingParticipant = await db.query.participants.findFirst({
        where: and(
          eq(schema.participants.sessionId, session.id),
          eq(schema.participants.userId, userId)
        ),
      });

      if (existingParticipant) {
        // Moderator is rejoining - generate new token for existing participant
        const participantToken = generateParticipantToken({
          participantId: existingParticipant.id,
          sessionId: session.id,
          displayName: existingParticipant.displayName,
        });

        res.cookie('participantToken', participantToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({
          sessionId: session.id,
          participantId: existingParticipant.id,
          participantToken,
          isModerator: true,
          session: {
            id: session.id,
            name: session.name,
            theme: session.theme,
            status: session.status,
          },
        });
      }
    }

    // Check participant limit (skip for moderator)
    if (!isModerator && session.maxParticipants) {
      const count = await db.query.participants.findMany({
        where: eq(schema.participants.sessionId, session.id),
      });
      if (count.length >= session.maxParticipants) {
        return res.status(400).json({ error: 'Session is full' });
      }
    }

    const participantId = uuidv4();
    const now = new Date();

    await db.insert(schema.participants).values({
      id: participantId,
      sessionId: session.id,
      userId: userId,
      displayName,
      joinedAt: now,
      status: 'waiting',
      isReady: isModerator ? true : false,
      currentWhiskeyIndex: 0,
    });

    // Generate participant token
    const participantToken = generateParticipantToken({
      participantId,
      sessionId: session.id,
      displayName,
    });

    res.cookie('participantToken', participantToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Notify other participants
    const io = getIO();
    io.to(session.id).emit('participant:joined', {
      id: participantId,
      displayName,
      status: 'waiting',
      isReady: isModerator ? true : false,
    });

    return res.status(201).json({
      sessionId: session.id,
      participantId,
      participantToken,
      isModerator,
      session: {
        id: session.id,
        name: session.name,
        theme: session.theme,
        status: session.status,
      },
    });
  } catch (error) {
    logger.error('Join session error:', error);
    return res.status(500).json({ error: 'Failed to join session' });
  }
});

// Start session (moderator only)
router.post('/:sessionId/start', authenticateAny, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    const session = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if user is moderator
    let isModerator = false;
    if (req.userId && session.moderatorId === req.userId) {
      isModerator = true;
    } else if (req.participantId) {
      const participant = await db.query.participants.findFirst({
        where: eq(schema.participants.id, req.participantId),
      });
      if (participant?.userId === session.moderatorId) {
        isModerator = true;
      }
    }

    if (!isModerator) {
      return res.status(403).json({ error: 'Only the moderator can start the session' });
    }

    if (session.status !== 'waiting') {
      return res.status(400).json({ error: 'Session has already started' });
    }

    const now = new Date();
    await db.update(schema.sessions)
      .set({ status: 'active', updatedAt: now })
      .where(eq(schema.sessions.id, sessionId));

    // Notify all participants
    const io = getIO();
    io.to(sessionId).emit('session:started', { sessionId });

    return res.json({ message: 'Session started' });
  } catch (error) {
    logger.error('Start session error:', error);
    return res.status(500).json({ error: 'Failed to start session' });
  }
});

// Advance phase (moderator only)
router.post('/:sessionId/advance', authenticateAny, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const { phase, whiskeyIndex } = req.body;

    const session = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if user is moderator
    let isModerator = false;
    if (req.userId && session.moderatorId === req.userId) {
      isModerator = true;
    } else if (req.participantId) {
      const participant = await db.query.participants.findFirst({
        where: eq(schema.participants.id, req.participantId),
      });
      if (participant?.userId === session.moderatorId) {
        isModerator = true;
      }
    }

    if (!isModerator) {
      return res.status(403).json({ error: 'Only the moderator can advance the session' });
    }

    const updates: Partial<schema.Session> = { updatedAt: new Date() };
    if (phase) updates.currentPhase = phase;
    if (whiskeyIndex !== undefined) updates.currentWhiskeyIndex = whiskeyIndex;

    await db.update(schema.sessions)
      .set(updates)
      .where(eq(schema.sessions.id, sessionId));

    // Notify all participants
    const io = getIO();
    io.to(sessionId).emit('session:advanced', {
      sessionId,
      phase: phase || session.currentPhase,
      whiskeyIndex: whiskeyIndex ?? session.currentWhiskeyIndex,
    });

    return res.json({
      phase: phase || session.currentPhase,
      whiskeyIndex: whiskeyIndex ?? session.currentWhiskeyIndex,
    });
  } catch (error) {
    logger.error('Advance session error:', error);
    return res.status(500).json({ error: 'Failed to advance session' });
  }
});

// Reveal results (moderator only)
router.post('/:sessionId/reveal', authenticateAny, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    const session = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if user is moderator (via user token or participant token)
    let isModerator = false;
    if (req.userId && session.moderatorId === req.userId) {
      isModerator = true;
    } else if (req.participantId) {
      // Check if this participant is the moderator
      const participant = await db.query.participants.findFirst({
        where: eq(schema.participants.id, req.participantId),
      });
      if (participant?.userId === session.moderatorId) {
        isModerator = true;
      }
    }

    if (!isModerator) {
      return res.status(403).json({ error: 'Only the moderator can reveal results' });
    }

    const now = new Date();
    await db.update(schema.sessions)
      .set({ status: 'reveal', updatedAt: now })
      .where(eq(schema.sessions.id, sessionId));

    // Get full whiskey details for reveal
    const sessionWhiskeys = await db.query.whiskeys.findMany({
      where: eq(schema.whiskeys.sessionId, sessionId),
    });

    // Get all scores
    const sessionScores = await db.query.scores.findMany({
      where: eq(schema.scores.sessionId, sessionId),
    });

    // Notify all participants
    const io = getIO();
    io.to(sessionId).emit('session:reveal', {
      sessionId,
      whiskeys: sessionWhiskeys,
      scores: sessionScores,
    });

    return res.json({
      whiskeys: sessionWhiskeys,
      scores: sessionScores,
    });
  } catch (error) {
    logger.error('Reveal session error:', error);
    return res.status(500).json({ error: 'Failed to reveal session' });
  }
});

// Pause session (moderator only)
router.post('/:sessionId/pause', authenticateAny, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    const session = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if user is moderator
    let isModerator = false;
    if (req.userId && session.moderatorId === req.userId) {
      isModerator = true;
    } else if (req.participantId) {
      const participant = await db.query.participants.findFirst({
        where: eq(schema.participants.id, req.participantId),
      });
      if (participant?.userId === session.moderatorId) {
        isModerator = true;
      }
    }

    if (!isModerator) {
      return res.status(403).json({ error: 'Only the moderator can pause the session' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    const now = new Date();
    await db.update(schema.sessions)
      .set({ status: 'paused', updatedAt: now })
      .where(eq(schema.sessions.id, sessionId));

    // Notify all participants
    const io = getIO();
    io.to(sessionId).emit('session:paused', { sessionId });

    return res.json({ message: 'Session paused' });
  } catch (error) {
    logger.error('Pause session error:', error);
    return res.status(500).json({ error: 'Failed to pause session' });
  }
});

// Resume session (moderator only)
router.post('/:sessionId/resume', authenticateAny, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    const session = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if user is moderator
    let isModerator = false;
    if (req.userId && session.moderatorId === req.userId) {
      isModerator = true;
    } else if (req.participantId) {
      const participant = await db.query.participants.findFirst({
        where: eq(schema.participants.id, req.participantId),
      });
      if (participant?.userId === session.moderatorId) {
        isModerator = true;
      }
    }

    if (!isModerator) {
      return res.status(403).json({ error: 'Only the moderator can resume the session' });
    }

    if (session.status !== 'paused') {
      return res.status(400).json({ error: 'Session is not paused' });
    }

    const now = new Date();
    await db.update(schema.sessions)
      .set({ status: 'active', updatedAt: now })
      .where(eq(schema.sessions.id, sessionId));

    // Notify all participants
    const io = getIO();
    io.to(sessionId).emit('session:resumed', { sessionId });

    return res.json({ message: 'Session resumed' });
  } catch (error) {
    logger.error('Resume session error:', error);
    return res.status(500).json({ error: 'Failed to resume session' });
  }
});

// End session (moderator only)
router.post('/:sessionId/end', authenticateAny, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    const session = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if user is moderator
    let isModerator = false;
    if (req.userId && session.moderatorId === req.userId) {
      isModerator = true;
    } else if (req.participantId) {
      const participant = await db.query.participants.findFirst({
        where: eq(schema.participants.id, req.participantId),
      });
      if (participant?.userId === session.moderatorId) {
        isModerator = true;
      }
    }

    if (!isModerator) {
      return res.status(403).json({ error: 'Only the moderator can end the session' });
    }

    const now = new Date();
    await db.update(schema.sessions)
      .set({ status: 'completed', updatedAt: now })
      .where(eq(schema.sessions.id, sessionId));

    // Notify all participants
    const io = getIO();
    io.to(sessionId).emit('session:ended', { sessionId });

    return res.json({ message: 'Session ended' });
  } catch (error) {
    logger.error('End session error:', error);
    return res.status(500).json({ error: 'Failed to end session' });
  }
});

// Get user's sessions
router.get('/', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const userSessions = await db.query.sessions.findMany({
      where: eq(schema.sessions.moderatorId, req.userId!),
    });

    return res.json(userSessions);
  } catch (error) {
    logger.error('Get sessions error:', error);
    return res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// Get upcoming scheduled sessions for the current user
router.get('/upcoming', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();

    // Get upcoming sessions where user is moderator
    const moderatedSessions = await db.query.sessions.findMany({
      where: and(
        eq(schema.sessions.moderatorId, req.userId!),
        gt(schema.sessions.scheduledAt, now),
        or(
          eq(schema.sessions.status, 'scheduled'),
          eq(schema.sessions.status, 'draft'),
          eq(schema.sessions.status, 'waiting')
        )
      ),
      orderBy: [asc(schema.sessions.scheduledAt)],
    });

    // Get upcoming sessions where user is participant
    const participations = await db.query.participants.findMany({
      where: eq(schema.participants.userId, req.userId!),
    });

    const participantSessionIds = participations.map((p) => p.sessionId);

    // Filter participated sessions that are upcoming
    const participatedSessions = participantSessionIds.length > 0
      ? await db.query.sessions.findMany({
          where: and(
            gt(schema.sessions.scheduledAt, now),
            or(
              eq(schema.sessions.status, 'scheduled'),
              eq(schema.sessions.status, 'draft'),
              eq(schema.sessions.status, 'waiting')
            )
          ),
          orderBy: [asc(schema.sessions.scheduledAt)],
        })
      : [];

    // Filter to only include sessions user is participating in
    const filteredParticipated = participatedSessions.filter(
      (s) => participantSessionIds.includes(s.id) && s.moderatorId !== req.userId
    );

    // Combine and sort by scheduled date
    const allUpcoming = [...moderatedSessions, ...filteredParticipated]
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

    // Add moderator info and participant count
    const sessionsWithDetails = await Promise.all(
      allUpcoming.map(async (session) => {
        const participants = await db.query.participants.findMany({
          where: eq(schema.participants.sessionId, session.id),
        });

        return {
          ...session,
          isModerator: session.moderatorId === req.userId,
          participantCount: participants.length,
        };
      })
    );

    return res.json(sessionsWithDetails);
  } catch (error) {
    logger.error('Get upcoming sessions error:', error);
    return res.status(500).json({ error: 'Failed to get upcoming sessions' });
  }
});

// Export session results as PDF
router.get('/:sessionId/export/pdf', authenticateAny, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    const session = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Session must be in reveal or completed status
    if (session.status !== 'reveal' && session.status !== 'completed') {
      return res.status(400).json({ error: 'Session results are not yet available' });
    }

    // Get whiskeys
    const sessionWhiskeys = await db.query.whiskeys.findMany({
      where: eq(schema.whiskeys.sessionId, sessionId),
    });

    // Get participants
    const sessionParticipants = await db.query.participants.findMany({
      where: eq(schema.participants.sessionId, sessionId),
    });

    // Get all scores
    const sessionScores = await db.query.scores.findMany({
      where: eq(schema.scores.sessionId, sessionId),
    });

    // Calculate results for each whiskey
    const whiskeyResults = sessionWhiskeys.map((whiskey) => {
      const whiskeyScores = sessionScores.filter((s) => s.whiskeyId === whiskey.id);
      const scoreCount = whiskeyScores.length;

      if (scoreCount === 0) {
        return {
          whiskey,
          averageScore: 0,
          categoryAverages: { nose: 0, palate: 0, finish: 0, overall: 0 },
          scoreCount: 0,
        };
      }

      const avgNose = whiskeyScores.reduce((sum, s) => sum + s.nose, 0) / scoreCount;
      const avgPalate = whiskeyScores.reduce((sum, s) => sum + s.palate, 0) / scoreCount;
      const avgFinish = whiskeyScores.reduce((sum, s) => sum + s.finish, 0) / scoreCount;
      const avgOverall = whiskeyScores.reduce((sum, s) => sum + s.overall, 0) / scoreCount;
      const avgTotal = whiskeyScores.reduce((sum, s) => sum + s.totalScore, 0) / scoreCount;

      return {
        whiskey,
        averageScore: avgTotal,
        categoryAverages: {
          nose: avgNose,
          palate: avgPalate,
          finish: avgFinish,
          overall: avgOverall,
        },
        scoreCount,
      };
    });

    // Sort by average score descending
    whiskeyResults.sort((a, b) => b.averageScore - a.averageScore);

    // Assign rankings
    whiskeyResults.forEach((result, index) => {
      (result as { ranking?: number }).ranking = index + 1;
    });

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${session.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-results.pdf"`
    );

    // Pipe the PDF to the response
    doc.pipe(res);

    // Title
    doc.fontSize(24).fillColor('#d97706').text('Whiskey Canon', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(20).fillColor('#1f2937').text(session.name, { align: 'center' });
    doc.moveDown(0.3);

    // Session info
    doc.fontSize(12).fillColor('#6b7280');
    doc.text(`Theme: ${session.theme}${session.customTheme ? ` (${session.customTheme})` : ''}`, { align: 'center' });
    doc.text(`Date: ${session.scheduledAt.toLocaleDateString()}`, { align: 'center' });
    doc.text(`Participants: ${sessionParticipants.length}`, { align: 'center' });
    doc.moveDown(1.5);

    // Winner section
    const winner = whiskeyResults[0];
    if (winner && winner.scoreCount > 0) {
      doc.fontSize(14).fillColor('#92400e').text('WINNER', { align: 'center' });
      doc.fontSize(18).fillColor('#78350f').text(winner.whiskey.name, { align: 'center' });
      doc.fontSize(12).fillColor('#92400e').text(winner.whiskey.distillery, { align: 'center' });
      doc.fontSize(24).fillColor('#d97706').text(`${winner.averageScore.toFixed(1)} / 10`, { align: 'center' });
      doc.moveDown(1.5);
    }

    // Results table header
    doc.fontSize(10).fillColor('#6b7280');
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 80;
    const col3 = 280;
    const col4 = 340;
    const col5 = 390;
    const col6 = 440;
    const col7 = 490;

    doc.text('Rank', col1, tableTop);
    doc.text('Whiskey', col2, tableTop);
    doc.text('Score', col3, tableTop);
    doc.text('Nose', col4, tableTop);
    doc.text('Palate', col5, tableTop);
    doc.text('Finish', col6, tableTop);
    doc.text('Overall', col7, tableTop);
    doc.moveDown(0.5);

    // Draw line under header
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#e5e7eb');
    doc.moveDown(0.5);

    // Results rows
    whiskeyResults.forEach((result) => {
      const y = doc.y;
      const ranking = (result as { ranking?: number }).ranking || 0;

      // Rank
      doc.fontSize(12).fillColor(ranking <= 3 ? '#d97706' : '#374151');
      doc.text(`#${ranking}`, col1, y);

      // Whiskey info
      doc.fontSize(10).fillColor('#1f2937');
      doc.text(result.whiskey.name, col2, y, { width: 180 });
      doc.fontSize(8).fillColor('#6b7280');
      const detailsY = y + 12;
      let details = result.whiskey.distillery;
      if (result.whiskey.age) details += ` | ${result.whiskey.age}yr`;
      if (result.whiskey.proof) details += ` | ${result.whiskey.proof}°`;
      doc.text(details, col2, detailsY, { width: 180 });

      // Scores
      doc.fontSize(12).fillColor('#d97706');
      doc.text(result.averageScore.toFixed(1), col3, y);

      doc.fontSize(10).fillColor('#374151');
      doc.text(result.categoryAverages.nose.toFixed(1), col4, y);
      doc.text(result.categoryAverages.palate.toFixed(1), col5, y);
      doc.text(result.categoryAverages.finish.toFixed(1), col6, y);
      doc.text(result.categoryAverages.overall.toFixed(1), col7, y);

      doc.moveDown(1.5);
    });

    // Participant stats section
    doc.moveDown(1);
    doc.fontSize(14).fillColor('#1f2937').text('Participant Statistics', { underline: true });
    doc.moveDown(0.5);

    sessionParticipants.forEach((participant) => {
      const participantScores = sessionScores.filter((s) => s.participantId === participant.id);
      if (participantScores.length === 0) return;

      const avgScore = participantScores.reduce((sum, s) => sum + s.totalScore, 0) / participantScores.length;

      doc.fontSize(10).fillColor('#374151');
      doc.text(`${participant.displayName}: ${avgScore.toFixed(2)} avg (${participantScores.length} whiskeys rated)`);
    });

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).fillColor('#9ca3af');
    doc.text(`Generated by Whiskey Canon Blinds on ${new Date().toLocaleDateString()}`, { align: 'center' });

    // Finalize PDF
    doc.end();
  } catch (error) {
    logger.error('Export PDF error:', error);
    return res.status(500).json({ error: 'Failed to export PDF' });
  }
});

// Duplicate session
router.post('/:sessionId/duplicate', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    const session = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Only allow moderator to duplicate their own sessions
    if (session.moderatorId !== req.userId) {
      return res.status(403).json({ error: 'Only the session moderator can duplicate this session' });
    }

    // Get whiskeys from original session
    const originalWhiskeys = await db.query.whiskeys.findMany({
      where: eq(schema.whiskeys.sessionId, sessionId),
    });

    // Create new session
    const newSessionId = uuidv4();
    const inviteCode = generateInviteCode();
    const now = new Date();

    await db.insert(schema.sessions).values({
      id: newSessionId,
      name: `${session.name} (Copy)`,
      theme: session.theme,
      customTheme: session.customTheme,
      proofMin: session.proofMin,
      proofMax: session.proofMax,
      scheduledAt: now,
      status: 'draft',
      moderatorId: req.userId!,
      currentWhiskeyIndex: 0,
      currentPhase: 'pour',
      inviteCode,
      maxParticipants: session.maxParticipants,
      createdAt: now,
      updatedAt: now,
    });

    // Copy whiskeys
    for (const w of originalWhiskeys) {
      await db.insert(schema.whiskeys).values({
        id: uuidv4(),
        sessionId: newSessionId,
        displayNumber: w.displayNumber,
        name: w.name,
        distillery: w.distillery,
        age: w.age,
        proof: w.proof,
        price: w.price,
        mashbill: w.mashbill,
        region: w.region,
        pourSize: w.pourSize,
      });
    }

    logger.info(`Session ${sessionId} duplicated to ${newSessionId} by user ${req.userId}`);

    return res.status(201).json({
      id: newSessionId,
      inviteCode,
      message: 'Session duplicated successfully',
    });
  } catch (error) {
    logger.error('Duplicate session error:', error);
    return res.status(500).json({ error: 'Failed to duplicate session' });
  }
});

// Send session invite email
router.post('/:sessionId/invite', authenticateAny, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const session = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if user is moderator
    let isModerator = false;
    if (req.userId && session.moderatorId === req.userId) {
      isModerator = true;
    } else if (req.participantId) {
      const participant = await db.query.participants.findFirst({
        where: eq(schema.participants.id, req.participantId),
      });
      if (participant?.userId === session.moderatorId) {
        isModerator = true;
      }
    }

    if (!isModerator) {
      return res.status(403).json({ error: 'Only the moderator can send invites' });
    }

    // Get moderator name
    const moderator = await db.query.users.findFirst({
      where: eq(schema.users.id, session.moderatorId),
    });

    const hostName = moderator?.displayName || 'The host';

    // Generate join link
    const baseUrl = process.env.APP_URL || 'http://localhost:5173';
    const joinLink = `${baseUrl}/join?code=${session.inviteCode}`;

    // Send invite email
    const result = await sendSessionInviteEmail(
      email,
      session.name,
      hostName,
      session.scheduledAt,
      session.inviteCode,
      joinLink
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to send invite email' });
    }

    logger.info(`Session invite sent to ${email} for session ${sessionId}`);

    return res.json({ message: 'Invite sent successfully' });
  } catch (error) {
    logger.error('Send invite error:', error);
    return res.status(500).json({ error: 'Failed to send invite' });
  }
});

export default router;
