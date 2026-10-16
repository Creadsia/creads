import Image from "next/image";
import type { Content } from "@/content/en";
import { Logo, Mark } from "./brand";
import AffiliateForm from "./affiliate-form";
import Composer from "./composer";
import Pricing from "./pricing";
import LoopVideo from "./loop-video";
import ThemeToggle from "./theme-toggle";

const CDN = "https://d8j0ntlcm91z4.cloudfront.net/user_3DdKYHg29Dc6YLtguhB32IBiQZ7/hf_20261015_220556_";
const img = (id: string) => `${CDN}${id}.png`;

// Scenes generated for the site; w/h = real pixel size (9:16 or 4:5).
const SCENES = {
  ugc: { src: img("0c908a12-e315-4bc9-b0b9-f2e30ce41a32"), w: 1536, h: 2752 },
  podcast: { src: img("6dd2acd7-4699-4665-b27b-a4f1cdc87267"), w: 1856, h: 2304 },
  serum: { src: img("648442ce-d231-4608-9ee3-6e421dc462e7"), w: 1856, h: 2304 },
  valpo: { src: img("638f557e-139c-4ebe-a0dc-b91d0f5adb64"), w: 1536, h: 2752 },
  coach: { src: img("454a7b5b-f21a-4097-8205-2bfafe2e9489"), w: 1536, h: 2752 },
  chef: { src: img("db507db9-6f46-4813-a3a9-076767d0545d"), w: 1856, h: 2304 },
  realtor: { src: img("829d052f-a160-420e-86e4-ac469d9f5b65"), w: 1536, h: 2752 },
  car: { src: img("8a59f674-4577-4a57-a01e-c6c0f60290b2"), w: 1536, h: 2752 },
  sneaker: { src: img("3975c800-9d1b-4133-aefd-c01a2a1e1cd6"), w: 1856, h: 2304 },
  news: { src: img("4201ea1f-ac6c-48db-9c04-d0d4385b6468"), w: 1536, h: 2752 },
};
type SceneKey = keyof typeof SCENES;

// Short silent loops animated from the stills (Kling 3.0 Turbo, 5 s), re-encoded to ~200 KB each.
// TODO(phase 1): move to our own storage.
const CLIP = "https://d2ol7oe51mr4n9.cloudfront.net/user_3DdKYHg29Dc6YLtguhB32IBiQZ7/";
const VIDEOS: Partial<Record<SceneKey, string>> = {
  valpo: `${CLIP}9b933c53-6d3c-4306-9eff-5d0bd4bd58b0.mp4`,
  serum: `${CLIP}dbfb983f-a3d8-4a46-bb53-e86fc64f91d6.mp4`,
  podcast: `${CLIP}dbf87bbe-75ec-407e-8dfb-b8a48c570644.mp4`,
  coach: `${CLIP}1d1b7dbe-d2c5-4930-a843-2dbe2834c080.mp4`,
};
const poster = (src: string) => `/_next/image?url=${encodeURIComponent(src)}&w=640&q=70`;
// Every picture and clip appears once on the page: the hero wall uses the clips, "Featured" the four
// animated scenes, the tool grid the remaining stills and the studio preview the UGC still.

// Hero wall: short silent clips generated for the site, each tagged with the model that made it.
// Re-encoded to 480x854, 24 fps, no sound (~120-500 KB). TODO(phase 1): move to our own storage.
type Maker = "google" | "kling" | "bytedance" | "xai" | "minimax" | "alibaba";
const MAKER_DOT: Record<Maker, string> = {
  google: "#4f8bff",
  kling: "#2ee6a6",
  bytedance: "#ff2bd6",
  xai: "#f3f4f6",
  minimax: "#ff8a3d",
  alibaba: "#ffc23d",
};
interface WallClip { id: string; still: string; model: string; maker: Maker }
const hf = (id: string, ext: "mp4" | "jpg") => `${CLIP}${id}.${ext}`;
const C = (video: string, still: string, model: string, maker: Maker): WallClip => ({ id: hf(video, "mp4"), still: hf(still, "jpg"), model, maker });
const WALL_COLS: { clips: WallClip[]; dir: "up" | "down"; speed: string }[] = [
  {
    dir: "up",
    speed: "70s",
    clips: [
      C("d4597de4-41e3-4d88-b199-a252d7d47bb3", "c88c6477-6b88-4339-8e55-d5fc9ad02ce3", "Kling 3.0 Turbo", "kling"),
      C("70b577fc-0650-41cc-a267-6131307a18c0", "1d9b7270-fb34-420a-8371-9b7f65ec0bfe", "Veo 3.1 Lite", "google"),
      C("3d5e741d-9422-4221-95ca-38349129b40e", "afff3cf2-a9d2-4b30-9e60-5b5f70596a08", "Wan 3.0", "alibaba"),
      C("81fb90d2-22c5-404f-92d8-a201275530cf", "9a50f2c6-6bbd-4891-8299-f1151a77c433", "Grok Video", "xai"),
    ],
  },
  {
    dir: "down",
    speed: "88s",
    clips: [
      C("4017cd54-61b4-43e9-97bc-5271ff328c79", "4f285d47-5240-4a5c-a485-3d0bfc2c9c55", "Seedance 2.0", "bytedance"),
      C("9c9fb74d-c0af-46f9-9d43-211d4783ef90", "d82cb55a-cbb2-41dd-8bc7-209000b0a58d", "Grok Video", "xai"),
      C("bff9a5a4-3a41-4ecc-bea3-4326067b05b0", "0d8d1a1b-7db6-4f0b-9fb3-5a3e9ca85651", "Kling 3.0 Turbo", "kling"),
      C("59617700-cf90-497f-8a75-4ed74416c22f", "94ba857c-b593-487c-8d18-819c0141addb", "Seedance 2.5", "bytedance"),
    ],
  },
  {
    dir: "up",
    speed: "62s",
    clips: [
      C("a1310874-fe73-4989-9e6f-7de4d4d96426", "b9c4463c-3d31-414a-a898-2158c8df5112", "Veo 3.1 Lite", "google"),
      C("e5596388-8427-4692-9439-d29b17e7a190", "ee82f970-1ec8-4a94-b491-366c7e8e0ddf", "Gemini Omni", "google"),
      C("61bc428a-05e4-4443-afe7-7dd2976c69f5", "b8044d86-a0a2-4a5d-a52a-35814a3df137", "Hailuo", "minimax"),
    ],
  },
];

