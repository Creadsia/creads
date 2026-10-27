import { readPrivateJSON, sbRest, writePrivateJSON } from "./supabase";
import { hasPaid } from "./regalo";
import { SITE, pagoArregladoEmail } from "./emails";
import { optedOut, unsubLink } from "./unsub";
import { sendEmail } from "./providers/email";
import { panelDesde } from "./panel-desde";

// «Aviso: el pago ya está arreglado» (owner, 27 Oct 2026). People who opened the card page while the gateway was
// broken (27 Oct) and couldn't finish: they have an order but never paid and never got the gift. One email each,
// inviting them to try again. Test accounts and people who opted out are skipped.

export interface PendientePago { ws: string; email: string; name: string | null }
const mark = (ws: string) => `aviso-pago/${ws.replace(/[^\w-]/g, "_")}.json`;

/** Who would get it: opened the payment (has an order) in the last 14 days, never paid, no gift yet, not emailed. */
export async function pendientesPago(): Promise<PendientePago[]> {
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const [wss, desde, out] = await Promise.all([
    sbRest<{ id: string }[]>(`workspaces?kind=eq.client&created_at=gte.${since}&select=id&limit=1000`).catch(() => []),
    panelDesde(),
    optedOut().catch(() => new Set<string>()),
  ]);
  const list: PendientePago[] = [];
  for (const w of wss) {
    if (desde.pruebas.includes(w.id)) continue;
    if (await readPrivateJSON(mark(w.id)).catch(() => null)) continue;
    const [orders, users, gift] = await Promise.all([
      sbRest<{ id: string }[]>(`orders?owner=eq.${encodeURIComponent(w.id)}&select=id&limit=1`).catch(() => []),
      sbRest<{ email: string; name: string | null }[]>(`users?workspace=eq.${encodeURIComponent(w.id)}&active=eq.true&select=email,name&order=created_at.asc&limit=1`).catch(() => []),
      sbRest<{ id: number }[]>(`credits?owner=eq.${encodeURIComponent(w.id)}&ref=eq.${encodeURIComponent(`regalo:${w.id}`)}&select=id&limit=1`).catch(() => []),
    ]);
    if (!orders.length || !users[0] || out.has(users[0].email.toLowerCase())) continue; // must have opened the payment
    if (gift.length) continue;        // already added the card (got the gift): they're fine
    if (await hasPaid(w.id)) continue; // already paid
    list.push({ ws: w.id, email: users[0].email, name: users[0].name });
  }
  return list;
}

/** Sends the «ya está solucionado» email once to each (a marker file makes a second run a no-op). */
export async function enviarAvisoPago(): Promise<{ enviados: number }> {
  let enviados = 0;
  for (const p of await pendientesPago()) {
    await writePrivateJSON(mark(p.ws), { at: new Date().toISOString() });
    if (await sendEmail(pagoArregladoEmail(p.email, p.name, unsubLink(SITE, p.email)))) enviados++;
  }
  return { enviados };
}
