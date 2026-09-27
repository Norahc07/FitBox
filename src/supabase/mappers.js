/** Convert between app objects (camelCase) and database rows (snake_case). */

export function levelFromRow(row) {
  return {
    id: row.id,
    number: row.number,
    version: row.version,
    difficulty: row.difficulty,
    width: row.width,
    height: row.height,
    totalPieces: row.total_pieces,
    requiredPieces: row.required_pieces,
    timeLimit: row.time_limit ?? null,
    hints: row.hints,
    seed: row.seed === null || row.seed === undefined ? null : Number(row.seed),
    published: row.published,
    pieces: row.pieces,
    solution: row.solution,
    updatedAt: row.updated_at ?? null,
  };
}

export function levelToRow(level) {
  return {
    id: level.id,
    number: level.number,
    version: level.version,
    difficulty: level.difficulty,
    width: level.width,
    height: level.height,
    total_pieces: level.totalPieces,
    required_pieces: level.requiredPieces,
    time_limit: level.timeLimit ?? null,
    hints: level.hints,
    seed: level.seed ?? null,
    published: Boolean(level.published),
    pieces: level.pieces,
    solution: level.solution,
  };
}

export function progressFromRow(row) {
  return {
    levelNumber: row.level_number,
    completed: row.completed,
    bestScore: row.best_score,
    bestTimeMs: row.best_time_ms,
    stars: row.stars,
    completions: 0,
    updatedAt: row.updated_at,
  };
}

export function sessionToRow(session, userId) {
  return {
    id: session.id,
    user_id: userId,
    level_id: session.levelId,
    level_number: session.levelNumber,
    level_version: session.levelVersion,
    difficulty: session.difficulty,
    score: session.score,
    time_ms: session.timeMs,
    hints_used: session.hintsUsed,
    mistakes: session.mistakes,
    pieces_used: session.piecesUsed,
    stars: session.stars,
    completed_at: session.completedAt,
  };
}
