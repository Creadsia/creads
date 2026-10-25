import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { tooMany } from "@/lib/rate";
import { failMessage, failStatus } from "@/lib/paid";
import { publicError } from "@/lib/public-error";
import { serviceOfModel } from "@/lib/balances";
import { VideoError, cargarVideo, empezarVideoProducto, revisarVideoProducto } from "@/lib/video-producto-server";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

// «Video de producto» (studio, API keys and the Creads connector):
//   POST {producto, estilo?, titular?, descripcion?} → starts it (scene + animation, each charged on its own)
//   GET ?id=vp_… → its state; when ready, the final 9:16 video with the headline

export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("gen", s.user.id);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  try {
    const v = await empezarVideoProducto(s.user, { producto: String(b?.producto ?? ""), estilo: b?.estilo, titular: typeof b?.titular === "string" ? b.titular : "", descripcion: typeof b?.descripcion === "string" ? b.descripcion : "" });
    return NextResponse.json({ video: v });
  } catch (err) {
    if (err instanceof VideoError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: await failMessage(err, s.user, serviceOfModel("hailuo-2.3-pro")) }, { status: failStatus(err) });
  }
}

export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const v = await cargarVideo(s.user.workspace, new URL(req.url).searchParams.get("id") ?? "");
  if (!v) return NextResponse.json({ error: "No encontramos ese video." }, { status: 404 });
  try {
    return NextResponse.json({ video: await revisarVideoProducto(s.user, v) });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudo revisar el video.") }, { status: 502 });
  }
}
