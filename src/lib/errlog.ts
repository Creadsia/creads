import { createHash } from "node:crypto";
import { readPrivateJSON, sbRest, writePrivateJSON } from "./supabase";
import { alarmEmail } from "./emails";
import { sendEmail } from "./providers/email";

// Creads' own error log and alarms (no outside service). Every technical error a customer runs into,
// every crash of a server route and every crash in the browser lands here: one small file per day in
// the private bucket (errores/<YYYY-MM-DD>.json). The same kind of error is grouped by a signature.
// A new kind of error, or a spike of failed generations, sends the owner an email — at most once
// every 6 h per problem and 20 per day, so a bad day never floods the inbox.
// Everything is best effort: logging never breaks what the customer is doing.

export type ErrArea = "servidor" | "navegador" | "generacion" | "pagos" | "correo" | "cron";

export interface ErrEntry { at: string; area: ErrArea; sig: string; message: string; ref?: string; path?: string; ws?: string; n?: number }

const day = (d = new Date()) => d.toISOString().slice(0, 10);
// browser errors (reported by anyone's browser) live in their own file, so a flood of them can never
// push real server errors out of the daily cap
const file = (d: string, browser = false) => `errores/${d}${browser ? "-navegador" : ""}.json`;
const CAP = { server: 3000, browser: 1000 };
const ALARMS = "errores/alarmas.json";
const RESOLVED = "errores/resueltos.json";
// «Empezar de cero» (owner, 22 Oct 2026): the Panel only counts errors and generations after this moment.
// Nothing is deleted: the old days stay in the bucket.
const SINCE = "errores/desde.json";
const SIX_HOURS = 6 * 3600_000;

