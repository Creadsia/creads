"use client";

import { useEffect, useState } from "react";

// «Ver qué hizo»: everything about one customer, to help them (owner, 24 Oct 2026; full control 17 Nov 2026):
// account and balance, the limits that apply now, connectors, every paid generation (refunded or not),
// failures, technical errors, latest images and ads, and credit movements.

interface Data {
  cuenta: {
    nombre: string; creada: string; plan: string | null; pagadoHasta: string | null; acceso: string | null; descuento: number; notas: string;
    saldo: number | null; segundos: number | null; ilimitada: boolean;
    personas: { email: string; nombre: string | null; rol: string; activa: boolean; ultimoIngreso: string | null }[];
  } | null;
  topes: {
    cuentaNueva: { aplica: boolean; sinLimite: boolean; topeUsdDia: number; gastoHoyUsd: number; terminaEl: string | null };
    frecuencia: { que: string; usados: number; max: number; ventana: string }[];
  };
  conectores: { nombre: string; persona: string; creada: string; vence: string; conector: boolean }[];
  resumen: { generaciones: number; devueltas: number; creditosGastados: number; costoUsd: number; creditosComprados: number };
  todas: { que: string; creditos: number; costo: number; devuelto: boolean; cuando: string }[];
  errores: { area: string; mensaje: string; donde: string | null; veces: number; cuando: string }[];
  imagenes: { url: string | null; prompt: string; modelo: string | null; creada: string }[];
  anuncios: { titulo: string; estado: string; formato: string | null; video: string | null; creado: string }[];
  fallas: { que: string; modelo: string | null; error: string; texto: string; cuando: string }[];
  generaciones: number;
  movimientos: { creditos: number; tipo: string; nota: string; cuando: string }[];
}
const when = (iso: string) => new Date(iso).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
const ESTADO: Record<string, string> = { done: "listo", draft: "borrador", generating: "generando", failed: "falló" };
const box = "rounded-xl border border-line p-3";

function Barra({ usados, max }: { usados: number; max: number }) {
  const p = Math.min(100, Math.round((usados / Math.max(1, max)) * 100));
  return (
    <span className="relative block h-1.5 w-full overflow-hidden rounded bg-surface-2">
      <span className={`absolute inset-y-0 left-0 ${p >= 100 ? "bg-bad" : p >= 75 ? "bg-warn" : "bg-good"}`} style={{ width: `${p}%` }} />
    </span>
  );
}

