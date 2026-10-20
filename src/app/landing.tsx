import Image from "next/image";
import Link from "next/link";
import type { Content } from "@/content/en";
import { Logo, Mark } from "./brand";
import AffiliateForm from "./affiliate-form";
import Composer from "./composer";
import Pricing from "./pricing";
import LoopVideo from "./loop-video";
import RecreateDemos, { type RecreateMedia } from "./recreate-demos";
import ThemeToggle from "./theme-toggle";
import FunnelNudges from "./funnel-nudges";
import WhatsAppButton from "./whatsapp";
import CopyUrl from "./copy-url";
import { Facts, Formats, ModelReel, Versus, type FormatMedia, type ReelClip } from "./home-showcase";
import Spotlight, { type SpotMedia } from "./spotlight";
import { Gallery } from "./gallery";
import { EXAMPLES } from "@/lib/examples";
import Outcome, { type NicheMedia } from "./outcome";
import { labHref } from "@/lib/examples";
import { LAUNCH_PRICE, PLANS, usd as usdLabel } from "@/lib/catalog";

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
// "Recrea cualquier video": demos made for the site with the same models the studio uses
// (Kling motion control / object swap, Seedance, lip-synced dubbing). TODO(phase 1): move to our own storage.
const H = (stamp: string, id: string, ext: "mp4" | "png" = "mp4") => `https://d8j0ntlcm91z4.cloudfront.net/user_3DdKYHg29Dc6YLtguhB32IBiQZ7/hf_${stamp}_${id}.${ext}`;
const thumb = (src: string) => `/_next/image?url=${encodeURIComponent(src)}&w=128&q=70`;
const UGC = H("20261017_140356", "5e1d343e-24d1-4b65-8508-c8ec5234f392");
const DANCE = H("20261017_140356", "416ff2ca-10cf-40bd-8b77-b2094aebfc29");
const RECREATE: RecreateMedia = {
  demos: {
    persona: { before: UGC, after: H("20261017_140835", "0bb466fd-c5ff-4411-a99a-563d461bc55a"), photo: thumb(H("20261017_140348", "357281cd-a698-4542-9485-01641b027ead", "png")) },
    producto: { before: UGC, after: H("20261017_140830", "0e730dd0-cefb-4d70-ac18-8d72e9af733a"), photo: thumb(H("20261017_140347", "ec509f73-2bec-44c4-9d39-b35927c95775", "png")) },
    lugar: { before: UGC, after: H("20261017_140830", "93c8c63c-dd8d-4d69-ac0b-7aaa79c2a30b") },
    capibara: { before: DANCE, after: H("20261017_140830", "92ce32cc-512b-4a02-a8e5-58c6fd1abe8e"), photo: thumb(H("20261017_140347", "4d3f8b89-4fed-4931-8f3e-e90c6eaede18", "png")) },
    caballero: { before: DANCE, after: H("20261017_140830", "482997fb-e07a-4882-9377-8bb5d37d09b2"), photo: thumb(H("20261017_140347", "25abfb58-68ed-41a8-a47b-58b2564b04cc", "png")) },
  },
  voices: { llama: H("20261017_140356", "c56fb9ce-9eed-44db-98c3-fe789cc411db"), llamaEn: H("20261017_141028", "d08ddd05-eb7b-4a4d-a895-1b04640595a8"), cat: H("20261017_141030", "6bd5aa9a-673e-49cf-be26-7ce48bd86404"), viking: H("20261017_141029", "66e7e42e-add7-44cc-a3a2-fe3198ef8972") },
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
interface WallClip { id: string; still?: string; model: string; maker: Maker }
const hf = (id: string, ext: "mp4" | "jpg") => `${CLIP}${id}.${ext}`;
const C = (video: string, still: string, model: string, maker: Maker): WallClip => ({ id: hf(video, "mp4"), still: hf(still, "jpg"), model, maker });
// the "Recrear" demos join the wall (no still: they appear when the clip loads)
const W = (id: string, model: string, maker: Maker): WallClip => ({ id, model, maker });
const D = RECREATE.demos;
const WALL_COLS: { clips: WallClip[]; dir: "up" | "down"; speed: string }[] = [
  {
    dir: "up",
    speed: "70s",
    clips: [
      W(D.capibara.after, "Kling Motion Control", "kling"),
      W(RECREATE.voices.cat, "Seedance 2.5", "bytedance"),
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
      W(D.persona.after, "Kling Swap", "kling"),
      W(D.lugar.after, "Seedance 2.5 Edit", "bytedance"),
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
      W(D.caballero.after, "Kling Motion Control", "kling"),
      W(RECREATE.voices.viking, "Seedance 2.5", "bytedance"),
      C("a1310874-fe73-4989-9e6f-7de4d4d96426", "b9c4463c-3d31-414a-a898-2158c8df5112", "Veo 3.1 Lite", "google"),
      C("e5596388-8427-4692-9439-d29b17e7a190", "ee82f970-1ec8-4a94-b491-366c7e8e0ddf", "Gemini Omni", "google"),
      C("61bc428a-05e4-4443-afe7-7dd2976c69f5", "b8044d86-a0a2-4a5d-a52a-35814a3df137", "Hailuo", "minimax"),
    ],
  },
];

// «Los mejores modelos»: one real clip per model, linked to the studio with that model picked.
const REEL: Record<string, ReelClip> = {
  "seedance-2.5": { video: hf("59617700-cf90-497f-8a75-4ed74416c22f", "mp4"), still: hf("94ba857c-b593-487c-8d18-819c0141addb", "jpg"), href: labHref({ model: "seedance-2.5" }) },
  "veo-3.1-fast": { video: hf("70b577fc-0650-41cc-a267-6131307a18c0", "mp4"), still: hf("1d9b7270-fb34-420a-8371-9b7f65ec0bfe", "jpg"), href: labHref({ model: "veo-3.1-fast" }) },
  "kling-3.0": { video: hf("d4597de4-41e3-4d88-b199-a252d7d47bb3", "mp4"), still: hf("c88c6477-6b88-4339-8e55-d5fc9ad02ce3", "jpg"), href: labHref({ model: "kling-3.0" }) },
  "gemini-omni-flash": { video: hf("e5596388-8427-4692-9439-d29b17e7a190", "mp4"), still: hf("ee82f970-1ec8-4a94-b491-366c7e8e0ddf", "jpg"), href: labHref({ model: "gemini-omni-flash" }) },
  "kling-motion": { video: RECREATE.demos.capibara.after, href: "/ia/recrear" },
  "grok-video-1.5": { video: hf("81fb90d2-22c5-404f-92d8-a201275530cf", "mp4"), still: hf("9a50f2c6-6bbd-4891-8299-f1151a77c433", "jpg"), href: labHref({ model: "grok-video-1.5" }) },
  "wan-3.0": { video: hf("3d5e741d-9422-4221-95ca-38349129b40e", "mp4"), still: hf("afff3cf2-a9d2-4b30-9e60-5b5f70596a08", "jpg"), href: labHref({ model: "wan-3.0" }) },
  "hailuo-2.3": { video: hf("61bc428a-05e4-4443-afe7-7dd2976c69f5", "mp4"), still: hf("b8044d86-a0a2-4a5d-a52a-35814a3df137", "jpg"), href: labHref({ model: "hailuo-2.3" }) },
};

// «Elige tu rubro»: the picture of the finished ad for each niche in the Outcome demo.
const NICHES: Record<string, NicheMedia> = {
  skincare: { still: SCENES.serum.src, video: VIDEOS.serum },
  cursos: { still: SCENES.coach.src, video: VIDEOS.coach },
  inmobiliaria: { still: SCENES.realtor.src },
  restaurante: { still: SCENES.chef.src },
  autos: { still: SCENES.car.src },
  turismo: { still: SCENES.valpo.src, video: VIDEOS.valpo },
};

// Cinema banner: the featured models.
const SPOT: Record<string, SpotMedia> = {
  "seedance-2.5": REEL["seedance-2.5"],
  "veo-3.1-fast": { ...REEL["veo-3.1-fast"], video: hf("a1310874-fe73-4989-9e6f-7de4d4d96426", "mp4"), still: hf("b9c4463c-3d31-414a-a898-2158c8df5112", "jpg") },
  "kling-3.0": { ...REEL["kling-3.0"], video: hf("bff9a5a4-3a41-4ecc-bea3-4326067b05b0", "mp4"), still: hf("0d8d1a1b-7db6-4f0b-9fb3-5a3e9ca85651", "jpg") },
};

// «Formatos listos»: one picture per format.
const FORMATS: Record<string, FormatMedia> = {
  ugc: { still: SCENES.coach.src, video: VIDEOS.coach },
  podcast: { still: SCENES.podcast.src, video: VIDEOS.podcast },
  producto: { still: SCENES.serum.src, video: VIDEOS.serum },
  noticiero: { still: SCENES.news.src },
  entrevista: { still: SCENES.realtor.src },
  influencer: { still: SCENES.valpo.src, video: VIDEOS.valpo },
};

// «Influencer IA»: original characters made with Creads (Nano Banana Pro), shown as the influencer studio's examples.
const INFLU = ["/api/vitrina/influencer-1", "/api/vitrina/influencer-2", "/api/vitrina/influencer-3"];

function WallTile({ c }: { c: WallClip }) {
  return (
    <figure className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-surface-2">
      <LoopVideo src={c.id} poster={c.still ? `/_next/image?url=${encodeURIComponent(c.still)}&w=384&q=60` : undefined} className="absolute inset-0 h-full w-full object-cover" />
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" />
      <figcaption className="absolute inset-x-2.5 bottom-2.5 flex flex-col gap-1 text-white">
        <b className="flex items-center gap-1.5 font-display text-[13px] leading-[1.05] font-semibold tracking-[-0.02em] sm:text-[15px]"><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full shadow-[0_0_8px_currentColor]" style={{ background: MAKER_DOT[c.maker], color: MAKER_DOT[c.maker] }} />{c.model}</b>
      </figcaption>
    </figure>
  );
}

// Examples shown in the menu panels (each key = a menu item with «ex»). Videos load only when the panel opens.
type Ex = { src: string; still?: string; label: string };
const S = (k: SceneKey, label: string): Ex => ({ src: "", still: SCENES[k].src, label });
const V = (src: string, label: string, still?: string): Ex => ({ src, still, label });
const MENU_MEDIA: Record<string, Ex[]> = {
  anuncios: [V(VIDEOS.coach!, "UGC a cámara", SCENES.coach.src), V(VIDEOS.podcast!, "Podcast", SCENES.podcast.src), S("realtor", "Testimonio")],
  video: [V(hf("70b577fc-0650-41cc-a267-6131307a18c0", "mp4"), "Veo 3.1", hf("1d9b7270-fb34-420a-8371-9b7f65ec0bfe", "jpg")), V(hf("d4597de4-41e3-4d88-b199-a252d7d47bb3", "mp4"), "Kling 3.0", hf("c88c6477-6b88-4339-8e55-d5fc9ad02ce3", "jpg")), V(hf("59617700-cf90-497f-8a75-4ed74416c22f", "mp4"), "Seedance 2.5", hf("94ba857c-b593-487c-8d18-819c0141addb", "jpg"))],
  imagen: [S("serum", "Producto"), S("chef", "Lifestyle"), S("sneaker", "Feed 4:5")],
  audio: [V(VIDEOS.podcast!, "Podcast IA", SCENES.podcast.src), V(RECREATE.voices.llama, "Doblaje"), V(RECREATE.voices.cat, "Voz")],
  recrear: [V(RECREATE.demos.persona.after, "Otra persona"), V(RECREATE.demos.producto.after, "Otro producto"), V(RECREATE.demos.capibara.after, "Copia el movimiento")],
  influencer: [V(VIDEOS.valpo!, "Tu personaje", SCENES.valpo.src), S("ugc", "Su ficha"), S("car", "Sus videos")],
};

/** Small mock screens for the steps that are about the studio, not about a clip. */
export function SpyMock({ m }: { m: Content["flow"]["mock"] }) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-xl border border-line bg-surface p-3 text-[11px]">
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-2 rounded-lg border border-line bg-surface-2 p-2">
          <span className="relative h-14 w-9 shrink-0 overflow-hidden rounded-md bg-ink/10">
            <Image src={i ? SCENES.realtor.src : SCENES.coach.src} alt="" fill sizes="40px" className="object-cover" />
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <b className="truncate text-[12px]">{i ? "Seguros · 3 anuncios" : "Suplementos · 5 anuncios"}</b>
            <span className="w-fit rounded bg-good/15 px-1.5 py-0.5 font-semibold text-good">{m.activo}</span>
            <span className="text-muted">{m.versiones}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
export function BreakdownMock({ m }: { m: Content["flow"]["mock"] }) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-xl border border-line bg-surface p-3 text-[11px]">
      {m.parts.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-0.5 rounded-lg border border-line bg-surface-2 px-2 py-1.5">
          <b className="text-accent-text">{k}</b>
          <span>{v}</span>
        </div>
      ))}
    </div>
  );
}
export function ScriptMock({ m }: { m: Content["flow"]["mock"] }) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-xl border border-line bg-surface p-3 text-[11px]">
      <span className="w-fit rounded-md bg-accent/15 px-1.5 py-0.5 font-semibold text-accent-text">{m.nuevos}</span>
      <ul className="flex flex-col gap-1.5">
        {m.hooks.map((h, i) => <li key={h} className="flex gap-1.5 rounded-lg border border-line bg-surface-2 px-2 py-1.5"><b className="font-mono text-muted">{i + 1}</b><span>{h}</span></li>)}
      </ul>
    </div>
  );
}

