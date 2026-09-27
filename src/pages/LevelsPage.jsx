import PageHeader from '../components/PageHeader.jsx';
import Stars from '../components/Stars.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { LockIcon } from '../components/Icons.jsx';
import { PoweredBy } from '../components/BrandMark.jsx';
import { useApp } from '../hooks/useApp.jsx';
import { DIFFICULTIES, DIFFICULTY_PROFILES } from '../engine/difficulty.js';
import { formatNumber, formatTime } from '../utils/format.js';
import { navigate } from '../utils/router.jsx';

function LevelCard({ level, progress, unlocked }) {
  const completed = Boolean(progress?.completed);
  const label = unlocked
    ? `Level ${level.number}, ${level.width} by ${level.height}, ${level.totalPieces} pieces${
        completed ? `, completed with ${progress.stars} stars` : ''
      }`
    : `Level ${level.number}, locked`;
  return (
    <li>
      <button
        type="button"
        className={`level-card${completed ? ' is-complete' : ''}${unlocked ? '' : ' is-locked'} difficulty-${level.difficulty}`}
        disabled={!unlocked}
        onClick={() => navigate(`/play/${level.number}`)}
        aria-label={label}
      >
        <span className="level-number">{level.number}</span>
        {unlocked ? (
          <>
            <Stars count={progress?.stars ?? 0} size={14} />
            <span className="level-meta">
              {level.width}×{level.height} · {level.totalPieces} pieces
            </span>
            {completed ? (
              <span className="level-best">
                {formatNumber(progress.bestScore)} · {formatTime(progress.bestTimeMs)}
              </span>
            ) : (
              <span className="level-best level-new">New</span>
            )}
          </>
        ) : (
          <LockIcon className="level-lock" />
        )}
      </button>
    </li>
  );
}

export default function LevelsPage() {
  const { levels, progress, unlocked } = useApp();
  return (
    <main className="page levels-page">
      <PageHeader title="Levels" actions={<StatusPill />} />
      {DIFFICULTIES.map((difficulty) => {
        const group = levels.filter((l) => l.difficulty === difficulty);
        if (!group.length) return null;
        const done = group.filter((l) => progress[l.number]?.completed).length;
        return (
          <section key={difficulty} className="level-group" aria-labelledby={`group-${difficulty}`}>
            <div className="level-group-header">
              <h2 id={`group-${difficulty}`} className={`difficulty-title difficulty-${difficulty}`}>
                {DIFFICULTY_PROFILES[difficulty].label}
              </h2>
              <span className="level-group-count">
                {done}/{group.length}
              </span>
            </div>
            <ul className="level-grid">
              {group.map((level) => (
                <LevelCard key={level.id} level={level} progress={progress[level.number]} unlocked={unlocked.has(level.number)} />
              ))}
            </ul>
          </section>
        );
      })}
      <footer className="page-footer">
        <PoweredBy showVersion />
      </footer>
    </main>
  );
}
