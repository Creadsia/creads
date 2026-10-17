import { FAL_VIDEO, falPricing } from "./providers/fal";
import { readPrivateJSON, writePrivateJSON } from "./supabase";

// Once a day: are the models we sell still offered by their providers? Only free calls (model lists and
// price lists), never a generation. Anything missing goes to the owner's morning summary, so a model
// that a provider retires is noticed before customers find a broken button.

const GOOGLE_MODELS: [string, string][] = [
  ["veo-3.1-lite-generate-preview", "Veo 3.1 Lite"],
  ["veo-3.1-fast-generate-preview", "Veo 3.1 Fast"],
  ["veo-3.1-generate-preview", "Veo 3.1"],
  ["gemini-3-pro-image-preview", "Nano Banana Pro"],
];

async function googleMissing(): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];
  const names = new Set<string>();
  let page = "";
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000${page ? `&pageToken=${page}` : ""}`, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!res.ok) throw new Error(`Google no respondió la lista de modelos (${res.status}).`);
    const d = (await res.json()) as { models?: { name: string }[]; nextPageToken?: string };
    for (const m of d.models ?? []) names.add(m.name.replace(/^models\//, ""));
    if (!d.nextPageToken) break;
    page = d.nextPageToken;
  }
  return GOOGLE_MODELS.filter(([id]) => !names.has(id)).map(([, label]) => label);
}

async function falMissing(): Promise<string[]> {
  if (!process.env.FAL_KEY) return [];
  const live = await falPricing();
  if (!Object.keys(live).length) throw new Error("fal.ai no respondió la lista de precios.");
  return FAL_VIDEO.filter((m) => m.livePrice !== false && !live[m.id]).map((m) => m.label);
}

// Only a model that WAS listed and now isn't counts (a provider that never lists a model in these
// lists doesn't raise a false alarm every morning).
const SEEN = "modelos-vistos.json";

/** Owner-facing warnings (empty when everything is offered). */
export async function modelWarnings(): Promise<string[]> {
  const out: string[] = [];
  const seen = new Set((await readPrivateJSON<string[]>(SEEN).catch(() => null)) ?? []);
  const all = { Google: GOOGLE_MODELS.map(([, l]) => l), "fal.ai": FAL_VIDEO.filter((m) => m.livePrice !== false).map((m) => m.label) };
  let changed = false;
  for (const [who, check] of [["Google", googleMissing], ["fal.ai", falMissing]] as const) {
    try {
      const missingNow = await check();
      for (const label of all[who]) if (!missingNow.includes(label) && !seen.has(label)) { seen.add(label); changed = true; }
      const missing = missingNow.filter((l) => seen.has(l));
      if (missing.length) out.push(`${who} ya no ofrece: ${missing.join(", ")}. Revisa esos modelos (pueden fallar para los clientes).`);
    } catch (err) {
      out.push(`No se pudo revisar los modelos de ${who}: ${err instanceof Error ? err.message : "sin respuesta"}.`);
    }
  }
  if (changed) await writePrivateJSON(SEEN, [...seen]).catch(() => {});
  return out;
}
