import { DEFAULT_FINANZAS, type Finanzas, toUsd } from "./finance";
import { readPrivateJSON, selectRows, writePrivateJSON } from "./supabase";

// Money left in each outside service, alerts for the owner, and a check before spending so a job
// never fails halfway because a service ran dry. Server-only.
//
// - fal.ai: real balance (account billing API; needs a key that may read billing).
// - ElevenLabs: real usage of the monthly plan.
// - Google (Veo, Nano Banana) and Claude: no balance API. Google is estimated from the top-ups the
//   owner wrote down in the panel minus what Creads recorded as spent; Claude only shows a link.

export type Service = "fal" | "google" | "eleven" | "claude";

export const SERVICE_INFO: Record<Service, { name: string; what: string; recharge: string }> = {
  fal: { name: "fal.ai", what: "Kling, Seedance, Hailuo, Wan, Grok, imágenes y herramientas", recharge: "https://fal.ai/dashboard/billing" },
  google: { name: "Google (Gemini)", what: "Veo y Nano Banana Pro", recharge: "https://console.cloud.google.com/billing" },
  eleven: { name: "ElevenLabs", what: "Voces, clonación, doblaje, música y efectos", recharge: "https://elevenlabs.io/app/subscription" },
  claude: { name: "Claude (Anthropic)", what: "Escribe los prompts y revisa los anuncios", recharge: "https://console.anthropic.com/settings/billing" },
};

const ELEVEN_TOOLS = new Set(["doblaje", "musica", "efectos"]);

/** Which service a recorded job (a `clips` row) was paid to. */
export function serviceOf(kind: string | null | undefined, model: string | null | undefined): Service {
  const k = kind ?? "";
  const m = (model ?? "").toLowerCase();
  if (k.startsWith("tool:")) return ELEVEN_TOOLS.has(k.slice(5)) ? "eleven" : "fal";
  if (m.startsWith("veo") || m.startsWith("nano-banana-pro") || m === "nano banana pro") return "google";
  return "fal";
}

/** Which service runs a video or image model (by provider id). */
export const serviceOfModel = (id: string): Service => serviceOf(null, id);

// ---------- settings and incidents (one private file) ----------

export interface Umbrales {
  fal: number; // US$ left
  google: number; // US$ left (estimated)
  eleven: number; // % of the month's plan left
  diario: number; // US$: most Creads may spend in one day, all customers together (0 = no limit)
}
export const DEFAULT_UMBRALES: Umbrales = { fal: 10, google: 10, eleven: 15, diario: 60 };

interface Incident { at: string; msg: string }
interface SaldosFile { umbrales?: Partial<Umbrales>; fallas?: Partial<Record<Service, Incident>> }
const FILE = "saldos.json";

async function readFile(): Promise<SaldosFile> {
  return (await readPrivateJSON<SaldosFile>(FILE).catch(() => null)) ?? {};
}

export async function getUmbrales(): Promise<Umbrales> {
  const u = (await readFile()).umbrales ?? {};
  const pick = (v: unknown, d: number, max: number) => (typeof v === "number" && isFinite(v) && v >= 0 && v <= max ? v : d);
  return {
    fal: pick(u.fal, DEFAULT_UMBRALES.fal, 100000),
    google: pick(u.google, DEFAULT_UMBRALES.google, 100000),
    eleven: pick(u.eleven, DEFAULT_UMBRALES.eleven, 100),
    diario: pick(u.diario, DEFAULT_UMBRALES.diario, 100000),
  };
}

export async function setUmbrales(u: Umbrales) {
  const f = await readFile();
  await writePrivateJSON(FILE, { ...f, umbrales: u });
}

/** Remembers that a service refused a job for lack of money (shown to the owner). */
export async function noteOutage(service: Service, msg: string) {
  try {
    const f = await readFile();
    await writePrivateJSON(FILE, { ...f, fallas: { ...(f.fallas ?? {}), [service]: { at: new Date().toISOString(), msg: msg.slice(0, 300) } } });
  } catch {
    // never let bookkeeping hide the real error
  }
}

export async function clearOutage(service: Service) {
  const f = await readFile();
  if (!f.fallas?.[service]) return;
  const fallas = { ...f.fallas };
  delete fallas[service];
  await writePrivateJSON(FILE, { ...f, fallas });
}

