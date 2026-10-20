import type { Content } from "@/content/en";
import { Mark } from "./brand";
import LoopVideo from "./loop-video";

// The three sections that sell the home page right after the hero:
//  Outcome  — what goes in and what comes out (the finished ad, not loose clips)
//  ModelReel — every top model, each with a real clip and its name in big type
//  Versus   — Creads against a typical AI generator, row by row

const posterOf = (src: string, w = 640) => `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=70`;
const Check = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 ${className}`} aria-hidden="true"><path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Cross = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 ${className}`} aria-hidden="true"><path d="M6 6l8 8M14 6l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
);

/** In → Creads → Out. The steps light up one after another, like a job running. */
export function Outcome({ t, video, still, ctaHref }: { t: Content["outcome"]; video: string; still: string; ctaHref: string }) {
  const n = t.steps.length;
  return (
    <div className="stage relative overflow-hidden rounded-[2rem] border border-line">
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/3 h-[420px] w-[620px] rounded-full opacity-25 blur-[120px]" style={{ background: "var(--grad)" }} />
      <div className="relative flex flex-col gap-10 p-6 sm:p-10 lg:p-14">
        <div className="flex max-w-4xl flex-col gap-4">
          <h2 id="outcome-title" className="font-display text-[2.1rem] leading-[1.03] font-semibold sm:text-5xl lg:text-[3.6rem]">{t.title}</h2>
          <p className="max-w-[62ch] text-lg text-muted">{t.lead}</p>
        </div>

        <div className="grid items-end gap-6 lg:grid-cols-[1fr_1.15fr_auto] lg:gap-8">
          {/* What goes in */}
          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold text-muted">{t.inLabel}</span>
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5 font-mono text-[13px]">
                <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-muted" aria-hidden="true"><path d="M8.5 11.5l3-3M7 9.5l-1.6 1.6a2.6 2.6 0 003.7 3.7l1.6-1.6M13 10.5l1.6-1.6a2.6 2.6 0 00-3.7-3.7L9.3 6.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                <span className="truncate">{t.inLink}</span>
              </div>
              <span className="text-center text-xs text-muted">{t.inOr}</span>
              <p className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[15px]">{t.inIdea}</p>
            </div>
            <span className="text-sm text-muted">{t.time}</span>
          </div>

          {/* What Creads does */}
          <ol className="relative flex flex-col gap-1.5 rounded-2xl border border-line bg-surface/80 p-3 backdrop-blur" aria-label={t.doing}>
            <li className="flex items-center gap-2 px-2 pb-1.5 text-sm font-semibold"><Mark size={18} /> {t.doing}</li>
            {t.steps.map((s, i) => (
              <li key={s} className="outcome-step flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px]" style={{ ["--i" as string]: i, ["--n" as string]: n }}>
                <span className="outcome-dot flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line font-mono text-[11px] text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1">{s}</span>
                <Check className="outcome-check text-good" />
              </li>
            ))}
          </ol>

          {/* What comes out */}
          <div className="flex flex-col items-center gap-3">
            <span className="self-start text-sm font-semibold text-muted lg:self-center">{t.outLabel}</span>
            <figure className="relative aspect-[9/16] w-[min(68vw,260px)] overflow-hidden rounded-[2rem] border-[6px] border-[#1c1e24] bg-surface-2 shadow-[0_40px_100px_-30px_rgba(255,43,214,0.55)]">
              <LoopVideo src={video} poster={posterOf(still, 384)} className="absolute inset-0 h-full w-full object-cover" />
              <span className="caption absolute inset-x-4 bottom-[24%] text-center text-[22px]">{t.caption}</span>
              <figcaption className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                <Check className="h-3.5 w-3.5 text-good" /> {t.ready}
              </figcaption>
            </figure>
            <ul className="flex gap-1.5" aria-label={t.formats}>
              {["9:16", "4:5", "16:9"].map((f, i) => (
                <li key={f} className={`rounded-full px-2.5 py-1 font-mono text-xs ${i === 0 ? "bg-ink text-bg" : "border border-line text-muted"}`}>{f}</li>
              ))}
            </ul>
            <span className="text-center text-xs text-muted">{t.formats}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <a href={ctaHref} className="rounded-xl bg-[image:var(--grad)] px-6 py-3.5 font-semibold text-white shadow-[0_12px_32px_-12px_rgba(255,43,214,0.7)] transition-transform hover:-translate-y-px">{t.cta}</a>
          <span className="text-sm text-muted">{t.note}</span>
        </div>
      </div>
    </div>
  );
}

export interface ReelClip { video: string; still?: string; href: string }

