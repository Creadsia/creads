import { es } from "@/content/es";
import { fmtSeconds, secondsOf } from "./credit-math";

// What customers can buy: the plans shown on the website and credit top-ups. Shared by the studio
// (to show prices) and the server (to compute the amount of an order), so both always agree.

export type Period = "mensual" | "anual";
export type ItemId = "testea" | "escala" | "agencia" | "basico" | "starter" | "plus" | "studio" | "pack-500" | "pack-1000" | "pack-3000" | "pack-prueba";

export const PLANS = es.pricing.plans.map((p) => ({
  id: p.id as ItemId,
  name: p.name,
  monthly: p.price,
  yearlyPerMonth: p.yearly,
  credits: Number(String(p.credits).replace(/\D/g, "")),
  for: p.for,
  features: p.features,
  /** Kept for customers who already have it, not sold any more (Ultra since 21 Oct 2026; Básico, Emprende and Negocio since 25 Oct 2026). */
  hidden: Boolean((p as { hidden?: boolean }).hidden),
  /** The plan the page highlights (Escala). */
  featured: Boolean((p as { featured?: boolean }).featured),
  /** What the monthly balance is worth, as shown to customers («hasta 47 imágenes o 3 videos»). */
  imagenes: Number((p as { imagenes?: number }).imagenes ?? 0),
  videos: Number((p as { videos?: number }).videos ?? 0),
}));
/** The plans on sale (shown on the website and in «Planes»). */
export const SHOWN_PLANS = PLANS.filter((p) => !p.hidden);

// Same packs and prices as the website (content/*.ts → pricing.topups).
export const PACKS = [
  { id: "pack-500" as ItemId, credits: 500, usd: 29, note: "Para terminar el mes" },
  { id: "pack-1000" as ItemId, credits: 1000, usd: 55, note: "El más pedido" },
  { id: "pack-3000" as ItemId, credits: 3000, usd: 139, note: "Para los meses fuertes" },
];

/**
 * «Pack Prueba» (owner's plan, 25 Oct 2026): US$9 paid once, no plan needed: up to 12 images or 1 avatar video
 * (125 credits ≈ US$2.4 of AI at most). If the customer subscribes within 7 days, the US$9 come off the first
 * month. Replaces the free gift and the card trial. Fires Purchase.
 */
export const PRUEBA = { id: "pack-prueba" as ItemId, credits: 125, usd: 9, note: "Hasta 12 imágenes o 1 video con avatar" };
/** Days after buying the pack in which its price comes off the first month of a plan. */
export const PRUEBA_DESCUENTO_DIAS = 7;

/** Precio fundador: Escala at US$49 for the first 3 months, for the first 50 customers (real counter). */
export const FUNDADOR = { plan: "escala" as ItemId, usd: 49, months: 3, cupos: 50 };

/**
 * No cheaper first month (the founder price and the pack discount replace it). The launch-offer machinery stays
 * (empty) so an offer can come back by listing a plan here.
 */
export const LAUNCH_ITEMS: ItemId[] = [];
/** The cheapest plan: Testea's monthly price. */
export const LAUNCH_PRICE = PLANS.find((p) => p.id === "testea")?.monthly ?? 29;
export const LAUNCH_PCT = 0;
/** Yearly plans: 5% off (owner's plan, 25 Oct 2026), paid once for 12 months. */
export const ANNUAL = true;
export const ANNUAL_PCT = 5;
/** Any offer to show (a cheaper first month or a yearly discount). */
export const HAS_OFFER = LAUNCH_ITEMS.length > 0 || ANNUAL;
export const hasLaunch = (item: string) => (LAUNCH_ITEMS as string[]).includes(item);

