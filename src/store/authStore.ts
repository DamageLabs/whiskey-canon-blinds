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
  isProfilePublic?: boolean;
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

        // Note: register no longer authenticates - it returns verification info
        // The actual authentication happens after email verification
        register: async (_email, _password, _displayName) => {
          // This method is deprecated - use authApi.register directly
          // and navigate to /verify-email with the response
          throw new Error('Use authApi.register directly and navigate to /verify-email');
        },

        login: async (email, password) => {
          set({ isLoading: true, error: null });
          try {
            const response = await authApi.login({ email, password });
            // Tokens are stored in httpOnly cookies by the backend
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
            // Cookies are cleared by the backend
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
                isProfilePublic: user.isProfilePublic ?? true,
                role,
              },
              isAuthenticated: true,
              isAdmin: role === 'admin',
              isLoading: false,
            });
          } catch {
            // Try to refresh token (uses httpOnly cookie)
            try {
              await authApi.refresh();
              // Token refreshed via cookie, try /me again
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
                  isProfilePublic: user.isProfilePublic ?? true,
                  role,
                },
                isAuthenticated: true,
                isAdmin: role === 'admin',
                isLoading: false,
              });
            } catch {
              // Not authenticated
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

        setUser: (user) => set({
          user,
          isAuthenticated: true,
          isAdmin: user.role === 'admin',
        }),

        clearError: () => set({ error: null }),
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated, isAdmin: state.isAdmin }),
        // Note: Authentication is now handled via httpOnly cookies
        // The checkAuth() method should be called on app init to verify session validity
      }
    ),
    { name: 'auth-store' }
  )
);
