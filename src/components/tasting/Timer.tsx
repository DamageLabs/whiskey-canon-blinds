import { useTimer } from '@/hooks/useTimer';
import { formatTime } from '@/utils/timer';

interface TimerProps {
  duration: number;
  onComplete?: () => void;
  autoStart?: boolean;
  showControls?: boolean;
  label?: string;
}

export function Timer({
  duration,
  onComplete,
  autoStart = true,
  showControls = false,
  label,
}: TimerProps) {
  const { seconds, isActive, isComplete, start, pause, reset } = useTimer(duration, {
    onComplete,
    autoStart,
  });

  // Calculate progress percentage
  const progress = duration > 0 ? ((duration - seconds) / duration) * 100 : 0;

  // Determine color based on remaining time
  const getColorClass = () => {
    const percentRemaining = (seconds / duration) * 100;
    if (percentRemaining <= 10) return 'text-red-400';
    if (percentRemaining <= 25) return 'text-amber-400';
    return 'text-zinc-100';
  };

  return (
    <div className="flex flex-col items-center">
      {label && (
        <p className="text-sm text-zinc-400 mb-2">{label}</p>
      )}

      {/* Circular timer display */}
      <div className="relative w-32 h-32">
        {/* Background circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="56"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-zinc-700"
          />
          {/* Progress circle */}
          <circle
            cx="64"
            cy="64"
            r="56"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={351.86}
            strokeDashoffset={351.86 - (351.86 * progress) / 100}
            className="text-amber-500 transition-all duration-1000"
          />
        </svg>

        {/* Time display */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-3xl font-mono font-bold ${getColorClass()}`}>
            {formatTime(seconds)}
          </span>
        </div>
      </div>

      {/* Status indicator */}
      <div className="mt-3">
        {isComplete ? (
          <span className="text-sm text-green-400">Complete</span>
        ) : isActive ? (
          <span className="text-sm text-amber-400 animate-pulse">In Progress</span>
        ) : (
          <span className="text-sm text-zinc-500">Paused</span>
        )}
      </div>

      {/* Controls */}
      {showControls && (
        <div className="flex gap-2 mt-4">
          {isActive ? (
            <button
              onClick={pause}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors"
            >
              Pause
            </button>
          ) : (
            <button
              onClick={start}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg text-sm transition-colors"
              disabled={isComplete}
            >
              {seconds === duration ? 'Start' : 'Resume'}
            </button>
          )}
          <button
            onClick={reset}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
