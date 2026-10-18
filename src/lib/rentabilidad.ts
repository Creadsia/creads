import { type Config, type CostoModelo, type Plan, planMonth } from "./finance";
import { FORMATS } from "./formats";

// Panel → Rentabilidad: what a finished ad really costs per format, how much each provider fails and
// costs, what each plan leaves if the customer uses every credit, where the most money is lost, and
// which steps could use a cheaper model. Pure functions; /api/admin/rentabilidad reads the database.
//
// Where the money is read from:
// - customers: every charge in the credits table (one per attempt, with the provider cost in US$), and
//   its refund when the job failed, so retries and failures are all counted;
// - the owner's own account (unlimited credits, no charges): the clips table, which only keeps the
//   cost of each clip's latest attempt, so internal tests are shown apart and are a lower bound.
// Text AI (scripts, cuts, scenes, review) is not recorded per call yet, so it is not in these numbers.

export interface AdRow { id: string; owner: string; format: string | null; status: string; final_url: string | null; created_at: string }
export interface ClipRow { id: string; owner: string; ad_id: string | null; kind: string | null; model: string | null; status: string; usd: number | null; created_at: string }
export interface ChargeRow { id: number; owner: string; delta: number; kind: string; note: string | null; ref: string | null; usd: number | null; created_at: string }
export interface PaidOrder { item: string; quote: { launch?: number; discount?: number; total?: number } | null }

export const FAMILIES = ["Veo", "Kling", "Seedance", "Nano Banana", "ElevenLabs", "Hailuo", "Wan", "Grok Imagine", "FLUX / Seedream", "Herramientas"] as const;
export type Family = (typeof FAMILIES)[number];

/** The provider family of a model id, a model label or a charge note. */
export function familyOf(s: string | null | undefined): Family {
  const t = String(s ?? "").toLowerCase();
  if (/veo/.test(t)) return "Veo";
  if (/kling/.test(t)) return "Kling";
  if (/seedance/.test(t)) return "Seedance";
  if (/nano.?banana|gemini.*image|historia · (toma|personaje)|^imagen/.test(t)) return "Nano Banana";
  if (/voz|narrador|m[uú]sica|canci[oó]n|doblaje|efectos|eleven/.test(t)) return "ElevenLabs";
  if (/hailuo/.test(t)) return "Hailuo";
  if (/wan/.test(t)) return "Wan";
  if (/grok/.test(t)) return "Grok Imagine";
  if (/flux|seedream/.test(t)) return "FLUX / Seedream";
  return "Herramientas";
}

const num = (n: unknown) => (Number.isFinite(Number(n)) ? Number(n) : 0);
const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

export interface FormatRow { formato: string; terminados: number; empezados: number; usd: number; usdPorTerminado: number; cortesPorAnuncio: number; intentosPorCorte: number }
export interface ProviderRow { familia: Family; intentos: number; fallas: number; tasa: number; usd: number; usdFallas: number }
export interface Segment { formatos: FormatRow[]; proveedores: ProviderRow[]; usd: number; usdFallas: number; usdRehechosGratis: number; usdAbandonados: number; anunciosAbandonados: number }

function addProv(m: Map<Family, ProviderRow>, fam: Family, usd: number, failed: boolean) {
  const r = m.get(fam) ?? { familia: fam, intentos: 0, fallas: 0, tasa: 0, usd: 0, usdFallas: 0 };
  r.intentos++; r.usd += usd;
  if (failed) { r.fallas++; r.usdFallas += usd; }
  m.set(fam, r);
}
function closeProv(m: Map<Family, ProviderRow>) {
  return [...m.values()].map((r) => ({ ...r, usd: r2(r.usd), usdFallas: r2(r.usdFallas), tasa: r.intentos ? r.fallas / r.intentos : 0 })).sort((a, b) => b.usd - a.usd);
}
const done = (a: AdRow) => a.status === "done" || Boolean(a.final_url);
const label = (f: string | null) => (!f ? "Sin formato" : FORMATS.find((x) => x.id === f)?.name ?? (/hist/.test(f) ? "Historia animada" : f));

