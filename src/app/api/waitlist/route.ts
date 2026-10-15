import { NextResponse } from "next/server";

// Saves a waitlist sign-up in Supabase (table `waitlist`, see supabase/schema.sql).
// Uses the REST endpoint with the service-role key, which stays on the server.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Escribe un correo válido." }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "La lista abre muy pronto. Escríbenos a hola@creadsia.com." }, { status: 503 });
  }

  const res = await fetch(`${url}/rest/v1/waitlist`, {
    method: "POST",
    headers: {
      apikey: key,
      // Legacy service_role keys are JWTs and also go in Authorization; new sb_secret_ keys only need apikey.
      ...(key.startsWith("eyJ") ? { authorization: `Bearer ${key}` } : {}),
      "content-type": "application/json",
      prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify({
      email,
      niche: String(body?.niche ?? "").slice(0, 80),
      ads_per_month: String(body?.ads_per_month ?? "").slice(0, 20),
    }),
  });

  if (!res.ok && res.status !== 409) {
    // Log Supabase's answer (never the key) so it shows in Vercel → Logs, and give a short code to the visitor.
    const detail = await res.text().catch(() => "");
    console.error("waitlist insert failed", res.status, detail.slice(0, 500));
    // Supabase's error text never contains the key, so a short hint is safe to show while we set things up.
    let hint = "";
    try {
      const j = JSON.parse(detail);
      hint = [j.code, j.message || j.msg || j.error].filter(Boolean).join(" ").slice(0, 140);
    } catch {
      hint = detail.slice(0, 140);
    }
    const keyKind = key.startsWith("sb_secret_") ? "secret" : key.startsWith("eyJ") ? "legacy" : key.startsWith("sb_publishable_") ? "publishable" : "otra";
    return NextResponse.json(
      { error: `No se pudo guardar (código ${res.status}; clave ${keyKind}; ${hint || "sin detalle"}).` },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
