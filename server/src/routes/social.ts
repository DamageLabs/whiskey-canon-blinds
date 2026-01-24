import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db, schema } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { AuthRequest, authenticateUser } from '../middleware/auth';

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
          process.env.JWT_SECRET || 'whiskey-canon-secret-change-in-production'
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

export default router;
