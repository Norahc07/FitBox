import { createRng } from './rng.js';
import {
  canonicalKey,
  dimensions,
  isChiral,
  isConnected,
  mirror,
  normalize,
  rotate,
  cellsKey,
  uniqueRotations,
} from './piece.js';
import { shapesOfSize, SHAPES } from './shapes.js';
import { getProfile } from './difficulty.js';
import { validateSolution } from './solution.js';

// Brand shades (Fenix orange, warm tints, neutral grays, white), alternating light/dark for contrast.
export const PIECE_PALETTE = [
  '#f26b1d', '#e4e4e7', '#ffb27a', '#8a8a8f', '#c2410c', '#fff1e6',
  '#f59e0b', '#b8b8bd', '#fb8c4a', '#ffffff', '#d9560f', '#ffd2ad',
];

const MAX_ATTEMPTS = 400;
const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Decide the size of every solution piece.
 *
 * With R pieces tiling an area A, each piece has one "base" cell and the
 * remaining A − R cells are an extra budget spread across pieces. We choose
 * how many pieces get extra cells (the rest are single squares, capped by the
 * difficulty's maxMonos), then hand out the budget one cell at a time.
 * `lumpiness` makes pieces that are already large more likely to grow, which
 * produces a few complex shapes instead of many dominoes.
 */
export function planPieceSizes(area, required, profile, rng) {
  const budget = area - required;
  if (budget < 0) throw new Error('More pieces than board cells.');
  const maxExtra = profile.maxSize - 1;
  const minK = Math.ceil(budget / maxExtra);
  const maxK = Math.min(required, budget);
  if (minK > maxK) throw new Error('Board cannot be tiled with the requested number of pieces.');

  if (required - profile.maxMonos > maxK) throw new Error('Too many pieces for this board without extra single squares.');
  const monos = rng.int(0, profile.maxMonos);
  const k = Math.min(maxK, Math.max(minK, required - monos));
  const extras = new Array(k).fill(1);
  let remaining = budget - k;
  while (remaining > 0) {
    const entries = extras.map((e, i) => [i, e < maxExtra ? Math.pow(e, profile.lumpiness) : 0]);
    const i = rng.weighted(entries);
    extras[i] += 1;
    remaining -= 1;
  }
  const sizes = extras.map((e) => e + 1);
  for (let i = k; i < required; i++) sizes.push(1);
  return sizes.sort((a, b) => b - a);
}

function freeComponents(width, height, grid) {
  const seen = new Uint8Array(width * height);
  const components = [];
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] !== null || seen[i]) continue;
    let size = 0;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const c = stack.pop();
      size++;
      const x = c % width;
      const y = Math.floor(c / width);
      for (const [dx, dy] of NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
        if (grid[n] === null && !seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    components.push(size);
  }
  return components;
}

/**
 * Cheap necessary conditions that the remaining pieces can still fill the
 * free space. Anything that slips through is caught by the retry loop.
 */
function stillFeasible(width, height, grid, remainingSizes) {
  const components = freeComponents(width, height, grid);
  const monos = remainingSizes.filter((s) => s === 1).length;
  const singles = components.filter((c) => c === 1).length;
  if (singles > monos) return false;
  const largestPiece = remainingSizes.length ? Math.max(...remainingSizes) : 0;
  const largestComponent = components.length ? Math.max(...components) : 0;
  if (largestPiece > 1 && largestComponent < largestPiece) return false;
  // Components smaller than every non-mono piece must be filled by monos alone.
  const nonMono = remainingSizes.filter((s) => s > 1);
  const smallestNonMono = nonMono.length ? Math.min(...nonMono) : Infinity;
  const monoOnlyCells = components.filter((c) => c < smallestNonMono).reduce((a, b) => a + b, 0);
  return monoOnlyCells <= monos;
}

/** Edges of the candidate touching walls or occupied cells — favors tight packing. */
function contactScore(width, height, grid, cells) {
  const own = new Set(cells.map(([x, y]) => `${x},${y}`));
  let score = 0;
  for (const [x, y] of cells) {
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (own.has(`${nx},${ny}`)) continue;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) score += 1;
      else if (grid[ny * width + nx] !== null) score += 1;
    }
  }
  return score;
}

function pickShape(size, profile, rng) {
  const options = shapesOfSize(size, profile.maxTier);
  if (options.length === 0) return null;
  return rng.weighted(
    options.map((s) => {
      let w = profile.tierWeights[s.tier] ?? 0.2;
      // Hard puzzles lean on chiral pieces so mirror-image decoys are convincing.
      if (profile.maxTier >= 3 && isChiral(s.cells)) w *= 1.5;
      return [s, w];
    }),
  );
}

