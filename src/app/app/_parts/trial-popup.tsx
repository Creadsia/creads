"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// «Agrega tu tarjeta» as soon as a new account enters the studio (owner, 25 Oct 2026). Shown to accounts that
// haven't added their card for the free trial; «Ahora no» hides it for this visit (it comes back next time).
// The terms are said plainly: nothing charged today, the date and amount of the first charge, how to cancel.

interface Info { activa: boolean; dias?: number; plan?: string; clp?: number; estado?: string }
const KEY = "creads-trial-popup";
const enDias = (d: number) => new Date(Date.now() + d * 86400_000).toLocaleDateString("es-CL", { day: "numeric", month: "long" });

export default function TrialPopup() {
  const path = usePathname() ?? "";
  const [info, setInfo] = useState<Info | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // coming back from Mercado Pago, the box in Automático checks the card: don't cover it
    if (new URLSearchParams(window.location.search).get("prueba")) return;
    try { if (sessionStorage.getItem(KEY)) return; } catch {}
    fetch("/api/prueba").then((r) => r.json()).then((d: Info) => {
      setInfo(d);
      if (d?.activa && d.estado === "sin-tarjeta") setOpen(true);
    }).catch(() => null);
  }, []);
  useEffect(() => { if (path.startsWith("/app/planes")) setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    btn.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") later(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  function later() {
    try { sessionStorage.setItem(KEY, "1"); } catch {}
    setOpen(false);
  }
  async function agregar() {
    setBusy(true); setErr("");
    const r = await fetch("/api/prueba", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (d.redirect) return void (window.location.href = d.redirect);
    setBusy(false);
    if (d.planes) window.location.href = "/app/planes";
    else setErr(d.error || "No se pudo abrir Mercado Pago. Intenta de nuevo.");
  }

  if (!open || !info) return null;
  const dias = info.dias ?? 7;
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center sm:p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="trial-t">
      <button type="button" aria-label="Cerrar" onClick={later} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full overflow-hidden rounded-t-3xl border border-line bg-surface pb-[max(16px,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl sm:pb-0">
        <span aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full opacity-50 blur-[70px]" style={{ background: "var(--grad)" }} />
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ background: "var(--grad)" }} />
        <span aria-hidden="true" className="mx-auto mt-2.5 block h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="relative flex flex-col gap-4 px-5 pt-4 pb-3 sm:px-6 sm:pt-6">
          <div className="flex items-start justify-between gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[image:var(--grad)] text-2xl shadow-[0_12px_30px_-10px_rgba(255,43,214,0.8)]" aria-hidden="true">🎁</span>
            <button type="button" onClick={later} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">✕</button>
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 id="trial-t" className="font-display text-2xl leading-tight font-semibold">Activa tu prueba gratis de {dias} días</h2>
            <p className="text-[15px] leading-snug text-muted">Agrega tu tarjeta y te cargamos <b className="text-ink">200 créditos de regalo</b> al tiro para hacer tu primer anuncio.</p>
          </div>
          <ul className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3.5 text-sm">
            <li>✓ <b>Hoy no se cobra nada.</b></li>
            <li>✓ Si te gusta, el <b>{enDias(dias)}</b> sigue el plan {info.plan}: <b>${info.clp?.toLocaleString("es-CL")} al mes</b>.</li>
            <li>✓ Si no, cancelas antes en Planes con un clic y no pagas nada.</li>
          </ul>
          <button ref={btn} type="button" onClick={agregar} disabled={busy} className="w-full rounded-xl bg-[image:var(--grad)] px-4 py-3.5 text-base font-bold text-white shadow-[0_14px_36px_-12px_rgba(255,43,214,0.75)] disabled:opacity-60">
            {busy ? "Abriendo Mercado Pago…" : "Agregar tarjeta y empezar gratis"}
          </button>
          {err && <p className="text-sm text-bad" role="alert">{err}</p>}
          <p className="text-center text-xs text-muted">Pagas seguro con Mercado Pago: Creads nunca ve tu tarjeta.</p>
          <button type="button" onClick={later} className="py-1 text-sm font-semibold text-muted hover:text-ink">Ahora no</button>
        </div>
      </div>
    </div>
  );
}
