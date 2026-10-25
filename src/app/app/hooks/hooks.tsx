"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cardCls, inputCls } from "../_parts/ui";
import { TIPOS, TIPO_LABEL } from "@/lib/tanda-tipos";
import { HOOKS, RUBROS, RUBRO_INFO, type Idioma, type Rubro, type Vars, esRubro, rellenar } from "@/lib/hooks-biblioteca";

// «Hooks por rubro»: hook templates by industry and angle, with the customer's product filled in live.

export default function HooksBiblioteca() {
  const [rubro, setRubro] = useState<Rubro>("ecommerce");
  const [idioma, setIdioma] = useState<Idioma>("es");
  const [vars, setVars] = useState<Vars>({});
  const [copiado, setCopiado] = useState("");

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("rubro");
    if (esRubro(r)) setRubro(r);
  }, []);

  async function copiar(texto: string) {
    try { await navigator.clipboard.writeText(texto); setCopiado(texto); setTimeout(() => setCopiado((c) => (c === texto ? "" : c)), 1500); } catch { /* clipboard blocked */ }
  }

  const info = RUBRO_INFO[rubro];
  return (
    <div className="flex flex-col gap-5">
      <div className={cardCls}>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Rubro">
          {RUBROS.map((r) => (
            <button key={r} type="button" role="tab" aria-selected={r === rubro} onClick={() => setRubro(r)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${r === rubro ? "border-accent text-ink" : "border-line text-muted hover:text-ink"}`}>
              {RUBRO_INFO[r].label.es}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">{info.nota}</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Idioma
            <select value={idioma} onChange={(e) => setIdioma(e.target.value === "en" ? "en" : "es")} className={inputCls}>
              <option value="es">Español</option><option value="en">Inglés</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Tu producto
            <input value={vars.producto ?? ""} onChange={(e) => setVars({ ...vars, producto: e.target.value })} placeholder="{producto}" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Tu público
            <input value={vars.publico ?? ""} onChange={(e) => setVars({ ...vars, publico: e.target.value })} placeholder="{publico}" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Precio
            <input value={vars.precio ?? ""} onChange={(e) => setVars({ ...vars, precio: e.target.value })} placeholder="{precio}" className={inputCls} />
          </label>
        </div>
        <p className="text-xs text-muted">Usa solo lo que sea verdad para tu negocio: si no tienes envío gratis o clase de prueba, no lo digas. Nada de inventar números, opiniones ni resultados.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {TIPOS.map((t) => (
          <section key={t} className={cardCls}>
            <header className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold">{TIPO_LABEL[t]}</h2>
              <Link href={`/app/tanda?rubro=${rubro}`} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink">Usar en mi tanda</Link>
            </header>
            <ul className="flex flex-col gap-2">
              {HOOKS[rubro][t].map((h) => {
                const texto = rellenar(h[idioma], vars);
                return (
                  <li key={h.es} className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
                    <span className="text-sm leading-snug">{texto}</span>
                    <button type="button" onClick={() => copiar(texto)} className="shrink-0 rounded-lg border border-line px-2 py-1 text-xs font-semibold text-muted hover:text-ink" aria-label={`Copiar: ${texto}`}>
                      {copiado === texto ? "Copiado" : "Copiar"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
