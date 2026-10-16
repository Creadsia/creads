import Image from "next/image";
import type { Content } from "@/content/en";
import { Logo, Mark } from "./brand";
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
  ugc: `${CLIP}9d9f2c3e-4480-4706-93dc-92bb94a8e8f0.mp4`,
  valpo: `${CLIP}9b933c53-6d3c-4306-9eff-5d0bd4bd58b0.mp4`,
  serum: `${CLIP}dbfb983f-a3d8-4a46-bb53-e86fc64f91d6.mp4`,
  podcast: `${CLIP}dbf87bbe-75ec-407e-8dfb-b8a48c570644.mp4`,
  coach: `${CLIP}1d1b7dbe-d2c5-4930-a843-2dbe2834c080.mp4`,
};
const poster = (src: string) => `/_next/image?url=${encodeURIComponent(src)}&w=640&q=70`;
const WALL: SceneKey[] = ["ugc", "serum", "valpo", "podcast", "coach", "chef", "car", "sneaker", "realtor", "news"];

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
  const shots: SceneKey[] = ["ugc", "ugc", "ugc", "ugc"];
  const crops = ["object-[50%_20%]", "object-[50%_45%]", "object-[30%_60%]", "object-[60%_35%]"];
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {shots.map((k, i) => (
              <figure key={i} className="flex flex-col gap-2">
                <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-surface-2">
                  <Image
                    src={SCENES[k].src}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 45vw, 18vw"
                    className={`object-cover ${crops[i]} ${i === 1 ? "scale-110" : i === 2 ? "scale-125" : i === 3 ? "scale-105" : ""}`}
                  />
                  <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
                    {i + 1} · 8 s
                  </span>
                </div>
                <figcaption className="text-xs text-muted">{t.cuts[i]}</figcaption>
              </figure>
            ))}
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
      {/* Offer bar */}
      <div className="bg-[image:var(--grad)] text-white">
        <a
          href="#pricing"
          className={`mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2 text-center text-sm font-medium ${gutter}`}
        >
          <span>{t.bar.text}</span>
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 font-semibold">{t.bar.cta}</span>
        </a>
      </div>

      {/* Header */}
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-line/60 bg-bg/85 backdrop-blur">
        <div className={`mx-auto flex max-w-7xl items-center justify-between gap-4 py-3 ${gutter}`}>
          <Logo href={home} />
          <nav aria-label="Main" className="hidden items-center gap-1 text-[15px] lg:flex">
            {t.menu.map((m) => (
              <a key={m.label} href={m.href} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-muted transition-colors hover:bg-surface hover:text-ink">
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
          <div className="flex items-center gap-2">
            {/* Language switch: both options visible, the current one filled. */}
            <nav aria-label="Language" className="flex items-center rounded-full border border-line bg-surface p-0.5 text-xs font-bold">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="mx-1.5 h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
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
            <ThemeToggle lang={t.lang} />
            <a href="#pricing" className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90">
              {t.nav.cta}
            </a>
          </div>
        </div>
        {/* phone: the same menu as a scrollable row */}
        <nav aria-label="Main" className={`flex gap-1 overflow-x-auto pb-2.5 text-sm lg:hidden ${gutter}`}>
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

      <main className="flex flex-col gap-28 pb-24">
        {/* Hero: pitch + composer on the left, featured studios on the right */}
        <section className={`relative pt-10 sm:pt-14 ${gutter}`}>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-0 h-[520px] w-[60%] rounded-full opacity-35 blur-[120px]"
            style={{ background: "var(--grad)" }}
          />
          <div className="relative mx-auto grid max-w-7xl items-start gap-10 lg:grid-cols-[1fr_1.05fr]">
            <div className="flex min-w-0 flex-col gap-6">
              <h1 className="text-[2.7rem] font-black leading-[1.02] [font-stretch:118%] sm:text-6xl">{t.hero.title}</h1>
              <p className="max-w-[58ch] text-lg text-muted">{t.hero.lead}</p>
              <Composer t={t.composer} />
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
                <span>{t.hero.poweredBy}</span>
                {["Veo 3.1", "Seedance", "Kling", "Nano Banana Pro", "ElevenLabs", "Claude"].map((m) => (
                  <b key={m} className="font-display font-bold text-ink/80 [font-stretch:100%]">
                    {m}
                  </b>
                ))}
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-3" aria-label={t.featured.title}>
              {t.featured.items.map((f, i) => {
                const sc = SCENES[f.k as SceneKey];
                return (
                  <a
                    key={f.title}
                    href="#tools"
                    className={`group relative flex overflow-hidden rounded-2xl border border-line ${
                      i === 0 ? "row-span-2 min-h-[340px] sm:min-h-[420px]" : i === 3 ? "col-span-2 min-h-[150px] sm:min-h-[170px]" : "min-h-[160px] sm:min-h-[202px]"
                    }`}
                  >
                    <Image
                      src={sc.src}
                      alt=""
                      fill
                      priority={i < 2}
                      sizes="(max-width: 1024px) 50vw, 26vw"
                      className={`object-cover transition-transform duration-500 group-hover:scale-[1.04] ${i === 3 ? "object-[50%_30%]" : ""}`}
                    />
                    {VIDEOS[f.k as SceneKey] && (
                      <LoopVideo
                        src={VIDEOS[f.k as SceneKey]!}
                        poster={poster(sc.src)}
                        className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] ${i === 3 ? "object-[50%_30%]" : ""}`}
                      />
                    )}
                    <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                    <span
                      className={`absolute left-3 top-3 rounded-md px-2 py-1 text-[11px] font-bold text-white ${
                        f.badge.startsWith("-") ? "bg-rec" : "bg-[image:var(--grad)]"
                      }`}
                    >
                      {f.badge}
                    </span>
                    <span className="relative mt-auto flex flex-col gap-1 p-4 text-white">
                      <b className={`font-display font-extrabold leading-tight [font-stretch:105%] ${i === 0 ? "text-2xl" : "text-lg"}`}>{f.title}</b>
                      <span className="text-sm text-white/80">{f.text}</span>
                    </span>
                  </a>
                );
              })}
            </div>
          </div>

          {/* real numbers about the product */}
          <dl className="relative mx-auto mt-12 grid max-w-7xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
            {t.stats.map(([n, l]) => (
              <div key={l} className="flex flex-col gap-1 bg-surface px-5 py-4">
                <dt className="order-2 text-sm text-muted">{l}</dt>
                <dd className="order-1 font-display text-3xl font-black [font-stretch:110%]">{n}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Tools */}
        <section aria-labelledby="tools" className={`scroll-mt-24 ${gutter}`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-8">
            <SectionHead id="tools" title={t.tools.title} lead={t.tools.lead} />
            <div className="grid gap-6 lg:grid-cols-4">
              {(["image", "video", "audio", "growth"] as const).map((g) => (
                <div key={g} className="flex flex-col gap-2">
                  <h3 className="px-1 text-sm font-semibold text-muted">{t.tools.groups[g]}</h3>
                  {t.tools.items
                    .filter((x) => x.group === g)
                    .map((x) => (
                      <div key={x.name} className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-muted/50">
                        <span className="flex items-center justify-between gap-2">
                          <b className="font-semibold">{x.name}</b>
                          {x.badge && (
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                                x.badge === "new" ? "bg-[image:var(--grad)] text-white" : "bg-surface-2 text-muted"
                              }`}
                            >
                              {x.badge === "new" ? t.tools.new : t.tools.soon}
                            </span>
                          )}
                        </span>
                        <span className="text-sm text-muted">{x.text}</span>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Showcase wall */}
        <section aria-labelledby="wall" className={gutter}>
          <h2 id="wall" className="sr-only">
            {t.wall.title}
          </h2>
          <div className="mx-auto max-w-7xl columns-2 gap-3 sm:columns-3 lg:columns-5">
            {WALL.map((k) => {
              const s = SCENES[k];
              const [label, line] = t.wall.items[k];
              return (
                <figure key={k} className="group relative mb-3 break-inside-avoid overflow-hidden rounded-2xl bg-surface-2">
                  <Image
                    src={s.src}
                    alt={label}
                    width={s.w}
                    height={s.h}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  {VIDEOS[k] && (
                    <LoopVideo src={VIDEOS[k]!} poster={poster(s.src)} className="absolute inset-0 h-full w-full object-cover" />
                  )}
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-10 text-left text-white">
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="block text-xs opacity-75">{line}</span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
          <p className="mx-auto mt-4 max-w-7xl text-sm text-muted">{t.wall.note}</p>
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {t.studios.items
                .filter((s) => "k" in s && s.k)
                .map((s) => {
                  const sc = SCENES[(s as { k: SceneKey }).k];
                  return (
                    <article key={s.name} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
                      <div className="relative aspect-[4/5] overflow-hidden">
                        <Image
                          src={sc.src}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 p-4">
                        <h3 className="text-lg font-bold [font-stretch:100%]">{s.name}</h3>
                        <p className="text-[15px] leading-relaxed text-muted">{s.does}</p>
                      </div>
                    </article>
                  );
                })}
            </div>
            <dl className="grid gap-x-8 gap-y-6 border-t border-line pt-8 sm:grid-cols-2 lg:grid-cols-4">
              {t.studios.items
                .filter((s) => !("k" in s && s.k))
                .map((s) => (
                  <div key={s.name} className="flex flex-col gap-1.5">
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
                        <Mark size={20} /> Creads
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
              <Image src={SCENES.valpo.src} alt="" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover object-[50%_35%]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
              <div className="relative flex min-h-[460px] flex-col justify-end gap-3 p-7 text-white sm:p-10">
                <h3 className="text-3xl font-extrabold sm:text-4xl">{t.audiences.langTitle}</h3>
                <p className="max-w-[48ch] text-white/85">{t.audiences.langText}</p>
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
        <p className="mx-auto max-w-7xl border-t border-line py-6 text-sm text-muted">© {new Date().getFullYear()} Creads</p>
      </footer>
    </div>
  );
}
