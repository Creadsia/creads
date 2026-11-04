"use client";

import { useEffect, useState } from "react";

// Panel → Ventas y finanzas → «Resumen»: los pocos números que importan, en una sola pantalla y en lenguaje
// simple, para no marearse (owner, 4 Nov 2026: «todo concentrado en un panel para yo poder entender»). Lee los
// mismos endpoints que las pestañas de detalle; cada tarjeta explica en una línea qué significa.

interface Ret {
  hoy?: { activas: number; mrr: number };
  actual?: { retencion: number | null; base: number };
  permanencia?: number | null;
  ltv?: { observado: number | null };
  cobro_prueba?: { tasa_cobro: number | null; exito: number; fallo: number; cancelaron: number; llegaron: number; en_curso: number };
}
interface Est { cur?: { nuevos: number; clientes: number; neto: number } }
interface Rent { planes?: { plan: string; caso: string; margen: number }[] }

const usd = (n: number) => `US$${Math.round(n).toLocaleString("es-CL")}`;
const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const pct = (n: number | null | undefined) => (n == null ? "—" : `${n.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`);
const GKEY = "creads-gasto-mes";

function Big({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "good" | "bad" | "warn" }) {
  const c = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "";
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-line bg-surface-2 p-4">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <b className={`font-display text-2xl font-bold tabular-nums leading-tight ${c}`}>{value}</b>
      <span className="text-xs text-muted">{hint}</span>
    </div>
  );
}
function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h3 className="font-display text-base font-semibold">{titulo}</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
    </section>
  );
}

