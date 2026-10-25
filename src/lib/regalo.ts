import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { AlreadyDone, grant } from "./credits";
import { readPrivateJSON, sbRest, writePrivateJSON } from "./supabase";

// «Tu primer anuncio de regalo» (owner, 23 Oct 2026, launch audit): a new account confirms its email and gets
// enough credits for one short ad (~12 s), once per account, with a
// monthly ceiling for everyone together so the gift can never run up the bill. Cost: US$2.5 to 3.9 per gift.

export const REGALO_CREDITS = 200; // two cuts of up to 8 s (the first gift, 150, ran out after one cut)
/** Gifts per calendar month for everyone (owner can change it with REGALO_TOPE in Vercel). */
export const regaloTope = () => Math.max(0, Math.min(1000, Number(process.env.REGALO_TOPE ?? 50) || 0));

const secret = () => createHash("sha256").update(`creads-regalo:${process.env.RESET_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ""}`).digest();
export const regaloSign = (userId: string) => createHmac("sha256", secret()).update(`regalo\n${userId}`).digest("base64url").slice(0, 32);
export function regaloCheck(userId: string, sig: string) {
  const want = regaloSign(userId);
  return typeof sig === "string" && sig.length === want.length && timingSafeEqual(Buffer.from(sig), Buffer.from(want));
}

// throwaway inboxes (the most common ones): no gift for them
const DISPOSABLE = /@(mailinator|guerrillamail|10minutemail|tempmail|temp-mail|yopmail|trashmail|sharklasers|getnada|maildrop|dispostable|throwawaymail|fakeinbox|mintemail|mohmal|emailondeck|moakt|tempr|discard)\./i;
export const regaloEmailOk = (email: string) => !DISPOSABLE.test(email);

const month = (d = new Date()) => d.toISOString().slice(0, 7);
const countFile = (m = month()) => `regalo/mes-${m}.json`;

export async function regalosDelMes(m = month()) {
  return (await readPrivateJSON<{ n: number }>(countFile(m)).catch(() => null))?.n ?? 0;
}

/** Has this workspace ever paid (a plan or a top-up)? Accounts that never paid get the «Hecho con Creads IA» mark. */
export async function hasPaid(ws: string) {
  const rows = await sbRest<{ id: number }[]>(`credits?owner=eq.${encodeURIComponent(ws)}&kind=in.(plan,topup)&select=id&limit=1`).catch(() => null);
  return Boolean(rows?.length);
}

/** «Prueba con tarjeta» (owner, 25 Oct 2026): the gift only after the customer adds a card on Mercado Pago (a
 *  7-day trial that becomes the Básico plan unless cancelled). Off with REGALO_CON_TARJETA=0 in Vercel. */
// On by default since 25 Oct 2026 (owner: «déjalo listo»); REGALO_CON_TARJETA=0 in Vercel turns it off.
export const tarjetaObligatoria = () => process.env.REGALO_CON_TARJETA !== "0";
export const PRUEBA_DIAS = 7;

export type RegaloResult = { ok: true } | { ok: false; why: "ya" | "tope" | "correo" | "pagado" | "tarjeta" };

/** Gives the gift once (the credit ledger's unique ref makes a second try a no-op). */
export async function darRegalo(ws: string, email: string, o: { conTarjeta?: boolean } = {}): Promise<RegaloResult> {
  if (tarjetaObligatoria() && !o.conTarjeta) return { ok: false, why: "tarjeta" };
  if (!regaloEmailOk(email)) return { ok: false, why: "correo" };
  if (await hasPaid(ws)) return { ok: false, why: "pagado" };
  const n = await regalosDelMes();
  if (n >= regaloTope()) return { ok: false, why: "tope" };
  // once per account: a marker file first (so two clicks at once can't both pass), then the ledger
  const mark = `regalo/ws-${ws.replace(/[^\w-]/g, "_")}.json`;
  if (await readPrivateJSON(mark).catch(() => null)) return { ok: false, why: "ya" };
  const given = await sbRest<{ id: number }[]>(`credits?owner=eq.${encodeURIComponent(ws)}&ref=eq.${encodeURIComponent(`regalo:${ws}`)}&select=id&limit=1`).catch(() => []);
  if (given.length) return { ok: false, why: "ya" };
  await writePrivateJSON(mark, { at: new Date().toISOString(), email });
  try {
    await grant(ws, REGALO_CREDITS, "adjust", o.conTarjeta ? "Prueba gratis (tarjeta agregada)" : "Anuncio de regalo (correo confirmado)", "regalo", `regalo:${ws}`);
  } catch (err) {
    if (err instanceof AlreadyDone) return { ok: false, why: "ya" };
    throw err;
  }
  await writePrivateJSON(countFile(), { n: n + 1 }).catch(() => null);
  return { ok: true };
}
