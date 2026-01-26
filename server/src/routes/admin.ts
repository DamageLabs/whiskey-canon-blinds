import { Router, Response } from 'express';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { AuthRequest, authenticateUser, requireAdmin } from '../middleware/auth.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticateUser);
router.use(requireAdmin);

// Get all users
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const users = await db.query.users.findMany();

    return res.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        createdAt: u.createdAt,
      }))
    );
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({ error: 'Failed to get users' });
  }
});

// Update user role
router.patch('/users/:userId/role', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "user" or "admin"' });
    }

    // Prevent self-demotion
    if (userId === req.userId && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot demote yourself' });
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.update(schema.users)
      .set({ role })
      .where(eq(schema.users.id, userId));

    return res.json({ message: 'Role updated', userId, role });
  } catch (error) {
    console.error('Update role error:', error);
    return res.status(500).json({ error: 'Failed to update role' });
  }
});

// Delete user
router.delete('/users/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId as string;

    // Prevent self-deletion
    if (userId === req.userId) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.delete(schema.users)
      .where(eq(schema.users.id, userId));

    return res.json({ message: 'User deleted', userId });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get all sessions (admin view)
router.get('/sessions', async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await db.query.sessions.findMany();

    return res.json(sessions);
  } catch (error) {
    console.error('Get sessions error:', error);
    return res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// Delete session
router.delete('/sessions/:sessionId', async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    const session = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await db.delete(schema.sessions)
      .where(eq(schema.sessions.id, sessionId));

    return res.json({ message: 'Session deleted', sessionId });
  } catch (error) {
    console.error('Delete session error:', error);
    return res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;