/** Place one large piece somewhere tight that keeps the board fillable. */
function placeLargePiece(width, height, grid, shape, remainingAfter, rng) {
  const candidates = [];
  for (const { rotation, cells } of uniqueRotations(shape.cells)) {
    const { width: w, height: h } = dimensions(cells);
    for (let y = 0; y <= height - h; y++) {
      for (let x = 0; x <= width - w; x++) {
        const abs = cells.map(([cx, cy]) => [cx + x, cy + y]);
        if (abs.some(([ax, ay]) => grid[ay * width + ax] !== null)) continue;
        candidates.push({ rotation, x, y, abs, score: contactScore(width, height, grid, abs) + rng.next() * 2.5 });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  for (const c of candidates.slice(0, 12)) {
    for (const [ax, ay] of c.abs) grid[ay * width + ax] = 'x';
    if (stillFeasible(width, height, grid, remainingAfter)) return c;
    for (const [ax, ay] of c.abs) grid[ay * width + ax] = null;
  }
  return null;
}

function freeNeighbors(width, height, grid, x, y) {
  const result = [];
  for (const [dx, dy] of NEIGHBORS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    if (grid[ny * width + nx] === null) result.push([nx, ny]);
  }
  return result;
}

/**
 * Greedy domino matching on the leftover cells: always pair the most
 * constrained cell (fewest free neighbours) first so we rarely strand cells.
 */
function placeDominoes(width, height, grid, count, rng) {
  const placements = [];
  for (let n = 0; n < count; n++) {
    let best = null;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y * width + x] !== null) continue;
        const nbrs = freeNeighbors(width, height, grid, x, y);
        if (nbrs.length === 0) continue;
        const score = nbrs.length + rng.next() * 0.9;
        if (!best || score < best.score) best = { x, y, nbrs, score };
      }
    }
    if (!best) return null;
    let partner = null;
    for (const [nx, ny] of best.nbrs) {
      const score = freeNeighbors(width, height, grid, nx, ny).length + rng.next() * 0.9;
      if (!partner || score < partner.score) partner = { x: nx, y: ny, score };
    }
    const abs = [[best.x, best.y], [partner.x, partner.y]];
    for (const [ax, ay] of abs) grid[ay * width + ax] = 'x';
    placements.push(abs);
  }
  return placements;
}

/** Try one full partition of the board into pieces of the planned sizes. */
function tryPartition(width, height, sizes, profile, rng) {
  const grid = new Array(width * height).fill(null);
  const items = [];
  const large = sizes.filter((s) => s >= 3);
  const dominoCount = sizes.filter((s) => s === 2).length;

  for (let i = 0; i < large.length; i++) {
    const shape = pickShape(large[i], profile, rng);
    if (!shape) return null;
    const remainingAfter = sizes.slice(i + 1);
    const placed = placeLargePiece(width, height, grid, shape, remainingAfter, rng);
    if (!placed) return null;
    items.push({ base: shape.cells, rotation: placed.rotation, x: placed.x, y: placed.y, abs: placed.abs, shapeKey: shape.key });
  }

  const dominoes = placeDominoes(width, height, grid, dominoCount, rng);
  if (!dominoes) return null;
  for (const abs of dominoes) {
    const horizontal = abs[0][1] === abs[1][1];
    const x = Math.min(abs[0][0], abs[1][0]);
    const y = Math.min(abs[0][1], abs[1][1]);
    items.push({ base: [[0, 0], [1, 0]], rotation: horizontal ? 0 : 1, x, y, abs, shapeKey: 'domino' });
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y * width + x] === null) {
        grid[y * width + x] = 'x';
        items.push({ base: [[0, 0]], rotation: 0, x, y, abs: [[x, y]], shapeKey: 'mono' });
      }
    }
  }
  return items.length === sizes.length ? items : null;
}

function growShape(cells, rng) {
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  const options = [];
  for (const [x, y] of cells) {
    for (const [dx, dy] of NEIGHBORS) {
      const key = `${x + dx},${y + dy}`;
      if (!set.has(key)) options.push([x + dx, y + dy]);
    }
  }
  return normalize([...cells, rng.pick(options)]);
}

function shrinkShape(cells, rng) {
  const order = rng.shuffle(cells.map((_, i) => i));
  for (const i of order) {
    const rest = cells.filter((_, j) => j !== i);
    if (isConnected(rest)) return normalize(rest);
  }
  return null;
}

/**
 * Decoys are pieces that are NOT part of the stored solution:
 *  - mirror: the mirror image of a chiral solution piece (cannot be matched by rotating)
 *  - grow:   a solution piece with one extra cell
 *  - shrink: a solution piece with one cell removed
 *  - random: an unrelated library shape
 * A decoy never has the same rotation-invariant shape as a solution piece,
 * otherwise it would simply be an interchangeable duplicate.
 */
