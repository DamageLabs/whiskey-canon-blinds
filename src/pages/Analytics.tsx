import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, Card, CardHeader, CardContent } from '@/components/ui';
import { TrendChart, CategoryRadar, ScoreDistribution } from '@/components/charts';
import { useAnalyticsStore } from '@/store/analyticsStore';
import { useAuthStore } from '@/store/authStore';

const TIME_RANGES = [
  { value: 30, label: '30 Days' },
  { value: 90, label: '90 Days' },
  { value: 365, label: '1 Year' },
  { value: 0, label: 'All Time' },
];

export function AnalyticsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const {
    trends,
    summary,
    rankings,
    sessions,
    distribution,
    selectedDays,
    isLoading,
    error,
    fetchAll,
    setSelectedDays,
    clearError,
  } = useAnalyticsStore();

  const [showCategories, setShowCategories] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAll();
    }
  }, [isAuthenticated, fetchAll]);

  const handleTimeRangeChange = async (days: number) => {
    setSelectedDays(days);
    await fetchAll(days);
  };

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Card variant="elevated" className="max-w-md w-full">
          <CardContent className="text-center py-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">
              Authentication Required
            </h2>
            <p className="text-zinc-400 mb-6">
              You need to be logged in to view your analytics.
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="secondary" onClick={() => navigate('/login')}>
                Login
              </Button>
              <Button variant="primary" onClick={() => navigate('/register')}>
                Register
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">Analytics</h1>
            <p className="text-zinc-400 mt-2">Your tasting performance and trends</p>
          </div>
          <div className="flex gap-2">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => handleTimeRangeChange(range.value)}
                disabled={isLoading}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  selectedDays === range.value
                    ? 'bg-amber-500 text-zinc-900'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
            <p className="text-red-400">{error}</p>
            <button onClick={clearError} className="text-red-400 hover:text-red-300">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && !summary && (
          <div className="text-center py-12">
            <p className="text-zinc-400">Loading analytics...</p>
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card variant="outlined">
              <CardContent className="text-center py-4">
                <div className="text-3xl font-bold text-amber-500">
                  {summary.totalSessions}
                </div>
                <div className="text-sm text-zinc-400">Sessions</div>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent className="text-center py-4">
                <div className="text-3xl font-bold text-amber-500">
                  {summary.totalWhiskeys}
                </div>
                <div className="text-sm text-zinc-400">Whiskeys Rated</div>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent className="text-center py-4">
                <div className="text-3xl font-bold text-amber-500">
                  {summary.averageScore.toFixed(1)}
                </div>
                <div className="text-sm text-zinc-400">Avg Score</div>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent className="text-center py-4">
                <div className="text-3xl font-bold text-amber-500">
                  {summary.categoryAverages.overall.toFixed(1)}
                </div>
                <div className="text-sm text-zinc-400">Avg Overall</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts Row */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Trend Chart */}
          <Card variant="elevated">
            <CardHeader
              title="Scoring Trends"
              description="Your average scores over time"
            />
            <CardContent>
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setShowCategories(!showCategories)}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  {showCategories ? 'Hide' : 'Show'} categories
                </button>
              </div>
              <TrendChart data={trends} showCategories={showCategories} />
            </CardContent>
          </Card>

          {/* Category Radar */}
          <Card variant="elevated">
            <CardHeader
              title="Category Breakdown"
              description="Your average scores by category"
            />
            <CardContent>
              {summary ? (
                <CategoryRadar data={summary.categoryAverages} />
              ) : (
                <div className="h-[250px] flex items-center justify-center text-zinc-500">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Distribution */}
        <Card variant="elevated" className="mb-8">
          <CardHeader
            title="Score Distribution"
            description="How your scores are distributed"
          />
          <CardContent>
            {distribution ? (
              <ScoreDistribution data={distribution} />
            ) : (
              <div className="h-[250px] flex items-center justify-center text-zinc-500">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rankings and Sessions */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Top Whiskeys */}
          <Card variant="elevated">
            <CardHeader
              title="Your Top Whiskeys"
              description="Highest rated whiskeys you've tasted"
            />
            <CardContent>
              {rankings.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  No whiskeys rated yet
                </div>
              ) : (
                <div className="space-y-3">
                  {rankings.slice(0, 10).map((ranking, index) => (
                    <div
                      key={ranking.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-amber-500 text-zinc-900' :
                        index === 1 ? 'bg-zinc-400 text-zinc-900' :
                        index === 2 ? 'bg-amber-700 text-zinc-100' :
                        'bg-zinc-700 text-zinc-400'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-zinc-100 truncate">
                          {ranking.whiskey.name}
                        </div>
                        <div className="text-sm text-zinc-500 truncate">
                          {ranking.whiskey.distillery}
                        </div>
                      </div>
                      <div className="text-amber-500 font-bold">
                        {ranking.score.toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Sessions */}
          <Card variant="elevated">
            <CardHeader
              title="Session History"
              description="Your recent tasting sessions"
            />
            <CardContent>
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  No sessions yet
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.slice(0, 10).map((session) => (
                    <Link
                      key={session.id}
                      to={session.status === 'completed' || session.status === 'reveal'
                        ? `/session/${session.id}/reveal`
                        : `/session/${session.id}/lobby`}
                      className="block p-3 rounded-lg hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-zinc-100">
                            {session.name}
                            {session.isModerator && (
                              <span className="ml-2 text-xs text-amber-500">(Host)</span>
                            )}
                          </div>
                          <div className="text-sm text-zinc-500">
                            {session.theme} • {session.whiskeyCount} whiskeys • {session.participantCount} participants
                          </div>
                        </div>
                        <div className="text-right">
                          {session.userAverage !== null && (
                            <div className="text-amber-500 font-medium">
                              {session.userAverage.toFixed(1)}
                            </div>
                          )}
                          {session.scoreDifference !== null && (
                            <div className={`text-xs ${
                              session.scoreDifference > 0 ? 'text-green-500' :
                              session.scoreDifference < 0 ? 'text-red-500' :
                              'text-zinc-500'
                            }`}>
                              {session.scoreDifference > 0 ? '+' : ''}{session.scoreDifference.toFixed(1)} vs group
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
