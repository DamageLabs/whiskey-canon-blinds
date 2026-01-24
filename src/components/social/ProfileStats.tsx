import { Link } from 'react-router-dom';

interface ProfileStatsProps {
  userId: string;
  followers: number;
  following: number;
  publicNotes: number;
}

export function ProfileStats({ userId, followers, following, publicNotes }: ProfileStatsProps) {
  return (
    <div className="flex gap-6">
      <Link
        to={`/user/${userId}/followers`}
        className="text-center hover:text-amber-500 transition-colors"
      >
        <div className="text-2xl font-bold text-zinc-100">{followers}</div>
        <div className="text-sm text-zinc-400">Followers</div>
      </Link>
      <Link
        to={`/user/${userId}/following`}
        className="text-center hover:text-amber-500 transition-colors"
      >
        <div className="text-2xl font-bold text-zinc-100">{following}</div>
        <div className="text-sm text-zinc-400">Following</div>
      </Link>
      <div className="text-center">
        <div className="text-2xl font-bold text-zinc-100">{publicNotes}</div>
        <div className="text-sm text-zinc-400">Tasting Notes</div>
      </div>
    </div>
  );
}
