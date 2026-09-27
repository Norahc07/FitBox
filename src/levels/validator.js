import { DIFFICULTIES } from '../engine/difficulty.js';
import { isValidPieceCells, cellsKey } from '../engine/piece.js';
import { validateSolution } from '../engine/solution.js';

export const LEVEL_LIMITS = {
  minSize: 3,
  maxSize: 10,
  maxPieces: 60,
  maxHints: 10,
};

/**
 * Full level validation. A level that fails cannot be published.
 * Checks metadata, every piece, the solution tiling and the presence of decoys.
 */
export function validateLevel(level) {
  const errors = [];
  const warnings = [];

  if (!level || typeof level !== 'object') return { valid: false, errors: ['Level is missing.'], warnings };

  const { number, difficulty, width, height, totalPieces, requiredPieces, hints, timeLimit, pieces, solution } = level;

  if (typeof level.id !== 'string' || level.id.length === 0) errors.push('Level id is required.');
  if (!Number.isInteger(number) || number < 1) errors.push('Level number must be a positive integer.');
  if (!DIFFICULTIES.includes(difficulty)) errors.push(`Difficulty must be one of: ${DIFFICULTIES.join(', ')}.`);
  for (const [name, value] of [['Board width', width], ['Board height', height]]) {
    if (!Number.isInteger(value) || value < LEVEL_LIMITS.minSize || value > LEVEL_LIMITS.maxSize) {
      errors.push(`${name} must be an integer from ${LEVEL_LIMITS.minSize} to ${LEVEL_LIMITS.maxSize}.`);
    }
  }
  if (!Number.isInteger(requiredPieces) || requiredPieces < 1) errors.push('Required pieces must be a positive integer.');
  if (!Number.isInteger(totalPieces) || totalPieces > LEVEL_LIMITS.maxPieces) {
    errors.push(`Total pieces must be an integer no greater than ${LEVEL_LIMITS.maxPieces}.`);
  }
  if (Number.isInteger(totalPieces) && Number.isInteger(requiredPieces) && totalPieces <= requiredPieces) {
    errors.push('Total pieces must exceed required pieces so that decoys exist.');
  }
  if (!Number.isInteger(hints) || hints < 0 || hints > LEVEL_LIMITS.maxHints) {
    errors.push(`Hints must be an integer from 0 to ${LEVEL_LIMITS.maxHints}.`);
  }
  if (timeLimit !== null && timeLimit !== undefined && (!Number.isInteger(timeLimit) || timeLimit <= 0)) {
    errors.push('Time limit must be empty or a positive number of seconds.');
  }
  if (Number.isInteger(width) && Number.isInteger(height) && Number.isInteger(requiredPieces) && requiredPieces > width * height) {
    errors.push('Required pieces cannot exceed the number of board cells.');
  }

  if (!Array.isArray(pieces) || pieces.length === 0) {
    errors.push('Level has no pieces.');
    return { valid: false, errors, warnings };
  }
  if (pieces.length !== totalPieces) errors.push(`Level has ${pieces.length} pieces but total pieces is ${totalPieces}.`);

  const ids = new Set();
  for (const piece of pieces) {
    if (!piece || typeof piece.id !== 'string') {
      errors.push('Every piece needs a string id.');
      continue;
    }
    if (ids.has(piece.id)) errors.push(`Duplicate piece id "${piece.id}".`);
    ids.add(piece.id);
    if (!isValidPieceCells(piece.cells)) errors.push(`Piece "${piece.id}" is not a valid connected polyomino.`);
    else if (cellsKey(piece.cells) !== piece.cells.map(([x, y]) => `${x},${y}`).join(';')) {
      warnings.push(`Piece "${piece.id}" is not normalized.`);
    }
    if (piece.initialRotation !== undefined && ![0, 1, 2, 3].includes(piece.initialRotation)) {
      errors.push(`Piece "${piece.id}" has an invalid initial rotation.`);
    }
  }

  if (!Array.isArray(solution)) {
    errors.push('Level has no solution.');
    return { valid: false, errors, warnings };
  }
  if (solution.length !== requiredPieces) {
    errors.push(`Solution uses ${solution.length} pieces but required pieces is ${requiredPieces}.`);
  }
  const solutionCheck = validateSolution({ width, height, pieces, solution });
  errors.push(...solutionCheck.errors);

  const solutionIds = new Set(solution.map((s) => s.pieceId));
  const decoyCount = pieces.filter((p) => !solutionIds.has(p.id)).length;
  if (decoyCount === 0) errors.push('Puzzle must contain at least one decoy piece.');

  return { valid: errors.length === 0, errors, warnings };
}
