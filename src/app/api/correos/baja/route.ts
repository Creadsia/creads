import { NextResponse } from "next/server";
import { optOut, unsubOk } from "@/lib/unsub";

export const dynamic = "force-dynamic";

// "No quiero recibir más consejos": GET from the email link shows a confirmation page; POST is the
// one-click unsubscribe that mail apps (Gmail, Apple Mail) send.

async function handle(req: Request) {
  const u = new URL(req.url);
  const email = String(u.searchParams.get("e") ?? "").slice(0, 200);
  const ok = Boolean(email) && unsubOk(email, String(u.searchParams.get("t") ?? ""));
  if (ok) await optOut(email).catch((e) => console.error("unsub", e instanceof Error ? e.message : e));
  return ok;
}

export async function POST(req: Request) {
  const ok = await handle(req);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}

export async function GET(req: Request) {
  const ok = await handle(req);
  const msg = ok
    ? "Listo: no te enviaremos más consejos. Los correos de tu cuenta (pagos, cambio de clave y avisos de tu plan) siguen llegando."
    : "Este enlace no es válido. Si quieres dejar de recibir consejos, escríbenos a hola@creadsia.com.";
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Creads IA</title></head>
<body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f3f8;color:#1d1a2e">
<main style="max-width:460px;margin:12vh auto;padding:28px 24px;background:#fff;border:1px solid #e7e4f2;border-radius:16px">
<p style="font-size:20px;font-weight:800;margin:0 0 16px">creads <span style="font-size:12px;color:#fff;background:#7c3aed;border-radius:5px;padding:2px 5px;vertical-align:3px">IA</span></p>
<p style="font-size:16px;line-height:1.55;margin:0 0 20px">${msg}</p>
<a href="/app" style="display:inline-block;padding:10px 18px;border-radius:10px;background:#7c3aed;color:#fff;font-weight:700;text-decoration:none">Ir a Creads</a>
</main></body></html>`;
  return new NextResponse(html, { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } });
}
