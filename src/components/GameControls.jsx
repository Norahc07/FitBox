import { HintIcon, RemoveIcon, ResetIcon, RotateLeftIcon, RotateRightIcon } from './Icons.jsx';

export default function GameControls({ canRotate, canRemove, hintsLeft, disabled, onRotate, onRemove, onHint, onReset }) {
  return (
    <div className="controls" role="toolbar" aria-label="Piece controls">
      <button type="button" className="control-btn" onClick={() => onRotate(-1)} disabled={disabled || !canRotate} aria-label="Rotate counter-clockwise (E)" title="Rotate left (E)">
        <RotateLeftIcon />
        <span className="control-label">Rotate L</span>
      </button>
      <button type="button" className="control-btn" onClick={() => onRotate(1)} disabled={disabled || !canRotate} aria-label="Rotate clockwise (R)" title="Rotate right (R)">
        <RotateRightIcon />
        <span className="control-label">Rotate R</span>
      </button>
      <button type="button" className="control-btn" onClick={onRemove} disabled={disabled || !canRemove} aria-label="Remove selected piece from the board (Delete)" title="Remove (Delete)">
        <RemoveIcon />
        <span className="control-label">Remove</span>
      </button>
      <button type="button" className="control-btn control-hint" onClick={onHint} disabled={disabled || hintsLeft <= 0} aria-label={`Hint, ${hintsLeft} left (Space)`} title="Hint (Space)">
        <HintIcon />
        <span className="control-label">Hint</span>
        <span className="control-badge" aria-hidden="true">{hintsLeft}</span>
      </button>
      <button type="button" className="control-btn" onClick={onReset} disabled={disabled} aria-label="Reset puzzle" title="Reset">
        <ResetIcon />
        <span className="control-label">Reset</span>
      </button>
    </div>
  );
}
