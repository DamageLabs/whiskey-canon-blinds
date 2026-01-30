import { Router, Response } from 'express';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { AuthRequest, authenticateParticipant } from '../middleware/auth.js';
import { getIO } from '../socket/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Mark participant as ready
router.post('/ready', authenticateParticipant, async (req: AuthRequest, res: Response) => {
  try {
    const participant = await db.query.participants.findFirst({
      where: eq(schema.participants.id, req.participantId!),
    });

    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    await db.update(schema.participants)
      .set({ isReady: true })
      .where(eq(schema.participants.id, req.participantId!));

    // Notify other participants
    const io = getIO();
    io.to(participant.sessionId).emit('participant:ready', {
      participantId: req.participantId,
      displayName: participant.displayName,
    });

    return res.json({ message: 'Marked as ready' });
  } catch (error) {
    logger.error('Ready error:', error);
    return res.status(500).json({ error: 'Failed to mark as ready' });
  }
});

// Update participant status
router.patch('/status', authenticateParticipant, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;

    if (!['waiting', 'tasting', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const participant = await db.query.participants.findFirst({
      where: eq(schema.participants.id, req.participantId!),
    });

    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    await db.update(schema.participants)
      .set({ status })
      .where(eq(schema.participants.id, req.participantId!));

    // Notify other participants
    const io = getIO();
    io.to(participant.sessionId).emit('participant:status', {
      participantId: req.participantId,
      status,
    });

    return res.json({ message: 'Status updated' });
  } catch (error) {
    logger.error('Update status error:', error);
    return res.status(500).json({ error: 'Failed to update status' });
  }
});

// Leave session
router.delete('/leave', authenticateParticipant, async (req: AuthRequest, res: Response) => {
  try {
    const participant = await db.query.participants.findFirst({
      where: eq(schema.participants.id, req.participantId!),
    });

    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    await db.delete(schema.participants)
      .where(eq(schema.participants.id, req.participantId!));

    // Notify other participants
    const io = getIO();
    io.to(participant.sessionId).emit('participant:left', {
      participantId: req.participantId,
      displayName: participant.displayName,
    });

    res.clearCookie('participantToken');

    return res.json({ message: 'Left session' });
  } catch (error) {
    logger.error('Leave error:', error);
    return res.status(500).json({ error: 'Failed to leave session' });
  }
});

// Get current participant info
router.get('/me', authenticateParticipant, async (req: AuthRequest, res: Response) => {
  try {
    const participant = await db.query.participants.findFirst({
      where: eq(schema.participants.id, req.participantId!),
    });

    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    return res.json(participant);
  } catch (error) {
    logger.error('Get participant error:', error);
    return res.status(500).json({ error: 'Failed to get participant' });
  }
});

export default router;
