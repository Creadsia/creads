import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { readPrivateJSON, sbRest } from "@/lib/supabase";
import { fetchableUrl } from "@/lib/media";
import { balanceOf, unlimited, usdPerCredit } from "@/lib/credits";
import { secondsOf } from "@/lib/credit-math";
import { listApiKeys } from "@/lib/auth";
import { bucketLimit, type Bucket } from "@/lib/rate";
import { recentErrors } from "@/lib/errlog";
import { DEFAULT_FINANZAS, type Finanzas } from "@/lib/finance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET ?ws=<workspace> (owner only): everything a customer did, to help them (owner, 24 Oct 2026: «¿cómo sé qué
// generó o si tuvo problemas?»; 17 Nov 2026: «control total de lo que hace cada usuario, errores, generaciones,
// topes de uso»). The account (plan, balance, people, connectors), the limits that apply to it right now, every
// paid generation with what it cost and whether it was refunded, failed cuts, the technical errors logged for the
// account, and its latest images, ads and credit movements. Media links are signed for an hour.

type Clip = { id: string; ad_id: string | null; kind: string | null; model: string | null; status: string; url: string | null; error: string | null; prompt: string | null; text: string | null; created_at: string };
type Move = { id: number; delta: number; kind: string; note: string | null; ref: string | null; usd: number | string | null; created_at: string };

