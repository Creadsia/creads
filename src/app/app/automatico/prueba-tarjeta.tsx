"use client";

import { useEffect, useState } from "react";
import { refreshCredits } from "../_parts/use-credits";

/** The plan chosen at /empezar travels as ?plan= (Google sign-up lands here with it). */
const planQs = () => { try { const p = new URLSearchParams(window.location.search).get("plan"); return p && /^[a-z]+$/.test(p) ? `?plan=${p}` : ""; } catch { return ""; } };

// «Prueba gratis con tarjeta» (owner, 25 Oct 2026; required at sign-up since 26 Oct 2026). Above Automático while
// the card trial is on: the way back from Mercado Pago and the trial's status. Nothing is charged today; the date,
// plan and price of the first charge are said plainly before and after, with how to cancel.

interface Info { activa: boolean; dias?: number; regalo?: number; plan?: string; clp?: number; usd?: number; credits?: number; estado?: "pagado" | "en-prueba" | "usada" | "sin-tarjeta" | "regalo-previo"; cobro?: string | null }

const fecha = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "long" });
const enDias = (d: number) => fecha(new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10));

export default function PruebaTarjeta() {
  const [info, setInfo] = useState<Info | null>(null);
  const [vuelta, setVuelta] = useState<"" | "revisando" | "ok" | "pendiente" | "cancelado" | "no">("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    const d = await fetch(`/api/prueba${planQs()}`).then((r) => r.json()).catch(() => null);
    setInfo(d);
  }
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    // Mercado Pago may glue «?preapproval_id=…» onto our own query
    const pedido = (sp.get("prueba") ?? "").split("?")[0];
    if (pedido) {
      window.history.replaceState(null, "", "/app/automatico");
      setVuelta("revisando");
      const check = (n: number) =>
        fetch("/api/prueba", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pedido }) })
          .then((r) => r.json())
          .then((d) => {
            // the card can take a few seconds to show as accepted
            if (d.estado === "pendiente" && n < 5) return void setTimeout(() => check(n + 1), 3000);
            setVuelta(d.estado ?? "no"); refreshCredits(); load();
            if (d.estado === "ok") window.dispatchEvent(new Event("creads:prueba-ok"));
          })
          .catch(() => setVuelta("pendiente"));
      check(0);
    } else load();
  }, []);

  async function agregar() {
    setBusy(true); setErr("");
    const r = await fetch("/api/prueba", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan: planQs().slice(6) || undefined }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (d.redirect) return void (window.location.href = d.redirect);
    setBusy(false);
    if (d.planes) window.location.href = "/app/planes";
    else setErr(d.error || "No se pudo abrir Mercado Pago. Intenta de nuevo.");
  }

  if (vuelta === "revisando") return <p className="mb-4 rounded-xl border border-line bg-surface p-4 text-sm">Revisando tu tarjeta con Mercado Pago…</p>;
  if (vuelta === "ok") return (
    <div className="mb-4 flex flex-col gap-1 rounded-xl border border-good/40 bg-good/10 p-4 text-sm">
      <b>¡Listo! Tu prueba gratis está activa y te cargamos tus créditos de regalo.</b>
      <span>Cuéntale a Creads aquí abajo qué vendes y te hace tu primer anuncio. {info?.cobro && <>El {fecha(info.cobro)} se cobra el plan {info.plan}; puedes cancelar antes en <a href="/app/planes" className="underline">Planes</a>.</>}</span>
    </div>
  );
  if (!info?.activa) return null;
  if (info.estado === "en-prueba" && info.cobro) return (
    <p className="mb-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
      Prueba gratis activa. El <b className="text-ink">{fecha(info.cobro)}</b> se cobra el plan {info.plan} (US${info.usd?.toLocaleString("es-CL")} al mes) salvo que canceles antes en <a href="/app/planes" className="underline">Planes</a>.
    </p>
  );
  // before the card, the conversation comes first: the window opens after the scripts (trial-popup)
  if (info.estado !== "sin-tarjeta" || !(vuelta === "pendiente" || vuelta === "cancelado")) return null;
  const dias = info.dias ?? 7;
  return (
    <section className="relative mb-4 flex flex-col gap-3 overflow-hidden rounded-2xl border-2 border-transparent p-4 [background:linear-gradient(var(--color-surface),var(--color-surface))_padding-box,var(--grad)_border-box] sm:p-5" aria-labelledby="prueba-t">
      <div className="flex flex-col gap-1">
        <h2 id="prueba-t" className="font-display text-lg leading-tight font-semibold">Activa tu prueba gratis de {dias} días</h2>
        <p className="text-sm text-muted">Agrega tu tarjeta en Mercado Pago y te cargamos <b className="text-ink">{info.regalo ?? 200} créditos de regalo</b> al tiro para tus primeros anuncios. {vuelta === "pendiente" ? "Si ya la agregaste, Mercado Pago la está revisando: recarga en un minuto." : ""}</p>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        <li>✓ <b>Hoy no se cobra nada.</b></li>
        <li>✓ Si te gusta, el <b>{enDias(dias)}</b> se cobra el plan {info.plan}: <b>US${info.usd?.toLocaleString("es-CL")} al mes</b> ({info.credits} créditos cada mes).</li>
        <li>✓ Si no, cancelas antes en Planes con un clic y no pagas nada.</li>
      </ul>
      <button type="button" onClick={agregar} disabled={busy} className="w-full rounded-xl bg-[image:var(--grad)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60 sm:w-fit">{busy ? "Abriendo Mercado Pago…" : "Agregar tarjeta y empezar gratis"}</button>
      <p className="text-xs text-muted">Tu tarjeta la guarda Mercado Pago: Creads nunca la ve. {vuelta === "cancelado" && "La prueba anterior quedó cancelada; puedes intentarlo de nuevo."}</p>
      {err && <p className="text-sm text-bad" role="alert">{err}</p>}
    </section>
  );
}
