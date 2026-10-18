"use client";

import { COLORS, type CaptionStyle, FONTS, LOOKS, SIZES, fontOf, fontPx, marginPx } from "@/lib/caption-style";

// The subtitle editor of the final assembly: every option with a live preview drawn with the same
// fonts, sizes and positions the video will use.

const FRAME: Record<string, [number, number]> = { "9:16": [1080, 1920], "4:5": [1080, 1350], "1:1": [1080, 1080], "16:9": [1920, 1080] };
const fontFaces = FONTS.map((f) => `@font-face{font-family:${f.css};src:url(/fonts/${f.file}) format("truetype");font-display:swap}`).join("");

function Chip({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={label}
      className={`rounded-lg border px-2.5 py-1.5 text-sm font-semibold ${on ? "border-accent bg-accent/12 text-accent-text" : "border-line bg-surface text-muted hover:text-ink"}`}>
      {children}
    </button>
  );
}

function Swatches({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {COLORS.map((c) => (
        <button key={c.hex} type="button" role="radio" aria-checked={value === c.hex} aria-label={c.name} title={c.name} onClick={() => onChange(c.hex)}
          className={`h-7 w-7 rounded-full border-2 ${value === c.hex ? "border-accent ring-2 ring-accent/40" : "border-line"}`} style={{ background: c.hex }} />
      ))}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted">{title}</span>
      {children}
    </div>
  );
}

