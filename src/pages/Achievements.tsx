import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { Navigate } from 'react-router-dom';
import { achievementsApi } from '@/services/api';
import type { AchievementDefinition, AchievementLeaderboardEntry } from '@/services/api';

const SERVER_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

const RARITY_COLORS = {
  common: 'from-zinc-500 to-zinc-600',
  uncommon: 'from-green-500 to-green-600',
  rare: 'from-blue-500 to-blue-600',
  epic: 'from-purple-500 to-purple-600',
  legendary: 'from-amber-400 to-orange-500',
};

const RARITY_LABELS = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};


function AchievementCard({ achievement }: { achievement: AchievementDefinition }) {
  const isEarned = achievement.earned;
  const rarityColor = RARITY_COLORS[achievement.rarity] || RARITY_COLORS.common;

  return (
    <div
      className={`relative rounded-xl overflow-hidden ${
        isEarned ? 'bg-zinc-800' : 'bg-zinc-900'
      }`}
    >
      {/* Rarity indicator */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${rarityColor}`} />

      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              isEarned
                ? `bg-gradient-to-br ${rarityColor}`
                : 'bg-zinc-800'
            }`}
          >
            <span className={`text-2xl ${isEarned ? '' : 'opacity-30'}`}>
              {getIcon(achievement.icon)}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3
                className={`font-semibold ${
                  isEarned ? 'text-zinc-100' : 'text-zinc-500'
                }`}
              >
                {achievement.name}
              </h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                isEarned
                  ? 'bg-gradient-to-r ' + rarityColor + ' text-white'
                  : 'bg-zinc-800 text-zinc-500'
              }`}>
                {RARITY_LABELS[achievement.rarity]}
              </span>
            </div>
            <p className={`text-sm ${isEarned ? 'text-zinc-400' : 'text-zinc-600'}`}>
              {achievement.description}
            </p>

            {/* Progress bar */}
            {!isEarned && (
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-500">
                    {achievement.progress} / {achievement.target}
                  </span>
                  <span className="text-zinc-500">
                    {achievement.percentComplete}%
                  </span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${rarityColor}`}
                    style={{ width: `${achievement.percentComplete}%` }}
                  />
                </div>
              </div>
            )}

            {/* Points */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-amber-500 font-medium">
                +{achievement.points} points
              </span>
              {isEarned && achievement.earnedAt && (
                <span className="text-xs text-zinc-600">
                  Earned {new Date(achievement.earnedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getIcon(iconName: string): string {
  const icons: Record<string, string> = {
    'glass-whiskey': '🥃',
    'calendar-check': '📅',
    'award': '🏅',
    'crown': '👑',
    'star': '⭐',
    'gem': '💎',
    'compass': '🧭',
    'map': '🗺️',
    'globe': '🌍',
    'user-plus': '👤',
    'users': '👥',
    'trending-up': '📈',
    'fire': '🔥',
    'flame': '🔥',
    'edit': '✏️',
    'book-open': '📖',
    'target': '🎯',
    'eye': '👁️',
    'crosshairs': '🎯',
  };
  return icons[iconName] || '🏆';
}

export function AchievementsPage() {
  const { isAuthenticated, user } = useAuthStore();
  const [achievements, setAchievements] = useState<AchievementDefinition[]>([]);
  const [summary, setSummary] = useState<{
    earned: number;
    total: number;
    percentage: number;
    totalPoints: number;
  } | null>(null);
  const [leaderboard, setLeaderboard] = useState<AchievementLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'earned' | 'in-progress' | 'leaderboard'>('all');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [progressRes, leaderboardRes] = await Promise.all([
          achievementsApi.getMyProgress(),
          achievementsApi.getLeaderboard(1, 10),
        ]);
        setAchievements(progressRes.achievements);
        setSummary(progressRes.summary);
        setLeaderboard(leaderboardRes.entries);
      } catch (error) {
        console.error('Failed to load achievements:', error);
      }
      setIsLoading(false);
    }

    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const categories = [...new Set(achievements.map(a => a.category))];

  const filteredAchievements = achievements.filter(a => {
    if (categoryFilter && a.category !== categoryFilter) return false;
    if (activeTab === 'earned') return a.earned;
    if (activeTab === 'in-progress') return !a.earned && a.progress > 0;
    return true;
  });

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-100 mb-6">Achievements</h1>

        {isLoading ? (
          <div className="text-center py-8 text-zinc-400">Loading achievements...</div>
        ) : (
          <>
            {/* Summary Card */}
            {summary && (
              <Card variant="elevated" className="mb-6">
                <CardContent>
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    {/* Progress Circle */}
                    <div className="flex items-center gap-6">
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
                            strokeDasharray={`${summary.percentage * 2.51} 251`}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xl font-bold text-amber-500">
                            {summary.percentage}%
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-zinc-100">
                          {summary.earned} / {summary.total}
                        </div>
                        <div className="text-sm text-zinc-400">Achievements Earned</div>
                      </div>
                    </div>

                    {/* Points */}
                    <div className="text-center">
                      <div className="text-3xl font-bold text-amber-500">
                        {summary.totalPoints}
                      </div>
                      <div className="text-sm text-zinc-400">Total Points</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {(['all', 'earned', 'in-progress', 'leaderboard'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-amber-500 text-zinc-900'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {tab === 'all' && 'All'}
                  {tab === 'earned' && `Earned (${summary?.earned || 0})`}
                  {tab === 'in-progress' && 'In Progress'}
                  {tab === 'leaderboard' && 'Leaderboard'}
                </button>
              ))}
            </div>

            {activeTab === 'leaderboard' ? (
              /* Leaderboard */
              <Card variant="elevated">
                <div className="divide-y divide-zinc-800">
                  {leaderboard.map((entry) => (
                    <div
                      key={entry.userId}
                      className={`flex items-center gap-4 p-4 ${
                        user?.id === entry.userId ? 'bg-amber-500/10' : ''
                      }`}
                    >
                      {/* Rank */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        entry.ranking === 1
                          ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-zinc-900'
                          : entry.ranking === 2
                            ? 'bg-gradient-to-br from-zinc-300 to-zinc-400 text-zinc-900'
                            : entry.ranking === 3
                              ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-zinc-100'
                              : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {entry.ranking}
                      </div>

                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-zinc-700 overflow-hidden flex items-center justify-center">
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
                      <div className="flex-1">
                        <div className="font-medium text-zinc-100">
                          {entry.displayName}
                          {user?.id === entry.userId && (
                            <span className="ml-2 text-xs text-amber-500">(You)</span>
                          )}
                        </div>
                        <div className="text-sm text-zinc-400">
                          {entry.achievementCount} achievements
                        </div>
                      </div>

                      {/* Points */}
                      <div className="text-right">
                        <div className="text-xl font-bold text-amber-500">
                          {entry.totalPoints}
                        </div>
                        <div className="text-xs text-zinc-400">points</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              <>
                {/* Category Filter */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setCategoryFilter('')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      !categoryFilter
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    All
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
                        categoryFilter === cat
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Achievements Grid */}
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredAchievements.map((achievement) => (
                    <AchievementCard key={achievement.id} achievement={achievement} />
                  ))}
                </div>

                {filteredAchievements.length === 0 && (
                  <div className="text-center py-8 text-zinc-400">
                    No achievements found.
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