/** «De espiar a lanzar»: the five steps of an affiliate's ad, each with what Creads shows at that step. */
export function Flow({ t, ctaHref }: { t: Content["flow"]; ctaHref: string }) {
  const art = (k: string) => {
    if (k === "espiar") return <SpyMock m={t.mock} />;
    if (k === "desarmar") return <BreakdownMock m={t.mock} />;
    if (k === "hooks") return <ScriptMock m={t.mock} />;
    if (k === "crear") return (
      <figure className="relative h-full overflow-hidden rounded-xl bg-surface-2">
        <LoopVideo src={VIDEOS.coach!} poster={poster(SCENES.coach.src)} className="absolute inset-0 h-full w-full object-cover" />
        <figcaption className="absolute inset-x-2 bottom-2 rounded-lg bg-black/65 px-2 py-1 text-center text-[11px] font-semibold text-white">✓ {t.mock.revisado}</figcaption>
      </figure>
    );
    return (
      <div className="flex h-full items-end justify-center gap-2 rounded-xl border border-line bg-surface p-3">
        <span className="relative aspect-[9/16] h-[85%] overflow-hidden rounded-lg"><Image src={SCENES.valpo.src} alt="" fill sizes="90px" className="object-cover" /><b className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">9:16</b></span>
        <span className="relative aspect-[4/5] h-[62%] overflow-hidden rounded-lg"><Image src={SCENES.serum.src} alt="" fill sizes="90px" className="object-cover" /><b className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">4:5</b></span>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-3xl flex-col gap-3">
          <h2 id="flujo-title" className="text-[2rem] leading-tight font-extrabold sm:text-[2.75rem]">{t.title}</h2>
          <p className="text-lg text-muted">{t.lead}</p>
        </div>
        <span className="chroma font-display text-2xl font-semibold sm:text-3xl">{t.total}</span>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {t.steps.map((st, i) => (
          <li key={st.k} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3">
            <div className="h-48">{art(st.k)}</div>
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="flex items-center gap-2"><b className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs text-bg">{i + 1}</b><b className="text-[17px]">{st.title}</b></span>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-surface-2 px-2 py-0.5 font-mono text-xs text-muted">{st.time}</span>
            </div>
            <p className="px-1 pb-1 text-sm text-muted">{st.text}</p>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-4">
        <a href={ctaHref} className="rounded-xl bg-[image:var(--grad)] px-6 py-3.5 font-semibold text-white shadow-[0_12px_32px_-12px_rgba(255,43,214,0.7)] transition-transform hover:-translate-y-px">{t.cta}</a>
        <span className="text-sm text-muted">{t.note}</span>
      </div>
    </div>
  );
}

/** The panel under the header for a menu item: what it does, a few examples, and a link to see more. */
export function MenuPanel({ k, t, href, mock }: { k: string; t: Content["menuEx"]; href: string; mock: Content["flow"]["mock"] }) {
  const e = (t as unknown as Record<string, { title: string; text: string; items: string[] }>)[k];
  if (!e) return null;
  const media = MENU_MEDIA[k];
  return (
    <div className="mx-auto grid max-w-7xl gap-6 rounded-b-3xl border border-t-0 border-line bg-bg p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.45)] md:grid-cols-[minmax(0,320px)_1fr]">
      <div className="flex flex-col gap-3">
        <b className="text-xl">{e.title}</b>
        <p className="text-sm text-muted">{e.text}</p>
        <a href={href} className="mt-auto w-fit rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-bg">{t.see}</a>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {k === "espiar" || k === "guiones" ? (
          <div className="col-span-3 grid h-56 grid-cols-2 gap-3">
            {k === "espiar" ? <SpyMock m={mock} /> : <BreakdownMock m={mock} />}
            {k === "espiar" ? <BreakdownMock m={mock} /> : <ScriptMock m={mock} />}
          </div>
        ) : media ? media.map((m) => (
          <figure key={m.label} className="relative h-56 overflow-hidden rounded-xl bg-surface-2">
            {m.src ? <LoopVideo src={m.src} poster={m.still ? poster(m.still) : undefined} className="absolute inset-0 h-full w-full object-cover" /> : <Image src={m.still!} alt="" fill sizes="200px" className="object-cover" />}
            <figcaption className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">{m.label}</figcaption>
          </figure>
        )) : e.items.map((x) => (
          <div key={x} className="flex h-56 items-end rounded-xl border border-line bg-surface p-3 text-sm font-semibold">{x}</div>
        ))}
      </div>
    </div>
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

/**
 * Small picture on each tool card: a real still when we have one, otherwise a mini screen of the tool
 * that shows what goes in and what comes out, with a short label so it reads at a glance.
 */
function ToolArt({ art, es }: { art: string; es: boolean }) {
  const L = (en: string, sp: string) => (es ? sp : en);
  const still = (k: SceneKey, pos = "50% 30%") => (
    <Image src={SCENES[k].src} alt="" fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.05]" style={{ objectPosition: pos }} />
  );
  /** The label at the bottom of every picture: what goes in → what comes out. */
  const cap = (txt: string) => (
    <span className="absolute inset-x-2 bottom-2 hidden truncate rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm sm:block">{txt}</span>
  );
  const wave = (n: number, seed: number, cls: string, h = "h-10") => (
    <span className={`flex ${h} items-center gap-[3px]`}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={`w-[3px] rounded-full ${cls}`} style={{ height: `${18 + Math.abs(Math.sin(i * 0.7 + seed)) * 72}%` }} />
      ))}
    </span>
  );
  const row = (label: string, body: React.ReactNode, dot: string) => (
    <span className="flex w-full items-center gap-2">
      <span className="w-14 shrink-0 text-right text-[10px] font-semibold text-white/70">{label}</span>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />
      {body}
    </span>
  );
  const frame = (ratio: string, label: string, w: string, tint: string) => (
    <span className={`flex ${ratio} ${w} flex-col items-center justify-end overflow-hidden rounded-md border border-white/20 pb-1`} style={{ background: `linear-gradient(170deg, ${tint}, #0d0e11 75%)` }}>
      <span className="text-[9px] font-semibold text-white/85">{label}</span>
    </span>
  );

  switch (art) {
    case "chef":
      return <>{still("chef")}{cap(L("“A chef plating pasta” → photo", "“Un chef sirviendo pasta” → foto"))}</>;
    case "realtor":
      return <>{still("realtor")}{cap(L("Text or photo → 8 s video", "Texto o foto → video de 8 s"))}</>;
    case "car":
      return <>{still("car", "50% 35%")}{cap(L("Photo + voice → talking video", "Foto + voz → video hablando"))}</>;
    case "news":
      return <>{still("news", "50% 25%")}{cap(L("New audio → lips match", "Audio nuevo → labios sincronizados"))}</>;
    case "cutout":
      return (
        <>
          {still("sneaker", "50% 50%")}
          {/* right half: the same product on a transparency grid, as after removing the background */}
          <span className="absolute inset-y-0 right-0 w-1/2 border-l-2 border-white bg-[length:14px_14px]" style={{ backgroundImage: "conic-gradient(#d9d9de 25%, #fff 0 50%, #d9d9de 0 75%, #fff 0)" }} />
          <span className="absolute top-2 left-[calc(50%+8px)] hidden rounded bg-black/70 sm:block px-1.5 py-0.5 text-[10px] font-bold text-white">PNG · 2×</span>
          {cap(L("Background removed, double quality", "Sin fondo y al doble de calidad"))}
        </>
      );
    case "frames":
      return (
        <>
          <span className="absolute inset-x-0 top-0 bottom-8 flex items-center justify-center gap-2 px-3">
            <span className="flex aspect-square w-[22%] flex-col items-center justify-center rounded-md border border-dashed border-white/40 text-white/80">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 8h3l2-2h6l2 2h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /></svg>
              <span className="text-[9px]">{L("Your photo", "Tu foto")}</span>
            </span>
            <span className="text-white/60">→</span>
            {frame("aspect-[4/5]", "Feed", "w-[17%]", "#5b3fa6")}
            {frame("aspect-[9/16]", "Story", "w-[13%]", "#a63f8e")}
            {frame("aspect-square", L("Catalog", "Catálogo"), "w-[19%]", "#3f7ba6")}
          </span>
          {cap(L("One product photo → every format", "Una foto → todos los formatos"))}
        </>
      );
    case "edit":
      return (
        <>
          <span className="absolute inset-x-3 top-3 line-clamp-2 rounded-xl rounded-bl-sm bg-white px-2.5 py-1.5 text-[10px] leading-snug font-semibold text-black sm:text-[11px]">
            {L("“Make the background a beach at sunset”", "“Pon de fondo una playa al atardecer”")}
          </span>
          <span className="absolute inset-x-3 bottom-3 grid grid-cols-2 gap-1.5 sm:bottom-9">
            <span className="flex h-9 items-end rounded-md bg-gradient-to-b from-zinc-500 to-zinc-700 p-1 text-[9px] font-semibold text-white">{L("Before", "Antes")}</span>
            <span className="flex h-9 items-end rounded-md bg-gradient-to-b from-orange-400 via-pink-500 to-sky-700 p-1 text-[9px] font-semibold text-white">{L("After", "Después")}</span>
          </span>
          {cap(L("Ask in words → edited photo", "Pídelo con palabras → foto editada"))}
        </>
      );
    case "phone":
    case "reel":
      return (
        <>
          <span className="absolute inset-x-0 top-2 bottom-9 flex items-center justify-center gap-3">
            <span className="relative flex aspect-[9/16] h-full flex-col justify-end overflow-hidden rounded-[12px] border-2 border-white/30 p-1.5" style={{ background: art === "phone" ? "linear-gradient(180deg,#3a4458,#12141a)" : "linear-gradient(180deg,#4a2360,#12141a)" }}>
              <span className="absolute top-1.5 left-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-rec" />
              <span className="mx-auto mb-2 rounded bg-black/75 px-1 text-center font-display text-[9px] leading-tight font-black text-white">
                {art === "phone" ? <>{L("it cost", "costaba")} <span className="text-[#FFE100]">$34K</span></> : <>{L("wait for", "espera")} <span className="text-[#3DFF6E]">{L("it…", "esto…")}</span></>}
              </span>
            </span>
            <span className="flex flex-col gap-1 text-[10px] text-white/80">
              <span>9:16</span>
              <span>{art === "phone" ? L("8 cuts", "8 cortes") : "Reels · TikTok"}</span>
              <span>{L("Subtitles", "Subtítulos")} ✓</span>
            </span>
          </span>
          {cap(art === "phone" ? L("Your script → finished ad", "Tu guion → anuncio terminado") : L("Idea → vertical video", "Idea → video vertical"))}
        </>
      );
    case "influencer":
      return (
        <>
          <span className="absolute inset-x-3 top-3 flex items-center gap-2">
            <span className="h-9 w-9 shrink-0 rounded-full bg-[image:var(--grad)] p-[2px]"><span className="block h-full w-full rounded-full bg-[#2a2b33]" /></span>
            <span className="flex min-w-0 flex-col">
              <b className="truncate text-[11px] text-white">@sofia.creates ✓</b>
              <span className="text-[10px] text-white/60">{L("7 posts this week", "7 posts esta semana")}</span>
            </span>
          </span>
          <span className="absolute inset-x-3 bottom-9 grid grid-cols-6 gap-1">
            {Array.from({ length: 6 }, (_, i) => <span key={i} className="aspect-[4/5] rounded-sm" style={{ background: `hsl(${265 + i * 16} 45% ${24 + (i % 3) * 8}%)` }} />)}
          </span>
          {cap(L("Same face and voice, every post", "Misma cara y voz en cada post"))}
        </>
      );
    case "voice":
      return (
        <>
          <span className="absolute inset-x-3 top-3 bottom-9 flex flex-col justify-center gap-2">
            {row(L("Sample", "Muestra"), wave(10, 1, "bg-white/50", "h-6"), "#9ca3af")}
            {row(L("Script", "Guion"), wave(22, 2, "bg-white", "h-8"), "#ffffff")}
          </span>
          {cap(L("30 s of your voice → it reads anything", "30 s de tu voz → lee cualquier guion"))}
        </>
      );
    case "podcast":
      return (
        <>
          <span className="absolute inset-x-3 top-3 bottom-9 flex flex-col justify-center gap-2">
            {row(L("Host", "Conductor"), wave(22, 2, "bg-[#8b7cff]", "h-7"), "#8b7cff")}
            {row(L("Guest", "Invitado"), wave(22, 5, "bg-[#ff4fd8]", "h-7"), "#ff4fd8")}
          </span>
          {cap(L("Two AI voices in conversation", "Dos voces IA conversando"))}
        </>
      );
    case "dub":
      return (
        <>
          <span className="absolute inset-x-3 top-3 bottom-9 flex flex-col justify-center gap-2">
            {row("English", wave(22, 3, "bg-white/80", "h-7"), "#ffffff")}
            {row("Español", wave(22, 4, "bg-[#3DFF6E]", "h-7"), "#3DFF6E")}
          </span>
          {cap(L("Same voice, other language", "Misma voz, otro idioma"))}
        </>
      );
    case "music":
      return (
        <>
          <span className="absolute inset-x-4 top-8 bottom-9 flex items-end justify-center gap-1">
            {Array.from({ length: 18 }, (_, i) => <span key={i} className="flex-1 rounded-t-sm bg-[image:var(--grad)] opacity-90" style={{ height: `${20 + Math.abs(Math.sin(i * 1.3)) * 75}%` }} />)}
          </span>
          {cap(L("“Upbeat, 30 s” → royalty-free track", "“Alegre, 30 s” → música libre de derechos"))}
        </>
      );
    case "sfx":
      return (
        <>
          <span className="absolute inset-x-3 top-8 bottom-9 flex flex-wrap content-center items-center justify-center gap-1.5">
            {(es ? ["Whoosh", "Pop", "Lluvia", "Ding", "Aplausos", "Caja registradora"] : ["Whoosh", "Pop", "Rain", "Ding", "Applause", "Cash register"]).map((x) => (
              <span key={x} className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold text-white">▶ {x}</span>
            ))}
          </span>
          {cap(L("Describe a sound → get it", "Describe un sonido → lo tienes"))}
        </>
      );
    case "multiply":
      return (
        <>
          <span className="absolute inset-x-0 top-3 bottom-9 flex items-center justify-center gap-1">
            <span className="flex aspect-[9/16] h-[66%] flex-col items-center justify-center rounded-md border-2 border-[#3DFF6E] bg-[#3DFF6E]/10 text-[9px] font-bold text-[#3DFF6E]">{L("Winner", "Ganador")}</span>
            <span className="text-white/60">→</span>
            {["A", "B", "C", "D", "E"].map((x, i) => (
              <span key={x} className="flex aspect-[9/16] h-[50%] items-end justify-center rounded-md border border-white/25 pb-0.5 text-[9px] font-bold text-white/80" style={{ background: `hsl(${255 + i * 18} 50% 28%)` }}>{x}</span>
            ))}
          </span>
          {cap(L("1 winning ad → 5 new hooks", "1 anuncio ganador → 5 ganchos nuevos"))}
        </>
      );
    case "score":
      return (
        <>
          <span className="absolute inset-x-0 top-3 bottom-9 flex items-center justify-center gap-3">
            <span className="grid h-14 w-14 place-items-center rounded-full" style={{ background: "conic-gradient(#3DFF6E 0 87%, rgba(255,255,255,.12) 0)" }}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#121318] font-display text-base font-bold text-white">87</span>
            </span>
            <span className="flex flex-col gap-0.5 text-[10px] text-white/85">
              <span>{L("Hook", "Gancho")} <b className="text-[#3DFF6E]">9/10</b></span>
              <span>{L("Offer", "Oferta")} <b className="text-[#3DFF6E]">8/10</b></span>
              <span>CTA <b className="text-[#FFE100]">6/10</b></span>
            </span>
          </span>
          {cap(L("Score before you spend", "Puntaje antes de gastar"))}
        </>
      );
    case "publish":
      return (
        <>
          <span className="absolute inset-x-3 top-3 bottom-9 flex flex-col justify-center gap-1.5">
            {[["Meta", L("Mon 9:00", "Lun 9:00")], ["Instagram", L("Tue 18:00", "Mar 18:00")], ["TikTok", L("Wed 20:00", "Mié 20:00")]].map(([n, d]) => (
              <span key={n} className="flex items-center justify-between rounded-md bg-white/10 px-2 py-1 text-[10px] text-white"><b>{n}</b><span className="text-white/70">{d}</span></span>
            ))}
          </span>
          {cap(L("Scheduled from Creads", "Programado desde Creads"))}
        </>
      );
    case "story":
      // a film strip: four shots of one story, and a line of dialogue
      return (
        <>
          <span className="absolute inset-x-0 top-[14%] bottom-[24%] flex flex-col justify-between bg-black/80 py-1">
            {[0, 1].map((r) => (
              <span key={r} className="flex justify-around px-1">{Array.from({ length: 12 }, (_, i) => <span key={i} className="h-1 w-1.5 rounded-[1px] bg-white/35" />)}</span>
            ))}
          </span>
          <span className="absolute inset-x-1.5 top-[22%] bottom-[32%] grid grid-cols-4 gap-1">
            {[
              [L("Office", "Oficina"), "#c98a4b"],
              [L("Night", "Noche"), "#2b3f8f"],
              ["Mentor", "#7a5cff"],
              [L("Win", "Éxito"), "#2fb36b"],
            ].map(([label, tint]) => (
              <span key={label} className="flex flex-col items-center justify-end overflow-hidden rounded-[3px] pb-1" style={{ background: `linear-gradient(170deg, ${tint}, #0d0e11 85%)` }}>
                <span className="mb-1 h-3 w-3 rounded-full bg-white/70" />
                <span className="h-3 w-5 rounded-t-full bg-white/50" />
                <span className="mt-1 text-[8px] font-semibold text-white/90">{label}</span>
              </span>
            ))}
          </span>
          <span className="absolute top-2 left-2 rounded-lg rounded-bl-none bg-white px-2 py-0.5 text-[10px] font-bold text-black shadow">{L("“Get in, I'll show you”", "«Súbete po, te enseño»")}</span>
          {cap(L("Idea → animated short film", "Idea → mini película animada"))}
        </>
      );
    case "api":
      return (
        <>
          <pre className="absolute inset-x-3 top-3 bottom-9 overflow-hidden rounded-md bg-white/5 p-2 font-mono text-[10px] leading-relaxed text-white/85">
            <code><span className="text-[#3DFF6E]">POST</span>{" /v1/ads\n{ \"script\": \"…\",\n  \"model\": \"veo-3.1\" }"}</code>
          </pre>
          {cap(L("Your tools and agents → Creads", "Tus herramientas y agentes → Creads"))}
        </>
      );
    default:
      return null;
  }
}

function ToolCard({ x, t, es }: { x: Tool; t: Content["tools"]; es: boolean }) {
  return (
    <a href="#pricing" className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-muted/60">
      <div className="stage relative aspect-[16/10] overflow-hidden bg-[#0d0e11]">
        <span aria-hidden="true" className="absolute inset-0"><ToolArt art={x.art} es={es} /></span>
        {x.badge && (
          <span className={`absolute top-2 right-2 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold leading-none ${x.badge === "new" ? "bg-[image:var(--grad)] text-white" : "bg-black/70 text-white/80"}`}>
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
      <h2 id={id} className="scroll-mt-32 text-[2rem] font-extrabold sm:text-[2.75rem] lg:scroll-mt-24">
        {title}
      </h2>
      {lead && <p className="text-lg text-muted">{lead}</p>}
    </div>
  );
}

/** The cheapest way in, as the visitor reads money: pesos in Spanish, dollars in English. */
function fromPrice(lang: string, rate: number) {
  const usd = LAUNCH_PRICE; // Starter's first month, the launch offer
  void PLANS;
  void rate;
  return lang === "es" ? usdLabel(usd) : `US$${usd.toFixed(2).replace(/\.00$/, "")}`;
}

/** A thin reminder between sections: the price and one button to the plans. */
function CtaStrip({ t, lang, rate }: { t: Content["nudge"]; lang: string; rate: number }) {
  return (
    <div className={gutter}>
      <a href="#pricing" className="group mx-auto flex max-w-7xl flex-col items-start gap-3 rounded-2xl border border-line bg-surface px-5 py-4 transition-colors hover:border-accent-text sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[17px]">
          {t.strip} <b className="font-display font-semibold">{fromPrice(lang, rate)}</b> <span className="text-muted">{lang === "es" ? "el primer mes" : "your first month"}</span>
        </span>
        <span className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-bg">{t.stripCta}</span>
      </a>
    </div>
  );
}


/** The site header (home and the /ia pages): logo, menu with example panels, language, login and CTA. */
export function SiteHeader({ t, onHome = true, current }: { t: Content; onHome?: boolean; current?: string }) {
  const home = t.lang === "es" ? "/" : "/en";
  const other = t.lang === "es" ? "/en" : "/";
  const pricing = onHome ? "#pricing" : `${home === "/" ? "" : home}/#pricing`;
  return (
  <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-line/60 bg-bg/85 backdrop-blur">
    <div className={`relative mx-auto flex max-w-7xl items-center justify-between gap-4 py-3 ${gutter}`}>
      <Logo href={home} />
      <nav aria-label="Main" className="hidden items-center gap-0.5 text-[15px] min-[1480px]:flex">
        {t.menu.map((m) => (
          <div key={m.label} className="group">
            <a href={m.href} aria-current={m.href === current ? "page" : undefined} className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 whitespace-nowrap text-muted aria-[current=page]:bg-surface aria-[current=page]:text-ink transition-colors hover:bg-surface hover:text-ink group-focus-within:bg-surface group-focus-within:text-ink">
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
            {"ex" in m && m.ex && (
              <div className="invisible absolute inset-x-0 top-full z-40 px-4 pt-0 opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <MenuPanel k={m.ex} t={t.menuEx} href={m.href} mock={t.flow.mock} />
              </div>
            )}
          </div>
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
        <a href={pricing} className="whitespace-nowrap rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 sm:px-4">
          {t.nav.cta}
        </a>
      </div>
    </div>
    {/* phone: the same menu as a scrollable row */}
    <nav aria-label="Main" className={`flex gap-1 overflow-x-auto pb-2.5 text-sm min-[1480px]:hidden ${gutter}`}>
      <span className="shrink-0 min-[420px]:hidden"><ThemeToggle lang={t.lang} /></span>
      {t.menu.map((m) => (
        <a key={m.label} href={m.href} aria-current={m.href === current ? "page" : undefined} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-muted aria-[current=page]:border-ink aria-[current=page]:text-ink">
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
  );
}

export default function Landing({ t, rate = 950, renews = true }: { t: Content; rate?: number; renews?: boolean }) {
  const home = t.lang === "es" ? "/" : "/en";
  const other = t.lang === "es" ? "/en" : "/";
  const groups = ["video", "image", "voice", "brain"] as const;

  return (
    <div className="overflow-x-clip pb-20 lg:pb-0">
      <FunnelNudges t={t.nudge} lang={t.lang} rate={rate} />
      {t.lang === "es" && <WhatsAppButton />}
      {/* Offer bar: offers, news and models sliding sideways */}
      <Ticker t={t.bar} />

      <SiteHeader t={t} />

      <main className="flex flex-col gap-20 pb-20 sm:gap-24">
        {/* Hero: a dark stage. Pitch + composer on the left, a moving wall of AI clips tagged with their model on the right. */}
        <section className={`stage relative -mt-px overflow-hidden ${gutter}`}>
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 py-12 sm:py-16 lg:min-h-[min(820px,calc(100svh-120px))] lg:grid-cols-[1fr_1.08fr] lg:py-12">
            <div className="relative z-10 flex min-w-0 flex-col gap-7">
              <h1 className="chroma font-display text-[2.55rem] leading-[1.02] font-semibold sm:text-6xl lg:text-[4.1rem]">
                {t.hero.title.split(/(?<=\.) /).map((part) => (
                  <span key={part} className="block">{part}</span>
                ))}
              </h1>
              <p className="max-w-[54ch] text-lg text-muted">{t.hero.lead}</p>
              <ul aria-label={t.lang === "es" ? "Para quién" : "Who it's for"} className="flex flex-wrap gap-2">
                {t.hero.who.map((w) => <li key={w} className="rounded-full border border-line bg-surface px-3 py-1 text-sm font-semibold">{w}</li>)}
              </ul>
              <Composer t={t.composer} />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                <a href="#pricing" className="flex shrink-0 flex-col items-center whitespace-nowrap rounded-xl bg-[image:var(--grad)] px-6 py-3.5 text-center font-semibold text-white shadow-[0_12px_32px_-12px_rgba(255,43,214,0.7)] transition-transform hover:-translate-y-px">
                  <span className="text-[17px]">{t.hero.cta}</span>
                  <span className="text-xs font-normal text-white/85">{t.hero.from} {fromPrice(t.lang, rate)} {t.hero.firstMonth}</span>
                </a>
                <a href="#resultado" className="flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line bg-surface/60 px-5 py-3.5 font-semibold backdrop-blur hover:bg-surface">
                  <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-black"><svg viewBox="0 0 20 20" className="h-3 w-3"><path d="M7 5l8 5-8 5z" fill="currentColor" /></svg></span>
                  {t.hero.see}
                </a>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  {t.hero.trust.map((x) => (
                    <li key={x} className="flex items-center gap-1.5">
                      <svg viewBox="0 0 20 20" className="h-4 w-4 text-good" aria-hidden="true"><path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                <span>{t.hero.poweredBy}</span>
                {["Veo 3.1", "Kling 3.0", "Seedance 2.5", "Nano Banana Pro", "ElevenLabs"].map((m) => (
                  <b key={m} className="font-mono text-[13px] font-medium text-ink/85">
                    {m}
                  </b>
                ))}
              </div>
            </div>
            <ClipWall label={t.hero.wall} />
          </div>
        </section>

        {/* Cinema banner: featured models */}
        <section aria-label={t.spotlight.label} className={`-mt-6 ${gutter}`}>
          <div className="mx-auto max-w-7xl">
            <Spotlight t={t.spotlight} media={SPOT} />
          </div>
        </section>

        {/* What goes in, what comes out: the finished ad */}
        <section id="resultado" aria-labelledby="outcome-title" className={`scroll-mt-24 ${gutter}`}>
          <div className="mx-auto max-w-7xl">
            <Outcome t={t.outcome} media={NICHES} ctaHref="#pricing" />
          </div>
        </section>

        {/* Every top model, with its name in big type over a real clip */}
        <section aria-labelledby="reel-title" className={`scroll-mt-24 ${gutter}`}>
          <div className="mx-auto max-w-7xl">
            <ModelReel t={t.reel} clips={REEL} moreHref="#models" />
          </div>
        </section>

        {/* Creads against other AI platforms */}
        <section className={`scroll-mt-24 ${gutter}`}>
          <div className="mx-auto max-w-7xl">
            <Versus t={t.diff} ctaHref="#pricing" cta={t.outcome.cta} />
          </div>
        </section>

        {/* Ready-made formats */}
        <section id="formatos" aria-labelledby="formatos-title" className={`scroll-mt-24 ${gutter}`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-8">
            <Formats t={t.formats} media={FORMATS} href="/ia/anuncios" />
            <Facts items={t.stats as [string, string][]} />
          </div>
        </section>

        {/* AI influencers */}
        <section aria-labelledby="influ-title" className={gutter}>
          <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col gap-4">
              <h2 id="influ-title" className="text-[2rem] leading-tight font-extrabold sm:text-[2.75rem]">{t.influ.title}</h2>
              <p className="text-lg text-muted">{t.influ.lead}</p>
              <ul className="flex flex-col gap-2">
                {t.influ.points.map((x) => (
                  <li key={x} className="flex gap-2"><span aria-hidden="true" className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-[image:var(--grad)]" />{x}</li>
                ))}
              </ul>
              <Link href="/ia/influencer" className="mt-2 self-start rounded-xl bg-[image:var(--grad)] px-6 py-3.5 font-semibold text-white transition-transform hover:-translate-y-px">{t.influ.cta}</Link>
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {INFLU.map((src, i) => (
                <figure key={src} className={`relative aspect-[9/16] overflow-hidden rounded-2xl bg-surface-2 ${i === 1 ? "translate-y-6" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a redirect to a short-lived storage link */}
                  <img src={src} alt={t.influ.alt} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                  <figcaption className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10.5px] font-semibold text-white backdrop-blur-sm">{t.influ.tag}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Made with Creads: the examples gallery */}
        <section id="hecho" aria-labelledby="hecho-title" className={`scroll-mt-24 ${gutter}`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-8">
            <div className="flex max-w-3xl flex-col gap-3">
              <h2 id="hecho-title" className="text-[2rem] leading-tight font-extrabold sm:text-[2.75rem]">{t.made.title}</h2>
              <p className="text-lg text-muted">{t.made.lead}</p>
            </div>
            <Gallery examples={EXAMPLES} filterBy="kind" pageSize={10} columns="columns-2 sm:columns-3 lg:columns-5" />
          </div>
        </section>

        {/* Recreate any video */}
        <section id="recrear" aria-labelledby="recrear-title" className={`scroll-mt-24 ${gutter}`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-10">
            <SectionHead id="recrear-title" title={t.recreate.title} lead={t.recreate.lead} />
            <RecreateDemos t={t.recreate} media={RECREATE} />
            <a href="#pricing" className="self-start rounded-xl bg-[image:var(--grad)] px-6 py-3.5 font-semibold text-white transition-transform hover:-translate-y-px">{t.recreate.cta}</a>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" aria-labelledby="pricing-title" className={`scroll-mt-24 ${gutter}`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-10">
            <SectionHead id="pricing-title" title={t.pricing.title} lead={t.pricing.lead} />
            <Pricing t={t.pricing} lang={t.lang} rate={rate} renews={renews} />
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

        <CtaStrip t={t.nudge} lang={t.lang} rate={rate} />

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

        {/* Claude, ChatGPT and the API */}
        <section id="conectar" aria-labelledby="connect" className={`scroll-mt-24 ${gutter}`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-10">
            <SectionHead id="connect" title={t.connect.title} lead={t.connect.lead} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
              <div className="flex min-w-0 flex-col gap-5 rounded-2xl border border-line bg-surface p-6 sm:p-8">
                <div className="flex min-w-0 flex-col gap-2">
                  <span className="text-sm font-semibold text-muted">MCP</span>
                  <CopyUrl url={t.connect.url} copy={t.connect.copy} copied={t.connect.copied} />
                </div>
                <dl className="flex flex-col gap-4">
                  {t.connect.items.map((x) => (
                    <div key={x.name} className="flex flex-col gap-1">
                      <dt className="font-display text-lg font-bold [font-stretch:100%]">{x.name}</dt>
                      <dd className="text-[15px] leading-relaxed text-muted">{x.how}</dd>
                    </div>
                  ))}
                </dl>
                <a href="/app/api" className="self-start text-[15px] font-semibold underline decoration-line underline-offset-4 hover:decoration-ink">{t.connect.cta}</a>
              </div>
              <div className="flex min-w-0 flex-col justify-end gap-3 rounded-2xl border border-line bg-[image:var(--grad)] p-[1px]">
                <div className="flex h-full flex-col justify-end gap-3 rounded-[15px] bg-bg/92 p-6 sm:p-8">
                  <span className="text-sm text-muted">{t.connect.exampleLabel}</span>
                  <p className="font-display text-2xl leading-snug font-semibold [font-stretch:100%] sm:text-3xl">{t.connect.example}</p>
                  <div className="mt-2 flex flex-col gap-2 text-sm text-muted">
                    <span className="flex items-center gap-2"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[image:var(--grad)]" />creads_crear_anuncio</span>
                    <span className="flex items-center gap-2"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[image:var(--grad)]" />creads_estado_anuncio → video</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <CtaStrip t={t.nudge} lang={t.lang} rate={rate} />

        {/* Why Creads: care, Latin America, people */}
        <section aria-labelledby="care" className={`scroll-mt-24 ${gutter}`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-10">
            <SectionHead id="care" title={t.care.title} lead={t.care.lead} />
            <ul className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {t.care.items.map(([name, does]) => (
                <li key={name} className="flex min-w-0 flex-col gap-2 bg-surface p-6">
                  <b className="font-display text-xl font-bold [font-stretch:100%]">{name}</b>
                  <p className="text-[15px] leading-relaxed text-muted">{does}</p>
                </li>
              ))}
            </ul>
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
            <h2 id="faq" className="scroll-mt-32 text-[2rem] font-extrabold sm:text-[2.75rem] lg:scroll-mt-24">
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
            <div className="relative flex flex-col items-center gap-3 sm:flex-row">
              <a href="/empezar?plan=plus&periodo=mensual" className="rounded-xl bg-[image:var(--grad)] px-7 py-3.5 font-semibold text-white shadow-[0_12px_32px_-12px_rgba(255,43,214,0.7)]">
                {t.start.cta}
              </a>
              <a href="#pricing" className="rounded-xl border border-line px-6 py-3.5 font-semibold hover:bg-surface-2">{t.start.see}</a>
            </div>
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
            <a href="#formatos" className="text-muted hover:text-ink">{t.footer.links.ugc}</a>
            <a href="#formatos" className="text-muted hover:text-ink">{t.footer.links.reels}</a>
            <a href="#formatos" className="text-muted hover:text-ink">{t.footer.links.podcast}</a>
            <a href="#formatos" className="text-muted hover:text-ink">{t.footer.links.photos}</a>
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
            <a href="/terminos" className="text-muted hover:text-ink">{t.lang === "es" ? "Términos y condiciones" : "Terms (Spanish)"}</a>
            <a href="/privacidad" className="text-muted hover:text-ink">{t.lang === "es" ? "Política de privacidad" : "Privacy policy (Spanish)"}</a>
          </div>
        </div>
        <p className="mx-auto max-w-7xl border-t border-line py-6 text-sm text-muted">© {new Date().getFullYear()} Creads IA</p>
      </footer>
    </div>
  );
}
