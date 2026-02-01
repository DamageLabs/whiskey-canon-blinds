import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Helper to calculate user's progress for an achievement
async function calculateProgress(userId: string, criteriaType: string): Promise<number> {
  switch (criteriaType) {
    case 'sessions_count': {
      const participants = await db.query.participants.findMany({
        where: eq(schema.participants.userId, userId),
      });
      const participantIds = participants.map(p => p.id);
      if (participantIds.length === 0) return 0;

      const sessions = await db.select({ sessionId: schema.scores.sessionId })
        .from(schema.scores)
        .innerJoin(schema.sessions, eq(schema.scores.sessionId, schema.sessions.id))
        .where(
          and(
            sql`${schema.scores.participantId} IN (${sql.join(participantIds.map(id => sql`${id}`), sql`, `)})`,
            eq(schema.sessions.status, 'completed')
          )
        )
        .groupBy(schema.scores.sessionId);
      return sessions.length;
    }

    case 'whiskeys_rated': {
      const participants = await db.query.participants.findMany({
        where: eq(schema.participants.userId, userId),
      });
      const participantIds = participants.map(p => p.id);
      if (participantIds.length === 0) return 0;

      const result = await db.select({ count: sql<number>`count(DISTINCT ${schema.scores.whiskeyId})` })
        .from(schema.scores)
        .where(sql`${schema.scores.participantId} IN (${sql.join(participantIds.map(id => sql`${id}`), sql`, `)})`);
      return result[0]?.count || 0;
    }

    case 'followers': {
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(schema.follows)
        .where(eq(schema.follows.followingId, userId));
      return result[0]?.count || 0;
    }

    case 'streak_days': {
      // We'll need to check the users table for streak info
      // For now, return 0 if not tracked
      return 0;
    }

    case 'public_notes': {
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(schema.scores)
        .innerJoin(schema.participants, eq(schema.scores.participantId, schema.participants.id))
        .where(
          and(
            eq(schema.participants.userId, userId),
            eq(schema.scores.isPublic, true)
          )
        );
      return result[0]?.count || 0;
    }

    case 'correct_guesses': {
      // This would require tracking identity guess accuracy
      // For now, return 0
      return 0;
    }

    default:
      return 0;
  }
}

// GET /api/achievements - Get all achievement definitions
router.get('/', async (req, res) => {
  try {
    const achievements = await db.query.achievementDefinitions.findMany({
      where: eq(schema.achievementDefinitions.isActive, true),
      orderBy: [schema.achievementDefinitions.category, schema.achievementDefinitions.criteriaTarget],
    });

    res.json({ achievements });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// GET /api/achievements/my-progress - Get user's achievement progress
router.get('/my-progress', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get all active achievements
    const definitions = await db.query.achievementDefinitions.findMany({
      where: eq(schema.achievementDefinitions.isActive, true),
    });

    // Get user's earned achievements
    const earned = await db.query.userAchievements.findMany({
      where: eq(schema.userAchievements.useri, userId),
    });

    const earnedIds = new Set(earned.map(e => e.achievementId));

    // Calculate progress for each achievement
    const progressByType: Record<string, number> = {};

    const achievements = await Promise.all(
      definitions.map(async (def) => {
        // Get progress from cache or calculate
        if (!(def.criteriaType in progressByType)) {
          progressByType[def.criteriaType] = await calculateProgress(userId, def.criteriaType);
        }

        const progress = progressByType[def.criteriaType];
        const isEarned = earnedIds.has(def.id);
        const earnedInfo = earned.find(e => e.achievementId === def.id);

        return {
          id: def.id,
          name: def.name,
          description: def.description,
          icon: def.icon,
          category: def.category,
          rarity: def.rarity,
          points: def.points,
          earned: isEarned,
          earnedAt: earnedInfo?.earnedAt || null,
          progress: Math.min(progress, def.criteriaTarget),
          target: def.criteriaTarget,
          percentComplete: Math.min(100, Math.round((progress / def.criteriaTarget) * 100)),
        };
      })
    );

    // Calculate summary
    const earnedCount = achievements.filter(a => a.earned).length;
    const totalPoints = achievements.filter(a => a.earned).reduce((sum, a) => sum + a.points, 0);

    res.json({
      achievements,
      summary: {
        earned: earnedCount,
        total: achievements.length,
        percentage: Math.round((earnedCount / achievements.length) * 100),
        totalPoints,
      },
    });
  } catch (error) {
    console.error('Error fetching achievement progress:', error);
    res.status(500).json({ error: 'Failed to fetch achievement progress' });
  }
});

// POST /api/achievements/:id/claim - Mark achievement notification as seen
router.post('/:id/claim', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const achievementId = req.params.id as string;

    const userAchievement = await db.query.userAchievements.findFirst({
      where: and(
        eq(schema.userAchievements.useri, userId),
        eq(schema.userAchievements.achievementId, achievementId)
      ),
    });

    if (!userAchievement) {
      return res.status(404).json({ error: 'Achievement not earned' });
    }

    await db.update(schema.userAchievements)
      .set({ notified: true })
      .where(eq(schema.userAchievements.id, userAchievement.id));

    res.json({ message: 'Achievement claimed' });
  } catch (error) {
    console.error('Error claiming achievement:', error);
    res.status(500).json({ error: 'Failed to claim achievement' });
  }
});

