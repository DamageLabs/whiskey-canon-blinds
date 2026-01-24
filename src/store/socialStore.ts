import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { socialApi } from '@/services/api';

// Local type definitions to avoid Vite HMR issues with type exports
interface PublicProfileResponse {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  favoriteCategory?: string | null;
  experienceLevel?: string | null;
  isProfilePublic: boolean;
  isOwner: boolean;
  isFollowing: boolean;
  isPrivate?: boolean;
  stats: {
    followers: number;
    following: number;
    publicNotes: number;
  };
}

interface UserListItemResponse {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  followedAt: string;
}

interface PublicTastingNoteResponse {
  id: string;
  whiskey: {
    id: string;
    name: string;
    distillery: string;
    age?: number;
    proof: number;
  };
  session: {
    id: string;
    name: string;
  };
  scores: {
    nose: number;
    palate: number;
    finish: number;
    overall: number;
    total: number;
  };
  notes: {
    nose?: string;
    palate?: string;
    finish?: string;
    general?: string;
  };
  identityGuess?: string;
  lockedAt: string;
}

interface ShareableScoreResponse {
  id: string;
  whiskey: {
    id: string;
    name: string;
    distillery: string;
    age?: number;
    proof: number;
  };
  session: {
    id: string;
    name: string;
    status: string;
  };
  scores: {
    nose: number;
    palate: number;
    finish: number;
    overall: number;
    total: number;
  };
  notes: {
    nose?: string;
    palate?: string;
    finish?: string;
    general?: string;
  };
  isPublic: boolean;
  lockedAt: string;
}

interface TastingStatsResponse {
  overview: {
    sessionsAttended: number;
    whiskeysRated: number;
    categoriesExplored: string[];
  };
  scoringTendencies: {
    averages: {
      nose: number;
      palate: number;
      finish: number;
      overall: number;
      total: number;
    };
    distribution: Record<number, number>;
    tendency: 'generous' | 'balanced' | 'critical';
  };
  favoriteNotes: Array<{ term: string; count: number }>;
  recentActivity: Array<{
    id: string;
    name: string;
    theme: string;
    completedAt: string;
  }>;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  earned: boolean;
  progress: number;
  target: number;
}

interface AchievementsResponse {
  achievements: Achievement[];
  summary: {
    earned: number;
    total: number;
    percentage: number;
  };
}

interface SocialState {
  // Profile state
  profile: PublicProfileResponse | null;
  isLoadingProfile: boolean;
  profileError: string | null;

  // Followers/Following state
  followers: UserListItemResponse[];
  following: UserListItemResponse[];
  followersPagination: { page: number; totalPages: number; total: number } | null;
  followingPagination: { page: number; totalPages: number; total: number } | null;
  isLoadingFollowers: boolean;
  isLoadingFollowing: boolean;

  // Public notes state
  publicNotes: PublicTastingNoteResponse[];
  notesPagination: { page: number; totalPages: number; total: number } | null;
  isLoadingNotes: boolean;

  // Shareable scores state
  shareableScores: ShareableScoreResponse[];
  isLoadingShareable: boolean;

  // Tasting stats state
  tastingStats: TastingStatsResponse | null;
  isLoadingStats: boolean;

  // Achievements state
  achievements: AchievementsResponse | null;
  isLoadingAchievements: boolean;

  // Follow action state
  isFollowLoading: boolean;

  // Actions
  fetchProfile: (userId: string) => Promise<void>;
  fetchFollowers: (userId: string, page?: number) => Promise<void>;
  fetchFollowing: (userId: string, page?: number) => Promise<void>;
  fetchPublicNotes: (userId: string, page?: number) => Promise<void>;
  fetchShareableScores: () => Promise<void>;
  fetchTastingStats: (userId: string) => Promise<void>;
  fetchAchievements: (userId: string) => Promise<void>;
  followUser: (userId: string) => Promise<void>;
  unfollowUser: (userId: string) => Promise<void>;
  togglePrivacy: (isPublic: boolean) => Promise<void>;
  toggleScoreVisibility: (scoreId: string, isPublic: boolean) => Promise<void>;
  clearProfile: () => void;
  clearError: () => void;
}

