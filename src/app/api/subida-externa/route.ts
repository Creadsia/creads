import { NextResponse } from "next/server";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { signedUpload } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Hands the office («Vale») a one-time link to upload an approved video straight to Creads storage
// (bypasses the 4.5 MB request limit), then it publishes via /api/publicar-externo with the returned
// public URL. Server-to-server only (CRON_SECRET); the Meta token never leaves Creads.
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.byteLength === y.byteLength && timingSafeEqual(x, y); };

export async function POST(req: Request) {
  const secret = (process.env.CREADS_PUBLISH_SECRET || process.env.CRON_SECRET || "").trim();
  if (secret.length < 16 || !same(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  let body: { ext?: string };
  try { body = (await req.json()) as typeof body; } catch { body = {}; }
  const ext = /^[a-z0-9]{2,4}$/i.test(String(body.ext ?? "")) ? String(body.ext).toLowerCase() : "mp4";

  try {
    const { uploadUrl, publicUrl } = await signedUpload(`externo/${randomUUID()}.${ext}`);
    return NextResponse.json({ ok: true, uploadUrl, publicUrl });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "No se pudo preparar la subida." }, { status: 500 });
  }
}
