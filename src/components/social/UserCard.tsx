import { Link } from 'react-router-dom';
import { FollowButton } from './FollowButton';

const SERVER_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

interface UserCardProps {
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    bio?: string | null;
  };
  showFollowButton?: boolean;
  isFollowing?: boolean;
  currentUserId?: string | null;
}

export function UserCard({ user, showFollowButton = false, isFollowing = false, currentUserId }: UserCardProps) {
  const isOwnProfile = currentUserId === user.id;

  return (
    <div className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors">
      {/* Avatar */}
      <Link to={`/user/${user.id}`} className="flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-zinc-700 overflow-hidden flex items-center justify-center">
          {user.avatarUrl ? (
            <img
              src={`${SERVER_URL}${user.avatarUrl}`}
              alt={user.displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xl text-zinc-500">
              {user.displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </Link>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <Link
          to={`/user/${user.id}`}
          className="text-zinc-100 font-medium hover:text-amber-500 transition-colors block truncate"
        >
          {user.displayName}
        </Link>
        {user.bio && (
          <p className="text-sm text-zinc-400 truncate">{user.bio}</p>
        )}
      </div>

      {/* Follow Button */}
      {showFollowButton && !isOwnProfile && (
        <FollowButton userId={user.id} isFollowing={isFollowing} />
      )}
    </div>
  );
}