/** What the subtitle looks like over the first clip. */
function Preview({ style, aspect, sample, video }: { style: CaptionStyle; aspect: string; sample: string; video?: string | null }) {
  const [W, H] = FRAME[aspect] ?? FRAME["9:16"];
  const boxW = W > H ? 360 : 230;
  const k = boxW / W;
  const font = fontOf(style.font);
  const px = fontPx(style.size, W, H) * k;
  const words = sample.split(/\s+/).filter(Boolean).slice(0, style.look === "palabra" ? 1 : style.words);
  const caps = style.case === "upper" || (font.capsOnly && style.case !== "lower");
  const shown = words.map((w) => {
    let t = style.punct ? w : w.replace(/^["“”'(]+/, "").replace(/[.,;:"“”')]+$/, "");
    t = caps ? t.toLocaleUpperCase("es") : style.case === "lower" ? t.toLocaleLowerCase("es") : t;
    return t;
  });
  const vertical = H > W;
  const mv = marginPx(style.position, H, vertical) * k;
  const stroke = style.look === "suave" || style.look === "caja" ? 0 : Math.max(1, (fontPx(style.size, W, H) / 11) * k);
  const pos: React.CSSProperties = style.position === "centro" ? { top: "50%", transform: "translateY(-50%)" } : style.position === "arriba" ? { top: mv } : { bottom: mv };

  return (
    <div className="relative mx-auto shrink-0 overflow-hidden rounded-xl bg-gradient-to-b from-slate-500 to-slate-800" style={{ width: boxW, aspectRatio: `${W} / ${H}` }}>
      {video && <video src={`${video}#t=1`} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" aria-hidden="true" />}
      <div className="absolute inset-x-0 flex justify-center px-2 text-center" style={pos}>
        <span
          style={{
            fontFamily: font.css, fontSize: px, lineHeight: 1.15, color: style.color,
            WebkitTextStroke: stroke ? `${stroke * 2}px #000` : undefined, paintOrder: "stroke fill",
            textShadow: style.look === "suave" ? `0 ${px / 10}px ${px / 5}px rgba(0,0,0,.75)` : stroke ? `0 ${px / 18}px 0 #000` : undefined,
            background: style.look === "caja" ? "rgba(0,0,0,.8)" : undefined, padding: style.look === "caja" ? `${px * 0.08}px ${px * 0.25}px` : undefined,
            borderRadius: style.look === "caja" ? px * 0.12 : undefined,
          }}
        >
          {shown.map((t, i) => (
            <span key={i} style={style.look === "resaltar" && i === Math.min(1, shown.length - 1) ? { color: style.accent } : undefined}>{i ? " " : ""}{t}</span>
          ))}
        </span>
      </div>
    </div>
  );
}

export default function CaptionEditor({ value, onChange, aspect, sample, video }: {
  value: CaptionStyle; onChange: (s: CaptionStyle) => void; aspect: string; sample: string; video?: string | null;
}) {
  const set = (patch: Partial<CaptionStyle>) => onChange({ ...value, ...patch });
  const s = value;
  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <style>{fontFaces}</style>
      <div className="md:sticky md:top-16 md:self-start">
        <Preview style={s} aspect={aspect} sample={sample} video={video} />
        <p className="mt-1.5 text-center text-xs text-muted">Vista previa · tamaño {s.size}</p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <Group title="Estilo">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {LOOKS.map((l) => (
              <button key={l.id} type="button" aria-pressed={s.look === l.id} onClick={() => set({ look: l.id })}
                className={`flex flex-col items-start rounded-xl border p-2.5 text-left ${s.look === l.id ? "border-accent bg-accent/10" : "border-line bg-surface"}`}>
                <span className="text-sm font-semibold">{l.name}</span>
                <span className="text-xs text-muted">{l.hint}</span>
              </button>
            ))}
          </div>
        </Group>

        <Group title="Letra">
          <div className="flex flex-wrap gap-1.5">
            {FONTS.map((f) => (
              <Chip key={f.id} on={s.font === f.id} onClick={() => set({ font: f.id })}><span style={{ fontFamily: f.css }}>{f.name}</span></Chip>
            ))}
          </div>
        </Group>

        <Group title="Tamaño (24 es el normal en vertical)">
          <div className="flex flex-wrap items-center gap-1.5">
            {SIZES.map((n) => <Chip key={n} on={s.size === n} onClick={() => set({ size: n })}><span className="font-mono tabular-nums">{n}</span></Chip>)}
            <label className="flex items-center gap-1.5 text-xs text-muted">
              Otro
              <input type="number" min={8} max={48} value={s.size} onChange={(e) => { const n = Number(e.target.value); if (n >= 8 && n <= 48) set({ size: n }); }}
                className="w-16 rounded-lg border border-line bg-surface px-2 py-1.5 font-mono text-sm text-ink tabular-nums" aria-label="Tamaño exacto" />
            </label>
          </div>
        </Group>

        <div className="grid gap-4 sm:grid-cols-2">
          <Group title="Color del texto"><Swatches value={s.color} onChange={(color) => set({ color })} label="Color del texto" /></Group>
          {s.look === "resaltar" && <Group title="Color de la palabra que se dice"><Swatches value={s.accent} onChange={(accent) => set({ accent })} label="Color de resaltado" /></Group>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Group title="Posición">
            <div className="flex gap-1.5">
              {(["arriba", "centro", "abajo"] as const).map((p) => <Chip key={p} on={s.position === p} onClick={() => set({ position: p })}>{p[0].toUpperCase() + p.slice(1)}</Chip>)}
            </div>
          </Group>
          {s.look !== "palabra" && (
            <Group title="Palabras en pantalla (máximo)">
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => <Chip key={n} on={s.words === n} onClick={() => set({ words: n })}><span className="font-mono">{n}</span></Chip>)}
              </div>
            </Group>
          )}
        </div>

        <Group title="Mayúsculas">
          <div className="flex flex-wrap gap-1.5">
            <Chip on={s.case === "normal"} onClick={() => set({ case: "normal" })}>Como el guion</Chip>
            <Chip on={s.case === "upper"} onClick={() => set({ case: "upper" })}>TODO MAYÚSCULAS</Chip>
            <Chip on={s.case === "lower"} onClick={() => set({ case: "lower" })}>todo minúsculas</Chip>
          </div>
        </Group>

        <Group title="Ortografía">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={s.script} onChange={(e) => set({ script: e.target.checked })} className="mt-1" />
            <span>Escribir cada palabra como en el guion <span className="text-muted">(corrige lo que la IA escuchó mal: tildes, números, palabras parecidas)</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={s.punct} onChange={(e) => set({ punct: e.target.checked })} className="mt-1" />
            <span>Mostrar comas y puntos</span>
          </label>
        </Group>

        <Group title="Sello">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={!!s.sello} onChange={(e) => set({ sello: e.target.checked })} className="mt-1" />
            <span>Mostrar «Hecho con Creads IA» en una esquina <span className="text-muted">(para tus propias redes)</span></span>
          </label>
        </Group>
      </div>
    </div>
  );
}
