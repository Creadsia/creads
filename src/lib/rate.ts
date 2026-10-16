import { NextResponse } from "next/server";
import { sbRpc } from "./supabase";

// Limits how often anyone can try something (sign in, generate, ask Claude), counted in the database
// so it holds across every server instance. If the counter can't be reached, requests go through
// (and the error is logged): the credits and the daily limit still protect the money.

const BUCKETS = {
  loginEmail: [15 * 60, 8], // tries per account in 15 min
  loginIp: [15 * 60, 30], // tries per connection in 15 min
  recover: [60 * 60, 5], // owner recovery / first setup per hour
  twoFactor: [15 * 60, 10],
  ai: [10 * 60, 40], // Claude calls (cuts, scenes, fixes, review) per person in 10 min
  gen: [10 * 60, 60], // paid generations per person in 10 min
  heavy: [10 * 60, 15], // montage and voice cloning per person in 10 min
  upload: [10 * 60, 120],
} as const;
export type Bucket = keyof typeof BUCKETS;

/** True while `key` stays within its bucket's limit (counts this attempt). */
export async function allow(bucket: Bucket, key: string): Promise<boolean> {
  const [win, max] = BUCKETS[bucket];
  try {
    return Boolean(await sbRpc<boolean>("hit_rate", { p_key: `${bucket}:${key}`.slice(0, 200), p_window: win, p_max: max }));
  } catch (err) {
    console.error("rate limit unavailable", bucket, err instanceof Error ? err.message : err);
    return true;
  }
}

/** The caller's IP as Vercel reports it. */
export function clientIp(req: Request) {
  return (req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").trim().slice(0, 64);
}

const MSG: Record<Bucket, string> = {
  loginEmail: "Demasiados intentos. Espera 15 minutos y vuelve a probar.",
  loginIp: "Demasiados intentos. Espera 15 minutos y vuelve a probar.",
  recover: "Demasiados intentos. Espera una hora.",
  twoFactor: "Demasiados códigos equivocados. Espera 15 minutos.",
  ai: "Vas muy rápido: espera unos minutos y sigue.",
  gen: "Vas muy rápido: espera unos minutos y sigue.",
  heavy: "Vas muy rápido: espera unos minutos y sigue.",
  upload: "Demasiadas subidas seguidas: espera unos minutos.",
};

/** A 429 response when over the limit, otherwise null. */
export async function tooMany(bucket: Bucket, key: string): Promise<NextResponse | null> {
  return (await allow(bucket, key)) ? null : NextResponse.json({ error: MSG[bucket] }, { status: 429 });
}