// ---------- live readings ----------

export type Reading =
  | { ok: true; usd: number }
  | { ok: false; reason: "sin-clave" | "sin-permiso" | "error"; detail?: string };

let falCache: { at: number; r: Reading } | null = null;

/** fal.ai's real balance in US$ (cached a minute). FAL_BILLING_KEY, if set, is used to read it. */
export async function falBalance(fresh = false): Promise<Reading> {
  if (!fresh && falCache && Date.now() - falCache.at < 60_000) return falCache.r;
  const key = process.env.FAL_BILLING_KEY || process.env.FAL_KEY;
  let r: Reading;
  if (!key) r = { ok: false, reason: "sin-clave" };
  else {
    try {
      const res = await fetch("https://api.fal.ai/v1/account/billing?expand=credits", { headers: { authorization: `Key ${key}` }, cache: "no-store" });
      if (res.status === 401 || res.status === 403) r = { ok: false, reason: "sin-permiso" };
      else if (!res.ok) r = { ok: false, reason: "error", detail: `código ${res.status}` };
      else {
        const d = await res.json();
        const v = Number(d?.credits?.current_balance);
        r = isFinite(v) ? { ok: true, usd: v } : { ok: false, reason: "error", detail: "respuesta sin saldo" };
      }
    } catch (e) {
      r = { ok: false, reason: "error", detail: e instanceof Error ? e.message : "sin respuesta" };
    }
  }
  falCache = { at: Date.now(), r };
  return r;
}

export type ElevenReading =
  | { ok: true; used: number; limit: number; resetAt: string | null; tier: string; overage: boolean; overageUsd: number }
  | { ok: false; reason: "sin-clave" | "sin-permiso" | "error"; detail?: string };

let elevenCache: { at: number; r: ElevenReading } | null = null;

/** ElevenLabs plan usage this month (cached a minute). */
export async function elevenUsage(fresh = false): Promise<ElevenReading> {
  if (!fresh && elevenCache && Date.now() - elevenCache.at < 60_000) return elevenCache.r;
  const key = process.env.ELEVENLABS_API_KEY;
  let r: ElevenReading;
  if (!key) r = { ok: false, reason: "sin-clave" };
  else {
    try {
      const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": key }, cache: "no-store" });
      if (res.status === 401 || res.status === 403) r = { ok: false, reason: "sin-permiso" };
      else if (!res.ok) r = { ok: false, reason: "error", detail: `código ${res.status}` };
      else {
        const d = await res.json();
        const ext = d?.max_credit_limit_extension ?? d?.max_character_limit_extension;
        r = {
          ok: true,
          used: Number(d?.character_count ?? 0),
          limit: Number(d?.character_limit ?? 0),
          resetAt: d?.next_character_count_reset_unix ? new Date(Number(d.next_character_count_reset_unix) * 1000).toISOString() : null,
          tier: String(d?.tier ?? ""),
          overage: Boolean(d?.can_extend_character_limit) && ext !== 0 && ext !== "0",
          overageUsd: Number(d?.current_overage?.amount ?? 0) || 0,
        };
      }
    } catch (e) {
      r = { ok: false, reason: "error", detail: e instanceof Error ? e.message : "sin respuesta" };
    }
  }
  elevenCache = { at: Date.now(), r };
  return r;
}

// ---------- the check before spending ----------

export class DailyCapError extends Error {
  constructor(public cap: number, public spent: number) {
    super(`Tope diario de US$${cap} alcanzado (gastado hoy: US$${spent.toFixed(2)}).`);
    this.name = "DailyCapError";
  }
}

/** What Creads recorded as spent today (all customers). */
export async function spentToday() {
  const day = new Date().toISOString().slice(0, 10);
  const rows = await selectRows<{ usd: number | null }>("clips", `select=usd&usd=gt.0&created_at=gte.${day}&limit=100000`).catch(() => []);
  return rows.reduce((a, r) => a + Number(r.usd ?? 0), 0);
}

export class NoFundsError extends Error {
  constructor(public service: Service, detail: string) {
    super(detail);
    this.name = "NoFundsError";
  }
}

/** Keep a little margin: prices are estimates and other jobs may be running. */
const MARGIN_USD = 0.5;

