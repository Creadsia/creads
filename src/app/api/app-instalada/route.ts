import { NextResponse } from "next/server";
import { updatePrivateJSON } from "@/lib/supabase";
import { tooMany, clientIp } from "@/lib/rate";

export const dynamic = "force-dynamic";

// Counts app installs per day (for the owner's morning summary). Nothing personal is stored.
export async function POST(req: Request) {
  const limited = await tooMany("upload", `install:${clientIp(req)}`);
  if (limited) return NextResponse.json({ ok: false });
  const day = new Date().toISOString().slice(0, 10);
  try {
    await updatePrivateJSON<Record<string, number>>("instalaciones.json", (cur) => ({ ...(cur ?? {}), [day]: ((cur ?? {})[day] ?? 0) + 1 }));
  } catch (e) {
    console.error("install count", e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ ok: true });
}
