import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { sbRest, sbRpc } from "@/lib/supabase";
import { providerStatus } from "@/lib/providers";

export const dynamic = "force-dynamic";

// The launch checklist (owner only): checks by itself everything that can be checked from the server
// (keys present, database installed, Mercado Pago key valid) and never returns any key.

type State = "ok" | "falta" | "revisar";
interface Check { id: string; state: State; detail: string }

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

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const p = providerStatus();
  const any = (o: Record<string, boolean>) => Object.values(o).some(Boolean);
  const admin = env("ADMIN_ACCESS_CODE");
  const checks: Check[] = [
    p.database ? await billingInstalled() : { id: "billing", state: "falta", detail: "Faltan las claves de Supabase en Vercel." },
    ...(await mercadoPago()),
    env("META_CAPI_TOKEN") ? { id: "meta", state: "ok", detail: "Conversiones de Meta conectadas." } : { id: "meta", state: "falta", detail: "Falta META_CAPI_TOKEN (Meta → Administrador de eventos → tu píxel → Configuración)." },
    admin.length >= 24 ? { id: "admin", state: "ok", detail: "Clave de administrador larga." } : { id: "admin", state: admin ? "revisar" : "falta", detail: admin ? `Es corta (${admin.length} caracteres): usa 24 o más.` : "Falta ADMIN_ACCESS_CODE." },
    env("RESEND_API_KEY") ? { id: "email", state: "ok", detail: "Correos automáticos activos." } : { id: "email", state: "falta", detail: "Falta RESEND_API_KEY." },
    env("CRON_SECRET").length >= 16 ? { id: "cron", state: "ok", detail: "Avisos diarios de vencimiento activos." } : { id: "cron", state: "falta", detail: "Falta CRON_SECRET (16 caracteres o más)." },
    { id: "ai", state: p.claude && any(p.video) && any(p.image) && any(p.voice) ? "ok" : "falta", detail: [!p.claude && "Claude", !any(p.video) && "video", !any(p.image) && "imagen", !any(p.voice) && "voz"].filter(Boolean).join(", ") ? `Falta conectar: ${[!p.claude && "Claude", !any(p.video) && "video", !any(p.image) && "imagen", !any(p.voice) && "voz"].filter(Boolean).join(", ")}.` : "Claude, video, imagen y voz conectados." },
  ];
  return NextResponse.json({ checks });
}
