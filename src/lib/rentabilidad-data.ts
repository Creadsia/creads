import { SHOWN_PLANS } from "./catalog";
import { readPrivateJSON, sbAll } from "./supabase";
import { DEFAULT_FINANZAS, type Finanzas, withCurrentPlans } from "./finance";
import {
  type AdRow, type ChargeRow, type ClipRow, type Family, type PaidOrder,
  cheaperSteps, customerSegment, internalSegment, leaks, planMargins, planesPorPieza, realCostPerCredit,
} from "./rentabilidad";

// Reads the database for Panel → Rentabilidad (and the office's CEO General).
export async function rentabilidadReport(days: number) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const [ads, clips, charges, orders, book] = await Promise.all([
    sbAll<AdRow>(`ads?created_at=gte.${since}&select=id,owner,format,status,final_url,created_at`, "created_at.asc,id.asc"),
    sbAll<ClipRow>(`clips?created_at=gte.${since}&select=id,owner,ad_id,kind,model,status,usd,created_at`, "created_at.asc,id.asc"),
    sbAll<ChargeRow>(`credits?created_at=gte.${since}&kind=in.(charge,refund)&select=id,owner,delta,kind,note,ref,usd,created_at`, "id.asc").catch(() => [] as ChargeRow[]),
    sbAll<PaidOrder & { id: string }>(`orders?status=eq.pagado&closed_at=gte.${since}&select=id,item,quote`, "created_at.asc,id.asc").catch(() => []),
    readPrivateJSON<Finanzas>("finanzas.json").catch(() => null),
  ]);
  const f = withCurrentPlans(book ?? DEFAULT_FINANZAS);
  const models = [...f.modelos, ...DEFAULT_FINANZAS.modelos.filter((m) => !f.modelos.some((x) => x.id === m.id))];
  const isMain = (o: string) => o === "main";
  const clientes = customerSegment(ads.filter((a) => !isMain(a.owner)), clips.filter((c) => !isMain(c.owner)), charges.filter((c) => !isMain(c.owner)));
  const interno = internalSegment(ads.filter((a) => isMain(a.owner)), clips.filter((c) => isMain(c.owner)));
  const real = realCostPerCredit(charges.filter((c) => !isMain(c.owner)));
  const costPerCredit = real?.usd ?? f.config.costoCredito;
  const planes = planMargins(f.config, f.config.planes, costPerCredit);
  const ordersByPlan: Record<string, number> = {};
  for (const o of orders) { const p = f.config.planes.find((x) => x.id === o.item); if (p) ordersByPlan[p.nombre] = (ordersByPlan[p.nombre] ?? 0) + 1; }
  const spend: Partial<Record<Family, number>> = {};
  for (const s of [clientes, interno]) for (const p of s.proveedores) spend[p.familia] = (spend[p.familia] ?? 0) + p.usd;
  const fugas = leaks({ days, clientes, interno, planes, ordersByPlan });
  return {
    days, since, updated: new Date().toISOString(),
    costoCredito: { usado: costPerCredit, real, supuesto: f.config.costoCredito },
    clientes, interno, planes, porPieza: planesPorPieza(SHOWN_PLANS), fugas: fugas.slice(0, 3), otrasFugas: fugas.slice(3, 8),
    baratos: cheaperSteps(models, spend, days),
  };
}
