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

export interface ErrEntry { at: string; area: ErrArea; sig: string; message: string; ref?: string; path?: string; ws?: string }

const day = (d = new Date()) => d.toISOString().slice(0, 10);
const file = (d: string) => `errores/${d}.json`;
const ALARMS = "errores/alarmas.json";
const RESOLVED = "errores/resueltos.json";
const SIX_HOURS = 6 * 3600_000;

/** Removes what must never be stored: link signatures, tokens, keys, emails. */
export function redact(s: string) {
  return String(s ?? "")
    .replace(/(https?:\/\/[^\s?#"']+)\?[^\s"']*/g, "$1?…")
    .replace(/\b(sk|pk|rk|whsec|re|xi|fal)[-_][A-Za-z0-9_-]{8,}/g, "[clave]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[…]")
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

/** Records an error (and emails the owner the first time this kind shows up in a while). */
export async function logError(e: { area: ErrArea; message: string; ref?: string; path?: string; ws?: string }) {
  try {
    const message = redact(e.message);
    if (!message) return;
    const sig = signature(e.area, message);
    const entry: ErrEntry = { at: new Date().toISOString(), area: e.area, sig, message, ...(e.ref ? { ref: e.ref } : {}), ...(e.path ? { path: e.path.slice(0, 120) } : {}), ...(e.ws ? { ws: e.ws } : {}) };
    const list = (await readPrivateJSON<ErrEntry[]>(file(day()))) ?? [];
    const firstToday = !list.some((x) => x.sig === sig);
    if (list.length < 3000) {
      list.push(entry);
      await writePrivateJSON(file(day()), list);
    }
    if (firstToday) {
      const resolved = (await readPrivateJSON<Record<string, string>>(RESOLVED).catch(() => null)) ?? {};
      const where = { servidor: "el servidor", navegador: "el navegador de un cliente", generacion: "una generación", pagos: "pagos", correo: "el envío de correos", cron: "las tareas diarias" }[e.area];
      await alarm(`err:${sig}`, {
        title: resolved[sig] ? "Volvió un error que habías marcado como resuelto" : `Error nuevo en ${where}`,
        detail: message,
        rows: [["Dónde", e.path || where], ...(e.ref ? [["Referencia", e.ref] as [string, string]] : [])],
      });
    }
  } catch (err) {
    console.error("logError", err instanceof Error ? err.message : err);
  }
}

/** The last `days` days of errors, newest first. */
export async function recentErrors(days = 7): Promise<ErrEntry[]> {
  const out: ErrEntry[] = [];
  for (let i = 0; i < days; i++) {
    const d = day(new Date(Date.now() - i * 86400_000));
    const list = (await readPrivateJSON<ErrEntry[]>(file(d)).catch(() => null)) ?? [];
    if (Array.isArray(list)) out.push(...list);
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export interface ErrGroup { sig: string; area: ErrArea; message: string; count: number; first: string; last: string; refs: string[]; paths: string[]; resolved: boolean }

export function groupErrors(list: ErrEntry[], resolved: Record<string, string> = {}): ErrGroup[] {
  const m = new Map<string, ErrGroup>();
  for (const e of list) {
    const g = m.get(e.sig) ?? { sig: e.sig, area: e.area, message: e.message, count: 0, first: e.at, last: e.at, refs: [], paths: [], resolved: false };
    g.count++;
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