export default function Actividad({ ws }: { ws: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [todas, setTodas] = useState(false);
  useEffect(() => {
    fetch(`/api/admin/actividad?ws=${encodeURIComponent(ws)}`).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); }).catch((e) => setErr(e.message || "No se pudo cargar."));
  }, [ws]);
  if (err) return <p className="text-sm text-bad">{err}</p>;
  if (!d) return <p className="text-sm text-muted">Cargando…</p>;
  const c = d.cuenta;
  const t = d.topes;
  const r = d.resumen;
  const vencido = c?.pagadoHasta ? Date.parse(`${c.pagadoHasta}T23:59:59`) < Date.now() : false;
  const lista = todas ? d.todas : d.todas.slice(0, 15);
  return (
    <div className="flex flex-col gap-4 text-sm">
      {/* account, balance and people */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className={box}>
          <b>Cuenta</b>
          {c ? (
            <ul className="mt-2 flex flex-col gap-1">
              <li><span className="text-muted">Saldo:</span> <b>{c.ilimitada ? "Sin límite" : `${(c.saldo ?? 0).toLocaleString("es-CL")} créditos`}</b>{c.segundos !== null && <span className="text-muted"> (≈ {c.segundos} s de video)</span>}</li>
              <li><span className="text-muted">Plan:</span> {c.plan || "sin plan"}{c.pagadoHasta && <span className={vencido ? "text-bad" : "text-muted"}> · {vencido ? "venció" : "pagado hasta"} {day(c.pagadoHasta)}</span>}</li>
              <li><span className="text-muted">Cuenta creada:</span> {when(c.creada)}</li>
              {c.acceso && c.acceso !== "full" && <li><span className="text-muted">Acceso:</span> {c.acceso === "ads" ? "solo Crear anuncio" : c.acceso}</li>}
              {c.descuento > 0 && <li><span className="text-muted">Descuento:</span> {c.descuento}%</li>}
              {c.notas && <li><span className="text-muted">Notas:</span> {c.notas}</li>}
            </ul>
          ) : <p className="mt-2 text-muted">No encontré la cuenta.</p>}
        </div>
        <div className={box}>
          <b>Personas ({c?.personas.length ?? 0})</b>
          <ul className="mt-2 flex flex-col gap-1">
            {c?.personas.map((p) => <li key={p.email} className={p.activa ? "" : "text-muted line-through"}><span className="break-all">{p.email}</span> <span className="text-xs text-muted">· {p.rol === "owner" ? "dueño" : p.rol}{p.ultimoIngreso ? ` · entró ${when(p.ultimoIngreso)}` : " · nunca entró"}</span></li>)}
          </ul>
        </div>
        <div className={box}>
          <b>Conectores y claves API ({d.conectores.length})</b>
          {d.conectores.length ? (
            <ul className="mt-2 flex flex-col gap-1">
              {d.conectores.map((k, i) => <li key={i}>{k.conector ? "🔌 " : "🔑 "}{k.nombre} <span className="text-xs text-muted">· desde {when(k.creada)}</span></li>)}
            </ul>
          ) : <p className="mt-2 text-muted">No ha conectado Claude, ChatGPT ni creado claves.</p>}
        </div>
      </div>

      {/* limits that apply right now */}
      <div className={box}>
        <b>Topes de uso</b> <span className="text-muted">(lo que lleva en la ventana actual de cada límite)</span>
        <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
          {t.frecuencia.map((f) => (
            <div key={f.que} className="flex flex-col gap-1">
              <span className="flex justify-between gap-2 text-xs"><span>{f.que}</span><span className={`font-mono tabular-nums ${f.usados >= f.max ? "text-bad" : "text-muted"}`}>{f.usados}/{f.max}</span></span>
              <Barra usados={f.usados} max={f.max} />
              <span className="text-[11px] text-muted">máximo {f.max} {f.ventana}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs">
          <b>Cuenta nueva (antifraude):</b>{" "}
          {t.cuentaNueva.sinLimite ? "liberada con #sinlimite en las notas." : t.cuentaNueva.aplica
            ? <>hoy gastó US${t.cuentaNueva.gastoHoyUsd} de US${t.cuentaNueva.topeUsdDia} por día; este tope termina el {t.cuentaNueva.terminaEl ? when(t.cuentaNueva.terminaEl) : "—"}. Para liberarla, escribe #sinlimite en sus notas.</>
            : "ya no aplica (pasaron sus primeras 48 horas)."}
        </p>
      </div>

      {/* summary and every generation */}
      <div className={box}>
        <b>Generaciones: {r.generaciones}</b>{" "}
        <span className="text-muted">· {r.devueltas} fallaron y se devolvieron · gastó {r.creditosGastados.toLocaleString("es-CL")} de {r.creditosComprados.toLocaleString("es-CL")} créditos comprados · nos costó US${r.costoUsd}</span>
        {d.todas.length > 0 ? (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="text-muted"><tr><th className="py-1 pr-3 font-normal">Cuándo</th><th className="py-1 pr-3 font-normal">Qué</th><th className="py-1 pr-3 text-right font-normal">Créditos</th><th className="py-1 pr-3 text-right font-normal">Costo US$</th><th className="py-1 font-normal">Resultado</th></tr></thead>
              <tbody>
                {lista.map((g, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="whitespace-nowrap py-1 pr-3 text-muted">{when(g.cuando)}</td>
                    <td className="py-1 pr-3">{g.que}</td>
                    <td className="py-1 pr-3 text-right font-mono tabular-nums">{g.creditos}</td>
                    <td className="py-1 pr-3 text-right font-mono tabular-nums">{g.costo.toFixed(3)}</td>
                    <td className={`py-1 ${g.devuelto ? "text-bad" : "text-good"}`}>{g.devuelto ? "falló · devuelto" : "cobrado"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {d.todas.length > 15 && <button type="button" onClick={() => setTodas((v) => !v)} className="mt-2 text-xs font-semibold underline">{todas ? "Ver menos" : `Ver las ${d.todas.length}`}</button>}
          </div>
        ) : <p className="mt-2 text-muted">Todavía no ha generado nada.</p>}
      </div>

      {d.fallas.length > 0 && (
        <div className="rounded-xl border border-bad/40 bg-bad/10 p-3">
          <b>Tuvo {d.fallas.length} {d.fallas.length === 1 ? "problema" : "problemas"} al generar</b> <span className="text-muted">(los créditos de lo que falla vuelven solos)</span>
          <ul className="mt-2 flex flex-col gap-1.5">
            {d.fallas.map((f, i) => <li key={i}><span className="text-muted">{when(f.cuando)} · {f.que}{f.modelo ? ` · ${f.modelo}` : ""}:</span> {f.error || "falló"}{f.texto && <span className="block text-xs text-muted">«{f.texto}»</span>}</li>)}
          </ul>
        </div>
      )}

      <div className={d.errores.length ? "rounded-xl border border-warn/40 bg-warn/10 p-3" : box}>
        <b>Errores técnicos (últimos 7 días): {d.errores.length}</b>
        {d.errores.length ? (
          <ul className="mt-2 flex flex-col gap-1.5">
            {d.errores.map((e, i) => <li key={i}><span className="text-muted">{when(e.cuando)} · {e.area}{e.donde ? ` · ${e.donde}` : ""}{e.veces > 1 ? ` · ${e.veces} veces` : ""}:</span> {e.mensaje}</li>)}
          </ul>
        ) : <p className="mt-1 text-muted">No tuvo errores de la página ni del servidor.</p>}
      </div>

      {d.anuncios.length > 0 && (
        <div>
          <b>Anuncios ({d.anuncios.length})</b>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {d.anuncios.map((a, i) => (
              <li key={i} className="flex flex-col gap-1 rounded-lg border border-line p-2">
                {a.video ? <video src={a.video} controls playsInline preload="none" className="aspect-[9/16] w-full rounded bg-black object-cover" /> : <span className="grid aspect-[9/16] place-items-center rounded bg-surface-2 text-xs text-muted">{ESTADO[a.estado] ?? a.estado}</span>}
                <span className="truncate font-semibold" title={a.titulo}>{a.titulo}</span>
                <span className="text-xs text-muted">{when(a.creado)} · {ESTADO[a.estado] ?? a.estado}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.imagenes.length > 0 && (
        <div>
          <b>Imágenes (últimas {d.imagenes.length})</b>
          <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {d.imagenes.map((im, i) => (
              <li key={i} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {im.url ? <a href={im.url} target="_blank" rel="noopener noreferrer"><img src={im.url} alt="" className="aspect-square w-full rounded object-cover" /></a> : <span className="aspect-square rounded bg-surface-2" />}
                <span className="line-clamp-2 text-[11px] text-muted" title={im.prompt}>{im.prompt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.movimientos.length > 0 && (
        <details>
          <summary className="cursor-pointer font-semibold">Créditos: movimientos ({d.movimientos.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {d.movimientos.map((m, i) => <li key={i} className="flex gap-3"><span className={`w-14 shrink-0 text-right font-mono tabular-nums ${m.creditos > 0 ? "text-good" : ""}`}>{m.creditos > 0 ? "+" : ""}{m.creditos}</span><span className="text-muted">{when(m.cuando)}</span><span>{m.nota}</span></li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
