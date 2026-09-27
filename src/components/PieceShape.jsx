import { memo, useMemo } from 'react';
import { dimensions } from '../engine/piece.js';

/**
 * Renders a polyomino as one solid shape: cells that touch are fused (no gap
 * or rounded corner on shared edges), with faint seams so cells can still be
 * counted. Used by the board, tray, drag ghost and admin previews.
 */
function buildGeometry(cells, cs) {
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  const inset = Math.max(1, cs * 0.06);
  const radius = cs * 0.18;
  const paths = [];
  const seams = [];

  for (const [x, y] of cells) {
    const l = set.has(`${x - 1},${y}`);
    const r = set.has(`${x + 1},${y}`);
    const t = set.has(`${x},${y - 1}`);
    const b = set.has(`${x},${y + 1}`);
    // Overlap shared edges by half a pixel so anti-aliasing leaves no hairline.
    const x0 = x * cs + (l ? -0.5 : inset);
    const y0 = y * cs + (t ? -0.5 : inset);
    const x1 = (x + 1) * cs + (r ? 0.5 : -inset);
    const y1 = (y + 1) * cs + (b ? 0.5 : -inset);
    const tl = !l && !t ? radius : 0;
    const tr = !r && !t ? radius : 0;
    const br = !r && !b ? radius : 0;
    const bl = !l && !b ? radius : 0;
    paths.push(
      `M${x0 + tl},${y0}H${x1 - tr}${tr ? `Q${x1},${y0} ${x1},${y0 + tr}` : ''}` +
        `V${y1 - br}${br ? `Q${x1},${y1} ${x1 - br},${y1}` : ''}` +
        `H${x0 + bl}${bl ? `Q${x0},${y1} ${x0},${y1 - bl}` : ''}` +
        `V${y0 + tl}${tl ? `Q${x0},${y0} ${x0 + tl},${y0}` : ''}Z`,
    );
    const pad = cs * 0.22;
    if (r) seams.push(`M${(x + 1) * cs},${y * cs + pad}V${(y + 1) * cs - pad}`);
    if (b) seams.push(`M${x * cs + pad},${(y + 1) * cs}H${(x + 1) * cs - pad}`);
  }
  return { d: paths.join(''), seams: seams.join('') };
}

function PieceShape({ cells, cellSize, color, className = '', style, title, ...rest }) {
  const { width, height } = dimensions(cells);
  const { d, seams } = useMemo(() => buildGeometry(cells, cellSize), [cells, cellSize]);
  const w = width * cellSize;
  const h = height * cellSize;
  return (
    <svg
      className={`piece-shape ${className}`}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ '--piece-color': color, ...style }}
      aria-hidden={title ? undefined : 'true'}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path className="piece-body" d={d} fill={color} />
      <path className="piece-sheen" d={d} fill="url(#fb-sheen)" />
      {seams ? <path className="piece-seams" d={seams} /> : null}
    </svg>
  );
}

export default memo(PieceShape);

/** Shared SVG gradient definitions, rendered once at the app root. */
export function PieceDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="fb-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#000" stopOpacity="0.18" />
        </linearGradient>
      </defs>
    </svg>
  );
}
