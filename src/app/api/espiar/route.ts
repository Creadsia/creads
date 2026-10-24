import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { freeOrLimited } from "@/lib/credits";
import { adSpyConfigured, searchAds, type SpyAd } from "@/lib/providers/adspy";
import { tooMany } from "@/lib/rate";
import { readPrivateJSON, writePrivateJSON } from "@/lib/supabase";
import { FEATURE_UNAVAILABLE } from "@/lib/public-error";

export const maxDuration = 60;

// GET ?q=<nicho>&pais=CL&video=1&cursor=… → active Meta ads for that search, the ones running longest
// first (an ad that has run for weeks is selling). Free with an active plan; the same search is
// answered from a 24 h copy so popular niches cost nothing to repeat.

const COUNTRIES = new Set(["ALL", "CL", "AR", "MX", "CO", "PE", "EC", "UY", "PY", "BO", "VE", "CR", "PA", "GT", "DO", "PR", "SV", "HN", "NI", "US", "ES", "BR", "CA", "GB"]);
const DAY = 86_400_000;

export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (q.length < 3) return NextResponse.json({ error: "Escribe qué vendes o tu nicho (al menos 3 letras)." }, { status: 400 });
  const pais = (u.searchParams.get("pais") ?? "CL").toUpperCase();
  const country = COUNTRIES.has(pais) ? pais : "CL";
  const video = u.searchParams.get("video") === "1";
  const cursor = (u.searchParams.get("cursor") ?? "").slice(0, 4000) || undefined;

  const broke = await freeOrLimited(s.user, "spy");
  if (broke) return NextResponse.json({ error: broke }, { status: 402 });
  if (!adSpyConfigured()) return NextResponse.json({ error: FEATURE_UNAVAILABLE }, { status: 503 });

  const key = createHash("sha256").update(JSON.stringify([q.toLowerCase(), country, video, cursor ?? ""])).digest("hex").slice(0, 32);
  const file = `espia/${key}.json`;
  const hit = await readPrivateJSON<{ at: number; ads: SpyAd[]; cursor: string | null }>(file).catch(() => null);
  if (hit && Date.now() - hit.at < DAY) return NextResponse.json({ ads: hit.ads, cursor: hit.cursor, cached: true });

  const limited = (await tooMany("spy", s.user.id)) ?? (await tooMany("spyDay", s.user.id));
  if (limited) return limited;
  try {
    const r = await searchAds({ query: q, country, video, cursor });
    const ads = r.ads.sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
    await writePrivateJSON(file, { at: Date.now(), ads, cursor: r.cursor }).catch(() => null);
    return NextResponse.json({ ads, cursor: r.cursor });
  } catch (err) {
    console.error("espiar", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "No pudimos buscar anuncios ahora. Vuelve a intentarlo en unos minutos." }, { status: 502 });
  }
}
