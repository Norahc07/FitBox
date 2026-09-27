import { StarIcon } from './Icons.jsx';

export default function Stars({ count = 0, size = 18, animate = false, className = '' }) {
  return (
    <span className={`stars ${animate ? 'stars-animate' : ''} ${className}`} role="img" aria-label={`${count} of 3 stars`}>
      {[1, 2, 3].map((n) => (
        <StarIcon
          key={n}
          filled={n <= count}
          width={size}
          height={size}
          className={n <= count ? 'star star-on' : 'star star-off'}
          style={animate ? { animationDelay: `${n * 160}ms` } : undefined}
        />
      ))}
    </span>
  );
}
