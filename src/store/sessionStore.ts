import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  sessionsApi,
  scoresApi,
  participantsApi,
  connectSocket,
  disconnectSocket,
  onSocketEvent,
  joinSession,
  emitAdvancePhase,
  emitScoreSubmit,
  type SessionResponse,
  type CreateSessionData,
  type ScoreData,
  type SessionResults,
} from '@/services';
import { offlineStorage } from '@/services/offlineStorage';
import type {
  TastingPhase,
  SessionStatus,
} from '@/types';

interface Participant {
  id: string;
  displayName: string;
  status: string;
  isReady: boolean;
  currentWhiskeyIndex: number;
}

interface Whiskey {
  id: string;
  displayNumber: number;
  pourSize: string;
  name?: string;
  distillery?: string;
  age?: number;
  proof?: number;
  price?: number;
}

interface Score {
  id: string;
  whiskeyId: string;
  participantId: string;
  nose: number;
  palate: number;
  finish: number;
  overall: number;
  totalScore: number;
}

interface SessionState {
  // Current session data
  session: SessionResponse | null;
  whiskeys: Whiskey[];
  participants: Participant[];
  scores: Map<string, Score>;
  results: SessionResults | null;

  // User context
  currentParticipant: Participant | null;
  participantToken: string | null;
  isModerator: boolean;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Timer state
  timerSeconds: number;
  timerActive: boolean;

  // Socket connected
  isConnected: boolean;

  // Offline queue
  offlineQueueCount: number;

  // Actions
  createSession: (data: CreateSessionData) => Promise<{ id: string; inviteCode: string }>;
  joinSessionByCode: (inviteCode: string, displayName: string) => Promise<string>;
  fetchSession: (sessionId: string) => Promise<void>;
  startSession: (sessionId: string) => Promise<void>;
  advancePhase: (sessionId: string, phase: TastingPhase, whiskeyIndex?: number) => Promise<void>;
  pauseSession: (sessionId: string) => Promise<void>;
  resumeSession: (sessionId: string) => Promise<void>;
  endSession: (sessionId: string) => Promise<void>;
  revealResults: (sessionId: string) => Promise<void>;
  submitScore: (data: Omit<ScoreData, 'sessionId'>) => Promise<void>;
  fetchResults: (sessionId: string) => Promise<void>;
  markReady: () => Promise<void>;
  leaveSession: () => Promise<void>;

  // Socket management
  connectToSession: (token: string, sessionId?: string) => void;
  disconnect: () => void;

  // Offline queue
  syncOfflineQueue: () => Promise<void>;
  updateOfflineQueueCount: () => Promise<void>;

  // Local state updates
  setParticipants: (participants: Participant[]) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (participantId: string) => void;
  updateParticipant: (participantId: string, updates: Partial<Participant>) => void;
  updateSessionStatus: (status: SessionStatus) => void;
  updateCurrentWhiskey: (index: number) => void;
  updateCurrentPhase: (phase: TastingPhase) => void;

  setTimer: (seconds: number) => void;
  decrementTimer: () => void;
  setTimerActive: (active: boolean) => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  reset: () => void;
}

const initialState = {
  session: null,
  whiskeys: [],
  participants: [],
  scores: new Map<string, Score>(),
  results: null,
  currentParticipant: null,
  participantToken: null,
  isModerator: false,
  isLoading: false,
  error: null,
  timerSeconds: 0,
  timerActive: false,
  isConnected: false,
  offlineQueueCount: 0,
};

