import { buildGrid } from './board.js';
import { canonicalKey, cellsKey, normalize, placedCells, rotate } from './piece.js';
import { absoluteKey } from './solution.js';

/**
 * Compute a single hint toward the stored solution without solving it.
 *
 * Pieces with the same rotation-invariant shape are interchangeable, so a
 * solution slot counts as satisfied when ANY placed piece covers exactly its
 * cells.
 *
 * Returns one of:
 *  { type: 'place',  pieceId, cells, rotation, x, y } — a piece and where it goes
 *  { type: 'remove', pieceId, cells }                 — a placed piece blocking the solution
 *  null                                               — nothing useful to suggest
 */
export function computeHint({ level, pieces, placements }) {
  const { width, height } = level;
  const placed = Object.entries(placements).map(([id, p]) => ({
    id,
    cells: placedCells(pieces[id].cells, pieces[id].rotation, p.x, p.y),
  }));
  const placedByKey = new Map(placed.map((p) => [absoluteKey(p.cells), p.id]));
  const { grid } = buildGrid(width, height, placed);

  const targets = level.solution.map((s) => {
    const piece = level.pieces.find((p) => p.id === s.pieceId);
    const cells = s.cells ?? placedCells(piece.cells, s.rotation, s.x, s.y);
    return { ...s, cells, key: absoluteKey(cells), shape: canonicalKey(cells) };
  });

  const satisfied = new Set();
  const correctlyPlaced = new Set();
  for (const t of targets) {
    const occupant = placedByKey.get(t.key);
    if (occupant) {
      satisfied.add(t.pieceId);
      correctlyPlaced.add(occupant);
    }
  }

  const open = targets
    .filter((t) => !satisfied.has(t.pieceId) && t.cells.every(([x, y]) => grid[y * width + x] === null))
    .sort((a, b) => b.cells.length - a.cells.length || a.y - b.y || a.x - b.x);

  for (const target of open) {
    const unplaced = Object.keys(pieces).filter((id) => !placements[id]);
    const sameShape = (id) => canonicalKey(pieces[id].cells) === target.shape;
    const pieceId =
      (unplaced.includes(target.pieceId) && target.pieceId) ||
      unplaced.find(sameShape) ||
      placed.find((p) => !correctlyPlaced.has(p.id) && sameShape(p.id))?.id;
    if (!pieceId) continue;

    const wanted = cellsKey(normalize(target.cells));
    const rotation = [0, 1, 2, 3].find((r) => cellsKey(rotate(pieces[pieceId].cells, r)) === wanted) ?? 0;
    const minX = Math.min(...target.cells.map((c) => c[0]));
    const minY = Math.min(...target.cells.map((c) => c[1]));
    return { type: 'place', pieceId, cells: target.cells, rotation, x: minX, y: minY };
  }

  const misplaced = placed.filter((p) => !correctlyPlaced.has(p.id));
  if (misplaced.length) {
    const unsatisfiedCells = new Set(
      targets.filter((t) => !satisfied.has(t.pieceId)).flatMap((t) => t.cells.map(([x, y]) => `${x},${y}`)),
    );
    const blocking = misplaced.find((p) => p.cells.some(([x, y]) => unsatisfiedCells.has(`${x},${y}`))) || misplaced[0];
    return { type: 'remove', pieceId: blocking.id, cells: blocking.cells };
  }
  return null;
}
