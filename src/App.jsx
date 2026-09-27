import { lazy, Suspense, useEffect, useState } from 'react';
import { AppProvider } from './hooks/useApp.jsx';
import { useRoute, Link } from './utils/router.jsx';
import { PieceDefs } from './components/PieceShape.jsx';
import { LoadingScreen } from './components/BrandMark.jsx';
import HomePage from './pages/HomePage.jsx';
import LevelsPage from './pages/LevelsPage.jsx';
import GamePage from './pages/GamePage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import LeaderboardPage from './pages/LeaderboardPage.jsx';
import InstallPage from './pages/InstallPage.jsx';
import { useInstallPrompt } from './hooks/useInstallPrompt.js';
import { activateUpdate, registerServiceWorker } from './services/pwa.js';

// Admin code is split into its own chunk so players never load it up front.
const AdminPage = lazy(() => import('./admin/AdminPage.jsx'));

function NotFound() {
  return (
    <main className="page">
      <div className="empty-state">
        <h1>Page not found</h1>
        <Link to="/" className="btn btn-primary">
          Go home
        </Link>
      </div>
    </main>
  );
}

const PLAY_IN_BROWSER_KEY = 'fitbox.playInBrowser';

function readPlayInBrowser() {
  try {
    return sessionStorage.getItem(PLAY_IN_BROWSER_KEY) === '1';
  } catch {
    return false;
  }
}

function Routes() {
  const route = useRoute();
  const install = useInstallPrompt();
  const [playInBrowser, setPlayInBrowser] = useState(readPlayInBrowser);

  const continueInBrowser = () => {
    try {
      sessionStorage.setItem(PLAY_IN_BROWSER_KEY, '1');
    } catch {
      /* storage unavailable */
    }
    setPlayInBrowser(true);
  };

  if (route.name !== 'admin' && !playInBrowser && (!install.installed || install.justInstalled) && !install.standalone) {
    return <InstallPage onContinue={continueInBrowser} />;
  }

  switch (route.name) {
    case 'home':
      return <HomePage />;
    case 'levels':
      return <LevelsPage />;
    case 'play':
      return <GamePage key={route.params.number} number={route.params.number} />;
    case 'settings':
      return <SettingsPage />;
    case 'account':
      return <AccountPage />;
    case 'leaderboard':
      return <LeaderboardPage />;
    case 'admin':
      return (
        <Suspense fallback={<LoadingScreen label="Loading admin…" />}>
          <AdminPage section={route.params.section} />
        </Suspense>
      );
    default:
      return <NotFound />;
  }
}

function UpdateBanner() {
  const [registration, setRegistration] = useState(null);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    registerServiceWorker({
      onUpdateReady: setRegistration,
      onOfflineReady: () => setOfflineReady(true),
    });
  }, []);

  useEffect(() => {
    if (!offlineReady) return undefined;
    const id = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(id);
  }, [offlineReady]);

  if (registration) {
    return (
      <div className="app-banner" role="status">
        <span>A new version of FitBox is ready.</span>
        <button type="button" className="btn btn-primary btn-small" onClick={() => activateUpdate(registration)}>
          Update
        </button>
      </div>
    );
  }
  if (offlineReady) {
    return (
      <div className="app-banner" role="status">
        <span>FitBox is ready to play offline.</span>
      </div>
    );
  }
  return null;
}

export default function App() {
  return (
    <AppProvider>
      <PieceDefs />
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div id="main" className="app">
        <Routes />
      </div>
      <UpdateBanner />
    </AppProvider>
  );
}
