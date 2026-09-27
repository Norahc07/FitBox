/**
 * Board model and collision detection.
 *
 * A board is a rectangular width × height grid. Placed pieces are passed in
 * as `{ id, cells }` where `cells` are absolute board coordinates.
 */

export function cellIndex(width, x, y) {
  return y * width + x;
}

export function isInside(width, height, cells) {
  return cells.every(([x, y]) => x >= 0 && y >= 0 && x < width && y < height);
}

/**
 * Build an occupancy grid. Each slot holds the id of the piece covering it,
 * or null. Overlapping cells are reported rather than silently overwritten.
 */
export function buildGrid(width, height, placedPieces, ignoreId = null) {
  const grid = new Array(width * height).fill(null);
  const overlaps = [];
  const outOfBounds = [];
  for (const piece of placedPieces) {
    if (piece.id === ignoreId) continue;
    for (const [x, y] of piece.cells) {
      if (x < 0 || y < 0 || x >= width || y >= height) {
        outOfBounds.push({ id: piece.id, x, y });
        continue;
      }
      const i = cellIndex(width, x, y);
      if (grid[i] !== null) overlaps.push({ ids: [grid[i], piece.id], x, y });
      else grid[i] = piece.id;
    }
  }
  return { grid, overlaps, outOfBounds };
}

/**
 * Can `cells` (absolute) be placed on the grid? A piece never collides with
 * itself, so `ignoreId` lets a piece already on the board be moved.
 */
export function canPlace(width, height, grid, cells, ignoreId = null) {
  for (const [x, y] of cells) {
    if (x < 0 || y < 0 || x >= width || y >= height) return { ok: false, reason: 'out-of-bounds' };
    const occupant = grid[cellIndex(width, x, y)];
    if (occupant !== null && occupant !== ignoreId) return { ok: false, reason: 'overlap' };
  }
  return { ok: true, reason: null };
}

/**
 * Snap tolerance offsets, ordered by distance so the closest valid spot wins.
 * - none:       exact position only (hard)
 * - orthogonal: exact, then one cell up/down/left/right (intermediate)
 * - near:       exact, orthogonal, then diagonals (beginner)
 */
const TOLERANCE_OFFSETS = {
  none: [[0, 0]],
  orthogonal: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]],
  near: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]],
};

export function toleranceOffsets(tolerance) {
  return TOLERANCE_OFFSETS[tolerance] || TOLERANCE_OFFSETS.none;
}

/**
 * Find the closest valid anchor for a normalized shape near (x, y).
 * Returns `{ x, y }` or null when nothing within tolerance fits.
 */
export function findNearestValidAnchor(width, height, grid, shapeCells, x, y, tolerance = 'none', ignoreId = null) {
  for (const [dx, dy] of toleranceOffsets(tolerance)) {
    const ax = x + dx;
    const ay = y + dy;
    const cells = shapeCells.map(([cx, cy]) => [cx + ax, cy + ay]);
    if (canPlace(width, height, grid, cells, ignoreId).ok) return { x: ax, y: ay };
  }
  return null;
}

/**
 * Evaluate the board state.
 * solved = every cell covered exactly once. Any combination of pieces that
 * fills the box wins; the leftover pieces are simply decoys.
 */
export function evaluateBoard(width, height, placedPieces) {
  const { grid, overlaps, outOfBounds } = buildGrid(width, height, placedPieces);
  const covered = grid.reduce((n, v) => (v !== null ? n + 1 : n), 0);
  const area = width * height;
  const full = covered === area && overlaps.length === 0 && outOfBounds.length === 0;
  return {
    solved: full,
    full,
    covered,
    area,
    count: placedPieces.length,
    overlaps: overlaps.length,
    outOfBounds: outOfBounds.length,
  };
}
