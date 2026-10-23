// Diagnóstico técnico de Meta (owner, 23 Oct 2026: «API access blocked»). READ-ONLY: it never creates,
// edits or pauses anything, and never returns a token (only its last 4 characters). For each call it keeps
// Meta's full error (message, type, code, error_subcode, user title/message, fbtrace_id), so the exact cause
// can be read. Also tries the same read with appsecret_proof, in case the app requires it.

import { createHmac } from "node:crypto";
import { GRAPH_VERSION } from "./meta-graph";
import { metaConn } from "./meta-conexiones";

export interface MetaErr { message?: string; type?: string; code?: number; error_subcode?: number; error_user_title?: string; error_user_msg?: string; fbtrace_id?: string; is_transient?: boolean }
export interface Paso { paso: string; ok: boolean; http?: number; datos?: unknown; error?: MetaErr; nota?: string }

const scrub = (v: unknown, token: string): unknown => JSON.parse(JSON.stringify(v ?? null).split(token).join("…"));

async function call(path: string, token: string, params: Record<string, string> = {}, proof?: string): Promise<{ http: number; body: Record<string, unknown> }> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION()}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  if (proof) url.searchParams.set("appsecret_proof", proof);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    return { http: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { http: 0, body: { error: { message: "Meta no respondió a tiempo." } } };
  }
}

export async function diagnosticoMeta(): Promise<{ resumen: Record<string, unknown>; pasos: Paso[]; causa: string[] }> {
  const c = await metaConn();
  const t = c.adsToken;
  const pasos: Paso[] = [];
  const causa: string[] = [];
  const acct = c.adAccountId ? `act_${c.adAccountId.replace(/^act_/, "")}` : "";
  const resumen: Record<string, unknown> = { version_api: GRAPH_VERSION(), token: t ? `…${t.slice(-4)}` : null, cuenta: acct || null, pagina: c.pageId || null, pixel: c.pixelId || null, clave_secreta_app: Boolean(c.appSecret) };
  if (!t) return { resumen, pasos, causa: ["No hay token del usuario del sistema guardado (Marketing → Conexiones)."] };

  const run = async (paso: string, path: string, params: Record<string, string> = {}, proof?: string) => {
    const r = await call(path, t, params, proof);
    const err = (r.body.error ?? undefined) as MetaErr | undefined;
    const p: Paso = { paso, ok: !err && r.http >= 200 && r.http < 300, http: r.http, ...(err ? { error: scrub(err, t) as MetaErr } : { datos: scrub(r.body, t) }) };
    pasos.push(p);
    return p;
  };

  // 1) the token itself: valid?, which app, which type, which permissions and on which assets
  const dbg = await run("1. Token (debug_token)", "debug_token", { input_token: t });
  const d = ((dbg.datos as { data?: Record<string, unknown> } | undefined)?.data ?? {}) as { app_id?: string; application?: string; type?: string; is_valid?: boolean; scopes?: string[]; granular_scopes?: { scope: string; target_ids?: string[] }[]; expires_at?: number; data_access_expires_at?: number; error?: { message?: string; code?: number; subcode?: number } };
  if (dbg.datos) {
    // the token debugging itself returns no secret; keep only what matters
    dbg.datos = { valido: d.is_valid, app_id: d.app_id, app: d.application, tipo: d.type, permisos: d.scopes, permisos_por_activo: d.granular_scopes, vence: d.expires_at ? new Date(d.expires_at * 1000).toISOString() : "nunca", acceso_a_datos_vence: d.data_access_expires_at ? new Date(d.data_access_expires_at * 1000).toISOString() : null, error_del_token: d.error };
    if (d.is_valid === false) causa.push(`El token no es válido${d.error?.message ? `: ${d.error.message}` : ""}. Genera uno nuevo.`);
    const scopes = new Set(d.scopes ?? []);
    for (const s of ["ads_read", "ads_management", "business_management"]) if (!scopes.has(s)) causa.push(`Al token le falta el permiso «${s}».`);
    const ads = (d.granular_scopes ?? []).find((g) => g.scope === "ads_read" || g.scope === "ads_management");
    if (acct && ads?.target_ids && !ads.target_ids.includes(acct.replace(/^act_/, ""))) causa.push(`El permiso de anuncios del token está limitado a otras cuentas (${ads.target_ids.join(", ")}), no a ${acct}. Asigna la cuenta publicitaria al usuario del sistema y genera un token nuevo.`);
  }

  // 2) who the token is
  await run("2. Quién es el token (/me)", "me", { fields: "id,name" });
  // 3) the app (restricted? in development?)
  if (d.app_id) await run("3. La app (estado)", d.app_id, { fields: "id,name,link,restrictions" });
  // 4) the ad account: readable?, status and why
  if (acct) {
    const a = await run("4. Cuenta publicitaria", acct, { fields: "id,name,account_status,disable_reason,currency,timezone_name,business{id,name}" });
    const st = (a.datos as { account_status?: number; disable_reason?: number } | undefined);
    if (st?.account_status && st.account_status !== 1) causa.push(`La cuenta publicitaria no está activa (account_status ${st.account_status}, disable_reason ${st.disable_reason ?? "?"}).`);
    // 5) the exact call that fails in the dashboard: insights
    const ins = await run("5. Insights (lo que usa el tablero)", `${acct}/insights`, { fields: "spend,clicks,impressions", date_preset: "today" });
    await run("6. Campañas (solo lectura)", `${acct}/campaigns`, { fields: "id,name,effective_status", limit: "3" });
    // 7) same read with appsecret_proof, if the app secret is saved
    if (c.appSecret) {
      const proof = createHmac("sha256", c.appSecret).update(t).digest("hex");
      const withProof = await run("7. Insights con appsecret_proof", `${acct}/insights`, { fields: "spend", date_preset: "today" }, proof);
      if (!ins.ok && withProof.ok) causa.push("La app exige «appsecret_proof» (Configuración avanzada → Requerir clave secreta de la app). Creads ahora puede enviarlo.");
    }
    const e = ins.error;
    if (e) {
      const m = `${e.message ?? ""} ${e.error_user_msg ?? ""}`.toLowerCase();
      if (/api access blocked/.test(m)) causa.push(`Meta bloqueó el acceso de la APP «${d.application ?? d.app_id ?? "?"}» a la API (código ${e.code}${e.error_subcode ? `, subcódigo ${e.error_subcode}` : ""}). Pasa por: app restringida o desactivada por Meta, app en modo desarrollo sin acceso a esta cuenta, o el negocio/usuario que creó la app con restricciones. Revisa developers.facebook.com → tu app → avisos y «Estado de la app», y Business → Calidad de la cuenta.`);
      else if (e.code === 190) causa.push("Meta rechaza el token (vencido o revocado): genera uno nuevo.");
      else if (e.code === 10 || e.code === 200) causa.push(`Falta un permiso (código ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ""}): ${e.message}`);
    }
  } else causa.push("Falta el ID de la cuenta publicitaria.");
  if (!causa.length) causa.push(pasos.every((p) => p.ok) ? "Todo responde bien: el tablero debería mostrar los datos de Meta." : "Mira el paso que falla y su código.");
  return { resumen, pasos, causa };
}
