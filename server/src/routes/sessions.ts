import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import {
  AuthRequest,
  authenticateUser,
  authenticateParticipant,
  authenticateAny,
  generateParticipantToken,
} from '../middleware/auth';
import { getIO } from '../socket';

const router = Router();

// Generate a 6-character invite code
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create a new session (requires authenticated user)
router.post('/', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { name, hostName, theme, customTheme, proofMin, proofMax, maxParticipants, whiskeys } = req.body;

    if (!name || !theme) {
      return res.status(400).json({ error: 'Name and theme are required' });
    }

    if (!hostName) {
      return res.status(400).json({ error: 'Host name is required' });
    }

    if (!whiskeys || !Array.isArray(whiskeys) || whiskeys.length === 0) {
      return res.status(400).json({ error: 'At least one whiskey is required' });
    }

    if (whiskeys.length > 6) {
      return res.status(400).json({ error: 'Maximum 6 whiskeys allowed' });
    }

    const sessionId = uuidv4();
    const inviteCode = generateInviteCode();
    const now = new Date();

    // Create session
    await db.insert(schema.sessions).values({
      id: sessionId,
      name,
      theme,
      customTheme,
      proofMin,
      proofMax,
      scheduledAt: now,
      status: 'waiting',
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
    console.error('Create session error:', error);
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

    // Check via access token
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'whiskey-canon-secret-change-in-production') as { userId: string };
        if (decoded.userId === session.moderatorId) {
          isModerator = true;
        }
      } catch {
        // Invalid token
      }
    }

    // Check via participant token
    const participantToken = req.headers['x-participant-token'] as string;
    if (participantToken) {
      try {
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.verify(participantToken, process.env.JWT_SECRET || 'whiskey-canon-secret-change-in-production') as { participantId: string };
        currentParticipantId = decoded.participantId;

        // Check if this participant is the moderator
        const participant = await db.query.participants.findFirst({
          where: eq(schema.participants.id, decoded.participantId),
        });
        if (participant?.userId === session.moderatorId) {
          isModerator = true;
        }
      } catch {
        // Invalid token
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
    console.error('Get session error:', error);
    return res.status(500).json({ error: 'Failed to get session' });
  }
});

// Join session by invite code
router.post('/join', async (req: AuthRequest, res: Response) => {
  try {
    const { inviteCode, displayName } = req.body;

    if (!inviteCode || !displayName) {
      return res.status(400).json({ error: 'Invite code and display name are required' });
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
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'whiskey-canon-secret-change-in-production') as { userId: string };
        userId = decoded.userId;
      } catch {
        // Invalid token, continue as guest
      }
    }

    const isModerator = userId && session.moderatorId === userId;

    // Check if moderator already has a participant record
    if (isModerator) {
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
    console.error('Join session error:', error);
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
    console.error('Start session error:', error);
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
    console.error('Advance session error:', error);
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
    console.error('Reveal session error:', error);
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
    console.error('Pause session error:', error);
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
    console.error('Resume session error:', error);
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
    console.error('End session error:', error);
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
    console.error('Get sessions error:', error);
    return res.status(500).json({ error: 'Failed to get sessions' });
  }
});

export default router;
