import { memo } from 'react';
import PieceShape from './PieceShape.jsx';

function cellFromEvent(e, el, cellSize, width, height) {
  const rect = el.getBoundingClientRect();
  const col = Math.floor((e.clientX - rect.left) / cellSize);
  const row = Math.floor((e.clientY - rect.top) / cellSize);
  if (col < 0 || row < 0 || col >= width || row >= height) return null;
  return { col, row };
}

/**
 * The puzzle box. Pieces are absolutely positioned buttons; only their
 * painted cells receive pointer events so overlapping bounding boxes never
 * steal clicks from neighbours.
 */
function Board({
  boardRef,
  width,
  height,
  cellSize,
  pieces,
  selectedId,
  draggingId,
  preview,
  hint,
  cursor,
  showCursor,
  animation,
  solved,
  labelFor,
  onPiecePointerDown,
  onPieceClick,
  onCellClick,
  onHoverCell,
  onKeyDown,
  onFocusChange,
  describedBy,
}) {
  const cells = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) cells.push(<div key={`${x},${y}`} className="board-cell" />);
  }

  return (
    <div className={`board-frame${solved ? ' is-solved' : ''}`}>
      <div
        ref={boardRef}
        className="board"
        style={{ width: width * cellSize, height: height * cellSize, '--cell': `${cellSize}px`, '--cols': width }}
        tabIndex={0}
        role="application"
        aria-roledescription="puzzle board"
        aria-label={`Puzzle box, ${width} by ${height}. Use arrow keys to move the cursor and Enter to place the selected piece.`}
        aria-describedby={describedBy}
        onClick={(e) => {
          const cell = cellFromEvent(e, e.currentTarget, cellSize, width, height);
          if (cell) onCellClick(cell.col, cell.row);
        }}
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse') return;
          const cell = cellFromEvent(e, e.currentTarget, cellSize, width, height);
          onHoverCell(cell);
        }}
        onPointerLeave={() => onHoverCell(null)}
        onKeyDown={onKeyDown}
        onFocus={(e) => e.target === e.currentTarget && onFocusChange(true)}
        onBlur={(e) => e.target === e.currentTarget && onFocusChange(false)}
      >
        <div className="board-cells" aria-hidden="true">
          {cells}
        </div>

        {hint ? (
          <div className={`board-hint board-hint-${hint.type}`} key={hint.seq} aria-hidden="true">
            {hint.cells.map(([x, y]) => (
              <span key={`${x},${y}`} className="hint-cell" style={{ left: x * cellSize, top: y * cellSize }} />
            ))}
          </div>
        ) : null}

        {pieces.map((p) => {
          const isSelected = p.id === selectedId;
          const anim = animation && animation.pieceId === p.id ? `anim-${animation.type}` : '';
          return (
            <button
              key={p.id}
              type="button"
              className={`board-piece${isSelected ? ' is-selected' : ''}${p.id === draggingId ? ' is-dragging' : ''} ${anim}`}
              data-anim={animation && animation.pieceId === p.id ? animation.seq : undefined}
              style={{ left: p.x * cellSize, top: p.y * cellSize }}
              aria-pressed={isSelected}
              aria-label={labelFor(p)}
              onClick={(e) => {
                e.stopPropagation();
                onPieceClick(p.id);
              }}
            >
              <PieceShape cells={p.shape} cellSize={cellSize} color={p.color} onPointerDown={(e) => onPiecePointerDown(e, p.id, 'board')} />
            </button>
          );
        })}

        {preview ? (
          <div className={`board-preview ${preview.valid ? 'is-valid' : 'is-invalid'}`} aria-hidden="true">
            {preview.valid ? (
              <PieceShape
                cells={preview.shape}
                cellSize={cellSize}
                color={preview.color}
                style={{ position: 'absolute', left: preview.x * cellSize, top: preview.y * cellSize }}
              />
            ) : (
              preview.shape.map(([x, y]) => (
                <span
                  key={`${x},${y}`}
                  className="preview-cell"
                  style={{ left: (preview.x + x) * cellSize, top: (preview.y + y) * cellSize }}
                />
              ))
            )}
          </div>
        ) : null}

        {showCursor && cursor ? (
          <span className="board-cursor" aria-hidden="true" style={{ left: cursor.x * cellSize, top: cursor.y * cellSize }} />
        ) : null}
      </div>
    </div>
  );
}

export default memo(Board);
