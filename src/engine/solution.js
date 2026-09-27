import { buildGrid } from './board.js';
import { isValidPieceCells, placedCells } from './piece.js';

function absoluteKey(cells) {
  return cells
    .map(([x, y]) => [x, y])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])
    .map(([x, y]) => `${x},${y}`)
    .join(';');
}

export { absoluteKey };

/**
 * Verify that a stored solution arrangement is a perfect tiling of the board:
 * every entry references a real piece, the stored absolute cells match the
 * piece rotated and translated, nothing overlaps or leaves the board, and
 * every cell is covered.
 */
export function validateSolution({ width, height, pieces, solution }) {
  const errors = [];
  const byId = new Map((pieces || []).map((p) => [p.id, p]));
  const seen = new Set();
  const placed = [];

  if (!Array.isArray(solution) || solution.length === 0) {
    return { valid: false, errors: ['Solution is empty.'] };
  }

  for (const entry of solution) {
    const piece = byId.get(entry.pieceId);
    if (!piece) {
      errors.push(`Solution references unknown piece "${entry.pieceId}".`);
      continue;
    }
    if (seen.has(entry.pieceId)) {
      errors.push(`Piece "${entry.pieceId}" is used more than once in the solution.`);
      continue;
    }
    seen.add(entry.pieceId);
    if (!isValidPieceCells(piece.cells)) {
      errors.push(`Piece "${piece.id}" has invalid cells.`);
      continue;
    }
    if (![0, 1, 2, 3].includes(entry.rotation)) {
      errors.push(`Piece "${piece.id}" has invalid rotation ${entry.rotation}.`);
      continue;
    }
    if (!Number.isInteger(entry.x) || !Number.isInteger(entry.y)) {
      errors.push(`Piece "${piece.id}" has a non-integer position.`);
      continue;
    }
    const cells = placedCells(piece.cells, entry.rotation, entry.x, entry.y);
    if (entry.cells && absoluteKey(entry.cells) !== absoluteKey(cells)) {
      errors.push(`Stored cells for piece "${piece.id}" do not match its rotation and position.`);
    }
    placed.push({ id: piece.id, cells });
  }

  const { grid, overlaps, outOfBounds } = buildGrid(width, height, placed);
  if (overlaps.length) errors.push(`Solution pieces overlap at ${overlaps.length} cell(s).`);
  if (outOfBounds.length) errors.push(`Solution pieces extend outside the board at ${outOfBounds.length} cell(s).`);
  const uncovered = grid.filter((v) => v === null).length;
  if (uncovered > 0) errors.push(`Solution leaves ${uncovered} board cell(s) uncovered.`);

  return { valid: errors.length === 0, errors };
}
