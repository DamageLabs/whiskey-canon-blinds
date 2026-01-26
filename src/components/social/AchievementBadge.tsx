interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  earned: boolean;
  progress: number;
  target: number;
}

interface AchievementBadgeProps {
  achievement: Achievement;
  size?: 'sm' | 'md' | 'lg';
}

// Icon components for achievements
const ICONS: Record<string, React.JSX.Element> = {
  glass: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M6 2h12l-1.5 14h-9L6 2zm6 18c-2 0-3-1-3-2h6c0 1-1 2-3 2zm-2-4h4v2h-4v-2z" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5z" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H8v2h8v-2h-3v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
    </svg>
  ),
  bottle: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M10 2v2.26l-1.5 3V10h-1v10c0 1.1.9 2 2 2h5c1.1 0 2-.9 2-2V10h-1V7.26l-1.5-3V2h-4zm1 2h2v1.51l1.5 3V10h-5V8.51l1.5-3V4z" />
    </svg>
  ),
  bottles: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M4 2v3l2 3v2H4v10c0 1 1 2 2 2h3c1 0 2-1 2-2V10H9V8l2-3V2H4zm14 0v3l2 3v2h-2v10c0 1 1 2 2 2h3c1 0 2-1 2-2V10h-2V8l2-3V2h-7z" />
    </svg>
  ),
  collection: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8-2h8v8h-8v-8zm2 2v4h4v-4h-4z" />
    </svg>
  ),
  medal: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V22l4-2 4 2v-7.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zm0 2c2.76 0 5 2.24 5 5s-2.24 5-5 5-5-2.24-5-5 2.24-5 5-5z" />
    </svg>
  ),
  compass: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </svg>
  ),
  world: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
      <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" />
    </svg>
  ),
  host: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
    </svg>
  ),
  crown: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M2 19h20v3H2v-3zm2-8l3 5h10l3-5-4 2-4-6-4 6-4-2z" />
    </svg>
  ),
  scepter: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 1l3 5-3 2-3-2 3-5zm0 9l-2 12h4l-2-12zm-5-2l2.5 4L7 14l-5-3 5-3zm10 0l-2.5 4 2.5 2 5-3-5-3z" />
    </svg>
  ),
};

const DEFAULT_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const SIZES = {
  sm: { badge: 'w-12 h-12', icon: 'w-6 h-6', text: 'text-xs' },
  md: { badge: 'w-16 h-16', icon: 'w-8 h-8', text: 'text-sm' },
  lg: { badge: 'w-20 h-20', icon: 'w-10 h-10', text: 'text-base' },
};

export function AchievementBadge({ achievement, size = 'md' }: AchievementBadgeProps) {
  const sizeClasses = SIZES[size];
  const progressPercent = (achievement.progress / achievement.target) * 100;

  return (
    <div className="flex flex-col items-center gap-2 p-3">
      {/* Badge Circle */}
      <div className="relative">
        <div
          className={`${sizeClasses.badge} rounded-full flex items-center justify-center transition-all ${
            achievement.earned
              ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30'
              : 'bg-zinc-800 border-2 border-zinc-700'
          }`}
        >
          <div
            className={`${sizeClasses.icon} ${
              achievement.earned ? 'text-zinc-900' : 'text-zinc-600'
            }`}
          >
            {ICONS[achievement.icon] || DEFAULT_ICON}
          </div>
        </div>

        {/* Progress Ring for unearned achievements */}
        {!achievement.earned && achievement.progress > 0 && (
          <svg
            className={`absolute inset-0 ${sizeClasses.badge} -rotate-90`}
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-amber-500/30"
              strokeDasharray={`${progressPercent * 2.89} 289`}
            />
          </svg>
        )}
      </div>

      {/* Badge Name */}
      <div className="text-center">
        <div
          className={`${sizeClasses.text} font-medium ${
            achievement.earned ? 'text-zinc-100' : 'text-zinc-500'
          }`}
        >
          {achievement.name}
        </div>
        {!achievement.earned && (
          <div className="text-xs text-zinc-600">
            {achievement.progress}/{achievement.target}
          </div>
        )}
      </div>
    </div>
  );
}

interface AchievementsGridProps {
  achievements: Achievement[];
  showUnearned?: boolean;
}

export function AchievementsGrid({ achievements, showUnearned = true }: AchievementsGridProps) {
  const displayAchievements = showUnearned
    ? achievements
    : achievements.filter((a) => a.earned);

  // Group by category
  const categories: Record<string, Achievement[]> = {};
  displayAchievements.forEach((a) => {
    if (!categories[a.category]) {
      categories[a.category] = [];
    }
    categories[a.category].push(a);
  });

  const CATEGORY_LABELS: Record<string, string> = {
    sessions: 'Tasting Sessions',
    whiskeys: 'Whiskeys Rated',
    exploration: 'Category Exploration',
    hosting: 'Hosting',
  };

  return (
    <div className="space-y-6">
      {Object.entries(categories).map(([category, categoryAchievements]) => (
        <div key={category}>
          <h4 className="text-sm font-medium text-zinc-400 mb-3">
            {CATEGORY_LABELS[category] || category}
          </h4>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {categoryAchievements.map((achievement) => (
              <AchievementBadge
                key={achievement.id}
                achievement={achievement}
                size="sm"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
