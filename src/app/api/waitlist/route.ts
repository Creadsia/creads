import { NextResponse } from "next/server";
import { sendMeta, visitorFrom } from "@/lib/meta";
import { clientIp, tooMany } from "@/lib/rate";

// Saves a sign-up (plan reservation) in Supabase, table `waitlist` (see supabase/schema.sql).
// Uses the REST endpoint with the service-role key, which stays on the server.
export async function POST(req: Request) {
  const limited = await tooMany("upload", `waitlist:${clientIp(req)}`);
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Sign-ups open very soon." }, { status: 503 });
  }

  const base = {
    email,
    niche: String(body?.niche ?? "").slice(0, 80),
    ads_per_month: String(body?.ads_per_month ?? "").slice(0, 20),
  };
  const extra = {
    plan: String(body?.plan ?? "").slice(0, 20),
    lang: String(body?.lang ?? "").slice(0, 5),
  };

  const insert = (row: object) =>
    fetch(`${url}/rest/v1/waitlist`, {
      method: "POST",
      headers: {
        apikey: key,
        // Legacy service_role keys are JWTs and also go in Authorization; new sb_secret_ keys only need apikey.
        ...(key.startsWith("eyJ") ? { authorization: `Bearer ${key}` } : {}),
        "content-type": "application/json",
        prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(row),
    });

  let res = await insert({ ...base, ...extra });
  // If the plan/lang columns haven't been added yet (schema.sql), save the sign-up without them.
  if (res.status === 400) res = await insert(base);

  if (!res.ok && res.status !== 409) {
    const detail = await res.text().catch(() => "");
    console.error("waitlist insert failed", res.status, detail.slice(0, 500));
    return NextResponse.json({ error: `Couldn't save (code ${res.status}).` }, { status: 502 });
  }
  // the same Lead the browser pixel sent (same id), from the server
  await sendMeta({ name: "Lead", eventId: typeof body?.eventId === "string" ? body.eventId : undefined, email, content: extra.plan ? `Reserva ${extra.plan}` : "Lista de espera" }, visitorFrom(req));
  return NextResponse.json({ ok: true });
}
