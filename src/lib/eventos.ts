import { createHmac } from "node:crypto";
import { readPrivateJSON, updatePrivateJSON } from "./supabase";

// Funnel events (owner's plan, 25 Oct 2026, «Medición»): every important step is written to a small daily log
// (read by /api/metrics) and, when WEBHOOK_URL is set in Vercel, POSTed there for the owner's assistant.
// The body is signed: header x-creads-signature = "sha256=" + HMAC-SHA256(WEBHOOK_SECRET, body).
// Never card data. Never throws: measurement must not break a signup or a payment.

export type Evento = "registro" | "primera_generacion" | "checkout" | "pago" | "pago_fallido" | "baja" | "saldo_bajo";
export interface EventoRow { evento: Evento; fecha: string; datos: Record<string, unknown> }

const dia = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const file = (d: string) => `eventos/${d}.json`;

async function enviar(row: EventoRow) {
  const url = process.env.WEBHOOK_URL ?? "";
  if (!/^https:\/\//.test(url)) return;
  const body = JSON.stringify(row);
  const secret = process.env.WEBHOOK_SECRET ?? "";
  const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "Creads-Webhooks/1.0" };
  if (secret) headers["x-creads-signature"] = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  for (let i = 0; i < 2; i++) {
    const ok = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(4000) }).then((r) => r.ok).catch(() => false);
    if (ok) return;
  }
}

export async function registrarEvento(evento: Evento, datos: Record<string, unknown>) {
  const row: EventoRow = { evento, fecha: new Date().toISOString(), datos };
  try {
    await Promise.all([
      updatePrivateJSON<EventoRow[]>(file(dia()), (cur) => [...(cur ?? []), row].slice(-5000)),
      enviar(row),
    ]);
  } catch (e) {
    console.error("evento", evento, e instanceof Error ? e.message : e);
  }
}

/** The events of the days between from and to (Chile days, inclusive, at most 92). */
export async function leerEventos(from: string, to: string): Promise<EventoRow[]> {
  const days: string[] = [];
  for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= to && days.length < 92; d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
  const all = await Promise.all(days.map((d) => readPrivateJSON<EventoRow[]>(file(d)).catch(() => null)));
  return all.flatMap((x) => x ?? []);
}
