import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db, schema } from '../db/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { AuthRequest, authenticateParticipant } from '../middleware/auth.js';
import { validateLength } from '../utils/validation.js';
import { getIO } from '../socket/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Comments require participant authentication
router.use(authenticateParticipant);

// Helper to check if comments are allowed for a session
async function canComment(sessionId: string): Promise<boolean> {
  const session = await db.query.sessions.findFirst({
    where: eq(schema.sessions.id, sessionId),
  });
  // Only allow comments during reveal or completed phases (anti-anchoring)
  return session?.status === 'reveal' || session?.status === 'completed';
}

// Get comments for a whiskey in a session
router.get('/session/:sessionId/whiskey/:whiskeyId', async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const whiskeyId = req.params.whiskeyId as string;

    // Verify session access
    if (req.sessionId !== sessionId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const commentsData = await db.query.comments.findMany({
      where: and(
        eq(schema.comments.sessionId, sessionId),
        eq(schema.comments.whiskeyId, whiskeyId)
      ),
      orderBy: [desc(schema.comments.createdAt)],
    });

    // Fetch participant names
    const participantIds = [...new Set(commentsData.map((c) => c.participantId))];
    const participants = await Promise.all(
      participantIds.map((id) =>
        db.query.participants.findFirst({
          where: eq(schema.participants.id, id),
        })
      )
    );

    const participantMap = new Map(
      participants.filter(Boolean).map((p) => [p!.id, p!.displayName])
    );

    const commentsWithNames = commentsData.map((c) => ({
      ...c,
      participantName: participantMap.get(c.participantId) || 'Unknown',
      isOwn: c.participantId === req.participantId,
    }));

    return res.json(commentsWithNames);
  } catch (error) {
    logger.error('Get comments error:', error);
    return res.status(500).json({ error: 'Failed to get comments' });
  }
});

// Create a new comment
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, whiskeyId, content, parentId } = req.body;

    if (!sessionId || !whiskeyId || !content) {
      return res.status(400).json({ error: 'Session ID, whiskey ID, and content are required' });
    }

    // Verify session access
    if (req.sessionId !== sessionId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if comments are allowed
    if (!(await canComment(sessionId))) {
      return res.status(403).json({ error: 'Comments are only allowed after reveal' });
    }

    // Validate content length
    if (content.length < 1) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }
    const contentCheck = validateLength(content, 1000, 'Comment');
    if (!contentCheck.valid) {
      return res.status(400).json({ error: contentCheck.error });
    }

    // Verify whiskey exists in session
    const whiskey = await db.query.whiskeys.findFirst({
      where: and(
        eq(schema.whiskeys.id, whiskeyId),
        eq(schema.whiskeys.sessionId, sessionId)
      ),
    });

    if (!whiskey) {
      return res.status(404).json({ error: 'Whiskey not found in session' });
    }

    // Verify parent comment if provided
    if (parentId) {
      const parentComment = await db.query.comments.findFirst({
        where: eq(schema.comments.id, parentId),
      });

      if (!parentComment || parentComment.whiskeyId !== whiskeyId) {
        return res.status(400).json({ error: 'Invalid parent comment' });
      }
    }

    const commentId = uuidv4();
    const now = new Date();

    await db.insert(schema.comments).values({
      id: commentId,
      sessionId,
      whiskeyId,
      participantId: req.participantId!,
      parentId: parentId || null,
      content,
      createdAt: now,
      updatedAt: now,
    });

    // Get participant name
    const participant = await db.query.participants.findFirst({
      where: eq(schema.participants.id, req.participantId!),
    });

    const newComment = {
      id: commentId,
      sessionId,
      whiskeyId,
      participantId: req.participantId!,
      parentId: parentId || null,
      content,
      createdAt: now,
      updatedAt: now,
      participantName: participant?.displayName || 'Unknown',
      isOwn: true,
    };

    // Broadcast to session room
    const io = getIO();
    io.to(sessionId).emit('comment:add', newComment);

    return res.status(201).json(newComment);
  } catch (error) {
    logger.error('Create comment error:', error);
    return res.status(500).json({ error: 'Failed to create comment' });
  }
});

// Update a comment
router.put('/:commentId', async (req: AuthRequest, res: Response) => {
  try {
    const commentId = req.params.commentId as string;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const comment = await db.query.comments.findFirst({
      where: eq(schema.comments.id, commentId),
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only allow owner to update
    if (comment.participantId !== req.participantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if comments are still allowed
    if (!(await canComment(comment.sessionId))) {
      return res.status(403).json({ error: 'Comments cannot be modified in this phase' });
    }

    // Validate content length
    if (content.length < 1) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }
    const contentCheck = validateLength(content, 1000, 'Comment');
    if (!contentCheck.valid) {
      return res.status(400).json({ error: contentCheck.error });
    }

    const now = new Date();
    await db.update(schema.comments)
      .set({ content, updatedAt: now })
      .where(eq(schema.comments.id, commentId));

    // Broadcast update
    const io = getIO();
    io.to(comment.sessionId).emit('comment:update', {
      id: commentId,
      content,
      updatedAt: now,
    });

    return res.json({ ...comment, content, updatedAt: now });
  } catch (error) {
    logger.error('Update comment error:', error);
    return res.status(500).json({ error: 'Failed to update comment' });
  }
});

// Delete a comment
router.delete('/:commentId', async (req: AuthRequest, res: Response) => {
  try {
    const commentId = req.params.commentId as string;

    const comment = await db.query.comments.findFirst({
      where: eq(schema.comments.id, commentId),
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only allow owner to delete
    if (comment.participantId !== req.participantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.delete(schema.comments)
      .where(eq(schema.comments.id, commentId));

    // Broadcast deletion
    const io = getIO();
    io.to(comment.sessionId).emit('comment:delete', {
      id: commentId,
      whiskeyId: comment.whiskeyId,
    });

    return res.json({ message: 'Comment deleted' });
  } catch (error) {
    logger.error('Delete comment error:', error);
    return res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;
