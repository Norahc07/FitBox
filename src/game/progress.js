/**
 * Pure progress logic: applying sessions, merging local/remote records and
 * computing which levels are unlocked. Kept free of storage so it can be
 * unit-tested and reused by the sync service.
 */

export function emptyProgress(levelNumber) {
  return {
    levelNumber,
    completed: false,
    bestScore: null,
    bestTimeMs: null,
    stars: 0,
    completions: 0,
    updatedAt: null,
  };
}

function minNullable(a, b) {
  if (a === null || a === undefined) return b ?? null;
  if (b === null || b === undefined) return a;
  return Math.min(a, b);
}

function maxNullable(a, b) {
  if (a === null || a === undefined) return b ?? null;
  if (b === null || b === undefined) return a;
  return Math.max(a, b);
}

/** Fold a completed session into a progress record. */
export function applySession(progress, session) {
  const current = progress ?? emptyProgress(session.levelNumber);
  const isNewBestScore = current.bestScore === null || session.score > current.bestScore;
  const isNewBestTime = current.bestTimeMs === null || session.timeMs < current.bestTimeMs;
  return {
    entry: {
      ...current,
      completed: true,
      bestScore: maxNullable(current.bestScore, session.score),
      bestTimeMs: minNullable(current.bestTimeMs, session.timeMs),
      stars: Math.max(current.stars ?? 0, session.stars ?? 0),
      completions: (current.completions ?? 0) + 1,
      updatedAt: session.completedAt,
    },
    isNewBestScore,
    isNewBestTime,
  };
}

/**
 * Conflict resolution between two copies of the same level's progress
 * (e.g. local device vs Supabase): keep the best of each field. Progress can
 * only ever improve, so no completion is lost in either direction.
 */
export function mergeProgress(a, b) {
  if (!a) return b ? { ...b } : null;
  if (!b) return { ...a };
  const latest = [a.updatedAt, b.updatedAt].filter(Boolean).sort().pop() ?? null;
  return {
    levelNumber: a.levelNumber ?? b.levelNumber,
    completed: Boolean(a.completed || b.completed),
    bestScore: maxNullable(a.bestScore, b.bestScore),
    bestTimeMs: minNullable(a.bestTimeMs, b.bestTimeMs),
    stars: Math.max(a.stars ?? 0, b.stars ?? 0),
    completions: Math.max(a.completions ?? 0, b.completions ?? 0),
    updatedAt: latest,
  };
}

export function mergeProgressMaps(local, remote) {
  const result = {};
  const keys = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
  for (const key of keys) result[key] = mergeProgress(local?.[key], remote?.[key]);
  return result;
}

/**
 * A level is unlocked when it is the first level, when it has been
 * completed, or when the level before it (in number order) is completed.
 */
export function computeUnlocked(levels, progressMap) {
  const sorted = [...levels].sort((a, b) => a.number - b.number);
  const unlocked = new Set();
  sorted.forEach((level, index) => {
    const own = progressMap?.[level.number];
    const prev = index > 0 ? progressMap?.[sorted[index - 1].number] : null;
    if (index === 0 || own?.completed || prev?.completed) unlocked.add(level.number);
  });
  return unlocked;
}

export function isLevelUnlocked(levelNumber, levels, progressMap) {
  return computeUnlocked(levels, progressMap).has(levelNumber);
}

export function summarizeProgress(levels, progressMap) {
  let completed = 0;
  let stars = 0;
  for (const level of levels) {
    const p = progressMap?.[level.number];
    if (p?.completed) completed++;
    stars += p?.stars ?? 0;
  }
  return { completed, total: levels.length, stars, maxStars: levels.length * 3 };
}

/** The first unlocked, uncompleted level — what "Continue" should open. */
export function nextLevelToPlay(levels, progressMap) {
  const unlocked = computeUnlocked(levels, progressMap);
  const sorted = [...levels].sort((a, b) => a.number - b.number);
  return (
    sorted.find((l) => unlocked.has(l.number) && !progressMap?.[l.number]?.completed) ??
    sorted.filter((l) => unlocked.has(l.number)).pop() ??
    sorted[0]
  );
}
