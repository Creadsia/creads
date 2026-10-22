"use client";

import { useEffect, useState } from "react";

// «Que suene el celular»: turn on push alerts for every sale (ntfy app), see the channel to subscribe to, send a test.

export default function AvisosCelular() {
  const [c, setC] = useState<{ topic: string | null; on: boolean } | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/admin/avisos-celular").then((r) => (r.ok ? r.json() : null)).then(setC).catch(() => {}); }, []);
  const post = async (body: object, ok?: string) => {
    setBusy(true); setMsg("");
    const r = await fetch("/api/admin/avisos-celular", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) return setMsg(d.error || "No se pudo.");
    if ("topic" in d) setC(d);
    if (ok) setMsg(ok);
  };
  if (!c) return null;
  const btn = "rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50";
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5" aria-labelledby="cel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="cel" className="font-semibold">🔔 Que suene el celular con cada venta</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.on ? "bg-good/15 text-good" : "bg-surface-2 text-muted"}`}>{c.on ? "Activado" : "Apagado"}</span>
      </div>
      {!c.on ? (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-muted">Te llega un aviso con sonido cada vez que alguien compra, se renueva un plan o alguien cancela. Gratis, con la app <b>ntfy</b>.</p>
          <button type="button" onClick={() => post({ on: true })} disabled={busy} className="w-fit rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50">Activar avisos</button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          <ol className="flex list-decimal flex-col gap-1 pl-5">
            <li>Instala la app <b>ntfy</b> en tu celular (App Store o Google Play, es gratis).</li>
            <li>Ábrela, toca <b>+</b> (suscribirse) y escribe este canal exacto: <code className="rounded bg-surface-2 px-1.5 py-0.5 select-all" data-private>{c.topic}</code></li>
            <li>Toca <b>Probar</b> aquí abajo: tu celular debería sonar en unos segundos.</li>
          </ol>
          <p className="text-xs text-muted">El canal es privado: no lo compartas (quien lo tenga ve tus avisos). Solo viaja el plan y el monto, nunca datos del cliente. En la app puedes elegir el sonido (por ejemplo, una caja registradora).</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => post({ probar: true }, "Listo: revisa tu celular.")} disabled={busy} className={btn}>Probar</button>
            <button type="button" onClick={() => post({ on: false }, "Avisos apagados.")} disabled={busy} className={btn}>Apagar</button>
            <button type="button" onClick={() => post({ on: true, nuevo: true }, "Canal nuevo: suscríbete de nuevo en la app.")} disabled={busy} className={btn}>Cambiar canal</button>
          </div>
        </div>
      )}
      {msg && <p className="text-sm text-muted" role="status">{msg}</p>}
    </section>
  );
}
