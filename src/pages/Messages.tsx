import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui';
import { useMessagingStore } from '@/store/messagingStore';
import { useAuthStore } from '@/store/authStore';
import { Navigate } from 'react-router-dom';

const SERVER_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

export function MessagesPage() {
  const { isAuthenticated } = useAuthStore();
  const {
    conversations,
    isLoadingConversations,
    fetchConversations,
    fetchUnreadCount,
  } = useMessagingStore();

  useEffect(() => {
    fetchConversations();
    fetchUnreadCount();
  }, [fetchConversations, fetchUnreadCount]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-100 mb-6">Messages</h1>

        {isLoadingConversations ? (
          <div className="text-center py-8 text-zinc-400">Loading conversations...</div>
        ) : conversations.length === 0 ? (
          <Card variant="outlined">
            <CardContent className="text-center py-12">
              <p className="text-zinc-400 mb-2">No conversations yet.</p>
              <p className="text-sm text-zinc-500">
                Start a conversation with someone you follow (and who follows you back).
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => (
              <Link
                key={conv.id}
                to={`/messages/${conv.id}`}
                className="block"
              >
                <Card
                  variant="elevated"
                  className={`hover:border-zinc-600 transition-colors ${
                    conv.unreadCount > 0 ? 'border-amber-500/50' : ''
                  }`}
                >
                  <CardContent className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {conv.otherUser.avatarUrl ? (
                        <img
                          src={`${SERVER_URL}${conv.otherUser.avatarUrl}`}
                          alt={conv.otherUser.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg text-zinc-400">
                          {conv.otherUser.displayName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-zinc-100">
                          {conv.otherUser.displayName}
                        </span>
                        {conv.lastMessage && (
                          <span className="text-xs text-zinc-500">
                            {formatTime(conv.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      {conv.lastMessage && (
                        <p className={`text-sm truncate ${
                          conv.unreadCount > 0 ? 'text-zinc-200 font-medium' : 'text-zinc-400'
                        }`}>
                          {conv.lastMessage.isOwn && <span className="text-zinc-500">You: </span>}
                          {conv.lastMessage.content}
                        </p>
                      )}
                    </div>

                    {/* Unread Badge */}
                    {conv.unreadCount > 0 && (
                      <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                        <span className="text-xs font-bold text-zinc-900">
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // Less than 24 hours
  if (diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Less than 7 days
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
