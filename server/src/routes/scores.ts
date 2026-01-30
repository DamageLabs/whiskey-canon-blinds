import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { AuthRequest, authenticateParticipant, authenticateUser } from '../middleware/auth.js';
import { resultsLimiter } from '../middleware/rateLimit.js';
import { getIO } from '../socket/index.js';
import { validateLength, INPUT_LIMITS } from '../utils/validation.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Calculate weighted total score
function calculateTotalScore(scores: { nose: number; palate: number; finish: number; overall: number }): number {
  const weighted =
    scores.nose * 0.25 +
    scores.palate * 0.35 +
    scores.finish * 0.25 +
    scores.overall * 0.15;
  return Math.round(weighted * 10) / 10;
}

// Submit score for a whiskey
router.post('/', authenticateParticipant, async (req: AuthRequest, res: Response) => {
  try {
    const {
      sessionId,
      whiskeyId,
      nose,
      palate,
      finish,
      overall,
      noseNotes,
      palateNotes,
      finishNotes,
      generalNotes,
      identityGuess,
    } = req.body;

    if (!sessionId || !whiskeyId) {
      return res.status(400).json({ error: 'Session ID and whiskey ID are required' });
    }

    // Validate scores
    const scoreFields = { nose, palate, finish, overall };
    for (const [key, value] of Object.entries(scoreFields)) {
      if (typeof value !== 'number' || value < 1 || value > 10) {
        return res.status(400).json({ error: `${key} must be a number between 1 and 10` });
      }
    }

    // Validate notes length
    const notesFields = [
      { value: noseNotes, name: 'Nose notes' },
      { value: palateNotes, name: 'Palate notes' },
      { value: finishNotes, name: 'Finish notes' },
      { value: generalNotes, name: 'General notes' },
      { value: identityGuess, name: 'Identity guess' },
    ];
    for (const field of notesFields) {
      if (field.value) {
        const lengthCheck = validateLength(field.value, INPUT_LIMITS.NOTES, field.name);
        if (!lengthCheck.valid) {
          return res.status(400).json({ error: lengthCheck.error });
        }
      }
    }

    // Verify participant belongs to session
    const participant = await db.query.participants.findFirst({
      where: and(
        eq(schema.participants.id, req.participantId!),
        eq(schema.participants.sessionId, sessionId)
      ),
    });

    if (!participant) {
      return res.status(403).json({ error: 'You are not a participant in this session' });
    }

    // Check if score already exists
    const existingScore = await db.query.scores.findFirst({
      where: and(
        eq(schema.scores.participantId, req.participantId!),
        eq(schema.scores.whiskeyId, whiskeyId)
      ),
    });

    if (existingScore) {
      return res.status(400).json({ error: 'Score already submitted for this whiskey' });
    }

    // Verify session is active
    const session = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session || session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    const totalScore = calculateTotalScore({ nose, palate, finish, overall });
    const scoreId = uuidv4();
    const now = new Date();

    await db.insert(schema.scores).values({
      id: scoreId,
      sessionId,
      whiskeyId,
      participantId: req.participantId!,
      nose,
      palate,
      finish,
      overall,
      totalScore,
      noseNotes,
      palateNotes,
      finishNotes,
      generalNotes,
      identityGuess,
      lockedAt: now,
    });

    // Update participant status
    await db.update(schema.participants)
      .set({ currentWhiskeyIndex: participant.currentWhiskeyIndex + 1 })
      .where(eq(schema.participants.id, req.participantId!));

    // Notify moderator
    const io = getIO();
    io.to(sessionId).emit('score:locked', {
      participantId: req.participantId,
      whiskeyId,
      participantName: participant.displayName,
    });

    return res.status(201).json({
      id: scoreId,
      totalScore,
      lockedAt: now,
    });
  } catch (error) {
    logger.error('Submit score error:', error);
    return res.status(500).json({ error: 'Failed to submit score' });
  }
});

