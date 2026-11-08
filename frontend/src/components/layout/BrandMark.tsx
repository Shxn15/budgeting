/** The app logo: a small ring chart on an indigo tile (same design as the .exe icon). */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="brand-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d6af7" />
          <stop offset="1" stopColor="#4338ca" />
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
