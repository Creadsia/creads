"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { type Example, labHref } from "@/lib/examples";
import { Gallery } from "../gallery";

// The creation panel of the site's Video and Imagen pages: pick a model, write the idea, choose the
// format, and «Crear» opens the studio with everything filled in (sign-in first if needed). Examples
// on the right fill the panel. Nothing here generates or spends credits.

export interface PanelModel { id: string; label: string; credits: string; aspects: string[]; seconds?: number[]; note?: string }
const ASPECTS = ["9:16", "4:5", "1:1", "16:9"] as const;
const NAME: Record<string, string> = { "9:16": "Vertical", "4:5": "Feed", "1:1": "Cuadrado", "16:9": "Horizontal" };
const nearest = (n: number, list: number[]) => list.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));

function Chip({ on, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean }) {
  return <button type="button" aria-pressed={on} {...p} className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${on ? "border-accent-text bg-accent/12 text-accent-text" : "border-line text-muted hover:text-ink"}`} />;
}

export default function CategoryStudio({ kind, models, examples }: { kind: "video" | "imagen"; models: PanelModel[]; examples: Example[] }) {
  const video = kind === "video";
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<string>(video ? "9:16" : "4:5");
  const [seconds, setSeconds] = useState(8);
  const [from, setFrom] = useState("");
  const [picking, setPicking] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const m = models.find((x) => x.id === modelId) ?? models[0];
  const fmt = m.aspects.includes(aspect) ? aspect : m.aspects.includes("9:16") ? "9:16" : m.aspects[0];
  const secs = m.seconds?.length ? (m.seconds.includes(seconds) ? seconds : nearest(seconds, m.seconds)) : undefined;

  function use(e: Example) {
    if (e.model && models.some((x) => x.id === e.model)) setModelId(e.model);
    setAspect(e.aspect);
    if (e.seconds) setSeconds(e.seconds);
    if (e.idea) setPrompt(e.idea);
    setFrom(e.title);
    panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const go = labHref({ prompt: prompt.trim() || undefined, model: m.id, aspect: fmt, seconds: secs });

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
      <div ref={panel} className="flex scroll-mt-28 flex-col gap-5 rounded-3xl border border-line bg-surface p-5 lg:sticky lg:top-28">
        {from && <p className="rounded-xl bg-accent/10 px-3 py-2 text-xs">Configuración copiada de <b>«{from}»</b>. Ajusta lo que quieras.</p>}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted">Modelo</span>
          <button type="button" onClick={() => setPicking((v) => !v)} aria-expanded={picking}
            className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-left hover:border-muted/60">
            <span className="flex flex-col"><b className="text-sm">{m.label}</b><span className="text-xs text-muted">{[m.credits, m.note].filter(Boolean).join(" · ")}</span></span>
            <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-muted transition-transform ${picking ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {picking && (
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-xl border border-line p-1" role="radiogroup" aria-label="Modelo">
              {models.map((x) => (
                <button key={x.id} type="button" role="radio" aria-checked={x.id === m.id} onClick={() => { setModelId(x.id); setPicking(false); }}
                  className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${x.id === m.id ? "bg-accent/12 text-accent-text" : "hover:bg-surface-2"}`}>
                  <span className="flex flex-col"><b>{x.label}</b>{x.note && <span className="text-xs text-muted">{x.note}</span>}</span>
                  <span className="shrink-0 text-xs text-muted">{x.credits}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="flex flex-col gap-2">
          <span className="flex justify-between text-xs font-semibold text-muted">{video ? "Qué pasa en el video" : "Qué quieres ver"}<span className="font-medium">Mejor en inglés</span></span>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} maxLength={1500}
            placeholder={video ? "Selfie video of a woman in her kitchen holding a product, talking to camera, natural light, UGC style" : "Product photo of a serum bottle on a marble shelf, soft morning light, premium ad"}
            className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm leading-relaxed" />
        </label>
        {video && m.seconds?.length ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted">Duración</span>
            <div className="flex flex-wrap gap-1.5">{m.seconds.map((s) => <Chip key={s} on={secs === s} onClick={() => setSeconds(s)}>{s} s</Chip>)}</div>
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted">Formato</span>
          <div className="grid grid-cols-4 gap-1.5">
            {ASPECTS.map((a) => (
              <Chip key={a} on={fmt === a} disabled={!m.aspects.includes(a)} onClick={() => setAspect(a)}>
                <span className="flex flex-col items-center"><span>{a}</span><span className="text-[10px] font-medium opacity-70">{NAME[a]}</span></span>
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <a href={go} className="rounded-xl bg-[image:var(--grad)] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_12px_32px_-12px_rgba(255,43,214,0.7)]">{video ? "Crear video" : "Crear imagen"}</a>
          <p className="text-center text-xs text-muted">Te lleva al estudio con todo listo. Ahí ves el precio antes de generar. <Link href="/#pricing" className="font-semibold underline">Planes desde US$25</Link>.</p>
        </div>
      </div>
      <Gallery examples={examples} filterBy={video ? "model" : "tag"} onUse={use} columns="columns-2 sm:columns-3 2xl:columns-4" />
    </div>
  );
}
