"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import TarjetaMP from "../../tarjeta-mp";

/** The plan chosen at /empezar travels as ?plan= (Google sign-up lands here with it). */
const planQs = () => { try { const p = new URLSearchParams(window.location.search).get("plan"); return p && /^[a-z]+$/.test(p) ? `?plan=${p}` : ""; } catch { return ""; } };

// «Tarjeta para registrarse» (owner, 25 Oct 2026: «igual que ChatGPT o Higgsfield»; required for every new account
// since 26 Oct 2026): an account that never paid and never got its gift can't use the studio until it adds its card
// for the free trial (the rule: lib/oferta.ts bloqueaPorTarjeta, applied by GET /api/prueba → estado «sin-tarjeta»).
// Covers email and Google sign-ups alike, and accounts created before that left without the card. Full screen, no
// close; only «Prefiero elegir un plan» (to pay a plan directly) and «Salir». The terms are said plainly: nothing
// today, the date, plan and price of the first charge (in US$, the pesos once next to the card form).

interface Info { activa: boolean; dias?: number; regalo?: number; plan?: string; usd?: number; credits?: number; clp?: number; estado?: string }
const enDias = (d: number) => new Date(Date.now() + d * 86400_000).toLocaleDateString("es-CL", { day: "numeric", month: "long" });

export default function TrialPopup() {
  const path = usePathname() ?? "";
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    const vuelta = new URLSearchParams(window.location.search).get("prueba");
    // back from Mercado Pago: the card can take a few seconds to show as accepted
    const load = (n: number) => fetch(`/api/prueba${planQs()}`).then((r) => r.json()).then((d: Info) => {
      if (!alive) return;
      if (vuelta && d?.estado === "sin-tarjeta" && n < 8) return void setTimeout(() => load(n + 1), 3000);
      setInfo(d);
    }).catch(() => null);
    load(0);
    const ok = () => load(8);
    window.addEventListener("creads:prueba-ok", ok);
    return () => { alive = false; window.removeEventListener("creads:prueba-ok", ok); };
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
  async function salir() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/";
  }

  if (!info?.activa || info.estado !== "sin-tarjeta" || path.startsWith("/app/planes")) return null;
  const dias = info.dias ?? 7;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="trial-t">
      <div className="relative max-h-[100dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface pb-[max(16px,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[92dvh] sm:max-w-md sm:rounded-3xl sm:pb-0">
        <span aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full opacity-50 blur-[70px]" style={{ background: "var(--grad)" }} />
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ background: "var(--grad)" }} />
        <div className="relative flex flex-col gap-4 px-5 pt-6 pb-3 sm:px-6">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[image:var(--grad)] text-2xl shadow-[0_12px_30px_-10px_rgba(255,43,214,0.8)]" aria-hidden="true">🎁</span>
          <div className="flex flex-col gap-1.5">
            <h2 id="trial-t" className="font-display text-2xl leading-tight font-semibold">Último paso: activa tu prueba gratis de {dias} días</h2>
            <p className="text-[15px] leading-snug text-muted">Agrega tu tarjeta y entras al tiro con <b className="text-ink">{info.regalo ?? 200} créditos de regalo</b> para tus primeros anuncios. Hoy no se cobra nada.</p>
          </div>
          <ul className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3.5 text-sm">
            <li className="flex justify-between gap-3"><span>Hoy</span><b>$0</b></li>
            <li className="flex justify-between gap-3"><span>Créditos de regalo</span><b>{info.regalo ?? 200}</b></li>
            <li className="flex justify-between gap-3"><span>Desde el {enDias(dias)} · Plan {info.plan}</span><b className="whitespace-nowrap">US${info.usd?.toLocaleString("es-CL")}/mes</b></li>
            <li className="text-muted">{info.credits ? `${info.credits} créditos cada mes. ` : ""}{info.clp ? `Mercado Pago lo cobra en pesos: $${info.clp.toLocaleString("es-CL")} al mes. ` : ""}Cancelas cuando quieras en Planes, antes del cobro, con un clic.</li>
          </ul>
          <TarjetaMP monto={info.clp ?? 1} onListo={() => { window.location.href = "/app/automatico?bienvenida=1"; }} fallback={
            <button type="button" onClick={agregar} disabled={busy} className="w-full rounded-xl bg-[image:var(--grad)] px-4 py-3.5 text-base font-bold text-white shadow-[0_14px_36px_-12px_rgba(255,43,214,0.75)] disabled:opacity-60">
              {busy ? "Abriendo Mercado Pago…" : "Agregar tarjeta · hoy $0"}
            </button>
          } />
          {err && <p className="text-sm text-bad" role="alert">{err}</p>}
          <p className="text-center text-xs text-muted">Pagas seguro con Mercado Pago: Creads nunca ve tu tarjeta.</p>
          <div className="flex justify-center gap-4 pb-1 text-sm font-semibold text-muted">
            <a href="/app/planes" className="hover:text-ink">Prefiero elegir un plan</a>
            <button type="button" onClick={salir} className="hover:text-ink">Salir</button>
          </div>
        </div>
      </div>
    </div>
  );
}
