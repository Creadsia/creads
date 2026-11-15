"use client";

import { useCallback, useEffect, useState } from "react";

// Panel admin → «Workers GPU»: prende/apaga los workers calientes de RunPod y muestra el estado en vivo y el
// costo por hora (owner, 10 nov 2026). Habla con /api/admin/gpu (solo owner).

type Modo = "apagado" | "automatico" | "caliente";

interface Estado {
  health: { workers: { idle: number; running: number; ready?: number; throttled?: number; initializing?: number }; jobs: { inProgress?: number; inQueue?: number } };
  config: { workersMin: number; workersMax: number; idleTimeout: number } | null;
  modo: { mode: Modo; n: number } | null;
  manage?: boolean;
  manageError?: string;
  usdHr: number;
  topeMax?: number;
  autoTopeDef?: number;
}

// Tope inicial sugerido para el modo Automático (se prenden hasta este número bajo demanda y se apagan solos).
// Al cargar, si el motor ya está en automático, el selector adopta el tope real.
const TOPE_AUTO = 20;

const money = (n: number) => `US$${n.toLocaleString("es-CL", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export default function GpuWorkers() {
  const [e, setE] = useState<Estado | null>(null);
  const [err, setErr] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [tope, setTope] = useState<number>(TOPE_AUTO);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/gpu", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo leer RunPod.");
      setE(d); setErr("");
      // El selector de tope arranca en el tope real que tenga el motor (si está en automático).
      if (d?.modo?.mode === "automatico" && d.modo.n) setTope(d.modo.n);
    } catch (x) { setErr(x instanceof Error ? x.message : "Error"); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); const t = setInterval(cargar, 15000); return () => clearInterval(t); }, [cargar]);

  async function aplicar(mode: Modo, n?: number) {
    setGuardando(`${mode}:${n ?? ""}`); setErr("");
    try {
      const r = await fetch("/api/admin/gpu", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, ...(n != null ? { n } : {}) }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo cambiar.");
      await cargar();
    } catch (x) { setErr(x instanceof Error ? x.message : "Error"); }
    finally { setGuardando(null); }
  }

  const w = e?.health.workers;
  const cfg = e?.config;
  const usdHr = e?.usdHr ?? 1.75;
  const topeMax = e?.topeMax ?? 50;
  const puedeControlar = Boolean(e?.manage && cfg);
  const modo: Modo = e?.modo?.mode ?? (cfg ? (cfg.workersMin > 0 ? "caliente" : cfg.workersMax > 0 ? "automatico" : "apagado") : "apagado");
  const activos = cfg?.workersMin ?? 0;
  const topeActual = cfg?.workersMax ?? 0;
  const corriendo = (w?.running ?? 0);
  const prendido = activos > 0 || corriendo > 0;
  const costoActivosHr = activos * usdHr;
  const mesSiQueda = costoActivosHr * 24 * 30;
  const topeOpciones = [5, 10, 15, 20, 30].filter((n) => n <= topeMax);

  const etiquetaModo = modo === "caliente" ? `Caliente · ${activos}` : modo === "automatico" ? `Automático · hasta ${topeActual}` : "Apagado";

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
          <span className={`h-2.5 w-2.5 rounded-full ${prendido ? "bg-good" : modo === "automatico" ? "bg-warn" : "bg-muted"}`} />
          Workers GPU (RunPod)
        </h3>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-line px-2.5 py-0.5 text-[12px] font-semibold text-muted">{etiquetaModo}</span>
          <button type="button" onClick={cargar} className="rounded-lg border border-line px-2.5 py-1 text-[13px] font-semibold text-muted hover:text-ink">Actualizar</button>
        </div>
      </div>

      {cargando && !e ? <p className="text-sm text-muted">Cargando estado…</p> : null}
      {err ? <p className="rounded-lg border border-bad/40 bg-bad/[0.07] px-3 py-2 text-sm text-bad">{err}</p> : null}

      {e && (
        <>
          {/* Estado en vivo */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Calientes (fijos)", String(activos), activos > 0 ? "text-good" : "text-muted"],
              ["Corriendo ahora", String(corriendo), corriendo > 0 ? "text-ink" : "text-muted"],
              ["En espera (idle)", String(w?.idle ?? 0), "text-muted"],
              ["Trabajos en curso", String(e.health.jobs.inProgress ?? 0), (e.health.jobs.inProgress ?? 0) > 0 ? "text-ink" : "text-muted"],
            ].map(([k, v, c]) => (
              <div key={k} className="rounded-xl border border-line bg-surface-2/50 px-3 py-2">
                <div className={`text-xl font-bold tabular-nums ${c}`}>{v}</div>
                <div className="text-[12px] text-muted">{k}</div>
              </div>
            ))}
          </div>

          {/* Costo */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-line bg-surface-2/40 px-4 py-3 text-sm">
            <span className="text-muted">Cada worker: <b className="text-ink">{money(usdHr)}/h</b> (solo mientras genera)</span>
            {modo === "caliente" && <span className="text-muted">Fijos ({activos}): <b className="text-ink">{money(costoActivosHr)}/h</b> · 24/7 ~<b className="text-ink">{money(mesSiQueda)}/mes</b></span>}
            {modo === "automatico" && <span className="text-good">En reposo: <b>US$0/h</b> · prende hasta {topeActual} bajo demanda</span>}
            {modo === "apagado" && <span className="text-muted">Apagado: <b className="text-ink">US$0/h</b> · no corre nada</span>}
            <span className="text-muted">Tope: <b className="text-ink">{topeActual || "—"}</b> · Idle: <b className="text-ink">{cfg ? `${cfg.idleTimeout}s` : "—"}</b></span>
          </div>

          {/* Control: 3 modos */}
          <div className="flex flex-col gap-3">
            {!puedeControlar && (
              <p className="rounded-lg border border-warn/40 bg-warn/[0.08] px-3 py-2 text-[13px] text-ink">
                El estado se ve en vivo, pero para <b>cambiar el modo desde aquí</b> falta una API key de RunPod con permisos de administración. Créala en RunPod → Settings → API Keys (acceso total) y ponla en Vercel como <b>RUNPOD_MANAGE_KEY</b>. Mientras, cámbialo en RunPod directo.
              </p>
            )}

            {/* Automático (recomendado) */}
            <div className={`rounded-xl border p-3 ${modo === "automatico" ? "border-good/60 bg-good/[0.06]" : "border-line"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">🟢 Automático</span>
                  <span className="rounded-full bg-good/15 px-2 py-0.5 text-[11px] font-semibold text-good">recomendado</span>
                  {modo === "automatico" && <span className="text-[12px] text-good">activo</span>}
                </div>
                <button type="button" disabled={guardando !== null || !puedeControlar} onClick={() => aplicar("automatico", tope)}
                  className="rounded-lg bg-[var(--accent-text)] px-3 py-1.5 text-[13px] font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-90">
                  {guardando?.startsWith("automatico") ? "guardando…" : modo === "automatico" ? "Actualizar tope" : "Activar"}
                </button>
              </div>
              <p className="mt-1 text-[13px] text-muted">Se prende <b className="text-ink">solo cuando llega un pedido</b>, hasta el tope, y se apaga solo. <b className="text-ink">US$0 en reposo.</b> El primer video espera unos segundos de arranque.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-muted">Tope (máx. a la vez):</span>
                {topeOpciones.map((n) => (
                  <button key={n} type="button" disabled={!puedeControlar} onClick={() => setTope(n)}
                    className={`rounded-lg border px-2.5 py-1 text-[13px] font-semibold transition-colors disabled:opacity-50 ${tope === n ? "border-[var(--accent-text)] bg-[var(--accent-text)]/[0.08] text-ink" : "border-line text-muted hover:text-ink"}`}>
                    {n}
                  </button>
                ))}
                <span className="text-[12px] text-muted">Ej.: pedido de 15 videos → prende hasta {tope} a la vez.</span>
              </div>
            </div>

            {/* Caliente */}
            <div className={`rounded-xl border p-3 ${modo === "caliente" ? "border-good/60 bg-good/[0.06]" : "border-line"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">🔥 Caliente {modo === "caliente" && <span className="text-[12px] text-good">· activo ({activos})</span>}</span>
                <div className="flex flex-wrap gap-1.5">
                  {[1, 2, 3, 5].map((n) => (
                    <button key={n} type="button" disabled={guardando !== null || !puedeControlar} onClick={() => aplicar("caliente", n)}
                      className={`flex min-w-[64px] flex-col items-center rounded-lg border px-2.5 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${modo === "caliente" && activos === n ? "border-[var(--accent-text)] bg-[var(--accent-text)]/[0.08]" : "border-line hover:border-ink/30"}`}>
                      <span className="text-[13px] font-bold">{n}</span>
                      <span className="text-[11px] text-muted">{money(n * usdHr)}/h</span>
                      {guardando === `caliente:${n}` && <span className="text-[10px] text-accent-text">…</span>}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-1 text-[13px] text-muted">N workers <b className="text-ink">siempre listos</b>, sin espera de arranque. Cuesta aunque no se use. Útil en días de mucha producción.</p>
            </div>

            {/* Apagado */}
            <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 ${modo === "apagado" ? "border-line bg-surface-2/40" : "border-line"}`}>
              <div>
                <span className="font-semibold">🔴 Apagado {modo === "apagado" && <span className="text-[12px] text-muted">· activo</span>}</span>
                <p className="mt-1 text-[13px] text-muted">No corre <b className="text-ink">nada</b>, ni aunque llegue un cliente. Úsalo solo si quieres cerrar el motor del todo.</p>
              </div>
              <button type="button" disabled={guardando !== null || !puedeControlar} onClick={() => aplicar("apagado")}
                className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-semibold text-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50 hover:text-ink">
                {guardando === "apagado:" ? "guardando…" : "Apagar todo"}
              </button>
            </div>

            <p className="text-[12px] text-muted">El tope real lo limita tu cuenta de RunPod. Si pides más de lo que permite, sube el límite en RunPod (Settings → Endpoints).</p>
          </div>
        </>
      )}
    </section>
  );
}
