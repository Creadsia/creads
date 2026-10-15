"use client";

import { useEffect, useState } from "react";
import type { Content } from "@/content/en";

export default function Composer({ t }: { t: Content["composer"] }) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState(t.kinds[0]);
  const [demo, setDemo] = useState(true); // false once the visitor writes their own idea
  const [sent, setSent] = useState(false);

  // Types out example ideas until the visitor focuses the box.
  useEffect(() => {
    if (!demo) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText(t.ideas[0]);
      return;
    }
    let idea = 0;
    let pos = 0;
    let hold = 0;
    const timer = setInterval(() => {
      const full = t.ideas[idea];
      if (pos < full.length) {
        pos += 1;
        setText(full.slice(0, pos));
      } else if (hold < 40) {
        hold += 1;
      } else {
        idea = (idea + 1) % t.ideas.length;
        pos = 0;
        hold = 0;
      }
    }, 38);
    return () => clearInterval(timer);
  }, [demo, t.ideas]);

  function takeOver() {
    if (demo) {
      setDemo(false);
      setText("");
    }
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <form
      onSubmit={create}
      className="relative w-full overflow-hidden rounded-[1.4rem] border border-line bg-surface/90 p-3 text-left shadow-[0_40px_120px_-40px_rgba(139,124,255,0.45)] backdrop-blur"
    >
      <label htmlFor="idea" className="sr-only">
        {t.label}
      </label>
      <textarea
        id="idea"
        rows={3}
        value={text}
        onFocus={takeOver}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.placeholder}
        className="w-full resize-none bg-transparent px-3 pt-2 text-[17px] leading-relaxed outline-none placeholder:text-muted"
      />
      <div className="flex flex-wrap items-center gap-2 px-1 pb-1">
        {t.kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              kind === k ? "border-transparent bg-ink text-bg" : "border-line text-muted hover:text-ink"
            }`}
          >
            {k}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-2 text-sm text-muted">
          <span className="hidden rounded-md bg-surface-2 px-2 py-1 sm:inline">{t.format}</span>
          <span className="hidden rounded-md bg-surface-2 px-2 py-1 sm:inline">{t.language}</span>
          <button
            type="submit"
            className="rounded-xl bg-[image:var(--grad)] px-5 py-2.5 font-semibold text-white shadow-[0_8px_24px_-8px_rgba(255,90,78,0.6)] transition-transform hover:-translate-y-px"
          >
            {t.create}
          </button>
        </span>
      </div>
      {sent && (
        <p role="status" className="border-t border-line px-3 pt-3 pb-1 text-sm">
          {t.sent}
        </p>
      )}
    </form>
  );
}
