// «Panel del embudo por canal» (owner's plan H, 25 Oct 2026): for each channel (the first-click utm/ref), how
// many visited, signed up, made their first batch, bought the Pack, moved from the Pack to a plan within 7 days,
// and renewed in month 2. Pure: the route reads the rows and passes them here. An affiliate's referral counts
// as «ref:<code>»; accounts without consent or without a tag are «sin dato».

export interface CanalCuenta { ws: string; creada: string }
export interface CanalPedido { owner: string; item: string; status: string; period: string | null; created_at: string; closed_at: string | null; payments: string[] | null; visitor: { src?: string } | null }
export interface FilaCanal {
  canal: string;
  visitas: number;
  registros: number;
  activaciones: number;
  compras_pack: number;
  pack_a_plan_7d: number;
  renovaciones_mes2: number;
  /** registros → activación, activación → compra del Pack, Pack → plan, as % (null without a base). */
  tasas: { activacion: number | null; compra_pack: number | null; pack_a_plan: number | null };
}

const DAY = 86_400_000;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

export function embudoPorCanal(o: {
  visitasPorCanal: Record<string, number>;
  cuentas: CanalCuenta[];
  /** account → first-click channel (from the signup), when known */
  origen: Record<string, string | null | undefined>;
  /** account → affiliate code, when it came from a referral */
  referido: Record<string, string>;
  /** accounts that made their first generation */
  activadas: Set<string>;
  pedidos: CanalPedido[];
}): FilaCanal[] {
  const canalDe = (ws: string) => (o.referido[ws] ? `ref:${o.referido[ws]}` : o.origen[ws] || "sin dato");
  const filas = new Map<string, FilaCanal>();
  const fila = (canal: string) => {
    let f = filas.get(canal);
    if (!f) { f = { canal, visitas: 0, registros: 0, activaciones: 0, compras_pack: 0, pack_a_plan_7d: 0, renovaciones_mes2: 0, tasas: { activacion: null, compra_pack: null, pack_a_plan: null } }; filas.set(canal, f); }
    return f;
  };
  for (const [canal, n] of Object.entries(o.visitasPorCanal)) fila(canal).visitas += n;
  const enRango = new Set(o.cuentas.map((c) => c.ws));
  for (const c of o.cuentas) {
    const f = fila(canalDe(c.ws));
    f.registros++;
    if (o.activadas.has(c.ws)) f.activaciones++;
  }
  const pagados = o.pedidos.filter((p) => p.status === "pagado" && enRango.has(p.owner));
  for (const pack of pagados.filter((p) => p.item === "pack-prueba")) {
    const f = fila(canalDe(pack.owner));
    f.compras_pack++;
    const t = Date.parse(pack.closed_at ?? pack.created_at);
    const plan = pagados.find((p) => p.owner === pack.owner && !p.item.startsWith("pack-") && Date.parse(p.closed_at ?? p.created_at) >= t && Date.parse(p.closed_at ?? p.created_at) - t <= 7 * DAY);
    if (plan) f.pack_a_plan_7d++;
  }
  // month 2: a monthly plan order with a second payment applied (one per account)
  const renovadas = new Set(pagados.filter((p) => p.period === "mensual" && (p.payments ?? []).length >= 2).map((p) => p.owner));
  for (const ws of renovadas) fila(canalDe(ws)).renovaciones_mes2++;
  for (const f of filas.values()) f.tasas = { activacion: pct(f.activaciones, f.registros), compra_pack: pct(f.compras_pack, f.activaciones), pack_a_plan: pct(f.pack_a_plan_7d, f.compras_pack) };
  return [...filas.values()].sort((a, b) => b.registros - a.registros || b.visitas - a.visitas);
}
