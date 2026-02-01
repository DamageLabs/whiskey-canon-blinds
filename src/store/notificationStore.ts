import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { notificationsApi } from '@/services/api';
import type { NotificationPreferences } from '@/services/api';

interface NotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | 'unsupported';
  preferences: NotificationPreferences | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  checkSupport: () => void;
  requestPermission: () => Promise<boolean>;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  fetchPreferences: () => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  clearError: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  devtools(
    persist(
      (set, get) => ({
        isSupported: false,
        isSubscribed: false,
        permission: 'unsupported',
        preferences: null,
        isLoading: false,
        error: null,

        checkSupport: () => {
          const isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
          const permission = isSupported ? Notification.permission : 'unsupported';
          set({ isSupported, permission });
        },

        requestPermission: async () => {
          if (!get().isSupported) {
            set({ error: 'Push notifications are not supported' });
            return false;
          }

          try {
            const permission = await Notification.requestPermission();
            set({ permission });
            return permission === 'granted';
          } catch (error) {
            set({ error: (error as Error).message });
            return false;
          }
        },

        subscribe: async () => {
          set({ isLoading: true, error: null });

          try {
            // Get VAPID key
            const { publicKey } = await notificationsApi.getVapidKey();

            // Get service worker registration
            const registration = await navigator.serviceWorker.ready;

            // Subscribe to push
            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as ArrayBuffer,
            });

            const subJson = subscription.toJSON();

            // Send to server
            await notificationsApi.subscribe({
              endpoint: subJson.endpoint!,
              keys: {
                p256dh: subJson.keys!.p256dh,
                auth: subJson.keys!.auth,
              },
            });

            set({ isSubscribed: true, isLoading: false });
            return true;
          } catch (error) {
            set({
              error: (error as Error).message,
              isLoading: false,
            });
            return false;
          }
        },

        unsubscribe: async () => {
          set({ isLoading: true, error: null });

          try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
              await notificationsApi.unsubscribe(subscription.endpoint);
              await subscription.unsubscribe();
            }

            set({ isSubscribed: false, isLoading: false });
            return true;
          } catch (error) {
            set({
              error: (error as Error).message,
              isLoading: false,
            });
            return false;
          }
        },

        fetchPreferences: async () => {
          set({ isLoading: true });

          try {
            const preferences = await notificationsApi.getPreferences();
            set({ preferences, isLoading: false });
          } catch (error) {
            console.error('Failed to fetch preferences:', error);
            set({ isLoading: false });
          }
        },

        updatePreferences: async (prefs: Partial<NotificationPreferences>) => {
          set({ isLoading: true, error: null });

          try {
            const updated = await notificationsApi.updatePreferences(prefs);
            set({ preferences: updated, isLoading: false });
          } catch (error) {
            set({
              error: (error as Error).message,
              isLoading: false,
            });
          }
        },

        clearError: () => {
          set({ error: null });
        },
      }),
      {
        name: 'notification-store',
        partialize: (state) => ({
          isSubscribed: state.isSubscribed,
        }),
      }
    ),
    { name: 'notification-store' }
  )
);

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
