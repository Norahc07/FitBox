/**
 * Difficulty profiles drive both generation and gameplay feel.
 *
 * maxMonos       most single-cell pieces allowed in the solution
 * lumpiness      how strongly the size planner concentrates cells into a few big pieces
 * tierWeights    preference for simple (1) vs irregular (2) vs complex chiral (3) shapes
 * decoyStrategies weighted strategies for decoys (see generator.js)
 * keepSolutionRotation chance a solution piece starts in its solved orientation
 * tolerance      snap tolerance when dropping or rotating pieces (see board.js)
 */
export const DIFFICULTIES = ['beginner', 'intermediate', 'hard'];

export const DIFFICULTY_PROFILES = {
  beginner: {
    label: 'Beginner',
    maxTier: 1,
    maxSize: 4,
    maxMonos: 2,
    lumpiness: 0,
    tierWeights: { 1: 1 },
    decoyStrategies: [['random', 4], ['grow', 1]],
    randomDecoyMaxTier: 2,
    keepSolutionRotation: 0.6,
    tolerance: 'near',
    secondsPerPiece: 8,
    completionBonus: 500,
    defaultHints: 5,
  },
  intermediate: {
    label: 'Intermediate',
    maxTier: 2,
    maxSize: 5,
    maxMonos: 1,
    lumpiness: 0.6,
    tierWeights: { 1: 1, 2: 2.5 },
    decoyStrategies: [['mirror', 3], ['grow', 2], ['shrink', 2], ['random', 1]],
    randomDecoyMaxTier: 2,
    keepSolutionRotation: 0.3,
    tolerance: 'orthogonal',
    secondsPerPiece: 10,
    completionBonus: 750,
    defaultHints: 4,
  },
  hard: {
    label: 'Hard',
    maxTier: 3,
    maxSize: 5,
    maxMonos: 1,
    lumpiness: 1.4,
    tierWeights: { 1: 0.4, 2: 1.5, 3: 3.5 },
    decoyStrategies: [['mirror', 5], ['grow', 2], ['shrink', 2], ['random', 0.5]],
    randomDecoyMaxTier: 3,
    keepSolutionRotation: 0,
    tolerance: 'none',
    secondsPerPiece: 12,
    completionBonus: 1000,
    defaultHints: 3,
  },
};

export function getProfile(difficulty) {
  const profile = DIFFICULTY_PROFILES[difficulty];
  if (!profile) throw new Error(`Unknown difficulty: ${difficulty}`);
  return profile;
}
