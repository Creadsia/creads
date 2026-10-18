import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { handleComment } from "@/lib/marketing";
import { metaConn } from "@/lib/meta-conexiones";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Meta webhooks for the brand's Instagram accounts (comments). GET: Meta checks the URL with the verify
// token. POST: signed with the app secret (both set in Panel → Marketing → Conexiones, or Vercel); every comment with
// one of the keywords gets the automatic reply from the account (lib/marketing.ts → handleComment).

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const want = ((await metaConn().catch(() => null))?.webhookToken ?? "").trim();
  if (want.length >= 16 && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === want) {
    return new NextResponse(q.get("hub.challenge") ?? "", { status: 200, headers: { "content-type": "text/plain" } });
  }
  return NextResponse.json({ error: "No autorizado." }, { status: 403 });
}

async function signed(raw: string, header: string | null) {
  const secret = ((await metaConn().catch(() => null))?.appSecret ?? "").trim();
  if (!secret || !header?.startsWith("sha256=")) return false;
  const want = Buffer.from(`sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`);
  const got = Buffer.from(header);
  return want.length === got.length && timingSafeEqual(want, got);
}

interface Entry { id: string; changes?: { field: string; value: { id?: string; text?: string; from?: { id?: string } } }[] }

export async function POST(req: Request) {
  const raw = await req.text();
  if (!(await signed(raw, req.headers.get("x-hub-signature-256")))) return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  let body: { object?: string; entry?: Entry[] };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }
  if (body.object !== "instagram") return NextResponse.json({ ok: true });
  for (const e of (body.entry ?? []).slice(0, 20)) {
    for (const ch of (e.changes ?? []).slice(0, 20)) {
      if (ch.field !== "comments" || !ch.value?.id || typeof ch.value.text !== "string") continue;
      await handleComment({ igUserId: String(e.id), commentId: String(ch.value.id), text: ch.value.text.slice(0, 1000), fromId: ch.value.from?.id }).catch((err) => console.error("ig comment", err instanceof Error ? err.message : err));
    }
  }
  // Meta only needs a quick 200; failures are logged above and never retried forever
  return NextResponse.json({ ok: true });
}
