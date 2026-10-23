"use client";

import { useEffect, useState } from "react";

// «Empezar de cero»: the dashboards count only from a chosen moment (nothing is deleted). Shown on top of
// Resultados de campañas, Suscripciones y retención and Nuevas cuentas.

export default function DesdeCero({ onChange }: { onChange?: () => void }) {
  const [d, setD] = useState<{ desde: string | null; pruebas: string[] } | null>(null);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/admin/desde").then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => {}); }, []);
  const post = async (desde: "ahora" | null) => {
    setBusy(true);
    const r = await fetch("/api/admin/desde", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ desde }) }).catch(() => null);
    setBusy(false); setAsk(false);
    if (r?.ok) { setD(await r.json()); onChange?.(); }
  };
  if (!d) return null;
  const when = d.desde ? new Date(d.desde).toLocaleString("es-CL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
      <span>{when ? <>Contando desde <b>{when}</b>{d.pruebas.length ? ` · ${d.pruebas.length} ${d.pruebas.length === 1 ? "cuenta de prueba fuera" : "cuentas de prueba fuera"}` : ""}</> : <>Contando <b>todo el historial</b>{d.pruebas.length ? ` · ${d.pruebas.length} de prueba fuera` : ""}</>}</span>
      {ask ? (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Los tableros parten en cero desde este momento. No se borra nada.</span>
          <button type="button" onClick={() => post("ahora")} disabled={busy} className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-bg disabled:opacity-50">Sí, desde ahora</button>
          <button type="button" onClick={() => setAsk(false)} className="text-xs text-muted underline">Cancelar</button>
        </span>
      ) : (
        <span className="flex gap-3">
          <button type="button" onClick={() => setAsk(true)} className="text-xs font-semibold underline">Empezar de cero</button>
          {d.desde && <button type="button" onClick={() => post(null)} disabled={busy} className="text-xs text-muted underline">Ver todo el historial</button>}
        </span>
      )}
    </div>
  );
}
