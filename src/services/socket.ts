import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);

let socket: Socket | null = null;

export interface SocketEvents {
  'session:started': { sessionId: string };
  'session:advanced': { phase: string; whiskeyIndex: number };
  'session:paused': { sessionId: string };
  'session:resumed': { sessionId: string };
  'session:reveal': { sessionId: string; whiskeys: unknown[]; scores: unknown[] };
  'session:ended': { sessionId: string };
  'participant:joined': { id: string; displayName: string; status: string; isReady: boolean };
  'participant:left': { participantId: string; displayName: string };
  'participant:ready': { participantId: string; displayName: string };
  'participant:status': { participantId: string; status: string };
  'participant:connected': { participantId: string };
  'participant:disconnected': { participantId: string };
  'score:locked': { participantId: string; whiskeyId: string; participantName: string };
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    if (import.meta.env.DEV) {
      console.log('Socket connected:', socket?.id);
    }
  });

  socket.on('disconnect', (reason) => {
    if (import.meta.env.DEV) {
      console.log('Socket disconnected:', reason);
    }
  });

  socket.on('connect_error', (error) => {
    // Keep error logging in production for debugging connection issues
    console.error('Socket connection error:', error.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export function joinSession(sessionId: string): void {
  socket?.emit('join:session', sessionId);
}

export function emitReady(): void {
  socket?.emit('participant:ready');
}

export function emitAdvancePhase(sessionId: string, phase: string, whiskeyIndex?: number): void {
  socket?.emit('advance:phase', { sessionId, phase, whiskeyIndex });
}

export function emitScoreSubmit(whiskeyId: string): void {
  socket?.emit('score:submit', { whiskeyId });
}

export function onSocketEvent<K extends keyof SocketEvents>(
  event: K,
  callback: (data: SocketEvents[K]) => void
): () => void {
  socket?.on(event as string, callback as (...args: unknown[]) => void);
  return () => {
    socket?.off(event as string, callback as (...args: unknown[]) => void);
  };
}
