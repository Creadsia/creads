import { sbRest, readPrivateJSON, writePrivateJSON } from "./supabase";
import { balanceOf, grant } from "./credits";

// Credits last for the period that was paid (a month, or a year on the annual plan): what isn't used
// by the end of the period expires, like on every platform. Three moments:
//  - the period ends without a renewal → the daily job takes the balance to 0;
//  - the customer renews AFTER the period ended → the old balance expires before the new credits;
//  - the customer renews EARLY → the old balance is remembered and, when the old period ends, the
//    part of it they didn't use expires (old credits are used first).

const FILE = "vencimientos.json";
interface Pending { ws: string; at: string; amount: number; since: string }

const today = () => new Date().toISOString().slice(0, 10);

async function workspace(ws: string) {
  const rows = await sbRest<{ paid_until: string | null }[]>(`workspaces?id=eq.${encodeURIComponent(ws)}&select=paid_until&limit=1`);
  return rows[0] ?? null;
}

async function expire(ws: string, credits: number, note: string) {
  const n = Math.min(Math.floor(credits), await balanceOf(ws));
  if (n > 0) await grant(ws, -n, "adjust", note, "sistema");
  return Math.max(0, n);
}

/** Call right before a plan payment gives new credits (and moves the paid-until date). */
export async function beforeNewPeriod(ws: string) {
  if (ws === "main") return;
  const w = await workspace(ws);
  if (!w?.paid_until) return;
  const balance = await balanceOf(ws);
  if (balance <= 0) return;
  if (w.paid_until < today()) {
    await expire(ws, balance, "Vencieron los créditos del período anterior");
    return;
  }
  const list = (await readPrivateJSON<Pending[]>(FILE).catch(() => null)) ?? [];
  list.push({ ws, at: w.paid_until, amount: balance, since: new Date().toISOString() });
  await writePrivateJSON(FILE, list);
}

/** Credits used (net of refunds) since a moment. */
async function usedSince(ws: string, since: string) {
  const rows = await sbRest<{ delta: number }[]>(`credits?owner=eq.${encodeURIComponent(ws)}&kind=in.(charge,refund)&created_at=gte.${encodeURIComponent(since)}&select=delta&limit=100000`);
  return Math.max(0, -rows.reduce((s, r) => s + Number(r.delta || 0), 0));
}

/** The daily job: expires what's due. Returns how many credits expired in total. */
export async function runExpiry(): Promise<{ expired: number; accounts: number }> {
  let expired = 0, accounts = 0;
  const day = today();
  // early renewals whose old period is over
  const list = (await readPrivateJSON<Pending[]>(FILE).catch(() => null)) ?? [];
  const keep: Pending[] = [];
  for (const p of list) {
    if (p.at >= day) { keep.push(p); continue; }
    try {
      const left = Math.max(0, p.amount - (await usedSince(p.ws, p.since)));
      const n = left > 0 ? await expire(p.ws, left, "Vencieron los créditos que no usaste del período anterior") : 0;
      if (n) { expired += n; accounts++; }
    } catch (err) {
      console.error("expiry (renewal)", p.ws, err instanceof Error ? err.message : err);
      keep.push(p); // try again tomorrow
    }
  }
  if (keep.length !== list.length) await writePrivateJSON(FILE, keep);
  // periods that ended without a renewal
  const ended = await sbRest<{ id: string }[]>(`workspaces?paid_until=lt.${day}&id=neq.main&select=id&limit=10000`);
  for (const w of ended) {
    try {
      const b = await balanceOf(w.id);
      const n = b > 0 ? await expire(w.id, b, "Vencieron los créditos: terminó el período de tu plan") : 0;
      if (n) { expired += n; accounts++; }
    } catch (err) {
      console.error("expiry (ended)", w.id, err instanceof Error ? err.message : err);
    }
  }
  return { expired, accounts };
}
