import type { ScoreInput, Score } from '@/types';

// Scoring weights as defined in PRD
const WEIGHTS = {
  nose: 0.25,
  palate: 0.35,
  finish: 0.25,
  overall: 0.15,
} as const;

/**
 * Calculate the weighted total score from individual category scores
 */
export function calculateTotalScore(input: ScoreInput): number {
  const weighted =
    input.nose * WEIGHTS.nose +
    input.palate * WEIGHTS.palate +
    input.finish * WEIGHTS.finish +
    input.overall * WEIGHTS.overall;

  return Math.round(weighted * 10) / 10; // Round to 1 decimal place
}

/**
 * Calculate average score from multiple scores
 */
export function calculateAverageScore(scores: Score[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((acc, score) => acc + score.totalScore, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}

/**
 * Calculate category averages from multiple scores
 */
export function calculateCategoryAverages(scores: Score[]): {
  nose: number;
  palate: number;
  finish: number;
  overall: number;
} {
  if (scores.length === 0) {
    return { nose: 0, palate: 0, finish: 0, overall: 0 };
  }

  const sum = scores.reduce(
    (acc, score) => ({
      nose: acc.nose + score.nose,
      palate: acc.palate + score.palate,
      finish: acc.finish + score.finish,
      overall: acc.overall + score.overall,
    }),
    { nose: 0, palate: 0, finish: 0, overall: 0 }
  );

  return {
    nose: Math.round((sum.nose / scores.length) * 10) / 10,
    palate: Math.round((sum.palate / scores.length) * 10) / 10,
    finish: Math.round((sum.finish / scores.length) * 10) / 10,
    overall: Math.round((sum.overall / scores.length) * 10) / 10,
  };
}

/**
 * Get score descriptor based on numeric score
 */
export function getScoreDescriptor(score: number): string {
  if (score <= 2) return 'Undrinkable';
  if (score <= 4) return 'Below Average';
  if (score <= 6) return 'Average';
  if (score <= 8) return 'Good';
  return 'Excellent';
}

/**
 * Validate score is within acceptable range
 */
export function isValidScore(score: number): boolean {
  return score >= 1 && score <= 10 && Number.isFinite(score);
}
