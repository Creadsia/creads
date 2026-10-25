import { NextResponse } from "next/server";
import { sendMeta, visitorFrom } from "@/lib/meta";
import { clientIp, tooMany } from "@/lib/rate";
import { guardarEnLista } from "@/lib/waitlist";

// Saves a sign-up (plan reservation) in Supabase, table `waitlist` (see src/lib/waitlist.ts).
export async function POST(req: Request) {
  const limited = await tooMany("upload", `waitlist:${clientIp(req)}`);
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  // masterclass sign-ups (creadsia.com/curso) keep their WhatsApp in the niche column
  const masterclass = body?.plan === "masterclass";
  const wa = typeof body?.whatsapp === "string" ? body.whatsapp.replace(/[^\d+ ]/g, "").trim().slice(0, 20) : "";
  const extra = {
    plan: String(body?.plan ?? "").slice(0, 20),
    lang: String(body?.lang ?? "").slice(0, 5),
  };
  const saved = await guardarEnLista({
    email,
    niche: masterclass ? `Masterclass${wa ? ` · WhatsApp ${wa}` : ""}`.slice(0, 80) : String(body?.niche ?? "").slice(0, 80),
    ads_per_month: String(body?.ads_per_month ?? "").slice(0, 20),
    ...extra,
  });
  if (!saved.ok) {
    if (saved.status === 503) return NextResponse.json({ error: "Sign-ups open very soon." }, { status: 503 });
    console.error("waitlist insert failed", saved.status, saved.detail);
    return NextResponse.json({ error: `Couldn't save (code ${saved.status}).` }, { status: 502 });
  }
  // the same Lead the browser pixel sent (same id), from the server
  await sendMeta({ name: "Lead", eventId: typeof body?.eventId === "string" ? body.eventId : undefined, email, content: masterclass ? "Masterclass" : extra.plan ? `Reserva ${extra.plan}` : "Lista de espera" }, visitorFrom(req));
  return NextResponse.json({ ok: true });
}
