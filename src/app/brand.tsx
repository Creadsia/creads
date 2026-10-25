// Creads IA mark: a camera viewfinder (the frame every ad lives in) around a play signal split into
// magenta and cyan channels — video made by AI. Drawn in currentColor so it works in both themes.
// `gid` is kept for compatibility with callers that pass a unique id; the mark no longer uses gradients.
export function Mark({ size = 32, className }: { size?: number; className?: string; gid?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className={className}>
      <g fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round">
        <path d="M6 21V11a5 5 0 0 1 5-5h10" />
        <path d="M43 6h10a5 5 0 0 1 5 5v10" />
        <path d="M58 43v10a5 5 0 0 1-5 5H43" />
        <path d="M21 58H11a5 5 0 0 1-5-5V43" />
      </g>
      <path d="M25.5 20.5 45 32 25.5 43.5Z" fill="#FF2BD6" transform="translate(-2.6 0)" strokeLinejoin="round" />
      <path d="M25.5 20.5 45 32 25.5 43.5Z" fill="#19E3FF" transform="translate(2.6 0)" strokeLinejoin="round" />
      <path d="M25.5 20.5 45 32 25.5 43.5Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-1.5 ${className}`}>
      <span className="font-display text-[1.3rem] leading-none sm:text-[1.55rem] font-semibold tracking-[-0.05em]">creads</span>
      <span className="rounded-[5px] bg-[image:var(--grad)] px-1.5 py-[3px] font-display text-[0.7rem] sm:text-[0.78rem] leading-none font-bold tracking-tight text-black">IA</span>
    </span>
  );
}

export function Logo({ size = 36, href = "/" }: { size?: number; href?: string; gid?: string }) {
  return (
    <a href={href} className="flex min-h-11 items-center gap-2.5" aria-label="Creads IA">
      <Mark size={size} className="h-[30px] w-[30px] sm:h-auto sm:w-auto" />
      <Wordmark />
    </a>
  );
}
