import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db, schema } from '../db/index.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { AuthRequest, authenticateUser, getJwtSecret } from '../middleware/auth.js';

const router = Router();

// Follow a user
router.post('/follow/:userId', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const followingId = req.params.userId as string;
    const followerId = req.userId!;

    // Can't follow yourself
    if (followerId === followingId) {
      return res.status(400).json({ error: 'You cannot follow yourself' });
    }

    // Check if user to follow exists
    const userToFollow = await db.query.users.findFirst({
      where: eq(schema.users.id, followingId),
    });

    if (!userToFollow) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already following
    const existingFollow = await db.query.follows.findFirst({
      where: and(
        eq(schema.follows.followerId, followerId),
        eq(schema.follows.followingId, followingId)
      ),
    });

    if (existingFollow) {
      return res.status(400).json({ error: 'Already following this user' });
    }

    const followId = uuidv4();
    const now = new Date();

    await db.insert(schema.follows).values({
      id: followId,
      followerId,
      followingId,
      createdAt: now,
    });

    return res.status(201).json({ message: 'Successfully followed user' });
  } catch (error) {
    console.error('Follow user error:', error);
    return res.status(500).json({ error: 'Failed to follow user' });
  }
});

// Unfollow a user
router.delete('/follow/:userId', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const followingId = req.params.userId as string;
    const followerId = req.userId!;

    const existingFollow = await db.query.follows.findFirst({
      where: and(
        eq(schema.follows.followerId, followerId),
        eq(schema.follows.followingId, followingId)
      ),
    });

    if (!existingFollow) {
      return res.status(404).json({ error: 'Not following this user' });
    }

    await db.delete(schema.follows).where(
      and(
        eq(schema.follows.followerId, followerId),
        eq(schema.follows.followingId, followingId)
      )
    );

    return res.json({ message: 'Successfully unfollowed user' });
  } catch (error) {
    console.error('Unfollow user error:', error);
    return res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// Get followers of a user (paginated)
router.get('/followers/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Check if user exists
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get followers with user details
    const followersData = await db
      .select({
        id: schema.follows.id,
        followerId: schema.follows.followerId,
        createdAt: schema.follows.createdAt,
        user: {
          id: schema.users.id,
          displayName: schema.users.displayName,
          avatarUrl: schema.users.avatarUrl,
          bio: schema.users.bio,
        },
      })
      .from(schema.follows)
      .innerJoin(schema.users, eq(schema.follows.followerId, schema.users.id))
      .where(eq(schema.follows.followingId, userId))
      .orderBy(desc(schema.follows.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.follows)
      .where(eq(schema.follows.followingId, userId));

    const total = countResult[0]?.count || 0;

    return res.json({
      followers: followersData.map((f) => ({
        ...f.user,
        followedAt: f.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get followers error:', error);
    return res.status(500).json({ error: 'Failed to get followers' });
  }
});

// Get users that a user is following (paginated)
router.get('/following/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Check if user exists
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get following with user details
    const followingData = await db
      .select({
        id: schema.follows.id,
        followingId: schema.follows.followingId,
        createdAt: schema.follows.createdAt,
        user: {
          id: schema.users.id,
          displayName: schema.users.displayName,
          avatarUrl: schema.users.avatarUrl,
          bio: schema.users.bio,
        },
      })
      .from(schema.follows)
      .innerJoin(schema.users, eq(schema.follows.followingId, schema.users.id))
      .where(eq(schema.follows.followerId, userId))
      .orderBy(desc(schema.follows.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.follows)
      .where(eq(schema.follows.followerId, userId));

    const total = countResult[0]?.count || 0;

    return res.json({
      following: followingData.map((f) => ({
        ...f.user,
        followedAt: f.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get following error:', error);
    return res.status(500).json({ error: 'Failed to get following' });
  }
});

// Get public profile of a user
router.get('/profile/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId as string;

    // Check authorization header for current user (optional)
    let currentUserId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = await import('jsonwebtoken');
        const token = authHeader.split(' ')[1];
        const decoded = jwt.default.verify(
          token,
          getJwtSecret()
        ) as { userId: string };
        currentUserId = decoded.userId;
      } catch {
        // Invalid token, continue as unauthenticated
      }
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if profile is public or if viewer is the owner
    const isOwner = currentUserId === userId;
    const isPublic = user.isProfilePublic;

    // Check if viewer is following this user
    let isFollowing = false;
    if (currentUserId && currentUserId !== userId) {
      const follow = await db.query.follows.findFirst({
        where: and(
          eq(schema.follows.followerId, currentUserId),
          eq(schema.follows.followingId, userId)
        ),
      });
      isFollowing = !!follow;
    }

    // Get follower/following counts
    const followersCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.follows)
      .where(eq(schema.follows.followingId, userId));

    const followingCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.follows)
      .where(eq(schema.follows.followerId, userId));

    // Get public notes count
    const publicNotesCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.scores)
      .innerJoin(schema.participants, eq(schema.scores.participantId, schema.participants.id))
      .where(and(
        eq(schema.participants.userId, userId),
        eq(schema.scores.isPublic, true)
      ));

    const profile = {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: isPublic || isOwner ? user.bio : null,
      favoriteCategory: isPublic || isOwner ? user.favoriteCategory : null,
      experienceLevel: isPublic || isOwner ? user.experienceLevel : null,
      isProfilePublic: user.isProfilePublic,
      isOwner,
      isFollowing,
      stats: {
        followers: followersCountResult[0]?.count || 0,
        following: followingCountResult[0]?.count || 0,
        publicNotes: publicNotesCountResult[0]?.count || 0,
      },
    };

    // If profile is private and viewer is not owner or follower, return limited info
    if (!isPublic && !isOwner && !isFollowing) {
      return res.json({
        ...profile,
        bio: null,
        favoriteCategory: null,
        experienceLevel: null,
        isPrivate: true,
      });
    }

    return res.json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Toggle profile privacy
router.patch('/profile/privacy', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { isPublic } = req.body;

    if (typeof isPublic !== 'boolean') {
      return res.status(400).json({ error: 'isPublic must be a boolean' });
    }

    await db
      .update(schema.users)
      .set({ isProfilePublic: isPublic })
      .where(eq(schema.users.id, userId));

    return res.json({ isProfilePublic: isPublic });
  } catch (error) {
    console.error('Toggle privacy error:', error);
    return res.status(500).json({ error: 'Failed to update privacy setting' });
  }
});

// Get public tasting notes for a user
router.get('/profile/:userId/notes', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Check if user exists
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get public scores with whiskey details
    const notesData = await db
      .select({
        score: schema.scores,
        whiskey: schema.whiskeys,
        session: {
          id: schema.sessions.id,
          name: schema.sessions.name,
        },
      })
      .from(schema.scores)
      .innerJoin(schema.participants, eq(schema.scores.participantId, schema.participants.id))
      .innerJoin(schema.whiskeys, eq(schema.scores.whiskeyId, schema.whiskeys.id))
      .innerJoin(schema.sessions, eq(schema.scores.sessionId, schema.sessions.id))
      .where(and(
        eq(schema.participants.userId, userId),
        eq(schema.scores.isPublic, true)
      ))
      .orderBy(desc(schema.scores.lockedAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.scores)
      .innerJoin(schema.participants, eq(schema.scores.participantId, schema.participants.id))
      .where(and(
        eq(schema.participants.userId, userId),
        eq(schema.scores.isPublic, true)
      ));

    const total = countResult[0]?.count || 0;

    return res.json({
      notes: notesData.map((n) => ({
        id: n.score.id,
        whiskey: {
          id: n.whiskey.id,
          name: n.whiskey.name,
          distillery: n.whiskey.distillery,
          age: n.whiskey.age,
          proof: n.whiskey.proof,
        },
        session: n.session,
        scores: {
          nose: n.score.nose,
          palate: n.score.palate,
          finish: n.score.finish,
          overall: n.score.overall,
          total: n.score.totalScore,
        },
        notes: {
          nose: n.score.noseNotes,
          palate: n.score.palateNotes,
          finish: n.score.finishNotes,
          general: n.score.generalNotes,
        },
        identityGuess: n.score.identityGuess,
        lockedAt: n.score.lockedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get public notes error:', error);
    return res.status(500).json({ error: 'Failed to get public notes' });
  }
});

// Check if current user is following another user
router.get('/is-following/:userId', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const followingId = req.params.userId as string;
    const followerId = req.userId!;

    const follow = await db.query.follows.findFirst({
      where: and(
        eq(schema.follows.followerId, followerId),
        eq(schema.follows.followingId, followingId)
      ),
    });

    return res.json({ isFollowing: !!follow });
  } catch (error) {
    console.error('Check following error:', error);
    return res.status(500).json({ error: 'Failed to check following status' });
  }
});

// Get tasting statistics for a user
router.get('/profile/:userId/stats', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId as string;

    // Check if user exists
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all participant records for this user
    const participantRecords = await db.query.participants.findMany({
      where: eq(schema.participants.userId, userId),
    });

    const participantIds = participantRecords.map(p => p.id);

    // Get unique sessions attended (completed sessions only)
    const sessionsAttended = await db
      .select({
        sessionId: schema.participants.sessionId,
        sessionName: schema.sessions.name,
        sessionTheme: schema.sessions.theme,
        completedAt: schema.sessions.updatedAt,
      })
      .from(schema.participants)
      .innerJoin(schema.sessions, eq(schema.participants.sessionId, schema.sessions.id))
      .where(and(
        eq(schema.participants.userId, userId),
        eq(schema.sessions.status, 'completed')
      ))
      .orderBy(desc(schema.sessions.updatedAt));

    // Get all scores for this user
    const allScores = participantIds.length > 0
      ? await db
          .select({
            score: schema.scores,
            whiskey: schema.whiskeys,
          })
          .from(schema.scores)
          .innerJoin(schema.whiskeys, eq(schema.scores.whiskeyId, schema.whiskeys.id))
          .innerJoin(schema.participants, eq(schema.scores.participantId, schema.participants.id))
          .where(eq(schema.participants.userId, userId))
      : [];

    const totalWhiskeysRated = allScores.length;

    // Calculate average scores
    let avgNose = 0, avgPalate = 0, avgFinish = 0, avgOverall = 0, avgTotal = 0;
    if (totalWhiskeysRated > 0) {
      avgNose = allScores.reduce((sum, s) => sum + s.score.nose, 0) / totalWhiskeysRated;
      avgPalate = allScores.reduce((sum, s) => sum + s.score.palate, 0) / totalWhiskeysRated;
      avgFinish = allScores.reduce((sum, s) => sum + s.score.finish, 0) / totalWhiskeysRated;
      avgOverall = allScores.reduce((sum, s) => sum + s.score.overall, 0) / totalWhiskeysRated;
      avgTotal = allScores.reduce((sum, s) => sum + s.score.totalScore, 0) / totalWhiskeysRated;
    }

    // Calculate score distribution (1-10 buckets)
    const scoreDistribution: Record<number, number> = {};
    for (let i = 1; i <= 10; i++) {
      scoreDistribution[i] = 0;
    }
    allScores.forEach(s => {
      const roundedTotal = Math.round(s.score.totalScore);
      const bucket = Math.min(10, Math.max(1, roundedTotal));
      scoreDistribution[bucket]++;
    });

    // Get categories explored (unique whiskey themes/regions)
    const categoriesExplored = new Set<string>();
    const sessionsWithThemes = await db
      .select({ theme: schema.sessions.theme })
      .from(schema.participants)
      .innerJoin(schema.sessions, eq(schema.participants.sessionId, schema.sessions.id))
      .where(eq(schema.participants.userId, userId));

    sessionsWithThemes.forEach(s => {
      if (s.theme) categoriesExplored.add(s.theme);
    });

    // Extract common words from tasting notes
    const allNotes: string[] = [];
    allScores.forEach(s => {
      if (s.score.noseNotes) allNotes.push(s.score.noseNotes);
      if (s.score.palateNotes) allNotes.push(s.score.palateNotes);
      if (s.score.finishNotes) allNotes.push(s.score.finishNotes);
      if (s.score.generalNotes) allNotes.push(s.score.generalNotes);
    });

    // Simple word frequency analysis for common tasting terms
    const tastingTerms = [
      'vanilla', 'caramel', 'oak', 'honey', 'spice', 'cinnamon', 'cherry', 'apple',
      'pear', 'citrus', 'orange', 'lemon', 'chocolate', 'coffee', 'toffee', 'butterscotch',
      'smoke', 'peat', 'leather', 'tobacco', 'nuts', 'almond', 'walnut', 'maple',
      'brown sugar', 'molasses', 'pepper', 'clove', 'nutmeg', 'ginger', 'mint',
      'floral', 'fruity', 'sweet', 'dry', 'smooth', 'bold', 'rich', 'complex',
      'balanced', 'warm', 'heat', 'burn', 'long', 'short', 'finish'
    ];

    const notesText = allNotes.join(' ').toLowerCase();
    const termCounts: Record<string, number> = {};
    tastingTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = notesText.match(regex);
      if (matches && matches.length > 0) {
        termCounts[term] = matches.length;
      }
    });

    // Get top 10 most used terms
    const favoriteNotes = Object.entries(termCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([term, count]) => ({ term, count }));

    // Calculate scoring tendency (are they a tough or generous scorer?)
    let scoringTendency = 'balanced';
    if (avgTotal > 0) {
      if (avgTotal >= 7.5) scoringTendency = 'generous';
      else if (avgTotal <= 5.5) scoringTendency = 'critical';
    }

    // Recent activity (last 5 sessions)
    const recentSessions = sessionsAttended.slice(0, 5).map(s => ({
      id: s.sessionId,
      name: s.sessionName,
      theme: s.sessionTheme,
      completedAt: s.completedAt,
    }));

    return res.json({
      overview: {
        sessionsAttended: sessionsAttended.length,
        whiskeysRated: totalWhiskeysRated,
        categoriesExplored: Array.from(categoriesExplored),
      },
      scoringTendencies: {
        averages: {
          nose: Math.round(avgNose * 10) / 10,
          palate: Math.round(avgPalate * 10) / 10,
          finish: Math.round(avgFinish * 10) / 10,
          overall: Math.round(avgOverall * 10) / 10,
          total: Math.round(avgTotal * 10) / 10,
        },
        distribution: scoreDistribution,
        tendency: scoringTendency,
      },
      favoriteNotes,
      recentActivity: recentSessions,
    });
  } catch (error) {
    console.error('Get tasting stats error:', error);
    return res.status(500).json({ error: 'Failed to get tasting statistics' });
  }
});

// Get achievements/badges for a user
router.get('/profile/:userId/achievements', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId as string;

    // Check if user exists
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get statistics needed for achievements
    const participantRecords = await db.query.participants.findMany({
      where: eq(schema.participants.userId, userId),
    });

    // Get completed sessions count
    const completedSessions = await db
      .select({ count: sql<number>`count(DISTINCT ${schema.participants.sessionId})` })
      .from(schema.participants)
      .innerJoin(schema.sessions, eq(schema.participants.sessionId, schema.sessions.id))
      .where(and(
        eq(schema.participants.userId, userId),
        eq(schema.sessions.status, 'completed')
      ));

    const sessionsCount = completedSessions[0]?.count || 0;

    // Get whiskeys rated count
    const whiskeysRated = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.scores)
      .innerJoin(schema.participants, eq(schema.scores.participantId, schema.participants.id))
      .where(eq(schema.participants.userId, userId));

    const whiskeysCount = whiskeysRated[0]?.count || 0;

    // Get categories explored
    const categoriesResult = await db
      .select({ theme: schema.sessions.theme })
      .from(schema.participants)
      .innerJoin(schema.sessions, eq(schema.participants.sessionId, schema.sessions.id))
      .where(and(
        eq(schema.participants.userId, userId),
        eq(schema.sessions.status, 'completed')
      ));

    const uniqueCategories = new Set(categoriesResult.map(c => c.theme).filter(Boolean));
    const categoriesCount = uniqueCategories.size;

    // Get sessions where user was moderator
    const moderatedSessions = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.sessions)
      .where(and(
        eq(schema.sessions.moderatorId, userId),
        eq(schema.sessions.status, 'completed')
      ));

    const moderatedCount = moderatedSessions[0]?.count || 0;

    // Define achievements
    const achievements = [
      // Session milestones
      {
        id: 'first_tasting',
        name: 'First Sip',
        description: 'Complete your first tasting session',
        icon: 'glass',
        category: 'sessions',
        earned: sessionsCount >= 1,
        progress: Math.min(sessionsCount, 1),
        target: 1,
      },
      {
        id: 'sessions_5',
        name: 'Regular Taster',
        description: 'Complete 5 tasting sessions',
        icon: 'calendar',
        category: 'sessions',
        earned: sessionsCount >= 5,
        progress: Math.min(sessionsCount, 5),
        target: 5,
      },
      {
        id: 'sessions_10',
        name: 'Dedicated Enthusiast',
        description: 'Complete 10 tasting sessions',
        icon: 'star',
        category: 'sessions',
        earned: sessionsCount >= 10,
        progress: Math.min(sessionsCount, 10),
        target: 10,
      },
      {
        id: 'sessions_25',
        name: 'Seasoned Connoisseur',
        description: 'Complete 25 tasting sessions',
        icon: 'trophy',
        category: 'sessions',
        earned: sessionsCount >= 25,
        progress: Math.min(sessionsCount, 25),
        target: 25,
      },

      // Whiskey milestones
      {
        id: 'whiskeys_10',
        name: 'Getting Started',
        description: 'Rate 10 different whiskeys',
        icon: 'bottle',
        category: 'whiskeys',
        earned: whiskeysCount >= 10,
        progress: Math.min(whiskeysCount, 10),
        target: 10,
      },
      {
        id: 'whiskeys_25',
        name: 'Building a Palate',
        description: 'Rate 25 different whiskeys',
        icon: 'bottles',
        category: 'whiskeys',
        earned: whiskeysCount >= 25,
        progress: Math.min(whiskeysCount, 25),
        target: 25,
      },
      {
        id: 'whiskeys_50',
        name: 'Well Versed',
        description: 'Rate 50 different whiskeys',
        icon: 'collection',
        category: 'whiskeys',
        earned: whiskeysCount >= 50,
        progress: Math.min(whiskeysCount, 50),
        target: 50,
      },
      {
        id: 'whiskeys_100',
        name: 'Century Club',
        description: 'Rate 100 different whiskeys',
        icon: 'medal',
        category: 'whiskeys',
        earned: whiskeysCount >= 100,
        progress: Math.min(whiskeysCount, 100),
        target: 100,
      },

      // Category exploration
      {
        id: 'categories_3',
        name: 'Explorer',
        description: 'Taste whiskeys from 3 different categories',
        icon: 'compass',
        category: 'exploration',
        earned: categoriesCount >= 3,
        progress: Math.min(categoriesCount, 3),
        target: 3,
      },
      {
        id: 'categories_5',
        name: 'World Traveler',
        description: 'Taste whiskeys from 5 different categories',
        icon: 'globe',
        category: 'exploration',
        earned: categoriesCount >= 5,
        progress: Math.min(categoriesCount, 5),
        target: 5,
      },
      {
        id: 'categories_all',
        name: 'Global Palate',
        description: 'Taste whiskeys from all 7 categories',
        icon: 'world',
        category: 'exploration',
        earned: categoriesCount >= 7,
        progress: Math.min(categoriesCount, 7),
        target: 7,
      },

      // Hosting achievements
      {
        id: 'first_host',
        name: 'Party Starter',
        description: 'Host your first tasting session',
        icon: 'host',
        category: 'hosting',
        earned: moderatedCount >= 1,
        progress: Math.min(moderatedCount, 1),
        target: 1,
      },
      {
        id: 'host_5',
        name: 'Gracious Host',
        description: 'Host 5 tasting sessions',
        icon: 'crown',
        category: 'hosting',
        earned: moderatedCount >= 5,
        progress: Math.min(moderatedCount, 5),
        target: 5,
      },
      {
        id: 'host_10',
        name: 'Master of Ceremonies',
        description: 'Host 10 tasting sessions',
        icon: 'scepter',
        category: 'hosting',
        earned: moderatedCount >= 10,
        progress: Math.min(moderatedCount, 10),
        target: 10,
      },
    ];

    const earnedCount = achievements.filter(a => a.earned).length;

    return res.json({
      achievements,
      summary: {
        earned: earnedCount,
        total: achievements.length,
        percentage: Math.round((earnedCount / achievements.length) * 100),
      },
    });
  } catch (error) {
    console.error('Get achievements error:', error);
    return res.status(500).json({ error: 'Failed to get achievements' });
  }
});

export default router;
