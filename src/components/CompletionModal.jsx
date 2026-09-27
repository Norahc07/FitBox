import { useEffect } from 'react';
import Modal from './Modal.jsx';
import CelebrationStars, { starLandsAt } from './CelebrationStars.jsx';
import Confetti from './Confetti.jsx';
import { PoweredBy } from './BrandMark.jsx';
import { formatNumber, formatTime } from '../utils/format.js';
import { feedback } from '../services/feedback.js';

const CHEERS = {
  3: 'Perfect fit! Flawless solving.',
  2: 'Great job! You cracked it.',
  1: 'Nice work! Every cell filled.',
};

export default function CompletionModal({ open, result, levelNumber, isNewBest, hasNext, testMode, onNext, onReplay, onExit }) {
  const stars = result?.score.stars ?? 0;

  // One bell per earned star, landing as each star finishes filling.
  useEffect(() => {
    if (!open) return undefined;
    const timers = Array.from({ length: stars }, (_, i) => setTimeout(() => feedback('star', i), starLandsAt(i)));
    return () => timers.forEach(clearTimeout);
  }, [open, stars]);

  useEffect(() => {
    if (!open || !isNewBest) return undefined;
    const id = setTimeout(() => feedback('newBest'), starLandsAt(Math.max(stars, 1) - 1) + 350);
    return () => clearTimeout(id);
  }, [open, isNewBest, stars]);

  if (!result) return null;
  const { score, timeMs, piecesUsed, hintsUsed, mistakes } = result;
  const finishedAll = !hasNext && !testMode;

  return (
    <>
      {open ? <Confetti /> : null}
      <Modal open={open} dismissible={false} className="completion-modal" labelledBy="completion-title">
        <div className="completion-burst" aria-hidden="true" />
        <p className="completion-kicker">
          Level {levelNumber} · Puzzle complete!
        </p>
        <h2 id="completion-title" className="completion-title">
          Congratulations!
        </h2>
        <CelebrationStars count={stars} />
        <p className="completion-cheer">{finishedAll ? 'You have completed every level. You are a FitBox master!' : CHEERS[stars]}</p>
        {isNewBest ? <p className="badge badge-best">New best score</p> : null}

        <dl className="completion-stats">
          <div className="completion-score">
            <dt>Score</dt>
            <dd>{formatNumber(score.total)}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{formatTime(timeMs)}</dd>
          </div>
          <div>
            <dt>Pieces used</dt>
            <dd>{piecesUsed}</dd>
          </div>
          <div>
            <dt>Hints used</dt>
            <dd>{hintsUsed}</dd>
          </div>
          <div>
            <dt>Mistakes</dt>
            <dd>{mistakes}</dd>
          </div>
        </dl>

        <details className="score-breakdown">
          <summary>Score breakdown</summary>
          <ul>
            <li>
              <span>Base</span>
              <span>+{score.base}</span>
            </li>
            <li>
              <span>Completion bonus</span>
              <span>+{score.completionBonus}</span>
            </li>
            <li>
              <span>Speed bonus (par {formatTime(score.parMs)})</span>
              <span>+{score.speedBonus}</span>
            </li>
            <li>
              <span>Mistake penalty</span>
              <span>−{score.mistakePenalty}</span>
            </li>
            <li>
              <span>Hint penalty</span>
              <span>−{score.hintPenalty}</span>
            </li>
          </ul>
        </details>

        <div className="modal-actions">
          {testMode ? (
            <button type="button" className="btn btn-primary btn-xl" data-autofocus onClick={onExit}>
              Back to editor
            </button>
          ) : hasNext ? (
            <button type="button" className="btn btn-primary btn-xl btn-next" data-autofocus onClick={onNext}>
              Next Level
              <span aria-hidden="true" className="btn-next-arrow">
                →
              </span>
            </button>
          ) : null}
          <div className="completion-secondary">
            <button type="button" className="btn btn-secondary" onClick={onReplay} data-autofocus={finishedAll ? true : undefined}>
              Replay
            </button>
            {!testMode ? (
              <button type="button" className="btn btn-ghost" onClick={onExit}>
                Levels
              </button>
            ) : null}
          </div>
        </div>
        <PoweredBy size={20} className="completion-brand" />
      </Modal>
    </>
  );
}
