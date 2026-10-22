import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { fetchableUrl, refFor } from "@/lib/media";

export const dynamic = "force-dynamic";

// Opens a customer's private file: only for a signed-in member of that workspace. Redirects to a
// storage link that expires in 10 minutes (copying the link elsewhere stops working soon).
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const user = await userFromRequest(req);
  if (!user) return new NextResponse("Tu sesión terminó.", { status: 401 });
  const ref = refFor((await params).path.join("/"));
  try {
    let url = await fetchableUrl(ref, user.workspace, 600);
    // «Descargar» buttons ask for ?descargar=1: the file comes as a download (named creads-…), not opened
    if (new URL(req.url).searchParams.has("descargar")) {
      const name = `creads-${ref.split("/").pop() ?? "archivo"}`;
      url += `${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(name)}`;
    }
    return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "private, max-age=300" } });
  } catch {
    return new NextResponse("No encontrado.", { status: 404 });
  }
}
