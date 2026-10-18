import { whatsappMode } from "@/lib/whatsapp";
import { readPrivateJSON, sbRest, sbRpc, writePrivateJSON } from "@/lib/supabase";
import { providerStatus } from "@/lib/providers";
import { observedDollar, usdClpRate } from "@/lib/usd-clp";
import { metaAds } from "@/lib/meta-graph";


// The launch checklist (owner only): checks by itself everything that can be checked from the server
// (keys present, database installed, Mercado Pago key valid) and never returns any key.

type State = "ok" | "falta" | "revisar";
export interface Check { id: string; state: State; detail: string }

const env = (k: string) => (process.env[k] ?? "").trim();

async function exists(path: string) {
  try { await sbRest(path); return true; } catch { return false; }
}

async function billingInstalled(): Promise<Check> {
  const tables = await Promise.all(["credits", "orders", "payments", "rate_limits"].map((t) => exists(`${t}?select=*&limit=0`)));
  let fn = true;
  try { await sbRpc("hit_rate", { p_key: "check:lanzamiento", p_window: 60, p_max: 1000 }); } catch { fn = false; }
  const ok = tables.every(Boolean) && fn;
  return { id: "billing", state: ok ? "ok" : "falta", detail: ok ? "Tablas de créditos, pedidos y pagos instaladas." : "Falta ejecutar supabase/billing.sql en Supabase → SQL Editor." };
}

