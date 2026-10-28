"use client";

import { useEffect, useRef, useState } from "react";
import { CAPTION_PRESETS, type CaptionStyle, normalizeStyle } from "@/lib/caption-style";
import { ANIMACIONES, FORMATOS, FUENTES, type Texto, VELOCIDADES } from "@/lib/editor-tipos";
import { ANIM_NOMBRE, Chip, type Ed, FORMATO_INFO, Icon, PRESETS, RATIO, Seccion, Segmented, Slider, SubtituloLinea, Switch, Swatches, fmt, len } from "./piezas";

// The options of each tool (left panel on desktop, bottom sheet on phones). Selecting something on the
// timeline or the preview opens its tool with that item's properties on top.

const small = "inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface-2/60 px-3 text-[13px] font-semibold text-muted hover:text-ink disabled:pointer-events-none disabled:opacity-35 lg:min-h-9";

/** One subtitle word in «Lo que se dice»: tap it to fix its spelling. Fixed words are highlighted. */
function PalabraEditable({ w, orig, fixed, onSave, onFocus }: { w: string; orig: string; fixed: boolean; onSave: (txt: string) => void; onFocus: () => void }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(w);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!edit) setVal(w); }, [w, edit]);
  useEffect(() => { if (edit) { ref.current?.focus(); ref.current?.select(); } }, [edit]);
  const commit = () => { setEdit(false); if (val !== w) onSave(val); };
  if (edit) return (
    <input ref={ref} value={val} onChange={(e) => setVal(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } else if (e.key === "Escape") { setVal(w); setEdit(false); } }}
      maxLength={60} aria-label={`Corregir «${orig}»`} enterKeyHint="done"
      className="min-w-[2ch] max-w-full rounded-md border border-[var(--sel)] bg-surface px-1.5 py-0.5 text-sm font-semibold text-ink outline-none" style={{ width: `${Math.max(2, val.length + 1)}ch` }} />
  );
  return (
    <button type="button" onClick={() => { onFocus(); setEdit(true); }} title={fixed ? `Corregido (original: «${orig}»). Tocar para editar.` : "Tocar para corregir"}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm transition-colors ${fixed ? "bg-[var(--sel)]/15 font-semibold text-ink ring-1 ring-[var(--sel)]/40" : "font-medium text-muted hover:bg-surface-2 hover:text-ink"}`}>
      {w || "—"}{fixed && <Icon name="pen" className="h-3 w-3 opacity-60" />}
    </button>
  );
}

export function Panel({ ed }: { ed: Ed }) {
  if (ed.tool === "cortes") return <Cortes ed={ed} />;
  if (ed.tool === "texto") return <Textos ed={ed} />;
  if (ed.tool === "subtitulos") return <Subtitulos ed={ed} />;
  if (ed.tool === "audio") return <Audio ed={ed} />;
  if (ed.tool === "velocidad") return <Velocidad ed={ed} />;
  return <Formato ed={ed} />;
}

/** A still of a clip at a given second (the first frame of its filmstrip, or the video itself). */
function Still({ ed, clipId, at = 0, className = "" }: { ed: Ed; clipId: string; at?: number; className?: string }) {
  const s = ed.strips[clipId];
  const url = ed.clipOf(clipId)?.url;
  if (s && s !== "x" && s.frames.length) {
    const f = s.frames[Math.max(0, Math.min(s.frames.length - 1, Math.round(at / s.step)))];
    return <span className={`block bg-black bg-cover bg-center ${className}`} style={{ backgroundImage: `url(${f})` }} />;
  }
  return <span className={`relative block overflow-hidden bg-black ${className}`}>{url && <video src={`${url}#t=${(at + 0.05).toFixed(2)}`} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />}</span>;
}

// ---------------------------------------------------------------- cuts

