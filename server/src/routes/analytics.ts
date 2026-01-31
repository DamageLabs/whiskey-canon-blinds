import { Router, Response } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { AuthRequest, authenticateUser } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();

// All analytics routes require user authentication
router.use(authenticateUser);

// Get scoring trends over time
router.get('/trends', async (req: AuthRequest, res: Response) => {
  try {
    const { days = '90' } = req.query;
    const daysNum = parseInt(days as string, 10) || 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);

    // Get all sessions where user participated
    const participations = await db.query.participants.findMany({
      where: eq(schema.participants.userId, req.userId!),
    });

    const participantIds = participations.map((p) => p.id);
    const sessionIds = [...new Set(participations.map((p) => p.sessionId))];

    if (participantIds.length === 0) {
      return res.json({
        trends: [],
        summary: {
          totalSessions: 0,
          totalWhiskeys: 0,
          averageScore: 0,
          categoryAverages: { nose: 0, palate: 0, finish: 0, overall: 0 },
        },
      });
    }

    // Get scores for these participants
    const scores = await db.query.scores.findMany({
      where: sql`${schema.scores.participantId} IN (${participantIds.join(',')})`,
    });

    // Get sessions for date information
    const sessions = await db.query.sessions.findMany({
      where: sql`${schema.sessions.id} IN (${sessionIds.map(id => `'${id}'`).join(',')})`,
    });

    const sessionMap = new Map(sessions.map((s) => [s.id, s]));
    const participantSessionMap = new Map(participations.map((p) => [p.id, p.sessionId]));

    // Filter scores by date and build trends
    const scoresByDate = new Map<string, {
      date: string;
      scores: number[];
      nose: number[];
      palate: number[];
      finish: number[];
      overall: number[];
    }>();

    for (const score of scores) {
      const sessionId = participantSessionMap.get(score.participantId);
      const session = sessionId ? sessionMap.get(sessionId) : null;
      if (!session || session.createdAt < cutoffDate) continue;

      const dateKey = session.createdAt.toISOString().split('T')[0];

      if (!scoresByDate.has(dateKey)) {
        scoresByDate.set(dateKey, {
          date: dateKey,
          scores: [],
          nose: [],
          palate: [],
          finish: [],
          overall: [],
        });
      }

      const entry = scoresByDate.get(dateKey)!;
      entry.scores.push(score.totalScore);
      entry.nose.push(score.nose);
      entry.palate.push(score.palate);
      entry.finish.push(score.finish);
      entry.overall.push(score.overall);
    }

    // Calculate averages for each date
    const trends = Array.from(scoresByDate.values())
      .map((entry) => ({
        date: entry.date,
        averageScore: entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length,
        averageNose: entry.nose.reduce((a, b) => a + b, 0) / entry.nose.length,
        averagePalate: entry.palate.reduce((a, b) => a + b, 0) / entry.palate.length,
        averageFinish: entry.finish.reduce((a, b) => a + b, 0) / entry.finish.length,
        averageOverall: entry.overall.reduce((a, b) => a + b, 0) / entry.overall.length,
        count: entry.scores.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate overall summary
    const allScores = scores.filter((score) => {
      const sessionId = participantSessionMap.get(score.participantId);
      const session = sessionId ? sessionMap.get(sessionId) : null;
      return session && session.createdAt >= cutoffDate;
    });

    const summary = {
      totalSessions: sessionIds.length,
      totalWhiskeys: allScores.length,
      averageScore: allScores.length > 0
        ? allScores.reduce((a, b) => a + b.totalScore, 0) / allScores.length
        : 0,
      categoryAverages: allScores.length > 0
        ? {
            nose: allScores.reduce((a, b) => a + b.nose, 0) / allScores.length,
            palate: allScores.reduce((a, b) => a + b.palate, 0) / allScores.length,
            finish: allScores.reduce((a, b) => a + b.finish, 0) / allScores.length,
            overall: allScores.reduce((a, b) => a + b.overall, 0) / allScores.length,
          }
        : { nose: 0, palate: 0, finish: 0, overall: 0 },
    };

    return res.json({ trends, summary });
  } catch (error) {
    logger.error('Get analytics trends error:', error);
    return res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Get personal whiskey rankings
router.get('/rankings', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '20' } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10) || 20, 100);

    // Get all sessions where user participated
    const participations = await db.query.participants.findMany({
      where: eq(schema.participants.userId, req.userId!),
    });

    const participantIds = participations.map((p) => p.id);

    if (participantIds.length === 0) {
      return res.json({ rankings: [] });
    }

    // Get scores for these participants
    const scores = await db.query.scores.findMany({
      where: sql`${schema.scores.participantId} IN (${participantIds.join(',')})`,
    });

    // Get whiskey details
    const whiskeyIds = [...new Set(scores.map((s) => s.whiskeyId))];
    const whiskeys = await db.query.whiskeys.findMany({
      where: sql`${schema.whiskeys.id} IN (${whiskeyIds.map(id => `'${id}'`).join(',')})`,
    });

    const whiskeyMap = new Map(whiskeys.map((w) => [w.id, w]));

    // Build rankings
    const rankings = scores
      .map((score) => {
        const whiskey = whiskeyMap.get(score.whiskeyId);
        return whiskey
          ? {
              id: score.id,
              whiskey: {
                id: whiskey.id,
                name: whiskey.name,
                distillery: whiskey.distillery,
                age: whiskey.age,
                proof: whiskey.proof,
              },
              score: score.totalScore,
              nose: score.nose,
              palate: score.palate,
              finish: score.finish,
              overall: score.overall,
              scoredAt: score.lockedAt,
            }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score)
      .slice(0, limitNum);

    return res.json({ rankings });
  } catch (error) {
    logger.error('Get analytics rankings error:', error);
    return res.status(500).json({ error: 'Failed to get rankings' });
  }
});

// Get session history with comparison
router.get('/sessions', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '20' } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10) || 20, 100);

    // Get sessions where user was moderator or participant
    const moderatedSessions = await db.query.sessions.findMany({
      where: eq(schema.sessions.moderatorId, req.userId!),
      orderBy: [desc(schema.sessions.createdAt)],
    });

    const participations = await db.query.participants.findMany({
      where: eq(schema.participants.userId, req.userId!),
    });

    const participatedSessionIds = new Set(participations.map((p) => p.sessionId));
    const participantMap = new Map(participations.map((p) => [p.sessionId, p.id]));

    // Combine and dedupe sessions
    const allSessionIds = new Set([
      ...moderatedSessions.map((s) => s.id),
      ...participatedSessionIds,
    ]);

    const allSessions = await db.query.sessions.findMany({
      where: sql`${schema.sessions.id} IN (${[...allSessionIds].map(id => `'${id}'`).join(',')})`,
      orderBy: [desc(schema.sessions.createdAt)],
    });

    // Get scores and stats for each session
    const sessionHistory = await Promise.all(
      allSessions.slice(0, limitNum).map(async (session) => {
        // Get all scores for the session
        const sessionScores = await db.query.scores.findMany({
          where: eq(schema.scores.sessionId, session.id),
        });

        // Get user's scores for this session
        const participantId = participantMap.get(session.id);
        const userScores = participantId
          ? sessionScores.filter((s) => s.participantId === participantId)
          : [];

        // Calculate averages
        const allAvg = sessionScores.length > 0
          ? sessionScores.reduce((a, b) => a + b.totalScore, 0) / sessionScores.length
          : 0;

        const userAvg = userScores.length > 0
          ? userScores.reduce((a, b) => a + b.totalScore, 0) / userScores.length
          : null;

        // Get whiskey count
        const whiskeys = await db.query.whiskeys.findMany({
          where: eq(schema.whiskeys.sessionId, session.id),
        });

        // Get participant count
        const participants = await db.query.participants.findMany({
          where: eq(schema.participants.sessionId, session.id),
        });

        return {
          id: session.id,
          name: session.name,
          theme: session.theme,
          customTheme: session.customTheme,
          status: session.status,
          isModerator: session.moderatorId === req.userId,
          createdAt: session.createdAt,
          whiskeyCount: whiskeys.length,
          participantCount: participants.length,
          groupAverage: allAvg,
          userAverage: userAvg,
          scoreDifference: userAvg !== null ? userAvg - allAvg : null,
        };
      })
    );

    return res.json({ sessions: sessionHistory });
  } catch (error) {
    logger.error('Get analytics sessions error:', error);
    return res.status(500).json({ error: 'Failed to get session history' });
  }
});

