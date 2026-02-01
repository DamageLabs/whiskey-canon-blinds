import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button, Input } from '@/components/ui';
import { useMessagingStore } from '@/store/messagingStore';
import { useAuthStore } from '@/store/authStore';
import { Navigate } from 'react-router-dom';

const SERVER_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

export function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { isAuthenticated, user } = useAuthStore();
  const {
    currentConversation,
    messages,
    messagesPagination,
    isLoadingMessages,
    isSending,
    fetchMessages,
    sendMessage,
    markAsRead,
    clearMessages,
  } = useMessagingStore();

  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId) {
      clearMessages();
      fetchMessages(conversationId);
      markAsRead(conversationId);
    }

    return () => {
      clearMessages();
    };
  }, [conversationId, fetchMessages, markAsRead, clearMessages]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!conversationId) {
    return <Navigate to="/messages" replace />;
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    const message = newMessage.trim();
    setNewMessage('');
    await sendMessage(conversationId, message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const loadMore = () => {
    if (messagesPagination && messagesPagination.page < messagesPagination.totalPages) {
      fetchMessages(conversationId, messagesPagination.page + 1);
    }
  };

  // Get the other user from the first message or conversation
  const otherUser = currentConversation?.otherUser ||
    messages.find(m => m.senderId !== user?.id)?.sender;

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link
            to="/messages"
            className="text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          {otherUser && (
            <Link to={`/user/${otherUser.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-full bg-zinc-700 overflow-hidden flex items-center justify-center">
                {otherUser.avatarUrl ? (
                  <img
                    src={`${SERVER_URL}${otherUser.avatarUrl}`}
                    alt={otherUser.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-lg text-zinc-400">
                    {otherUser.displayName?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="font-medium text-zinc-100">{otherUser.displayName}</span>
            </Link>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4"
      >
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Load More */}
          {messagesPagination && messagesPagination.page < messagesPagination.totalPages && (
            <div className="text-center">
              <Button variant="ghost" size="sm" onClick={loadMore} disabled={isLoadingMessages}>
                Load older messages
              </Button>
            </div>
          )}

          {isLoadingMessages && messages.length === 0 && (
            <div className="text-center py-8 text-zinc-400">Loading messages...</div>
          )}

          {messages.length === 0 && !isLoadingMessages && (
            <div className="text-center py-8 text-zinc-400">
              No messages yet. Start the conversation!
            </div>
          )}

          {messages.map((message, index) => {
            const showAvatar = !message.isOwn && (
              index === 0 ||
              messages[index - 1].isOwn ||
              messages[index - 1].senderId !== message.senderId
            );

            return (
              <div
                key={message.id}
                className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
              >
                {!message.isOwn && (
                  <div className="w-8 flex-shrink-0">
                    {showAvatar && (
                      <div className="w-8 h-8 rounded-full bg-zinc-700 overflow-hidden flex items-center justify-center">
                        {message.sender.avatarUrl ? (
                          <img
                            src={`${SERVER_URL}${message.sender.avatarUrl}`}
                            alt={message.sender.displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-sm text-zinc-400">
                            {message.sender.displayName?.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div
                  className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                    message.isOwn
                      ? 'bg-amber-500 text-zinc-900 ml-auto'
                      : 'bg-zinc-800 text-zinc-100 ml-2'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.isOwn ? 'text-amber-900/60' : 'text-zinc-500'
                    }`}
                  >
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-zinc-900 border-t border-zinc-800 p-4">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1"
            disabled={isSending}
          />
          <Button type="submit" disabled={!newMessage.trim() || isSending}>
            {isSending ? '...' : 'Send'}
          </Button>
        </form>
      </div>
    </div>
  );
}
