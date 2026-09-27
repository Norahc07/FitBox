import { memo, useEffect, useRef } from 'react';
import PieceShape from './PieceShape.jsx';

/** Available (unplaced) pieces. Buttons for tap/keyboard; SVG handles drag start. */
function PieceTray({ pieces, selectedId, draggingId, hintPieceId, cellSize, onSelect, onPointerDown, animation }) {
  const listRef = useRef(null);

  // Keep the selected piece visible, e.g. when a hint selects one scrolled out of view.
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-piece-id="${selectedId}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [selectedId, hintPieceId]);

  if (pieces.length === 0) {
    return <p className="tray-empty">All pieces are on the board.</p>;
  }
  return (
    <ul className="tray-list" aria-label="Available pieces" ref={listRef}>
      {pieces.map((p) => {
        const selected = p.id === selectedId;
        const anim = animation && animation.pieceId === p.id ? `anim-${animation.type}` : '';
        return (
          <li key={p.id} className="tray-item">
            <button
              type="button"
              data-piece-id={p.id}
              className={`tray-piece${selected ? ' is-selected' : ''}${p.id === draggingId ? ' is-dragging' : ''}${
                p.id === hintPieceId ? ' is-hinted' : ''
              } ${anim}`}
              aria-pressed={selected}
              aria-label={`Piece ${p.label}, ${p.shape.length} ${p.shape.length === 1 ? 'cell' : 'cells'}${selected ? ', selected' : ''}`}
              onClick={() => onSelect(p.id)}
            >
              <PieceShape cells={p.shape} cellSize={cellSize} color={p.color} onPointerDown={(e) => onPointerDown(e, p.id, 'tray')} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default memo(PieceTray);
