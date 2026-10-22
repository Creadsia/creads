import type { Voice } from "./providers/types";
import { type SharedVoice, addSharedVoice, elevenlabs, removeVoice, sharedVoices } from "./providers/elevenlabs";
import { readPrivateJSON, sbHeaders, updatePrivateJSON } from "./supabase";

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

/**
 * Deletes one of the workspace's own cloned voices (the «Borrar» in Voces). Library voices can't be deleted,
 * and nobody can delete another customer's clone.
 */
export async function deleteOwnVoice(ws: string, voiceId: string): Promise<boolean> {
  if (!/^[A-Za-z0-9]{10,40}$/.test(voiceId)) return false;
  const [all, reg] = await Promise.all([elevenlabs.voices(), registry()]);
  if (!reg) throw new Error("Falta la base de datos.");
  const v = all.find((x) => x.id === voiceId);
  if (!v || !isPrivate(v) || !allowed(v, ws, reg)) return false;
  await removeVoice(voiceId);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key && reg.has(voiceId)) {
    await fetch(`${url}/rest/v1/voices?voice_id=eq.${voiceId}&owner=eq.${encodeURIComponent(ws)}`, { method: "DELETE", headers: sbHeaders(key) })
      .catch((e) => console.error("voices row delete", e instanceof Error ? e.message : e));
  }
  return true;
}

/** Spanish accents offered in the studio, each with real men's and women's voices. */
export const ACCENTS = [
  { locale: "es-CL", label: "Chilena", accent: "chilean", words: /chilen|chile\b/i },
  { locale: "es-AR", label: "Argentina", accent: "argentine", words: /argentin|rioplat/i },
  { locale: "es-VE", label: "Venezolana", accent: "venezuelan", words: /venezol/i },
  { locale: "es-CO", label: "Colombiana", accent: "colombian", words: /colombi|paisa/i },
  { locale: "es-MX", label: "Mexicana", accent: "mexican", words: /mexican|méxic/i },
] as const;


let accentCache: { at: number; list: SharedVoice[] } | null = null;

const STEM: Record<string, string> = { "es-CL": "chile", "es-AR": "argentin", "es-VE": "venezuel", "es-CO": "colombi", "es-MX": "mexic" };
/** Voices per gender in each country: more where campaigns start (Chile, Argentina, Venezuela). */
const PER_GENDER: Record<string, number> = { "es-CL": 8, "es-AR": 8, "es-VE": 6, "es-CO": 5, "es-MX": 5 };

/** Voices the owner hid for everybody (they sounded bad). Library voice ids. */
const HIDDEN = "voces/ocultas.json";
export async function hiddenVoices(): Promise<string[]> {
  const got = await readPrivateJSON<{ ids?: string[] }>(HIDDEN).catch(() => null);
  return Array.isArray(got?.ids) ? got.ids.filter((x) => typeof x === "string") : [];
}
export async function setHidden(id: string, hide: boolean) {
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) throw new Error("Voz inválida.");
  await updatePrivateJSON<{ ids?: string[] }>(HIDDEN, (cur) => {
    const ids = new Set(cur?.ids ?? []);
    if (hide) ids.add(id); else ids.delete(id);
    return { ids: [...ids] };
  });
  accentCache = null;
}

/**
 * How good a library voice is for ads: made for ads / social / conversation, young or middle-aged,
 * a Professional Voice Clone, and used by many people. Old, whispering or audiobook narrators sink.
 */
export function adScore(v: SharedVoice): number {
  const use = (v.useCase ?? "").toLowerCase();
  const desc = (v.descriptive ?? "").toLowerCase();
  let s = Math.log10(1 + (v.clones ?? 0));
  if (/advert|social|conversational|informative|characters_animation/.test(use)) s += 2;
  if (/narrative|story|audiobook|meditation|asmr/.test(use)) s -= 1.5;
  if (/^(young|middle_aged)$/.test(v.age)) s += 1; else if (v.age === "old") s -= 2;
  if (/casual|confident|upbeat|warm|friendly|pleasant|energetic|natural|professional|crisp/.test(desc)) s += 0.8;
  if (/whisper|raspy|gravelly|sad|deep_old|robotic|nasal/.test(desc)) s -= 1.5;
  if (v.pro) s += 1;
  return s;
}

