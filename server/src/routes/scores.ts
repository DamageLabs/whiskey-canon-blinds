import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { AuthRequest, authenticateParticipant } from '../middleware/auth';
import { getIO } from '../socket';

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
    console.error('Submit score error:', error);
    return res.status(500).json({ error: 'Failed to submit score' });
  }
});

// Get scores for a session (only after reveal)
router.get('/session/:sessionId', async (req: AuthRequest, res: Response) => {
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
    console.error('Get scores error:', error);
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
    console.error('Get my scores error:', error);
    return res.status(500).json({ error: 'Failed to get scores' });
  }
});

export default router;
