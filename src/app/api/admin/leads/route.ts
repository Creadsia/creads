import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { sbAll } from "@/lib/supabase";
import { ETAPAS, type Etapa, etapaOf, origins } from "@/lib/leads";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET ?dias=7|30|90 (owner only) → the accounts created in those days, each with its journey.
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const dias = [1, 7, 30, 90].includes(Number(new URL(req.url).searchParams.get("dias"))) ? Number(new URL(req.url).searchParams.get("dias")) : 7;
  const since = new Date(Date.now() - dias * 86_400_000).toISOString();
  try {
    const ws = await sbAll<{ id: string; name: string; plan: string | null; created_at: string }>(`workspaces?kind=eq.client&created_at=gte.${since}&select=id,name,plan,created_at`, "created_at.desc,id.asc");
    if (!ws.length) return NextResponse.json({ dias, cuentas: [], resumen: Object.fromEntries(Object.keys(ETAPAS).map((k) => [k, 0])), etapas: ETAPAS });
    const inList = `in.(${ws.map((w) => `"${w.id}"`).join(",")})`;
    const [users, orders, ads, avatars, images, charges, orig] = await Promise.all([
      sbAll<{ workspace: string; email: string; name: string | null; last_login: string | null; created_at: string }>(`users?workspace=${inList}&select=workspace,email,name,last_login,created_at`, "created_at.asc,email.asc"),
      sbAll<{ owner: string; status: string; item: string; created_at: string; quote: { label?: string } | null }>(`orders?owner=${inList}&select=owner,status,item,created_at,quote`, "created_at.asc,id.asc"),
      sbAll<{ owner: string; status: string; final_url: string | null; created_at: string }>(`ads?owner=${inList}&select=owner,status,final_url,created_at`, "created_at.asc,id.asc").catch(() => []),
      sbAll<{ owner: string; notes: string | null; created_at: string }>(`avatars?owner=${inList}&select=owner,notes,created_at`, "created_at.asc,id.asc").catch(() => []),
      sbAll<{ owner: string; created_at: string }>(`images?owner=${inList}&select=owner,created_at`, "created_at.asc,id.asc").catch(() => []),
      sbAll<{ owner: string; created_at: string }>(`credits?owner=${inList}&kind=eq.charge&select=owner,created_at`, "created_at.asc,id.asc").catch(() => []),
      origins(),
    ]);
    const by = <T extends { owner: string }>(rows: T[], id: string) => rows.filter((r) => r.owner === id);
    const latest = (...dates: (string | null | undefined)[]) => dates.filter(Boolean).sort().pop() ?? null;
    const cuentas = ws.map((w) => {
      const u = users.find((x) => x.workspace === w.id);
      const o = by(orders, w.id), a = by(ads, w.id), av = by(avatars, w.id).filter((x) => !/"starter":\s*true/.test(x.notes ?? "")), im = by(images, w.id), ch = by(charges, w.id);
      const paid = o.filter((x) => x.status === "pagado");
      const info = { pagosAbiertos: o.filter((x) => x.status !== "reemplazado").length, pagado: paid.length > 0, generaciones: ch.length, anunciosListos: a.filter((x) => x.status === "done" || x.final_url).length };
      const etapa: Etapa = etapaOf(info);
      return {
        id: w.id, empresa: w.name, email: u?.email ?? "", nombre: u?.name ?? null, creada: w.created_at,
        ultimaVez: latest(u?.last_login, ...o.map((x) => x.created_at), ...a.map((x) => x.created_at), ...av.map((x) => x.created_at), ...im.map((x) => x.created_at), ...ch.map((x) => x.created_at)),
        etapa, etapaTexto: ETAPAS[etapa],
        compro: paid.map((x) => x.quote?.label ?? x.item),
        ...info, avatares: av.length, imagenes: im.length, anuncios: a.length,
        origen: orig[w.id]?.src ?? null, campana: orig[w.id]?.camp ?? null,
      };
    });
    const resumen = Object.fromEntries(Object.keys(ETAPAS).map((k) => [k, cuentas.filter((c) => c.etapa === k).length]));
    return NextResponse.json({ dias, cuentas, resumen, etapas: ETAPAS });
  } catch {
    return NextResponse.json({ error: "No se pudieron leer las cuentas nuevas." }, { status: 502 });
  }
}