function Cortes({ ed }: { ed: Ed }) {
  const { p, sel, d } = ed;
  const i = sel?.tipo === "corte" ? sel.i : -1;
  const c = i >= 0 ? p.cortes[i] : null;
  const dur = c ? ed.durs[c.clipId] ?? Math.max(c.b, 10) : 0;
  return (
    <div className="flex flex-col gap-6">
      {c ? (
        <Seccion title={`Corte ${i + 1} seleccionado`} aside={<button type="button" onClick={() => ed.setSel(null)} className="text-[13px] font-semibold text-muted hover:text-ink">Listo</button>}>
          <div className="flex gap-3 rounded-xl border border-line bg-surface-2/50 p-2.5">
            <Still ed={ed} clipId={c.clipId} at={c.a} className="h-20 w-[45px] shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-col gap-0.5 text-[13px]">
              <b className="text-sm text-ink">{len(c).toFixed(1)} segundos</b>
              <span className="line-clamp-3 text-muted">{ed.clipOf(c.clipId)?.texto || "Sin texto del guion"}</span>
            </div>
          </div>
          <Slider label="Empieza en" unit="s" min={0} max={dur} step={0.05} value={c.a} onChange={(v) => ed.setCorte(i, { a: Math.min(v, c.b - 0.3) })} />
          <Slider label="Termina en" unit="s" min={0} max={dur} step={0.05} value={c.b} onChange={(v) => ed.setCorte(i, { b: Math.max(v, c.a + 0.3) })} />
          <p className="text-[13px] text-muted">También puedes arrastrar los bordes del corte en la línea de tiempo.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={small} onClick={() => ed.mover(i, -1)} disabled={i === 0}><Icon name="left" className="h-4 w-4" />Antes</button>
            <button type="button" className={small} onClick={() => ed.mover(i, 1)} disabled={i === p.cortes.length - 1}>Después<Icon name="right" className="h-4 w-4" /></button>
            <button type="button" className={small} onClick={ed.dividir}><Icon name="scissors" className="h-4 w-4" />Dividir aquí</button>
            <button type="button" className={small} onClick={ed.duplicar}><Icon name="copy" className="h-4 w-4" />Duplicar</button>
            <button type="button" className={`${small} col-span-2 hover:text-bad`} onClick={ed.borrar} disabled={p.cortes.length < 2}><Icon name="trash" className="h-4 w-4" />Quitar este corte</button>
          </div>
        </Seccion>
      ) : (
        <Seccion title="Tu línea de tiempo">
          <ol className="flex flex-col gap-1.5">
            {p.cortes.map((x, k) => (
              <li key={k}>
                <button type="button" onClick={() => { ed.setSel({ tipo: "corte", i: k }); ed.buscar(ed.starts[k] + 0.01, false); }}
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2/40 p-2 text-left hover:border-ink/25">
                  <Still ed={ed} clipId={x.clipId} at={x.a} className="h-14 w-8 shrink-0 rounded" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-semibold text-ink">Corte {k + 1} <span className="font-mono text-[13px] font-normal text-muted">· {len(x).toFixed(1)} s</span></span>
                    <span className="truncate text-[13px] text-muted">{ed.clipOf(x.clipId)?.texto || "—"}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="text-[13px] text-muted">Toca un corte para recortarlo, moverlo, duplicarlo o quitarlo. Arrástralo en la línea de tiempo para cambiar el orden.</p>
        </Seccion>
      )}

      <Seccion title="Clips de tu anuncio">
        <div className="grid grid-cols-3 gap-2">
          {d.cortes.map((x) => (
            <button key={x.id} type="button" onClick={() => ed.agregarCorte(x.id)} title={x.texto} className="group relative overflow-hidden rounded-lg border border-line text-left hover:border-ink/30">
              <Still ed={ed} clipId={x.id} className="aspect-[9/14] w-full" />
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 to-transparent px-1.5 pt-4 pb-1 text-[12px] font-semibold text-white">
                Clip {x.idx + 1}<span className="grid h-6 w-6 place-items-center rounded-full bg-white/20 group-hover:bg-[image:var(--grad)]"><Icon name="plus" className="h-3.5 w-3.5" /></span>
              </span>
            </button>
          ))}
        </div>
        <p className="text-[13px] text-muted">Toca un clip para sumarlo al final.</p>
      </Seccion>
    </div>
  );
}

// ---------------------------------------------------------------- texts

function Textos({ ed }: { ed: Ed }) {
  const { p, sel, t, total } = ed;
  const i = sel?.tipo === "texto" ? sel.i : -1;
  const tx = i >= 0 ? p.textos[i] : null;
  const set = (patch: Partial<Texto>) => ed.setTexto(i, patch);
  return (
    <div className="flex flex-col gap-6">
      {tx && (
        <Seccion title="Texto seleccionado" aside={<button type="button" onClick={() => ed.setSel(null)} className="text-[13px] font-semibold text-muted hover:text-ink">Listo</button>}>
          <textarea id="ed-texto" className="min-h-20 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[15px] text-ink" rows={2} maxLength={160} value={tx.texto} onChange={(e) => set({ texto: e.target.value })} aria-label="Texto" />
          <div className="grid grid-cols-2 gap-2 text-[13px]">
            <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface-2/50 p-2.5">
              <label className="flex items-center justify-between gap-1 text-muted">Aparece
                <span className="flex items-center gap-1"><input type="number" inputMode="decimal" step={0.1} min={0} max={total} value={Number(tx.desde.toFixed(2))} onChange={(e) => set({ desde: Math.max(0, Math.min(Number(e.target.value) || 0, tx.hasta - 0.3)) })}
                  className="h-9 w-16 rounded-md border border-line bg-surface px-1.5 text-right font-mono text-[13px] text-ink tabular-nums" />s</span>
              </label>
              <button type="button" className="min-h-9 text-left font-semibold text-accent-text" onClick={() => set({ desde: Math.min(t, tx.hasta - 0.3) })}>Desde aquí</button>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface-2/50 p-2.5">
              <label className="flex items-center justify-between gap-1 text-muted">Se va
                <span className="flex items-center gap-1"><input type="number" inputMode="decimal" step={0.1} min={0} max={total} value={Number(tx.hasta.toFixed(2))} onChange={(e) => set({ hasta: Math.min(total, Math.max(Number(e.target.value) || 0, tx.desde + 0.3)) })}
                  className="h-9 w-16 rounded-md border border-line bg-surface px-1.5 text-right font-mono text-[13px] text-ink tabular-nums" />s</span>
              </label>
              <button type="button" className="min-h-9 text-left font-semibold text-accent-text" onClick={() => set({ hasta: Math.max(t, tx.desde + 0.3) })}>Hasta aquí</button>
            </div>
          </div>
          <button type="button" className={small} onClick={() => set({ desde: 0, hasta: total })}>Todo el video</button>

          <span className="pt-1 text-[13px] font-semibold text-muted">Letra</span>
          <div className="grid grid-cols-2 gap-2">
            {FUENTES.map((f) => (
              <Chip key={f} on={tx.fuente === f} onClick={() => set({ fuente: f })} style={{ fontFamily: `"${f}", sans-serif` }}>
                <span className="text-[15px] font-normal">{f.replace(/ (ExtraBold|Black)$/, "")}</span>
              </Chip>
            ))}
          </div>
          <Slider label="Tamaño" min={3} max={16} step={0.5} unit="" value={tx.tam} onChange={(v) => set({ tam: v })} />
          <span className="text-[13px] font-semibold text-muted">Color</span>
          <Swatches label="Color del texto" value={tx.color} onChange={(c) => c && set({ color: c })} />
          <span className="text-[13px] font-semibold text-muted">Fondo</span>
          <Swatches label="Fondo del texto" none value={tx.fondo} onChange={(c) => set({ fondo: c })} />
          <span className="text-[13px] font-semibold text-muted">Entrada</span>
          <div className="grid grid-cols-2 gap-2">
            {ANIMACIONES.map((a) => <Chip key={a} on={tx.animacion === a} onClick={() => set({ animacion: a })}>{ANIM_NOMBRE[a]}</Chip>)}
          </div>
          <p className="text-[13px] text-muted">Arrastra el texto sobre el video para moverlo, o sus esquinas para cambiar el tamaño.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={small} onClick={ed.duplicar}><Icon name="copy" className="h-4 w-4" />Duplicar</button>
            <button type="button" className={`${small} hover:text-bad`} onClick={ed.borrar}><Icon name="trash" className="h-4 w-4" />Quitar</button>
          </div>
        </Seccion>
      )}

      <Seccion title={tx ? "Agregar otro texto" : "Agregar texto"}>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((pr) => (
            <button key={pr.id} type="button" onClick={() => ed.nuevoTexto({ ...pr.style, texto: pr.texto })}
              className="group flex flex-col gap-1.5 rounded-xl border border-line bg-surface-2/40 p-2 text-left hover:border-ink/30">
              <span className="grid h-16 place-items-center overflow-hidden rounded-lg bg-[radial-gradient(circle_at_30%_20%,#2a2440,#0b0b10)] px-1">
                <span className="max-w-full truncate rounded px-1.5 py-0.5 leading-tight" style={{ fontFamily: `"${pr.style.fuente}", sans-serif`, color: pr.style.color, background: pr.style.fondo ?? "transparent", fontSize: Math.min(22, (pr.style.tam ?? 6) * 2.1), textShadow: pr.style.fondo ? "none" : "0 2px 4px rgba(0,0,0,.8)" }}>{pr.texto}</span>
              </span>
              <span className="flex items-center justify-between px-0.5 text-[13px] font-semibold text-ink">{pr.name}<Icon name="plus" className="h-4 w-4 text-muted group-hover:text-ink" /></span>
            </button>
          ))}
        </div>
        <p className="text-[13px] text-muted">Se agrega en el segundo donde estás ({fmt(t)}) y dura 2,5 s. Después lo ajustas en la línea de tiempo.</p>
      </Seccion>

      {!tx && p.textos.length > 0 && (
        <Seccion title="Textos del video">
          <ul className="flex flex-col gap-1.5">
            {p.textos.map((x, k) => (
              <li key={x.id}>
                <button type="button" onClick={() => { ed.setSel({ tipo: "texto", i: k }); ed.buscar(x.desde + 0.01, false); }} className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/40 px-3 py-2.5 text-left hover:border-ink/25">
                  <span className="truncate text-sm font-semibold text-ink">{x.texto}</span>
                  <span className="shrink-0 font-mono text-[13px] text-muted tabular-nums">{fmt(x.desde)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Seccion>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- subtitles

function Subtitulos({ ed }: { ed: Ed }) {
  const { p, estiloSub: st } = ed;
  const demo = "Así se ven tus subtítulos".split(" ").map((w, k) => ({ w, s: k, e: k + 0.9 }));
  const igual = (x: Partial<CaptionStyle>) => x.look === st.look && x.font === st.font && x.color === st.color && x.accent === st.accent;
  const pos = st.y !== undefined ? "libre" : st.position;
  return (
    <div className="flex flex-col gap-6">
      <Switch on={p.subtitulos} onChange={(v) => ed.cambiar((x) => ({ ...x, subtitulos: v }))} label="Mostrar subtítulos" hint="Palabra por palabra, con lo que se dice en cada corte." />
      <div className={`flex flex-col gap-6 ${p.subtitulos ? "" : "pointer-events-none opacity-40"}`} aria-disabled={!p.subtitulos}>
        <Seccion title="Estilo">
          <div className="grid grid-cols-2 gap-2">
            {CAPTION_PRESETS.map((pr) => {
              const look = normalizeStyle({ ...st, ...pr.style, x: undefined, y: undefined });
              const on = igual(pr.style);
              return (
                <button key={pr.id} type="button" aria-pressed={on} title={pr.hint} onClick={() => ed.setEstiloSub({ ...pr.style, position: st.position, x: st.x, y: st.y })}
                  className={`group flex flex-col gap-1.5 rounded-xl border p-1.5 text-left transition-colors ${on ? "border-[var(--sel)] bg-[var(--sel)]/[0.07]" : "border-line bg-surface-2/40 hover:border-ink/25"}`}>
                  <span className="relative block h-[68px] overflow-hidden rounded-lg bg-[radial-gradient(circle_at_30%_20%,#2a2440,#0b0b10)]">
                    <SubtituloLinea st={{ ...look, position: "centro" }} words={demo.slice(0, Math.min(3, look.words))} now={demo[Math.min(1, look.words - 1)].s} formato="9:16" fw={170} fh={68} />
                  </span>
                  <span className="px-1 pb-0.5 text-[13px] font-semibold text-ink">{pr.name}</span>
                </button>
              );
            })}
          </div>
        </Seccion>
        <Seccion title="Posición" aside={pos === "libre" ? (
          <button type="button" onClick={() => ed.setEstiloSub({ x: undefined, y: undefined })} className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent-text hover:underline"><Icon name="reset" className="h-3.5 w-3.5" />Restablecer</button>
        ) : undefined}>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Posición de los subtítulos">
            {(["arriba", "centro", "abajo"] as const).map((x) => (
              <Chip key={x} on={pos === x} onClick={() => ed.setEstiloSub({ position: x, x: undefined, y: undefined })}>
                <span className="flex items-center justify-center gap-2">
                  <span aria-hidden="true" className="relative block h-5 w-3 rounded-[3px] border border-current opacity-80"><span className={`absolute inset-x-0.5 h-[2px] rounded bg-current ${x === "arriba" ? "top-1" : x === "centro" ? "top-[8px]" : "bottom-1"}`} /></span>
                  {x === "arriba" ? "Arriba" : x === "centro" ? "Centro" : "Abajo"}
                </span>
              </Chip>
            ))}
          </div>
          <p className="text-[13px] text-muted">{pos === "libre" ? "Los subtítulos están en un lugar libre: los arrastraste sobre el video. Usa «Restablecer» para volver a arriba, centro o abajo." : "Arrastra los subtítulos sobre el video para ponerlos donde quieras."}</p>
          <Slider label="Tamaño" min={16} max={40} unit="" value={st.size} onChange={(v) => ed.setEstiloSub({ size: v })} />
          <span className="text-[13px] font-semibold text-ink">Palabras a la vez</span>
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="Palabras a la vez">
            {[1, 2, 3, 4].map((n) => <Chip key={n} on={st.words === n} onClick={() => ed.setEstiloSub({ words: n })}>{n}</Chip>)}
          </div>
          <p className="text-[13px] text-muted">Este estilo es solo para el video que exportas desde el editor: tu anuncio original no cambia.</p>
        </Seccion>
      </div>
      {ed.frases.length > 0 ? (
        <Seccion title="Lo que se dice">
          <div className="flex flex-col gap-1">
            {ed.frases.map((f, k) => {
              const on = ed.t >= f.s && ed.t < f.e + 0.15;
              return (
                <div key={k} className={`flex min-h-11 w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${on ? "bg-[var(--sel)]/10" : "hover:bg-surface-2"}`}>
                  <button type="button" onClick={() => ed.buscar(f.s + 0.01, false)} aria-label={`Ir a ${fmt(f.s)}`} className="mt-1.5 w-12 shrink-0 font-mono text-[13px] text-muted tabular-nums hover:text-ink">{fmt(f.s)}</button>
                  <span className="flex flex-1 flex-wrap items-center gap-x-1 gap-y-1">
                    {f.words.map((w, wi) => (
                      <PalabraEditable key={w.k ?? wi} w={w.w} orig={w.orig ?? w.w} fixed={Boolean(w.k && ed.p.subCorr?.[w.k])} onSave={(txt) => w.k && ed.corregirSub(w.k, txt, w.orig ?? w.w)} onFocus={() => ed.buscar(f.s + 0.01, false)} />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[13px] text-muted">Toca cualquier palabra para corregir su ortografía. El cambio se ve al tiro y queda en el video que exportas. (Déjala vacía para volver a la original.)</p>
        </Seccion>
      ) : <p className="text-[13px] text-muted">Este anuncio no tiene palabras para mostrar como subtítulos.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- audio

function Audio({ ed }: { ed: Ed }) {
  const { p } = ed;
  const m = p.musica ?? ed.ultimaMusica;
  return (
    <div className="flex flex-col gap-6">
      <Seccion title="Voz">
        <Slider label="Volumen de la voz" min={0} max={150} value={p.vozVol} onChange={(v) => ed.cambiar((x) => ({ ...x, vozVol: v }))} />
        <div className="flex gap-2">
          <button type="button" className={small} onClick={() => ed.cambiar((x) => ({ ...x, vozVol: 100 }))}>Normal (100%)</button>
          <button type="button" className={small} onClick={() => ed.cambiar((x) => ({ ...x, vozVol: 0 }))}><Icon name="volume" className="h-4 w-4" />Silenciar</button>
        </div>
      </Seccion>
      <Seccion title="Música de fondo">
        {m ? (
          <>
            <Switch on={Boolean(p.musica)} onChange={ed.musicaOn} label={m.nombre} hint={p.musica ? "Suena de fondo en todo el video" : "Apagada"} />
            {p.musica && <Slider label="Volumen de la música" min={0} max={100} value={p.musica.vol} onChange={ed.setMusicaVol} />}
          </>
        ) : <p className="text-[13px] text-muted">Sube tu música (MP3, M4A o WAV). Se repite si es más corta y baja suave al final. Usa música que tengas derecho a usar.</p>}
        <label className={`${small} w-fit cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent`}>
          <Icon name="upload" className="h-4 w-4" />{m ? "Cambiar música" : "Subir música"}
          <input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/aac" className="sr-only" onChange={(e) => ed.subirMusica(e.target.files?.[0])} />
        </label>
      </Seccion>
    </div>
  );
}

// ---------------------------------------------------------------- speed

function Velocidad({ ed }: { ed: Ed }) {
  const v = ed.p.velocidad;
  const salida = ed.total / (v || 1);
  return (
    <div className="flex flex-col gap-6">
      <Seccion title="Velocidad del video">
        <Segmented label="Velocidad" value={v}
          options={VELOCIDADES.map((x) => ({ v: x, label: x === 1 ? "1x" : `${x}x` }))}
          onChange={(x) => ed.setVelocidad(x)} />
        <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2/50 px-3.5 py-3 text-sm">
          <span className="flex items-center gap-2 text-muted"><Icon name="gauge" className="h-4 w-4" />Duración final</span>
          <b className="font-mono text-ink tabular-nums">{fmt(salida)}</b>
        </div>
        {v !== 1 && (
          <button type="button" onClick={() => ed.setVelocidad(1)} className={small}><Icon name="reset" className="h-4 w-4" />Volver a 1x</button>
        )}
        <p className="text-[13px] text-muted">Acelera todo el video, imagen y voz juntas, sin que la voz suene chillona. Los subtítulos, textos y la música se ajustan solos.</p>
      </Seccion>
    </div>
  );
}

// ---------------------------------------------------------------- format

function Formato({ ed }: { ed: Ed }) {
  return (
    <div className="flex flex-col gap-6">
      <Seccion title="Formato del video">
        <div className="grid grid-cols-3 gap-2">
          {FORMATOS.map((f) => {
            const on = ed.p.formato === f;
            const r = RATIO[f];
            return (
              <button key={f} type="button" aria-pressed={on} onClick={() => ed.cambiar((x) => ({ ...x, formato: f }))}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-colors ${on ? "border-[var(--sel)] bg-[var(--sel)]/[0.07]" : "border-line bg-surface-2/40 hover:border-ink/25"}`}>
                <span className="grid h-16 w-full place-items-center">
                  <span className={`block rounded-[4px] border-2 ${on ? "border-transparent bg-[image:var(--grad)]" : "border-muted/70"}`} style={{ height: r < 1 ? 60 : 46, width: (r < 1 ? 60 : 46) * r }} />
                </span>
                <span className="text-sm font-bold text-ink">{f}</span>
                <span className="text-center text-[12px] leading-tight text-muted">{FORMATO_INFO[f].name}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[13px] text-muted">{FORMATO_INFO[ed.p.formato].use}.</p>
        <p className="text-[13px] text-muted">¿Necesitas los dos? Exporta en 9:16, cambia a 4:5 y exporta de nuevo: cada versión queda guardada en Mis anuncios.</p>
      </Seccion>
    </div>
  );
}
