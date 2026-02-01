import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { useMessagingStore } from '@/store/messagingStore';
import { useAuthStore } from '@/store/authStore';

interface StartConversationButtonProps {
  userId: string;
}

export function StartConversationButton({ userId }: StartConversationButtonProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { getOrCreateConversation, canMessage } = useMessagingStore();
  const [isLoading, setIsLoading] = useState(false);
  const [canMessageUser, setCanMessageUser] = useState<{ canMessage: boolean; reason: string | null } | null>(null);

  useEffect(() => {
    if (isAuthenticated && userId !== user?.id) {
      canMessage(userId).then(setCanMessageUser);
    }
  }, [isAuthenticated, userId, user?.id, canMessage]);

  if (!isAuthenticated || userId === user?.id) {
    return null;
  }

  const handleClick = async () => {
    setIsLoading(true);
    const conversationId = await getOrCreateConversation(userId);
    setIsLoading(false);

    if (conversationId) {
      navigate(`/messages/${conversationId}`);
    }
  };

  if (canMessageUser && !canMessageUser.canMessage) {
    return (
      <Button variant="secondary" size="sm" disabled title={canMessageUser.reason || undefined}>
        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        Message
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleClick}
      disabled={isLoading}
    >
      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
      {isLoading ? 'Loading...' : 'Message'}
    </Button>
  );
}
