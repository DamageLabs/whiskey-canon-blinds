import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken, ParticipantJwtPayload, JwtPayload } from '../middleware/auth.js';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

let io: Server;

interface AuthenticatedSocket extends Socket {
  participantId?: string;
  sessionId?: string;
  userId?: string;
}

export function initializeSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = verifyToken(token as string);

      if ('participantId' in decoded) {
        // Participant token
        const participantPayload = decoded as ParticipantJwtPayload;
        socket.participantId = participantPayload.participantId;
        socket.sessionId = participantPayload.sessionId;
      } else {
        // User token
        const userPayload = decoded as JwtPayload;
        socket.userId = userPayload.userId;
      }

      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    logger.debug(`Client connected: ${socket.id}`);

    // Join session room
    if (socket.sessionId) {
      socket.join(socket.sessionId);
      logger.debug(`Socket ${socket.id} joined session ${socket.sessionId}`);

      // Notify others
      socket.to(socket.sessionId).emit('participant:connected', {
        participantId: socket.participantId,
      });
    }

    // Handle joining a specific session room (for moderators)
    socket.on('join:session', async (sessionId: string) => {
      // Verify user is moderator of this session
      if (socket.userId) {
        const session = await db.query.sessions.findFirst({
          where: eq(schema.sessions.id, sessionId),
        });

        if (session && session.moderatorId === socket.userId) {
          socket.join(sessionId);
          socket.sessionId = sessionId;
          logger.debug(`Moderator ${socket.userId} joined session ${sessionId}`);
        }
      }
    });

    // Handle phase advance (for moderators)
    socket.on('advance:phase', async (data: { sessionId: string; phase: string; whiskeyIndex?: number }) => {
      if (!socket.userId) return;

      const session = await db.query.sessions.findFirst({
        where: eq(schema.sessions.id, data.sessionId),
      });

      if (session && session.moderatorId === socket.userId) {
        // Update database
        await db.update(schema.sessions)
          .set({
            currentPhase: data.phase,
            currentWhiskeyIndex: data.whiskeyIndex ?? session.currentWhiskeyIndex,
            updatedAt: new Date(),
          })
          .where(eq(schema.sessions.id, data.sessionId));

        // Broadcast to all participants
        io.to(data.sessionId).emit('session:advanced', {
          phase: data.phase,
          whiskeyIndex: data.whiskeyIndex ?? session.currentWhiskeyIndex,
        });
      }
    });

    // Handle ready status
    socket.on('participant:ready', async () => {
      if (!socket.participantId || !socket.sessionId) return;

      await db.update(schema.participants)
        .set({ isReady: true })
        .where(eq(schema.participants.id, socket.participantId));

      const participant = await db.query.participants.findFirst({
        where: eq(schema.participants.id, socket.participantId),
      });

      io.to(socket.sessionId).emit('participant:ready', {
        participantId: socket.participantId,
        displayName: participant?.displayName,
      });
    });

    // Handle score submission notification
    socket.on('score:submit', async (data: { whiskeyId: string }) => {
      if (!socket.participantId || !socket.sessionId) return;

      const participant = await db.query.participants.findFirst({
        where: eq(schema.participants.id, socket.participantId),
      });

      io.to(socket.sessionId).emit('score:locked', {
        participantId: socket.participantId,
        whiskeyId: data.whiskeyId,
        participantName: participant?.displayName,
      });
    });

    // Handle typing/activity indicators
    socket.on('participant:typing', () => {
      if (!socket.sessionId || !socket.participantId) return;
      socket.to(socket.sessionId).emit('participant:typing', {
        participantId: socket.participantId,
      });
    });

    // Handle comment events (real-time comment updates)
    socket.on('comment:add', (data: { sessionId: string; comment: unknown }) => {
      if (!socket.participantId) return;
      // Broadcast to other participants in the session
      socket.to(data.sessionId).emit('comment:add', data.comment);
    });

    socket.on('comment:delete', (data: { sessionId: string; commentId: string; whiskeyId: string }) => {
      if (!socket.participantId) return;
      // Broadcast to other participants in the session
      socket.to(data.sessionId).emit('comment:delete', {
        id: data.commentId,
        whiskeyId: data.whiskeyId,
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.debug(`Client disconnected: ${socket.id}`);

      if (socket.sessionId && socket.participantId) {
        socket.to(socket.sessionId).emit('participant:disconnected', {
          participantId: socket.participantId,
        });
      }
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}
