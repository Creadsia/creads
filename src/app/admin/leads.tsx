"use client";

import { useCallback, useEffect, useState } from "react";
import DesdeCero from "./desde-cero";
import Actividad from "./actividad";
import { Fragment } from "react";

// Clientes → Nuevas cuentas: every account that signed up, how far it got and what it did, so the owner sees
// where people stop and who to write to (an account that opened the payment and didn't pay is a hot lead).

interface Cuenta {
  id: string; empresa: string; email: string; nombre: string | null; creada: string; ultimaVez: string | null;
  etapa: string; etapaTexto: string; compro: string[]; pagosAbiertos: number; pagado: boolean; generaciones: number; anunciosListos: number;
  avatares: number; imagenes: number; anuncios: number; origen: string | null; campana: string | null; prueba: boolean;
}
interface Data { dias: number; cuentas: Cuenta[]; resumen: Record<string, number>; etapas: Record<string, string> }

const card = "flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5";
const ORDER = ["registro", "pago-abierto", "pago", "creando", "anuncio"];
const TONE: Record<string, string> = { registro: "bg-surface-2 text-muted", "pago-abierto": "bg-warn/15 text-warn", pago: "bg-accent/15 text-accent-text", creando: "bg-accent/15 text-accent-text", anuncio: "bg-good/15 text-good" };
function hace(iso: string | null) {
  if (!iso) return "—";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (m < 2) return "recién";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export default function Leads() {
  const [dias, setDias] = useState(7);
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [filtro, setFiltro] = useState<string | null>(null);
  const [ver, setVer] = useState<string | null>(null);
  const load = useCallback(async () => {
    setErr("");
    const r = await fetch(`/api/admin/leads?dias=${dias}`).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (!r?.ok || !j) return setErr(j?.error || "No se pudieron leer las cuentas.");
    setD(j);
  }, [dias]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60_000); return () => clearInterval(t); }, [load]);

  const total = (d?.cuentas ?? []).filter((c) => !c.prueba).length;
  const rows = (d?.cuentas ?? []).filter((c) => !filtro || (c.etapa === filtro && !c.prueba));
  async function prueba(c: Cuenta) {
    await fetch("/api/admin/desde", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prueba: c.id, on: !c.prueba }) }).catch(() => null);
    load();
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Nuevas cuentas</h2>
          <p className="text-sm text-muted">Quién se registró, hasta dónde llegó y qué hizo. Se actualiza cada minuto.</p>
        </div>
        <div className="flex gap-1.5">
          {[[1, "Hoy"], [7, "7 días"], [30, "30 días"], [90, "90 días"]].map(([n, l]) => (
            <button key={n} type="button" onClick={() => setDias(Number(n))} aria-pressed={dias === n} className={`rounded-full border px-3 py-1 text-sm font-semibold ${dias === n ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"}`}>{l}</button>
          ))}
        </div>
      </div>
      <DesdeCero onChange={load} />
      {err && <p className="text-sm text-bad">{err}</p>}
      {!d && !err && <p className="text-sm text-muted">Cargando…</p>}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {ORDER.map((k) => (
              <button key={k} type="button" onClick={() => setFiltro(filtro === k ? null : k)} aria-pressed={filtro === k}
                className={`flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left ${filtro === k ? "border-ink" : "border-line"} bg-surface hover:bg-surface-2`}>
                <span className="text-xs text-muted">{d.etapas[k]}</span>
                <span className="font-display text-2xl font-semibold tabular-nums">{d.resumen[k] ?? 0}</span>
                <span className="text-[11px] text-muted">{total ? `${Math.round(((d.resumen[k] ?? 0) / total) * 100)}% de ${total}` : "—"}</span>
              </button>
            ))}
          </div>
          {(d.resumen["pago-abierto"] ?? 0) > 0 && (
            <p className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm"><b>{d.resumen["pago-abierto"]} {d.resumen["pago-abierto"] === 1 ? "persona abrió" : "personas abrieron"} el pago y no pagó.</b> Son los más calientes: escríbeles hoy y pregúntales si tuvieron algún problema.</p>
          )}
          <div className={card}>
            {rows.length === 0 ? <p className="text-sm text-muted">{total ? "Nadie en esta etapa." : "Todavía no hay cuentas nuevas en este período."}</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr><th className="py-2 font-semibold">Cuenta</th><th className="font-semibold">Se registró</th><th className="font-semibold">Etapa</th><th className="font-semibold">Qué hizo</th><th className="font-semibold">De dónde llegó</th><th className="font-semibold">Última vez</th><th /></tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <Fragment key={c.id}>
                      <tr className={`border-t border-line align-top ${c.prueba ? "opacity-50" : ""}`}>
                        <td className="py-2.5 pr-3"><b>{c.nombre || c.empresa}</b>{c.prueba && <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">prueba</span>}<div className="text-xs text-muted" data-private>{c.email}</div></td>
                        <td className="pr-3 text-xs">{new Date(c.creada).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}<div className="text-muted">{hace(c.creada)}</div></td>
                        <td className="pr-3"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[c.etapa] ?? ""}`}>{c.etapaTexto}</span>{c.compro.length > 0 && <div className="mt-1 text-xs text-muted">{c.compro.join(", ")}</div>}</td>
                        <td className="pr-3 text-xs tabular-nums">
                          {c.anunciosListos} anuncios listos · {c.generaciones} generaciones<br />{c.imagenes} imágenes · {c.avatares} avatares propios{c.pagosAbiertos > 0 && !c.pagado ? <><br /><span className="text-warn">abrió el pago {c.pagosAbiertos} {c.pagosAbiertos === 1 ? "vez" : "veces"}</span></> : null}
                        </td>
                        <td className="pr-3 text-xs">{c.origen ?? <span className="text-muted">sin dato</span>}{c.campana && <div className="max-w-40 truncate text-muted" title={c.campana}>{c.campana}</div>}</td>
                        <td className="pr-3 text-xs">{hace(c.ultimaVez)}</td>
                        <td className="text-xs"><button type="button" onClick={() => setVer(ver === c.id ? null : c.id)} className="mb-1 block font-semibold underline">{ver === c.id ? "Cerrar" : "Ver qué hizo"}</button><button type="button" onClick={() => prueba(c)} className="mb-1 block text-muted underline hover:text-ink">{c.prueba ? "No es de prueba" : "Es de prueba"}</button>{c.email && <a href={`mailto:${c.email}?subject=${encodeURIComponent("¿Te ayudo con tu primer anuncio en Creads?")}`} className="font-semibold underline">Escribir</a>}</td>
                      </tr>
                      {ver === c.id && <tr className="border-t border-line"><td colSpan={7} className="bg-surface-2/50 p-3"><Actividad ws={c.id} /></td></tr>}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted">Para ver exactamente qué hizo una persona (dónde hizo clic, dónde se trabó), busca su correo en PostHog → Session replay. El origen solo aparece si aceptó las cookies y desde hoy en adelante.</p>
          </div>
        </>
      )}
    </div>
  );
}
