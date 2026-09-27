import { useState } from 'react';
import { GAME_LOGO_SRC, GAME_WORDMARK_SRC, PoweredBy } from '../components/BrandMark.jsx';
import { useInstallPrompt } from '../hooks/useInstallPrompt.js';
import { platform } from '../services/install.js';

const BENEFITS = ['Plays offline — no internet needed', 'Full screen, no browser bars', 'One tap from your home screen'];

function ShareGlyph() {
  return (
    <svg className="install-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

function Steps({ items }) {
  return (
    <ol className="install-steps">
      {items.map((item, i) => (
        <li key={i}>
          <span className="install-step-num">{i + 1}</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function chromeIntentUrl() {
  const { host, pathname, search } = window.location;
  return `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;end`;
}

function InAppBrowserHelp() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + '/');
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <>
      <p className="install-lead">This page is open inside another app, which can’t install games. Open it in your browser first.</p>
      <Steps
        items={[
          <>
            Tap the <strong>⋯</strong> or <strong>⋮</strong> menu in this app
          </>,
          <>
            Choose <strong>Open in {platform.ios ? 'Safari' : 'Chrome'}</strong> (or “Open in browser”)
          </>,
          <>Install FitBox from there</>,
        ]}
      />
      <div className="install-actions">
        {platform.android ? (
          <a className="btn btn-primary btn-xl" href={chromeIntentUrl()}>
            Open in Chrome
          </a>
        ) : null}
        <button type="button" className={`btn ${platform.android ? 'btn-secondary' : 'btn-primary btn-xl'}`} onClick={copy}>
          {copied ? 'Link copied — paste it in your browser' : 'Copy link'}
        </button>
      </div>
    </>
  );
}

function InstallBody({ install }) {
  const [busy, setBusy] = useState(false);

  if (install.justInstalled) {
    return (
      <p className="install-lead install-done" role="status">
        FitBox is installed! Open it from your home screen or app list for the best experience.
      </p>
    );
  }
  if (platform.inAppBrowser) return <InAppBrowserHelp />;
  if (install.canInstall) {
    const onInstall = async () => {
      setBusy(true);
      try {
        await install.install();
      } finally {
        setBusy(false);
      }
    };
    return (
      <>
        <p className="install-lead">Install FitBox for free and play anytime — even offline.</p>
        <div className="install-actions">
          <button type="button" className="btn btn-primary btn-xl btn-next" onClick={onInstall} disabled={busy} data-autofocus>
            Install FitBox
          </button>
        </div>
      </>
    );
  }
  if (platform.ios) {
    return (
      <>
        <p className="install-lead">Add FitBox to your Home Screen to install it.</p>
        <Steps
          items={[
            <>
              Tap the <strong>Share</strong> button <ShareGlyph /> in the browser bar
            </>,
            <>
              Scroll down and tap <strong>Add to Home Screen</strong>
            </>,
            <>
              Tap <strong>Add</strong>, then open FitBox from your Home Screen
            </>,
          ]}
        />
      </>
    );
  }
  return (
    <>
      <p className="install-lead">Install FitBox from your browser menu.</p>
      <Steps
        items={[
          <>
            Open the browser menu (<strong>⋮</strong> or <strong>…</strong>)
          </>,
          <>
            Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>
          </>,
          <>Open FitBox from your home screen or app list</>,
        ]}
      />
      <p className="install-note">No install option? Your browser may not support installing apps — try Chrome, Edge or Safari.</p>
    </>
  );
}

/** Install-first welcome screen shown when FitBox is opened in a browser and is not installed. */
export default function InstallPage({ onContinue }) {
  const install = useInstallPrompt();
  return (
    <main className="page install-page">
      <section className="install-hero">
        <div className="brand-lockup">
          <img className="logo-box" src={GAME_LOGO_SRC} alt="" width="150" height="150" />
          <h1 className="brand">
            <img className="brand-wordmark" src={GAME_WORDMARK_SRC} alt="FitBox — Brain Teaser" width="900" height="239" />
          </h1>
        </div>
      </section>

      <section className="card install-card" aria-label="Install FitBox">
        <InstallBody install={install} />
        {!install.justInstalled ? (
          <ul className="install-benefits">
            {BENEFITS.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <button type="button" className="btn btn-ghost install-skip" onClick={onContinue}>
        {install.justInstalled ? 'Continue here' : 'Play in browser instead'}
      </button>

      <footer className="home-footer">
        <PoweredBy showVersion />
      </footer>
    </main>
  );
}
