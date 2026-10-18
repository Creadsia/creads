"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { btnCls, cardCls, ghostCls, PageHead } from "../_parts/ui";
import type { Traits } from "@/lib/influencer/traits";

// «Influencer IA → Mis personajes»: saved character sheets, ready to bring to life with a reference video.

interface P { id: string; name: string; sheet: string | null; description: string | null; traits: Traits | null; created_at: string }

export default function Personajes() {
  const [list, setList] = useState<P[] | null>(null);
  const [limite, setLimite] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    fetch("/api/personajes").then((r) => r.json().then((d) => ({ ok: r.ok, d }))).then(({ ok, d }) => {
      if (!ok) throw new Error(d.error || "No se pudo cargar.");
      setList(d.personajes); setLimite(d.limite);
    }).catch((e) => { setErr(e.message); setList([]); });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function borrar(p: P) {
    if (!confirm(`¿Borrar a ${p.name}? Los videos que ya hiciste con este personaje no se borran.`)) return;
    const r = await fetch(`/api/personajes?id=${p.id}`, { method: "DELETE" });
    if (r.ok) load(); else setErr((await r.json().catch(() => ({}))).error || "No se pudo borrar.");
  }
  const lleno = list && limite !== null && list.length >= limite;

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Influencer IA" lead="Crea un personaje propio eligiendo sus rasgos, guárdalo y dale vida copiando los movimientos de cualquier video. Sale con la misma cara en todos tus videos.">
        {lleno ? <span className="text-sm text-muted">Tu plan guarda hasta {limite} personaje{limite === 1 ? "" : "s"}.</span> : <Link href="/app/influencer/nuevo" className={btnCls}>Crear personaje</Link>}
      </PageHead>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      {list === null ? <p className="text-muted">Cargando…</p> : list.length === 0 ? (
        <section className={cardCls}>
          <h2 className="font-semibold">Todavía no tienes personajes</h2>
          <p className="text-sm text-muted">Elige el tipo (normal, raro, sin límites o animal), sus rasgos o toca «Sorpréndeme», y recibe su ficha: frente, perfil, espalda y cara. Los personajes raros suelen pegar más que los perfectos.</p>
          <Link href="/app/influencer/nuevo" className={`${btnCls} self-start`}>Crear mi primer personaje</Link>
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <article key={p.id} className={cardCls}>
              {p.sheet && (
                <a href={p.sheet} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-line bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.sheet} alt={`Ficha de ${p.name}`} className="aspect-video w-full object-contain" loading="lazy" />
                </a>
              )}
              <h2 className="font-semibold">{p.name}</h2>
              <div className="flex flex-wrap gap-2">
                {p.sheet && <Link href={`/app/recrear?${new URLSearchParams({ personaje: p.sheet, nombre: p.name, audio: "0" })}`} className={btnCls}>Recrear un video</Link>}
                {p.traits && <Link href={`/app/influencer/nuevo?desde=${p.id}`} className={ghostCls}>Duplicar y cambiar</Link>}
                <button type="button" onClick={() => borrar(p)} className="text-xs text-muted hover:text-bad">Borrar</button>
              </div>
            </article>
          ))}
        </div>
      )}
      <section className={cardCls}>
        <h2 className="font-semibold">Cómo darle vida</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Toca «Recrear un video» en tu personaje.</li>
          <li>Elige un video de la galería o sube el tuyo (de 3 a 30 segundos).</li>
          <li>Elige si quieres el audio original o el video sin audio. Ves el precio antes de generar.</li>
        </ol>
      </section>
    </div>
  );
}
