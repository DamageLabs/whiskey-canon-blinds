import { Card, CardContent } from '@/components/ui';

interface TastingStatsProps {
  stats: {
    overview: {
      sessionsAttended: number;
      whiskeysRated: number;
      categoriesExplored: string[];
    };
    scoringTendencies: {
      averages: {
        nose: number;
        palate: number;
        finish: number;
        overall: number;
        total: number;
      };
      distribution: Record<number, number>;
      tendency: 'generous' | 'balanced' | 'critical';
    };
    favoriteNotes: Array<{ term: string; count: number }>;
    recentActivity: Array<{
      id: string;
      name: string;
      theme: string;
      completedAt: string;
    }>;
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  bourbon: 'Bourbon',
  rye: 'Rye',
  scotch: 'Scotch',
  'scotch-single-malt': 'Single Malt Scotch',
  'scotch-blended': 'Blended Scotch',
  irish: 'Irish',
  japanese: 'Japanese',
  canadian: 'Canadian',
  world: 'World Whiskey',
  custom: 'Custom',
};

const TENDENCY_LABELS: Record<string, { label: string; color: string }> = {
  generous: { label: 'Generous Scorer', color: 'text-green-400' },
  balanced: { label: 'Balanced Scorer', color: 'text-amber-400' },
  critical: { label: 'Critical Scorer', color: 'text-blue-400' },
};

export function TastingStats({ stats }: TastingStatsProps) {
  const maxDistribution = Math.max(...Object.values(stats.scoringTendencies.distribution), 1);

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card variant="outlined">
          <CardContent className="text-center py-4">
            <div className="text-3xl font-bold text-amber-500">
              {stats.overview.sessionsAttended}
            </div>
            <div className="text-sm text-zinc-400">Sessions</div>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent className="text-center py-4">
            <div className="text-3xl font-bold text-amber-500">
              {stats.overview.whiskeysRated}
            </div>
            <div className="text-sm text-zinc-400">Whiskeys Rated</div>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent className="text-center py-4">
            <div className="text-3xl font-bold text-amber-500">
              {stats.overview.categoriesExplored.length}
            </div>
            <div className="text-sm text-zinc-400">Categories</div>
          </CardContent>
        </Card>
      </div>

      {/* Categories Explored */}
      {stats.overview.categoriesExplored.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-zinc-400 mb-2">Categories Explored</h4>
          <div className="flex flex-wrap gap-2">
            {stats.overview.categoriesExplored.map((cat) => (
              <span
                key={cat}
                className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded-full text-sm"
              >
                {CATEGORY_LABELS[cat] || cat}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Scoring Tendencies */}
      {stats.overview.whiskeysRated > 0 && (
        <Card variant="outlined">
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-zinc-400">Scoring Tendencies</h4>
              <span className={`text-sm font-medium ${TENDENCY_LABELS[stats.scoringTendencies.tendency].color}`}>
                {TENDENCY_LABELS[stats.scoringTendencies.tendency].label}
              </span>
            </div>

            {/* Average Scores */}
            <div className="grid grid-cols-5 gap-2 mb-6">
              {Object.entries(stats.scoringTendencies.averages).map(([key, value]) => (
                <div key={key} className="text-center">
                  <div className="text-lg font-bold text-zinc-100">{value.toFixed(1)}</div>
                  <div className="text-xs text-zinc-500 capitalize">{key === 'total' ? 'Avg' : key}</div>
                </div>
              ))}
            </div>

            {/* Score Distribution */}
            <div>
              <div className="text-xs text-zinc-500 mb-2">Score Distribution</div>
              <div className="flex items-end gap-1 h-16">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
                  const count = stats.scoringTendencies.distribution[score] || 0;
                  const height = maxDistribution > 0 ? (count / maxDistribution) * 100 : 0;
                  return (
                    <div key={score} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-amber-500/60 rounded-t transition-all"
                        style={{ height: `${Math.max(height, 4)}%` }}
                        title={`Score ${score}: ${count} ratings`}
                      />
                      <div className="text-xs text-zinc-600 mt-1">{score}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Favorite Notes */}
      {stats.favoriteNotes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-zinc-400 mb-2">Frequently Used Tasting Notes</h4>
          <div className="flex flex-wrap gap-2">
            {stats.favoriteNotes.map((note) => (
              <span
                key={note.term}
                className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm"
              >
                {note.term} ({note.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {stats.recentActivity.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-zinc-400 mb-2">Recent Sessions</h4>
          <div className="space-y-2">
            {stats.recentActivity.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg"
              >
                <div>
                  <div className="text-zinc-100">{session.name}</div>
                  <div className="text-xs text-zinc-500">
                    {CATEGORY_LABELS[session.theme] || session.theme}
                  </div>
                </div>
                <div className="text-xs text-zinc-500">
                  {new Date(session.completedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
