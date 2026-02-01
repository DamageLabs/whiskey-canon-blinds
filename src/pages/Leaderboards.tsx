import { useEffect } from 'react';
import { Card, CardContent, Button } from '@/components/ui';
import { useLeaderboardStore } from '@/store/leaderboardStore';
import { useAuthStore } from '@/store/authStore';
import type { LeaderboardPeriod } from '@/services/api';

const SERVER_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

const PERIODS: { id: LeaderboardPeriod; label: string }[] = [
  { id: 'all_time', label: 'All Time' },
  { id: 'monthly', label: 'This Month' },
  { id: 'weekly', label: 'This Week' },
];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg">
        <span className="text-lg font-bold text-zinc-900">1</span>
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-400 flex items-center justify-center shadow-lg">
        <span className="text-lg font-bold text-zinc-900">2</span>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center shadow-lg">
        <span className="text-lg font-bold text-zinc-100">3</span>
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
      <span className="text-sm font-medium text-zinc-400">{rank}</span>
    </div>
  );
}

export function LeaderboardsPage() {
  const { isAuthenticated, user } = useAuthStore();
  const {
    entries,
    period,
    pagination,
    myRanks,
    isLoading,
    isLoadingMyRank,
    fetchLeaderboard,
    fetchMyRank,
    setPeriod,
  } = useLeaderboardStore();

  useEffect(() => {
    fetchLeaderboard();
    if (isAuthenticated) {
      fetchMyRank();
    }
  }, [fetchLeaderboard, fetchMyRank, isAuthenticated]);

  const loadMore = () => {
    if (pagination && pagination.page < pagination.totalPages) {
      fetchLeaderboard(period, pagination.page + 1);
    }
  };

  const myRank = myRanks?.[period];

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-zinc-100">Leaderboards</h1>
        </div>

        {/* My Rank Card (if authenticated) */}
        {isAuthenticated && (
          <Card variant="elevated" className="mb-6">
            <CardContent>
              <h2 className="text-lg font-semibold text-zinc-100 mb-4">Your Ranking</h2>
              {isLoadingMyRank ? (
                <div className="text-zinc-400">Loading...</div>
              ) : myRank ? (
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-amber-500">#{myRank.ranking}</div>
                    <div className="text-sm text-zinc-400">{PERIODS.find(p => p.id === period)?.label}</div>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-xl font-semibold text-zinc-100">{myRank.averageScore.toFixed(1)}</div>
                      <div className="text-xs text-zinc-400">Avg Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-semibold text-zinc-100">{myRank.sessionsCount}</div>
                      <div className="text-xs text-zinc-400">Sessions</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-semibold text-zinc-100">{myRank.whiskeysRated}</div>
                      <div className="text-xs text-zinc-400">Whiskeys</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-zinc-400 text-sm">
                  Complete a tasting session to appear on the leaderboard.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Period Selector */}
        <div className="flex gap-2 mb-6">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p.id
                  ? 'bg-amber-500 text-zinc-900'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Leaderboard Table */}
        <Card variant="elevated">
          <div className="divide-y divide-zinc-800">
            {entries.length === 0 && !isLoading ? (
              <div className="p-8 text-center text-zinc-400">
                No rankings yet for this period.
              </div>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-4 p-4 ${
                    user?.id === entry.userId ? 'bg-amber-500/10' : ''
                  }`}
                >
                  <RankBadge rank={entry.ranking} />

                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {entry.avatarUrl ? (
                      <img
                        src={`${SERVER_URL}${entry.avatarUrl}`}
                        alt={entry.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-lg text-zinc-400">
                        {entry.displayName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-100 truncate">
                      {entry.displayName}
                      {user?.id === entry.userId && (
                        <span className="ml-2 text-xs text-amber-500">(You)</span>
                      )}
                    </div>
                    <div className="text-sm text-zinc-400">
                      {entry.sessionsCount} sessions · {entry.whiskeysRated} whiskeys
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    <div className="text-xl font-bold text-amber-500">
                      {entry.averageScore.toFixed(1)}
                    </div>
                    <div className="text-xs text-zinc-400">avg score</div>
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="p-8 text-center text-zinc-400">
                Loading...
              </div>
            )}
          </div>
        </Card>

        {/* Load More */}
        {pagination && pagination.page < pagination.totalPages && (
          <div className="text-center mt-6">
            <Button
              variant="secondary"
              onClick={loadMore}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Load More'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
