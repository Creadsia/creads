import type { Voice } from "./providers/types";
import { type SharedVoice, addSharedVoice, elevenlabs, sharedVoices } from "./providers/elevenlabs";
import { sbHeaders } from "./supabase";

// Every cloned voice of every customer lives in Creads' single ElevenLabs account, so the app decides
// who may see and use each one: library voices are for everybody; a cloned (or designed) voice only
// for the workspace that registered it in the `voices` table. Clones made before customers existed
// (not registered anywhere) stay with Creadsia ("main").

const PRIVATE = new Set(["cloned", "generated", "professional_owned"]);
const isPrivate = (v: Voice) => PRIVATE.has(v.category);

/** voice_id → workspace for every registered clone (service key: this reads across customers on purpose). */
async function registry(): Promise<Map<string, string> | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/voices?select=voice_id,owner&limit=10000`, { headers: sbHeaders(key), cache: "no-store" });
  if (!res.ok) {
    // table not created yet (before supabase/tenancy.sql): nobody is registered
    if (res.status === 404) return new Map();
    const body = await res.json().catch(() => null);
    if (body?.code === "42P01" || body?.code === "PGRST205") return new Map();
    throw new Error("No se pudo revisar las voces.");
  }
  return new Map(((await res.json()) as { voice_id: string; owner: string }[]).map((r) => [r.voice_id, r.owner]));
}

export function allowed(v: Voice, ws: string, reg: Map<string, string>) {
  const owner = reg.get(v.id);
  if (owner) return owner === ws;
  return !isPrivate(v) || ws === "main";
}

/** The voices a workspace may see: library voices plus its own clones. */
export async function voicesFor(ws: string): Promise<Voice[]> {
  const [all, reg] = await Promise.all([elevenlabs.voices(), registry()]);
  if (!reg) throw new Error("Falta la base de datos.");
  return all.filter((v) => allowed(v, ws, reg));
}

/** Whether a workspace may use a voice id (to read a line, or to give it to an avatar). */
export async function canUseVoice(ws: string, voiceId: string) {
  if (!/^[A-Za-z0-9]{10,40}$/.test(voiceId)) return false;
  return (await voicesFor(ws)).some((v) => v.id === voiceId);
}

/** Spanish accents offered in the studio, each with real men's and women's voices. */
export const ACCENTS = [
  { locale: "es-CL", label: "Chilena", accent: "chilean", words: /chilen|chile\b/i },
  { locale: "es-AR", label: "Argentina", accent: "argentine", words: /argentin|rioplat/i },
  { locale: "es-VE", label: "Venezolana", accent: "venezuelan", words: /venezol/i },
  { locale: "es-CO", label: "Colombiana", accent: "colombian", words: /colombi|paisa/i },
  { locale: "es-MX", label: "Mexicana", accent: "mexican", words: /mexican|méxic/i },
] as const;

const genderOf = (v: { labels?: Record<string, string>; name: string }) => {
  const g = (v.labels?.gender ?? "").toLowerCase();
  if (g === "male" || g === "female") return g;
  if (/\b(mujer|femenin|woman|female|chica|señora)\b/i.test(v.name)) return "female";
  if (/\b(hombre|masculin|man|male|chico|señor)\b/i.test(v.name)) return "male";
  return "";
};

let accentCache: { at: number; list: SharedVoice[] } | null = null;

/**
 * Per accent: the voices Creads made for it (in our own account, first), then real people's voices from
 * the ElevenLabs library — Professional Voice Clones first — a few men and a few women. Refreshed hourly.
 */
export async function accentVoices(): Promise<SharedVoice[]> {
  if (accentCache && Date.now() - accentCache.at < 3_600_000) return accentCache.list;
  const own = await elevenlabs.voices().catch(() => [] as Voice[]);
  const lists = await Promise.all(ACCENTS.map(async (a) => {
    const mine: SharedVoice[] = own
      .filter((v) => a.words.test(`${v.name} ${v.labels?.accent ?? ""} ${v.labels?.description ?? ""}`) || v.labels?.accent?.toLowerCase() === a.accent)
      .map((v) => ({ ref: v.id, id: v.id, owner: "", name: v.name, gender: genderOf(v), age: v.labels?.age ?? "", accent: a.locale, preview: v.preview, mine: true }));
    const lib: SharedVoice[] = [];
    for (const gender of ["male", "female"] as const) {
      const tries = [
        { locale: a.locale, gender, professional: true }, { locale: a.locale, gender },
        { locale: a.locale, accent: a.accent, gender, professional: true }, { locale: a.locale, accent: a.accent, gender },
      ];
      for (const t of tries) {
        const got = await sharedVoices({ ...t, size: 3 }).catch(() => [] as SharedVoice[]);
        if (got.length) { lib.push(...got.filter((g) => !lib.some((x) => x.id === g.id) && !mine.some((x) => x.id === g.id))); break; }
      }
    }
    return [...mine, ...lib];
  }));
  const list = lists.flat();
  if (list.length) accentCache = { at: Date.now(), list };
  return list;
}

/** A presenter's gender from their description (to offer voices that match the face). */
export function genderOfText(t: string): "male" | "female" | "" {
  if (/\b(woman|female|girl|lady|mujer|señora|chica|she|her)\b/i.test(t)) return "female";
  if (/\b(man|male|guy|boy|hombre|señor|chico|he|his)\b/i.test(t)) return "male";
  return "";
}

/** The voice an ad gets when nobody chose one (API, connectors): the avatar's own, else a matching Chilean voice. */
export async function defaultVoice(ws: string, avatar: { voice_id?: unknown; description?: unknown; name?: unknown } | null, lang: string): Promise<string | null> {
  if (typeof avatar?.voice_id === "string" && avatar.voice_id && (await canUseVoice(ws, avatar.voice_id))) return avatar.voice_id;
  if (lang !== "es-CL") return null;
  const g = genderOfText(`${avatar?.description ?? ""} ${avatar?.name ?? ""}`);
  const cl = (await accentVoices()).filter((v) => v.accent === "es-CL" && (!g || v.gender === g));
  return cl.length ? resolveVoice(ws, cl[0].ref) : null;
}

/**
 * Turns the studio's choice into a voice id that can read lines. A library pick ("lib:<owner>:<voice>")
 * must be one of the offered accent voices; it's added to Creads' account the first time it's used.
 */
export async function resolveVoice(ws: string, choice: string): Promise<string | null> {
  if (!choice) return null;
  if (!choice.startsWith("lib:")) return (await canUseVoice(ws, choice)) ? choice : null;
  const pick = (await accentVoices()).find((v) => v.ref === choice);
  if (!pick) return null;
  const mine = await elevenlabs.voices();
  if (mine.some((v) => v.id === pick.id)) return pick.id;
  const label = ACCENTS.find((a) => a.locale === pick.accent)?.label ?? "Español";
  return addSharedVoice(pick.owner, pick.id, `${pick.name} (${label})`);
}
