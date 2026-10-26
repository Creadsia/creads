import { NextResponse } from "next/server";
import { session, SESSION_ENDED } from "@/lib/access";
import { fetchableUrl } from "@/lib/media";
import { limpiarProyecto, type Proyecto } from "@/lib/editor";
import type { Word } from "@/lib/textmatch";
import { normalizeStyle } from "@/lib/caption-style";

export const dynamic = "force-dynamic";

// «Editor de video»: GET → the ad's clips (links to play them), the words said in each (for subtitles in the
// preview) and the saved project; PUT {proyecto, subtitulosEstilo?} → saves the project (autosave from the
// editor). The subtitle style picked in the editor is kept apart (`editorCaptions`): it only changes the edited
// export, never the original ad or its «Subtítulos» screen.

type Settings = { editor?: unknown; editorCaptions?: unknown; review?: { clipId: string; url?: string; words: Word[] }[]; captions?: unknown; demo?: boolean; story?: unknown };
interface ClipRow { id: string; idx: number; url: string | null; status: string; text: string | null }

async function load(req: Request, id: string) {
  const s = await session(req);
  if (!s) return { error: NextResponse.json({ error: SESSION_ENDED }, { status: 401 }) };
  const ad = (await s.db.get("ads", id).catch(() => null)) as { id: string; title: string | null; aspect: string | null; final_url: string | null; settings: Settings | null } | null;
  if (!ad) return { error: NextResponse.json({ error: "No encontré ese anuncio." }, { status: 404 }) };
  const clips = ((await s.db.list("clips", `ad_id=eq.${id}&order=idx.asc`).catch(() => [])) as unknown as ClipRow[]).filter((c) => c.status === "done" && c.url);
  if (!clips.length) return { error: NextResponse.json({ error: "Este anuncio no tiene cortes para editar (las demos y las historias se editan desde su propia pantalla)." }, { status: 400 }) };
  return { s, ad, clips };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = await load(req, (await ctx.params).id);
  if ("error" in r) return r.error;
  const { s, ad, clips } = r;
  const st = ad.settings ?? {};
  const cortes = await Promise.all(clips.map(async (c) => ({
    id: c.id, idx: c.idx, texto: c.text ?? "",
    url: await fetchableUrl(c.url!, s.user.workspace, 4 * 3600),
    palabras: st.review?.find((x) => x.clipId === c.id && x.url === c.url)?.words ?? [],
  })));
  const proyecto: Proyecto | null = st.editor ? limpiarProyecto(st.editor, new Set(clips.map((c) => c.id))) : null;
  const musica = proyecto?.musica?.url ? await fetchableUrl(proyecto.musica.url, s.user.workspace, 4 * 3600).catch(() => null) : null;
  return NextResponse.json({ titulo: ad.title ?? "Sin título", aspecto: ad.aspect ?? "9:16", final: ad.final_url, subtitulosEstilo: st.editorCaptions ?? st.captions ?? null, cortes, proyecto, musica });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = await load(req, (await ctx.params).id);
  if ("error" in r) return r.error;
  const { s, ad, clips } = r;
  const b = await req.json().catch(() => null);
  const proyecto = limpiarProyecto(b?.proyecto, new Set(clips.map((c) => c.id)));
  const estilo = b?.subtitulosEstilo && typeof b.subtitulosEstilo === "object" ? normalizeStyle(b.subtitulosEstilo) : undefined;
  await s.db.update("ads", ad.id, { settings: { ...(ad.settings ?? {}), editor: proyecto, ...(estilo ? { editorCaptions: estilo } : {}) } });
  return NextResponse.json({ ok: true });
}