// Get score distribution
router.get('/distribution', async (req: AuthRequest, res: Response) => {
  try {
    // Get all participations
    const participations = await db.query.participants.findMany({
      where: eq(schema.participants.userId, req.userId!),
    });

    const participantIds = participations.map((p) => p.id);

    if (participantIds.length === 0) {
      return res.json({ distribution: {}, total: 0 });
    }

    // Get scores
    const scores = await db.query.scores.findMany({
      where: sql`${schema.scores.participantId} IN (${participantIds.join(',')})`,
    });

    // Build distribution (buckets: 0-1, 1-2, ..., 9-10)
    const distribution: Record<string, number> = {};
    for (let i = 0; i <= 9; i++) {
      distribution[`${i}-${i + 1}`] = 0;
    }

    for (const score of scores) {
      const bucket = Math.min(Math.floor(score.totalScore), 9);
      distribution[`${bucket}-${bucket + 1}`]++;
    }

    return res.json({
      distribution,
      total: scores.length,
      average: scores.length > 0
        ? scores.reduce((a, b) => a + b.totalScore, 0) / scores.length
        : 0,
    });
  } catch (error) {
    logger.error('Get analytics distribution error:', error);
    return res.status(500).json({ error: 'Failed to get distribution' });
  }
});

export default router;
