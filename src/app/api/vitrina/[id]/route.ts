import { NextResponse } from "next/server";
import { fetchableUrl } from "@/lib/media";

export const dynamic = "force-dynamic";

// Public showcase images for the home page. Our own generations live in the private owner workspace,
// so this opens ONLY the files listed here (never anything else) with a short-lived storage link.
const SHOWCASE: Record<string, string> = {
  "influencer-1": "/api/media/ws/main/images/69e90c7c-dbd8-4884-832c-0a8afe3bf44b.png",
  "influencer-2": "/api/media/ws/main/images/0092fe4c-f8f7-4e81-99af-6bdba6f87352.png",
  "influencer-3": "/api/media/ws/main/images/f442744f-7b50-4815-a3a3-65b363f23eee.png",
  "influencer-4": "/api/media/ws/main/images/c82bbd68-b3a6-442c-906c-a204da85e881.png",
  "influencer-5": "/api/media/ws/main/images/4371e29d-3af9-4e39-b421-d7873ff8da6d.png",
  "influencer-6": "/api/media/ws/main/images/7e348f70-5148-4574-95f7-feeaf4cf95a1.png",
  // Creads' own characters (for marketing videos)
  "don-fortunato": "/api/media/ws/main/tools/crear-personaje/89bdeafe-a974-4e84-8a69-d9679b2b0b5f.png",
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ref = SHOWCASE[(await params).id];
  if (!ref) return new NextResponse("No encontrado.", { status: 404 });
  try {
    const url = await fetchableUrl(ref, "main", 3600);
    return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "public, max-age=1800, s-maxage=1800" } });
  } catch {
    return new NextResponse("No encontrado.", { status: 404 });
  }
}
