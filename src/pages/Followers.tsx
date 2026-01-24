import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button, Card, CardContent } from '@/components/ui';
import { UserCard } from '@/components/social';
import { useSocialStore } from '@/store/socialStore';
import { useAuthStore } from '@/store/authStore';

export function FollowersPage() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser, isAuthenticated } = useAuthStore();
  const {
    profile,
    followers,
    followersPagination,
    isLoadingProfile,
    isLoadingFollowers,
    fetchProfile,
    fetchFollowers,
  } = useSocialStore();

  useEffect(() => {
    if (userId) {
      if (!profile || profile.id !== userId) {
        fetchProfile(userId);
      }
      fetchFollowers(userId, 1);
    }
  }, [userId, profile, fetchProfile, fetchFollowers]);

  const loadMore = () => {
    if (userId && followersPagination && followersPagination.page < followersPagination.totalPages) {
      fetchFollowers(userId, followersPagination.page + 1);
    }
  };

  const isLoading = isLoadingProfile || (isLoadingFollowers && followers.length === 0);

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
            {profile?.displayName}'s Followers
          </h1>
          <p className="text-zinc-400">
            {followersPagination?.total || 0} follower{(followersPagination?.total || 0) !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Followers List */}
        {followers.length === 0 ? (
          <Card variant="outlined">
            <CardContent className="text-center py-8">
              <p className="text-zinc-400">No followers yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {followers.map((follower) => (
              <UserCard
                key={follower.id}
                user={follower}
                showFollowButton={isAuthenticated}
                isFollowing={false}
                currentUserId={currentUser?.id}
              />
            ))}

            {/* Load More */}
            {followersPagination && followersPagination.page < followersPagination.totalPages && (
              <div className="text-center pt-4">
                <Button
                  variant="secondary"
                  onClick={loadMore}
                  disabled={isLoadingFollowers}
                >
                  {isLoadingFollowers ? 'Loading...' : 'Load More'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