function formats(ads: AdRow[], clips: ClipRow[], costOfClip: (c: ClipRow) => { usd: number; tries: number }, now: number) {
  const byAd = new Map<string, ClipRow[]>();
  for (const c of clips) if (c.ad_id) { const l = byAd.get(c.ad_id) ?? []; l.push(c); byAd.set(c.ad_id, l); }
  const m = new Map<string, { terminados: number; empezados: number; usd: number; cortes: number; tries: number; clips: number }>();
  let usdAbandonados = 0, anunciosAbandonados = 0;
  for (const a of ads) {
    const list = byAd.get(a.id) ?? [];
    if (!list.length) continue; // stories without shots yet, drafts that never generated
    const k = label(a.format);
    const x = m.get(k) ?? { terminados: 0, empezados: 0, usd: 0, cortes: 0, tries: 0, clips: 0 };
    let usd = 0, tries = 0;
    for (const c of list) { const v = costOfClip(c); usd += v.usd; tries += v.tries; }
    x.empezados++; x.usd += usd; x.clips += list.length; x.tries += tries;
    if (done(a)) { x.terminados++; x.cortes += list.length; }
    else if (now - Date.parse(a.created_at) > 86400_000 && usd > 0) { usdAbandonados += usd; anunciosAbandonados++; }
    m.set(k, x);
  }
  const rows: FormatRow[] = [...m.entries()].map(([formato, x]) => ({
    formato, terminados: x.terminados, empezados: x.empezados, usd: r2(x.usd),
    usdPorTerminado: x.terminados ? r2(x.usd / x.terminados) : 0, // failed and abandoned ads count in the cost of the finished ones
    cortesPorAnuncio: x.terminados ? Math.round((x.cortes / x.terminados) * 10) / 10 : 0,
    intentosPorCorte: x.clips ? Math.round((x.tries / x.clips) * 100) / 100 : 0,
  })).sort((a, b) => b.usd - a.usd);
  return { rows, usdAbandonados: r2(usdAbandonados), anunciosAbandonados };
}

/** Customers: every charge counts (attempts, failures, free redos). */
export function customerSegment(ads: AdRow[], clips: ClipRow[], charges: ChargeRow[], now = Date.now()): Segment {
  const refunded = new Set(charges.filter((c) => c.kind === "refund" && c.ref?.startsWith("charge:")).map((c) => Number(c.ref!.slice(7))));
  const paid = charges.filter((c) => c.kind === "charge" && c.delta <= 0);
  const prov = new Map<Family, ProviderRow>();
  let usd = 0, usdFallas = 0, usdGratis = 0;
  const byRef = new Map<string, { usd: number; tries: number }>();
  for (const c of paid) {
    const u = num(c.usd), failed = refunded.has(c.id);
    usd += u;
    if (failed) usdFallas += u;
    if (c.delta === 0) usdGratis += u; // a free redo: Creads pays the provider, the customer doesn't
    addProv(prov, familyOf(c.note), u, failed);
    if (c.ref) { const x = byRef.get(c.ref) ?? { usd: 0, tries: 0 }; x.usd += u; x.tries++; byRef.set(c.ref, x); }
  }
  const f = formats(ads, clips, (c) => byRef.get(c.id) ?? { usd: 0, tries: 0 }, now);
  return { formatos: f.rows, proveedores: closeProv(prov), usd: r2(usd), usdFallas: r2(usdFallas), usdRehechosGratis: r2(usdGratis), usdAbandonados: f.usdAbandonados, anunciosAbandonados: f.anunciosAbandonados };
}

