export const BRAND_MARK_SRC = '/brand/fenix-mark.png';
export const GAME_LOGO_SRC = '/brand/fitbox-logo.png';
export const GAME_WORDMARK_SRC = '/brand/fitbox-wordmark.png';

export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '';

/** "Powered by Fenix Innolabs" originality mark, optionally with the app version beneath it. */
export function PoweredBy({ size = 24, className = '', showVersion = false }) {
  const mark = (
    <p className={`powered-by ${showVersion ? '' : className}`.trim()}>
      <img className="origin-mark" src={BRAND_MARK_SRC} alt="" width={size} height={size} />
      <span>
        Powered by <strong>Fenix Innolabs</strong>
      </span>
    </p>
  );
  if (!showVersion || !APP_VERSION) return mark;
  return (
    <div className={`powered-by-block ${className}`.trim()}>
      {mark}
      <p className="app-version">Version {APP_VERSION}</p>
    </div>
  );
}

/** Full-screen loading state with the pulsing game logo. */
export function LoadingScreen({ label = 'Loading…' }) {
  return (
    <main className="page page-loading" aria-busy="true">
      <img className="loading-mark" src={GAME_LOGO_SRC} alt="" width="96" height="96" />
      <p className="sr-only" role="status">
        {label}
      </p>
    </main>
  );
}
