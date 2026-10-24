import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { sbRest } from "@/lib/supabase";
import { fetchableUrl } from "@/lib/media";

export const dynamic = "force-dynamic";

// GET ?ws=<workspace> (owner only): what a customer did, to help them (owner, 24 Oct 2026: «¿cómo sé qué
// generó o si tuvo problemas?»). Their latest images, ads, cuts (with the error when one failed) and
// credit movements. Media links are signed for an hour.

type Clip = { id: string; ad_id: string | null; kind: string | null; model: string | null; status: string; url: string | null; error: string | null; prompt: string | null; text: string | null; created_at: string };

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const ws = new URL(req.url).searchParams.get("ws") ?? "";
  if (!/^[\w-]{3,80}$/.test(ws)) return NextResponse.json({ error: "Cuenta inválida." }, { status: 400 });
  const q = (path: string) => sbRest<Record<string, unknown>[]>(path).catch(() => []);
  const enc = encodeURIComponent(ws);
  const [images, ads, clips, moves] = await Promise.all([
    q(`images?owner=eq.${enc}&select=prompt,url,model,aspect,created_at&order=created_at.desc&limit=12`),
    q(`ads?owner=eq.${enc}&select=id,title,status,final_url,format,created_at&order=created_at.desc&limit=10`),
    q(`clips?owner=eq.${enc}&select=id,ad_id,kind,model,status,url,error,prompt,text,created_at&order=created_at.desc&limit=40`),
    q(`credits?owner=eq.${enc}&select=delta,kind,note,created_at&order=created_at.desc&limit=40`),
  ]);
  const sign = async (u: unknown) => (typeof u === "string" && u ? await fetchableUrl(u, ws, 3600).catch(() => null) : null);
  const short = (s: unknown, n: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "");
  return NextResponse.json({
    imagenes: await Promise.all(images.map(async (i) => ({ url: await sign(i.url), prompt: short(i.prompt, 220), modelo: i.model, creada: i.created_at }))),
    anuncios: await Promise.all(ads.map(async (a) => ({ titulo: short(a.title, 80) || "Sin título", estado: a.status, formato: a.format, video: await sign(a.final_url), creado: a.created_at }))),
    // only what tells a story: failures (with their reason) and finished cuts outside an ad (tools, images)
    fallas: (clips as Clip[]).filter((c) => c.status === "failed" || c.error).slice(0, 15).map((c) => ({ que: c.kind || (c.ad_id ? "corte de anuncio" : "generación"), modelo: c.model, error: short(c.error, 300), texto: short(c.text || c.prompt, 160), cuando: c.created_at })),
    generaciones: (clips as Clip[]).length,
    movimientos: moves.map((m) => ({ creditos: m.delta, tipo: m.kind, nota: short(m.note, 120), cuando: m.created_at })),
  });
}
