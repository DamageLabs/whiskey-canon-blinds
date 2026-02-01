import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, Button } from '@/components/ui';
import { FollowButton, ProfileStats, TastingNoteCard, TastingStats, AchievementsGrid } from '@/components/social';
import { StartConversationButton } from '@/components/messaging';
import { useSocialStore } from '@/store/socialStore';
import { useAuthStore } from '@/store/authStore';

const SERVER_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

type TabType = 'notes' | 'stats' | 'achievements';

export function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('stats');
  const {
    profile,
    publicNotes,
    notesPagination,
    tastingStats,
    achievements,
    isLoadingProfile,
    isLoadingNotes,
    isLoadingStats,
    isLoadingAchievements,
    profileError,
    fetchProfile,
    fetchPublicNotes,
    fetchTastingStats,
    fetchAchievements,
    clearProfile,
  } = useSocialStore();

  useEffect(() => {
    if (userId) {
      clearProfile();
      fetchProfile(userId);
      fetchTastingStats(userId);
      fetchAchievements(userId);
      fetchPublicNotes(userId);
    }
  }, [userId, fetchProfile, fetchPublicNotes, fetchTastingStats, fetchAchievements, clearProfile]);

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
                    <div className="flex gap-2">
                      <FollowButton userId={profile.id} isFollowing={profile.isFollowing} />
                      <StartConversationButton userId={profile.id} />
                    </div>
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

        {/* Tabs */}
        {(!profile.isPrivate || isOwnProfile) && (
          <div>
            {/* Tab Navigation */}
            <div className="flex border-b border-zinc-700 mb-6">
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'stats'
                    ? 'border-amber-500 text-amber-500'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Tasting Stats
              </button>
              <button
                onClick={() => setActiveTab('achievements')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'achievements'
                    ? 'border-amber-500 text-amber-500'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Achievements
                {achievements && (
                  <span className="ml-2 px-2 py-0.5 bg-zinc-700 rounded-full text-xs">
                    {achievements.summary.earned}/{achievements.summary.total}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'notes'
                    ? 'border-amber-500 text-amber-500'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Tasting Notes
                {profile.stats.publicNotes > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-zinc-700 rounded-full text-xs">
                    {profile.stats.publicNotes}
                  </span>
                )}
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'stats' && (
              <div>
                {isLoadingStats ? (
                  <div className="text-center py-8 text-zinc-400">Loading statistics...</div>
                ) : tastingStats ? (
                  <TastingStats stats={tastingStats} />
                ) : (
                  <Card variant="outlined">
                    <CardContent className="text-center py-8">
                      <p className="text-zinc-400">No tasting data yet.</p>
                      <p className="text-sm text-zinc-500 mt-1">
                        Complete a tasting session to see statistics.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'achievements' && (
              <div>
                {isLoadingAchievements ? (
                  <div className="text-center py-8 text-zinc-400">Loading achievements...</div>
                ) : achievements ? (
                  <div>
                    {/* Achievement Summary */}
                    <Card variant="elevated" className="mb-6">
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-2xl font-bold text-zinc-100">
                              {achievements.summary.earned} / {achievements.summary.total}
                            </div>
                            <div className="text-sm text-zinc-400">Achievements Earned</div>
                          </div>
                          <div className="w-24 h-24 relative">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                              <circle
                                cx="50"
                                cy="50"
                                r="40"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="8"
                                className="text-zinc-700"
                              />
                              <circle
                                cx="50"
                                cy="50"
                                r="40"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="8"
                                strokeLinecap="round"
                                className="text-amber-500"
                                strokeDasharray={`${achievements.summary.percentage * 2.51} 251`}
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xl font-bold text-amber-500">
                                {achievements.summary.percentage}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <AchievementsGrid achievements={achievements.achievements} />
                  </div>
                ) : (
                  <Card variant="outlined">
                    <CardContent className="text-center py-8">
                      <p className="text-zinc-400">Unable to load achievements.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'notes' && (
              <div>
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
        )}
      </div>
    </div>
  );
}
