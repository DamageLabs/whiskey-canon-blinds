import type { TastingPhase } from '@/types';

// Timer durations in seconds
export const PHASE_DURATIONS: Record<TastingPhase, number> = {
  pour: 0, // No timer, manual advance
  nosing: 60, // 60 seconds for nosing
  'tasting-neat': 0, // No timer, manual advance
  'tasting-water': 0, // No timer, manual advance
  scoring: 0, // No timer, manual advance
  'palate-reset': 180, // 3 minutes (180 seconds) between samples
};

/**
 * Get timer duration for a phase in seconds
 */
export function getPhaseDuration(phase: TastingPhase): number {
  return PHASE_DURATIONS[phase];
}

/**
 * Format seconds as MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Check if phase has a timer
 */
export function phaseHasTimer(phase: TastingPhase): boolean {
  return PHASE_DURATIONS[phase] > 0;
}

/**
 * Get phase display name
 */
export function getPhaseDisplayName(phase: TastingPhase): string {
  const names: Record<TastingPhase, string> = {
    pour: 'Pour & Prepare',
    nosing: 'Nosing',
    'tasting-neat': 'Tasting (Neat)',
    'tasting-water': 'Tasting (With Water)',
    scoring: 'Scoring',
    'palate-reset': 'Palate Reset',
  };
  return names[phase];
}

/**
 * Get phase instructions
 */
export function getPhaseInstructions(phase: TastingPhase): string {
  const instructions: Record<TastingPhase, string> = {
    pour: 'Pour the recommended amount and prepare your tasting glass.',
    nosing: 'Nose the whiskey for 30-60 seconds. Focus on the aromas before taking your first sip.',
    'tasting-neat': 'Take a small sip and let it coat your palate. Note the flavors and mouthfeel.',
    'tasting-water': 'Add a few drops of room-temperature water. Taste again and note any changes.',
    scoring: 'Record your scores and tasting notes. Be honest and specific.',
    'palate-reset': 'Cleanse your palate with water or plain crackers before the next sample.',
  };
  return instructions[phase];
}

/**
 * Get next phase in tasting sequence
 */
export function getNextPhase(currentPhase: TastingPhase): TastingPhase | null {
  const sequence: TastingPhase[] = [
    'pour',
    'nosing',
    'tasting-neat',
    'tasting-water',
    'scoring',
    'palate-reset',
  ];

  const currentIndex = sequence.indexOf(currentPhase);
  if (currentIndex === -1 || currentIndex === sequence.length - 1) {
    return null; // End of sequence
  }

  return sequence[currentIndex + 1];
}
