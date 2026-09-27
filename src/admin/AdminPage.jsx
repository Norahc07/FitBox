import PageHeader from '../components/PageHeader.jsx';
import { useApp } from '../hooks/useApp.jsx';
import { Link } from '../utils/router.jsx';
import { LevelsSection, OverviewSection, SessionsSection, StatisticsSection, UsersSection } from './sections.jsx';
import '../styles/admin.css';

const SECTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'Users' },
  { key: 'levels', label: 'Levels' },
  { key: 'sessions', label: 'Game Sessions' },
  { key: 'statistics', label: 'Statistics' },
];

function Gate({ title, children }) {
  return (
    <main className="page">
      <PageHeader title={title} />
      <section className="card">{children}</section>
    </main>
  );
}

/**
 * Admin dashboard. The UI is only rendered for profiles with role = 'admin';
 * the real protection is Row Level Security in Supabase, so hiding the UI is
 * a convenience, not the security boundary.
 */
export default function AdminPage({ section }) {
  const { cloudEnabled, auth, isAdmin, online } = useApp();
  const sandbox = !cloudEnabled && import.meta.env.DEV;

  if (!cloudEnabled && !sandbox) {
    return (
      <Gate title="Admin">
        <p>The admin dashboard requires Supabase to be configured.</p>
      </Gate>
    );
  }
  if (!sandbox) {
    if (auth.loading) return <Gate title="Admin"><p className="muted">Checking access…</p></Gate>;
    if (!auth.user) {
      return (
        <Gate title="Admin">
          <p>Sign in with an administrator account to continue.</p>
          <Link to="/account" className="btn btn-primary">Sign in</Link>
        </Gate>
      );
    }
    if (!auth.profile) return <Gate title="Admin"><p className="muted">Loading profile…</p></Gate>;
    if (!isAdmin) {
      return (
        <Gate title="Not authorized">
          <p>You do not have access to this page.</p>
        </Gate>
      );
    }
    if (!online) {
      return (
        <Gate title="Admin">
          <p>The admin dashboard needs an internet connection.</p>
        </Gate>
      );
    }
  }

  const available = sandbox ? SECTIONS.filter((s) => s.key === 'levels') : SECTIONS;
  const active = available.find((s) => s.key === section) ? section : available[0].key;

  return (
    <main className="page admin-page">
      <PageHeader title={sandbox ? 'Admin · Local sandbox' : 'Admin'} />
      <nav className="admin-tabs" aria-label="Admin sections">
        {available.map((s) => (
          <Link key={s.key} to={`/admin/${s.key}`} className={`admin-tab${s.key === active ? ' is-active' : ''}`} aria-current={s.key === active ? 'page' : undefined}>
            {s.label}
          </Link>
        ))}
      </nav>
      <section className="admin-content" aria-label={available.find((s) => s.key === active).label}>
        {active === 'overview' && <OverviewSection />}
        {active === 'users' && <UsersSection currentUserId={auth.user?.id} />}
        {active === 'levels' && <LevelsSection canSave={!sandbox} sandbox={sandbox} />}
        {active === 'sessions' && <SessionsSection />}
        {active === 'statistics' && <StatisticsSection />}
      </section>
    </main>
  );
}
