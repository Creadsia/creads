// «Que suene el celular cuando cae una venta» (owner, 22 Oct 2026): a push notification through ntfy.sh, a
// free app (Android/iPhone). The owner turns it on in Panel → Estadísticas; Creads makes a random, private
// channel name and keeps it in private storage (the code is public, so it never lives here). Only the plan and
// the amount travel; never the customer's email.

import { randomBytes } from "node:crypto";
import { readPrivateJSON, writePrivateJSON } from "./supabase";

const FILE = "avisos-celular.json";
interface Cfg { topic: string | null; on: boolean }
const TOPIC = /^creads-[a-f0-9]{16,40}$/;

export async function phoneCfg(): Promise<Cfg> {
  const c = await readPrivateJSON<Cfg>(FILE).catch(() => null);
  return { topic: c?.topic && TOPIC.test(c.topic) ? c.topic : null, on: Boolean(c?.on && c?.topic) };
}
export async function setPhone(on: boolean, renew = false): Promise<Cfg> {
  const cur = await phoneCfg();
  const topic = !cur.topic || renew ? `creads-${randomBytes(12).toString("hex")}` : cur.topic;
  const next = { topic, on };
  await writePrivateJSON(FILE, next);
  return next;
}

/** Sends one alert to the owner's phone (never throws). `force` sends even when switched off (the test). */
export async function phoneAlert(o: { title: string; text: string; tags?: string; priority?: number }, force = false): Promise<boolean> {
  try {
    const c = await phoneCfg();
    if (!c.topic || (!c.on && !force)) return false;
    // JSON publishing keeps accents and emojis intact (ntfy.sh/docs/publish/#publish-as-json)
    const res = await fetch("https://ntfy.sh/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: c.topic, title: o.title, message: o.text, tags: (o.tags ?? "moneybag").split(","), priority: o.priority ?? 4, click: "https://www.creadsia.com/admin" }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch (e) {
    console.error("phone alert", e instanceof Error ? e.message : e);
    return false;
  }
}
