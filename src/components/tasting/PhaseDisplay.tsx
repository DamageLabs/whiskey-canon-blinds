import type { TastingPhase } from '@/types';
import { getPhaseDisplayName, getPhaseInstructions, phaseHasTimer, getPhaseDuration } from '@/utils/timer';
import { Timer } from './Timer';

interface PhaseDisplayProps {
  phase: TastingPhase;
  whiskeyNumber: number;
  onPhaseComplete?: () => void;
  children?: React.ReactNode;
}

export function PhaseDisplay({
  phase,
  whiskeyNumber,
  onPhaseComplete,
  children,
}: PhaseDisplayProps) {
  const phaseName = getPhaseDisplayName(phase);
  const instructions = getPhaseInstructions(phase);
  const hasTimer = phaseHasTimer(phase);
  const duration = getPhaseDuration(phase);

  // Phase-specific icons
  const getPhaseIcon = () => {
    switch (phase) {
      case 'pour':
        return (
          <svg className="w-12 h-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        );
      case 'nosing':
        return (
          <svg className="w-12 h-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'tasting-neat':
      case 'tasting-water':
        return (
          <svg className="w-12 h-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
          </svg>
        );
      case 'scoring':
        return (
          <svg className="w-12 h-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        );
      case 'palate-reset':
        return (
          <svg className="w-12 h-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      {/* Whiskey indicator */}
      <div className="mb-4">
        <span className="inline-flex items-center px-4 py-2 bg-zinc-800 rounded-full">
          <span className="text-sm text-zinc-400">Whiskey</span>
          <span className="ml-2 text-xl font-bold text-amber-500">#{whiskeyNumber}</span>
        </span>
      </div>

      {/* Phase icon */}
      <div className="mb-4">
        {getPhaseIcon()}
      </div>

      {/* Phase name */}
      <h2 className="text-2xl font-bold text-zinc-100 mb-2">{phaseName}</h2>

      {/* Instructions */}
      <p className="text-zinc-400 max-w-md mb-6">{instructions}</p>

      {/* Timer if applicable */}
      {hasTimer && (
        <div className="mb-6">
          <Timer
            duration={duration}
            onComplete={onPhaseComplete}
            autoStart
            label={phase === 'nosing' ? 'Nosing Time' : 'Palate Reset'}
          />
        </div>
      )}

      {/* Phase-specific content */}
      {children}
    </div>
  );
}