export const useSocialStore = create<SocialState>()(
  devtools(
    (set, get) => ({
      // Initial state
      profile: null,
      isLoadingProfile: false,
      profileError: null,

      followers: [],
      following: [],
      followersPagination: null,
      followingPagination: null,
      isLoadingFollowers: false,
      isLoadingFollowing: false,

      publicNotes: [],
      notesPagination: null,
      isLoadingNotes: false,

      shareableScores: [],
      isLoadingShareable: false,

      tastingStats: null,
      isLoadingStats: false,

      achievements: null,
      isLoadingAchievements: false,

      isFollowLoading: false,

      // Actions
      fetchProfile: async (userId: string) => {
        set({ isLoadingProfile: true, profileError: null });
        try {
          const profile = await socialApi.getProfile(userId);
          set({ profile, isLoadingProfile: false });
        } catch (error) {
          set({
            profileError: (error as Error).message,
            isLoadingProfile: false,
          });
        }
      },

      fetchFollowers: async (userId: string, page = 1) => {
        set({ isLoadingFollowers: true });
        try {
          const response = await socialApi.getFollowers(userId, page);
          set({
            followers: page === 1
              ? response.followers
              : [...get().followers, ...response.followers],
            followersPagination: {
              page: response.pagination.page,
              totalPages: response.pagination.totalPages,
              total: response.pagination.total,
            },
            isLoadingFollowers: false,
          });
        } catch (error) {
          console.error('Failed to fetch followers:', error);
          set({ isLoadingFollowers: false });
        }
      },

      fetchFollowing: async (userId: string, page = 1) => {
        set({ isLoadingFollowing: true });
        try {
          const response = await socialApi.getFollowing(userId, page);
          set({
            following: page === 1
              ? response.following
              : [...get().following, ...response.following],
            followingPagination: {
              page: response.pagination.page,
              totalPages: response.pagination.totalPages,
              total: response.pagination.total,
            },
            isLoadingFollowing: false,
          });
        } catch (error) {
          console.error('Failed to fetch following:', error);
          set({ isLoadingFollowing: false });
        }
      },

      fetchPublicNotes: async (userId: string, page = 1) => {
        set({ isLoadingNotes: true });
        try {
          const response = await socialApi.getPublicNotes(userId, page);
          set({
            publicNotes: page === 1
              ? response.notes
              : [...get().publicNotes, ...response.notes],
            notesPagination: {
              page: response.pagination.page,
              totalPages: response.pagination.totalPages,
              total: response.pagination.total,
            },
            isLoadingNotes: false,
          });
        } catch (error) {
          console.error('Failed to fetch public notes:', error);
          set({ isLoadingNotes: false });
        }
      },

      fetchShareableScores: async () => {
        set({ isLoadingShareable: true });
        try {
          const scores = await socialApi.getShareableScores();
          set({ shareableScores: scores, isLoadingShareable: false });
        } catch (error) {
          console.error('Failed to fetch shareable scores:', error);
          set({ isLoadingShareable: false });
        }
      },

      fetchTastingStats: async (userId: string) => {
        set({ isLoadingStats: true });
        try {
          const stats = await socialApi.getTastingStats(userId);
          set({ tastingStats: stats, isLoadingStats: false });
        } catch (error) {
          console.error('Failed to fetch tasting stats:', error);
          set({ isLoadingStats: false });
        }
      },

      fetchAchievements: async (userId: string) => {
        set({ isLoadingAchievements: true });
        try {
          const achievements = await socialApi.getAchievements(userId);
          set({ achievements, isLoadingAchievements: false });
        } catch (error) {
          console.error('Failed to fetch achievements:', error);
          set({ isLoadingAchievements: false });
        }
      },

      followUser: async (userId: string) => {
        set({ isFollowLoading: true });
        try {
          await socialApi.follow(userId);
          // Update profile if loaded
          const profile = get().profile;
          if (profile && profile.id === userId) {
            set({
              profile: {
                ...profile,
                isFollowing: true,
                stats: {
                  ...profile.stats,
                  followers: profile.stats.followers + 1,
                },
              },
            });
          }
          set({ isFollowLoading: false });
        } catch (error) {
          console.error('Failed to follow user:', error);
          set({ isFollowLoading: false });
          throw error;
        }
      },

      unfollowUser: async (userId: string) => {
        set({ isFollowLoading: true });
        try {
          await socialApi.unfollow(userId);
          // Update profile if loaded
          const profile = get().profile;
          if (profile && profile.id === userId) {
            set({
              profile: {
                ...profile,
                isFollowing: false,
                stats: {
                  ...profile.stats,
                  followers: Math.max(0, profile.stats.followers - 1),
                },
              },
            });
          }
          set({ isFollowLoading: false });
        } catch (error) {
          console.error('Failed to unfollow user:', error);
          set({ isFollowLoading: false });
          throw error;
        }
      },

      togglePrivacy: async (isPublic: boolean) => {
        try {
          await socialApi.togglePrivacy(isPublic);
          // Update profile if loaded and is owner
          const profile = get().profile;
          if (profile && profile.isOwner) {
            set({
              profile: {
                ...profile,
                isProfilePublic: isPublic,
              },
            });
          }
        } catch (error) {
          console.error('Failed to toggle privacy:', error);
          throw error;
        }
      },

      toggleScoreVisibility: async (scoreId: string, isPublic: boolean) => {
        try {
          await socialApi.toggleScoreVisibility(scoreId, isPublic);
          // Update shareable scores list
          const scores = get().shareableScores;
          set({
            shareableScores: scores.map((s) =>
              s.id === scoreId ? { ...s, isPublic } : s
            ),
          });
          // Update public notes count in profile if loaded
          const profile = get().profile;
          if (profile && profile.isOwner) {
            set({
              profile: {
                ...profile,
                stats: {
                  ...profile.stats,
                  publicNotes: isPublic
                    ? profile.stats.publicNotes + 1
                    : Math.max(0, profile.stats.publicNotes - 1),
                },
              },
            });
          }
        } catch (error) {
          console.error('Failed to toggle score visibility:', error);
          throw error;
        }
      },

      clearProfile: () => {
        set({
          profile: null,
          followers: [],
          following: [],
          publicNotes: [],
          followersPagination: null,
          followingPagination: null,
          notesPagination: null,
          tastingStats: null,
          achievements: null,
        });
      },

      clearError: () => {
        set({ profileError: null });
      },
    }),
    { name: 'social-store' }
  )
);
