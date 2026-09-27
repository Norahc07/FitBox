import { useMemo } from 'react';
import { createPortal } from 'react-dom';

const COLORS = ['#f26b1d', '#ffb27a', '#ffffff', '#f59e0b', '#d9560f', '#b8b8bd', '#ffd2ad'];

/** One-shot confetti burst layered above everything (pointer-events: none). */
export default function Confetti({ count = 80 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2.4 + Math.random() * 1.6,
        drift: (Math.random() - 0.5) * 180,
        spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540),
        width: 6 + Math.random() * 6,
        tall: Math.random() < 0.5,
        color: COLORS[i % COLORS.length],
      })),
    [count],
  );
  return createPortal(
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.width,
            height: p.tall ? p.width * 1.8 : p.width,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--drift': `${p.drift}px`,
            '--spin': `${p.spin}deg`,
          }}
        />
      ))}
    </div>,
    document.body,
  );
}