// the per-person limits worth watching (connector, generations, AI help), as [bucket, what it means]
const WATCH: [Bucket, string][] = [
  ["gen", "Generaciones pagadas"],
  ["heavy", "Ediciones y clonar voz"],
  ["ai", "Llamadas a la IA (guiones, revisión)"],
  ["mcp", "API y conector (Claude/ChatGPT)"],
  ["assist", "Mensajes al asistente"],
  ["assistDay", "Mensajes al asistente (día)"],
  ["spy", "Espiar anuncios"],
  ["spyDay", "Espiar anuncios (día)"],
];
const NEW_HOURS = 48;

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const ws = new URL(req.url).searchParams.get("ws") ?? "";
  if (!/^[\w-]{3,80}$/.test(ws)) return NextResponse.json({ error: "Cuenta inválida." }, { status: 400 });
  const q = <T = Record<string, unknown>>(path: string) => sbRest<T[]>(path).catch(() => [] as T[]);
  const enc = encodeURIComponent(ws);
  const [images, ads, clips, moves, wsRows, people] = await Promise.all([
    q(`images?owner=eq.${enc}&select=prompt,url,model,aspect,created_at&order=created_at.desc&limit=24`),
    q(`ads?owner=eq.${enc}&select=id,title,status,final_url,format,created_at&order=created_at.desc&limit=20`),
    q<Clip>(`clips?owner=eq.${enc}&select=id,ad_id,kind,model,status,url,error,prompt,text,created_at&order=created_at.desc&limit=300`),
    q<Move>(`credits?owner=eq.${enc}&select=id,delta,kind,note,ref,usd,created_at&order=created_at.desc&limit=1000`),
    q<{ name: string; plan: string | null; paid_until: string | null; access: string | null; discount: number | null; notes: string | null; created_at: string }>(`workspaces?id=eq.${enc}&select=name,plan,paid_until,access,discount,notes,created_at&limit=1`),
    q<{ id: string; email: string; name: string | null; role: string; active: boolean; last_login: string | null }>(`users?workspace=eq.${enc}&select=id,email,name,role,active,last_login&order=created_at.asc&limit=20`),
  ]);
  const w = wsRows[0];
  const sign = async (u: unknown) => (typeof u === "string" && u ? await fetchableUrl(u, ws, 3600).catch(() => null) : null);
  const short = (s: unknown, n: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "");
  const num = (v: unknown) => Number(v ?? 0) || 0;

  // every paid generation (one credit charge each) and whether it came back (failed jobs are refunded)
  const refunded = new Set(moves.filter((m) => m.kind === "refund" && m.ref).map((m) => m.ref as string));
  const charges = moves.filter((m) => m.kind === "charge");
  const todas = charges.map((c) => ({ que: short(c.note, 120) || "Generación", creditos: -c.delta, costo: Math.round(num(c.usd) * 1000) / 1000, devuelto: refunded.has(`charge:${c.id}`), cuando: c.created_at }));
  const kept = todas.filter((t) => !t.devuelto);

  // the limits that apply to this account right now
  const rate = await usdPerCredit().catch(() => 0);
  const [balance, keys, rateRows, book, errs] = await Promise.all([
    unlimited(ws) ? Promise.resolve(null) : balanceOf(ws).catch(() => null),
    Promise.all(people.map(async (p) => (await listApiKeys(p.id).catch(() => [])).map((k) => ({ ...k, persona: p.email })))).then((l) => l.flat()),
    people.length
      ? q<{ key: string; window_start: string; hits: number }>(`rate_limits?key=in.(${people.flatMap((p) => WATCH.map(([b]) => `"${b}:${p.id}"`)).join(",")})&select=key,window_start,hits`)
      : Promise.resolve([]),
    readPrivateJSON<Finanzas>("finanzas.json").catch(() => null),
    recentErrors(7).then((l) => l.filter((e) => e.ws === ws).slice(0, 60)).catch(() => []),
  ]);
  const frecuencia = WATCH.map(([b, que]) => {
    const [win, max] = bucketLimit(b);
    const usados = rateRows
      .filter((r) => r.key.startsWith(`${b}:`) && Date.parse(r.window_start) > Date.now() - win * 1000)
      .reduce((s, r) => Math.max(s, r.hits), 0);
    return { que, usados, max, ventana: win >= 86400 ? "por día" : `cada ${Math.round(win / 60)} min` };
  });
  const created = Date.parse(w?.created_at ?? "") || 0;
  const sinLimite = /#sinlimite/i.test(w?.notes ?? "");
  const capNuevas = Number(book?.config?.limiteNuevas ?? DEFAULT_FINANZAS.config.limiteNuevas) || 0;
  const today = new Date().toISOString().slice(0, 10);
  const gastoHoy = charges.filter((c) => c.created_at >= today && !refunded.has(`charge:${c.id}`)).reduce((s, c) => s + num(c.usd), 0);
  const nueva = Boolean(created) && Date.now() - created < NEW_HOURS * 3600_000;

  return NextResponse.json({
    cuenta: w
      ? {
          nombre: w.name, creada: w.created_at, plan: w.plan, pagadoHasta: w.paid_until, acceso: w.access, descuento: w.discount ?? 0, notas: short(w.notes, 300),
          saldo: balance, segundos: balance === null ? null : secondsOf(balance, rate), ilimitada: unlimited(ws),
          personas: people.map((p) => ({ email: p.email, nombre: p.name, rol: p.role, activa: p.active, ultimoIngreso: p.last_login })),
        }
      : null,
    topes: {
      cuentaNueva: { aplica: nueva && !sinLimite && capNuevas > 0, sinLimite, topeUsdDia: capNuevas, gastoHoyUsd: Math.round(gastoHoy * 100) / 100, terminaEl: created ? new Date(created + NEW_HOURS * 3600_000).toISOString() : null },
      frecuencia,
    },
    conectores: keys.map((k) => ({ nombre: k.name, persona: k.persona, creada: k.created_at, vence: k.expires_at, conector: /\(conector\)/i.test(k.name) })),
    resumen: {
      generaciones: todas.length, devueltas: todas.length - kept.length,
      creditosGastados: kept.reduce((s, t) => s + t.creditos, 0),
      costoUsd: Math.round(kept.reduce((s, t) => s + t.costo, 0) * 100) / 100,
      creditosComprados: moves.filter((m) => m.kind === "plan" || m.kind === "topup").reduce((s, m) => s + m.delta, 0),
    },
    todas: todas.slice(0, 300),
    errores: errs.map((e) => ({ area: e.area, mensaje: short(e.message, 300), donde: e.path ?? null, veces: e.n ?? 1, cuando: e.at })),
    imagenes: await Promise.all(images.map(async (i) => ({ url: await sign(i.url), prompt: short(i.prompt, 220), modelo: i.model, creada: i.created_at }))),
    anuncios: await Promise.all(ads.map(async (a) => ({ titulo: short(a.title, 80) || "Sin título", estado: a.status, formato: a.format, video: await sign(a.final_url), creado: a.created_at }))),
    // only what tells a story: failures (with their reason)
    fallas: clips.filter((c) => c.status === "failed" || c.error).slice(0, 40).map((c) => ({ que: c.kind || (c.ad_id ? "corte de anuncio" : "generación"), modelo: c.model, error: short(c.error, 300), texto: short(c.text || c.prompt, 160), cuando: c.created_at })),
    generaciones: todas.length,
    movimientos: moves.slice(0, 60).map((m) => ({ creditos: m.delta, tipo: m.kind, nota: short(m.note, 120), cuando: m.created_at })),
  });
}
