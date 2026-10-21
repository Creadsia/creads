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

/** Spanish accents offered in the studio, with real voices from ElevenLabs' public library. */
export const ACCENTS = [
  { locale: "es-CL", label: "Chilena" },
  { locale: "es-AR", label: "Argentina" },
  { locale: "es-CO", label: "Colombiana" },
  { locale: "es-MX", label: "Mexicana" },
] as const;

let accentCache: { at: number; list: SharedVoice[] } | null = null;

/** A few real voices per accent (the most used ones), refreshed every hour. */
export async function accentVoices(): Promise<SharedVoice[]> {
  if (accentCache && Date.now() - accentCache.at < 3_600_000) return accentCache.list;
  const lists = await Promise.all(ACCENTS.map((a) => sharedVoices(a.locale, 8).catch(() => [] as SharedVoice[])));
  const list = lists.flat();
  if (list.length) accentCache = { at: Date.now(), list };
  return list;
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
