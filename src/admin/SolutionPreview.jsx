import PieceShape from '../components/PieceShape.jsx';
import { rotate } from '../engine/piece.js';

/** Read-only render of a level's stored solution plus its decoys. */
export default function SolutionPreview({ level, cellSize = 28 }) {
  if (!level?.pieces?.length || !level.solution?.length) {
    return <p className="muted">Generate a puzzle to see its solution.</p>;
  }
  const byId = Object.fromEntries(level.pieces.map((p) => [p.id, p]));
  const solutionIds = new Set(level.solution.map((s) => s.pieceId));
  const decoys = level.pieces.filter((p) => !solutionIds.has(p.id));

  return (
    <div className="solution-preview">
      <div>
        <h4>Solution ({level.solution.length} pieces)</h4>
        <div className="board-frame board-frame-small">
          <div className="board" style={{ width: level.width * cellSize, height: level.height * cellSize, '--cell': `${cellSize}px`, '--cols': level.width }}>
            <div className="board-cells" aria-hidden="true">
              {Array.from({ length: level.width * level.height }, (_, i) => (
                <div key={i} className="board-cell" />
              ))}
            </div>
            {level.solution.map((s) => {
              const piece = byId[s.pieceId];
              if (!piece) return null;
              return (
                <PieceShape
                  key={s.pieceId}
                  cells={rotate(piece.cells, s.rotation)}
                  cellSize={cellSize}
                  color={piece.color}
                  title={`Piece ${s.pieceId.replace('p', '')}`}
                  style={{ position: 'absolute', left: s.x * cellSize, top: s.y * cellSize }}
                />
              );
            })}
          </div>
        </div>
      </div>
      <div>
        <h4>Decoys ({decoys.length})</h4>
        <ul className="decoy-list">
          {decoys.map((p) => (
            <li key={p.id} title={`Piece ${p.id.replace('p', '')}`}>
              <PieceShape cells={p.cells} cellSize={14} color={p.color} />
              <span>#{p.id.replace('p', '')}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
