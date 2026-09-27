const STAR_PATH = 'M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95z';
const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315];

export const STAR_START_MS = 450;
export const STAR_STEP_MS = 520;
export const STAR_FILL_MS = 460;

/** Moment (ms after the modal opens) at which star `index` finishes filling. */
export function starLandsAt(index) {
  return STAR_START_MS + index * STAR_STEP_MS + STAR_FILL_MS;
}

export default function CelebrationStars({ count = 0 }) {
  return (
    <div className="celebration-stars" role="img" aria-label={`${count} of 3 stars`}>
      {[0, 1, 2].map((i) => {
        const earned = i < count;
        return (
          <span
            key={i}
            className={`cstar ${i === 1 ? 'cstar-center' : ''} ${earned ? 'cstar-earned' : 'cstar-missed'}`}
            style={{ '--i': i, '--d': `${STAR_START_MS + i * STAR_STEP_MS}ms`, '--fill': `${STAR_FILL_MS}ms` }}
            aria-hidden="true"
          >
            <svg className="cstar-empty" viewBox="0 0 24 24">
              <path d={STAR_PATH} />
            </svg>
            {earned ? (
              <>
                <span className="cstar-ring" />
                <svg className="cstar-fill" viewBox="0 0 24 24">
                  <defs>
                    <linearGradient id={`cstar-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#ffd2ad" />
                      <stop offset="0.45" stopColor="#ff8a47" />
                      <stop offset="1" stopColor="#d9560f" />
                    </linearGradient>
                  </defs>
                  <path d={STAR_PATH} fill={`url(#cstar-grad-${i})`} />
                  <path className="cstar-shine" d="M8.2 9.3l2.4-.35L12 6" />
                </svg>
                <span className="cstar-sparks">
                  {SPARKS.map((deg) => (
                    <span key={deg} style={{ '--a': `${deg}deg` }} />
                  ))}
                </span>
              </>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
