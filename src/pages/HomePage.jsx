import StatusPill from '../components/StatusPill.jsx';
import { GAME_LOGO_SRC, GAME_WORDMARK_SRC, PoweredBy } from '../components/BrandMark.jsx';
import Stars from '../components/Stars.jsx';
import { GridIcon, SettingsIcon, ShieldIcon, TrophyIcon, UserIcon } from '../components/Icons.jsx';
import { useApp } from '../hooks/useApp.jsx';
import { useInstallPrompt } from '../hooks/useInstallPrompt.js';
import { nextLevelToPlay, summarizeProgress } from '../game/progress.js';
import { Link, navigate } from '../utils/router.jsx';

export default function HomePage() {
  const { levels, progress, cloudEnabled, isAdmin, auth } = useApp();
  const install = useInstallPrompt();
  const summary = summarizeProgress(levels, progress);
  const next = nextLevelToPlay(levels, progress);
  const started = summary.completed > 0;
  const pct = Math.round((summary.completed / Math.max(1, summary.total)) * 100);

  return (
    <main className="page home">
      <div className="home-top">
        <StatusPill />
      </div>

      <section className="home-hero">
        <div className="brand-lockup">
          <img className="logo-box" src={GAME_LOGO_SRC} alt="" width="150" height="150" />
          <h1 className="brand">
            <img className="brand-wordmark" src={GAME_WORDMARK_SRC} alt="FitBox — Brain Teaser" width="900" height="239" />
          </h1>
        </div>
        <p className="home-tagline">More pieces than space. Find the ones that belong and fill every cell.</p>
      </section>

      <button type="button" className="btn btn-primary btn-xl" onClick={() => navigate(`/play/${next.number}`)}>
        {started ? `Continue · Level ${next.number}` : 'Play Level 1'}
      </button>

      <section className="card progress-card" aria-label="Your progress">
        <div className="progress-row">
          <div>
            <p className="progress-value">
              {summary.completed}
              <span>/{summary.total}</span>
            </p>
            <p className="progress-label">Levels complete</p>
          </div>
          <div className="progress-stars">
            <Stars count={3} size={16} />
            <p className="progress-label">
              {summary.stars} / {summary.maxStars} stars
            </p>
          </div>
        </div>
        <div className="progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Overall progress">
          <span style={{ width: `${pct}%` }} />
        </div>
      </section>

      <nav className="home-menu" aria-label="Main menu">
        <Link to="/levels" className="menu-tile">
          <GridIcon />
          <span>Levels</span>
        </Link>
        {cloudEnabled ? (
          <Link to="/leaderboard" className="menu-tile">
            <TrophyIcon />
            <span>Leaderboard</span>
          </Link>
        ) : null}
        <Link to="/settings" className="menu-tile">
          <SettingsIcon />
          <span>Settings</span>
        </Link>
        {cloudEnabled ? (
          <Link to="/account" className="menu-tile">
            <UserIcon />
            <span>{auth.user ? 'Account' : 'Sign in'}</span>
          </Link>
        ) : null}
        {isAdmin ? (
          <Link to="/admin" className="menu-tile menu-tile-admin">
            <ShieldIcon />
            <span>Admin</span>
          </Link>
        ) : null}
      </nav>

      {install.canInstall ? (
        <button type="button" className="btn btn-secondary" onClick={install.install}>
          Install FitBox
        </button>
      ) : install.showIosHint ? (
        <p className="install-hint">To install on iPhone/iPad: tap Share, then “Add to Home Screen”.</p>
      ) : null}

      <footer className="home-footer">
        <PoweredBy showVersion />
        <p>Works offline after the first visit. Progress is saved on this device{cloudEnabled ? ' and synced when signed in' : ''}.</p>
      </footer>
    </main>
  );
}
