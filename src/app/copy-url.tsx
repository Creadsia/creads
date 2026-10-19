"use client";

import { useState } from "react";

// The connector address with a copy button (home page).
export default function CopyUrl({ url, copy, copied }: { url: string; copy: string; copied: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-line bg-surface-2 p-1.5 pl-4">
      <code className="min-w-0 flex-1 truncate font-mono text-sm sm:text-[15px]">{url}</code>
      <button
        type="button"
        onClick={() => { navigator.clipboard.writeText(url).then(() => { setDone(true); setTimeout(() => setDone(false), 1800); }).catch(() => {}); }}
        className="shrink-0 rounded-lg bg-ink px-3.5 py-2 text-sm font-semibold text-bg"
      >
        {done ? copied : copy}
      </button>
    </div>
  );
}