/**
 * Throws NoFundsError if we know the service can't pay for this job. When the balance can't be read
 * it lets the job through (the service itself will refuse it, and the error is explained then).
 */
export async function ensureFunds(service: Service, usd: number, chars = 0) {
  if (service === "fal") {
    const r = await falBalance();
    if (r.ok) {
      if (r.usd < usd + MARGIN_USD) {
        const msg = `fal.ai tiene US$${r.usd.toFixed(2)} y este trabajo cuesta unos US$${usd.toFixed(2)}.`;
        await noteOutage("fal", msg);
        throw new NoFundsError("fal", msg);
      }
      falCache = { at: falCache?.at ?? Date.now(), r: { ok: true, usd: r.usd - usd } };
    }
  } else if (service === "eleven" && chars > 0) {
    const r = await elevenUsage();
    if (r.ok && !r.overage && r.limit > 0 && r.limit - r.used < chars) {
      const msg = `ElevenLabs: quedan ${Math.max(0, r.limit - r.used).toLocaleString("es-CL")} caracteres este mes y se necesitan ${chars.toLocaleString("es-CL")}.`;
      await noteOutage("eleven", msg);
      throw new NoFundsError("eleven", msg);
    }
  }
}

// What each service says when it has no money left (or its plan is used up).
const OUT_OF_FUNDS: [Service, RegExp][] = [
  ["fal", /exhausted balance|user is locked|insufficient (balance|credits|funds)|top up your balance/i],
  ["eleven", /quota_exceeded|exceeds your quota|insufficient[_ ]credits|credits? (are|is) (exhausted|insufficient)/i],
  ["claude", /credit balance is too low/i],
  ["google", /prepa(id|yment).*(depleted|exhausted|insufficient)|billing (account|is) (disabled|not enabled|closed)|BILLING_DISABLED|billing to be enabled/i],
];

/** If an error means a service ran out of money, which one. */
export function outOfFundsService(err: unknown, hint?: Service): Service | null {
  if (err instanceof NoFundsError) return err.service;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  for (const [svc, re] of OUT_OF_FUNDS) if (re.test(msg)) return hint && svc !== "claude" && svc !== "google" ? hint : svc;
  return null;
}

export const CUSTOMER_UNAVAILABLE = "Este modelo no está disponible en este momento. Prueba con otro modelo o vuelve a intentar en un rato.";

/**
 * The message to show for a failed job. If the cause is a service out of money, the owner gets told
 * what to top up (and it's recorded for the panel); customers get a calm "not available right now".
 */
export async function explainFailure(err: unknown, owner: boolean, hint?: Service): Promise<string> {
  const raw = err instanceof Error ? err.message : "No se pudo completar.";
  if (err instanceof DailyCapError) {
    return owner ? `Creads llegó al tope diario de gasto (US$${err.cap}). Súbelo en Panel interno → Saldos y alertas si quieres seguir hoy.` : CUSTOMER_UNAVAILABLE;
  }
  const svc = outOfFundsService(err, hint);
  if (!svc) return raw;
  if (!(err instanceof NoFundsError)) await noteOutage(svc, raw);
  const s = SERVICE_INFO[svc];
  return owner ? `${s.name} se quedó sin saldo. Carga saldo (Panel interno → Saldos y alertas) y vuelve a intentar.` : CUSTOMER_UNAVAILABLE;
}

// ---------- the owner's overview ----------

type Level = "ok" | "bajo" | "agotado" | "desconocido";

export interface ServiceStatus {
  id: Service;
  name: string;
  what: string;
  recharge: string;
  level: Level;
  /** One plain sentence about the money left. */
  headline: string;
  detail: string;
  /** US$ left (real or estimated), when known. */
  usd: number | null;
  estimated: boolean;
  spentMonth: number;
  topUps: number;
  lastFailure: Incident | null;
}

interface SpendRow { kind: string | null; model: string | null; usd: number | null; created_at: string }

const matches: Record<Service, RegExp> = { fal: /\bfal\b/i, google: /google|gemini/i, eleven: /eleven/i, claude: /anthropic|claude/i };

