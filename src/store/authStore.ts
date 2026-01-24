import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { authApi } from '@/services';

export type UserRole = 'user' | 'admin';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type WhiskeyCategory = 'bourbon' | 'rye' | 'scotch' | 'irish' | 'japanese' | 'canadian' | 'other';

interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  favoriteCategory?: WhiskeyCategory | null;
  experienceLevel?: ExperienceLevel | null;
  role: UserRole;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  register: (email: string, password: string, displayName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setUser: (user: User) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        isAuthenticated: false,
        isAdmin: false,
        isLoading: false,
        error: null,

        register: async (email, password, displayName) => {
          set({ isLoading: true, error: null });
          try {
            const response = await authApi.register({ email, password, displayName });
            // Store access token for API requests
            localStorage.setItem('accessToken', response.accessToken);
            const user = { ...response.user, role: response.user.role || 'user' } as User;
            set({
              user,
              isAuthenticated: true,
              isAdmin: user.role === 'admin',
              isLoading: false,
            });
          } catch (error) {
            set({
              error: (error as Error).message,
              isLoading: false,
            });
            throw error;
          }
        },

        login: async (email, password) => {
          set({ isLoading: true, error: null });
          try {
            const response = await authApi.login({ email, password });
            // Store access token for API requests
            localStorage.setItem('accessToken', response.accessToken);
            const user = { ...response.user, role: response.user.role || 'user' } as User;
            set({
              user,
              isAuthenticated: true,
              isAdmin: user.role === 'admin',
              isLoading: false,
            });
          } catch (error) {
            set({
              error: (error as Error).message,
              isLoading: false,
            });
            throw error;
          }
        },

        logout: async () => {
          try {
            await authApi.logout();
          } finally {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('participantToken');
            set({
              user: null,
              isAuthenticated: false,
              isAdmin: false,
            });
          }
        },

        checkAuth: async () => {
          set({ isLoading: true });
          try {
            const user = await authApi.me();
            const role = (user.role as UserRole) || 'user';
            set({
              user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                bio: user.bio,
                favoriteCategory: user.favoriteCategory as WhiskeyCategory | null | undefined,
                experienceLevel: user.experienceLevel as ExperienceLevel | null | undefined,
                role,
              },
              isAuthenticated: true,
              isAdmin: role === 'admin',
              isLoading: false,
            });
          } catch {
            // Try to refresh token
            try {
              const refreshResponse = await authApi.refresh();
              localStorage.setItem('accessToken', refreshResponse.accessToken);
              const user = await authApi.me();
              const role = (user.role as UserRole) || 'user';
              set({
                user: {
                  id: user.id,
                  email: user.email,
                  displayName: user.displayName,
                  avatarUrl: user.avatarUrl,
                  bio: user.bio,
                  favoriteCategory: user.favoriteCategory as WhiskeyCategory | null | undefined,
                  experienceLevel: user.experienceLevel as ExperienceLevel | null | undefined,
                  role,
                },
                isAuthenticated: true,
                isAdmin: role === 'admin',
                isLoading: false,
              });
            } catch {
              localStorage.removeItem('accessToken');
              set({
                user: null,
                isAuthenticated: false,
                isAdmin: false,
                isLoading: false,
              });
            }
          }
        },

        setLoading: (loading) => set({ isLoading: loading }),

        setUser: (user) => set({ user }),

        clearError: () => set({ error: null }),
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated, isAdmin: state.isAdmin }),
        onRehydrateStorage: () => (state) => {
          // If persisted state says authenticated but no token exists, reset auth
          if (state?.isAuthenticated && !localStorage.getItem('accessToken')) {
            state.user = null;
            state.isAuthenticated = false;
            state.isAdmin = false;
          }
        },
      }
    ),
    { name: 'auth-store' }
  )
);
