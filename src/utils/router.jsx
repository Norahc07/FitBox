import { useEffect, useState } from 'react';

/**
 * Tiny history-API router (no dependency). Routes:
 *   /                 home
 *   /levels           level select
 *   /play/:number     gameplay
 *   /settings         settings
 *   /account          sign in + sync
 *   /leaderboard      leaderboards
 *   /admin[/:section] admin dashboard
 */
const NAV_EVENT = 'fitbox:navigate';

export function navigate(path, { replace = false } = {}) {
  if (path === window.location.pathname) return;
  window.history[replace ? 'replaceState' : 'pushState']({}, '', path);
  window.dispatchEvent(new Event(NAV_EVENT));
  window.scrollTo(0, 0);
}

export function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    window.addEventListener(NAV_EVENT, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(NAV_EVENT, update);
    };
  }, []);
  return matchRoute(path);
}

export function matchRoute(path) {
  const clean = path.replace(/\/+$/, '') || '/';
  if (clean === '/') return { name: 'home', params: {} };
  if (clean === '/levels') return { name: 'levels', params: {} };
  if (clean === '/settings') return { name: 'settings', params: {} };
  if (clean === '/account') return { name: 'account', params: {} };
  if (clean === '/leaderboard') return { name: 'leaderboard', params: {} };
  const play = clean.match(/^\/play\/(\d+)$/);
  if (play) return { name: 'play', params: { number: Number(play[1]) } };
  const admin = clean.match(/^\/admin(?:\/([a-z-]+))?$/);
  if (admin) return { name: 'admin', params: { section: admin[1] || 'overview' } };
  return { name: 'not-found', params: {} };
}

export function Link({ to, onClick, children, ...rest }) {
  return (
    <a
      href={to}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
