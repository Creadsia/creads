import { NextResponse } from "next/server";
import { readPrivateJSON, writePrivateJSON } from "@/lib/supabase";
import { tooMany, clientIp } from "@/lib/rate";

export const dynamic = "force-dynamic";

// Counts app installs per day (for the owner's morning summary). Nothing personal is stored.
export async function POST(req: Request) {
  const limited = await tooMany("upload", `install:${clientIp(req)}`);
  if (limited) return NextResponse.json({ ok: false });
  const day = new Date().toISOString().slice(0, 10);
  try {
    const counts = (await readPrivateJSON<Record<string, number>>("instalaciones.json")) ?? {};
    counts[day] = (counts[day] ?? 0) + 1;
    await writePrivateJSON("instalaciones.json", counts);
  } catch (e) {
    console.error("install count", e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ ok: true });
}