/** The owner's own account: no charges, only the clips' latest cost (a lower bound). */
export function internalSegment(ads: AdRow[], clips: ClipRow[], now = Date.now()): Segment {
  const prov = new Map<Family, ProviderRow>();
  let usd = 0, usdFallas = 0;
  for (const c of clips) {
    const u = num(c.usd);
    if (!u && c.status !== "failed") continue;
    usd += u;
    if (c.status === "failed") usdFallas += u;
    addProv(prov, familyOf(c.model ?? c.kind), u, c.status === "failed");
  }
  const f = formats(ads, clips, (c) => ({ usd: num(c.usd), tries: 1 }), now);
  return { formatos: f.rows, proveedores: closeProv(prov), usd: r2(usd), usdFallas: r2(usdFallas), usdRehechosGratis: 0, usdAbandonados: f.usdAbandonados, anunciosAbandonados: f.anunciosAbandonados };
}

/** US$ of provider cost per credit charged, from real customer charges (null without enough data). */
export function realCostPerCredit(charges: ChargeRow[]) {
  const refunded = new Set(charges.filter((c) => c.kind === "refund" && c.ref?.startsWith("charge:")).map((c) => Number(c.ref!.slice(7))));
  let usd = 0, credits = 0;
  for (const c of charges) {
    if (c.kind !== "charge" || c.delta >= 0 || refunded.has(c.id)) continue;
    usd += num(c.usd); credits += -c.delta;
  }
  // free redos and failed jobs the provider still billed are on top: count them against what was charged
  const extra = charges.filter((c) => c.kind === "charge" && (c.delta === 0 || refunded.has(c.id))).reduce((a, c) => a + num(c.usd), 0);
  return credits >= 500 ? { usd: r4((usd + extra) / credits), credits, base: r4(usd / credits) } : null;
}

export interface PlanRow { plan: string; caso: string; precio: number; costoIA: number; iva: number; comision: number; queda: number; margen: number }
/** What each plan leaves if the customer uses EVERY credit, in each way it can be paid. */
export function planMargins(c: Config, plans: Plan[], costPerCredit: number): PlanRow[] {
  const cfg = { ...c, costoCredito: costPerCredit };
  const out: PlanRow[] = [];
  for (const p of plans) {
    for (const [caso, o] of [["Mensual", {}], ["Primer mes (50%)", { promo: true }], ["Anual (por mes)", { anual: true }]] as const) {
      const r = planMonth(cfg, p, { ...o, uso: 100 });
      out.push({ plan: p.nombre, caso, precio: r2(r.precio), costoIA: r2(r.modelos), iva: r2(r.iva), comision: r2(r.stripe), queda: r2(r.queda), margen: Math.round(r.margen) });
    }
  }
  return out;
}

export interface Leak { titulo: string; usdMes: number; detalle: string }
/** The places where the most money goes out without coming back, biggest first (scaled to 30 days). */
export function leaks(o: { days: number; clientes: Segment; interno: Segment; planes: PlanRow[]; ordersByPlan: Record<string, number> }): Leak[] {
  const k = 30 / Math.max(1, o.days);
  const out: Leak[] = [];
  const fails = new Map<Family, number>();
  for (const s of [o.clientes, o.interno]) for (const p of s.proveedores) fails.set(p.familia, (fails.get(p.familia) ?? 0) + p.usdFallas);
  for (const [fam, usd] of fails) {
    if (usd <= 0) continue;
    const rows = [o.clientes, o.interno].flatMap((s) => s.proveedores.filter((p) => p.familia === fam));
    const n = rows.reduce((a, p) => a + p.intentos, 0), f = rows.reduce((a, p) => a + p.fallas, 0);
    out.push({ titulo: `Fallas de ${fam}`, usdMes: r2(usd * k), detalle: `${f} de ${n} generaciones fallaron (${n ? Math.round((f / n) * 100) : 0}%). Es el máximo que se pierde si el proveedor cobra lo que falla.` });
  }
  if (o.clientes.usdRehechosGratis > 0) out.push({ titulo: "Rehechos gratis por errores graves", usdMes: r2(o.clientes.usdRehechosGratis * k), detalle: "Cortes que la revisión rehízo sin cobrarle al cliente: Creads paga al proveedor." });
  const abandon = o.clientes.usdAbandonados + o.interno.usdAbandonados;
  if (abandon > 0) out.push({ titulo: "Anuncios empezados y nunca terminados", usdMes: r2(abandon * k), detalle: `${o.clientes.anunciosAbandonados + o.interno.anunciosAbandonados} anuncios gastaron en cortes pero no se terminaron (más de 1 día). Si es del cliente, lo pagó él; si es tuyo, lo pagaste tú.` });
  for (const p of o.planes) {
    if (p.queda >= 0) continue;
    const n = o.ordersByPlan[p.plan] ?? 0;
    out.push({ titulo: `${p.plan} · ${p.caso}: deja pérdida si se usan todos los créditos`, usdMes: r2(-p.queda * Math.max(1, n)), detalle: `Pierde US$${(-p.queda).toFixed(2)} por cliente${n ? ` (hubo ${n} venta${n > 1 ? "s" : ""} de este plan en el período)` : " (aún sin ventas de este plan: monto por cada cliente)"}.` });
  }
  return out.sort((a, b) => b.usdMes - a.usdMes);
}

