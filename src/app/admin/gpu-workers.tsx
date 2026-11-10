"use client";

import { useCallback, useEffect, useState } from "react";

// Panel admin → «Workers GPU»: prende/apaga los workers calientes de RunPod y muestra el estado en vivo y el
// costo por hora (owner, 10 nov 2026). Habla con /api/admin/gpu (solo owner).

interface Estado {
  health: { workers: { idle: number; running: number; ready?: number; throttled?: number; initializing?: number }; jobs: { inProgress?: number; inQueue?: number } };
  config: { workersMin: number; workersMax: number; idleTimeout: number };
  usdHr: number;
}

const money = (n: number) => `US$${n.toLocaleString("es-CL", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export default function GpuWorkers() {
  const [e, setE] = useState<Estado | null>(null);
  const [err, setErr] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/gpu", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo leer RunPod.");
      setE(d); setErr("");
    } catch (x) { setErr(x instanceof Error ? x.message : "Error"); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); const t = setInterval(cargar, 15000); return () => clearInterval(t); }, [cargar]);

  async function set(workersMin: number) {
    setGuardando(workersMin); setErr("");
    try {
      const r = await fetch("/api/admin/gpu", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workersMin, idleTimeout: workersMin > 0 ? 300 : undefined }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo cambiar.");
      await cargar();
    } catch (x) { setErr(x instanceof Error ? x.message : "Error"); }
    finally { setGuardando(null); }
  }

  const w = e?.health.workers;
  const cfg = e?.config;
  const usdHr = e?.usdHr ?? 1.75;
  const activos = cfg?.workersMin ?? 0;
  const corriendo = (w?.running ?? 0);
  const caliente = activos > 0;
  const costoActivosHr = activos * usdHr;
  const mesSiQueda = costoActivosHr * 24 * 30;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
          <span className={`h-2.5 w-2.5 rounded-full ${caliente || corriendo > 0 ? "bg-good" : "bg-muted"}`} />
          Workers GPU (RunPod)
        </h3>
        <button type="button" onClick={cargar} className="rounded-lg border border-line px-2.5 py-1 text-[13px] font-semibold text-muted hover:text-ink">Actualizar</button>
      </div>

      {cargando && !e ? <p className="text-sm text-muted">Cargando estado…</p> : null}
      {err ? <p className="rounded-lg border border-bad/40 bg-bad/[0.07] px-3 py-2 text-sm text-bad">{err}</p> : null}

      {e && (
        <>
          {/* Estado en vivo */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Calientes (fijos)", String(activos), caliente ? "text-good" : "text-muted"],
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
            <span className="text-muted">Cada worker caliente: <b className="text-ink">{money(usdHr)}/h</b></span>
            <span className="text-muted">Ahora ({activos} {activos === 1 ? "caliente" : "calientes"}): <b className="text-ink">{money(costoActivosHr)}/h</b></span>
            {activos > 0 && <span className="text-muted">Si queda 24/7: <b className="text-ink">~{money(mesSiQueda)}/mes</b></span>}
            <span className="text-muted">Máx: <b className="text-ink">{cfg?.workersMax}</b> · Idle: <b className="text-ink">{cfg?.idleTimeout}s</b></span>
          </div>

          {/* Control: prender/apagar y cuántos */}
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-muted">Dejar calientes mientras trabajas:</span>
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 5].map((n) => {
                const on = activos === n;
                return (
                  <button key={n} type="button" disabled={guardando !== null} onClick={() => set(n)}
                    className={`flex min-w-[84px] flex-col items-center rounded-xl border px-3 py-2 transition-colors disabled:opacity-50 ${on ? "border-[var(--accent-text)] bg-[var(--accent-text)]/[0.08]" : "border-line hover:border-ink/30"}`}>
                    <span className="text-sm font-bold">{n === 0 ? "Apagar" : `${n} caliente${n > 1 ? "s" : ""}`}</span>
                    <span className="text-[12px] text-muted">{n === 0 ? "US$0/h" : `${money(n * usdHr)}/h`}</span>
                    {guardando === n && <span className="mt-0.5 text-[11px] text-accent-text">guardando…</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-[13px] text-muted">
              «Caliente» = siempre listo, sin espera de arranque (bueno mientras generas). Cuesta aunque no se use.
              <b className="text-ink"> Apágalo (0) cuando termines</b> para no gastar. Cambia al tiro en RunPod.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
