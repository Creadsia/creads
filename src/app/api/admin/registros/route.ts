import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { selectRows } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export interface Registro {
  id: number;
  email: string;
  niche: string | null;
  ads_per_month: string | null;
  plan?: string | null;
  lang?: string | null;
  created_at: string;
}

// People who reserved a plan or joined the waitlist from creadsia.com (newest first).
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const rows = await selectRows<Registro>("waitlist", "select=*&order=created_at.desc&limit=1000");
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo leer." }, { status: 502 });
  }
}
