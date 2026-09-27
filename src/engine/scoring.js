import { getProfile } from './difficulty.js';

export const SCORING = {
  base: 1000,
  maxSpeedBonus: 600,
  mistakePenalty: 40,
  maxMistakePenalty: 600,
  hintPenalty: 150,
  minimumScore: 100,
};

/** Par time scales with how many pieces must be placed and the difficulty. */
export function parTimeMs(difficulty, requiredPieces) {
  return getProfile(difficulty).secondsPerPiece * requiredPieces * 1000;
}

/**
 * Deterministic score for a completed puzzle.
 *
 * total = base + completion bonus + speed bonus − mistake penalty − hint penalty
 *
 * Speed bonus is full at ≤ half par, zero at ≥ double par and linear in
 * between, so time matters but can never outweigh the fixed components.
 */
export function calculateScore({ difficulty, requiredPieces, timeMs, hintsUsed = 0, mistakes = 0 }) {
  const profile = getProfile(difficulty);
  const par = parTimeMs(difficulty, requiredPieces);
  const fast = par * 0.5;
  const slow = par * 2;
  const t = Math.max(0, timeMs);
  let speedRatio;
  if (t <= fast) speedRatio = 1;
  else if (t >= slow) speedRatio = 0;
  else speedRatio = (slow - t) / (slow - fast);

  const base = SCORING.base;
  const completionBonus = profile.completionBonus;
  const speedBonus = Math.round(SCORING.maxSpeedBonus * speedRatio);
  const mistakePenalty = Math.min(SCORING.maxMistakePenalty, Math.max(0, mistakes) * SCORING.mistakePenalty);
  const hintPenalty = Math.max(0, hintsUsed) * SCORING.hintPenalty;
  const raw = base + completionBonus + speedBonus - mistakePenalty - hintPenalty;
  const total = Math.max(SCORING.minimumScore, raw);
  const maxScore = base + completionBonus + SCORING.maxSpeedBonus;

  return {
    base,
    completionBonus,
    speedBonus,
    mistakePenalty,
    hintPenalty,
    total,
    maxScore,
    parMs: par,
    stars: starsForScore(total, maxScore),
  };
}

export function starsForScore(total, maxScore) {
  const ratio = total / maxScore;
  if (ratio >= 0.85) return 3;
  if (ratio >= 0.6) return 2;
  return 1;
}
