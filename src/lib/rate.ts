import { NextResponse } from "next/server";
import { SbError, sbRpc } from "./supabase";

// Limits how often anyone can try something (sign in, generate, ask Claude), counted in the database
// so it holds across every server instance. If the counter can't be reached, requests go through
// (and the error is logged): the credits and the daily limit still protect the money.

const BUCKETS = {
  loginEmail: [15 * 60, 8], // tries per account from one connection in 15 min
  loginAccount: [15 * 60, 40], // tries per account from anywhere (slows a distributed guess, can't lock the owner out alone)
  loginIp: [15 * 60, 30], // tries per connection in 15 min
  recover: [60 * 60, 5], // owner recovery / first setup per hour
  twoFactor: [15 * 60, 10],
  ai: [10 * 60, 40], // Claude calls (cuts, scenes, fixes, review) per person in 10 min
  gen: [10 * 60, 60], // paid generations per person in 10 min
  heavy: [10 * 60, 15], // montage and voice cloning per person in 10 min
  upload: [10 * 60, 120],
  signup: [60 * 60, 5], // new accounts per connection per hour
  recoverAll: [60 * 60, 15], // owner recovery attempts from anywhere
  forgotIp: [60 * 60, 6], // "forgot my password" emails asked from one connection per hour
  forgotEmail: [60 * 60, 3], // ... and to one address per hour
  forgotAll: [60 * 60, 200], // ... and in total (keeps the email account from being used for spam)
  resetIp: [60 * 60, 20], // new-password attempts with an emailed link
} as const;
export type Bucket = keyof typeof BUCKETS;

/** True while `key` stays within its bucket's limit (counts this attempt). */
// Guarding passwords, codes and new accounts matters more than convenience: if the counter is down,
// those are refused; everything else goes through (credits and the daily cap still protect the money).
const STRICT: Bucket[] = ["loginEmail", "loginAccount", "loginIp", "twoFactor", "recover", "recoverAll", "signup", "forgotIp", "forgotEmail", "forgotAll", "resetIp"];

export async function allow(bucket: Bucket, key: string): Promise<boolean> {
  const [win, max] = BUCKETS[bucket];
  try {
    return Boolean(await sbRpc<boolean>("hit_rate", { p_key: `${bucket}:${key}`.slice(0, 200), p_window: win, p_max: max }));
  } catch (err) {
    // the counter isn't installed yet (supabase/billing.sql not run): never lock everyone out
    if (err instanceof SbError && err.missing) {
      console.error("rate limit NOT INSTALLED: run supabase/billing.sql", bucket);
      return true;
    }
    console.error("rate limit unavailable", bucket, err instanceof Error ? err.message : err);
    return !STRICT.includes(bucket);
  }
}

/** The caller's IP as Vercel reports it. */
export function clientIp(req: Request) {
  return (req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").trim().slice(0, 64);
}

const MSG: Record<Bucket, string> = {
  loginEmail: "Demasiados intentos. Espera 15 minutos y vuelve a probar.",
  loginAccount: "Demasiados intentos para esta cuenta. Espera 15 minutos y vuelve a probar.",
  recoverAll: "Demasiados intentos. Espera una hora.",
  loginIp: "Demasiados intentos. Espera 15 minutos y vuelve a probar.",
  recover: "Demasiados intentos. Espera una hora.",
  twoFactor: "Demasiados códigos equivocados. Espera 15 minutos.",
  ai: "Vas muy rápido: espera unos minutos y sigue.",
  gen: "Vas muy rápido: espera unos minutos y sigue.",
  heavy: "Vas muy rápido: espera unos minutos y sigue.",
  upload: "Demasiadas subidas seguidas: espera unos minutos.",
  signup: "Ya se crearon varias cuentas desde esta conexión. Espera una hora o escríbenos a hola@creadsia.com.",
  forgotIp: "Ya pediste varios enlaces. Revisa tu correo (también spam) o espera una hora.",
  forgotEmail: "Ya te enviamos un enlace a ese correo. Revisa también la carpeta de spam, o espera una hora para pedir otro.",
  forgotAll: "No podemos enviar más correos por ahora. Escríbenos a hola@creadsia.com.",
  resetIp: "Demasiados intentos. Espera una hora.",
};

/** A 429 response when over the limit, otherwise null. */
export async function tooMany(bucket: Bucket, key: string): Promise<NextResponse | null> {
  return (await allow(bucket, key)) ? null : NextResponse.json({ error: MSG[bucket] }, { status: 429 });
}
