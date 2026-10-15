"use client";

import { useEffect, useState } from "react";
import ModelLab from "./model-lab";

interface Cut {
  tipo: string;
  texto: string;
  traduccion: string;
  mostrar: string;
}
interface Result {
  titulo: string;
  traducido: boolean;
  cortes: Cut[];
}

const CODE_KEY = "creads-code";

export default function Studio() {
  const [code, setCode] = useState("");
  const [script, setScript] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    try {
      setCode(localStorage.getItem(CODE_KEY) ?? "");
    } catch {}
  }, []);

  async function split() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      try {
        localStorage.setItem(CODE_KEY, code);
      } catch {}
      const res = await fetch("/api/cuts", {
        method: "POST",
        headers: { "content-type": "application/json", "x-creads-code": code },
        body: JSON.stringify({ script }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo dividir el guion.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo dividir el guion.");
    } finally {
      setBusy(false);
    }
  }

  const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <h1 className="text-xl font-semibold">Guion → cortes</h1>
        <p className="text-sm text-muted">
          Pega tu guion ganador (inglés o español). Claude lo divide en cortes de hasta 8 segundos, listos para
          generar el video.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-muted">Código de acceso</span>
          <input
            id="code"
            type="password"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              try {
                localStorage.setItem(CODE_KEY, e.target.value);
              } catch {}
            }}
            className="max-w-xs rounded-lg border border-line bg-surface-2 px-3 py-2"
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-muted">Guion</span>
          <textarea
            id="script"
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={9}
            placeholder="We got three quotes before repairing our foundation, and honestly the price differences were insane…"
            className="rounded-lg border border-line bg-surface-2 px-3 py-2 leading-relaxed"
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={split}
            disabled={busy || !code || script.trim().length < 40}
            className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-50"
          >
            {busy ? "Dividiendo… (≈ 20 s)" : "Dividir en cortes"}
          </button>
          {error && <span className="text-sm text-bad">{error}</span>}
        </div>
      </section>

      {result && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{result.titulo}</h2>
            <span className="text-sm text-muted">
              {result.cortes.length} cortes{result.traducido ? " · traducido al inglés" : ""}
            </span>
          </div>
          <ol className="flex flex-col gap-3">
            {result.cortes.map((c, i) => (
              <li key={i} className="grid gap-2 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[auto_1fr]">
                <div className="flex items-center gap-2 sm:flex-col sm:items-start">
                  <span className="font-mono text-xs text-muted">Corte {i + 1}</span>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-accent-text">
                    {c.tipo}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="font-medium">“{c.texto}”</p>
                  <p className="text-sm text-muted">{c.traduccion}</p>
                  <p className="text-sm">
                    <span className="text-muted">Se ve: </span>
                    {c.mostrar}
                  </p>
                  <p className="font-mono text-xs text-muted">
                    {words(c.texto)} palabras · ≈ {Math.max(3, Math.round(words(c.texto) / 2.6))} s
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
      <ModelLab code={code} />
    </div>
  );
}
