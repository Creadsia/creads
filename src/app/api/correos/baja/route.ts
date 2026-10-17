import { NextResponse } from "next/server";
import { optOut, unsubOk } from "@/lib/unsub";

export const dynamic = "force-dynamic";

// "No quiero recibir más consejos". The link in the email (GET) only shows a button: corporate link
// scanners open links by themselves and must not unsubscribe anyone. The button, and the one-click
// unsubscribe that mail apps send (Gmail, Apple Mail), are a POST.

function page(body: string, status = 200) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>Creads IA</title></head>
<body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f3f8;color:#1d1a2e">
<main style="max-width:460px;margin:12vh auto;padding:28px 24px;background:#fff;border:1px solid #e7e4f2;border-radius:16px">
<p style="font-size:20px;font-weight:800;margin:0 0 16px">creads <span style="font-size:12px;color:#fff;background:#7c3aed;border-radius:5px;padding:2px 5px;vertical-align:3px">IA</span></p>
${body}
</main></body></html>`;
  return new NextResponse(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

const p = (t: string) => `<p style="font-size:16px;line-height:1.55;margin:0 0 20px">${t}</p>`;
const btn = "display:inline-block;padding:10px 18px;border:0;border-radius:10px;background:#7c3aed;color:#fff;font-weight:700;font-size:15px;text-decoration:none;cursor:pointer";
const INVALID = p("Este enlace no es válido. Si quieres dejar de recibir consejos, escríbenos a hola@creadsia.com.");

function params(req: Request) {
  const u = new URL(req.url);
  const email = String(u.searchParams.get("e") ?? "").slice(0, 200);
  const token = String(u.searchParams.get("t") ?? "");
  return { email, token, ok: Boolean(email) && unsubOk(email, token) };
}

export async function GET(req: Request) {
  const { email, token, ok } = params(req);
  if (!ok) return page(INVALID, 400);
  return page(`${p("¿Quieres dejar de recibir los consejos de Creads IA? Los correos de tu cuenta (pagos, cambio de clave y avisos de tu plan) siguen llegando.")}
<form method="post" action="/api/correos/baja?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}"><button type="submit" style="${btn}">Dejar de recibir consejos</button></form>`);
}

export async function POST(req: Request) {
  const { email, ok } = params(req);
  const fromForm = (req.headers.get("content-type") ?? "").includes("form") && !(await req.clone().text().catch(() => "")).includes("List-Unsubscribe");
  if (ok) await optOut(email).catch((e) => console.error("unsub", e instanceof Error ? e.message : e));
  if (!fromForm) return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
  return ok ? page(`${p("Listo: no te enviaremos más consejos.")}<a href="/app" style="${btn}">Ir a Creads</a>`) : page(INVALID, 400);
}