function WallTile({ c }: { c: WallClip }) {
  return (
    <figure className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-surface-2">
      <LoopVideo src={c.id} poster={c.still} className="absolute inset-0 h-full w-full object-cover" />
      <figcaption className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 font-mono text-[10.5px] leading-none text-white backdrop-blur-sm">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: MAKER_DOT[c.maker] }} />
        {c.model}
      </figcaption>
    </figure>
  );
}

/** Three columns of clips drifting up and down; each column is drawn twice so the loop has no seam. */
function ClipWall({ label }: { label: string }) {
  return (
    <div className="relative min-w-0">
      <div
        className="grid h-[460px] grid-cols-3 gap-2.5 overflow-hidden sm:h-[600px] sm:gap-3 lg:h-[min(820px,calc(100svh-120px))]"
        style={{ maskImage: "linear-gradient(transparent, #000 12%, #000 88%, transparent)", WebkitMaskImage: "linear-gradient(transparent, #000 12%, #000 88%, transparent)" }}
      >
        {WALL_COLS.map((col, i) => (
          <div key={i} className={`${col.dir === "up" ? "marquee-up" : "marquee-down"} flex flex-col`} style={{ ["--speed" as string]: col.speed }}>
            {[0, 1].map((copy) => (
              <div key={copy} className="flex flex-col gap-2.5 pb-2.5 sm:gap-3 sm:pb-3" aria-hidden={copy === 1 || undefined}>
                {col.clips.map((c) => (
                  <WallTile key={c.id} c={c} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-white/70 [text-shadow:0_1px_6px_#000] lg:absolute lg:inset-x-0 lg:bottom-4 lg:mt-0">{label}</p>
    </div>
  );
}


/** Announcement bar: offers, news and model names sliding sideways (drawn twice for a seamless loop). */
function Ticker({ t }: { t: Content["bar"] }) {
  const track = (copy: number) => (
    <ul className="flex shrink-0 items-center" aria-hidden={copy === 1 || undefined}>
      {t.items.map((it, i) => (
        <li key={i} className="flex items-center gap-2 px-5 whitespace-nowrap">
          {it.tag && <span className="rounded-md bg-white px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-black">{it.tag}</span>}
          <span>{it.text}</span>
          <span aria-hidden="true" className="pl-5 text-white/50">✦</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="relative flex items-center bg-[image:var(--grad)] text-[13px] font-medium text-white">
      <div className="min-w-0 flex-1 overflow-hidden py-2" style={{ maskImage: "linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent)" }}>
        <div className="marquee-x flex w-max" style={{ ["--speed" as string]: "60s" }}>
          {track(0)}
          {track(1)}
        </div>
      </div>
      <a href="#pricing" className="mr-2 shrink-0 rounded-full bg-black/25 px-3 py-1 text-xs font-bold whitespace-nowrap hover:bg-black/40 sm:mr-4">{t.cta}</a>
    </div>
  );
}

type Tool = Content["tools"]["items"][number];

/** Small picture on each tool card: a real still when we have one, otherwise a drawing of what the tool does. */
function ToolArt({ art, es }: { art: string; es: boolean }) {
  const still = (k: SceneKey, pos = "50% 30%") => (
    <Image src={SCENES[k].src} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.05]" style={{ objectPosition: pos }} />
  );
  const bars = (n: number, seed: number, cls: string) => (
    <div className="flex h-14 items-center gap-[3px]">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={`w-[3px] rounded-full ${cls}`} style={{ height: `${18 + Math.abs(Math.sin(i * 0.7 + seed)) * 70}%` }} />
      ))}
    </div>
  );
  const chip = (txt: string, cls = "bg-white/10 text-white/85") => <span key={txt} className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] ${cls}`}>{txt}</span>;
  switch (art) {
    case "chef": return still("chef");
    case "realtor": return still("realtor");
    case "car": return still("car", "50% 35%");
    case "news": return still("news", "50% 25%");
    case "cutout":
      return (
        <>
          {still("sneaker", "50% 50%")}
          {/* right half shows the cut-out on a transparency grid */}
          <span className="absolute inset-y-0 right-0 w-1/2 border-l-2 border-white/80 bg-[length:16px_16px] opacity-90 mix-blend-normal" style={{ backgroundImage: "conic-gradient(#d9d9de 25%, #fff 0 50%, #d9d9de 0 75%, #fff 0)" }} />
          <span className="absolute right-2 bottom-2">{chip("2× HD", "bg-black/70 text-white")}</span>
        </>
      );
    case "frames":
      return (
        <div className="flex h-full items-center justify-center gap-2">
          {["#2a2340", "#3a2a52", "#4b2f63"].map((c, i) => (
            <span key={c} className="flex aspect-[4/5] w-[24%] items-end justify-center rounded-lg border border-white/15 pb-1.5" style={{ background: `linear-gradient(160deg, ${c}, #0d0e11)`, transform: `translateY(${(i - 1) * -6}px)` }}>
              {chip("4:5")}
            </span>
          ))}
        </div>
      );
    case "edit":
      return (
        <div className="flex h-full flex-col justify-center gap-2 px-5">
          <span className="w-fit max-w-full rounded-xl rounded-bl-sm bg-white/90 px-3 py-1.5 text-xs font-semibold text-black">{es ? "“Cambia el fondo por una playa al atardecer”" : "“Change the background to a beach at sunset”"}</span>
          <span className="hidden gap-1.5 sm:flex">{chip("Nano Banana Pro")}{chip("1K")}{chip("PNG")}</span>
        </div>
      );
    case "phone":
    case "reel":
      return (
        <div className="flex h-full items-center justify-center">
          <span className="relative flex aspect-[9/16] h-[88%] flex-col justify-end overflow-hidden rounded-[14px] border-2 border-white/25 p-2" style={{ background: art === "phone" ? "linear-gradient(180deg,#2c3446,#12141a)" : "linear-gradient(180deg,#3b1d4a,#12141a)" }}>
            <span className="mx-auto mb-3 max-w-full rounded bg-black/70 px-1 py-0.5 text-center font-display text-[8px] leading-tight font-black break-words text-white sm:text-[9px]">
              {art === "phone" ? <>{es ? "costaba" : "it cost"} <span className="text-[#FFE100]">{es ? "$34.000" : "$34,000"}</span></> : <>{es ? "espera" : "wait for"} <span className="text-[#3DFF6E]">{es ? "esto…" : "it…"}</span></>}
            </span>
            <span className="absolute top-2 left-2 h-1.5 w-1.5 animate-pulse rounded-full bg-rec" />
          </span>
        </div>
      );
    case "influencer":
      return (
        <div className="flex h-full items-center justify-center gap-3 px-4">
          <span className="h-14 w-14 shrink-0 rounded-full bg-[image:var(--grad)] p-[2px]"><span className="block h-full w-full rounded-full bg-[#1a1b21]" /></span>
          <span className="grid grid-cols-3 gap-1">
            {Array.from({ length: 6 }, (_, i) => <span key={i} className="aspect-square w-6 rounded-sm" style={{ background: `hsl(${270 + i * 14} 45% ${22 + (i % 3) * 8}%)` }} />)}
          </span>
        </div>
      );
    case "voice": return <div className="flex h-full items-center justify-center px-6">{bars(34, 1, "bg-white/80")}</div>;
    case "podcast":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1 px-6">
          {bars(30, 2, "bg-[#8b7cff]")}
          <div className="-mt-6">{bars(30, 5, "bg-[#ff4fd8]/80")}</div>
        </div>
      );
    case "dub":
      return (
        <div className="flex h-full items-center justify-center gap-3 px-4">
          {chip("EN", "bg-white text-black font-bold")}
          {bars(12, 3, "bg-white/70")}
          <span className="text-white/60">→</span>
          {bars(12, 4, "bg-[#3DFF6E]/80")}
          {chip("ES", "bg-[#3DFF6E] text-black font-bold")}
        </div>
      );
    case "music":
      return (
        <div className="flex h-full items-end justify-center gap-1 px-6 pb-6">
          {Array.from({ length: 16 }, (_, i) => <span key={i} className="w-2.5 rounded-t-sm bg-[image:var(--grad)]" style={{ height: `${20 + Math.abs(Math.sin(i * 1.3)) * 60}%` }} />)}
        </div>
      );
    case "sfx":
      return (
        <div className="flex h-full items-center justify-center gap-2 px-4">
          {(es ? ["whoosh", "pop", "lluvia", "ding"] : ["whoosh", "pop", "rain", "ding"]).map((x) => chip(x, "bg-white/10 text-white"))}
        </div>
      );
    case "multiply":
      return (
        <div className="flex h-full items-center justify-center gap-1.5">
          <span className="flex aspect-[9/16] h-[46%] items-center justify-center rounded-md border-2 border-white/80 bg-white/10 font-display text-xs font-bold text-white">1</span>
          <span className="text-white/60">→</span>
          {Array.from({ length: 5 }, (_, i) => <span key={i} className="aspect-[9/16] h-[34%] rounded-md border border-white/25" style={{ background: `hsl(${255 + i * 18} 50% 28%)` }} />)}
        </div>
      );
    case "score":
      return (
        <div className="flex h-full items-center justify-center gap-3">
          <span className="relative grid h-16 w-16 place-items-center rounded-full" style={{ background: "conic-gradient(#3DFF6E 0 87%, rgba(255,255,255,.12) 0)" }}>
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#121318] font-display text-lg font-bold text-white">87</span>
          </span>
          <span className="flex flex-col gap-1 text-[11px] text-white/80"><span>{es ? "Gancho" : "Hook"} ✓</span><span>{es ? "Oferta" : "Offer"} ✓</span><span>CTA ~</span></span>
        </div>
      );
    case "publish":
      return (
        <div className="flex h-full items-center justify-center gap-2">
          {["Meta", "Instagram", "TikTok"].map((x) => chip(x, "bg-white/10 text-white"))}
        </div>
      );
    case "api":
      return (
        <pre className="flex h-full items-center px-4 font-mono text-[10.5px] leading-relaxed text-white/80">
          <code>{"POST /v1/ads\n{ \"script\": \"…\",\n  \"model\": \"veo-3.1\" }"}</code>
        </pre>
      );
    default: return null;
  }
}

function ToolCard({ x, t, es }: { x: Tool; t: Content["tools"]; es: boolean }) {
  return (
    <a href="#pricing" className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-muted/60">
      <div className="stage relative aspect-[16/10] overflow-hidden bg-[#0d0e11]">
        <ToolArt art={x.art} es={es} />
        {x.badge && (
          <span className={`absolute top-2 left-2 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold leading-none ${x.badge === "new" ? "bg-[image:var(--grad)] text-white" : "bg-black/70 text-white/80"}`}>
            {x.badge === "new" ? t.new : t.soon}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <span className="text-[11px] font-semibold text-accent-text">{t.groups[x.group as keyof typeof t.groups]}</span>
        <b className="font-semibold leading-tight">{x.name}</b>
        <span className="text-sm leading-snug text-muted">{x.text}</span>
        <span className="mt-auto pt-2 font-mono text-[11px] leading-tight text-muted/90">{x.models}</span>
      </div>
    </a>
  );
}

const gutter = "px-[max(16px,env(safe-area-inset-left,0px))]";

function SectionHead({ id, title, lead }: { id: string; title: string; lead?: string }) {
  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <h2 id={id} className="text-[2rem] font-extrabold sm:text-[2.75rem]">
        {title}
      </h2>
      {lead && <p className="text-lg text-muted">{lead}</p>}
    </div>
  );
}

/** A still of the studio UI: settings on the left, the four scenes of one ad on the right. */
function AppPreview({ t }: { t: Content["preview"] }) {
  const p = t.panel;
  const rows: [string, string][] = [
    [p.studio, p.studioValue],
    [p.model, p.modelValue],
    [p.scenes, p.scenesValue],
    [p.format, p.formatValue],
    [p.voice, p.voiceValue],
  ];
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_50px_140px_-60px_rgba(139,124,255,0.55)]">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-line" />
        <span className="h-3 w-3 rounded-full bg-line" />
        <span className="h-3 w-3 rounded-full bg-line" />
        <span className="ml-3 flex items-center gap-2 text-sm text-muted">
          <Mark size={16} /> creadsia.com/studio
        </span>
      </div>
      <div className="grid md:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-3 border-b border-line p-5 md:border-r md:border-b-0">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1">
              <span className="text-xs text-muted">{k}</span>
              <span className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">{v}</span>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <span className="text-muted">{p.cost}</span>
            <b>{p.costValue}</b>
          </div>
          <span className="rounded-xl bg-[image:var(--grad)] px-4 py-2.5 text-center font-semibold text-white">{p.button}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,200px)_1fr]">
            <figure className="relative aspect-[9/16] overflow-hidden rounded-xl bg-surface-2">
              <Image src={SCENES.ugc.src} alt="" fill sizes="(max-width: 640px) 90vw, 200px" className="object-cover object-[50%_20%]" />
              <span className="absolute inset-x-3 bottom-[22%] rounded bg-black/70 px-2 py-1 text-center font-display text-sm font-black text-white">
                {t.sample.before} <span className="text-[#FFE100]">{t.sample.hot}</span>
              </span>
              <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-white"><span className="h-1.5 w-1.5 rounded-full bg-rec" />1 · {t.cuts[0]}</span>
            </figure>
            <div className="flex min-w-0 flex-col gap-3">
              <span className="text-xs text-muted">{t.timeline}</span>
              <ol className="grid grid-cols-4 gap-1.5">
                {t.cuts.map((c, i) => (
                  <li key={c} className={`flex flex-col gap-1 rounded-lg border p-2 text-xs ${i === 0 ? "border-accent-text/60 bg-accent/10" : "border-line bg-surface-2"}`}>
                    <span className="font-mono text-[10px] text-muted">{i * 8}–{i * 8 + 8} s</span>
                    <b className="truncate font-semibold">{c}</b>
                  </li>
                ))}
              </ol>
              <div className="flex h-10 items-center gap-[3px] rounded-lg bg-surface-2 px-3" aria-hidden="true">
                {Array.from({ length: 64 }, (_, i) => <span key={i} className="w-[3px] rounded-full bg-muted/60" style={{ height: `${20 + Math.abs(Math.sin(i * 0.55)) * 70}%` }} />)}
              </div>
              <dl className="grid grid-cols-3 gap-1.5 text-xs">
                {t.specs.map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-surface-2 px-2.5 py-2"><dt className="text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>
                ))}
              </dl>
            </div>
          </div>
          <ul className="flex flex-wrap gap-2">
            {t.checks.map((c) => (
              <li key={c} className="flex items-center gap-1.5 rounded-full bg-good/12 px-3 py-1 text-sm text-good">
                <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                  <path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function Landing({ t }: { t: Content }) {
  const home = t.lang === "es" ? "/es" : "/";
  const other = t.lang === "es" ? "/" : "/es";
  const groups = ["video", "image", "voice", "brain"] as const;

  return (
    <div className="overflow-x-clip">
      {/* Offer bar: offers, news and models sliding sideways */}
      <Ticker t={t.bar} />

      {/* Header */}
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-line/60 bg-bg/85 backdrop-blur">
        <div className={`mx-auto flex max-w-7xl items-center justify-between gap-4 py-3 ${gutter}`}>
          <Logo href={home} />
          <nav aria-label="Main" className="hidden items-center gap-0.5 text-[15px] xl:flex">
            {t.menu.map((m) => (
              <a key={m.label} href={m.href} className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 whitespace-nowrap text-muted transition-colors hover:bg-surface hover:text-ink">
                {m.label}
                {m.badge && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                      m.badge.startsWith("-") ? "bg-rec text-white" : m.badge === "SOON" || m.badge === "PRONTO" ? "bg-surface-2 text-muted" : "bg-[image:var(--grad)] text-white"
                    }`}
                  >
                    {m.badge}
                  </span>
                )}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Language switch: both options visible, the current one filled. */}
            <nav aria-label="Language" className="flex items-center rounded-full border border-line bg-surface p-0.5 text-xs font-bold">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="mx-1.5 hidden h-4 w-4 text-muted sm:block" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
              </svg>
              {(["en", "es"] as const).map((l) =>
                l === t.lang ? (
                  <span key={l} aria-current="true" className="rounded-full bg-ink px-2.5 py-1.5 text-bg">
                    {l.toUpperCase()}
                  </span>
                ) : (
                  <a
                    key={l}
                    href={other}
                    hrefLang={l}
                    lang={l}
                    title={t.nav.switchLabel}
                    className="rounded-full px-2.5 py-1.5 text-muted transition-colors hover:text-ink"
                  >
                    {l.toUpperCase()}
                  </a>
                ),
              )}
            </nav>
            <span className="hidden min-[420px]:contents"><ThemeToggle lang={t.lang} /></span>
            <a href="/app" className="hidden whitespace-nowrap px-2 text-sm font-semibold text-muted hover:text-ink sm:block">{t.nav.login}</a>
            <a href="#pricing" className="whitespace-nowrap rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 sm:px-4">
              {t.nav.cta}
            </a>
          </div>
        </div>
        {/* phone: the same menu as a scrollable row */}
        <nav aria-label="Main" className={`flex gap-1 overflow-x-auto pb-2.5 text-sm xl:hidden ${gutter}`}>
          <span className="shrink-0 min-[420px]:hidden"><ThemeToggle lang={t.lang} /></span>
          {t.menu.map((m) => (
            <a key={m.label} href={m.href} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-muted">
              {m.label}
              {m.badge && (
                <span className={`rounded px-1 py-0.5 text-[9px] font-bold leading-none ${m.badge.startsWith("-") ? "bg-rec text-white" : m.badge === "SOON" || m.badge === "PRONTO" ? "bg-surface-2 text-muted" : "bg-[image:var(--grad)] text-white"}`}>
                  {m.badge}
                </span>
              )}
            </a>
          ))}
        </nav>
      </header>

      <main className="flex flex-col gap-20 pb-20 sm:gap-24">
        {/* Hero: a dark stage. Pitch + composer on the left, a moving wall of AI clips tagged with their model on the right. */}
        <section className={`stage relative -mt-px overflow-hidden ${gutter}`}>
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 py-12 sm:py-16 lg:min-h-[min(820px,calc(100svh-120px))] lg:grid-cols-[1fr_1.08fr] lg:py-0">
            <div className="relative z-10 flex min-w-0 flex-col gap-7">
              <h1 className="chroma font-display text-[2.55rem] leading-[1.02] font-semibold sm:text-6xl lg:text-[4.1rem]">
                {t.hero.title.split(/(?<=\.) /).map((part) => (
                  <span key={part} className="block">{part}</span>
                ))}
              </h1>
              <p className="max-w-[54ch] text-lg text-muted">{t.hero.lead}</p>
              <Composer t={t.composer} />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                <span>{t.hero.poweredBy}</span>
                {["Veo 3.1", "Kling 3.0", "Seedance 2.5", "Nano Banana Pro", "ElevenLabs", "Claude"].map((m) => (
                  <b key={m} className="font-mono text-[13px] font-medium text-ink/85">
                    {m}
                  </b>
                ))}
              </div>
            </div>
            <ClipWall label={t.hero.wall} />
          </div>
        </section>

        {/* Featured studios */}
        <section aria-labelledby="featured" className={`-mt-12 ${gutter}`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-8">
            <SectionHead id="featured" title={t.featured.title} />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {t.featured.items.map((f, i) => {
                const sc = SCENES[f.k as SceneKey];
                return (
                  <a key={f.title} href="#tools" className="group relative flex aspect-[3/4] overflow-hidden rounded-2xl border border-line bg-surface-2">
                    <Image src={sc.src} alt="" fill priority={i < 2} sizes="(max-width: 1024px) 50vw, 25vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                    {VIDEOS[f.k as SceneKey] && (
                      <LoopVideo src={VIDEOS[f.k as SceneKey]!} poster={poster(sc.src)} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                    )}
                    <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                    <span className={`absolute left-3 top-3 rounded-md px-2 py-1 text-[11px] font-bold ${f.badge.startsWith("-") ? "bg-rec text-white" : "bg-[image:var(--grad)] text-black"}`}>
                      {f.badge}
                    </span>
                    <span className="relative mt-auto flex flex-col gap-1 p-4 text-white">
                      <b className="font-display text-base leading-tight font-semibold sm:text-lg">{f.title}</b>
                      <span className="text-sm text-white/80">{f.text}</span>
                    </span>
                  </a>
                );
              })}
            </div>

            {/* real numbers about the product */}
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
              {t.stats.map(([n, l]) => (
                <div key={l} className="flex flex-col gap-1 bg-surface px-5 py-4">
                  <dt className="order-2 text-sm text-muted">{l}</dt>
                  <dd className="order-1 font-display text-3xl font-semibold">{n}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Tools: every tool with a picture of what it does and the models behind it */}
        <section aria-labelledby="tools" className={`scroll-mt-24 ${gutter}`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-6">
            <SectionHead id="tools" title={t.tools.title} lead={t.tools.lead} />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {t.tools.items.map((x) => <ToolCard key={x.name} x={x} t={t.tools} es={t.lang === "es"} />)}
              <a href="#models" className="stage group relative flex flex-col justify-end gap-2 overflow-hidden rounded-2xl border border-line bg-black p-4 text-white">
                <span aria-hidden="true" className="absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-60 blur-[60px]" style={{ background: "var(--grad)" }} />
                <span className="relative font-display text-4xl font-semibold">20+</span>
                <b className="relative leading-tight">{t.tools.more}</b>
                <span className="relative text-sm text-white/70 group-hover:text-white">{t.tools.moreCta} →</span>
              </a>
            </div>
          </div>
        </section>

        {/* What's new */}
        <section aria-labelledby="news" className={gutter}>
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.8fr_2fr]">
            <SectionHead id="news" title={t.news.title} lead={t.news.lead} />
            <ul className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {t.news.items.map(([n, d]) => (
                <li key={n} className="flex flex-col gap-1.5 bg-surface p-4">
                  <span className="flex items-center gap-2">
                    <span className="rounded-md bg-[image:var(--grad)] px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-white">{t.tools.new}</span>
                    <b className="font-semibold">{n}</b>
                  </span>
                  <span className="text-sm text-muted">{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>


        {/* App preview */}
        <section aria-labelledby="preview" className={gutter}>
          <div className="mx-auto flex max-w-7xl flex-col gap-10">
            <SectionHead id="preview" title={t.preview.title} lead={t.preview.lead} />
            <AppPreview t={t.preview} />
          </div>
        </section>

        {/* Studios */}
        <section aria-labelledby="studios" className={`scroll-mt-24 ${gutter}`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-10">
            <SectionHead id="studios" title={t.studios.title} lead={t.studios.lead} />
            <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {t.studios.items
                .map((s) => (
                  <div key={s.name} className="flex flex-col gap-1.5 bg-surface p-5">
                    <dt className="font-display text-lg font-bold [font-stretch:100%]">{s.name}</dt>
                    <dd className="text-[15px] leading-relaxed text-muted">{s.does}</dd>
                  </div>
                ))}
            </dl>
          </div>
        </section>

        {/* Models */}
        <section aria-labelledby="models" className={`scroll-mt-24 ${gutter}`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-10">
            <SectionHead id="models" title={t.models.title} lead={t.models.lead} />
            <div className="flex flex-col gap-8">
              {groups.map((g) => {
                const items = t.models.items.filter((m) => m.group === g);
                return (
                  <div key={g} className="grid gap-4 lg:grid-cols-[180px_1fr]">
                    <h3 className="flex items-center gap-3 text-xl font-extrabold">
                      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[image:var(--grad)]" />
                      {t.models.groups[g]}
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((m) => (
                        <div key={m.name} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-muted/50">
                          <div className="flex items-baseline justify-between gap-3">
                            <b className="font-display text-xl font-extrabold [font-stretch:100%]">{m.name}</b>
                            <span className="text-sm text-muted">{m.maker}</span>
                          </div>
                          <p className="text-[15px] text-muted">{m.use}</p>
                          <p className="mt-auto pt-2 text-sm">
                            {m.cost ? (
                              <span className="rounded-full bg-surface-2 px-2.5 py-1">
                                <b>{m.cost}</b> {m.unit === "s" ? t.models.perSecond : t.models.perImage}
                              </span>
                            ) : g === "brain" || g === "voice" ? (
                              <span className="rounded-full bg-good/12 px-2.5 py-1 text-good">{t.models.included}</span>
                            ) : (
                              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-muted">{t.models.soon}</span>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Difference */}
        <section aria-labelledby="how" className={`scroll-mt-24 ${gutter}`}>
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="flex flex-col gap-6">
              <SectionHead id="how" title={t.diff.title} lead={t.diff.lead} />
              <ol className="flex flex-col gap-4">
                {t.diff.steps.map(([s, d], i) => (
                  <li key={s} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line font-display text-sm font-bold">
                      {i + 1}
                    </span>
                    <span>
                      <b className="font-semibold">{s}.</b> <span className="text-muted">{d}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="min-w-0 overflow-x-auto rounded-2xl border border-line bg-surface">
              <table className="w-full min-w-[560px] text-left text-[15px]">
                <caption className="sr-only">{t.diff.caption}</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="p-4"></th>
                    <th scope="col" className="p-4 font-medium text-muted">{t.diff.colOther}</th>
                    <th scope="col" className="p-4">
                      <span className="flex items-center gap-2 font-bold">
                        <Mark size={20} /> Creads IA
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {t.diff.rows.map(([row, them, us]) => (
                    <tr key={row} className="border-b border-line last:border-0">
                      <th scope="row" className="p-4 font-medium">{row}</th>
                      <td className="p-4 text-muted">{them}</td>
                      <td className="p-4">{us}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Credits */}
        <section aria-labelledby="credits" className={`scroll-mt-24 ${gutter}`}>
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
            <div className="flex flex-col gap-6">
              <SectionHead id="credits" title={t.credits.title} lead={t.credits.lead} />
              <ul className="flex flex-col gap-3">
                {t.credits.rules.map((r) => (
                  <li key={r} className="flex gap-3">
                    <span aria-hidden="true" className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-rec" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="divide-y divide-line self-start overflow-hidden rounded-2xl border border-line bg-surface">
              {t.credits.examples.map(([what, how, cost]) => (
                <div key={what} className="flex items-center justify-between gap-4 p-5">
                  <span className="min-w-0">
                    <b className="block font-semibold">{what}</b>
                    <span className="text-sm text-muted">{how}</span>
                  </span>
                  <span className="shrink-0 font-display text-lg font-extrabold [font-stretch:100%]">{cost}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" aria-labelledby="pricing-title" className={`scroll-mt-24 ${gutter}`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-10">
            <SectionHead id="pricing-title" title={t.pricing.title} lead={t.pricing.lead} />
            <Pricing t={t.pricing} form={t.form} lang={t.lang} />
          </div>
        </section>

        {/* Audiences */}
        <section aria-labelledby="who" className={gutter}>
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2">
            <div className="flex flex-col gap-8">
              <SectionHead id="who" title={t.audiences.title} />
              <dl className="divide-y divide-line border-y border-line">
                {t.audiences.items.map(([who, why]) => (
                  <div key={who} className="grid gap-1 py-4 sm:grid-cols-[13rem_1fr] sm:gap-6">
                    <dt className="font-semibold">{who}</dt>
                    <dd className="text-muted">{why}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="relative flex flex-col justify-end overflow-hidden rounded-3xl border border-line">
              <div aria-hidden="true" className="stage absolute inset-0 bg-black" />
              <div aria-hidden="true" className="absolute -top-24 -right-24 h-80 w-80 rounded-full opacity-50 blur-[90px]" style={{ background: "var(--grad)" }} />
              <span aria-hidden="true" className="chroma absolute top-8 left-7 font-display text-[4.2rem] leading-none font-semibold whitespace-nowrap text-white sm:left-10 sm:text-[6.5rem]">EN ⇄ ES</span>
              <div className="relative flex min-h-[380px] flex-col justify-end gap-3 p-7 text-white sm:p-10">
                <h3 className="text-3xl font-extrabold sm:text-4xl">{t.audiences.langTitle}</h3>
                <p className="max-w-[48ch] text-white/85">{t.audiences.langText}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Affiliates (program opens with payments; sign-ups now) — dark stage, with an example of the affiliate panel */}
        <section id="afiliados" aria-labelledby="afiliados-title" className={`stage relative scroll-mt-24 overflow-hidden py-20 sm:py-24 ${gutter}`}>
          <div aria-hidden="true" className="pointer-events-none absolute -right-40 top-10 h-[520px] w-[520px] rounded-full opacity-25 blur-[120px]" style={{ background: "var(--grad)" }} />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
            <div className="flex min-w-0 flex-col gap-8">
              <div className="flex flex-col gap-4">
                {t.affiliates.badge && <span className="w-fit rounded-full border border-line px-3 py-1 font-mono text-xs text-muted">{t.affiliates.badge}</span>}
                <h2 id="afiliados-title" className="chroma font-display text-[2.3rem] leading-[1.04] font-semibold sm:text-6xl">{t.affiliates.title}</h2>
                <p className="max-w-[54ch] text-lg text-muted">{t.affiliates.lead}</p>
              </div>
              <ol className="grid gap-5 border-y border-line py-6 sm:grid-cols-3">
                {t.affiliates.steps.map(([st, d], i) => (
                  <li key={st} className="flex flex-col gap-1.5">
                    <span className="font-mono text-xs text-accent-text">0{i + 1}</span>
                    <b className="font-semibold">{st}</b>
                    <span className="text-sm text-muted">{d}</span>
                  </li>
                ))}
              </ol>
              <div className="max-w-xl">
                <AffiliateForm t={t.affiliates} form={t.form} lang={t.lang} />
              </div>
            </div>

            {/* Example of the affiliate panel, over two clips from the wall */}
            <div className="relative mx-auto w-full max-w-[520px] min-w-0" aria-label={t.affiliates.example}>
              <div className="relative rounded-3xl border border-line bg-surface/90 p-5 shadow-[0_40px_120px_-40px_rgba(255,43,214,0.45)] backdrop-blur sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold"><Mark size={18} /> {t.affiliates.panel}</span>
                  <span className="rounded-md bg-surface-2 px-2 py-1 text-[11px] text-muted">{t.affiliates.example}</span>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5 font-mono text-[13px]">
                  <span className="truncate text-muted">creadsia.com/?ref=<span className="text-ink">tunombre</span></span>
                  <span className="shrink-0 rounded-md bg-ink px-2 py-1 text-[11px] font-semibold text-bg">{t.affiliates.copy}</span>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2">
                  {t.affiliates.stats.map(([k, v]) => (
                    <div key={k} className="min-w-0 rounded-xl bg-surface-2 p-2.5 sm:p-3">
                      <dt className="truncate text-[11px] text-muted">{k}</dt>
                      <dd className="font-display text-base font-semibold whitespace-nowrap sm:text-xl">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-5 flex flex-col gap-2">
                  <span className="text-xs text-muted">{t.affiliates.chart}</span>
                  <div className="flex h-28 items-end gap-1.5" aria-hidden="true">
                    {[18, 26, 24, 35, 41, 39, 52, 58, 64, 71, 83, 96].map((h, i) => (
                      <span key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%`, background: i === 11 ? "var(--grad)" : "var(--surface-2)" }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq" className={`scroll-mt-24 ${gutter}`}>
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <h2 id="faq" className="text-[2rem] font-extrabold sm:text-[2.75rem]">
              {t.faq.title}
            </h2>
            <div className="divide-y divide-line border-y border-line">
              {t.faq.items.map((f) => (
                <details key={f.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold">
                    {f.q}
                    <span aria-hidden="true" className="text-2xl leading-none text-muted transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-2 max-w-[65ch] text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className={gutter}>
          <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-6 overflow-hidden rounded-[2rem] border border-line bg-surface px-6 py-16 text-center">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30 blur-[90px]" style={{ background: "var(--grad)" }} />
            <h2 className="relative max-w-3xl text-[2.2rem] font-black [font-stretch:118%] sm:text-6xl">{t.start.title}</h2>
            <p className="relative max-w-[52ch] text-lg text-muted">{t.start.lead}</p>
            <a href="#pricing" className="relative rounded-xl bg-[image:var(--grad)] px-7 py-3.5 font-semibold text-white">
              {t.nav.cta}
            </a>
          </div>
        </section>
      </main>

      <footer className={`border-t border-line ${gutter}`}>
        <div className="mx-auto grid max-w-7xl gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-3">
            <Logo href={home} />
            <p className="max-w-[34ch] text-sm text-muted">{t.footer.tagline}</p>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <b className="mb-1">{t.footer.studios}</b>
            <a href="#studios" className="text-muted hover:text-ink">{t.footer.links.ugc}</a>
            <a href="#studios" className="text-muted hover:text-ink">{t.footer.links.reels}</a>
            <a href="#studios" className="text-muted hover:text-ink">{t.footer.links.podcast}</a>
            <a href="#studios" className="text-muted hover:text-ink">{t.footer.links.photos}</a>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <b className="mb-1">{t.footer.platform}</b>
            <a href="#how" className="text-muted hover:text-ink">{t.footer.links.how}</a>
            <a href="#models" className="text-muted hover:text-ink">{t.footer.links.models}</a>
            <a href="#credits" className="text-muted hover:text-ink">{t.footer.links.credits}</a>
            <a href="#pricing" className="text-muted hover:text-ink">{t.footer.links.pricing}</a>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <b className="mb-1">{t.footer.contact}</b>
            <span className="select-all text-muted">hola@creadsia.com</span>
            <a href={other} className="text-muted hover:text-ink">{t.nav.switchLabel}</a>
          </div>
        </div>
        <p className="mx-auto max-w-7xl border-t border-line py-6 text-sm text-muted">© {new Date().getFullYear()} Creads IA</p>
      </footer>
    </div>
  );
}
