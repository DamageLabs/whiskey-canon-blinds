import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { WSEventType } from '@/types';

interface UseWebSocketOptions {
  url: string;
  sessionId: string;
  participantId: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

type EventHandler = (payload: unknown) => void;

export function useWebSocket(options: UseWebSocketOptions) {
  const { url, sessionId, participantId, onConnect, onDisconnect, onError } = options;
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef<Map<WSEventType, EventHandler[]>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    const socket = io(url, {
      query: {
        sessionId,
        participantId,
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      setIsConnected(true);
      onConnect?.();
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      onDisconnect?.();
    });

    socket.on('connect_error', (error) => {
      onError?.(error);
    });

    // Set up event listeners for all registered handlers
    handlersRef.current.forEach((handlers, eventType) => {
      handlers.forEach((handler) => {
        socket.on(eventType, handler);
      });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [url, sessionId, participantId, onConnect, onDisconnect, onError]);

  // Register event handler
  const on = useCallback((event: WSEventType, handler: EventHandler) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, []);
    }
    handlersRef.current.get(event)!.push(handler);

    // If socket exists, add listener immediately
    if (socketRef.current) {
      socketRef.current.on(event, handler);
    }

    // Return unsubscribe function
    return () => {
      const handlers = handlersRef.current.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
      socketRef.current?.off(event, handler);
    };
  }, []);

  // Emit event
  const emit = useCallback((event: string, payload?: unknown) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, payload);
    }
  }, []);

  return {
    isConnected,
    on,
    emit,
    socket: socketRef.current,
  };
}

// Placeholder hook for when WebSocket is not needed (e.g., local-only mode)
export function useWebSocketMock() {
  return {
    isConnected: true,
    on: () => () => {},
    emit: () => {},
    socket: null,
  };
}
