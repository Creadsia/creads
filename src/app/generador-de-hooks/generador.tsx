"use client";

import { useState } from "react";
import type { ResultadoHooks } from "@/lib/generador-hooks";
import { TIPO_LABEL } from "@/lib/tanda-tipos";
import { evento } from "../herramientas-track";

type Modo = "link" | "texto";
type Resultado = ResultadoHooks & { idioma: "es" | "en"; leido: { titulo: string; url: string } | null };

const field = "w-full min-w-0 rounded-xl border border-line bg-bg/60 px-4 py-3 text-[15px]";
const tab = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm font-semibold ${on ? "bg-ink text-bg" : "text-muted hover:text-ink"}`;

function Copiar({ texto, label = "Copiar" }: { texto: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 1500); } catch {} }}
      className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-muted hover:text-ink"
    >
      {ok ? "Copiado" : label}
    </button>
  );
}

export default function Generador() {
  const [modo, setModo] = useState<Modo>("link");
  const [url, setUrl] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [idioma, setIdioma] = useState<"es" | "en">("es");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [res, setRes] = useState<Resultado | null>(null);

  async function generar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const r = await fetch("/api/herramientas/hooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(modo === "link" ? { url, idioma } : { descripcion, idioma }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || "No pudimos crear tus hooks. Intenta de nuevo en un momento.");
        // a page that couldn't be read: offer the description right away
        if (r.status === 422) setModo("texto");
        return;
      }
      setRes(d as Resultado);
      evento("tool_hooks_used", { con_link: modo === "link", idioma, hooks: (d as Resultado).angulos.reduce((n, a) => n + a.hooks.length, 0) });
      setTimeout(() => document.getElementById("resultado")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch {
      setError("No hay conexión. Revisa tu internet e intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  const todos = res ? res.angulos.map((a) => `${a.titulo}\n${a.hooks.map((h) => `- ${h}`).join("\n")}`).join("\n\n") : "";

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={generar} className="flex max-w-3xl flex-col gap-4 rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Cómo nos cuentas tu producto" className="flex gap-1 rounded-xl border border-line p-1">
            <button type="button" role="tab" aria-selected={modo === "link"} onClick={() => setModo("link")} className={tab(modo === "link")}>Pegar link</button>
            <button type="button" role="tab" aria-selected={modo === "texto"} onClick={() => setModo("texto")} className={tab(modo === "texto")}>Describir producto</button>
          </div>
          <div role="radiogroup" aria-label="Idioma de los hooks" className="flex items-center gap-1 rounded-xl border border-line p-1">
            <span className="px-2 text-xs text-muted">Hooks en</span>
            <button type="button" role="radio" aria-checked={idioma === "es"} onClick={() => setIdioma("es")} className={tab(idioma === "es")}>Español</button>
            <button type="button" role="radio" aria-checked={idioma === "en"} onClick={() => setIdioma("en")} className={tab(idioma === "en")}>English</button>
          </div>
        </div>
        {modo === "link" ? (
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Link de tu producto o de tu página</span>
            <input type="url" inputMode="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.tu-tienda.com/producto" className={field} />
          </label>
        ) : (
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">¿Qué vendes y a quién?</span>
            <textarea required minLength={15} maxLength={2000} rows={4} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Botella térmica de acero que mantiene el agua fría 24 horas, para gente que entrena. Cuesta $14.990 con envío gratis." className={field} />
          </label>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={cargando} className="rounded-xl bg-[image:var(--grad)] px-6 py-3 font-semibold text-white disabled:opacity-60">
            {cargando ? "Leyendo y escribiendo…" : "Crear mis hooks gratis"}
          </button>
          <span className="text-sm text-muted">{cargando ? "Tarda unos 20 segundos." : "Sin registrarte. 3 usos gratis al día."}</span>
        </div>
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      </form>

      {res && (
        <section id="resultado" aria-label="Tus ángulos y hooks" className="flex scroll-mt-6 flex-col gap-5" lang={res.idioma}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold">{res.producto ? `Hooks para ${res.producto}` : "Tus hooks"}</h2>
              {res.leido && <p className="text-sm text-muted">Leímos: {res.leido.titulo || res.leido.url}</p>}
            </div>
            <Copiar texto={todos} label="Copiar todos" />
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {res.angulos.map((a) => (
              <article key={a.titulo} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
                <span className="self-start rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-muted">{TIPO_LABEL[a.tipo]}</span>
                <h3 className="text-lg font-bold leading-snug">{a.titulo}</h3>
                {a.por_que && <p className="text-sm text-muted"><b className="text-ink">Por qué puede funcionar:</b> {a.por_que}</p>}
                <ol className="flex flex-col gap-2">
                  {a.hooks.map((h) => (
                    <li key={h} className="flex items-start justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2.5">
                      <span className="font-medium">{h}</span>
                      <Copiar texto={h} />
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
          <div className="flex flex-col items-start gap-4 rounded-3xl border border-line bg-surface p-6 sm:p-8">
            <h2 className="max-w-[28ch] font-display text-xl font-semibold leading-tight sm:text-2xl">
              Para crear las imágenes o videos con estos hooks, <span className="bg-[image:var(--grad)] bg-clip-text text-transparent">crea tu cuenta</span>
            </h2>
            <p className="max-w-2xl text-muted">
              En Creads pegas el mismo link, eliges los ángulos y te armamos tus anuncios en imagen para feed (4:5) y stories (9:16), o videos con la voz y el estilo que elijas.
            </p>
            <a href="/registro" onClick={() => evento("tool_hooks_signup_click", { idioma: res.idioma })} className="rounded-xl bg-ink px-6 py-3 font-semibold text-bg">
              Crear mi cuenta
            </a>
          </div>
        </section>
      )}
    </div>
  );
}
