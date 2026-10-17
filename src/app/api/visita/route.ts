import { NextResponse } from "next/server";
import { clientIp, tooMany } from "@/lib/rate";
import { sbRpc } from "@/lib/supabase";
import { dayCL, deviceOf, isBot, landingOf, sourceOf } from "@/lib/stats";

// POST {path, ref, utm, fbclid, gclid} once per browser-tab visit (see src/app/visit-beacon.tsx).
// Counts the visit anonymously for "Estadísticas": one more per day for the device, the city (from the
// hosting's geo headers), the source and the landing page. Nothing about the person is stored.
export async function POST(req: Request) {
  const none = new NextResponse(null, { status: 204 });
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || isBot(ua)) return none;
  if (await tooMany("visit", clientIp(req))) return none;
  const b = await req.json().catch(() => null);
  const path = typeof b?.path === "string" ? b.path : "/";
  if (/^\/(admin|api)(\/|$)/.test(path)) return none;
  const host = req.headers.get("host") ?? "creadsia.com";
  const src = sourceOf({ ref: typeof b?.ref === "string" ? b.ref.slice(0, 300) : "", utm: typeof b?.utm === "string" ? b.utm.slice(0, 40) : "", fbclid: b?.fbclid === true, gclid: b?.gclid === true, host });
  const dec = (v: string | null) => { try { return v ? decodeURIComponent(v) : ""; } catch { return v ?? ""; } };
  const country = dec(req.headers.get("x-vercel-ip-country"));
  const region = dec(req.headers.get("x-vercel-ip-country-region"));
  const city = dec(req.headers.get("x-vercel-ip-city"));
  const loc = [country, region, city].filter(Boolean).join(" · ") || "Desconocido";
  try {
    await sbRpc("stat_hits", { p_day: dayCL(), p_items: [{ d: "ses", k: "all" }, { d: "dev", k: deviceOf(ua) }, { d: "loc", k: loc.slice(0, 120) }, { d: "src", k: src }, { d: "land", k: landingOf(path) }] });
  } catch { /* stats.sql not installed yet: visits just aren't counted */ }
  const res = NextResponse.json({ src });
  return res;
}
