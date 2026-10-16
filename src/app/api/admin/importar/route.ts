import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { dbFor } from "@/lib/db";
import { ownsMedia } from "@/lib/media";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

// Brings the WinnerLab prototype's work (scripts, avatars, products, videos with their cuts, finished
// ads, images) into Creadsia's own workspace. Owner only. Safe to run twice: what was already brought
// is skipped (each item carries its WinnerLab id).

type Row = Record<string, unknown>;
interface Export {
  version: number;
  source: string;
  scripts: { key: string; title: string; text: string; lang: string; favorite: boolean; notes: string }[];
  avatars: { key: string; name: string; description: string; image_url: string | null; notes: string }[];
  products: { key: string; name: string; description: string; image_url: string | null; notes: string }[];
  ads: { key: string; title: string; format: string; aspect: string; status: string; final_url: string | null; settings: Row; clips: { idx: number; text: string; prompt: string; model: string; status: string; url: string | null }[] }[];
  images: { key: string; prompt: string; url: string; model: string; aspect: string }[];
}

const tag = (key: string) => `[${key}]`;
const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
// only Creadsia's own files (WinnerLab's Higgsfield account) are accepted as links
const media = (v: unknown) => (ownsMedia(v, "main") ? (v as string) : null);

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const data = (await req.json().catch(() => null)) as Export | null;
  if (!data || data.source !== "winnerlab" || data.version !== 1) return NextResponse.json({ error: "Ese archivo no es una exportación de WinnerLab." }, { status: 400 });
  const db = dbFor("main");
  const done = { guiones: 0, avatares: 0, productos: 0, videos: 0, cortes: 0, imagenes: 0, yaEstaban: 0 };
  try {
    const has = (rows: Row[], key: string) => rows.some((r) => String(r.notes ?? "").includes(tag(key)));
    const [scripts, avatars, products, ads, images] = await Promise.all([
      db.list("scripts", "order=created_at.desc&limit=1000"),
      db.list("avatars", "order=created_at.desc&limit=1000"),
      db.list("products", "order=created_at.desc&limit=1000"),
      db.list("ads", "order=created_at.desc&limit=1000"),
      db.list("images", "order=created_at.desc&limit=1000"),
    ]);

    for (const s of data.scripts ?? []) {
      if (has(scripts, s.key)) { done.yaEstaban++; continue; }
      await db.insert("scripts", { title: str(s.title, 200), text: str(s.text, 20000) || "(sin texto)", lang: s.lang === "es" ? "es" : "en", favorite: Boolean(s.favorite), notes: `${str(s.notes, 8000)}\n${tag(s.key)}`.trim() });
      done.guiones++;
    }
    for (const a of data.avatars ?? []) {
      if (has(avatars, a.key)) { done.yaEstaban++; continue; }
      await db.insert("avatars", { name: str(a.name, 80), description: str(a.description, 2000), image_url: media(a.image_url), notes: `${str(a.notes, 1000)}\n${tag(a.key)}` });
      done.avatares++;
    }
    for (const p of data.products ?? []) {
      if (has(products, p.key)) { done.yaEstaban++; continue; }
      await db.insert("products", { name: str(p.name, 80), description: str(p.description, 2000), image_url: media(p.image_url), notes: `${str(p.notes, 1000)}\n${tag(p.key)}` });
      done.productos++;
    }
    for (const a of data.ads ?? []) {
      if (ads.some((r) => (r.settings as Row | null)?.wlKey === a.key)) { done.yaEstaban++; continue; }
      const ad = await db.insert("ads", {
        title: str(a.title, 200),
        format: str(a.format, 30) || "ugc",
        aspect: ["9:16", "4:5", "1:1", "16:9"].includes(a.aspect) ? a.aspect : "9:16",
        status: ["done", "review", "draft"].includes(a.status) ? a.status : "draft",
        final_url: media(a.final_url),
        settings: { ...(a.settings ?? {}), wlKey: a.key },
      });
      done.videos++;
      for (const c of a.clips ?? []) {
        await db.insert("clips", {
          ad_id: ad.id, idx: Number(c.idx) || 0, text: str(c.text, 4000), prompt: str(c.prompt, 12000), model: str(c.model, 60),
          status: c.status === "done" && media(c.url) ? "done" : "failed", url: media(c.url),
        });
        done.cortes++;
      }
    }
    const urls = new Set(images.map((r) => r.url));
    for (const i of data.images ?? []) {
      const url = media(i.url);
      if (!url || urls.has(url)) { done.yaEstaban++; continue; }
      await db.insert("images", { prompt: str(i.prompt, 2000), url, model: str(i.model, 60), aspect: str(i.aspect, 8) || "9:16" });
      done.imagenes++;
    }
    return NextResponse.json({ ok: true, done });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo importar.", done }, { status: 502 });
  }
}
