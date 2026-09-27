import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Board from '../components/Board.jsx';
import PieceTray from '../components/PieceTray.jsx';
import PieceShape from '../components/PieceShape.jsx';
import GameHud from '../components/GameHud.jsx';
import GameControls from '../components/GameControls.jsx';
import CompletionModal from '../components/CompletionModal.jsx';
import Modal from '../components/Modal.jsx';
import { BackIcon, PauseIcon, PlayIcon } from '../components/Icons.jsx';
import { centeredAnchor, createGameState, makeGameReducer, pieceShape, placedPieces, resolvePlacement, snapshotForSave } from './gameReducer.js';
import { useDragController } from './useDragController.js';
import { useElementSize, useViewportHeight } from '../hooks/useElementSize.js';
import { calculateScore } from '../engine/scoring.js';
import { getProfile } from '../engine/difficulty.js';
import { feedback, setMusicPlaying } from '../services/feedback.js';
import { capitalize } from '../utils/format.js';

const HINT_DURATION_MS = 6000;
const ANIMATION_MS = 450;
const CELEBRATION_DELAY_MS = 700;
const BOARD_FRAME_PX = 24;

function pieceLabel(id) {
  return id.replace(/^p/, '');
}

/**
 * Full gameplay screen. Used for normal play and for admin "Test Puzzle"
 * (mode="test"), where nothing is persisted.
 */