export interface Quote {
  item: ItemId;
  label: string;
  credits: number;
  subtotal: number;
  launch: number;
  discount: number;
  total: number;
  period: Period | null;
  /** US$ off the first month for the founder price (Escala at US$49) */
  fundador?: number;
  /** US$ off the first month: the Pack Prueba bought in the last 7 days */
  pack?: number;
  /** order id of the pack whose price was discounted (used once) */
  packOrder?: string;
}

/** The amount to pay for an item, in US$ (rounded to cents). */
/** Whether an item can be bought now: retired plans (Ultra) and the annual payment are not on sale. */
export function onSale(item: ItemId, period: Period) {
  if (PACKS.some((p) => p.id === item) || item === PRUEBA.id) return true;
  return SHOWN_PLANS.some((p) => p.id === item) && (period === "mensual" || ANNUAL);
}

export function quote(item: ItemId, period: Period, opts: { discountPct?: number; firstPurchase?: boolean; fundador?: boolean; pack?: { order: string; usd: number } | null } = {}): Quote | null {
  const plan = PLANS.find((p) => p.id === item);
  const pack = PACKS.find((p) => p.id === item) ?? (item === PRUEBA.id ? PRUEBA : undefined);
  if (!plan && !pack) return null;
  const r = (n: number) => Math.round(n * 100) / 100;
  if (pack) {
    // a pack is always paid in full (the Pack Prueba is the way in; customer discounts apply to plans)
    if (item === PRUEBA.id) return { item, label: "Pack Prueba (hasta 12 imágenes o 1 video)", credits: pack.credits, subtotal: pack.usd, launch: 0, discount: 0, total: pack.usd, period: null };
    const discount = r((pack.usd * Math.min(100, Math.max(0, opts.discountPct ?? 0))) / 100);
    return { item, label: item === PRUEBA.id ? "Video de prueba (15 s)" : `${pack.credits.toLocaleString("es-CL")} créditos extra`, credits: pack.credits, subtotal: pack.usd, launch: 0, discount, total: r(pack.usd - discount), period: null };
  }
  const p = plan!;
  const subtotal = period === "anual" ? p.yearlyPerMonth * 12 : p.monthly;
  const launch = period === "mensual" && opts.firstPurchase && hasLaunch(item) ? r(Math.max(0, subtotal - LAUNCH_PRICE)) : 0;
  const discount = r(((subtotal - launch) * Math.min(100, Math.max(0, opts.discountPct ?? 0))) / 100);
  const fundador = period === "mensual" && opts.fundador && item === FUNDADOR.plan ? r(Math.max(0, p.monthly - FUNDADOR.usd)) : 0;
  const packOff = opts.pack && opts.pack.usd > 0 ? r(Math.min(opts.pack.usd, subtotal - launch - discount - fundador - 1)) : 0;
  return {
    item, label: `Plan ${p.name} · ${period === "anual" ? "anual" : "mensual"}${fundador ? " · precio fundador" : ""}`, credits: p.credits * (period === "anual" ? 12 : 1),
    subtotal, launch, discount, total: r(subtotal - launch - discount - fundador - packOff), period,
    ...(fundador ? { fundador } : {}), ...(packOff > 0 ? { pack: packOff, packOrder: opts.pack!.order } : {}),
  };
}

/** Prices as shown everywhere: US$ (e.g. US$15, US$29,50). */
export const usd = (n: number) => `US$${n.toLocaleString("es-CL", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** Price in Chilean pesos (Mercado Pago charges in CLP): rounded to a ...990 price. */
export function clpFor(usd: number, usdClp = 950) {
  if (!(usd > 0)) return 0;
  return Math.max(990, Math.round((usd * usdClp) / 1000) * 1000 - 10);
}

export const METHODS = [
  { id: "mercadopago", name: "Tarjeta o Mercado Pago", hint: "Crédito, débito o saldo de Mercado Pago, en pesos chilenos. Pagas en la ventana segura de Mercado Pago: Creads nunca ve tu tarjeta." },
] as const;
export type MethodId = (typeof METHODS)[number]["id"];
