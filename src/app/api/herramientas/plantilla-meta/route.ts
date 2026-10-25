import { NextResponse } from "next/server";
import { sendMeta, visitorFrom } from "@/lib/meta";
import { clientIp, tooMany } from "@/lib/rate";
import { guardarEnLista, origenLead } from "@/lib/waitlist";
import { NOMBRE_PLANTILLA, zipPlantilla } from "@/lib/plantilla-meta";

export const dynamic = "force-dynamic";

// Public «Plantilla de Meta» (/plantilla-meta): POST {email, lang?, eventId?} saves the lead in the waitlist
// table (plan «plantilla-meta», niche = where they came from; Panel → Registros) and answers with the ZIP.
export async function POST(req: Request) {
  const limited = await tooMany("leadIp", clientIp(req));
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Revisa tu correo: parece que le falta algo." }, { status: 400 });

  const visitor = visitorFrom(req);
  const saved = await guardarEnLista({
    email,
    niche: origenLead("Plantilla Meta", visitor),
    ads_per_month: "",
    plan: "plantilla-meta",
    lang: body?.lang === "en" ? "en" : "es",
  });
  if (!saved.ok) {
    if (saved.status !== 503) console.error("template lead insert failed", saved.status, saved.detail);
    return NextResponse.json({ error: "No pudimos guardar tu correo. Intenta de nuevo en un momento." }, { status: 502 });
  }
  // the same Lead the browser pixel sent (same id), from the server
  await sendMeta({ name: "Lead", eventId: typeof body?.eventId === "string" ? body.eventId : undefined, email, content: "Plantilla Meta" }, visitor).catch(() => null);
  return new Response(Buffer.from(zipPlantilla()), {
    headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${NOMBRE_PLANTILLA}"`, "cache-control": "no-store" },
  });
}