export default function GameScreen({
  level,
  mode = 'play',
  settings,
  savedState = null,
  hasNext = false,
  onComplete,
  onPersist,
  onClearPersist,
  onNext,
  onExit,
  exitLabel = 'Back to levels',
}) {
  const reducer = useMemo(() => makeGameReducer(level), [level]);
  const [state, dispatch] = useReducer(reducer, null, () => createGameState(level, savedState));
  const profile = getProfile(level.difficulty);
  const tolerance = settings.placementAssist ? profile.tolerance : 'none';

  const boardRef = useRef(null);
  const stageRef = useRef(null);
  const boardAreaRef = useRef(null);
  const stage = useElementSize(stageRef);
  const boardArea = useElementSize(boardAreaRef);
  const viewportHeight = useViewportHeight();
  const shortLandscape = stage.width >= 560 && stage.width > viewportHeight * 1.15 && viewportHeight < 620;
  const isWide = stage.width >= 880 || shortLandscape;

  const [hoverCell, setHoverCell] = useState(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [boardFocused, setBoardFocused] = useState(false);
  const [animation, setAnimation] = useState(null);
  const [toast, setToast] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [result, setResult] = useState(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const completedSeq = useRef(null);

  // The screen never scrolls: the tray takes a fixed number of rows for the
  // viewport height, and the board fills whatever space is left.
  const maxDim = Math.max(level.width, level.height);
  const trayRows = viewportHeight >= 780 ? 2 : 1;
  const trayCellSize = isWide ? (viewportHeight < 560 ? 14 : 18) : viewportHeight < 640 ? 11 : viewportHeight < 780 ? 13 : 15;
  const fit = Math.floor(Math.min(boardArea.width - BOARD_FRAME_PX, boardArea.height - BOARD_FRAME_PX) / maxDim);
  const cellSize = Math.max(16, Math.min(88, fit > 0 ? fit : 40));

  const placed = useMemo(
    () =>
      placedPieces(state).map((p) => ({
        ...p,
        shape: pieceShape(state, p.id),
        color: state.pieces[p.id].color,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.pieces, state.placements],
  );

  const trayPieces = useMemo(
    () =>
      state.order
        .filter((id) => !state.placements[id])
        .map((id) => ({ id, label: pieceLabel(id), shape: pieceShape(state, id), color: state.pieces[id].color })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.order, state.pieces, state.placements],
  );

  const playing = state.status === 'playing';

  /* ---------- Drag and drop ---------- */

  const getShape = useCallback((id) => pieceShape(state, id), [state]);
  const resolveDrop = useCallback((id, x, y) => resolvePlacement(state, level, id, x, y, tolerance), [state, level, tolerance]);

  const { drag, beginDrag } = useDragController({
    boardRef,
    cellSize,
    getShape,
    resolveDrop,
    onDragStart: (id) => {
      dispatch({ type: 'SELECT', id });
      feedback('pick');
    },
    onDrop: (id, x, y) => dispatch({ type: 'PLACE', id, x, y, tolerance }),
    onDropOffBoard: (id) => dispatch({ type: 'REMOVE', id }),
  });

  const onPiecePointerDown = useCallback(
    (e, id, source) => {
      if (state.status !== 'playing') return;
      beginDrag(e, id, source);
    },
    [beginDrag, state.status],
  );

  /* ---------- Tap / click / keyboard placement ---------- */

  const placeSelectedAt = useCallback(
    (col, row) => {
      if (!state.selectedId) return;
      const { x, y } = centeredAnchor(state, state.selectedId, col, row);
      dispatch({ type: 'PLACE', id: state.selectedId, x, y, tolerance });
    },
    [state, tolerance],
  );

  const onCellClick = useCallback(
    (col, row) => {
      setCursor({ x: col, y: row });
      if (state.selectedId) placeSelectedAt(col, row);
    },
    [placeSelectedAt, state.selectedId],
  );

  const selectPiece = useCallback((id) => {
    feedback('select');
    dispatch({ type: 'SELECT', id, toggle: true });
  }, []);
  const onPieceClick = selectPiece;
  const onTraySelect = selectPiece;

  const onBoardKeyDown = useCallback(
    (e) => {
      const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      if (moves[e.key]) {
        e.preventDefault();
        const [dx, dy] = moves[e.key];
        setCursor((c) => ({
          x: Math.max(0, Math.min(level.width - 1, c.x + dx)),
          y: Math.max(0, Math.min(level.height - 1, c.y + dy)),
        }));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (state.selectedId) placeSelectedAt(cursor.x, cursor.y);
        else {
          const occupant = placed.find((p) => p.cells.some(([x, y]) => x === cursor.x && y === cursor.y));
          if (occupant) dispatch({ type: 'SELECT', id: occupant.id });
        }
      }
    },
    [cursor, level.height, level.width, placeSelectedAt, placed, state.selectedId],
  );

  // Global shortcuts: R / E rotate, Delete / Backspace remove, Space hint, Esc deselect.
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      if (document.querySelector('.modal-backdrop')) return;
      const key = e.key.toLowerCase();
      if (key === 'r') dispatch({ type: 'ROTATE', dir: 1, tolerance });
      else if (key === 'e') dispatch({ type: 'ROTATE', dir: -1, tolerance });
      else if (key === 'delete' || key === 'backspace') {
        e.preventDefault();
        dispatch({ type: 'REMOVE' });
      } else if (key === ' ') {
        e.preventDefault();
        dispatch({ type: 'HINT' });
      } else if (key === 'escape') dispatch({ type: 'SELECT', id: null });
      else if (key === 'p') dispatch({ type: state.status === 'paused' ? 'RESUME' : 'PAUSE' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tolerance, state.status]);

  /* ---------- Timer ---------- */

  useEffect(() => {
    if (!playing) return undefined;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      dispatch({ type: 'TICK', delta: now - last });
      last = now;
    }, 250);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => {
    feedback('start');
    return () => setMusicPlaying(false);
  }, []);

  useEffect(() => {
    setMusicPlaying(playing);
  }, [playing]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') dispatch({ type: 'PAUSE' });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  /* ---------- Events → feedback, animation, announcements ---------- */

  useEffect(() => {
    const ev = state.event;
    if (!ev) return undefined;
    let timer;
    const flash = (type) => {
      setAnimation({ pieceId: ev.pieceId, type, seq: ev.seq });
      timer = setTimeout(() => setAnimation((a) => (a && a.seq === ev.seq ? null : a)), ANIMATION_MS);
    };
    switch (ev.type) {
      case 'place':
        feedback('place');
        flash('place');
        setAnnouncement(`Piece ${pieceLabel(ev.pieceId)} placed.`);
        break;
      case 'invalid':
        feedback('invalid');
        flash('shake');
        setToast({ message: 'That piece does not fit there.', tone: 'warn', seq: ev.seq });
        setAnnouncement('Invalid placement.');
        break;
      case 'rotate':
        feedback('rotate');
        break;
      case 'blocked':
        feedback('invalid');
        flash('shake');
        setToast({ message: 'No room to rotate here.', tone: 'warn', seq: ev.seq });
        break;
      case 'remove':
        feedback('remove');
        setAnnouncement(`Piece ${pieceLabel(ev.pieceId)} returned to the tray.`);
        break;
      case 'hint':
        feedback('hint');
        setToast({
          message:
            ev.hintType === 'place'
              ? `Hint: piece ${pieceLabel(ev.pieceId)} belongs in the highlighted spot.`
              : `Hint: piece ${pieceLabel(ev.pieceId)} is blocking the solution.`,
          tone: 'info',
          seq: ev.seq,
        });
        setAnnouncement('Hint shown.');
        break;
      case 'notice':
        setToast({ message: ev.message, tone: 'info', seq: ev.seq });
        break;
      case 'complete':
        feedback('complete');
        setAnnouncement('Puzzle complete!');
        break;
      case 'timeout':
        feedback('invalid');
        setAnnouncement("Time's up.");
        break;
      default:
        break;
    }
    return () => clearTimeout(timer);
  }, [state.event]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast((t) => (t && t.seq === toast.seq ? null : t)), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!state.hint) return undefined;
    const seq = state.hint.seq;
    const id = setTimeout(() => dispatch({ type: 'CLEAR_HINT', seq }), HINT_DURATION_MS);
    return () => clearTimeout(id);
  }, [state.hint]);

  /* ---------- Completion ---------- */

  useEffect(() => {
    if (state.status !== 'complete' || completedSeq.current === state.seq) return;
    completedSeq.current = state.seq;
    const score = calculateScore({
      difficulty: level.difficulty,
      requiredPieces: level.requiredPieces,
      timeMs: state.elapsedMs,
      hintsUsed: state.hintsUsed,
      mistakes: state.mistakes,
    });
    const summary = {
      score,
      timeMs: Math.round(state.elapsedMs),
      piecesUsed: Object.keys(state.placements).length,
      hintsUsed: state.hintsUsed,
      mistakes: state.mistakes,
    };
    setResult(summary);
    setIsNewBest(false);
    Promise.resolve(onComplete?.(summary))
      .then((res) => setIsNewBest(Boolean(res?.isNewBestScore && res?.previous)))
      .catch((err) => console.error('Failed to record completion', err));
  }, [state.status, state.seq, state.elapsedMs, state.hintsUsed, state.mistakes, state.placements, level, onComplete]);

  // Let the solved-board glow and fanfare land before the celebration opens.
  useEffect(() => {
    if (state.status !== 'complete' || !result) {
      setCelebrate(false);
      return undefined;
    }
    const id = setTimeout(() => setCelebrate(true), CELEBRATION_DELAY_MS);
    return () => clearTimeout(id);
  }, [state.status, result]);

  /* ---------- Persistence of in-progress games ---------- */

  const persistRef = useRef({ onPersist, onClearPersist });
  persistRef.current = { onPersist, onClearPersist };
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (mode !== 'play') return undefined;
    if (state.status === 'complete' || state.status === 'failed') {
      persistRef.current.onClearPersist?.();
      return undefined;
    }
    const id = setTimeout(() => persistRef.current.onPersist?.(snapshotForSave(stateRef.current)), 400);
    return () => clearTimeout(id);
  }, [mode, state.placements, state.pieces, state.hintsUsed, state.mistakes, state.status]);

  useEffect(() => {
    if (mode !== 'play') return undefined;
    const id = setInterval(() => {
      if (stateRef.current.status === 'playing') persistRef.current.onPersist?.(snapshotForSave(stateRef.current));
    }, 5000);
    const flush = () => {
      const s = stateRef.current;
      if (s.status === 'playing' || s.status === 'paused') persistRef.current.onPersist?.(snapshotForSave(s));
    };
    window.addEventListener('pagehide', flush);
    return () => {
      clearInterval(id);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [mode]);

  /* ---------- Actions ---------- */

  const doReset = () => {
    setConfirmReset(false);
    setResult(null);
    completedSeq.current = null;
    persistRef.current.onClearPersist?.();
    dispatch({ type: 'RESET' });
    feedback('start');
  };

  const requestReset = () => {
    if (settings.confirmReset && Object.keys(state.placements).length > 0) setConfirmReset(true);
    else doReset();
  };

  /* ---------- Preview (drag, hover, keyboard cursor) ---------- */

  let preview = null;
  if (drag && drag.preview) {
    preview = { ...drag.preview, shape: drag.shape, color: state.pieces[drag.pieceId].color };
  } else if (!drag && playing && state.selectedId) {
    const anchorCell = boardFocused ? cursor : hoverCell ? { x: hoverCell.col, y: hoverCell.row } : null;
    if (anchorCell) {
      const occupiedByOther = placed.some(
        (p) => p.id !== state.selectedId && p.cells.some(([x, y]) => x === anchorCell.x && y === anchorCell.y),
      );
      if (!occupiedByOther || boardFocused) {
        const { x, y } = centeredAnchor(state, state.selectedId, anchorCell.x, anchorCell.y);
        const spot = resolvePlacement(state, level, state.selectedId, x, y, tolerance);
        preview = {
          x: spot ? spot.x : x,
          y: spot ? spot.y : y,
          valid: Boolean(spot),
          shape: pieceShape(state, state.selectedId),
          color: state.pieces[state.selectedId].color,
        };
      }
    }
  }

  const selectedPlaced = Boolean(state.selectedId && state.placements[state.selectedId]);
  const labelFor = useCallback(
    (p) => `Piece ${pieceLabel(p.id)}, ${p.shape.length} cells, at column ${p.x + 1}, row ${p.y + 1}`,
    [],
  );

  return (
    <div className={`game ${isWide ? 'game-wide' : 'game-narrow'}${drag ? ' is-dragging' : ''}`} ref={stageRef}>
      <header className="game-topbar">
        <button type="button" className="icon-btn" onClick={onExit} aria-label={exitLabel}>
          <BackIcon />
        </button>
        <div className="game-title">
          <h1>
            {mode === 'test' ? 'Test · ' : ''}Level {level.number}
          </h1>
          <span className={`difficulty-chip difficulty-${level.difficulty}`}>{capitalize(level.difficulty)}</span>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={() => dispatch({ type: state.status === 'paused' ? 'RESUME' : 'PAUSE' })}
          aria-label={state.status === 'paused' ? 'Resume' : 'Pause'}
          disabled={state.status === 'complete' || state.status === 'failed'}
        >
          {state.status === 'paused' ? <PlayIcon /> : <PauseIcon />}
        </button>
      </header>

      <GameHud
        level={level}
        elapsedMs={state.elapsedMs}
        hintsLeft={state.hintsLeft}
        mistakes={state.mistakes}
        showTimer={settings.showTimer}
      />

      <div className="game-body">
        <section className="game-main" aria-label="Puzzle">
          <div className="board-area" ref={boardAreaRef}>
            <Board
              boardRef={boardRef}
              width={level.width}
              height={level.height}
              cellSize={cellSize}
              pieces={placed}
              selectedId={state.selectedId}
              draggingId={drag?.pieceId}
              preview={preview}
              hint={state.hint}
              cursor={cursor}
              showCursor={boardFocused}
              animation={animation}
              solved={state.status === 'complete'}
              labelFor={labelFor}
              onPiecePointerDown={onPiecePointerDown}
              onPieceClick={onPieceClick}
              onCellClick={onCellClick}
              onHoverCell={setHoverCell}
              onKeyDown={onBoardKeyDown}
              onFocusChange={setBoardFocused}
              describedBy="game-help"
            />
            {state.status === 'paused' ? (
              <div className="pause-overlay">
                <p>Paused</p>
                <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'RESUME' })} autoFocus>
                  Resume
                </button>
              </div>
            ) : null}
          </div>

          <GameControls
            canRotate={Boolean(state.selectedId)}
            canRemove={selectedPlaced}
            hintsLeft={state.hintsLeft}
            disabled={!playing}
            onRotate={(dir) => dispatch({ type: 'ROTATE', dir, tolerance })}
            onRemove={() => dispatch({ type: 'REMOVE' })}
            onHint={() => dispatch({ type: 'HINT' })}
            onReset={requestReset}
          />
        </section>

        <section className="tray" aria-label="Piece tray" style={{ '--tray-rows': trayRows }}>
          <div className="tray-header">
            <h2>Pieces</h2>
            <span className="tray-count">Not every piece fits</span>
          </div>
          <PieceTray
            pieces={trayPieces}
            selectedId={state.selectedId}
            draggingId={drag?.pieceId}
            hintPieceId={state.hint?.type === 'place' ? state.hint.pieceId : null}
            cellSize={trayCellSize}
            onSelect={onTraySelect}
            onPointerDown={onPiecePointerDown}
            animation={animation}
          />
        </section>
      </div>

      <p id="game-help" className="sr-only">
        Tap or click a piece to select it, then tap the board to place it, or drag it into the box. R rotates clockwise, E
        rotates counter-clockwise, Delete removes the selected piece, Space shows a hint. Not every piece belongs in the
        box: the puzzle is complete as soon as every cell is filled.
      </p>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {toast ? (
        <div className={`toast toast-${toast.tone}`} role="status" key={toast.seq}>
          {toast.message}
        </div>
      ) : null}

      {drag
        ? createPortal(
            <div className="drag-ghost" style={{ transform: `translate3d(${drag.left}px, ${drag.top}px, 0)` }} aria-hidden="true">
              <PieceShape cells={drag.shape} cellSize={drag.cellSize} color={state.pieces[drag.pieceId].color} />
            </div>,
            document.body,
          )
        : null}

      <CompletionModal
        open={state.status === 'complete' && Boolean(result) && celebrate}
        result={result}
        levelNumber={level.number}
        isNewBest={isNewBest}
        hasNext={hasNext}
        testMode={mode === 'test'}
        onNext={onNext}
        onReplay={doReset}
        onExit={onExit}
      />

      <Modal open={state.status === 'failed'} title="Time's up" dismissible={false}>
        <p>The clock ran out before the box was filled. Try again — the puzzle is the same.</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" data-autofocus onClick={doReset}>
            Try again
          </button>
          <button type="button" className="btn btn-ghost" onClick={onExit}>
            {exitLabel}
          </button>
        </div>
      </Modal>

      <Modal open={confirmReset} title="Reset puzzle?" onClose={() => setConfirmReset(false)}>
        <p>All pieces return to the tray and the timer, hints and mistakes start over.</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" data-autofocus onClick={doReset}>
            Reset
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