async function mercadoPago(): Promise<Check[]> {
  const token = env("MP_ACCESS_TOKEN");
  const out: Check[] = [];
  if (!token) out.push({ id: "mp-token", state: "falta", detail: "Falta MP_ACCESS_TOKEN en Vercel." });
  else {
    try {
      const r = await fetch("https://api.mercadopago.com/users/me", { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
      const me = r.ok ? ((await r.json()) as { site_id?: string; nickname?: string }) : null;
      const test = token.startsWith("TEST-");
      if (!me) out.push({ id: "mp-token", state: "falta", detail: "Mercado Pago rechazó la clave: revisa que copiaste el Access Token completo." });
      else if (me.site_id !== "MLC") out.push({ id: "mp-token", state: "revisar", detail: `La cuenta de Mercado Pago no es de Chile (${me.site_id}).` });
      else out.push({ id: "mp-token", state: test ? "revisar" : "ok", detail: test ? "Clave de PRUEBA: los pagos no son reales. Para vender usa la de producción (APP_USR-)." : `Conectado a la cuenta ${me.nickname ?? ""} (Chile).` });
    } catch {
      out.push({ id: "mp-token", state: "revisar", detail: "No se pudo comprobar la clave ahora (Mercado Pago no respondió). Prueba en un rato." });
    }
  }
  out.push(env("MP_WEBHOOK_SECRET") ? { id: "mp-webhook", state: "ok", detail: "Clave de los avisos de pago cargada." } : { id: "mp-webhook", state: "falta", detail: "Falta MP_WEBHOOK_SECRET (Mercado Pago → tu aplicación → Webhooks)." });
  out.push({ id: "mp-once", state: "ok", detail: env("MP_ONE_TIME") === "1" ? "Planes se cobran una vez por mes (sin renovación automática)." : "Planes con renovación automática mensual." });
  return out;
}

/** Everything the server can check by itself (never returns a key). */
export async function launchChecks(): Promise<Check[]> {
  const p = providerStatus();
  const any = (o: Record<string, boolean>) => Object.values(o).some(Boolean);
  const admin = env("ADMIN_ACCESS_CODE");
  const checks: Check[] = [
    p.database ? await billingInstalled() : { id: "billing", state: "falta", detail: "Faltan las claves de Supabase en Vercel." },
    p.database && (await exists("site_stats?select=day&limit=0"))
      ? { id: "stats", state: "ok", detail: "Las visitas se están contando." }
      : { id: "stats", state: "falta", detail: "Falta ejecutar supabase/stats.sql en Supabase → SQL Editor." },
    metaAds()
      ? { id: "meta-ads", state: "ok", detail: "Cuenta publicitaria de Meta conectada al estudio de marketing." }
      : { id: "meta-ads", state: "revisar", detail: "El estudio de marketing trabaja en modo ensayo hasta conectar Meta (Panel → Marketing)." },
    ...(await mercadoPago()),
    env("META_CAPI_TOKEN") ? { id: "meta", state: "ok", detail: "Conversiones de Meta conectadas." } : { id: "meta", state: "falta", detail: "Falta META_CAPI_TOKEN (Meta → Administrador de eventos → tu píxel → Configuración)." },
    admin.length >= 24 ? { id: "admin", state: "ok", detail: "Clave de administrador larga." } : { id: "admin", state: admin ? "revisar" : "falta", detail: admin ? `Es corta (${admin.length} caracteres): usa 24 o más.` : "Falta ADMIN_ACCESS_CODE." },
    env("RESEND_API_KEY") ? { id: "email", state: "ok", detail: "Correos automáticos activos." } : { id: "email", state: "falta", detail: "Falta RESEND_API_KEY." },
    env("CRON_SECRET").length >= 16 ? { id: "cron", state: "ok", detail: "Avisos diarios de vencimiento activos." } : { id: "cron", state: "falta", detail: "Falta CRON_SECRET (16 caracteres o más)." },
    await (async (): Promise<Check> => {
      const obs = await observedDollar().catch(() => null);
      const rate = await usdClpRate().catch(() => 0);
      return obs
        ? { id: "dolar", state: "ok", detail: `Dólar observado del ${obs.fecha}: $${Math.round(obs.valor).toLocaleString("es-CL")}. Para cobrar en pesos se usa $${rate.toLocaleString("es-CL")} (con el colchón de cambio). Se actualiza solo cada día.` }
        : { id: "dolar", state: "revisar", detail: `No se pudo leer el dólar del día; se usa el de respaldo del Panel ($${rate.toLocaleString("es-CL")}).` };
    })(),
    { id: "ai", state: p.claude && any(p.video) && any(p.image) && any(p.voice) ? "ok" : "falta", detail: [!p.claude && "Claude", !any(p.video) && "video", !any(p.image) && "imagen", !any(p.voice) && "voz"].filter(Boolean).join(", ") ? `Falta conectar: ${[!p.claude && "Claude", !any(p.video) && "video", !any(p.image) && "imagen", !any(p.voice) && "voz"].filter(Boolean).join(", ")}.` : "Claude, video, imagen y voz conectados." },
  ];
  // the Guardián (checks every few minutes) and WhatsApp alerts: recommended, they don't block the launch
  checks.push((env("GUARDIAN_TOKEN").length >= 24
    ? { id: "guardian", state: "ok", detail: "El Guardián tiene su clave. Falta solo que el monitor externo lo llame cada 5 minutos (Plataforma → Guardián)." }
    : { id: "guardian", state: "revisar", detail: "Falta GUARDIAN_TOKEN en Vercel para que el Guardián revise cada pocos minutos." }) as Check);
  checks.push((whatsappMode() ? { id: "whatsapp", state: "ok", detail: `Las alertas críticas también te llegan por ${whatsappMode() === "telegram" ? "Telegram" : "WhatsApp"}.` } : { id: "whatsapp", state: "revisar", detail: "Alertas al celular sin conectar (opcional, recomendado)." }) as Check);
  return checks;
}

const DONE = "lanzamiento-hecho.json";
/** What the owner ticked by hand in Lanzamiento (saved on the server, so the office can read it). */
export async function launchDone(): Promise<Record<string, boolean>> {
  const d = await readPrivateJSON<Record<string, boolean>>(DONE).catch(() => null);
  return d && typeof d === "object" ? d : {};
}
export const saveLaunchDone = (d: Record<string, boolean>) =>
  writePrivateJSON(DONE, Object.fromEntries(Object.entries(d).filter(([k, v]) => /^[a-z0-9-]{1,40}$/.test(k) && v === true).slice(0, 200)));
