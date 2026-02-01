import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { leaderboardApi } from '@/services/api';
import type { LeaderboardEntry, LeaderboardPeriod, MyRankResponse } from '@/services/api';

interface LeaderboardState {
  entries: LeaderboardEntry[];
  period: LeaderboardPeriod;
  periodStart: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  myRanks: MyRankResponse['ranks'] | null;
  isLoading: boolean;
  isLoadingMyRank: boolean;
  error: string | null;

  // Actions
  fetchLeaderboard: (period?: LeaderboardPeriod, page?: number) => Promise<void>;
  fetchMyRank: () => Promise<void>;
  setPeriod: (period: LeaderboardPeriod) => void;
  clearError: () => void;
}

export const useLeaderboardStore = create<LeaderboardState>()(
  devtools(
    (set, get) => ({
      entries: [],
      period: 'all_time',
      periodStart: null,
      pagination: null,
      myRanks: null,
      isLoading: false,
      isLoadingMyRank: false,
      error: null,

      fetchLeaderboard: async (period?: LeaderboardPeriod, page = 1) => {
        const currentPeriod = period || get().period;
        set({ isLoading: true, error: null });

        try {
          const response = await leaderboardApi.get(currentPeriod, page);
          set({
            entries: page === 1
              ? response.entries
              : [...get().entries, ...response.entries],
            period: response.period,
            periodStart: response.periodStart,
            pagination: response.pagination,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoading: false,
          });
        }
      },

      fetchMyRank: async () => {
        set({ isLoadingMyRank: true });

        try {
          const response = await leaderboardApi.getMyRank();
          set({
            myRanks: response.ranks,
            isLoadingMyRank: false,
          });
        } catch (error) {
          console.error('Failed to fetch my rank:', error);
          set({ isLoadingMyRank: false });
        }
      },

      setPeriod: (period: LeaderboardPeriod) => {
        set({ period, entries: [], pagination: null });
        get().fetchLeaderboard(period);
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    { name: 'leaderboard-store' }
  )
);
