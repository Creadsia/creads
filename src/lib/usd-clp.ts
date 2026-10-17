import { DEFAULT_FINANZAS, type Finanzas } from "./finance";
import { readPrivateJSON, writePrivateJSON } from "./supabase";

// Prices are in US$; Chilean payments are charged in pesos. The peso amount uses the official
// observed dollar of the day (Banco Central de Chile, read from mindicador.cl) plus a small cushion
// for the card's exchange spread when Creads pays its providers in dollars. If the daily value can't
// be read, the last one read is used, and finally the value the owner set in the Panel.

const FILE = "dolar.json";
const MAX_AGE_MS = 6 * 3600_000;
interface Cached { valor: number; fecha: string; leido: string }

let mem: { at: number; v: Cached } | null = null;

const sane = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n > 400 && n < 3000;

async function fetchObserved(): Promise<Cached | null> {
  try {
    const res = await fetch("https://mindicador.cl/api/dolar", { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) return null;
    const d = (await res.json()) as { serie?: { fecha: string; valor: number }[] };
    const last = d.serie?.[0];
    return last && sane(last.valor) ? { valor: last.valor, fecha: String(last.fecha).slice(0, 10), leido: new Date().toISOString() } : null;
  } catch {
    return null;
  }
}

/** Today's observed dollar (CLP), or null if it has never been read. Refreshes every few hours. */
export async function observedDollar(fresh = false): Promise<Cached | null> {
  if (!fresh && mem && Date.now() - mem.at < 10 * 60_000) return mem.v;
  const saved = await readPrivateJSON<Cached>(FILE).catch(() => null);
  if (!fresh && saved && sane(saved.valor) && Date.now() - Date.parse(saved.leido) < MAX_AGE_MS) {
    mem = { at: Date.now(), v: saved };
    return saved;
  }
  const live = await fetchObserved();
  if (live) {
    await writePrivateJSON(FILE, live).catch(() => {});
    mem = { at: Date.now(), v: live };
    return live;
  }
  if (saved && sane(saved.valor)) {
    mem = { at: Date.now(), v: saved }; // don't wait for the dead service again for a few minutes
    return saved;
  }
  return null;
}

/** The rate used to turn US$ prices into the pesos charged (server only). */
export async function usdClpRate(): Promise<number> {
  const book = await readPrivateJSON<Finanzas>("finanzas.json").catch(() => null);
  const cushion = Number(book?.config?.cambioColchon ?? DEFAULT_FINANZAS.config.cambioColchon);
  const obs = await observedDollar().catch(() => null);
  if (obs) return Math.round(obs.valor * (1 + (Number.isFinite(cushion) ? Math.min(10, Math.max(0, cushion)) : 2) / 100));
  return Number(book?.config?.usdClp) > 0 ? Number(book!.config.usdClp) : DEFAULT_FINANZAS.config.usdClp;
}
