import { createHmac, timingSafeEqual } from "node:crypto";
import { readPrivateJSON, writePrivateJSON } from "./supabase";

// "No more tips" for the activation emails: a signed link per address (nothing to guess), and the list
// of addresses that opted out. Account emails (payments, password, plan ending) are always sent.

const FILE = "bajas.json";

function key() {
  const base = process.env.RESET_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createHmac("sha256", "creads-unsub-v1").update(base).digest();
}
const sign = (email: string) => createHmac("sha256", key()).update(email.trim().toLowerCase()).digest("base64url").slice(0, 32);

export function unsubLink(site: string, email: string) {
  return `${site}/api/correos/baja?e=${encodeURIComponent(email)}&t=${sign(email)}`;
}

export function unsubOk(email: string, token: string) {
  const a = Buffer.from(sign(email)), b = Buffer.from(String(token));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function optedOut(): Promise<Set<string>> {
  return new Set(((await readPrivateJSON<string[]>(FILE).catch(() => null)) ?? []).map((e) => e.toLowerCase()));
}

export async function optOut(email: string) {
  const set = await optedOut();
  set.add(email.trim().toLowerCase());
  await writePrivateJSON(FILE, [...set]);
}
