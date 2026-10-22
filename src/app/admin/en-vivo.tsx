"use client";

import { useEffect, useState } from "react";

// «Mirando ahora»: how many people have Creads open this minute, and where (see lib/presence.ts).
// Sits at the top of the Panel and refreshes every 15 s.

interface Live { total: number; paginas: { k: string; nombre: string; n: number }[] }

export default function EnVivo() {
  const [d, setD] = useState<Live | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    const get = () => fetch("/api/admin/presencia").then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive && j) setD(j); }).catch(() => {});
    get();
    const t = setInterval(() => { if (document.visibilityState === "visible") get(); }, 15_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  if (!d) return null;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2">
        <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
          {d.total > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60 motion-reduce:animate-none" />}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${d.total > 0 ? "bg-good" : "bg-muted"}`} />
        </span>
        <span className="tabular-nums">{d.total}</span> {d.total === 1 ? "persona mirando" : "personas mirando"}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-line bg-surface p-3 text-sm shadow-xl">
          <p className="mb-2 font-semibold">En Creads ahora mismo</p>
          {d.paginas.length === 0 ? <p className="text-muted">Nadie en este minuto.</p> : (
            <ul className="flex flex-col gap-1.5">
              {d.paginas.map((p) => (
                <li key={p.k} className="flex items-center justify-between gap-3">
                  <span>{p.nombre}</span><b className="tabular-nums">{p.n}</b>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">Pestañas abiertas en el último minuto. Las tuyas y las de tu equipo no cuentan cuando tienen la sesión iniciada. Se actualiza cada 15 segundos. Para ver qué hace cada persona, usa las grabaciones de PostHog.</p>
        </div>
      )}
    </div>
  );
}
