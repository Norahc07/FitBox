import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Stars from '../components/Stars.jsx';
import { useApp } from '../hooks/useApp.jsx';
import { fetchLeaderboard } from '../supabase/api.js';
import { formatNumber, formatTime } from '../utils/format.js';

export default function LeaderboardPage() {
  const { levels, online, cloudEnabled } = useApp();
  const [levelNumber, setLevelNumber] = useState(levels[0]?.number ?? 1);
  const [rows, setRows] = useState([]);
  const [state, setState] = useState('idle');

  useEffect(() => {
    if (!cloudEnabled || !online) return undefined;
    let cancelled = false;
    setState('loading');
    fetchLeaderboard(levelNumber, 25)
      .then((data) => {
        if (cancelled) return;
        setRows(data || []);
        setState('ready');
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [levelNumber, online, cloudEnabled]);

  return (
    <main className="page leaderboard-page">
      <PageHeader title="Leaderboard" />
      <label className="field">
        <span>Level</span>
        <select value={levelNumber} onChange={(e) => setLevelNumber(Number(e.target.value))}>
          {levels.map((l) => (
            <option key={l.id} value={l.number}>
              Level {l.number} · {l.difficulty}
            </option>
          ))}
        </select>
      </label>

      {!cloudEnabled ? (
        <p className="empty-state">Leaderboards need cloud sync, which is not configured for this build.</p>
      ) : !online ? (
        <p className="empty-state">Leaderboards are available when you are online. Your own scores are always saved locally.</p>
      ) : state === 'loading' ? (
        <p className="muted" aria-busy="true">Loading…</p>
      ) : state === 'error' ? (
        <p className="empty-state">Could not load the leaderboard.</p>
      ) : rows.length === 0 ? (
        <p className="empty-state">No scores yet. Be the first!</p>
      ) : (
        <ol className="leaderboard">
          {rows.map((r, i) => (
            <li key={i} className={r.is_me ? 'is-me' : ''}>
              <span className="lb-rank">{r.rank}</span>
              <span className="lb-name">{r.display_name}</span>
              <Stars count={r.stars} size={12} />
              <span className="lb-score">{formatNumber(r.best_score)}</span>
              <span className="lb-time">{formatTime(r.best_time_ms)}</span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