/**
 * The same preset voices for every account: per country, men and women from the ElevenLabs library whose
 * Spanish is really from that country (verified in that locale or tagged with that accent), ranked for ads
 * (see adScore). Nobody's cloned voice is ever here: those only show in their own account's list.
 * Voices the owner hid are skipped. Refreshed hourly.
 */
export async function accentVoices(): Promise<SharedVoice[]> {
  if (accentCache && Date.now() - accentCache.at < 3_600_000) return accentCache.list;
  const hidden = new Set(await hiddenVoices());
  const lists = await Promise.all(ACCENTS.map(async (a) => {
    const stem = STEM[a.locale];
    const want = PER_GENDER[a.locale] ?? 4;
    const byGender = await Promise.all((["male", "female"] as const).map(async (gender) => {
      const tries = [
        { locale: a.locale, gender, professional: true }, { locale: a.locale, gender },
        { locale: a.locale, gender, sort: "trending" as const },
        { locale: a.locale, accent: a.accent, gender, professional: true }, { locale: a.locale, accent: a.accent, gender },
      ];
      const got = (await Promise.all(tries.map((t) => sharedVoices({ ...t, size: 40, stem }).catch(() => [] as SharedVoice[])))).flat();
      const seen = new Set<string>();
      const pool = got.filter((g) => g.real && !hidden.has(g.id) && !seen.has(g.id) && seen.add(g.id) && (!g.gender || g.gender === gender));
      return pool.sort((x, y) => adScore(y) - adScore(x)).slice(0, want).map((g) => ({ ...g, gender }));
    }));
    return byGender.flat();
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
  if (typeof avatar?.voice_id === "string" && avatar.voice_id) {
    // a library voice saved on the avatar (from Automático) is added to the account the first time
    if (avatar.voice_id.startsWith("lib:")) { const id = await resolveVoice(ws, avatar.voice_id).catch(() => null); if (id) return id; }
    else if (await canUseVoice(ws, avatar.voice_id)) return avatar.voice_id;
  }
  if (lang !== "es-CL") return null;
  const g = genderOfText(`${avatar?.description ?? ""} ${avatar?.name ?? ""}`);
  const cl = (await accentVoices()).filter((v) => v.accent === "es-CL" && (!g || v.gender === g));
  if (!cl.length) return null;
  // not always the same voice (owner, 22 Oct 2026: «ocupa todo el rato lo de Cornejo»): each presenter gets
  // its own Chilean voice, the same one every time for that presenter
  const seed = String(avatar?.name ?? avatar?.description ?? Math.random());
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return resolveVoice(ws, cl[h % cl.length].ref);
}

/**
 * Turns the studio's choice into a voice id that can read lines. A library pick ("lib:<owner>:<voice>")
 * must be one of the offered accent voices; it's added to Creads' account the first time it's used.
 */
export async function resolveVoice(ws: string, choice: string): Promise<string | null> {
  if (!choice) return null;
  if (!choice.startsWith("lib:")) return (await canUseVoice(ws, choice)) ? choice : null;
  const pick = (await accentVoices()).find((v) => v.ref === choice);
  const mine = await elevenlabs.voices();
  if (!pick) {
    // a library voice chosen earlier that is no longer in the top list (the ranking moved): still fine
    // once it's in Creads' account as a library voice
    const id = choice.split(":")[2] ?? "";
    return mine.some((v) => v.id === id && !isPrivate(v)) ? id : null;
  }
  if (mine.some((v) => v.id === pick.id)) return pick.id;
  const label = ACCENTS.find((a) => a.locale === pick.accent)?.label ?? "Español";
  return addSharedVoice(pick.owner, pick.id, `${pick.name} (${label})`);
}
