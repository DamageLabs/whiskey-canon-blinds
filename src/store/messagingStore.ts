import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { messagingApi } from '@/services/api';
import type { ConversationPreview, Message } from '@/services/api';

interface MessagingState {
  conversations: ConversationPreview[];
  currentConversation: {
    id: string;
    otherUser: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
    };
  } | null;
  messages: Message[];
  messagesPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  unreadCount: number;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  error: string | null;

  // Actions
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string, page?: number) => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<Message | null>;
  markAsRead: (conversationId: string) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  getOrCreateConversation: (userId: string) => Promise<string | null>;
  canMessage: (userId: string) => Promise<{ canMessage: boolean; reason: string | null }>;
  addMessage: (message: Message) => void;
  setCurrentConversation: (conversation: MessagingState['currentConversation']) => void;
  clearMessages: () => void;
  clearError: () => void;
}

export const useMessagingStore = create<MessagingState>()(
  devtools(
    (set, get) => ({
      conversations: [],
      currentConversation: null,
      messages: [],
      messagesPagination: null,
      unreadCount: 0,
      isLoadingConversations: false,
      isLoadingMessages: false,
      isSending: false,
      error: null,

      fetchConversations: async () => {
        set({ isLoadingConversations: true, error: null });

        try {
          const response = await messagingApi.getConversations();
          set({
            conversations: response.conversations,
            isLoadingConversations: false,
          });
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoadingConversations: false,
          });
        }
      },

      fetchMessages: async (conversationId: string, page = 1) => {
        set({ isLoadingMessages: true, error: null });

        try {
          const response = await messagingApi.getMessages(conversationId, page);
          set({
            messages: page === 1
              ? response.messages
              : [...response.messages, ...get().messages],
            messagesPagination: response.pagination,
            isLoadingMessages: false,
          });
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoadingMessages: false,
          });
        }
      },

      sendMessage: async (conversationId: string, content: string) => {
        set({ isSending: true, error: null });

        try {
          const message = await messagingApi.sendMessage(conversationId, content);
          set({
            messages: [...get().messages, message],
            conversations: get().conversations.map(c =>
              c.id === conversationId
                ? {
                    ...c,
                    lastMessage: {
                      content: message.content,
                      createdAt: message.createdAt,
                      isOwn: true,
                    },
                    lastMessageAt: message.createdAt,
                  }
                : c
            ),
            isSending: false,
          });
          return message;
        } catch (error) {
          set({
            error: (error as Error).message,
            isSending: false,
          });
          return null;
        }
      },

      markAsRead: async (conversationId: string) => {
        try {
          await messagingApi.markAsRead(conversationId);
          set({
            conversations: get().conversations.map(c =>
              c.id === conversationId
                ? { ...c, unreadCount: 0 }
                : c
            ),
          });
          get().fetchUnreadCount();
        } catch (error) {
          console.error('Failed to mark as read:', error);
        }
      },

      fetchUnreadCount: async () => {
        try {
          const response = await messagingApi.getUnreadCount();
          set({ unreadCount: response.unreadCount });
        } catch (error) {
          console.error('Failed to fetch unread count:', error);
        }
      },

      getOrCreateConversation: async (userId: string) => {
        set({ isLoadingMessages: true, error: null });

        try {
          const response = await messagingApi.getOrCreateConversation(userId);
          set({
            currentConversation: response,
            isLoadingMessages: false,
          });
          return response.id;
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoadingMessages: false,
          });
          return null;
        }
      },

      canMessage: async (userId: string) => {
        try {
          return await messagingApi.canMessage(userId);
        } catch (error) {
          return { canMessage: false, reason: (error as Error).message };
        }
      },

      addMessage: (message: Message) => {
        const currentMessages = get().messages;
        // Avoid duplicates
        if (!currentMessages.find(m => m.id === message.id)) {
          set({ messages: [...currentMessages, message] });
        }
      },

      setCurrentConversation: (conversation) => {
        set({ currentConversation: conversation });
      },

      clearMessages: () => {
        set({ messages: [], messagesPagination: null, currentConversation: null });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    { name: 'messaging-store' }
  )
);
