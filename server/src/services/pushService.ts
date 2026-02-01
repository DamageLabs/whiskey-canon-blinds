import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

// VAPID keys from environment
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@example.com';

// web-push module (optional) - types are dynamically inferred
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let webpush: any = null;
let isConfigured = false;

// Initialize web-push if keys are configured
async function initWebPush() {
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    try {
      // Dynamic import since web-push may not be installed
      // Use string variable to prevent TypeScript from trying to resolve the module
      const moduleName = 'web-push';
      const webpushModule = await import(/* webpackIgnore: true */ moduleName);
      webpush = webpushModule.default || webpushModule;
      webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
      isConfigured = true;
      logger.info('Push notifications configured');
    } catch (error) {
      logger.warn('web-push module not available, push notifications disabled');
    }
  }
}

// Try to init at module load
initWebPush().catch(() => {});

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    action: string;
    title: string;
  }>;
}

// Send push notification to a specific user
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!isConfigured || !webpush) {
    logger.debug('Push notifications not configured, skipping send');
    return;
  }

  try {
    // Get user's push subscriptions
    const subscriptions = await db.query.pushSubscriptions.findMany({
      where: eq(schema.pushSubscriptions.userId, userId),
    });

    if (subscriptions.length === 0) {
      logger.debug(`No push subscriptions for user ${userId}`);
      return;
    }

    // Send to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keysP256dh,
            auth: sub.keysAuth,
          },
        };

        try {
          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(payload)
          );

          // Update last used timestamp
          await db.update(schema.pushSubscriptions)
            .set({ lastUsedAt: new Date() })
            .where(eq(schema.pushSubscriptions.id, sub.id));
        } catch (error: unknown) {
          const pushError = error as { statusCode?: number };
          // If subscription is invalid, remove it
          if (pushError.statusCode === 404 || pushError.statusCode === 410) {
            logger.info(`Removing invalid push subscription ${sub.id}`);
            await db.delete(schema.pushSubscriptions)
              .where(eq(schema.pushSubscriptions.id, sub.id));
          }
          throw error;
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    if (failed > 0) {
      logger.warn(`Push notifications: ${successful} sent, ${failed} failed for user ${userId}`);
    }
  } catch (error) {
    logger.error('Error sending push notification:', error);
  }
}

// Check user's notification preferences before sending
async function shouldSendNotification(userId: string, type: string): Promise<boolean> {
  const prefs = await db.query.notificationPreferences.findFirst({
    where: eq(schema.notificationPreferences.userId, userId),
  });

  if (!prefs) {
    return true; // Default to sending
  }

  switch (type) {
    case 'session_invite':
      return prefs.sessionInvites;
    case 'session_starting':
      return prefs.sessionStarting;
    case 'session_reveal':
      return prefs.sessionReveal;
    case 'new_follower':
      return prefs.newFollowers;
    case 'achievement':
      return prefs.achievements;
    case 'direct_message':
      return prefs.directMessages;
    default:
      return true;
  }
}

// Notification helpers for common scenarios

export async function notifySessionStarting(
  userId: string,
  sessionName: string,
  sessionId: string
): Promise<void> {
  if (!(await shouldSendNotification(userId, 'session_starting'))) return;

  await sendPushToUser(userId, {
    title: 'Session Starting',
    body: `${sessionName} is starting now!`,
    icon: '/icon-192.png',
    data: {
      type: 'session_starting',
      sessionId,
      url: `/session/${sessionId}/tasting`,
    },
    actions: [
      { action: 'join', title: 'Join Now' },
    ],
  });
}

export async function notifySessionReveal(
  userId: string,
  sessionName: string,
  sessionId: string
): Promise<void> {
  if (!(await shouldSendNotification(userId, 'session_reveal'))) return;

  await sendPushToUser(userId, {
    title: 'Reveal Time!',
    body: `Results are ready for ${sessionName}`,
    icon: '/icon-192.png',
    data: {
      type: 'session_reveal',
      sessionId,
      url: `/session/${sessionId}/reveal`,
    },
    actions: [
      { action: 'view', title: 'View Results' },
    ],
  });
}

export async function notifyNewFollower(
  userId: string,
  followerName: string,
  followerId: string
): Promise<void> {
  if (!(await shouldSendNotification(userId, 'new_follower'))) return;

  await sendPushToUser(userId, {
    title: 'New Follower',
    body: `${followerName} started following you`,
    icon: '/icon-192.png',
    data: {
      type: 'new_follower',
      followerId,
      url: `/user/${followerId}`,
    },
    actions: [
      { action: 'view', title: 'View Profile' },
    ],
  });
}

export async function notifyAchievement(
  userId: string,
  achievementName: string,
  achievementId: string
): Promise<void> {
  if (!(await shouldSendNotification(userId, 'achievement'))) return;

  await sendPushToUser(userId, {
    title: 'Achievement Unlocked!',
    body: `You earned: ${achievementName}`,
    icon: '/icon-192.png',
    data: {
      type: 'achievement',
      achievementId,
      url: '/achievements',
    },
    actions: [
      { action: 'view', title: 'View Achievement' },
    ],
  });
}

export async function notifyDirectMessage(
  userId: string,
  senderName: string,
  conversationId: string,
  messagePreview: string
): Promise<void> {
  if (!(await shouldSendNotification(userId, 'direct_message'))) return;

  await sendPushToUser(userId, {
    title: senderName,
    body: messagePreview.length > 100 ? messagePreview.substring(0, 97) + '...' : messagePreview,
    icon: '/icon-192.png',
    data: {
      type: 'direct_message',
      conversationId,
      url: `/messages/${conversationId}`,
    },
    actions: [
      { action: 'reply', title: 'Reply' },
    ],
  });
}

export { isConfigured as isPushConfigured };
