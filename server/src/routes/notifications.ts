import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// VAPID keys should be generated once and stored in environment variables
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';

// GET /api/notifications/vapid-key - Get VAPID public key
router.get('/vapid-key', (req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(503).json({
      error: 'Push notifications not configured',
      message: 'VAPID_PUBLIC_KEY environment variable not set'
    });
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// POST /api/notifications/subscribe - Register push subscription
router.post('/subscribe', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription data' });
    }

    // Check if subscription already exists
    const existing = await db.query.pushSubscriptions.findFirst({
      where: eq(schema.pushSubscriptions.endpoint, endpoint),
    });

    if (existing) {
      // Update the existing subscription
      await db.update(schema.pushSubscriptions)
        .set({
          userId,
          keysP256dh: keys.p256dh,
          keysAuth: keys.auth,
          lastUsedAt: new Date(),
        })
        .where(eq(schema.pushSubscriptions.id, existing.id));
    } else {
      // Create new subscription
      await db.insert(schema.pushSubscriptions).values({
        id: uuidv4(),
        userId,
        endpoint,
        keysP256dh: keys.p256dh,
        keysAuth: keys.auth,
        createdAt: new Date(),
      });
    }

    res.json({ message: 'Subscription saved successfully' });
  } catch (error) {
    console.error('Error saving subscription:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// DELETE /api/notifications/unsubscribe - Remove push subscription
router.delete('/unsubscribe', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint is required' });
    }

    await db.delete(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.endpoint, endpoint));

    res.json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// GET /api/notifications/preferences - Get notification preferences
router.get('/preferences', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let preferences = await db.query.notificationPreferences.findFirst({
      where: eq(schema.notificationPreferences.userId, userId),
    });

    if (!preferences) {
      // Return default preferences
      preferences = {
        id: '',
        userId,
        sessionInvites: true,
        sessionStarting: true,
        sessionReveal: true,
        newFollowers: true,
        achievements: true,
        directMessages: true,
        updatedAt: new Date(),
      };
    }

    res.json({
      sessionInvites: preferences.sessionInvites,
      sessionStarting: preferences.sessionStarting,
      sessionReveal: preferences.sessionReveal,
      newFollowers: preferences.newFollowers,
      achievements: preferences.achievements,
      directMessages: preferences.directMessages,
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// PUT /api/notifications/preferences - Update notification preferences
router.put('/preferences', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      sessionInvites,
      sessionStarting,
      sessionReveal,
      newFollowers,
      achievements,
      directMessages,
    } = req.body;

    const existing = await db.query.notificationPreferences.findFirst({
      where: eq(schema.notificationPreferences.userId, userId),
    });

    const now = new Date();

    if (existing) {
      await db.update(schema.notificationPreferences)
        .set({
          sessionInvites: sessionInvites ?? existing.sessionInvites,
          sessionStarting: sessionStarting ?? existing.sessionStarting,
          sessionReveal: sessionReveal ?? existing.sessionReveal,
          newFollowers: newFollowers ?? existing.newFollowers,
          achievements: achievements ?? existing.achievements,
          directMessages: directMessages ?? existing.directMessages,
          updatedAt: now,
        })
        .where(eq(schema.notificationPreferences.id, existing.id));
    } else {
      await db.insert(schema.notificationPreferences).values({
        id: uuidv4(),
        userId,
        sessionInvites: sessionInvites ?? true,
        sessionStarting: sessionStarting ?? true,
        sessionReveal: sessionReveal ?? true,
        newFollowers: newFollowers ?? true,
        achievements: achievements ?? true,
        directMessages: directMessages ?? true,
        updatedAt: now,
      });
    }

    const preferences = await db.query.notificationPreferences.findFirst({
      where: eq(schema.notificationPreferences.userId, userId),
    });

    res.json({
      sessionInvites: preferences?.sessionInvites ?? true,
      sessionStarting: preferences?.sessionStarting ?? true,
      sessionReveal: preferences?.sessionReveal ?? true,
      newFollowers: preferences?.newFollowers ?? true,
      achievements: preferences?.achievements ?? true,
      directMessages: preferences?.directMessages ?? true,
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

export default router;