// Get scores for a session (only after reveal) - rate limited (complex aggregation)
router.get('/session/:sessionId', resultsLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    const session = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'reveal' && session.status !== 'completed') {
      return res.status(403).json({ error: 'Scores are not yet revealed' });
    }

    const sessionScores = await db.query.scores.findMany({
      where: eq(schema.scores.sessionId, sessionId),
    });

    const whiskeysData = await db.query.whiskeys.findMany({
      where: eq(schema.whiskeys.sessionId, sessionId),
    });

    const participantsData = await db.query.participants.findMany({
      where: eq(schema.participants.sessionId, sessionId),
    });

    // Calculate aggregates per whiskey
    const results = whiskeysData.map((whiskey) => {
      const whiskeyScores = sessionScores.filter((s) => s.whiskeyId === whiskey.id);
      const avgTotal =
        whiskeyScores.length > 0
          ? whiskeyScores.reduce((sum, s) => sum + s.totalScore, 0) / whiskeyScores.length
          : 0;

      const avgNose =
        whiskeyScores.length > 0
          ? whiskeyScores.reduce((sum, s) => sum + s.nose, 0) / whiskeyScores.length
          : 0;

      const avgPalate =
        whiskeyScores.length > 0
          ? whiskeyScores.reduce((sum, s) => sum + s.palate, 0) / whiskeyScores.length
          : 0;

      const avgFinish =
        whiskeyScores.length > 0
          ? whiskeyScores.reduce((sum, s) => sum + s.finish, 0) / whiskeyScores.length
          : 0;

      const avgOverall =
        whiskeyScores.length > 0
          ? whiskeyScores.reduce((sum, s) => sum + s.overall, 0) / whiskeyScores.length
          : 0;

      return {
        whiskey,
        averageScore: Math.round(avgTotal * 10) / 10,
        categoryAverages: {
          nose: Math.round(avgNose * 10) / 10,
          palate: Math.round(avgPalate * 10) / 10,
          finish: Math.round(avgFinish * 10) / 10,
          overall: Math.round(avgOverall * 10) / 10,
        },
        scores: whiskeyScores.map((s) => ({
          ...s,
          participantName: participantsData.find((p) => p.id === s.participantId)?.displayName,
        })),
      };
    });

    // Sort by average score
    results.sort((a, b) => b.averageScore - a.averageScore);

    // Add rankings
    const rankedResults = results.map((r, index) => ({
      ...r,
      ranking: index + 1,
    }));

    return res.json({
      session,
      results: rankedResults,
      participantCount: participantsData.length,
    });
  } catch (error) {
    logger.error('Get scores error:', error);
    return res.status(500).json({ error: 'Failed to get scores' });
  }
});

// Get participant's own scores
router.get('/my-scores/:sessionId', authenticateParticipant, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    const myScores = await db.query.scores.findMany({
      where: and(
        eq(schema.scores.sessionId, sessionId),
        eq(schema.scores.participantId, req.participantId!)
      ),
    });

    return res.json(myScores);
  } catch (error) {
    logger.error('Get my scores error:', error);
    return res.status(500).json({ error: 'Failed to get scores' });
  }
});

// Toggle score visibility (share to public profile)
router.patch('/:scoreId/visibility', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const scoreId = req.params.scoreId as string;
    const { isPublic } = req.body;

    if (typeof isPublic !== 'boolean') {
      return res.status(400).json({ error: 'isPublic must be a boolean' });
    }

    // Get the score and verify ownership
    const score = await db.query.scores.findFirst({
      where: eq(schema.scores.id, scoreId),
    });

    if (!score) {
      return res.status(404).json({ error: 'Score not found' });
    }

    // Get the participant to verify user ownership
    const participant = await db.query.participants.findFirst({
      where: eq(schema.participants.id, score.participantId),
    });

    if (!participant || participant.userId !== req.userId) {
      return res.status(403).json({ error: 'You do not own this score' });
    }

    // Verify session is in reveal or completed state
    const session = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, score.sessionId),
    });

    if (!session || (session.status !== 'reveal' && session.status !== 'completed')) {
      return res.status(400).json({ error: 'Scores can only be shared after the reveal phase' });
    }

    // Update visibility
    await db
      .update(schema.scores)
      .set({ isPublic })
      .where(eq(schema.scores.id, scoreId));

    return res.json({ id: scoreId, isPublic });
  } catch (error) {
    logger.error('Toggle score visibility error:', error);
    return res.status(500).json({ error: 'Failed to update score visibility' });
  }
});

// Get user's scores that can be shared (from completed sessions)
router.get('/shareable', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Get all scores from this user's completed sessions
    const shareableScores = await db
      .select({
        score: schema.scores,
        whiskey: schema.whiskeys,
        session: {
          id: schema.sessions.id,
          name: schema.sessions.name,
          status: schema.sessions.status,
        },
      })
      .from(schema.scores)
      .innerJoin(schema.participants, eq(schema.scores.participantId, schema.participants.id))
      .innerJoin(schema.whiskeys, eq(schema.scores.whiskeyId, schema.whiskeys.id))
      .innerJoin(schema.sessions, eq(schema.scores.sessionId, schema.sessions.id))
      .where(and(
        eq(schema.participants.userId, userId),
        eq(schema.sessions.status, 'completed')
      ));

    return res.json(shareableScores.map((s) => ({
      id: s.score.id,
      whiskey: {
        id: s.whiskey.id,
        name: s.whiskey.name,
        distillery: s.whiskey.distillery,
        age: s.whiskey.age,
        proof: s.whiskey.proof,
      },
      session: s.session,
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
      isPublic: s.score.isPublic,
      lockedAt: s.score.lockedAt,
    })));
  } catch (error) {
    logger.error('Get shareable scores error:', error);
    return res.status(500).json({ error: 'Failed to get shareable scores' });
  }
});

export default router;
