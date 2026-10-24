import { readPrivateJSON, sbRest, writePrivateJSON } from "./supabase";
import { darRegalo, hasPaid } from "./regalo";
import { SITE, regaloReminderEmail } from "./emails";
import { optedOut, unsubLink } from "./unsub";
import { sendEmail } from "./providers/email";
import { panelDesde } from "./panel-desde";

// Accounts that signed up and never used their gift (owner, 24 Oct 2026: «mándales correos invitándolos a
// usarlos»). Once per account: the gift is loaded first if it never was (sign-ups before it was automatic),
// then «Tu anuncio de regalo te está esperando». Test accounts and people who opted out are skipped.

export interface Pendiente { ws: string; email: string; name: string | null }

const mark = (ws: string) => `regalo/recordatorio-${ws.replace(/[^\w-]/g, "_")}.json`;

/** Who would get it now: signed up more than `horas` ago (last 30 days), never paid, never generated, not reminded. */
export async function pendientes(horas = 20): Promise<Pendiente[]> {
  const until = new Date(Date.now() - horas * 3600_000).toISOString();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [wss, desde, out] = await Promise.all([
    sbRest<{ id: string }[]>(`workspaces?kind=eq.client&created_at=gte.${since}&created_at=lte.${until}&select=id&limit=1000`).catch(() => []),
    panelDesde(),
    optedOut().catch(() => new Set<string>()),
  ]);
  const list: Pendiente[] = [];
  for (const w of wss) {
    if (desde.pruebas.includes(w.id)) continue;
    if (await readPrivateJSON(mark(w.id)).catch(() => null)) continue;
    const [used, users] = await Promise.all([
      sbRest<{ id: number }[]>(`credits?owner=eq.${encodeURIComponent(w.id)}&kind=eq.charge&select=id&limit=1`).catch(() => [{ id: 0 }]),
      sbRest<{ email: string; name: string | null }[]>(`users?workspace=eq.${encodeURIComponent(w.id)}&active=eq.true&select=email,name&order=created_at.asc&limit=1`).catch(() => []),
    ]);
    if (used.length || !users[0] || out.has(users[0].email.toLowerCase())) continue;
    if (await hasPaid(w.id)) continue;
    list.push({ ws: w.id, email: users[0].email, name: users[0].name });
  }
  return list;
}

export async function enviarRecordatorios(horas = 20): Promise<{ enviados: number; regalos: number }> {
  let enviados = 0, regalos = 0;
  for (const p of await pendientes(horas)) {
    const g = await darRegalo(p.ws, p.email).catch(() => null);
    if (g?.ok) regalos++;
    await writePrivateJSON(mark(p.ws), { at: new Date().toISOString() });
    if (await sendEmail(regaloReminderEmail(p.email, p.name, unsubLink(SITE, p.email)))) enviados++;
  }
  return { enviados, regalos };
}
