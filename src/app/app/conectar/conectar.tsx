"use client";

import { useState } from "react";
import { btnCls, cardCls, ghostCls } from "../_parts/ui";

// «Claude quiere usar tu cuenta de Creads»: what the app may do, and the two buttons.
export default function Conectar({ app, host, req }: { app: string; host: string; req: Record<string, string> }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  async function decide(decision: "allow" | "deny") {
    setBusy(decision); setErr("");
    try {
      const r = await fetch("/api/oauth/authorize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...req, decision }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.redirect) throw new Error(d.error || "No se pudo conectar.");
      window.location.href = d.redirect;
    } catch (x) { setErr(x instanceof Error ? x.message : "No se pudo conectar."); setBusy(""); }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 py-6">
      <section className={`${cardCls} flex flex-col gap-5`} aria-labelledby="h-conectar">
        <div className="flex flex-col gap-2">
          <h1 id="h-conectar" className="text-2xl font-extrabold leading-tight">{app} quiere usar tu cuenta de Creads</h1>
          <p className="text-[15px] text-muted">Al autorizar, {app} podrá trabajar con Creads desde el chat, con tu cuenta.</p>
        </div>
        <ul className="flex flex-col gap-2.5 text-[15px]">
          <li className="flex gap-2.5"><span aria-hidden="true" className="text-good">✓</span><span>Crear imágenes y anuncios en video. <b>Usan los créditos de tu cuenta</b>, igual que en el estudio.</span></li>
          <li className="flex gap-2.5"><span aria-hidden="true" className="text-good">✓</span><span>Ver tus anuncios, su avance y tu saldo de video.</span></li>
          <li className="flex gap-2.5"><span aria-hidden="true" className="text-muted">✕</span><span className="text-muted">No puede ver tu clave, tus pagos ni a tu equipo, ni comprar créditos.</span></li>
        </ul>
        <p className="text-sm text-muted">Puedes desconectarla cuando quieras en <b className="text-ink">API para sistemas</b>. Vas a volver a <b className="text-ink">{host}</b>.</p>
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        <div className="flex flex-wrap gap-2.5">
          <button type="button" className={btnCls} disabled={Boolean(busy)} onClick={() => decide("allow")}>{busy === "allow" ? "Conectando…" : "Autorizar"}</button>
          <button type="button" className={ghostCls} disabled={Boolean(busy)} onClick={() => decide("deny")}>Cancelar</button>
        </div>
      </section>
    </div>
  );
}
