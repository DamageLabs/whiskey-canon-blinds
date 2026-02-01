import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import { eq, and, sql, desc, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { emitToUser } from '../socket/index.js';
import { notifyDirectMessage } from '../services/pushService.js';

const router = Router();

// Helper to check if two users mutually follow each other
async function areMutualFollows(userId1: string, userId2: string): Promise<boolean> {
  const follow1 = await db.query.follows.findFirst({
    where: and(
      eq(schema.follows.followerId, userId1),
      eq(schema.follows.followingId, userId2)
    ),
  });

  const follow2 = await db.query.follows.findFirst({
    where: and(
      eq(schema.follows.followerId, userId2),
      eq(schema.follows.followingId, userId1)
    ),
  });

  return !!follow1 && !!follow2;
}

// Helper to get sorted participant IDs for conversation lookup
function getSortedParticipantIds(userId1: string, userId2: string): string {
  return JSON.stringify([userId1, userId2].sort());
}

// GET /api/messages/conversations - List user's conversations
router.get('/conversations', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get all conversations where user is a participant
    const conversations = await db.select()
      .from(schema.conversations)
      .where(sql`${schema.conversations.participantIds} LIKE '%' || ${userId} || '%'`)
      .orderBy(desc(schema.conversations.lastMessageAt));

    // Get details for each conversation
    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conv) => {
        const participantIds = JSON.parse(conv.participantIds) as string[];
        const otherUserId = participantIds.find(id => id !== userId);

        if (!otherUserId) return null;

        const otherUser = await db.query.users.findFirst({
          where: eq(schema.users.id, otherUserId),
        });

        if (!otherUser) return null;

        // Get last message
        const lastMessage = await db.query.messages.findFirst({
          where: eq(schema.messages.conversationId, conv.id),
          orderBy: [desc(schema.messages.createdAt)],
        });

        // Get unread count
        const unreadResult = await db.select({ count: sql<number>`count(*)` })
          .from(schema.messages)
          .where(
            and(
              eq(schema.messages.conversationId, conv.id),
              sql`${schema.messages.senderId} != ${userId}`,
              isNull(schema.messages.readAt)
            )
          );

        return {
          id: conv.id,
          otherUser: {
            id: otherUser.id,
            displayName: otherUser.displayName,
            avatarUrl: otherUser.avatarUrl,
          },
          lastMessage: lastMessage ? {
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            isOwn: lastMessage.senderId === userId,
          } : null,
          unreadCount: unreadResult[0]?.count || 0,
          lastMessageAt: conv.lastMessageAt,
        };
      })
    );

    res.json({
      conversations: conversationsWithDetails.filter(Boolean),
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET /api/messages/conversations/:userId - Get or create conversation with a user
router.get('/conversations/:userId', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.userId;
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const otherUserId = req.params.userId as string;

    if (currentUserId === otherUserId) {
      return res.status(400).json({ error: 'Cannot message yourself' });
    }

    // Check if users mutually follow each other
    const canMessage = await areMutualFollows(currentUserId, otherUserId);
    if (!canMessage) {
      return res.status(403).json({
        error: 'You can only message users who you follow and who follow you back'
      });
    }

    const participantIds = getSortedParticipantIds(currentUserId, otherUserId);

    // Check if conversation exists
    let conversation = await db.query.conversations.findFirst({
      where: eq(schema.conversations.participantIds, participantIds),
    });

    if (!conversation) {
      // Create new conversation
      const id = uuidv4();
      await db.insert(schema.conversations).values({
        id,
        participantIds,
        createdAt: new Date(),
      });
      conversation = await db.query.conversations.findFirst({
        where: eq(schema.conversations.id, id),
      });
    }

    const otherUser = await db.query.users.findFirst({
      where: eq(schema.users.id, otherUserId),
    });

    res.json({
      id: conversation?.id,
      otherUser: {
        id: otherUser?.id,
        displayName: otherUser?.displayName,
        avatarUrl: otherUser?.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// GET /api/messages/:conversationId - Get messages in a conversation
router.get('/:conversationId', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const conversationId = req.params.conversationId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    // Verify user is part of the conversation
    const conversation = await db.query.conversations.findFirst({
      where: eq(schema.conversations.id, conversationId),
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const participantIds = JSON.parse(conversation.participantIds) as string[];
    if (!participantIds.includes(userId)) {
      return res.status(403).json({ error: 'Not a participant in this conversation' });
    }

    // Get messages
    const messages = await db.select({
      id: schema.messages.id,
      content: schema.messages.content,
      senderId: schema.messages.senderId,
      readAt: schema.messages.readAt,
      createdAt: schema.messages.createdAt,
    })
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(desc(schema.messages.createdAt))
      .limit(limit)
      .offset(offset);

    // Get sender info
    const messagesWithSender = await Promise.all(
      messages.map(async (msg) => {
        const sender = await db.query.users.findFirst({
          where: eq(schema.users.id, msg.senderId),
        });
        return {
          ...msg,
          isOwn: msg.senderId === userId,
          sender: {
            id: sender?.id,
            displayName: sender?.displayName,
            avatarUrl: sender?.avatarUrl,
          },
        };
      })
    );

    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId));

    const total = countResult[0]?.count || 0;

    res.json({
      messages: messagesWithSender.reverse(), // Return in chronological order
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/messages/:conversationId - Send a message
router.post('/:conversationId', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const conversationId = req.params.conversationId as string;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (content.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 characters)' });
    }

    // Verify user is part of the conversation
    const conversation = await db.query.conversations.findFirst({
      where: eq(schema.conversations.id, conversationId),
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const participantIds = JSON.parse(conversation.participantIds) as string[];
    if (!participantIds.includes(userId)) {
      return res.status(403).json({ error: 'Not a participant in this conversation' });
    }

    const now = new Date();
    const messageId = uuidv4();

    await db.insert(schema.messages).values({
      id: messageId,
      conversationId,
      senderId: userId,
      content: content.trim(),
      createdAt: now,
    });

    // Update conversation's last message timestamp
    await db.update(schema.conversations)
      .set({ lastMessageAt: now })
      .where(eq(schema.conversations.id, conversationId));

    const message = await db.query.messages.findFirst({
      where: eq(schema.messages.id, messageId),
    });

    const sender = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    const messageResponse = {
      ...message,
      isOwn: true,
      sender: {
        id: sender?.id,
        displayName: sender?.displayName,
        avatarUrl: sender?.avatarUrl,
      },
    };

    res.status(201).json(messageResponse);

    // Emit to recipient via socket
    const recipientId = participantIds.find(id => id !== userId);
    if (recipientId) {
      emitToUser(recipientId, 'message:new', {
        ...messageResponse,
        isOwn: false,
      });

      // Send push notification
      notifyDirectMessage(
        recipientId,
        sender?.displayName || 'Someone',
        conversationId,
        content.trim()
      ).catch(err => console.error('Failed to send push notification:', err));
    }
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// POST /api/messages/:conversationId/read - Mark messages as read
router.post('/:conversationId/read', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const conversationId = req.params.conversationId as string;

    // Verify user is part of the conversation
    const conversation = await db.query.conversations.findFirst({
      where: eq(schema.conversations.id, conversationId),
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const participantIds = JSON.parse(conversation.participantIds) as string[];
    if (!participantIds.includes(userId)) {
      return res.status(403).json({ error: 'Not a participant in this conversation' });
    }

    // Mark all unread messages from other users as read
    await db.update(schema.messages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(schema.messages.conversationId, conversationId),
          sql`${schema.messages.senderId} != ${userId}`,
          isNull(schema.messages.readAt)
        )
      );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// GET /api/messages/unread-count - Get total unread message count
router.get('/unread-count', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get all conversations user is part of
    const conversations = await db.select()
      .from(schema.conversations)
      .where(sql`${schema.conversations.participantIds} LIKE '%' || ${userId} || '%'`);

    let totalUnread = 0;

    for (const conv of conversations) {
      const unreadResult = await db.select({ count: sql<number>`count(*)` })
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.conversationId, conv.id),
            sql`${schema.messages.senderId} != ${userId}`,
            isNull(schema.messages.readAt)
          )
        );
      totalUnread += unreadResult[0]?.count || 0;
    }

    res.json({ unreadCount: totalUnread });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Check if can message a user
router.get('/can-message/:userId', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.userId;
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const otherUserId = req.params.userId as string;

    if (currentUserId === otherUserId) {
      return res.json({ canMessage: false, reason: 'Cannot message yourself' });
    }

    const canMessage = await areMutualFollows(currentUserId, otherUserId);

    res.json({
      canMessage,
      reason: canMessage ? null : 'You can only message users who you follow and who follow you back',
    });
  } catch (error) {
    console.error('Error checking message ability:', error);
    res.status(500).json({ error: 'Failed to check message ability' });
  }
});

export default router;