/** One tall clip per model, its name set huge over the picture. Scrolls sideways, snaps per tile. */
export function ModelReel({ t, clips, moreHref }: { t: Content["reel"]; clips: Record<string, ReelClip>; moreHref: string }) {
  return (
    <div className="flex flex-col gap-8">
      <div aria-hidden="true" className="-mx-[max(16px,env(safe-area-inset-left,0px))] overflow-hidden" style={{ maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}>
        <div className="marquee-x flex w-max" style={{ ["--speed" as string]: "48s" }}>
          {[0, 1].map((copy) => (
            <span key={copy} className="flex shrink-0 items-center">
              {t.items.map((m) => (
                <span key={m.id} className="flex items-center gap-6 pr-6 font-display text-[3.4rem] leading-none font-semibold tracking-[-0.04em] uppercase sm:text-[6rem]">
                  <span className="outline-text">{m.name} {m.ver}</span>
                  <span className="text-[0.4em] text-accent-text">✦</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-3xl flex-col gap-3">
          <h2 id="reel-title" className="text-[2rem] leading-tight font-extrabold sm:text-[2.75rem]">{t.title}</h2>
          <p className="text-lg text-muted">{t.lead}</p>
        </div>
        <span className="text-sm text-muted">{t.label}</span>
      </div>
      <ul
        className="-mx-[max(16px,env(safe-area-inset-left,0px))] flex snap-x snap-mandatory gap-3 overflow-x-auto px-[max(16px,env(safe-area-inset-left,0px))] pb-3 [scrollbar-width:thin] sm:gap-4"
        aria-label={t.title}
      >
        {t.items.map((m, i) => {
          const c = clips[m.id];
          if (!c) return null;
          return (
            <li key={m.id} className="group w-[72vw] shrink-0 snap-start rounded-[1.85rem] bg-line p-[1.5px] transition-[background] duration-300 hover:bg-[image:var(--grad)] focus-within:bg-[image:var(--grad)] sm:w-[290px]">
              <a href={c.href} className="stage relative flex aspect-[9/16] flex-col justify-between overflow-hidden rounded-[1.75rem]">
                <LoopVideo src={c.video} poster={c.still ? posterOf(c.still, 384) : undefined} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]" />
                <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.6)_0%,transparent_26%,transparent_44%,rgba(0,0,0,0.92)_100%)]" />
                <span className="relative flex items-center justify-between p-4 text-[11px] font-semibold text-white/85">
                  <span className="flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 backdrop-blur-md"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[image:var(--grad)]" />{m.maker}</span>
                  <span className="font-mono text-white/60">{String(i + 1).padStart(2, "0")}/{String(t.items.length).padStart(2, "0")}</span>
                </span>
                <span className="relative flex flex-col gap-3 p-4 pt-0 text-white">
                  <b className="chroma font-display text-[2.15rem] leading-[0.9] font-semibold tracking-[-0.04em] uppercase sm:text-[2.3rem]">
                    {m.name}
                    {m.ver && <span className="grad-text block [text-shadow:none]">{m.ver}</span>}
                  </b>
                  <span className="flex flex-wrap gap-1.5">
                    {m.specs.map((x) => <span key={x} className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] font-semibold backdrop-blur-md">{x}</span>)}
                  </span>
                  <span className="text-sm leading-snug text-white/80">{m.line}</span>
                  <span className="flex items-center justify-between gap-2 rounded-full bg-white py-1 pl-3.5 pr-1 text-[13px] font-bold text-black">
                    {t.try}
                    <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-white transition-transform group-hover:translate-x-0.5">
                      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5"><path d="M4 10h11M11 5.5l4.5 4.5L11 14.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                  </span>
                </span>
              </a>
            </li>
          );
        })}
        <li className="w-[72vw] shrink-0 snap-start sm:w-[290px]">
          <a href={moreHref} className="stage relative flex aspect-[9/16] flex-col justify-end gap-3 overflow-hidden rounded-[1.75rem] border border-line p-5 text-white">
            <span aria-hidden="true" className="absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-60 blur-[70px]" style={{ background: "var(--grad)" }} />
            <b className="relative font-display text-6xl font-semibold">20+</b>
            <span className="relative text-lg leading-snug font-semibold">{t.more}</span>
            <span className="relative w-fit rounded-full bg-white px-3 py-1.5 text-[13px] font-bold text-black">{t.moreCta}</span>
          </a>
        </li>
      </ul>
    </div>
  );
}

/** Creads against a typical AI generator: the same rows as before, as two columns you can scan. */
export function Versus({ t, ctaHref, cta }: { t: Content["diff"]; ctaHref: string; cta: string }) {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex max-w-4xl flex-col gap-4">
        <h2 id="how" className="scroll-mt-32 text-[2rem] leading-tight font-extrabold sm:text-[2.75rem] lg:scroll-mt-24">{t.title}</h2>
        <p className="text-lg text-muted">{t.lead}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section aria-label={t.colOther} className="flex flex-col rounded-[1.75rem] border border-line bg-surface p-6 sm:p-8">
          <h3 className="pb-4 text-xl font-bold text-muted">{t.colOther}</h3>
          <ul className="flex flex-col divide-y divide-line">
            {t.rows.map(([row, them]) => (
              <li key={row} className="flex flex-col gap-0.5 py-3.5">
                <span className="text-sm text-muted">{row}</span>
                <span className="flex items-center gap-2 text-[16px] text-muted"><Cross className="text-bad/80" />{them}</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-label="Creads IA" className="rounded-[1.75rem] bg-[image:var(--grad)] p-[1.5px] shadow-[0_40px_120px_-50px_rgba(138,92,255,0.7)]">
          <div className="flex h-full flex-col rounded-[calc(1.75rem-1.5px)] bg-bg p-6 sm:p-8">
            <h3 className="flex items-center gap-2 pb-4 text-xl font-bold"><Mark size={22} /> Creads IA</h3>
            <ul className="flex flex-col divide-y divide-line">
              {t.rows.map(([row, , us]) => (
                <li key={row} className="flex flex-col gap-0.5 py-3.5">
                  <span className="text-sm text-muted">{row}</span>
                  <span className="flex items-center gap-2 text-[16px] font-semibold"><Check className="text-good" />{us}</span>
                </li>
              ))}
            </ul>
            <a href={ctaHref} className="mt-6 self-start rounded-xl bg-ink px-5 py-3 font-semibold text-bg transition-opacity hover:opacity-90">{cta}</a>
          </div>
        </section>
      </div>
    </div>
  );
}