// GET /api/achievements/unclaimed - Get unclaimed achievements
router.get('/unclaimed', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const unclaimed = await db.select({
      id: schema.userAchievements.id,
      achievementId: schema.userAchievements.achievementId,
      earnedAt: schema.userAchievements.earnedAt,
      name: schema.achievementDefinitions.name,
      description: schema.achievementDefinitions.description,
      icon: schema.achievementDefinitions.icon,
      category: schema.achievementDefinitions.category,
      rarity: schema.achievementDefinitions.rarity,
      points: schema.achievementDefinitions.points,
    })
      .from(schema.userAchievements)
      .innerJoin(schema.achievementDefinitions, eq(schema.userAchievements.achievementId, schema.achievementDefinitions.id))
      .where(
        and(
          eq(schema.userAchievements.useri, userId),
          eq(schema.userAchievements.notified, false)
        )
      );

    res.json({ unclaimed });
  } catch (error) {
    console.error('Error fetching unclaimed achievements:', error);
    res.status(500).json({ error: 'Failed to fetch unclaimed achievements' });
  }
});

// GET /api/achievements/leaderboard - Get achievement points leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Get users with their total achievement points
    const leaderboard = await db.select({
      userId: schema.userAchievements.useri,
      displayName: schema.users.displayName,
      avatarUrl: schema.users.avatarUrl,
      totalPoints: sql<number>`SUM(${schema.achievementDefinitions.points})`,
      achievementCount: sql<number>`COUNT(${schema.userAchievements.id})`,
    })
      .from(schema.userAchievements)
      .innerJoin(schema.users, eq(schema.userAchievements.useri, schema.users.id))
      .innerJoin(schema.achievementDefinitions, eq(schema.userAchievements.achievementId, schema.achievementDefinitions.id))
      .where(
        and(
          eq(schema.users.isProfilePublic, true),
          sql`${schema.users.deletedAt} IS NULL`
        )
      )
      .groupBy(schema.userAchievements.useri, schema.users.displayName, schema.users.avatarUrl)
      .orderBy(desc(sql`SUM(${schema.achievementDefinitions.points})`))
      .limit(limit)
      .offset(offset);

    // Add rankings
    const ranked = leaderboard.map((entry, index) => ({
      ...entry,
      ranking: offset + index + 1,
    }));

    // Get total count
    const countResult = await db.select({ count: sql<number>`count(DISTINCT ${schema.userAchievements.useri})` })
      .from(schema.userAchievements)
      .innerJoin(schema.users, eq(schema.userAchievements.useri, schema.users.id))
      .where(
        and(
          eq(schema.users.isProfilePublic, true),
          sql`${schema.users.deletedAt} IS NULL`
        )
      );

    const total = countResult[0]?.count || 0;

    res.json({
      entries: ranked,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching achievement leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch achievement leaderboard' });
  }
});

// Service function to check and award achievements (call after relevant actions)
export async function checkAndAwardAchievements(userId: string): Promise<string[]> {
  const newAchievements: string[] = [];

  try {
    // Get all active achievements
    const definitions = await db.query.achievementDefinitions.findMany({
      where: eq(schema.achievementDefinitions.isActive, true),
    });

    // Get user's already earned achievements
    const earned = await db.query.userAchievements.findMany({
      where: eq(schema.userAchievements.useri, userId),
    });

    const earnedIds = new Set(earned.map(e => e.achievementId));

    // Calculate progress for each criteria type
    const progressByType: Record<string, number> = {};

    for (const def of definitions) {
      if (earnedIds.has(def.id)) continue;

      // Get progress
      if (!(def.criteriaType in progressByType)) {
        progressByType[def.criteriaType] = await calculateProgress(userId, def.criteriaType);
      }

      const progress = progressByType[def.criteriaType];

      // Check if achievement earned
      if (progress >= def.criteriaTarget) {
        await db.insert(schema.userAchievements).values({
          id: uuidv4(),
          useri: userId,
          achievementId: def.id,
          earnedAt: new Date(),
          notified: false,
        });

        newAchievements.push(def.id);
      }
    }
  } catch (error) {
    console.error('Error checking achievements:', error);
  }

  return newAchievements;
}

export default router;
