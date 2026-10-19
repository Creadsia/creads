import { es } from "@/content/es";

// What customers can buy: the plans shown on the website and credit top-ups. Shared by the studio
// (to show prices) and the server (to compute the amount of an order), so both always agree.

export type Period = "mensual" | "anual";
export type ItemId = "starter" | "plus" | "studio" | "pack-500" | "pack-2000" | "pack-5000";

export const PLANS = es.pricing.plans.map((p) => ({
  id: p.id as ItemId,
  name: p.name,
  monthly: p.price,
  yearlyPerMonth: p.yearly,
  credits: Number(String(p.credits).replace(/\D/g, "")),
  for: p.for,
  features: p.features,
}));

// Same packs and prices as the website (content/*.ts → pricing.topups).
export const PACKS = [
  { id: "pack-500" as ItemId, credits: 500, usd: 25, note: "Para terminar el mes" },
  { id: "pack-2000" as ItemId, credits: 2000, usd: 89, note: "El más pedido" },
  { id: "pack-5000" as ItemId, credits: 5000, usd: 209, note: "Para agencias" },
];

/** Launch offer (owner, 19 Oct 2026): the first month of the monthly Starter plan costs US$49 (then US$119). */
export const LAUNCH_PRICE = 49;
/** The same offer as a % (for badges): 59%. */
export const LAUNCH_PCT = Math.round((1 - LAUNCH_PRICE / 119) * 100);
export const LAUNCH_ITEMS: ItemId[] = ["starter"];
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
}

/** The amount to pay for an item, in US$ (rounded to cents). */
export function quote(item: ItemId, period: Period, opts: { discountPct?: number; firstPurchase?: boolean } = {}): Quote | null {
  const plan = PLANS.find((p) => p.id === item);
  const pack = PACKS.find((p) => p.id === item);
  if (!plan && !pack) return null;
  const r = (n: number) => Math.round(n * 100) / 100;
  if (pack) {
    const discount = r((pack.usd * Math.min(100, Math.max(0, opts.discountPct ?? 0))) / 100);
    return { item, label: `${pack.credits.toLocaleString("es-CL")} créditos extra`, credits: pack.credits, subtotal: pack.usd, launch: 0, discount, total: r(pack.usd - discount), period: null };
  }
  const p = plan!;
  const subtotal = period === "anual" ? p.yearlyPerMonth * 12 : p.monthly;
  const launch = period === "mensual" && opts.firstPurchase && hasLaunch(item) ? r(Math.max(0, subtotal - LAUNCH_PRICE)) : 0;
  const discount = r(((subtotal - launch) * Math.min(100, Math.max(0, opts.discountPct ?? 0))) / 100);
  return {
    item, label: `Plan ${p.name} · ${period === "anual" ? "anual" : "mensual"}`, credits: p.credits * (period === "anual" ? 12 : 1),
    subtotal, launch, discount, total: r(subtotal - launch - discount), period,
  };
}

/** Prices as shown everywhere: US$ (e.g. US$59, US$29,50). */
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
