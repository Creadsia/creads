import { NextResponse } from "next/server";
import { providerStatus } from "@/lib/providers";

// Quick check of which services have their keys configured (never returns the keys).
export async function GET() {
  return NextResponse.json({ ok: true, providers: providerStatus() });
}