export interface Tip { paso: string; hoy: string; alternativa: string; ahorroPct: number; ahorroMes: number; calidad: string }
const price = (models: CostoModelo[], id: string) => models.find((m) => m.id === id)?.usd ?? 0;
/** Steps that could use a cheaper (or open) model without lowering quality, with what it would save. */
export function cheaperSteps(models: CostoModelo[], spend: Partial<Record<Family, number>>, days: number): Tip[] {
  const k = 30 / Math.max(1, days);
  const tip = (paso: string, fam: Family, share: number, hoyId: string, altId: string, calidad: string): Tip | null => {
    const a = price(models, hoyId), b = price(models, altId);
    if (!a || !b || b >= a) return null;
    const pct = 1 - b / a;
    const nombre = (id: string) => models.find((m) => m.id === id)?.nombre ?? id;
    const unit = (id: string) => ({ s: "/s", img: " por imagen" } as Record<string, string>)[models.find((m) => m.id === id)?.unidad ?? "s"] ?? "";
    return { paso, hoy: `${nombre(hoyId)} (US$${a}${unit(hoyId)})`, alternativa: `${nombre(altId)} (US$${b}${unit(altId)})`, ahorroPct: Math.round(pct * 100), ahorroMes: r2((spend[fam] ?? 0) * share * pct * k), calidad };
  };
  return [
    tip("Cortes con persona hablando (UGC, podcast, entrevista)", "Veo", 0.5, "veo", "veo-fast", "Misma voz y labios con audio nativo, en 720p. Para anuncios de Reels casi no se nota; dejar Veo 3.1 completo solo para el hook si se quiere."),
    tip("Cortes sin cara real (producto, manos, ambientes)", "Seedance", 1, "seedance", "kling", "Kling 3.0 mueve bien producto y ambientes. Seedance además rechaza fotos de personas reales, que hoy obliga a reintentar."),
    tip("Planos de apoyo sin diálogo (b-roll)", "Kling", 0.3, "kling", "hailuo-23", "Hailuo 2.3 parte desde una imagen y no trae audio: sirve para planos de apoyo que van con la voz encima."),
    tip("Planos de apoyo con modelo abierto", "Veo", 0.15, "veo-fast", "wan-30", "Wan 3.0 es de pesos abiertos (se podría correr en servidor propio más adelante); calidad un poco menor en caras."),
    tip("Primer cuadro de cada escena (imagen)", "Nano Banana", 0.7, "tool-editar", "nano-banana-2", "Nano Banana 2 para la mayoría de las escenas; Pro solo cuando hay producto o texto que debe quedar perfecto."),
    tip("Borradores y vistas previas de imagen", "Nano Banana", 0.2, "nano-banana-2", "flux-3-klein", "FLUX 3 Klein es casi gratis: ideal para mostrar opciones antes de gastar en la imagen final."),
  ].filter((t): t is Tip => Boolean(t));
}
