/** The app logo: a small ring chart on a tile in the theme colours (indigo like the .exe icon by default). */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="brand-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--brand-1)', transition: 'stop-color var(--dur-slow)' }} />
          <stop offset="1" style={{ stopColor: 'var(--brand-2)', transition: 'stop-color var(--dur-slow)' }} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#brand-bg)" />
      <g fill="none" strokeWidth="7" strokeLinecap="round" transform="rotate(-90 32 32)">
        <circle cx="32" cy="32" r="16" stroke="#ffffff" strokeDasharray="38 100.5" />
        <circle cx="32" cy="32" r="16" stroke="#ffffff" strokeOpacity="0.72" strokeDasharray="20 100.5" strokeDashoffset="-49" />
        <circle cx="32" cy="32" r="16" stroke="#ffffff" strokeOpacity="0.45" strokeDasharray="9.5 100.5" strokeDashoffset="-80" />
      </g>
    </svg>
  );
}
