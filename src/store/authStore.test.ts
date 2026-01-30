import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuthStore } from './authStore';

// Mock the authApi module
vi.mock('@/services', () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    refresh: vi.fn(),
  },
}));

// Import mocked module
import { authApi } from '@/services';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState();

      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isAdmin).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('login', () => {
    it('should set loading state while logging in', async () => {
      const mockUser = { id: '1', email: 'test@example.com', displayName: 'Test User', role: 'user' };
      vi.mocked(authApi.login).mockImplementation(async () => {
        expect(useAuthStore.getState().isLoading).toBe(true);
        return { user: mockUser };
      });

      await useAuthStore.getState().login('test@example.com', 'password123');
    });

    it('should set user and authentication state on successful login', async () => {
      const mockUser = { id: '1', email: 'test@example.com', displayName: 'Test User', role: 'user' };
      vi.mocked(authApi.login).mockResolvedValue({ user: mockUser });

      await useAuthStore.getState().login('test@example.com', 'password123');

      const state = useAuthStore.getState();
      expect(state.user).toMatchObject(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isAdmin).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should set isAdmin for admin users', async () => {
      const mockUser = { id: '1', email: 'admin@example.com', displayName: 'Admin', role: 'admin' };
      vi.mocked(authApi.login).mockResolvedValue({ user: mockUser });

      await useAuthStore.getState().login('admin@example.com', 'password123');

      const state = useAuthStore.getState();
      expect(state.isAdmin).toBe(true);
    });

    it('should set error state on login failure', async () => {
      const errorMessage = 'Invalid credentials';
      vi.mocked(authApi.login).mockRejectedValue(new Error(errorMessage));

      await expect(useAuthStore.getState().login('test@example.com', 'wrong')).rejects.toThrow(errorMessage);

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(errorMessage);
    });

    it('should call authApi.login with correct credentials', async () => {
      const mockUser = { id: '1', email: 'test@example.com', displayName: 'Test', role: 'user' };
      vi.mocked(authApi.login).mockResolvedValue({ user: mockUser });

      await useAuthStore.getState().login('test@example.com', 'password123');

      expect(authApi.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  describe('logout', () => {
    it('should clear user state on logout', async () => {
      // Set up authenticated state
      useAuthStore.setState({
        user: { id: '1', email: 'test@example.com', displayName: 'Test', role: 'user' },
        isAuthenticated: true,
        isAdmin: false,
      });

      vi.mocked(authApi.logout).mockResolvedValue(undefined);

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isAdmin).toBe(false);
    });

    it('should clear state even if logout API fails', async () => {
      useAuthStore.setState({
        user: { id: '1', email: 'test@example.com', displayName: 'Test', role: 'user' },
        isAuthenticated: true,
      });

      vi.mocked(authApi.logout).mockRejectedValue(new Error('Network error'));

      // The error propagates but the finally block still clears state
      try {
        await useAuthStore.getState().logout();
      } catch {
        // Expected to throw
      }

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('checkAuth', () => {
    it('should set loading state while checking auth', async () => {
      const mockUser = { id: '1', email: 'test@example.com', displayName: 'Test', role: 'user' };
      vi.mocked(authApi.me).mockImplementation(async () => {
        expect(useAuthStore.getState().isLoading).toBe(true);
        return mockUser;
      });

      await useAuthStore.getState().checkAuth();
    });

    it('should set authenticated state on successful check', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        displayName: 'Test User',
        role: 'user',
        avatarUrl: null,
        bio: null,
        favoriteCategory: null,
        experienceLevel: null,
        isProfilePublic: true,
      };
      vi.mocked(authApi.me).mockResolvedValue(mockUser);

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.email).toBe('test@example.com');
      expect(state.isLoading).toBe(false);
    });

    it('should try refresh when initial auth check fails', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        displayName: 'Test',
        role: 'user',
      };

      vi.mocked(authApi.me)
        .mockRejectedValueOnce(new Error('Unauthorized'))
        .mockResolvedValueOnce(mockUser);
      vi.mocked(authApi.refresh).mockResolvedValue(undefined);

      await useAuthStore.getState().checkAuth();

      expect(authApi.refresh).toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('should clear state if refresh also fails', async () => {
      vi.mocked(authApi.me).mockRejectedValue(new Error('Unauthorized'));
      vi.mocked(authApi.refresh).mockRejectedValue(new Error('Invalid refresh token'));

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('setLoading', () => {
    it('should set loading state', () => {
      useAuthStore.getState().setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);

      useAuthStore.getState().setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('setUser', () => {
    it('should set user and mark as authenticated', () => {
      const user = { id: '1', email: 'test@example.com', displayName: 'Test', role: 'user' as const };

      useAuthStore.getState().setUser(user);

      const state = useAuthStore.getState();
      expect(state.user).toMatchObject(user);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isAdmin).toBe(false);
    });

    it('should set isAdmin for admin user', () => {
      const user = { id: '1', email: 'admin@example.com', displayName: 'Admin', role: 'admin' as const };

      useAuthStore.getState().setUser(user);

      expect(useAuthStore.getState().isAdmin).toBe(true);
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      useAuthStore.setState({ error: 'Some error' });

      useAuthStore.getState().clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('register', () => {
    it('should throw with guidance to use authApi directly', async () => {
      await expect(
        useAuthStore.getState().register('test@example.com', 'password', 'Test')
      ).rejects.toThrow('Use authApi.register directly');
    });
  });
});
