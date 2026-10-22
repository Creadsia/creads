import { readPrivateJSON, sbRest, updatePrivateJSON, writePrivateJSON } from "./supabase";
import { refundedJobs } from "./credits";
import { findTool } from "./tools";
import { careEmail } from "./emails";
import { emailConfigured, sendEmail } from "./providers/email";

// «Cuidado del cliente»: when a customer's generation fails (and its credits came back), Creads writes to
// them first: one grouped email, at most every 6 hours per account, and the case lands in the owner's list
// «Clientes a contactar» (Panel → Clientes) with a way to reach them. Runs on the Guardián's 5-minute ping.

export interface Caso {
  id: string; ws: string; email: string; name: string | null; items: { what: string; href: string }[];
  at: string; estado: "pendiente" | "contactado"; motivo: "falla" | "ayuda"; nota?: string; mailed?: boolean;
}
interface State { seen: Record<string, string>; lastMail: Record<string, string>; ranAt?: string }

const STATE = "cuidado/estado.json";
const CASOS = "cuidado/casos.json";
const WINDOW_H = 6;
const WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP ?? "").replace(/\D/g, "");

/** What failed, in the customer's words, and where to try again (same wording as the studio's notices). */
export function describe(r: { kind: string | null; ad_id: string | null }): { what: string; href: string } {
  const kind = String(r.kind ?? "");
  const tool = kind.startsWith("tool:") ? findTool(kind.slice(5)) : null;
  if (r.ad_id && kind.startsWith("shot")) return { what: "una toma de tu historia animada", href: `/app/historias?id=${r.ad_id}` };
  if (r.ad_id) return { what: "una escena de tu anuncio", href: `/app/videos/${r.ad_id}` };
  if (tool) return { what: `«${tool.name}»`, href: `/app/herramientas/${tool.id}` };
  if (kind === "gen:image") return { what: "una imagen", href: "/app/laboratorio" };
  return { what: "un video", href: "/app/laboratorio" };
}

export const casos = async () => (await readPrivateJSON<Caso[]>(CASOS).catch(() => null)) ?? [];
export async function guardarCaso(c: Caso) {
  const cut = Date.now() - 30 * 86400_000;
  await updatePrivateJSON<Caso[]>(CASOS, (cur) => [c, ...(cur ?? []).filter((x) => x.id !== c.id)].filter((x) => Date.parse(x.at) >= cut).slice(0, 400));
}
export async function marcarCaso(id: string, estado: Caso["estado"], nota?: string) {
  const list = await casos();
  const c = list.find((x) => x.id === id);
  if (!c) return false;
  c.estado = estado;
  if (nota !== undefined) c.nota = nota.slice(0, 300);
  await writePrivateJSON(CASOS, list);
  return true;
}

/** Who to write to in an account: its owner, else its first active person. */
export async function contactoDe(ws: string): Promise<{ email: string; name: string | null } | null> {
  const people = await sbRest<{ email: string; name: string | null; role: string; active: boolean }[]>(`users?workspace=eq.${encodeURIComponent(ws)}&active=eq.true&select=email,name,role,active&order=created_at.asc&limit=20`).catch(() => []);
  const p = people.find((x) => x.role === "owner") ?? people[0];
  return p ? { email: p.email, name: p.name } : null;
}

/** One round: new failed (and refunded) jobs → grouped emails + cases for the owner. */
export async function careSweep(now = Date.now()): Promise<{ cuentas: number; correos: number }> {
  const st = (await readPrivateJSON<State>(STATE).catch(() => null)) ?? { seen: {}, lastMail: {} };
  if (st.ranAt && now - Date.parse(st.ranAt) < 4 * 60_000) return { cuentas: 0, correos: 0 };
  st.ranAt = new Date(now).toISOString();
  const since = new Date(now - 3 * 3600_000).toISOString();
  const rows = await sbRest<{ id: string; owner: string; kind: string | null; ad_id: string | null; created_at: string }[]>(`clips?status=eq.failed&created_at=gte.${since}&select=id,owner,kind,ad_id,created_at&order=created_at.asc&limit=500`).catch(() => []);
  const fresh = rows.filter((r) => r.owner && r.owner !== "main" && !st.seen[r.id]);
  const byWs = new Map<string, typeof fresh>();
  for (const r of fresh) byWs.set(r.owner, [...(byWs.get(r.owner) ?? []), r]);
  let correos = 0;
  for (const [ws, list] of byWs) {
    const back = await refundedJobs(ws, list.map((r) => r.id)).catch(() => new Set<string>());
    const failed = list.filter((r) => back.has(r.id));
    // jobs whose refund hasn't landed yet are looked at again next round (until they leave the 3-hour window)
    for (const r of failed) st.seen[r.id] = st.ranAt;
    if (!failed.length) continue;
    const who = await contactoDe(ws);
    if (!who) continue;
    const items = [...new Map(failed.map((r) => { const d = describe(r); return [d.what + d.href, d]; })).values()];
    const recent = st.lastMail[ws] && now - Date.parse(st.lastMail[ws]) < WINDOW_H * 3600_000;
    let mailed = false;
    if (!recent && emailConfigured()) {
      mailed = await sendEmail(careEmail(who.email, who.name, { items, whatsapp: WHATSAPP || undefined })).catch(() => false);
      if (mailed) { st.lastMail[ws] = st.ranAt; correos++; }
    }
    await guardarCaso({ id: `falla:${ws}:${failed[0].id}`, ws, email: who.email, name: who.name, items, at: st.ranAt, estado: "pendiente", motivo: "falla", mailed });
  }
  // forget what's older than a week
  const cut = now - 7 * 86400_000;
  for (const [k, v] of Object.entries(st.seen)) if (Date.parse(v) < cut) delete st.seen[k];
  await writePrivateJSON(STATE, st);
  return { cuentas: byWs.size, correos };
}
