import { formatTime } from '../utils/format.js';

export default function GameHud({ level, elapsedMs, hintsLeft, mistakes, showTimer }) {
  const countdown = level.timeLimit ? Math.max(0, level.timeLimit * 1000 - elapsedMs) : null;
  const lowTime = countdown !== null && countdown < 15000;
  return (
    <dl className="hud" aria-label="Puzzle status">
      <div className="hud-item">
        <dt>{countdown !== null ? 'Time left' : 'Time'}</dt>
        <dd className={`hud-timer${lowTime ? ' is-low' : ''}`} aria-live={lowTime ? 'polite' : 'off'}>
          {showTimer || countdown !== null ? formatTime(countdown ?? elapsedMs) : '—'}
        </dd>
      </div>
      <div className="hud-item">
        <dt>Hints</dt>
        <dd>{hintsLeft}</dd>
      </div>
      <div className="hud-item">
        <dt>Mistakes</dt>
        <dd>{mistakes}</dd>
      </div>
    </dl>
  );
}
