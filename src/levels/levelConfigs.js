import { createRng } from '../engine/rng.js';

/**
 * Configuration for the 24 built-in levels. Piece counts are drawn at random
 * from each tier's range, but from a fixed seed, so the generator always
 * reproduces the same puzzles. The generated output is committed as
 * seedLevels.json (see scripts/generate-levels.mjs) so players never depend on
 * runtime generation.
 */
const TIERS = [
  { levels: [1, 8], difficulty: 'beginner', size: 5, fit: [9, 11], decoys: [2, 3], hints: 5 },
  { levels: [9, 16], difficulty: 'intermediate', size: 6, fit: [11, 13], decoys: [3, 4], hints: 4 },
  { levels: [17, 24], difficulty: 'hard', size: 7, fit: [13, 15], decoys: [4, 5], hints: 3 },
];

function seedFor(number) {
  return 20260000 + number * 7919;
}

export const LEVEL_CONFIGS = TIERS.flatMap((tier) => {
  const configs = [];
  for (let number = tier.levels[0]; number <= tier.levels[1]; number++) {
    const seed = seedFor(number);
    const rng = createRng(seed ^ 0x5eed);
    const requiredPieces = rng.int(tier.fit[0], tier.fit[1]);
    const totalPieces = requiredPieces + rng.int(tier.decoys[0], tier.decoys[1]);
    configs.push({
      number,
      difficulty: tier.difficulty,
      width: tier.size,
      height: tier.size,
      totalPieces,
      requiredPieces,
      hints: tier.hints,
      seed,
      timeLimit: null,
      version: 1,
      published: true,
    });
  }
  return configs;
});
