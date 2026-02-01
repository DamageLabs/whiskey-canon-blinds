import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import { eq, and, sql, gte } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

type LeaderboardPeriod = 'all_time' | 'monthly' | 'weekly';

// Helper to get period start date
function getPeriodStart(period: LeaderboardPeriod): Date {
  const now = new Date();
  switch (period) {
    case 'weekly': {
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      return new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
    }
    case 'monthly':
      return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    case 'all_time':
    default:
      return new Date(0); // Beginning of time
  }
}

// Calculate and update leaderboard for a specific period
async function updateLeaderboard(period: LeaderboardPeriod) {
  const periodStart = getPeriodStart(period);
  const now = new Date();

  // Get all users with public profiles
  const publicUsers = await db.query.users.findMany({
    where: and(
      eq(schema.users.isProfilePublic, true),
      sql`${schema.users.deletedAt} IS NULL`
    ),
  });

  const userIds = publicUsers.map(u => u.id);
  if (userIds.length === 0) return [];

  // Calculate scores for each user in the period
  const userStats: Array<{
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    totalScore: number;
    sessionsCount: number;
    whiskeysRated: number;
    averageScore: number;
  }> = [];

  for (const user of publicUsers) {
    // Get participant records for this user
    const participants = await db.query.participants.findMany({
      where: eq(schema.participants.userId, user.id),
    });

    const participantIds = participants.map(p => p.id);
    if (participantIds.length === 0) {
      userStats.push({
        userId: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        totalScore: 0,
        sessionsCount: 0,
        whiskeysRated: 0,
        averageScore: 0,
      });
      continue;
    }

    // Get scores within the period
    const scores = await db.select()
      .from(schema.scores)
      .innerJoin(schema.sessions, eq(schema.scores.sessionId, schema.sessions.id))
      .where(
        and(
          sql`${schema.scores.participantId} IN (${sql.join(participantIds.map(id => sql`${id}`), sql`, `)})`,
          eq(schema.sessions.status, 'completed'),
          period !== 'all_time' ? gte(schema.scores.lockedAt, periodStart) : sql`1=1`
        )
      );

    const totalScore = scores.reduce((sum, s) => sum + s.scores.totalScore, 0);
    const whiskeysRated = scores.length;

    // Count unique sessions
    const uniqueSessions = new Set(scores.map(s => s.scores.sessionId));
    const sessionsCount = uniqueSessions.size;

    const averageScore = whiskeysRated > 0 ? totalScore / whiskeysRated : 0;

    userStats.push({
      userId: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      totalScore,
      sessionsCount,
      whiskeysRated,
      averageScore,
    });
  }

  // Sort by average score (descending), then by whiskeys rated
  userStats.sort((a, b) => {
    if (b.averageScore !== a.averageScore) {
      return b.averageScore - a.averageScore;
    }
    return b.whiskeysRated - a.whiskeysRated;
  });

  // Assign rankings and upsert leaderboard entries
  const entries = [];
  for (let i = 0; i < userStats.length; i++) {
    const stat = userStats[i];
    const ranking = i + 1;

    // Check if entry exists
    const existing = await db.query.leaderboardEntries.findFirst({
      where: and(
        eq(schema.leaderboardEntries.userId, stat.userId),
        eq(schema.leaderboardEntries.period, period),
        eq(schema.leaderboardEntries.periodStart, periodStart)
      ),
    });

    if (existing) {
      await db.update(schema.leaderboardEntries)
        .set({
          totalScore: stat.totalScore,
          sessionsCount: stat.sessionsCount,
          whiskeysRated: stat.whiskeysRated,
          averageScore: stat.averageScore,
          ranking,
          updatedAt: now,
        })
        .where(eq(schema.leaderboardEntries.id, existing.id));
    } else {
      await db.insert(schema.leaderboardEntries).values({
        id: uuidv4(),
        userId: stat.userId,
        period,
        periodStart,
        totalScore: stat.totalScore,
        sessionsCount: stat.sessionsCount,
        whiskeysRated: stat.whiskeysRated,
        averageScore: stat.averageScore,
        ranking,
        updatedAt: now,
      });
    }

    entries.push({
      ...stat,
      ranking,
    });
  }

  return entries;
}

// GET /api/leaderboards - Get paginated leaderboard
router.get('/', async (req, res) => {
  try {
    const period = (req.query.period as LeaderboardPeriod) || 'all_time';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Validate period
    if (!['all_time', 'monthly', 'weekly'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period. Use all_time, monthly, or weekly.' });
    }

    const periodStart = getPeriodStart(period);

    // Update leaderboard (in production, this would be done via a cron job)
    await updateLeaderboard(period);

    // Get leaderboard entries
    const entries = await db.select({
      id: schema.leaderboardEntries.id,
      userId: schema.leaderboardEntries.userId,
      totalScore: schema.leaderboardEntries.totalScore,
      sessionsCount: schema.leaderboardEntries.sessionsCount,
      whiskeysRated: schema.leaderboardEntries.whiskeysRated,
      averageScore: schema.leaderboardEntries.averageScore,
      ranking: schema.leaderboardEntries.ranking,
      displayName: schema.users.displayName,
      avatarUrl: schema.users.avatarUrl,
    })
      .from(schema.leaderboardEntries)
      .innerJoin(schema.users, eq(schema.leaderboardEntries.userId, schema.users.id))
      .where(
        and(
          eq(schema.leaderboardEntries.period, period),
          eq(schema.leaderboardEntries.periodStart, periodStart)
        )
      )
      .orderBy(schema.leaderboardEntries.ranking)
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(schema.leaderboardEntries)
      .where(
        and(
          eq(schema.leaderboardEntries.period, period),
          eq(schema.leaderboardEntries.periodStart, periodStart)
        )
      );

    const total = countResult[0]?.count || 0;

    res.json({
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      period,
      periodStart: periodStart.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// GET /api/leaderboards/my-rank - Get current user's rank
router.get('/my-rank', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const periods: LeaderboardPeriod[] = ['all_time', 'monthly', 'weekly'];
    const ranks: Record<string, {
      ranking: number;
      totalScore: number;
      sessionsCount: number;
      whiskeysRated: number;
      averageScore: number;
      periodStart: string;
    } | null> = {};

    for (const period of periods) {
      const periodStart = getPeriodStart(period);

      const entry = await db.query.leaderboardEntries.findFirst({
        where: and(
          eq(schema.leaderboardEntries.userId, userId),
          eq(schema.leaderboardEntries.period, period),
          eq(schema.leaderboardEntries.periodStart, periodStart)
        ),
      });

      if (entry) {
        ranks[period] = {
          ranking: entry.ranking,
          totalScore: entry.totalScore,
          sessionsCount: entry.sessionsCount,
          whiskeysRated: entry.whiskeysRated,
          averageScore: entry.averageScore,
          periodStart: periodStart.toISOString(),
        };
      } else {
        ranks[period] = null;
      }
    }

    res.json({ ranks });
  } catch (error) {
    console.error('Error fetching user rank:', error);
    res.status(500).json({ error: 'Failed to fetch user rank' });
  }
});

export default router;
