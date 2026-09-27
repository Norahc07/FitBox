import { useCallback, useEffect, useRef, useState } from 'react';
import { dimensions } from '../engine/piece.js';

const DRAG_THRESHOLD = 6;

/** Swallow the click that browsers fire after a drag so it doesn't also select/place. */
function suppressNextClick() {
  const stop = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener('click', stop, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 60);
}

/**
 * Pointer-event drag and drop shared by mouse, touch and pen.
 *
 * The grab point is stored as a fraction of the piece's bounding box so a
 * piece picked up from the (smaller) tray keeps the same relative grip when
 * rendered at board scale. On touch the ghost is lifted above the finger so
 * the player can see where it will land. The snapped board anchor is the
 * rounded position of the ghost's top-left corner in cell units, then
 * resolved through the level's snap tolerance.
 */
export function useDragController({ boardRef, cellSize, getShape, resolveDrop, onDragStart, onDrop, onDropOffBoard }) {
  const [drag, setDrag] = useState(null);
  const session = useRef(null);
  const latest = useRef({});
  latest.current = { cellSize, getShape, resolveDrop, onDragStart, onDrop, onDropOffBoard };

  const compute = useCallback(
    (ev) => {
      const s = session.current;
      const { cellSize: cs, getShape: shapeOf, resolveDrop: resolve } = latest.current;
      const shape = shapeOf(s.pieceId);
      const { width, height } = dimensions(shape);
      const w = width * cs;
      const h = height * cs;
      const lift = s.pointerType === 'touch' ? Math.max(28, cs * 0.9) : 0;
      const left = ev.clientX - s.fx * w;
      const top = ev.clientY - s.fy * h - lift;

      let preview = null;
      const board = boardRef.current;
      if (board) {
        const rect = board.getBoundingClientRect();
        const cx = left + w / 2;
        const cy = top + h / 2;
        const margin = cs * 0.6;
        const over = cx > rect.left - margin && cx < rect.right + margin && cy > rect.top - margin && cy < rect.bottom + margin;
        if (over) {
          const col = Math.round((left - rect.left) / cs);
          const row = Math.round((top - rect.top) / cs);
          const spot = resolve(s.pieceId, col, row);
          preview = spot ? { x: spot.x, y: spot.y, valid: true } : { x: col, y: row, valid: false };
        }
      }
      s.preview = preview;
      setDrag({ pieceId: s.pieceId, source: s.source, left, top, shape, cellSize: cs, preview });
    },
    [boardRef],
  );

  const cleanup = useRef(() => {});

  const begin = useCallback(
    (e, pieceId, source) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (session.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      session.current = {
        pieceId,
        source,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        startX: e.clientX,
        startY: e.clientY,
        fx: rect.width ? (e.clientX - rect.left) / rect.width : 0.5,
        fy: rect.height ? (e.clientY - rect.top) / rect.height : 0.5,
        started: false,
        preview: null,
      };

      const move = (ev) => {
        const s = session.current;
        if (!s || ev.pointerId !== s.pointerId) return;
        if (!s.started) {
          if (Math.hypot(ev.clientX - s.startX, ev.clientY - s.startY) < DRAG_THRESHOLD) return;
          s.started = true;
          latest.current.onDragStart?.(s.pieceId, s.source);
        }
        if (ev.cancelable) ev.preventDefault();
        compute(ev);
      };

      const up = (ev) => {
        const s = session.current;
        if (!s || ev.pointerId !== s.pointerId) return;
        cleanup.current();
        session.current = null;
        setDrag(null);
        if (!s.started) return;
        suppressNextClick();
        if (s.preview) latest.current.onDrop(s.pieceId, s.preview.x, s.preview.y, s.preview.valid);
        else if (s.source === 'board') latest.current.onDropOffBoard(s.pieceId);
      };

      const cancel = (ev) => {
        const s = session.current;
        if (!s || ev.pointerId !== s.pointerId) return;
        cleanup.current();
        session.current = null;
        setDrag(null);
      };

      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
      cleanup.current = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
      };
    },
    [compute],
  );

  useEffect(() => () => cleanup.current(), []);

  return { drag, beginDrag: begin };
}