/** Removes what must never be stored: link signatures, tokens, keys, emails. */
export function redact(s: string) {
  return String(s ?? "")
    .replace(/(https?:\/\/[^\s?#"']+)\?[^\s"']*/g, "$1?…")
    .replace(/\bBearer\s+[^\s"',]+/gi, "Bearer [clave]")
    .replace(/\b(sk|pk|rk|whsec|re|xi|fal)[-_][A-Za-z0-9_-]{8,}/g, "[clave]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]*)?/g, "[clave]")
    .replace(/(?=[A-Za-z0-9+/_-]*\d)(?=[A-Za-z0-9+/_-]*[A-Za-z])[A-Za-z0-9+/_-]{32,}={0,2}/g, "[…]") // long keys/ids (needs letters and digits, so plain page paths survive)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[correo]")
    .slice(0, 600);
}

/** Same problem → same signature (numbers, ids and references don't make a new one). */
export function signature(area: string, message: string) {
  const norm = redact(message).toLowerCase().replace(/\[[^\]]*\]|[0-9a-f]{6,}|\d+/g, "#").replace(/\s+/g, " ").trim().slice(0, 200);
  return createHash("sha1").update(`${area}|${norm}`).digest("hex").slice(0, 12);
}

let ownerEmail: { v: string | null; at: number } | null = null;
async function owner() {
  if (ownerEmail && Date.now() - ownerEmail.at < 3600_000) return ownerEmail.v;
  const rows = await sbRest<{ email: string }[]>("users?workspace=eq.main&role=eq.owner&active=eq.true&select=email&limit=1").catch(() => []);
  ownerEmail = { v: rows[0]?.email ?? null, at: Date.now() };
  return ownerEmail.v;
}

/**
 * Sends the owner an alarm for `key` unless one went out in the last 6 h (or 20 today).
 * Returns true if it was sent.
 */
export async function alarm(key: string, a: { title: string; detail: string; rows?: [string, string][] }): Promise<boolean> {
  try {
    const st = (await readPrivateJSON<{ sent: Record<string, number>; day: string; count: number; seen: Record<string, number> }>(ALARMS)) ?? { sent: {}, day: day(), count: 0, seen: {} };
    if (st.day !== day()) { st.day = day(); st.count = 0; }
    st.seen ??= {};
    st.seen[key] = (st.seen[key] ?? 0) + 1;
    const last = st.sent[key] ?? 0;
    if (Date.now() - last < SIX_HOURS || st.count >= 20) { await writePrivateJSON(ALARMS, st); return false; }
    const to = await owner();
    if (!to) return false;
    const times = st.seen[key];
    st.sent[key] = Date.now();
    st.seen[key] = 0;
    st.count++;
    // drop old keys so the file stays small
    for (const k of Object.keys(st.sent)) if (Date.now() - st.sent[k] > 7 * 86400_000) { delete st.sent[k]; delete st.seen[k]; }
    await writePrivateJSON(ALARMS, st);
    return await sendEmail(alarmEmail(to, { ...a, times }));
  } catch (err) {
    console.error("alarm", err instanceof Error ? err.message : err);
    return false;
  }
}

const noLinks = (t: string) => t.replace(/https?:\/\/\S+/g, "[enlace]").replace(/\bwww\.\S+/g, "[enlace]");

// The same error repeating within a minute on this server is counted, not written each time.
const recent = new Map<string, { at: number; skipped: number }>();

/** Records an error (and emails the owner the first time a new kind of server error shows up). */
export async function logError(e: { area: ErrArea; message: string; ref?: string; path?: string; ws?: string }) {
  try {
    const message = redact(e.message);
    if (!message) return;
    const browser = e.area === "navegador";
    const sig = signature(e.area, message);
    const mem = recent.get(sig);
    if (mem && Date.now() - mem.at < 60_000) { mem.skipped++; return; }
    recent.set(sig, { at: Date.now(), skipped: 0 });
    if (recent.size > 500) for (const [k, v] of recent) if (Date.now() - v.at > 60_000) recent.delete(k);
    const path = e.path ? redact(e.path.split("?")[0]).slice(0, 120) : undefined;
    const n = 1 + (mem?.skipped ?? 0);
    const entry: ErrEntry = { at: new Date().toISOString(), area: e.area, sig, message, ...(e.ref ? { ref: redact(e.ref).slice(0, 80) } : {}), ...(path ? { path } : {}), ...(e.ws ? { ws: e.ws } : {}), ...(n > 1 ? { n } : {}) };
    const f = file(day(), browser);
    const list = (await readPrivateJSON<ErrEntry[]>(f)) ?? [];
    const firstToday = !list.some((x) => x.sig === sig);
    if (list.length < (browser ? CAP.browser : CAP.server)) {
      list.push(entry);
      await writePrivateJSON(f, list);
    }
    if (browser) {
      // Anyone can report a browser error, so its text never goes into an email. Only a real wave of
      // them (many reports today) sends one fixed-text alarm; the details are in the Panel.
      const today = list.reduce((a, x) => a + (x.n ?? 1), 0);
      if (today >= 50 && today - n < 50) await alarm("navegador:ola", { title: "Muchos errores en el navegador de los clientes", detail: `Hoy van ${today} errores reportados desde el navegador. Revisa el detalle en Panel → Errores y alarmas.` });
      return;
    }
    if (firstToday) {
      const resolved = (await readPrivateJSON<Record<string, string>>(RESOLVED).catch(() => null)) ?? {};
      const where = { servidor: "el servidor", navegador: "el navegador de un cliente", generacion: "una generación", pagos: "pagos", correo: "el envío de correos", cron: "las tareas diarias" }[e.area];
      await alarm(`err:${sig}`, {
        title: resolved[sig] ? "Volvió un error que habías marcado como resuelto" : `Error nuevo en ${where}`,
        detail: noLinks(message),
        rows: [["Dónde", path ? noLinks(path) : where], ...(e.ref ? [["Referencia", noLinks(redact(e.ref).slice(0, 80))] as [string, string]] : [])],
      });
    }
  } catch (err) {
    console.error("logError", err instanceof Error ? err.message : err);
  }
}

/** The last `days` days of errors, newest first. */
/** When the owner last reset the count (ISO), or null. */
export async function countingSince(): Promise<string | null> {
  const r = await readPrivateJSON<{ at?: string }>(SINCE).catch(() => null);
  return typeof r?.at === "string" ? r.at : null;
}
export async function resetCounting() {
  const at = new Date().toISOString();
  await writePrivateJSON(SINCE, { at });
  return at;
}

export async function recentErrors(days = 7, since: string | null = null): Promise<ErrEntry[]> {
  const out: ErrEntry[] = [];
  for (let i = 0; i < days; i++) {
    const d = day(new Date(Date.now() - i * 86400_000));
    for (const browser of [false, true]) {
      const list = (await readPrivateJSON<ErrEntry[]>(file(d, browser)).catch(() => null)) ?? [];
      if (Array.isArray(list)) out.push(...(since ? list.filter((e) => e.at >= since) : list));
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export interface ErrGroup { sig: string; area: ErrArea; message: string; count: number; first: string; last: string; refs: string[]; paths: string[]; resolved: boolean }

export function groupErrors(list: ErrEntry[], resolved: Record<string, string> = {}): ErrGroup[] {
  const m = new Map<string, ErrGroup>();
  for (const e of list) {
    const g = m.get(e.sig) ?? { sig: e.sig, area: e.area, message: e.message, count: 0, first: e.at, last: e.at, refs: [], paths: [], resolved: false };
    g.count += e.n ?? 1;
    if (e.at < g.first) g.first = e.at;
    if (e.at > g.last) { g.last = e.at; g.message = e.message; }
    if (e.ref && g.refs.length < 5 && !g.refs.includes(e.ref)) g.refs.push(e.ref);
    if (e.path && g.paths.length < 3 && !g.paths.includes(e.path)) g.paths.push(e.path);
    m.set(e.sig, g);
  }
  // resolved stays resolved unless it happened again after it was marked
  return [...m.values()].map((g) => ({ ...g, resolved: Boolean(resolved[g.sig] && g.last <= resolved[g.sig]) })).sort((a, b) => b.last.localeCompare(a.last));
}

export async function resolvedSigs() {
  return (await readPrivateJSON<Record<string, string>>(RESOLVED).catch(() => null)) ?? {};
}
export async function markResolved(sig: string) {
  const r = await resolvedSigs();
  r[sig] = new Date().toISOString();
  await writePrivateJSON(RESOLVED, r);
}

/**
 * Logs after the response is sent (so it never slows a customer down). Outside a request (scripts,
 * tests) it just runs in the background.
 */
export function logLater(e: Parameters<typeof logError>[0]) {
  if (process.env.NODE_ENV === "test" || !process.env.SUPABASE_URL) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { after } = require("next/server") as typeof import("next/server");
    after(() => logError(e));
  } catch {
    void logError(e);
  }
}
