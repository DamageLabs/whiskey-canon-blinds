import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button, Card, CardContent } from '@/components/ui';
import { UserCard } from '@/components/social';
import { useSocialStore } from '@/store/socialStore';
import { useAuthStore } from '@/store/authStore';

export function FollowingPage() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser, isAuthenticated } = useAuthStore();
  const {
    profile,
    following,
    followingPagination,
    isLoadingProfile,
    isLoadingFollowing,
    fetchProfile,
    fetchFollowing,
  } = useSocialStore();

  useEffect(() => {
    if (userId) {
      if (!profile || profile.id !== userId) {
        fetchProfile(userId);
      }
      fetchFollowing(userId, 1);
    }
  }, [userId, profile, fetchProfile, fetchFollowing]);

  const loadMore = () => {
    if (userId && followingPagination && followingPagination.page < followingPagination.totalPages) {
      fetchFollowing(userId, followingPagination.page + 1);
    }
  };

  const isLoading = isLoadingProfile || (isLoadingFollowing && following.length === 0);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            to={`/user/${userId}`}
            className="text-amber-500 hover:text-amber-400 text-sm mb-2 inline-block"
          >
            &larr; Back to profile
          </Link>
          <h1 className="text-2xl font-bold text-zinc-100">
            {profile?.displayName} is Following
          </h1>
          <p className="text-zinc-400">
            {followingPagination?.total || 0} user{(followingPagination?.total || 0) !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Following List */}
        {following.length === 0 ? (
          <Card variant="outlined">
            <CardContent className="text-center py-8">
              <p className="text-zinc-400">Not following anyone yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {following.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                showFollowButton={isAuthenticated}
                isFollowing={false}
                currentUserId={currentUser?.id}
              />
            ))}

            {/* Load More */}
            {followingPagination && followingPagination.page < followingPagination.totalPages && (
              <div className="text-center pt-4">
                <Button
                  variant="secondary"
                  onClick={loadMore}
                  disabled={isLoadingFollowing}
                >
                  {isLoadingFollowing ? 'Loading...' : 'Load More'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
