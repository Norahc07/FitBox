import { useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { useApp } from '../hooks/useApp.jsx';
import { signInWithPassword, signUp, updateDisplayName } from '../supabase/auth.js';
import { formatDate } from '../utils/format.js';

function AuthForm({ online }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'signin') {
        await signInWithPassword(email, password);
      } else {
        const data = await signUp(email, password, displayName);
        if (!data.session) setMessage({ tone: 'info', text: 'Check your email to confirm your account, then sign in.' });
      }
    } catch (err) {
      setMessage({ tone: 'error', text: err.message || 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <div className="segmented" role="tablist" aria-label="Account mode">
        <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => setMode('signin')}>
          Sign in
        </button>
        <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => setMode('signup')}>
          Create account
        </button>
      </div>
      <form className="form" onSubmit={submit}>
        {mode === 'signup' ? (
          <label className="field">
            <span>Display name</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} autoComplete="nickname" />
          </label>
        ) : null}
        <label className="field">
          <span>Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </label>
        {!online ? <p className="form-message form-info">You are offline. Signing in needs a connection — you can keep playing meanwhile.</p> : null}
        {message ? <p className={`form-message form-${message.tone}`} role="alert">{message.text}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={busy || !online}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <p className="muted">An account is optional. It backs up your progress and puts your best scores on the leaderboard.</p>
    </section>
  );
}

function ProfileCard() {
  const { auth, sync, runSync, signOut, online, refreshProfile } = useApp();
  const [name, setName] = useState(auth.profile?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  return (
    <>
      <section className="card">
        <p className="muted">Signed in as</p>
        <p className="account-email">{auth.user.email}</p>
        {auth.profile?.role === 'admin' ? <span className="badge">Admin</span> : null}
        <form
          className="form form-inline"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setMsg(null);
            try {
              await updateDisplayName(auth.user.id, name.trim());
              await refreshProfile();
              setMsg('Saved.');
            } catch (err) {
              setMsg(err.message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <label className="field">
            <span>Display name (shown on leaderboards)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
          </label>
          <button type="submit" className="btn btn-secondary" disabled={saving || !online}>
            Save
          </button>
        </form>
        {msg ? <p className="muted" role="status">{msg}</p> : null}
      </section>

      <section className="card">
        <h2 className="card-title">Sync</h2>
        <dl className="kv">
          <div><dt>Status</dt><dd><StatusPill /></dd></div>
          <div><dt>Waiting to upload</dt><dd>{sync.pending} session(s)</dd></div>
          <div><dt>Last synced</dt><dd>{formatDate(sync.lastSyncedAt)}</dd></div>
        </dl>
        {sync.message ? <p className="form-message form-error">{sync.message}</p> : null}
        <p className="muted">
          Puzzles finished offline are queued on this device and uploaded automatically when you are back online. When
          device and cloud disagree, the best score, best time and most stars are kept.
        </p>
        <div className="button-row">
          <button type="button" className="btn btn-primary" onClick={runSync} disabled={!online || sync.status === 'syncing'}>
            Sync now
          </button>
          <button type="button" className="btn btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </section>
    </>
  );
}

export default function AccountPage() {
  const { cloudEnabled, auth, online } = useApp();
  return (
    <main className="page account-page">
      <PageHeader title="Account" />
      {!cloudEnabled ? (
        <section className="card">
          <p>Cloud sync is not configured for this build. Everything is saved on this device.</p>
        </section>
      ) : auth.loading ? (
        <p className="muted" aria-busy="true">Loading…</p>
      ) : auth.user ? (
        <ProfileCard key={auth.profile?.display_name ?? 'p'} />
      ) : (
        <AuthForm online={online} />
      )}
    </main>
  );
}
