"use client";

import { useEffect, useMemo, useState } from "react";
import { type Cue, cueFixes, parseSrt } from "@/lib/subtitle-diff";
import type { CaptionStyle } from "@/lib/caption-style";
import CaptionEditor from "./caption-editor";
import { ghostCls, inputCls } from "./ui";

// «Editar subtítulos» for a finished ad (owner, 22 Oct 2026): every subtitle line as text, the customer fixes
// what's wrong and saves. Free: the same video is built again in 1–3 minutes with the words corrected (same
// clips, voice, presenter and headlines). Ads without saved lines (demos, older ads) get «dice → debe decir».
// «Mover y estilo»: drag the subtitles anywhere (off the face), change size, font and colours, same editor
// as the studio's final assembly.

type Fix = { de: string; a: string };

export default function SubtitleEditor({ adId, video, title, aspect = "9:16", onClose, onDone }: { adId: string; video: string; title: string; aspect?: string; onClose: () => void; onDone: (url: string) => void }) {
  const [modo, setModo] = useState<"cargando" | "lineas" | "palabras" | "sin">("cargando");
  const [cues, setCues] = useState<Cue[]>([]);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [pairs, setPairs] = useState<Fix[]>([{ de: "", a: "" }]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [url, setUrl] = useState(video);
  const [tab, setTab] = useState<"texto" | "mover">("texto");
  const [style0, setStyle0] = useState<CaptionStyle | null>(null); // as the video has it now
  const [style, setStyle] = useState<CaptionStyle | null>(null); // as the customer leaves it
  const [fondo, setFondo] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/ads/${adId}/subtitulos`).then((r) => r.json()).then((d) => {
      const list = d.srt ? parseSrt(d.srt) : [];
      setCues(list);
      setModo(list.length ? "lineas" : d.modo === "sin" ? "sin" : "palabras");
      if (d.estilo) { setStyle0(d.estilo); setStyle(d.estilo); }
      setFondo(d.fondo ?? null);
    }).catch(() => setModo("palabras"));
  }, [adId]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [busy, onClose]);

  // what the edited lines mean as corrections (or why a line can't be saved like that)
  const plan = useMemo(() => {
    const fixes: Fix[] = [];
    const bad: number[] = [];
    let problem = "";
    for (const c of cues) {
      const now = edits[c.n];
      if (now === undefined || now.trim() === c.texto) continue;
      const r = cueFixes(c.texto, now);
      if ("error" in r) { bad.push(c.n); problem = r.error; } else fixes.push(...r);
    }
    return { fixes, bad, problem };
  }, [cues, edits]);

  const pending = modo === "lineas" ? plan.fixes : pairs.filter((p) => p.de.trim()).map((p) => ({ de: p.de.trim(), a: p.a.trim() }));
  const moved = Boolean(style && style0 && JSON.stringify(style) !== JSON.stringify(style0));
  const count = pending.length + (moved ? 1 : 0);

  async function save() {
    if (!count || busy || plan.bad.length) return;
    setBusy(true); setErr(""); setMsg("");
    const r = await fetch(`/api/ads/${adId}/subtitulos`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cambios: pending.slice(0, 15), ...(moved ? { estilo: style } : {}) }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok || !d.url) return setErr(d.error || "No se pudo guardar. Intenta de nuevo.");
    setUrl(d.url);
    onDone(d.url);
    setMsg("Listo: tu video ya tiene los subtítulos como los dejaste.");
    if (moved) setStyle0(style);
    // the new lines become the starting point for more changes
    setCues((list) => list.map((c) => (edits[c.n] !== undefined ? { ...c, texto: edits[c.n].trim() } : c)));
    setEdits({}); setPairs([{ de: "", a: "" }]);
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="sub-title" className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-line bg-surface sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 id="sub-title" className="font-semibold">Editar subtítulos</h2>
            <p className="truncate text-xs text-muted">{title}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className={ghostCls}>Cerrar</button>
        </div>

        <div className={`grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 ${tab === "mover" ? "" : "md:grid-cols-[220px_1fr]"}`}>
          {tab === "texto" && <video key={url} src={url} controls playsInline className="mx-auto aspect-[9/16] w-32 rounded-xl bg-black object-cover md:w-full" />}

          <div className="flex min-w-0 flex-col gap-3">
            {modo === "cargando" && <p className="text-sm text-muted">Cargando los subtítulos…</p>}
            {modo === "sin" && <p className="text-sm text-muted">Este anuncio se armó sin subtítulos, así que no hay nada que editar.</p>}

            {style && (modo === "lineas" || modo === "palabras") && (
              <div role="tablist" aria-label="Qué editar" className="flex w-fit rounded-lg border border-line p-0.5 text-sm">
                {([["texto", "Texto"], ["mover", "Mover y estilo"]] as const).map(([k, l]) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-md px-4 py-1.5 font-semibold ${tab === k ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>{l}</button>
                ))}
              </div>
            )}

            {tab === "mover" && style && (
              <>
                <p className="text-sm text-muted">Arrastra el texto donde quieras (por ejemplo, para que no tape la cara) o usa Arriba / Centro / Abajo. También puedes cambiar el tamaño, la letra y los colores.</p>
                <CaptionEditor value={style} onChange={setStyle} aspect={aspect} sample={cues[0]?.texto || "Así se verán tus subtítulos"} video={fondo} />
              </>
            )}

            {tab === "texto" && modo === "lineas" && (
              <>
                <p className="text-sm text-muted">Corrige lo que está mal escrito directo en el texto. Se mantienen la voz, las escenas y los tiempos; solo cambian las palabras en pantalla. Es gratis.</p>
                <ol className="flex flex-col gap-1.5">
                  {cues.map((c) => {
                    const v = edits[c.n] ?? c.texto;
                    const changed = v.trim() !== c.texto;
                    const bad = plan.bad.includes(c.n);
                    return (
                      <li key={c.n} className="flex items-center gap-2">
                        <span className="w-14 shrink-0 font-mono text-[11px] text-muted">{c.desde.slice(3, 8)}</span>
                        <input value={v} onChange={(e) => setEdits((x) => ({ ...x, [c.n]: e.target.value }))} disabled={busy}
                          aria-label={`Subtítulo ${c.n}`} className={`${inputCls} flex-1 ${bad ? "border-bad" : changed ? "border-ink" : ""}`} />
                        {changed && <button type="button" onClick={() => setEdits((x) => { const n = { ...x }; delete n[c.n]; return n; })} className="text-xs text-muted hover:text-ink" aria-label="Deshacer el cambio">↺</button>}
                      </li>
                    );
                  })}
                </ol>
                {plan.problem && <p className="text-sm text-bad">{plan.problem}</p>}
              </>
            )}

            {tab === "texto" && modo === "palabras" && (
              <>
                <p className="text-sm text-muted">Escribe la palabra como aparece en el video y cómo debería decir. Se cambia en todo el video. Es gratis.</p>
                {pairs.map((p, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2">
                    <input value={p.de} onChange={(e) => setPairs((l) => l.map((x, k) => (k === i ? { ...x, de: e.target.value } : x)))} placeholder="Dice: CREATZIA.COM" aria-label="Cómo aparece" className={inputCls} disabled={busy} />
                    <input value={p.a} onChange={(e) => setPairs((l) => l.map((x, k) => (k === i ? { ...x, a: e.target.value } : x)))} placeholder="Debe decir: creadsia.com" aria-label="Cómo debería decir" className={inputCls} disabled={busy} />
                  </div>
                ))}
                {pairs.length < 8 && <button type="button" onClick={() => setPairs((l) => [...l, { de: "", a: "" }])} className="w-fit text-xs text-muted underline hover:text-ink">+ Otra palabra</button>}
              </>
            )}

            {err && <p className="text-sm text-bad">{err}</p>}
            {msg && <p className="text-sm font-semibold text-good">{msg}</p>}
          </div>
        </div>

        {(modo === "lineas" || modo === "palabras") && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
            <span className="text-xs text-muted">{busy ? "Armando el video de nuevo… tarda 1 a 3 minutos, no cierres esta ventana." : count ? `${count} ${count === 1 ? "cambio" : "cambios"} por guardar` : "Sin cambios todavía"}</span>
            <button type="button" onClick={save} disabled={busy || !count || plan.bad.length > 0} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">
              {busy ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
