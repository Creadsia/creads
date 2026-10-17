"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { askAssistant } from "./assistant";

// "Something failed, your credits are back, try again here": said first, before the customer asks.
// Shows failed jobs of the last 48 h that the customer hasn't dismissed (remembered in this browser).

interface Notice { id: string; what: string; href: string; when: string }
const KEY = "creads-avisos-vistos";

function seen(): string[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}

export default function FailNotices() {
  const [items, setItems] = useState<Notice[]>([]);
  useEffect(() => {
    fetch("/api/avisos")
      .then((r) => r.json())
      .then((d) => { const done = new Set(seen()); setItems((d.items ?? []).filter((n: Notice) => !done.has(n.id))); })
      .catch(() => {});
  }, []);
  if (!items.length) return null;

  function dismiss() {
    try { localStorage.setItem(KEY, JSON.stringify([...seen(), ...items.map((n) => n.id)].slice(-200))); } catch {}
    setItems([]);
  }
  const first = items[0];
  const many = items.length > 1;

  return (
    <div role="status" className="flex flex-col gap-3 rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p>
        <b>{many ? `${items.length} trabajos no se pudieron completar` : `No se pudo completar ${first.what}`}.</b>{" "}
        Ya devolvimos {many ? "esos créditos" : "los créditos"} a tu saldo{many ? "" : "; puedes reintentarlo ahora"}.
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Link href={first.href} onClick={dismiss} className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-accent-ink">Reintentar</Link>
        <button type="button" onClick={() => askAssistant(many ? "Algunos de mis trabajos fallaron, ¿qué pasó y qué hago?" : `Falló ${first.what}, ¿por qué y cómo lo soluciono?`)} className="rounded-lg border border-line bg-surface px-3 py-1.5 font-semibold">¿Por qué falló?</button>
        <button type="button" onClick={dismiss} className="px-2 py-1.5 text-muted hover:text-ink">Entendido</button>
      </div>
    </div>
  );
}