export async function overview(fresh = true): Promise<{ services: ServiceStatus[]; umbrales: Umbrales; today: number; alerts: { service: Service; name: string; text: string }[] }> {
  const [umbrales, file, finanzas, fal, eleven] = await Promise.all([
    getUmbrales(),
    readFile(),
    readPrivateJSON<Finanzas>("finanzas.json").catch(() => null),
    falBalance(fresh),
    elevenUsage(fresh),
  ]);
  const book = finanzas ?? DEFAULT_FINANZAS;
  const usdClp = book.config?.usdClp || 950;
  const topUpsOf = (svc: Service) => book.movimientos.filter((m) => m.tipo === "recarga" && m.monto != null && matches[svc].test(m.servicio));
  const firstTopUp = (svc: Service) => topUpsOf(svc).map((m) => m.fecha).sort()[0];

  const month = new Date();
  month.setUTCDate(1);
  month.setUTCHours(0, 0, 0, 0);
  const since = [month.toISOString().slice(0, 10), firstTopUp("google")].filter(Boolean).sort()[0]!;
  const rows = await selectRows<SpendRow>("clips", `select=kind,model,usd,created_at&usd=gt.0&status=neq.failed&created_at=gte.${since}&limit=50000`).catch(() => [] as SpendRow[]);
  const spent = (svc: Service, from: string) => rows.filter((r) => r.created_at >= from && serviceOf(r.kind, r.model) === svc).reduce((a, r) => a + Number(r.usd ?? 0), 0);
  const monthIso = month.toISOString();

  const money = (n: number) => `US$${n.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const base = (id: Service) => {
    const ups = topUpsOf(id);
    return {
      id, ...SERVICE_INFO[id],
      spentMonth: +spent(id, monthIso).toFixed(2),
      topUps: +ups.reduce((a, m) => a + toUsd(m, usdClp), 0).toFixed(2),
      lastFailure: file.fallas?.[id] ?? null,
    };
  };
  const unread = (reason: string, envName: string) =>
    reason === "sin-clave" ? `Falta ${envName} en Vercel.`
      : reason === "sin-permiso" ? "La clave no tiene permiso para ver el saldo."
        : "No respondió ahora; vuelve a revisar en un rato.";

  const services: ServiceStatus[] = [];

  // fal.ai: real balance
  {
    const b = base("fal");
    if (fal.ok) {
      const level: Level = fal.usd < 1 ? "agotado" : fal.usd < umbrales.fal ? "bajo" : "ok";
      services.push({ ...b, level, usd: fal.usd, estimated: false, headline: `Quedan ${money(fal.usd)}`, detail: `Saldo real en fal.ai. Aviso cuando baje de ${money(umbrales.fal)}. Si se acaba, esos modelos dejan de funcionar hasta que cargues.` });
    } else {
      services.push({
        ...b, level: "desconocido", usd: null, estimated: false, headline: "No pude leer el saldo",
        detail: fal.reason === "sin-permiso"
          ? "Tu clave de fal no deja ver el saldo. En fal.ai → API Keys crea una clave de solo lectura (READONLY) y agrégala en Vercel como FAL_BILLING_KEY."
          : unread(fal.reason, "FAL_KEY"),
      });
    }
  }

  // Google: estimated (top-ups written down minus recorded spend since the first top-up)
  {
    const b = base("google");
    const from = firstTopUp("google");
    if (b.topUps > 0 && from) {
      const left = b.topUps - spent("google", from);
      const level: Level = left <= 0.5 ? "agotado" : left < umbrales.google ? "bajo" : "ok";
      services.push({ ...b, level, usd: +left.toFixed(2), estimated: true, headline: `Quedan unos ${money(Math.max(0, left))}`, detail: `Estimado: cargaste ${money(b.topUps)} (según Movimientos) y Creads lleva gastado ${money(b.topUps - left)}. Google no deja leer el saldo exacto; revísalo en Google Cloud → Facturación.` });
    } else {
      services.push({ ...b, level: "desconocido", usd: null, estimated: true, headline: `Este mes: ${money(b.spentMonth)}`, detail: "Anota tus recargas de Google en Movimientos (tipo «recarga») y te muestro cuánto queda." });
    }
  }

  // ElevenLabs: plan usage
  {
    const b = base("eleven");
    if (eleven.ok && eleven.limit > 0) {
      const leftPct = Math.max(0, ((eleven.limit - eleven.used) / eleven.limit) * 100);
      const level: Level = leftPct <= 0 && !eleven.overage ? "agotado" : leftPct < umbrales.eleven ? "bajo" : "ok";
      const reset = eleven.resetAt ? new Date(eleven.resetAt).toLocaleDateString("es-CL", { day: "numeric", month: "long" }) : null;
      services.push({
        ...b, level, usd: null, estimated: false,
        headline: `Queda el ${Math.round(leftPct)}% del plan`,
        detail: `Usado ${eleven.used.toLocaleString("es-CL")} de ${eleven.limit.toLocaleString("es-CL")} créditos${eleven.tier ? ` (plan ${eleven.tier})` : ""}.${reset ? ` Se renueva el ${reset}.` : ""} ${eleven.overage ? `Si te pasas, ElevenLabs cobra el extra${eleven.overageUsd ? ` (van ${money(eleven.overageUsd)})` : ""}.` : "Si se acaba, las voces dejan de funcionar hasta que se renueve o subas de plan."}`,
      });
    } else {
      services.push({ ...b, level: "desconocido", usd: null, estimated: false, headline: "No pude leer el plan", detail: eleven.ok ? "El plan no informa un límite." : eleven.reason === "sin-permiso" ? "La clave de ElevenLabs no tiene permiso para leer la cuenta (permiso «User: read»)." : unread(eleven.reason, "ELEVENLABS_API_KEY") });
    }
  }

  // Claude: no balance API
  {
    const b = base("claude");
    services.push({ ...b, level: "desconocido", usd: null, estimated: true, headline: "Revísalo en la consola", detail: "Anthropic no deja leer el saldo desde fuera. Lo que gasta Creads en Claude es poco (centavos por anuncio). Activa la recarga automática en la consola para que nunca se corte." });
  }

  // a failure in the last 24 h turns the card red even if the reading looks fine now
  const recent = (i: Incident | null) => i && Date.now() - Date.parse(i.at) < 24 * 3600_000;
  const alerts: { service: Service; name: string; text: string }[] = [];
  for (const s of services) {
    if (recent(s.lastFailure)) {
      alerts.push({ service: s.id, name: s.name, text: `${s.name} rechazó un trabajo por falta de saldo (${new Date(s.lastFailure!.at).toLocaleString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}).` });
    } else if (s.level === "agotado") alerts.push({ service: s.id, name: s.name, text: `${s.name} está sin saldo: ${s.what.toLowerCase()} no van a funcionar.` });
    else if (s.level === "bajo") alerts.push({ service: s.id, name: s.name, text: `${s.name}: saldo bajo (${s.headline.toLowerCase()}).` });
  }
  const today = await spentToday();
  if (umbrales.diario && today >= umbrales.diario * 0.8) {
    alerts.unshift({ service: "fal", name: "Tope diario", text: today >= umbrales.diario ? `Se alcanzó el tope diario de US$${umbrales.diario}: nadie puede generar hasta mañana (o súbelo).` : `Hoy ya se gastó US$${today.toFixed(2)} de un tope diario de US$${umbrales.diario}.` });
  }
  return { services, umbrales, today: +today.toFixed(2), alerts };
}

// ---------- daily safety limit ----------

let dayCache: { at: number; day: string; usd: number } | null = null;

/**
 * Stops everything for the day once Creads (all customers together) has spent the owner's daily
 * limit, so a bug or an abuser can't empty the accounts overnight. Counts what the studio recorded.
 */
export async function ensureDailyCap(usd: number) {
  const { diario } = await getUmbrales();
  if (!diario) return;
  const day = new Date().toISOString().slice(0, 10);
  if (!dayCache || dayCache.day !== day || Date.now() - dayCache.at > 30_000) {
    const rows = await selectRows<{ usd: number | null }>("clips", `select=usd&usd=gt.0&created_at=gte.${day}&limit=100000`).catch(() => null);
    if (!rows) return; // can't read it: don't block on bookkeeping
    dayCache = { at: Date.now(), day, usd: rows.reduce((a, r) => a + Number(r.usd ?? 0), 0) };
  }
  if (dayCache.usd + usd > diario) throw new DailyCapError(diario, dayCache.usd);
  dayCache.usd += usd;
}
