"use client";

import { useEffect, useState } from "react";
import type { Content } from "@/content/en";
import { Mark } from "./brand";
import LoopVideo from "./loop-video";

// «Encuentras el anuncio que ya vende. Sale el tuyo, terminado.» The visitor picks a niche and sees the
// whole job for it: what Spy finds, what Creads does (a highlight sweeps down the steps) and the finished
// ad with its new hook. The niches rotate by themselves until the visitor picks one.

export interface NicheMedia { still?: string; video?: string }

const posterOf = (src: string, w = 384) => `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=70`;
const Check = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 ${className}`} aria-hidden="true"><path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export default function Outcome({ t, media, ctaHref }: { t: Content["outcome"]; media: Record<string, NicheMedia>; ctaHref: string }) {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const n = t.niches[i];
  const m = media[n.k];
  const steps = t.steps.length;

  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setTimeout(() => setI((x) => (x + 1) % t.niches.length), steps * 1100 + 600);
    return () => clearTimeout(id);
  }, [auto, i, steps, t.niches.length]);

  return (
    <div className="stage relative overflow-hidden rounded-[2rem] border border-line">
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/3 h-[420px] w-[620px] rounded-full opacity-25 blur-[120px]" style={{ background: "var(--grad)" }} />
      <div className="relative flex flex-col gap-6 p-5 sm:p-8 lg:p-10">
        <div className="flex max-w-4xl flex-col gap-4">
          <h2 id="outcome-title" className="font-display text-[1.9rem] leading-[1.03] font-semibold sm:text-[2.6rem] lg:text-[2.9rem]">{t.title}</h2>
          <p className="max-w-[70ch] text-[17px] text-muted">{t.lead}</p>
        </div>

        {/* niche picker */}
        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-semibold">{t.pick}</span>
          <div role="tablist" aria-label={t.pick} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {t.niches.map((x, k) => (
              <button
                key={x.k}
                type="button"
                role="tab"
                aria-selected={k === i}
                onClick={() => { setI(k); setAuto(false); }}
                className={`relative shrink-0 overflow-hidden rounded-full px-4 py-2 text-sm font-semibold transition-colors ${k === i ? "bg-white text-black" : "border border-line text-muted hover:text-ink"}`}
              >
                {x.name}
                {k === i && auto && <span aria-hidden="true" key={`bar-${i}`} className="niche-bar absolute inset-x-0 bottom-0 h-[3px] bg-[image:var(--grad)]" style={{ ["--d" as string]: `${steps * 1.1 + 0.6}s` }} />}
              </button>
            ))}
          </div>
        </div>

        <div className="grid items-stretch gap-5 lg:grid-cols-[1fr_1.1fr_auto] lg:gap-6" role="tabpanel" aria-label={n.name}>
          {/* 1. what Spy finds */}
          <div key={`in-${n.k}`} className="niche-in flex flex-col gap-2.5">
            <span className="flex items-center justify-between gap-2 text-sm font-semibold text-muted">{t.inLabel}<span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold">{t.example}</span></span>
            <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[15px]">
                <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-muted" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                <span className="truncate">{n.query}</span>
                <span className="ml-auto shrink-0 rounded-full bg-good/15 px-2 py-0.5 text-[11px] font-semibold text-good">{n.count} {t.found}</span>
              </div>
              <div className="flex gap-3 rounded-xl border border-line bg-surface-2 p-2.5">
                <span className="relative aspect-[9/16] w-[72px] shrink-0 self-start overflow-hidden rounded-lg bg-black">
                  {m.video
                    ? <LoopVideo key={`t-${n.k}`} src={m.video} className="absolute inset-0 h-full w-full object-cover" />
                    : m.still && (
                      // eslint-disable-next-line @next/next/no-img-element -- small optimized thumb
                      <img src={posterOf(m.still, 128)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                </span>
                <span className="flex min-w-0 flex-col gap-1.5 text-[13px]">
                  <span className="w-fit rounded bg-good/15 px-1.5 py-0.5 font-semibold text-good">{t.active} {n.age} {t.days}</span>
                  <span className="text-muted">{n.vers} {t.versions}</span>
                  <span><b className="text-accent-text">{t.theirHook}:</b> {n.why}</span>
                </span>
              </div>
              <div className="mt-auto flex flex-col gap-1 rounded-xl border border-accent-text/30 bg-accent-text/[0.06] p-3">
                <span className="text-xs font-semibold text-accent-text">{t.yourHook}</span>
                <b className="font-display text-lg leading-tight font-semibold">«{n.hook}»</b>
              </div>
            </div>
            <span className="text-sm text-muted">{t.time}</span>
          </div>

          {/* 2. what Creads does */}
          <div className="flex flex-col gap-2.5">
          <span className="flex items-center gap-2 text-sm font-semibold text-muted"><Mark size={16} /> {t.doing}</span>
          <ol key={`steps-${n.k}`} className="relative flex flex-1 flex-col justify-between gap-0.5 rounded-2xl border border-line bg-surface/80 p-2.5 backdrop-blur" aria-label={t.doing}>
            {t.steps.map((s, k) => (
              <li key={s} className="outcome-step flex items-center gap-3 rounded-xl px-2.5 py-1.5 text-[14px]" style={{ ["--i" as string]: k, ["--n" as string]: steps }}>
                <span className="outcome-dot flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line font-mono text-[11px] text-muted">{k + 1}</span>
                <span className="min-w-0 flex-1">{s}</span>
                <Check className="text-good" />
              </li>
            ))}
          </ol>
          </div>

          {/* 3. the finished ad */}
          <div className="flex flex-col items-center gap-2.5">
            <span className="self-start text-sm font-semibold text-muted">{t.outLabel}</span>
            <figure className="relative aspect-[9/16] w-[min(58vw,190px)] overflow-hidden rounded-[1.6rem] border-[5px] border-[#1c1e24] bg-surface-2 shadow-[0_40px_100px_-30px_rgba(255,43,214,0.55)]">
              {m.video
                ? <LoopVideo key={n.k} src={m.video} poster={m.still ? posterOf(m.still) : undefined} className="absolute inset-0 h-full w-full object-cover" />
                : (
                  // eslint-disable-next-line @next/next/no-img-element -- optimized still with a slow push-in
                  <img key={n.k} src={posterOf(m.still ?? "", 640)} alt="" className="kenburns absolute inset-0 h-full w-full object-cover" />
                )}
              <span key={`cap-${n.k}`} className="caption niche-in absolute inset-x-3 bottom-[22%] text-center text-[17px]">{n.hook}</span>
              <figcaption className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                <Check className="h-3.5 w-3.5 text-good" /> {t.ready}
              </figcaption>
            </figure>
            <ul className="flex gap-1.5" aria-label={t.formats}>
              {["9:16", "4:5", "16:9"].map((f, k) => (
                <li key={f} className={`rounded-full px-2.5 py-1 font-mono text-xs ${k === 0 ? "bg-ink text-bg" : "border border-line text-muted"}`}>{f}</li>
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
