// Creads mark: a "C" made of four cuts — the way Creads builds every video — with a REC dot at the opening.
// `gid` must be unique when several marks are on the page (a hidden SVG can't lend its gradient to others).
export function Mark({ size = 32, className, gid = "creads-mark" }: { size?: number; className?: string; gid?: string }) {
  return (
    <svg viewBox="0 0 64 60" width={size} height={(size * 60) / 64} aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="8" y1="6" x2="48" y2="54">
          <stop offset="0" stopColor="#8B7CFF" />
          <stop offset=".55" stopColor="#E06CC8" />
          <stop offset="1" stopColor="#FF8A5C" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${gid})`} strokeWidth="11">
        <path d="M44.55 17.79A19 19 0 0 0 25.89 11.45" />
        <path d="M22.73 12.45A19 19 0 0 0 11.07 28.34" />
        <path d="M11.07 31.66A19 19 0 0 0 22.73 47.55" />
        <path d="M25.89 48.55A19 19 0 0 0 44.55 42.21" />
      </g>
      <circle cx="51" cy="30" r="7" fill="#FF5A4E" />
    </svg>
  );
}

export function Logo({ size = 30, href = "/", gid }: { size?: number; href?: string; gid?: string }) {
  return (
    <a href={href} className="flex items-center gap-2.5" aria-label="Creads">
      <Mark size={size} gid={gid} />
      <span className="font-display text-[1.35rem] font-black tracking-[-0.03em] [font-stretch:118%]">creads</span>
    </a>
  );
}