export default function ResumenGeneral() {
  const [ret, setRet] = useState<Ret | null | false>(null);
  const [est, setEst] = useState<Est | null | false>(null);
  const [rent, setRent] = useState<Rent | null | false>(null);
  const [gasto, setGasto] = useState(0);

  useEffect(() => {
    const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(d);
    const to = fmt(new Date());
    const from = fmt(new Date(Date.now() - 30 * 86400_000));
    fetch("/api/admin/retencion?meses=3").then((r) => (r.ok ? r.json() : null)).then((d) => setRet(d ?? false)).catch(() => setRet(false));
    fetch(`/api/admin/estadisticas?from=${from}&to=${to}`).then((r) => (r.ok ? r.json() : null)).then((d) => setEst(d ?? false)).catch(() => setEst(false));
    fetch("/api/admin/rentabilidad?days=30").then((r) => (r.ok ? r.json() : null)).then((d) => setRent(d ?? false)).catch(() => setRent(false));
    try { const v = Number(localStorage.getItem(GKEY)); if (v > 0) setGasto(v); } catch {}
  }, []);

  const saveGasto = (v: number) => { setGasto(v); try { localStorage.setItem(GKEY, String(v)); } catch {} };

  const r = ret || undefined;
  const e = est || undefined;
  const rt = rent || undefined;

  const activas = r?.hoy?.activas;
  const mrr = r?.hoy?.mrr;
  const retencion = r?.actual?.retencion;
  const baseRet = r?.actual?.base ?? 0;
  const permanencia = r?.permanencia;
  const ltv = r?.ltv?.observado;
  const cobro = r?.cobro_prueba;

  const registros = e?.cur?.nuevos;
  const pagaron = e?.cur?.clientes;
  const ventas = e?.cur?.neto;
  const conversion = registros ? ((pagaron ?? 0) / registros) * 100 : null;
  const cac = gasto > 0 && pagaron ? gasto / pagaron : null;

  const barato = rt?.planes?.filter((p) => p.caso === "Mensual").sort((a, b) => a.margen - b.margen)[0];

  const cargando = ret === null || est === null || rent === null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-semibold">Resumen</h2>
        <p className="text-sm text-muted">Los números que importan, en una pantalla. Para el detalle, usa las otras pestañas de arriba.</p>
      </div>

      {cargando && <div className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">Cargando los números…</div>}

      {!cargando && (
        <>
          <Grupo titulo="Ahora mismo">
            <Big label="Suscriptores activos" value={activas == null ? "—" : String(activas)} hint="Clientes con plan vigente hoy" tone={activas ? "good" : undefined} />
            <Big label="Plata al mes (MRR)" value={mrr == null ? "—" : usd(mrr)} hint="Lo que entra cada mes si nadie cancela" />
            <Big label="Pruebas en curso" value={cobro?.en_curso == null ? "—" : String(cobro.en_curso)} hint="Dejaron tarjeta, aún en los 7 días gratis" />
            <Big label="Valor de un cliente (LTV)" value={ltv == null ? "—" : usd(ltv)} hint="Lo que deja en promedio mientras se queda" />
          </Grupo>

          <Grupo titulo="Este mes · de visita a cliente">
            <Big label="Registros nuevos" value={registros == null ? "—" : String(registros)} hint="Cuentas creadas en los últimos 30 días" />
            <Big label="Pagaron" value={pagaron == null ? "—" : String(pagaron)} hint="De esos, cuántos ya son clientes" tone={pagaron ? "good" : undefined} />
            <Big label="Conversión" value={pct(conversion)} hint="% de los registros que paga" tone={conversion == null ? undefined : conversion >= 3 ? "good" : "warn"} />
            <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-line bg-surface-2 p-4">
              <span className="text-xs font-semibold text-muted">Costo por suscriptor (CAC)</span>
              <b className="font-display text-2xl font-bold tabular-nums leading-tight">{cac == null ? "—" : clp(cac)}</b>
              <label className="flex items-center gap-1.5 text-xs text-muted">Gasto Meta mes:
                <input type="number" min={0} step={1000} value={gasto} onChange={(ev) => saveGasto(Math.max(0, Number(ev.target.value) || 0))}
                  className="w-24 rounded-md border border-line bg-surface px-1.5 py-0.5 text-right tabular-nums" aria-label="Gasto en Meta este mes, en pesos" />
              </label>
            </div>
          </Grupo>

          <Grupo titulo="La prueba de 7 días">
            <Big label="Cobro exitoso" value={cobro?.tasa_cobro == null ? "—" : pct(cobro.tasa_cobro)} hint={cobro?.llegaron ? `${cobro.exito} de ${cobro.llegaron} que llegaron al cobro` : "Aún no vence ninguna prueba"} tone={cobro?.tasa_cobro == null ? undefined : cobro.tasa_cobro >= 80 ? "good" : cobro.tasa_cobro >= 50 ? "warn" : "bad"} />
            <Big label="Cobros que fallaron" value={cobro?.fallo == null ? "—" : String(cobro.fallo)} hint="Sin fondos o tarjeta rechazada" tone={cobro?.fallo ? "bad" : undefined} />
            <Big label="Cancelaron antes" value={cobro?.cancelaron == null ? "—" : String(cobro.cancelaron)} hint="Probaron y no siguieron" />
            <Big label="Pagaron la prueba" value={cobro?.exito == null ? "—" : String(cobro.exito)} hint="Pasaron a cliente de pago" tone={cobro?.exito ? "good" : undefined} />
          </Grupo>

          <Grupo titulo="Lo que más importa (crece la ganancia)">
            <Big label="Retención ⭐" value={baseRet ? pct(retencion) : "Sin datos aún"} hint="De los activos, cuántos siguen al mes siguiente" tone={retencion == null ? undefined : retencion >= 80 ? "good" : retencion >= 60 ? "warn" : "bad"} />
            <Big label="Permanencia" value={permanencia == null ? "—" : `${permanencia.toLocaleString("es-CL")} meses`} hint="Cuánto se queda un cliente en promedio" />
            <Big label="Margen plan más barato" value={barato == null ? "—" : `${barato.margen}%`} hint={barato ? `${barato.plan}, peor caso (gasta todo)` : "Ver Rentabilidad"} tone={barato == null ? undefined : barato.margen >= 30 ? "good" : barato.margen >= 0 ? "warn" : "bad"} />
            <Big label="Clientes activos (retención)" value={baseRet ? String(baseRet) : "—"} hint="Base sobre la que se mide la retención" />
          </Grupo>

          <p className="text-xs text-muted">
            Los números de la prueba y la retención recién son confiables con ~1–2 meses y 100–200 suscriptores (antes son muy pocos datos). El CAC usa el gasto en Meta que escribas arriba. Para proyectar tu punto de equilibrio con supuestos, usa la calculadora que te pasé por el chat.
          </p>
        </>
      )}
    </div>
  );
}
