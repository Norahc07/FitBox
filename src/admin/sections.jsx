import { useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import Stars from '../components/Stars.jsx';
import LevelEditor, { blankLevel, newLevelId } from './LevelEditor.jsx';
import { useAsync } from './useAsync.js';
import {
  adminLevelStats,
  adminOverview,
  deleteLevel,
  listAllLevels,
  listSessions,
  listUsers,
  saveLevel,
  setLevelPublished,
  setUserRole,
} from '../supabase/adminApi.js';
import { validateLevel } from '../levels/validator.js';
import { SEED_LEVELS } from '../levels/levelRepository.js';
import { capitalize, formatDate, formatNumber, formatTime } from '../utils/format.js';

function Loading() {
  return <p className="muted" aria-busy="true">Loading…</p>;
}

function ErrorBox({ error, onRetry }) {
  return (
    <div className="form-message form-error" role="alert">
      {error}{' '}
      {onRetry ? (
        <button type="button" className="btn btn-ghost btn-small" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

/* ---------------- Overview ---------------- */

export function OverviewSection() {
  const { data, loading, error, reload } = useAsync(adminOverview, []);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const cards = [
    ['Players', data.total_users],
    ['Admins', data.admins],
    ['Sessions', data.total_sessions],
    ['Sessions (7 days)', data.sessions_7d],
    ['Active players (7 days)', data.active_players_7d],
    ['Published levels', data.published_levels],
    ['Draft levels', data.draft_levels],
  ];
  return (
    <div className="stat-cards">
      {cards.map(([label, value]) => (
        <div key={label} className="stat-card">
          <span className="stat-value">{formatNumber(value)}</span>
          <span className="stat-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Users ---------------- */

export function UsersSection({ currentUserId }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { data, loading, error, reload } = useAsync(() => listUsers({ search: query }), [query]);
  const [pending, setPending] = useState(null);
  const [actionError, setActionError] = useState(null);

  return (
    <div>
      <form
        className="form form-inline"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
        }}
      >
        <label className="field">
          <span>Search display name</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-secondary">
          Search
        </button>
      </form>
      {actionError ? <ErrorBox error={actionError} /> : null}
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Display name</th>
                <th>Role</th>
                <th>Joined</th>
                <th>User id</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id}>
                  <td>{u.display_name || '—'}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-admin' : ''}`}>{u.role}</span>
                  </td>
                  <td>{formatDate(u.created_at)}</td>
                  <td className="mono">{u.id.slice(0, 8)}…</td>
                  <td>
                    {u.id !== currentUserId ? (
                      <button type="button" className="btn btn-ghost btn-small" onClick={() => setPending(u)}>
                        {u.role === 'admin' ? 'Make player' : 'Make admin'}
                      </button>
                    ) : (
                      <span className="muted">You</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={Boolean(pending)} title="Change role?" onClose={() => setPending(null)}>
        {pending ? (
          <>
            <p>
              Change <strong>{pending.display_name || pending.id}</strong> to{' '}
              <strong>{pending.role === 'admin' ? 'player' : 'admin'}</strong>?
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    await setUserRole(pending.id, pending.role === 'admin' ? 'player' : 'admin');
                    setActionError(null);
                    reload();
                  } catch (err) {
                    setActionError(err.message);
                  }
                  setPending(null);
                }}
              >
                Confirm
              </button>
              <button type="button" className="btn btn-ghost" data-autofocus onClick={() => setPending(null)}>
                Cancel
              </button>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}

/* ---------------- Levels ---------------- */

export function LevelsSection({ canSave, sandbox }) {
  const remote = useAsync(() => (sandbox ? Promise.resolve([]) : listAllLevels()), [sandbox]);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const levels = sandbox ? SEED_LEVELS.map((l) => ({ ...l, source: 'built-in' })) : remote.data || [];
  const nextNumber = useMemo(() => levels.reduce((m, l) => Math.max(m, l.number), 0) + 1, [levels]);

  const act = async (fn, success) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ tone: 'info', text: success });
      remote.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: err.message || String(err) });
    } finally {
      setBusy(false);
    }
  };

  const duplicate = (level) => {
    const sameNumber = levels.filter((l) => l.number === level.number);
    const version = sameNumber.reduce((m, l) => Math.max(m, l.version), 0) + 1;
    setEditing({ ...structuredClone(level), id: newLevelId(level.number, version), version, published: false });
  };

  const togglePublish = (level) => {
    if (!level.published) {
      const result = validateLevel(level);
      if (!result.valid) {
        setMessage({ tone: 'error', text: `Cannot publish level ${level.number}: ${result.errors[0]}` });
        return;
      }
    }
    act(() => setLevelPublished(level.id, !level.published), level.published ? 'Level unpublished.' : 'Level published.');
  };

  if (editing) {
    return (
      <LevelEditor
        initial={editing}
        canSave={canSave}
        onClose={() => {
          setEditing(null);
          remote.reload();
        }}
        onSave={async (level) => {
          const saved = await saveLevel(level);
          return saved;
        }}
      />
    );
  }

  return (
    <div>
      <div className="button-row">
        <button type="button" className="btn btn-primary" onClick={() => setEditing(blankLevel(nextNumber))}>
          New level
        </button>
        {!sandbox && !remote.loading && levels.length === 0 ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() =>
              act(async () => {
                for (const level of SEED_LEVELS) await saveLevel(level);
              }, `Imported ${SEED_LEVELS.length} built-in levels.`)
            }
          >
            Import built-in levels
          </button>
        ) : null}
      </div>
      {sandbox ? (
        <p className="form-message form-info">
          Local sandbox (development only): showing the bundled levels. You can generate, validate and test puzzles; saving needs Supabase.
        </p>
      ) : null}
      {message ? <p className={`form-message form-${message.tone}`} role="status">{message.text}</p> : null}
      {remote.loading && !sandbox ? (
        <Loading />
      ) : remote.error ? (
        <ErrorBox error={remote.error} onRetry={remote.reload} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Ver.</th>
                <th>Difficulty</th>
                <th>Board</th>
                <th>Pieces</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {levels.map((l) => {
                const valid = validateLevel(l).valid;
                return (
                  <tr key={l.id}>
                    <td>{l.number}</td>
                    <td>v{l.version}</td>
                    <td>
                      <span className={`difficulty-chip difficulty-${l.difficulty}`}>{capitalize(l.difficulty)}</span>
                    </td>
                    <td>
                      {l.width}×{l.height}
                    </td>
                    <td>
                      {l.requiredPieces}/{l.totalPieces}
                    </td>
                    <td>
                      <span className={`badge ${l.published ? 'badge-ok' : ''}`}>{l.published ? 'Published' : 'Draft'}</span>
                      {!valid ? <span className="badge badge-error">Invalid</span> : null}
                    </td>
                    <td className="table-actions">
                      <button type="button" className="btn btn-ghost btn-small" onClick={() => setEditing(structuredClone(l))}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-ghost btn-small" onClick={() => duplicate(l)}>
                        Duplicate
                      </button>
                      {!sandbox ? (
                        <>
                          <button type="button" className="btn btn-ghost btn-small" disabled={busy} onClick={() => togglePublish(l)}>
                            {l.published ? 'Unpublish' : 'Publish'}
                          </button>
                          <button type="button" className="btn btn-ghost btn-small btn-danger-text" disabled={busy} onClick={() => setConfirmDelete(l)}>
                            Delete
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={Boolean(confirmDelete)} title="Delete level?" onClose={() => setConfirmDelete(null)}>
        {confirmDelete ? (
          <>
            <p>
              Delete level {confirmDelete.number} v{confirmDelete.version}? Players who already downloaded it keep playing the bundled or
              previous version.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  const id = confirmDelete.id;
                  setConfirmDelete(null);
                  act(() => deleteLevel(id), 'Level deleted.');
                }}
              >
                Delete
              </button>
              <button type="button" className="btn btn-ghost" data-autofocus onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}

/* ---------------- Sessions ---------------- */

export function SessionsSection() {
  const [levelFilter, setLevelFilter] = useState('');
  const { data, loading, error, reload } = useAsync(
    () => listSessions({ limit: 200, levelNumber: levelFilter ? Number(levelFilter) : null }),
    [levelFilter],
  );
  return (
    <div>
      <label className="field field-narrow">
        <span>Filter by level</span>
        <input type="number" min={1} value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} placeholder="All" />
      </label>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <p className="muted">No sessions yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Player</th>
                <th>Level</th>
                <th>Score</th>
                <th>Stars</th>
                <th>Time</th>
                <th>Hints</th>
                <th>Mistakes</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id}>
                  <td>{formatDate(s.completed_at)}</td>
                  <td>{s.profiles?.display_name || s.user_id.slice(0, 8)}</td>
                  <td>
                    {s.level_number} <span className="muted">v{s.level_version}</span>
                  </td>
                  <td>{formatNumber(s.score)}</td>
                  <td>
                    <Stars count={s.stars} size={12} />
                  </td>
                  <td>{formatTime(s.time_ms)}</td>
                  <td>{s.hints_used}</td>
                  <td>{s.mistakes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Statistics ---------------- */

export function StatisticsSection() {
  const { data, loading, error, reload } = useAsync(adminLevelStats, []);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data.length) return <p className="muted">No completed sessions yet.</p>;
  const maxSessions = Math.max(...data.map((d) => Number(d.sessions)));
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Level</th>
            <th>Completions</th>
            <th>Players</th>
            <th>Avg score</th>
            <th>Avg time</th>
            <th>Best time</th>
            <th>Avg hints</th>
            <th>Avg mistakes</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.level_number}>
              <td>{d.level_number}</td>
              <td>
                <div className="bar-cell">
                  <span className="bar" style={{ width: `${(Number(d.sessions) / maxSessions) * 100}%` }} />
                  <span>{formatNumber(d.sessions)}</span>
                </div>
              </td>
              <td>{formatNumber(d.players)}</td>
              <td>{formatNumber(d.avg_score)}</td>
              <td>{formatTime(Number(d.avg_time_ms))}</td>
              <td>{formatTime(d.best_time_ms)}</td>
              <td>{d.avg_hints}</td>
              <td>{d.avg_mistakes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
