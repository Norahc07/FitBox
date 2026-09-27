import seedLevels from './seedLevels.json';
import { validateLevel } from './validator.js';
import { getCachedRemoteLevels } from '../storage/levelStore.js';

export const SEED_LEVELS = seedLevels;

/**
 * Combine bundled seed levels with published levels downloaded from Supabase.
 * For each level number the published level with the highest version wins;
 * at equal version a remote level replaces the bundled copy (admin edit).
 * Invalid remote levels are ignored so a bad publish can never break play.
 */
export function mergeLevels(seed, remote = []) {
  const byNumber = new Map();
  for (const level of seed) byNumber.set(level.number, level);
  for (const level of remote) {
    if (!level?.published) continue;
    if (!validateLevel(level).valid) continue;
    const current = byNumber.get(level.number);
    if (!current || level.version >= current.version) byNumber.set(level.number, level);
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

export async function loadLevels() {
  let remote = [];
  try {
    remote = await getCachedRemoteLevels();
  } catch (err) {
    console.warn('Could not read cached levels', err);
  }
  return mergeLevels(SEED_LEVELS, remote);
}
