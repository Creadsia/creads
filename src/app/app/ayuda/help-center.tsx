"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HELP, HELP_CATS, type HelpCat, searchHelp } from "@/lib/help";
import { askAssistant } from "../_parts/assistant";
import { inputCls } from "../_parts/ui";

// Searchable answers, grouped by topic; anything not covered goes to the assistant with the same words.
export default function HelpCenter() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<HelpCat | "all">("all");
  const found = useMemo(() => {
    const byCat = cat === "all" ? HELP : HELP.filter((h) => h.cat === cat);
    return q.trim() ? searchHelp(q, byCat) : byCat;
  }, [q, cat]);
  const groups = HELP_CATS.map((c) => ({ ...c, items: found.filter((h) => h.cat === c.id) })).filter((g) => g.items.length);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <label htmlFor="ayuda-q" className="font-semibold">¿En qué te ayudamos?</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="ayuda-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej: créditos, clonar mi voz, falló mi video…" className={`${inputCls} flex-1 py-2.5 text-base`} />
          <button type="button" onClick={() => askAssistant(q.trim() || undefined)} className="rounded-lg bg-[image:var(--grad)] px-4 py-2.5 text-sm font-semibold text-white">
            {q.trim() ? "Preguntarle al asistente" : "Hablar con el asistente"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Temas">
          {[{ id: "all" as const, label: "Todo" }, ...HELP_CATS].map((c) => (
            <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${cat === c.id ? "border-accent bg-accent/10 text-ink" : "border-line text-muted hover:text-ink"}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line p-6">
          <p className="text-sm text-muted">No encontramos «{q}» en las preguntas frecuentes.</p>
          <button type="button" onClick={() => askAssistant(q)} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">Preguntarle al asistente</button>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.id} aria-labelledby={`cat-${g.id}`} className="flex flex-col gap-2">
            <h2 id={`cat-${g.id}`} className="text-sm font-semibold text-muted">{g.label}</h2>
            <div className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {g.items.map((h) => (
                <details key={h.id} id={h.id} className="group" open={Boolean(q.trim()) && found.length <= 3}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 font-medium hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                    {h.q}
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                  </summary>
                  <div className="flex flex-col items-start gap-3 px-4 pb-4 text-sm leading-relaxed text-muted">
                    <p className="max-w-[70ch]">{h.a}</p>
                    {h.link && <Link href={h.link.href} className="rounded-lg border border-line px-3 py-1.5 font-semibold text-ink hover:bg-surface-2">{h.link.label} →</Link>}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))
      )}

      <p className="text-sm text-muted">¿Algo que el asistente no pudo resolver? Escríbenos a <a href="mailto:hola@creadsia.com" className="underline">hola@creadsia.com</a> y cuéntanos qué pasó (si te apareció un código de referencia, inclúyelo).</p>
    </div>
  );
}