export function generateDecoys(count, solutionShapes, profile, rng, width, height) {
  const forbidden = new Set(solutionShapes.map((c) => canonicalKey(c)));
  const used = new Set();
  const decoys = [];
  const chiral = solutionShapes.filter((c) => c.length >= 3 && isChiral(c));
  const growable = solutionShapes.filter((c) => c.length >= 2 && c.length <= 5);
  const shrinkable = solutionShapes.filter((c) => c.length >= 4);
  const randomPool = SHAPES.filter((s) => s.size >= 3 && s.size <= Math.min(6, profile.maxSize + 1) && s.tier <= profile.randomDecoyMaxTier);

  let guard = 0;
  while (decoys.length < count && guard < 4000) {
    guard++;
    const strategy = rng.weighted(profile.decoyStrategies);
    let cells = null;
    if (strategy === 'mirror' && chiral.length) cells = mirror(rng.pick(chiral));
    else if (strategy === 'grow' && growable.length) cells = growShape(rng.pick(growable), rng);
    else if (strategy === 'shrink' && shrinkable.length) cells = shrinkShape(rng.pick(shrinkable), rng);
    else if (strategy === 'random' || guard > 200) cells = rng.pick(randomPool).cells;
    if (!cells) continue;

    cells = normalize(cells);
    const key = canonicalKey(cells);
    if (forbidden.has(key)) continue;
    if (used.has(key) && guard < 3000) continue;
    const { width: w, height: h } = dimensions(cells);
    const fits = (w <= width && h <= height) || (h <= width && w <= height);
    if (!fits) continue;
    used.add(key);
    decoys.push(cells);
  }
  if (decoys.length < count) throw new Error('Could not generate enough decoys.');
  return decoys;
}

function chooseInitialRotation(baseCells, solutionRotation, profile, rng) {
  const orientations = uniqueRotations(baseCells);
  if (orientations.length === 1) return 0;
  if (solutionRotation !== null && rng.next() < profile.keepSolutionRotation) return solutionRotation;
  if (solutionRotation === null) return rng.int(0, 3);
  // Otherwise start in an orientation that differs from the solved one.
  const solvedKey = cellsKey(rotate(baseCells, solutionRotation));
  const others = [0, 1, 2, 3].filter((t) => cellsKey(rotate(baseCells, t)) !== solvedKey);
  return rng.pick(others);
}

/**
 * Generate a puzzle with a known valid solution.
 *
 * 1. Plan solution piece sizes that sum to the board area.
 * 2. Partition the rectangular board into those pieces (large shapes first,
 *    then dominoes, then single squares) — this IS the solution.
 * 3. Store exact solution coordinates.
 * 4. Generate decoys that look plausible but are not in the solution.
 * 5. Shuffle all pieces and assign neutral ids/colours.
 * 6. Validate the tiling; retry deterministically if anything is off.
 */
export function generatePuzzle({ width, height, requiredPieces, totalPieces, difficulty, seed }) {
  const profile = getProfile(difficulty);
  const rng = createRng(seed);
  const area = width * height;
  if (totalPieces <= requiredPieces) throw new Error('A puzzle needs at least one decoy piece.');

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const sizes = planPieceSizes(area, requiredPieces, profile, rng);
    const items = tryPartition(width, height, sizes, profile, rng);
    if (!items) continue;

    const solutionShapes = items.map((it) => it.base);
    let decoys;
    try {
      decoys = generateDecoys(totalPieces - requiredPieces, solutionShapes, profile, rng, width, height);
    } catch {
      continue;
    }

    const all = [
      ...items.map((it) => ({ cells: it.base, solution: it })),
      ...decoys.map((cells) => ({ cells, solution: null })),
    ];
    const shuffled = rng.shuffle(all);

    const pieces = shuffled.map((item, i) => ({
      id: `p${i + 1}`,
      cells: item.cells,
      initialRotation: chooseInitialRotation(item.cells, item.solution ? item.solution.rotation : null, profile, rng),
      color: PIECE_PALETTE[i % PIECE_PALETTE.length],
    }));

    const solution = shuffled
      .map((item, i) =>
        item.solution
          ? {
              pieceId: `p${i + 1}`,
              x: item.solution.x,
              y: item.solution.y,
              rotation: item.solution.rotation,
              cells: item.solution.abs.map(([x, y]) => [x, y]).sort((a, b) => a[1] - b[1] || a[0] - b[0]),
            }
          : null,
      )
      .filter(Boolean)
      .sort((a, b) => a.y - b.y || a.x - b.x);

    const check = validateSolution({ width, height, pieces, solution });
    if (!check.valid || solution.length !== requiredPieces) continue;

    return { pieces, solution, attempts: attempt };
  }
  throw new Error(`Failed to generate a valid ${width}x${height} puzzle for seed ${seed}.`);
}

/** Build a complete level object from a level configuration. */
export function generateLevel(config) {
  const {
    number,
    difficulty,
    width,
    height,
    totalPieces,
    requiredPieces,
    seed,
    hints,
    timeLimit = null,
    version = 1,
    published = true,
  } = config;
  const { pieces, solution } = generatePuzzle({ width, height, requiredPieces, totalPieces, difficulty, seed });
  return {
    id: config.id ?? `level-${String(number).padStart(2, '0')}`,
    number,
    version,
    difficulty,
    width,
    height,
    totalPieces,
    requiredPieces,
    timeLimit,
    hints: hints ?? getProfile(difficulty).defaultHints,
    seed,
    published,
    pieces,
    solution,
  };
}
