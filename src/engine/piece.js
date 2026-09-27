/**
 * Piece geometry.
 *
 * A piece is a polyomino represented as an array of [x, y] grid cells.
 * x grows to the right, y grows downward (screen coordinates).
 *
 * All functions are pure and return new arrays. "Normalized" cells are
 * translated so the minimum x and y are 0 and are sorted row-major
 * (by y, then x), which gives every orientation a single canonical form.
 */

export function normalize(cells) {
  if (!cells || cells.length === 0) return [];
  let minX = Infinity;
  let minY = Infinity;
  for (const [x, y] of cells) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }
  return cells
    .map(([x, y]) => [x - minX, y - minY])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/** Rotate 90° clockwise on screen: (x, y) -> (-y, x). */
export function rotateCW(cells) {
  return normalize(cells.map(([x, y]) => [-y, x]));
}

/** Rotate 90° counter-clockwise on screen: (x, y) -> (y, -x). */
export function rotateCCW(cells) {
  return normalize(cells.map(([x, y]) => [y, -x]));
}

/** Rotate by a number of clockwise quarter turns (negative = counter-clockwise). */
export function rotate(cells, turns = 0) {
  const t = ((turns % 4) + 4) % 4;
  let result = normalize(cells);
  for (let i = 0; i < t; i++) result = rotateCW(result);
  return result;
}

/** Horizontal mirror. Used for decoys only — players cannot flip pieces. */
export function mirror(cells) {
  return normalize(cells.map(([x, y]) => [-x, y]));
}

export function translate(cells, dx, dy) {
  return cells.map(([x, y]) => [x + dx, y + dy]);
}

export function cellsKey(cells) {
  return normalize(cells)
    .map(([x, y]) => `${x},${y}`)
    .join(';');
}

/**
 * Rotation-invariant identity of a shape. Two pieces with the same canonical
 * key are interchangeable in play because rotation is the only transform.
 */
export function canonicalKey(cells) {
  let best = null;
  for (let t = 0; t < 4; t++) {
    const key = cellsKey(rotate(cells, t));
    if (best === null || key < best) best = key;
  }
  return best;
}

/** Distinct orientations reachable by rotation, with the turn count that produces each. */
export function uniqueRotations(cells) {
  const seen = new Set();
  const result = [];
  for (let t = 0; t < 4; t++) {
    const rotated = rotate(cells, t);
    const key = cellsKey(rotated);
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ rotation: t, cells: rotated });
    }
  }
  return result;
}

export function isChiral(cells) {
  return canonicalKey(mirror(cells)) !== canonicalKey(cells);
}

export function dimensions(cells) {
  if (!cells || cells.length === 0) return { width: 0, height: 0 };
  let maxX = -Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let minY = Infinity;
  for (const [x, y] of cells) {
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }
  return { width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** 4-connectivity check via flood fill. */
export function isConnected(cells) {
  if (!cells || cells.length === 0) return false;
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  const stack = [cells[0]];
  const seen = new Set([`${cells[0][0]},${cells[0][1]}`]);
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${x + dx},${y + dy}`;
      if (set.has(key) && !seen.has(key)) {
        seen.add(key);
        stack.push([x + dx, y + dy]);
      }
    }
  }
  return seen.size === set.size;
}

/** Structural validity: non-empty, integer coordinates, no duplicates, connected. */
export function isValidPieceCells(cells) {
  if (!Array.isArray(cells) || cells.length === 0) return false;
  const seen = new Set();
  for (const cell of cells) {
    if (!Array.isArray(cell) || cell.length !== 2) return false;
    const [x, y] = cell;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
    const key = `${x},${y}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return isConnected(cells);
}

/** Cells of a piece in a given rotation, translated to an absolute board anchor. */
export function placedCells(baseCells, rotation, x, y) {
  return translate(rotate(baseCells, rotation), x, y);
}
