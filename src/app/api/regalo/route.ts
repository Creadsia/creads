import { NextResponse } from "next/server";
import { getUserById } from "@/lib/auth";
import { session } from "@/lib/access";
import { allow, clientIp } from "@/lib/rate";
import { darRegalo, regaloCheck, regaloSign } from "@/lib/regalo";
import { SITE, welcomeEmail } from "@/lib/emails";
import { sendEmail } from "@/lib/providers/email";

export const dynamic = "force-dynamic";

// GET ?u=<user>&s=<signature>: the «confirm and get your first ad» button of the welcome email. Confirms the
// inbox is real and gives the gift once (see lib/regalo). Then opens Automático with the result.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const u = url.searchParams.get("u") ?? "";
  const sig = url.searchParams.get("s") ?? "";
  const go = (r: string) => NextResponse.redirect(`${SITE}/app/automatico?regalo=${r}`);
  if (!/^[\w-]{6,64}$/.test(u) || !regaloCheck(u, sig)) return go("link");
  const user = await getUserById(u).catch(() => null);
  if (!user || !user.active) return go("link");
  if (!(await allow("regaloIp", clientIp(req)))) return go("tope");
  try {
    const r = await darRegalo(user.workspace, user.email);
    return go(r.ok ? "ok" : r.why);
  } catch (e) {
    console.error("regalo", e instanceof Error ? e.message : e);
    return go("error");
  }
}

// POST: sends the confirmation email again (from the app, for whoever lost it).
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  if (!(await allow("forgotEmail", s.user.email))) return NextResponse.json({ error: "Ya te lo mandamos hace poco. Revisa tu correo (y la carpeta de spam)." }, { status: 429 });
  await sendEmail(welcomeEmail(s.user.email, s.user.name, `${SITE}/api/regalo?u=${encodeURIComponent(s.user.id)}&s=${regaloSign(s.user.id)}`));
  return NextResponse.json({ ok: true });
}
