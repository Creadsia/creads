"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { type Afiliado, type Comision, type EstadoAfiliado, METODO_LABEL, PROGRAMA, type Referido } from "@/lib/afiliados-calc";

// Ventas y finanzas → Afiliados: who applied, approve or pause them, what each one brought and earned, the
// monthly payout list (CSV) and «Marcar pagado» once the money was sent by hand.

interface Numeros { clics: number; registros: number; pagaron: number; pagando: number; mrr: number; pendiente: number; pagable: number; pagado: number; revertido: number; listo: boolean }
type Fila = Afiliado & { numeros: Numeros; referidos: Referido[]; comisiones: Comision[] };
interface Data {
  hasta: string;
  totales: { afiliados: number; activos: number; pendientes: number; clics: number; registros: number; pagando: number; mrr: number; pendiente: number; pagable: number; pagado: number; revertido: number; aPagar: number };
  afiliados: Fila[];
  error?: string;
}

const card = "flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5";
const th = "whitespace-nowrap border-b border-line px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted uppercase";
const td = "border-b border-line px-3 py-2 align-top";
const num = "font-mono tabular-nums text-right";
const btn = "rounded-lg border border-line px-2.5 py-1 text-xs font-semibold hover:bg-surface-2 disabled:opacity-50";
const usd = (n: number) => `US$${(Math.round(n * 100) / 100).toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "2-digit" }) : "—");
const ESTADO: Record<EstadoAfiliado, [string, string]> = {
  pendiente: ["Por revisar", "bg-warn/15 text-warn"], activo: ["Activo", "bg-good/15 text-good"],
  pausado: ["Pausado", "bg-surface-2 text-muted"], rechazado: ["Rechazado", "bg-bad/15 text-bad"],
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-surface-2 p-3">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <b className="font-mono text-lg tabular-nums">{value}</b>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}

export default function AfiliadosAdmin() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState("");
  const load = useCallback(() => {
    fetch("/api/admin/afiliados").then((r) => r.json()).then((j: Data) => { if (j.error) setErr(j.error); else { setErr(""); setD(j); } }).catch(() => setErr("No se pudo cargar. Revisa tu conexión."));
  }, []);
  useEffect(load, [load]);

  async function post(body: Record<string, unknown>, key: string) {
    setBusy(key); setErr("");
    const r = await fetch("/api/admin/afiliados", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy("");
    if (!r?.ok) { setErr(j.error || "No se pudo guardar."); return null; }
    load();
    return j;
  }
  const estado = (a: Fila, e: EstadoAfiliado) => post({ accion: "estado", code: a.code, estado: e }, `${a.code}:${e}`);
  async function pagado(a: Fila) {
    if (!d) return;
    const m = a.numeros.pagable;
    const where = a.pago ? `${METODO_LABEL[a.pago.metodo]} (${a.pago.correo || a.pago.cuenta || a.pago.titular})` : "SIN DATOS DE PAGO";
    if (!confirm(`¿Ya le transferiste ${usd(m)} a ${a.name} por ${where}? Se marcan como pagadas sus comisiones disponibles al ${fecha(d.hasta)}.`)) return;
    const j = await post({ accion: "pagado", code: a.code, hasta: d.hasta }, `${a.code}:pagado`);
    if (j?.ok) alert(`Listo: ${usd(j.total)} marcados como pagados (${j.n} comisiones, comprobante ${j.pagoId}).`);
  }

  if (err && !d) return <section className={card}><p role="alert" className="text-sm text-bad">{err}</p></section>;
  if (!d) return <section className={card}><p className="text-muted">Cargando afiliados…</p></section>;
  const t = d.totales;
  const csv = `/api/admin/afiliados?csv=1&hasta=${encodeURIComponent(d.hasta)}`;
  const orden = [...d.afiliados].sort((x, y) => (x.estado === "pendiente" ? -1 : 0) - (y.estado === "pendiente" ? -1 : 0) || y.numeros.pagable - x.numeros.pagable || y.numeros.mrr - x.numeros.mrr);

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Programa de afiliados</h2>
            <p className="max-w-3xl text-sm text-muted">
              {PROGRAMA.pctTramo1}% de lo que paga el cliente en sus meses 1–{PROGRAMA.mesesTramo1}, {PROGRAMA.pctTramo2}% en los meses {PROGRAMA.mesesTramo1 + 1}–{PROGRAMA.maxMeses}. Cookie de {PROGRAMA.cookieDias} días (último clic) o código al registrarse.
              Cada comisión se puede pagar {PROGRAMA.retencionDias} días después del pago del cliente; se paga una vez al mes desde US${PROGRAMA.minimoUsd}. Si un pago se reembolsa, su comisión se anula sola.
            </p>
          </div>
          <a href="/afiliados" target="_blank" className={btn}>Ver página pública</a>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
          <Stat label="Afiliados" value={String(t.afiliados)} sub={`${t.activos} activos · ${t.pendientes} por revisar`} />
          <Stat label="Clics" value={t.clics.toLocaleString("es-CL")} />
          <Stat label="Cuentas creadas" value={t.registros.toLocaleString("es-CL")} sub={`${t.pagando} pagando hoy`} />
          <Stat label="Ingreso mensual que traen" value={usd(t.mrr)} />
          <Stat label="Comisión pendiente" value={usd(t.pendiente)} sub={`en los ${PROGRAMA.retencionDias} días de espera`} />
          <Stat label="Pagado en total" value={usd(t.pagado)} sub={t.revertido ? `${usd(Math.abs(t.revertido))} anulado` : undefined} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3">
          <p className="text-sm">
            <b>Pago de este mes:</b> {usd(t.aPagar)} a quienes tienen al menos US${PROGRAMA.minimoUsd} disponible (al {fecha(d.hasta)}).
            <span className="text-muted"> Descarga la lista, transfiere por PayPal, Wise o banco, y después marca cada uno como pagado.</span>
          </p>
          <a href={csv} className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-bg">Descargar CSV de pagos</a>
        </div>
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      </section>

      <section className={card}>
        {!orden.length ? <p className="text-sm text-muted">Todavía nadie postuló. La página del programa es creadsia.com/afiliados (enlace en el pie de la página principal).</p> : (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr>{["Afiliado", "Estado", "Clics", "Cuentas", "Pagando", "Ingreso/mes", "Pendiente", "Disponible", "Pagado", "Cobra por", ""].map((h, i) => <th key={h + i} className={`${th} ${i >= 2 && i <= 8 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
              <tbody>
                {orden.map((a) => {
                  const n = a.numeros;
                  const [lbl, tone] = ESTADO[a.estado];
                  return (
                    <Fragment key={a.code}>
                      <tr>
                        <td className={td}>
                          <button type="button" onClick={() => setOpen(open === a.code ? "" : a.code)} className="text-left font-semibold hover:underline" aria-expanded={open === a.code}>{a.name || a.email}</button>
                          <br /><span className="font-mono text-xs">{a.code}</span> <span className="text-xs text-muted">· {a.email}</span>
                          {a.web && <><br /><a href={/^https?:\/\//.test(a.web) ? a.web : `https://${a.web}`} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-muted underline">{a.canal ? `${a.canal}: ` : ""}{a.web}</a></>}
                        </td>
                        <td className={td}><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{lbl}</span><br /><span className="text-xs text-muted">desde {fecha(a.creado)}</span></td>
                        <td className={`${td} ${num}`}>{n.clics}</td>
                        <td className={`${td} ${num}`}>{n.registros}</td>
                        <td className={`${td} ${num}`}>{n.pagando}</td>
                        <td className={`${td} ${num}`}>{usd(n.mrr)}</td>
                        <td className={`${td} ${num}`}>{usd(n.pendiente)}</td>
                        <td className={`${td} ${num} ${n.listo ? "font-bold text-good" : ""}`}>{usd(n.pagable)}</td>
                        <td className={`${td} ${num}`}>{usd(n.pagado)}</td>
                        <td className={`${td} text-xs`}>{a.pago ? <>{METODO_LABEL[a.pago.metodo]}<br /><span className="text-muted">{a.pago.correo || [a.pago.banco, a.pago.cuenta].filter(Boolean).join(" · ")}</span></> : <span className="text-warn">Sin datos</span>}</td>
                        <td className={td}>
                          <div className="flex flex-wrap gap-1">
                            {a.estado !== "activo" && <button type="button" className={btn} disabled={busy !== ""} onClick={() => estado(a, "activo")}>{a.estado === "pendiente" ? "Aprobar" : "Activar"}</button>}
                            {a.estado === "activo" && <button type="button" className={btn} disabled={busy !== ""} onClick={() => estado(a, "pausado")}>Pausar</button>}
                            {a.estado === "pendiente" && <button type="button" className={btn} disabled={busy !== ""} onClick={() => estado(a, "rechazado")}>Rechazar</button>}
                            {n.pagable > 0 && <button type="button" className={`${btn} ${n.listo ? "border-good text-good" : ""}`} disabled={busy !== ""} onClick={() => pagado(a)} title={n.listo ? "" : `Bajo el mínimo de US$${PROGRAMA.minimoUsd}`}>Marcar pagado</button>}
                          </div>
                        </td>
                      </tr>
                      {open === a.code && (
                        <tr><td colSpan={11} className={`${td} bg-surface-2/50`}><DetalleAfiliado a={a} /></td></tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function DetalleAfiliado({ a }: { a: Fila }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      <div className="flex min-w-0 flex-col gap-2">
        <b>Comisiones ({a.comisiones.length})</b>
        {!a.comisiones.length ? <p className="text-xs text-muted">Sin pagos todavía.</p> : (
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-xs">
              <thead><tr>{["Fecha", "Pago", "Cuenta", "Mes", "Pagó", "Comisión", "Estado"].map((h) => <th key={h} className="px-2 py-1 text-left text-muted">{h}</th>)}</tr></thead>
              <tbody>
                {a.comisiones.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="px-2 py-1 whitespace-nowrap">{fecha(c.at)}</td>
                    <td className="px-2 py-1">{c.label ?? ""} <span className="font-mono text-muted">{c.id}</span></td>
                    <td className="px-2 py-1 font-mono">{c.ws}</td>
                    <td className="px-2 py-1 font-mono">{c.meses.join(",")}</td>
                    <td className="px-2 py-1 font-mono">{usd(c.baseUsd)}{c.moneda === "CLP" ? <span className="text-muted"> (${Math.round(c.monto).toLocaleString("es-CL")})</span> : null}</td>
                    <td className="px-2 py-1 font-mono">{usd(c.usd)} <span className="text-muted">{c.pct}%</span></td>
                    <td className="px-2 py-1">{c.estado === "revertida" ? `Anulada ${fecha(c.revertidaEn)}` : c.pagadoEn ? `Pagada ${fecha(c.pagadoEn)} (${c.pagoId})` : "Por pagar"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <b>Cuentas que trajo ({a.referidos.length})</b>
        {!a.referidos.length ? <p className="text-xs text-muted">Ninguna todavía.</p> : (
          <ul className="max-h-80 overflow-auto text-xs">
            {a.referidos.map((r) => <li key={r.ws} className="border-t border-line py-1"><span className="font-mono">{r.email}</span> · {fecha(r.at)} · {r.via === "codigo" ? "código" : "enlace"} · {r.meses.length} meses pagados</li>)}
          </ul>
        )}
        {a.mensaje && <p className="text-xs"><b>Su postulación:</b> {a.mensaje}</p>}
        {a.pago && (
          <p className="text-xs text-muted">
            <b className="text-ink">Datos de pago:</b> {METODO_LABEL[a.pago.metodo]} · {a.pago.titular}{a.pago.correo ? ` · ${a.pago.correo}` : ""}{a.pago.pais ? ` · ${a.pago.pais}` : ""}{a.pago.banco ? ` · ${a.pago.banco}` : ""}{a.pago.tipoCuenta ? ` · ${a.pago.tipoCuenta}` : ""}{a.pago.cuenta ? ` · ${a.pago.cuenta}` : ""}{a.pago.idFiscal ? ` · ${a.pago.idFiscal}` : ""}{a.pago.swift ? ` · SWIFT ${a.pago.swift}` : ""}{a.pago.notas ? ` · ${a.pago.notas}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
