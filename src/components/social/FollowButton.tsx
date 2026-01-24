import { useState } from 'react';
import { Button } from '@/components/ui';
import { useSocialStore } from '@/store/socialStore';

interface FollowButtonProps {
  userId: string;
  isFollowing: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
}

export function FollowButton({ userId, isFollowing: initialIsFollowing, onFollowChange }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isHovering, setIsHovering] = useState(false);
  const { followUser, unfollowUser, isFollowLoading } = useSocialStore();

  const handleClick = async () => {
    try {
      if (isFollowing) {
        await unfollowUser(userId);
        setIsFollowing(false);
        onFollowChange?.(false);
      } else {
        await followUser(userId);
        setIsFollowing(true);
        onFollowChange?.(true);
      }
    } catch {
      // Error handled in store
    }
  };

  if (isFollowing) {
    return (
      <Button
        variant={isHovering ? 'danger' : 'secondary'}
        size="sm"
        onClick={handleClick}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        disabled={isFollowLoading}
        className="min-w-[100px]"
      >
        {isFollowLoading ? 'Loading...' : isHovering ? 'Unfollow' : 'Following'}
      </Button>
    );
  }

  return (
    <Button
      variant="primary"
      size="sm"
      onClick={handleClick}
      disabled={isFollowLoading}
      className="min-w-[100px]"
    >
      {isFollowLoading ? 'Loading...' : 'Follow'}
    </Button>
  );
}
