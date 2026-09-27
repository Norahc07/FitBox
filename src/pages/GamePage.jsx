import { useCallback, useEffect, useState } from 'react';
import GameScreen from '../game/GameScreen.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { LoadingScreen } from '../components/BrandMark.jsx';
import { useApp } from '../hooks/useApp.jsx';
import { clearActiveGame, getActiveGame, saveActiveGame } from '../storage/sessionStore.js';
import { uuid } from '../utils/id.js';
import { navigate } from '../utils/router.jsx';

export default function GamePage({ number }) {
  const { levels, unlocked, settings, recordCompletion, ready } = useApp();
  const level = levels.find((l) => l.number === number);
  const [saved, setSaved] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    setSaved(undefined);
    if (!level) return undefined;
    getActiveGame(level.id)
      .then((s) => !cancelled && setSaved(s))
      .catch(() => !cancelled && setSaved(null));
    return () => {
      cancelled = true;
    };
  }, [level]);

  const sorted = [...levels].sort((a, b) => a.number - b.number);
  const nextLevel = level ? sorted.find((l) => l.number > level.number) : null;

  const onComplete = useCallback(
    (summary) =>
      recordCompletion({
        id: uuid(),
        levelId: level.id,
        levelNumber: level.number,
        levelVersion: level.version,
        difficulty: level.difficulty,
        score: summary.score.total,
        stars: summary.score.stars,
        timeMs: summary.timeMs,
        hintsUsed: summary.hintsUsed,
        mistakes: summary.mistakes,
        piecesUsed: summary.piecesUsed,
        completedAt: new Date().toISOString(),
      }),
    [level, recordCompletion],
  );

  const onPersist = useCallback((snapshot) => saveActiveGame(snapshot).catch(() => {}), []);
  const onClearPersist = useCallback(() => level && clearActiveGame(level.id).catch(() => {}), [level]);

  if (!ready) return <LoadingScreen label="Loading puzzle…" />;

  if (!level) {
    return (
      <main className="page">
        <PageHeader title="Level not found" backTo="/levels" backLabel="Back to levels" />
        <p className="empty-state">This level does not exist or is not published.</p>
      </main>
    );
  }

  if (!unlocked.has(level.number)) {
    return (
      <main className="page">
        <PageHeader title={`Level ${level.number}`} backTo="/levels" backLabel="Back to levels" />
        <div className="empty-state">
          <p>This level is locked. Complete level {level.number - 1} to unlock it.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/levels')}>
            Choose a level
          </button>
        </div>
      </main>
    );
  }

  if (saved === undefined) return <LoadingScreen label="Loading puzzle…" />;

  return (
    <main className="page page-game">
      <GameScreen
        key={`${level.id}:${level.version}`}
        level={level}
        settings={settings}
        savedState={saved}
        hasNext={Boolean(nextLevel)}
        onComplete={onComplete}
        onPersist={onPersist}
        onClearPersist={onClearPersist}
        onNext={() => nextLevel && navigate(`/play/${nextLevel.number}`)}
        onExit={() => navigate('/levels')}
      />
    </main>
  );
}