export const useSessionStore = create<SessionState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // API Actions
      createSession: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await sessionsApi.create(data);

          // Participant token is stored in httpOnly cookie by backend
          set({
            isModerator: true,
            participantToken: response.participantToken,
            isLoading: false,
          });

          return { id: response.id, inviteCode: response.inviteCode };
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
          throw error;
        }
      },

      joinSessionByCode: async (inviteCode, displayName) => {
        set({ isLoading: true, error: null });
        try {
          const response = await sessionsApi.join({ inviteCode, displayName });

          // Participant token is stored in httpOnly cookie by backend
          set({
            participantToken: response.participantToken,
            currentParticipant: {
              id: response.participantId,
              displayName,
              status: 'waiting',
              isReady: response.isModerator || false,
              currentWhiskeyIndex: 0,
            },
            isModerator: response.isModerator || false,
            isLoading: false,
          });

          return response.sessionId;
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
          throw error;
        }
      },

      fetchSession: async (sessionId) => {
        set({ isLoading: true, error: null });
        try {
          const session = await sessionsApi.get(sessionId);

          set((state) => ({
            session,
            whiskeys: session.whiskeys,
            participants: session.participants,
            // Update isModerator from server response
            isModerator: session.isModerator ?? state.isModerator,
            // Update currentParticipant if we have the ID
            currentParticipant: session.currentParticipantId
              ? session.participants.find((p) => p.id === session.currentParticipantId) || state.currentParticipant
              : state.currentParticipant,
            isLoading: false,
          }));
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
          throw error;
        }
      },

      startSession: async (sessionId) => {
        try {
          await sessionsApi.start(sessionId);
          set((state) => ({
            session: state.session ? { ...state.session, status: 'active' } : null,
          }));
        } catch (error) {
          set({ error: (error as Error).message });
          throw error;
        }
      },

      advancePhase: async (sessionId, phase, whiskeyIndex) => {
        try {
          const response = await sessionsApi.advance(sessionId, { phase, whiskeyIndex });

          // Also emit via socket for real-time
          emitAdvancePhase(sessionId, phase, whiskeyIndex);

          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  currentPhase: response.phase,
                  currentWhiskeyIndex: response.whiskeyIndex,
                }
              : null,
          }));
        } catch (error) {
          set({ error: (error as Error).message });
          throw error;
        }
      },

      pauseSession: async (sessionId) => {
        try {
          await sessionsApi.pause(sessionId);
          set((state) => ({
            session: state.session ? { ...state.session, status: 'paused' } : null,
          }));
        } catch (error) {
          set({ error: (error as Error).message });
          throw error;
        }
      },

      resumeSession: async (sessionId) => {
        try {
          await sessionsApi.resume(sessionId);
          set((state) => ({
            session: state.session ? { ...state.session, status: 'active' } : null,
          }));
        } catch (error) {
          set({ error: (error as Error).message });
          throw error;
        }
      },

      endSession: async (sessionId) => {
        try {
          await sessionsApi.end(sessionId);
          set((state) => ({
            session: state.session ? { ...state.session, status: 'completed' } : null,
          }));
        } catch (error) {
          set({ error: (error as Error).message });
          throw error;
        }
      },

      revealResults: async (sessionId) => {
        try {
          await sessionsApi.reveal(sessionId);
          set((state) => ({
            session: state.session ? { ...state.session, status: 'reveal' } : null,
          }));
        } catch (error) {
          set({ error: (error as Error).message });
          throw error;
        }
      },

      submitScore: async (data) => {
        const { session, currentParticipant } = get();
        if (!session || !currentParticipant) return;

        try {
          const response = await scoresApi.submit({
            ...data,
            sessionId: session.id,
          });

          // Emit via socket
          emitScoreSubmit(data.whiskeyId);

          // Add score locally
          const newScores = new Map(get().scores);
          newScores.set(`${currentParticipant.id}-${data.whiskeyId}`, {
            id: response.id,
            whiskeyId: data.whiskeyId,
            participantId: currentParticipant.id,
            nose: data.nose,
            palate: data.palate,
            finish: data.finish,
            overall: data.overall,
            totalScore: response.totalScore,
          });

          set({ scores: newScores });
        } catch (error) {
          // If offline, queue the score for later
          if (!navigator.onLine) {
            try {
              await offlineStorage.queueScore({
                sessionId: session.id,
                whiskeyId: data.whiskeyId,
                nose: data.nose,
                palate: data.palate,
                finish: data.finish,
                overall: data.overall,
                noseNotes: data.noseNotes,
                palateNotes: data.palateNotes,
                finishNotes: data.finishNotes,
                generalNotes: data.generalNotes,
                identityGuess: data.identityGuess,
              });

              // Update queue count
              const count = await offlineStorage.getQueueCount();
              set({ offlineQueueCount: count });

              // Add score locally with temporary ID
              const newScores = new Map(get().scores);
              newScores.set(`${currentParticipant.id}-${data.whiskeyId}`, {
                id: `offline-${Date.now()}`,
                whiskeyId: data.whiskeyId,
                participantId: currentParticipant.id,
                nose: data.nose,
                palate: data.palate,
                finish: data.finish,
                overall: data.overall,
                totalScore: (data.nose + data.palate + data.finish + data.overall) / 4,
              });
              set({ scores: newScores });

              return; // Don't throw - score is queued
            } catch (queueError) {
              console.error('Failed to queue offline score:', queueError);
            }
          }

          set({ error: (error as Error).message });
          throw error;
        }
      },

      fetchResults: async (sessionId) => {
        set({ isLoading: true, error: null });
        try {
          const results = await scoresApi.getSessionResults(sessionId);
          set({ results, isLoading: false });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
          throw error;
        }
      },

      markReady: async () => {
        try {
          await participantsApi.ready();
          set((state) => ({
            currentParticipant: state.currentParticipant
              ? { ...state.currentParticipant, isReady: true }
              : null,
            // Also update in participants array
            participants: state.participants.map((p) =>
              p.id === state.currentParticipant?.id ? { ...p, isReady: true } : p
            ),
          }));
        } catch (error) {
          set({ error: (error as Error).message });
          throw error;
        }
      },

      leaveSession: async () => {
        try {
          await participantsApi.leave();
          // Participant token cookie is cleared by backend
          get().disconnect();
          set(initialState);
        } catch (error) {
          set({ error: (error as Error).message });
          throw error;
        }
      },

      // Socket management
      connectToSession: (token, sessionId) => {
        const socket = connectSocket(token);

        // Join session room if moderator
        if (sessionId) {
          joinSession(sessionId);
        }

        // Set up event listeners
        onSocketEvent('session:started', () => {
          set((state) => ({
            session: state.session ? { ...state.session, status: 'active' } : null,
          }));
        });

        onSocketEvent('session:advanced', (data) => {
          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  currentPhase: data.phase,
                  currentWhiskeyIndex: data.whiskeyIndex,
                }
              : null,
          }));
        });

        onSocketEvent('session:paused', () => {
          set((state) => ({
            session: state.session ? { ...state.session, status: 'paused' } : null,
          }));
        });

        onSocketEvent('session:resumed', () => {
          set((state) => ({
            session: state.session ? { ...state.session, status: 'active' } : null,
          }));
        });

        onSocketEvent('session:reveal', () => {
          set((state) => ({
            session: state.session ? { ...state.session, status: 'reveal' } : null,
          }));
        });

        onSocketEvent('session:ended', () => {
          set((state) => ({
            session: state.session ? { ...state.session, status: 'completed' } : null,
          }));
        });

        onSocketEvent('participant:joined', (data) => {
          set((state) => {
            // Check if participant already exists to avoid duplicates
            const exists = state.participants.some((p) => p.id === data.id);
            if (exists) {
              return state;
            }
            return {
              participants: [...state.participants, { ...data, currentWhiskeyIndex: 0 }],
            };
          });
        });

        onSocketEvent('participant:left', (data) => {
          set((state) => ({
            participants: state.participants.filter((p) => p.id !== data.participantId),
          }));
        });

        onSocketEvent('participant:ready', (data) => {
          set((state) => ({
            participants: state.participants.map((p) =>
              p.id === data.participantId ? { ...p, isReady: true } : p
            ),
          }));
        });

        onSocketEvent('score:locked', (data) => {
          set((state) => ({
            participants: state.participants.map((p) =>
              p.id === data.participantId
                ? { ...p, currentWhiskeyIndex: p.currentWhiskeyIndex + 1 }
                : p
            ),
          }));
        });

        socket.on('connect', () => set({ isConnected: true }));
        socket.on('disconnect', () => set({ isConnected: false }));
      },

      disconnect: () => {
        disconnectSocket();
        set({ isConnected: false });
      },

      // Offline queue methods
      syncOfflineQueue: async () => {
        if (!navigator.onLine) return;

        try {
          const queuedScores = await offlineStorage.getQueuedScores();

          for (const queuedScore of queuedScores) {
            try {
              await scoresApi.submit({
                sessionId: queuedScore.sessionId,
                whiskeyId: queuedScore.whiskeyId,
                nose: queuedScore.nose,
                palate: queuedScore.palate,
                finish: queuedScore.finish,
                overall: queuedScore.overall,
                noseNotes: queuedScore.noseNotes,
                palateNotes: queuedScore.palateNotes,
                finishNotes: queuedScore.finishNotes,
                generalNotes: queuedScore.generalNotes,
                identityGuess: queuedScore.identityGuess,
              });

              await offlineStorage.removeQueuedScore(queuedScore.id);
            } catch (error) {
              console.error('Failed to sync queued score:', error);
            }
          }

          const count = await offlineStorage.getQueueCount();
          set({ offlineQueueCount: count });
        } catch (error) {
          console.error('Failed to sync offline queue:', error);
        }
      },

      updateOfflineQueueCount: async () => {
        try {
          const count = await offlineStorage.getQueueCount();
          set({ offlineQueueCount: count });
        } catch (error) {
          console.error('Failed to update offline queue count:', error);
        }
      },

      // Local state updates
      setParticipants: (participants) => set({ participants }),

      addParticipant: (participant) =>
        set((state) => ({
          participants: [...state.participants, participant],
        })),

      removeParticipant: (participantId) =>
        set((state) => ({
          participants: state.participants.filter((p) => p.id !== participantId),
        })),

      updateParticipant: (participantId, updates) =>
        set((state) => ({
          participants: state.participants.map((p) =>
            p.id === participantId ? { ...p, ...updates } : p
          ),
        })),

      updateSessionStatus: (status) =>
        set((state) => ({
          session: state.session ? { ...state.session, status } : null,
        })),

      updateCurrentWhiskey: (index) =>
        set((state) => ({
          session: state.session
            ? { ...state.session, currentWhiskeyIndex: index }
            : null,
        })),

      updateCurrentPhase: (phase) =>
        set((state) => ({
          session: state.session
            ? { ...state.session, currentPhase: phase }
            : null,
        })),

      setTimer: (seconds) => set({ timerSeconds: seconds }),

      decrementTimer: () =>
        set((state) => ({
          timerSeconds: Math.max(0, state.timerSeconds - 1),
        })),

      setTimerActive: (active) => set({ timerActive: active }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      reset: () => {
        get().disconnect();
        set(initialState);
      },
    }),
    { name: 'session-store' }
  )
);
