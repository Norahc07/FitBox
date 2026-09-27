/**
 * Deterministic pseudo-random number generator (mulberry32).
 * The same seed always yields the same sequence on every platform, which is
 * what makes level generation reproducible.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed) {
  const next = mulberry32(seed);
  const rng = {
    next,
    /** Integer in [min, max] inclusive. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
    shuffle(items) {
      const copy = items.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
    /** Pick from `[value, weight]` pairs. Returns undefined if all weights are 0. */
    weighted(entries) {
      const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
      if (total <= 0) return undefined;
      let roll = next() * total;
      for (const [value, weight] of entries) {
        roll -= Math.max(0, weight);
        if (roll < 0) return value;
      }
      return entries[entries.length - 1][0];
    },
  };
  return rng;
}
