import { NextResponse } from "next/server";
import { fetchableUrl } from "@/lib/media";

export const dynamic = "force-dynamic";

// Public showcase images for the home page. Our own generations live in the private owner workspace,
// so this opens ONLY the files listed here (never anything else) with a short-lived storage link.
const SHOWCASE: Record<string, string> = {
  "influencer-1": "/api/media/ws/main/images/69e90c7c-dbd8-4884-832c-0a8afe3bf44b.png",
  "influencer-2": "/api/media/ws/main/images/0092fe4c-f8f7-4e81-99af-6bdba6f87352.png",
  "influencer-3": "/api/media/ws/main/images/f442744f-7b50-4815-a3a3-65b363f23eee.png",
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
