import { NextResponse } from "next/server";
import { allow, clientIp } from "@/lib/rate";
import { findImage } from "@/lib/providers";
import { saveMedia, fetchableUrl } from "@/lib/media";
import type { AspectRatio, MediaRef } from "@/lib/providers/types";

export const maxDuration = 120;

// Public "Ver en mi espacio" for the Kuoko Home store (no Creads account): the visitor sends a photo of their
// room and a rug from the catalogue, and GPT Image lays the rug on the floor. No per-user credits here, so the
// cost is Creads': it is capped hard (per connection and for everyone per day) and the rug must be one of ours
// (an allowed host), never an arbitrary URL — no SSRF, no surprise bill.
const WS = "main";
const ASPECTS: AspectRatio[] = ["9:16", "1:1", "4:5", "16:9"];
// the rug reference may only come from our own hosts or the store's product images
const RUG_HOSTS = ["creadsia.com", "www.creadsia.com", "kuokohome.com", "www.kuokohome.com", "cdn.shopify.com"];

function allowedOrigin(o: string): string {
  try {
    const h = new URL(o).hostname;
    if (h === "kuokohome.com" || h.endsWith(".kuokohome.com") || h.endsWith(".myshopify.com")) return o;
  } catch {}
  return "https://kuokohome.com";
}
const cors = (origin: string): Record<string, string> => ({
  "access-control-allow-origin": allowedOrigin(origin),
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  vary: "origin",
});

export function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin") || "") });
}

export async function POST(req: Request) {
  const H = cors(req.headers.get("origin") || "");
  const ip = clientIp(req);
  if (!(await allow("tryonIp", ip))) return NextResponse.json({ error: "Probaste varias alfombras seguidas. Espera un ratito y vuelve a intentar." }, { status: 429, headers: H });
  if (!(await allow("tryonAll", "global"))) return NextResponse.json({ error: "La prueba con IA está muy ocupada hoy. Intenta más tarde." }, { status: 429, headers: H });

  const provider = findImage("gpt-image-2.5");
  if (!provider?.configured()) return NextResponse.json({ error: "La prueba con IA no está disponible ahora. Intenta más tarde." }, { status: 503, headers: H });

  const b = await req.json().catch(() => null);
  const room = typeof b?.room === "string" ? b.room : "";
  const rug = typeof b?.rug === "string" ? b.rug : "";
  const aspect: AspectRatio = ASPECTS.includes(b?.aspect) ? b.aspect : "4:5";

  const m = room.match(/^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return NextResponse.json({ error: "Sube una foto de tu espacio." }, { status: 400, headers: H });
  let rugUrl: URL;
  try {
    rugUrl = new URL(rug);
  } catch {
    return NextResponse.json({ error: "Elige una alfombra." }, { status: 400, headers: H });
  }
  if (rugUrl.protocol !== "https:" || !RUG_HOSTS.includes(rugUrl.hostname)) return NextResponse.json({ error: "Alfombra no válida." }, { status: 400, headers: H });
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length < 1024 || bytes.length > 12 * 1024 * 1024) return NextResponse.json({ error: "La foto no es válida o pesa demasiado (máx 12 MB)." }, { status: 400, headers: H });

  try {
    const roomRef = await saveMedia(WS, "tryon", bytes, m[1]);
    const roomUrl = await fetchableUrl(roomRef, WS, 1800);
    const refs: MediaRef[] = [
      { url: roomUrl, role: "style" },
      { url: rugUrl.toString(), role: "product" },
    ];
    const prompt =
      "Fotorrealista. Coloca la alfombra de la segunda imagen de referencia apoyada y bien plana sobre el piso de la habitación de la primera imagen, centrada en el suelo frente a los muebles principales. " +
      "Respeta la perspectiva real del piso y la escala de una alfombra grande; la alfombra sigue el ángulo del suelo de forma natural. " +
      "Mantén la habitación EXACTAMENTE igual (muebles, paredes, ventanas, iluminación) y conserva el patrón, los colores y la textura de la alfombra tal cual, sin inventar un diseño distinto. " +
      "Entrega una foto limpia y creíble, sin texto ni marcas de agua.";
    const out = await provider.generate({ prompt, aspect, refs });
    const outRef = await saveMedia(WS, "tryon", out.bytes, out.mime);
    const url = await fetchableUrl(outRef, WS, 1800);
    return NextResponse.json({ url }, { headers: H });
  } catch (err) {
    console.error("probar-alfombra", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "No se pudo generar la prueba. Vuelve a intentarlo en un momento." }, { status: 500, headers: H });
  }
}
