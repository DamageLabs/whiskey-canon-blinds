import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, Button } from '@/components/ui';
import { FollowButton, ProfileStats, TastingNoteCard } from '@/components/social';
import { useSocialStore } from '@/store/socialStore';
import { useAuthStore } from '@/store/authStore';

const SERVER_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

export function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser, isAuthenticated } = useAuthStore();
  const {
    profile,
    publicNotes,
    notesPagination,
    isLoadingProfile,
    isLoadingNotes,
    profileError,
    fetchProfile,
    fetchPublicNotes,
    clearProfile,
  } = useSocialStore();

  useEffect(() => {
    if (userId) {
      clearProfile();
      fetchProfile(userId);
      fetchPublicNotes(userId);
    }
  }, [userId, fetchProfile, fetchPublicNotes, clearProfile]);

  const loadMoreNotes = () => {
    if (userId && notesPagination && notesPagination.page < notesPagination.totalPages) {
      fetchPublicNotes(userId, notesPagination.page + 1);
    }
  };

  if (isLoadingProfile && !profile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-zinc-400">Loading profile...</div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-100 mb-2">Profile Not Found</h1>
          <p className="text-zinc-400">{profileError}</p>
          <Link to="/">
            <Button variant="secondary" className="mt-4">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const isOwnProfile = currentUser?.id === profile.id;

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Profile Header */}
        <Card variant="elevated" className="mb-6">
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {profile.avatarUrl ? (
                  <img
                    src={`${SERVER_URL}${profile.avatarUrl}`}
                    alt={profile.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl text-zinc-500">
                    {profile.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                  <h1 className="text-2xl font-bold text-zinc-100">{profile.displayName}</h1>
                  {!isOwnProfile && isAuthenticated && (
                    <FollowButton userId={profile.id} isFollowing={profile.isFollowing} />
                  )}
                  {isOwnProfile && (
                    <Link to="/profile">
                      <Button variant="secondary" size="sm">
                        Edit Profile
                      </Button>
                    </Link>
                  )}
                </div>

                {/* Stats */}
                <div className="mb-4">
                  <ProfileStats
                    userId={profile.id}
                    followers={profile.stats.followers}
                    following={profile.stats.following}
                    publicNotes={profile.stats.publicNotes}
                  />
                </div>

                {/* Bio and Details */}
                {!profile.isPrivate && (
                  <>
                    {profile.bio && (
                      <p className="text-zinc-300 mb-3">{profile.bio}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-sm">
                      {profile.favoriteCategory && (
                        <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full capitalize">
                          {profile.favoriteCategory}
                        </span>
                      )}
                      {profile.experienceLevel && (
                        <span className="px-3 py-1 bg-zinc-700 text-zinc-300 rounded-full capitalize">
                          {profile.experienceLevel}
                        </span>
                      )}
                    </div>
                  </>
                )}

                {profile.isPrivate && !isOwnProfile && (
                  <div className="mt-4 p-4 bg-zinc-800/50 rounded-lg">
                    <p className="text-zinc-400 text-sm">
                      This profile is private. Follow to see more.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Public Tasting Notes */}
        {(!profile.isPrivate || isOwnProfile) && (
          <div>
            <h2 className="text-xl font-bold text-zinc-100 mb-4">Public Tasting Notes</h2>

            {publicNotes.length === 0 && !isLoadingNotes ? (
              <Card variant="outlined">
                <CardContent className="text-center py-8">
                  <p className="text-zinc-400">No public tasting notes yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {publicNotes.map((note) => (
                  <TastingNoteCard key={note.id} note={note} />
                ))}

                {/* Load More */}
                {notesPagination && notesPagination.page < notesPagination.totalPages && (
                  <div className="text-center pt-4">
                    <Button
                      variant="secondary"
                      onClick={loadMoreNotes}
                      disabled={isLoadingNotes}
                    >
                      {isLoadingNotes ? 'Loading...' : 'Load More'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
