import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  analyticsApi,
  type AnalyticsTrend,
  type AnalyticsSummary,
  type AnalyticsRanking,
  type AnalyticsSession,
  type AnalyticsDistribution,
} from '@/services/api';

interface AnalyticsState {
  trends: AnalyticsTrend[];
  summary: AnalyticsSummary | null;
  rankings: AnalyticsRanking[];
  sessions: AnalyticsSession[];
  distribution: AnalyticsDistribution | null;

  // UI state
  selectedDays: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchTrends: (days?: number) => Promise<void>;
  fetchRankings: (limit?: number) => Promise<void>;
  fetchSessions: (limit?: number) => Promise<void>;
  fetchDistribution: () => Promise<void>;
  fetchAll: (days?: number) => Promise<void>;
  setSelectedDays: (days: number) => void;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  trends: [],
  summary: null,
  rankings: [],
  sessions: [],
  distribution: null,
  selectedDays: 90,
  isLoading: false,
  error: null,
};

export const useAnalyticsStore = create<AnalyticsState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      fetchTrends: async (days) => {
        set({ isLoading: true, error: null });
        try {
          const daysToUse = days ?? get().selectedDays;
          const { trends, summary } = await analyticsApi.getTrends(daysToUse);
          set({ trends, summary, selectedDays: daysToUse, isLoading: false });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
          throw error;
        }
      },

      fetchRankings: async (limit = 20) => {
        set({ isLoading: true, error: null });
        try {
          const { rankings } = await analyticsApi.getRankings(limit);
          set({ rankings, isLoading: false });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
          throw error;
        }
      },

      fetchSessions: async (limit = 20) => {
        set({ isLoading: true, error: null });
        try {
          const { sessions } = await analyticsApi.getSessions(limit);
          set({ sessions, isLoading: false });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
          throw error;
        }
      },

      fetchDistribution: async () => {
        set({ isLoading: true, error: null });
        try {
          const distribution = await analyticsApi.getDistribution();
          set({ distribution, isLoading: false });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
          throw error;
        }
      },

      fetchAll: async (days) => {
        set({ isLoading: true, error: null });
        try {
          const daysToUse = days ?? get().selectedDays;
          const [trendsData, rankingsData, sessionsData, distributionData] = await Promise.all([
            analyticsApi.getTrends(daysToUse),
            analyticsApi.getRankings(20),
            analyticsApi.getSessions(20),
            analyticsApi.getDistribution(),
          ]);

          set({
            trends: trendsData.trends,
            summary: trendsData.summary,
            rankings: rankingsData.rankings,
            sessions: sessionsData.sessions,
            distribution: distributionData,
            selectedDays: daysToUse,
            isLoading: false,
          });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
          throw error;
        }
      },

      setSelectedDays: (days) => {
        set({ selectedDays: days });
      },

      clearError: () => {
        set({ error: null });
      },

      reset: () => {
        set(initialState);
      },
    }),
    { name: 'analytics-store' }
  )
);
