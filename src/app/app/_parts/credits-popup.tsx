"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCredits } from "./use-credits";

// «Se te acabaron los créditos» (owner, 24 Oct 2026): the moment a customer runs out (or is about to), an
// on-brand sheet offers the next step: a plan for those who never paid (or the US$9 trial video), a top-up or
// a bigger plan for those who did. A bottom sheet on phones, a centred card on computers. It shows at most
// once a day per state, never on «Planes», and right away when a job is refused for lack of credits (402).

const LOW = 120; // under ≈ 10 s of video: not enough for a full ad
const KEY = "creads-popup-creditos";

function seenToday(state: string) {
  try { return localStorage.getItem(KEY) === `${state}:${new Date().toISOString().slice(0, 10)}`; } catch { return false; }
}
function markSeen(state: string) {
  try { localStorage.setItem(KEY, `${state}:${new Date().toISOString().slice(0, 10)}`); } catch {}
}

// any request refused for lack of credits opens the sheet (installed once per page)
let patched = false;
function watch402() {
  if (patched || typeof window === "undefined") return;
  patched = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const r = await orig(...args);
    if (r.status === 402) window.dispatchEvent(new Event("creads:sin-creditos"));
    return r;
  };
}

type Opt = { href: string; title: string; text: string; tag?: string; hot?: boolean };

export default function CreditsPopup() {
  const { info } = useCredits();
  const path = usePathname() ?? "";
  const [open, setOpen] = useState<null | "agotado" | "poco">(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    watch402();
    const on = () => { if (!path.startsWith("/app/planes")) setOpen("agotado"); };
    window.addEventListener("creads:sin-creditos", on);
    return () => window.removeEventListener("creads:sin-creditos", on);
  }, [path]);

  useEffect(() => {
    if (!info || info.unlimited || info.owner || path.startsWith("/app/planes")) return;
    const bal = info.balance ?? 0;
    const state = bal <= 0 || info.expired ? "agotado" : bal < LOW ? "poco" : null;
    if (state && !seenToday(state)) setOpen(state);
  }, [info, path]);

  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !info) return null;
  function close() { if (open) markSeen(open); setOpen(null); }

  const bal = Math.max(0, info.balance ?? 0);
  const paid = Boolean(info.plan || info.paidUntil);
  const opts: Opt[] = !paid
    ? [
        { href: "/app/planes?plan=starter", title: "Emprende · US$55 al mes", text: "1.500 créditos: ≈ 8 anuncios de 15 s al mes.", hot: true },
        { href: "/app/planes?plan=basico", title: "Básico · US$25 al mes", text: "500 créditos: ≈ 2 anuncios de 15 s al mes." },
        { href: "/app/planes?plan=pack-prueba", title: "Video de prueba · US$9", text: "Un anuncio más de 15 s. Un solo pago, sin plan." },
      ]
    : info.expired
      ? [{ href: "/app/planes", title: "Renovar mi plan", text: "Tus anuncios y archivos siguen aquí.", hot: true }]
      : [
          { href: "/app/planes?plan=pack-1000", title: "Recargar créditos", text: "Desde US$29 · se suman al tiro a tu saldo.", hot: true },
          { href: "/app/planes?plan=plus", title: "Subir a Negocio · US$99", text: "3.000 créditos al mes: ≈ 17 anuncios de 15 s." },
        ];
  const title = open === "poco" ? "Te quedan pocos créditos" : info.expired ? "Tu plan venció" : "Se te acabaron los créditos";
  const lead = open === "poco"
    ? `Tienes ${bal.toLocaleString("es-CL")} créditos: no alcanza para un anuncio completo. Suma ahora y no te quedes a medias.`
    : paid ? "Tu próximo anuncio te está esperando. Suma créditos y sigues al tiro." : "Ya viste lo que hace Creads. Elige cómo seguir creando anuncios que venden:";
  const pct = Math.min(100, Math.round((bal / LOW) * 100));

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="pop-cred-t">
      <button type="button" aria-label="Cerrar" onClick={close} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full overflow-hidden rounded-t-3xl border border-line bg-surface pb-[max(16px,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl sm:pb-0">
        {/* glow and the brand gradient line */}
        <span aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full opacity-50 blur-[70px]" style={{ background: "var(--grad)" }} />
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ background: "var(--grad)" }} />
        <span aria-hidden="true" className="mx-auto mt-2.5 block h-1 w-10 rounded-full bg-line sm:hidden" />

        <div className="relative flex flex-col gap-4 px-5 pt-4 pb-2 sm:px-6 sm:pt-6">
          <div className="flex items-start justify-between gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[image:var(--grad)] text-2xl shadow-[0_12px_30px_-10px_rgba(255,43,214,0.8)]" aria-hidden="true">⚡</span>
            <button ref={closeBtn} type="button" onClick={close} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">✕</button>
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 id="pop-cred-t" className="font-display text-2xl leading-tight font-semibold">{title}</h2>
            <p className="text-[15px] leading-snug text-muted">{lead}</p>
          </div>
          {/* the meter */}
          <div className="flex flex-col gap-1">
            <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${Math.max(pct, 3)}%`, background: "var(--grad)" }} /></div>
            <span className="text-xs text-muted tabular-nums">{bal.toLocaleString("es-CL")} créditos disponibles</span>
          </div>
          <ul className="flex flex-col gap-2">
            {opts.map((o) => (
              <li key={o.href}>
                <Link href={o.href} onClick={close}
                  className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 transition-transform active:scale-[0.99] ${o.hot ? "border-transparent [background:linear-gradient(var(--color-surface),var(--color-surface))_padding-box,var(--grad)_border-box] border-2" : "border-line hover:bg-surface-2"}`}>
                  <span className="flex min-w-0 flex-col">
                    <span className="flex flex-wrap items-center gap-2"><b>{o.title}</b>{o.tag && <span className="rounded-full bg-[image:var(--grad)] px-2 py-0.5 text-[10px] font-bold text-white">{o.tag}</span>}</span>
                    <span className="text-sm text-muted">{o.text}</span>
                  </span>
                  <span aria-hidden="true" className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${o.hot ? "bg-[image:var(--grad)] text-white" : "bg-surface-2"}`}>›</span>
                </Link>
              </li>
            ))}
          </ul>
          <button type="button" onClick={close} className="py-1 text-sm font-semibold text-muted hover:text-ink">Ahora no</button>
        </div>
      </div>
    </div>
  );
}
