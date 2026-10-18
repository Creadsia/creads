"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ToolRun from "../../_parts/tool-run";
import { btnCls, cardCls, ghostCls, inputCls, PageHead } from "../../_parts/ui";
import { ARCHETYPES, TIERS, cleanTraits, fieldsFor, sheetPrompt, surprise, type Bible, type Tier, type Traits } from "@/lib/influencer/traits";

// Influencer IA → Crear personaje: pick the type and each trait (or «Sorpréndeme»), see the instruction the
// AI will get (editable), create the sheet with «Crear personaje» (price shown before), and save it.

export default function Creador() {
  const q = useSearchParams();
  const [t, setT] = useState<Traits>({ tier: "normal", picks: {} });
  const [note, setNote] = useState("");
  const fields = useMemo(() => fieldsFor(t.tier), [t.tier]);
  const prompt = useMemo(() => sheetPrompt(t), [t]);

  // «Duplicar y cambiar»: start from a saved character's traits
  useEffect(() => {
    const id = q.get("desde");
    if (!id) return;
    fetch("/api/personajes").then((r) => r.json()).then((d) => {
      const p = (d.personajes ?? []).find((x: { id: string }) => x.id === id);
      if (p?.traits) { setT(cleanTraits(p.traits)); setNote(`Partiendo de «${p.name}»: cambia lo que quieras.`); }
    }).catch(() => {});
  }, [q]);

  const toggle = (key: string, id: string, max: number) => setT((x) => {
    const cur = x.picks[key] ?? [];
    const next = cur.includes(id) ? cur.filter((v) => v !== id) : max === 1 ? [id] : cur.length < max ? [...cur, id] : cur;
    return { ...x, picks: { ...x.picks, [key]: next } };
  });
  const setTier = (tier: Tier) => setT((x) => ({ ...cleanTraits({ ...x, tier }), bible: x.bible }));
  const setBible = (b: Partial<Bible>) => setT((x) => ({ ...x, bible: { ...(x.bible ?? {}), ...b } }));

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Crear personaje" lead="Elige el tipo y sus rasgos, o toca «Sorpréndeme». Recibes su ficha (frente, perfil, espalda y cara) y la guardas para usarla en todos tus videos.">
        <Link href="/app/influencer" className={ghostCls}>Mis personajes</Link>
      </PageHead>
      {note && <p className="text-sm text-muted">{note}</p>}

      <section className={cardCls} aria-label="Rasgos del personaje">
        <div role="radiogroup" aria-label="Tipo de personaje" className="grid gap-2 sm:grid-cols-4">
          {TIERS.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={t.tier === x.id} onClick={() => setTier(x.id)}
              className={`flex flex-col gap-0.5 rounded-xl border p-3 text-left ${t.tier === x.id ? "border-accent bg-accent/10" : "border-line hover:border-muted"}`}>
              <b className="text-sm">{x.label}</b>
              <span className="text-xs text-muted">{x.hint}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setT((x) => surprise(x))} className={btnCls}>🎲 Sorpréndeme</button>
          <button type="button" onClick={() => setT((x) => ({ tier: x.tier, picks: {}, bible: x.bible }))} className={ghostCls}>Limpiar</button>
          <span className="text-xs text-muted">«Sorpréndeme» rellena al azar lo que no elegiste.</span>
        </div>

        <div className="flex flex-col gap-4">
          {fields.map((f) => (
            <div key={f.key} role="group" aria-label={f.label} className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-muted">{f.label}{f.max > 1 ? ` (hasta ${f.max})` : ""}</span>
              <div className="flex flex-wrap gap-1.5">
                {f.opts.map((o) => {
                  const on = (t.picks[f.key] ?? []).includes(o.id);
                  return (
                    <button key={o.id} type="button" aria-pressed={on} onClick={() => toggle(f.key, o.id, f.max)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:border-muted hover:text-ink"}`}>
                      {o.es}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {t.tier !== "normal" && (
            <label className="flex items-center gap-3 text-sm">
              <span className="font-semibold text-muted">Color del cuerpo{t.tier === "animal" ? " o pelaje" : ""}</span>
              <input type="color" value={t.color ?? "#8A5CFF"} onChange={(e) => setT((x) => ({ ...x, color: e.target.value }))} className="h-8 w-12 rounded border border-line" />
              {t.color && <button type="button" onClick={() => setT((x) => ({ ...x, color: undefined }))} className="text-xs text-muted hover:text-ink">Quitar</button>}
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-muted">Descripción libre (opcional)</span>
            <textarea rows={3} maxLength={4000} value={t.extra ?? ""} onChange={(e) => setT((x) => ({ ...x, extra: e.target.value }))} placeholder="Ej: siempre anda con una taza de café y una chaqueta de cuero gastada." className={inputCls} />
          </label>
        </div>
      </section>

      <section className={cardCls} aria-labelledby="h-bible">
        <div className="flex flex-col gap-1">
          <h2 id="h-bible" className="font-semibold">Su personalidad (opcional, para sus videos)</h2>
          <p className="text-xs text-muted">Un personaje viral no es solo una cara: es alguien reconocible, con su humor, sus frases y sus gestos. Esto no cambia la ficha; lo usan los guiones y el Community manager para que cada video suene a él.</p>
        </div>
        <div role="radiogroup" aria-label="Arquetipo" className="grid gap-2 sm:grid-cols-3">
          {ARCHETYPES.map((a) => (
            <button key={a.id} type="button" role="radio" aria-checked={t.bible?.arquetipo === a.id} onClick={() => setBible({ arquetipo: t.bible?.arquetipo === a.id ? undefined : a.id })}
              className={`flex flex-col gap-0.5 rounded-xl border p-3 text-left ${t.bible?.arquetipo === a.id ? "border-accent bg-accent/10" : "border-line hover:border-muted"}`}>
              <b className="text-sm">{a.label}</b><span className="text-xs text-muted">{a.hint}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["personalidad", "Personalidad", "Ej: un lord inglés que se toma todo con una seriedad absurda."],
            ["tono", "Tono", "Ej: solemne, pausado, nunca se ríe de sus propios chistes."],
            ["frases", "Frases que repite", "Ej: «Esto es inaceptable, querido.»"],
            ["gestos", "Gestos que lo identifican", "Ej: se acomoda el monóculo antes de cada frase."],
            ["formatos", "Tipos de reels", "Ej: reacciones a cosas cotidianas, POVs, mini historias de 3 partes."],
          ] as [keyof Bible, string, string][]).map(([k, label, ph]) => (
            <label key={k} className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-muted">{label}</span>
              <input value={t.bible?.[k] ?? ""} maxLength={800} onChange={(e) => setBible({ [k]: e.target.value })} placeholder={ph} className={inputCls} />
            </label>
          ))}
        </div>
      </section>

      <ToolRun toolId="crear-personaje" initial={{}} promptValue={prompt} imagesLabel="Referencias (opcional): 1 foto de cara de guía + hasta 3 de estilo"
        resultExtra={(url) => <Guardar sheet={url} traits={t} />} />
      <p className="text-xs text-muted">Cada ficha es una tirada: si no te convence, vuelve a crearla (cambia algún rasgo o toca «Sorpréndeme»). Nunca uses la cara de una persona famosa o de alguien sin su permiso.</p>
    </div>
  );
}

function Guardar({ sheet, traits }: { sheet: string; traits: Traits }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/personajes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, sheet, traits }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo guardar.");
      setMsg({ ok: true, text: `${name} quedó guardado en «Mis personajes».` });
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : "No se pudo guardar." }); }
    setBusy(false);
  }
  if (msg?.ok) return <Siguiente nombre={name.trim()} sheet={sheet} text={msg.text} />;
  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-accent/5 p-3">
      <label htmlFor="pj-name" className="text-sm font-semibold">¿Te gusta? Guárdalo:</label>
      <input id="pj-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Nombre del personaje" className={`${inputCls} max-w-xs`} />
      <button type="submit" disabled={busy || name.trim().length < 2} className={btnCls}>{busy ? "Guardando…" : "Guardar personaje"}</button>
      {msg && <span className="text-sm text-bad">{msg.text}</span>}
    </form>
  );
}

/** After saving: put the character into a video right away (Recrear), with or without the original sound. */
export function Siguiente({ nombre, sheet, text }: { nombre: string; sheet: string; text?: string }) {
  const [mudo, setMudo] = useState(true);
  const q = new URLSearchParams({ personaje: sheet, nombre, ...(mudo ? { audio: "0" } : {}) });
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-accent/40 bg-accent/5 p-3">
      {text && <p className="text-sm text-good">{text}</p>}
      <p className="text-sm"><b>Ahora ponlo en un video.</b> <span className="text-muted">Elige un video de la galería o sube el tuyo, y {nombre} reemplaza a la persona que aparece, con sus mismos movimientos.</span></p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={mudo} onChange={(e) => setMudo(e.target.checked)} />
        <span>Sin audio ({nombre} no habla: le pones música o voz después)</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Link href={`/app/recrear?${q}`} className={btnCls}>Recrear un video con {nombre}</Link>
        <Link href="/app/influencer" className={ghostCls}>Ver mis personajes</Link>
      </div>
    </div>
  );
}
