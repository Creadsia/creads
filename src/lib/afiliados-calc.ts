// Creads affiliate program (owner, 25 Oct 2026): the pure rules, with no server imports so the panels,
// the ledger and the tests share them.
//  - 30% of what the customer pays in their months 1–3, 20% in months 4–12, nothing after month 12.
//  - 60-day cookie, last click wins; a code typed at sign-up also counts.
//  - A commission becomes payable 30 days after the payment; payouts are monthly, from US$50.
//  - A refunded or charged-back payment takes its commission back.

export const PROGRAMA = {
  /** Months 1..mesesTramo1 earn pctTramo1; then pctTramo2 until maxMeses. */
  mesesTramo1: 3,
  pctTramo1: 30,
  pctTramo2: 20,
  maxMeses: 12,
  cookieDias: 60,
  retencionDias: 30,
  minimoUsd: 50,
  metodos: ["paypal", "wise", "banco"] as const,
} as const;

export const COOKIE_REF = "creads_ref";
export type MetodoPago = (typeof PROGRAMA.metodos)[number];
export const METODO_LABEL: Record<MetodoPago, string> = { paypal: "PayPal", wise: "Wise", banco: "Transferencia bancaria" };

export type EstadoAfiliado = "pendiente" | "activo" | "pausado" | "rechazado";

export interface DatosPago {
  metodo: MetodoPago;
  titular: string;
  /** PayPal or Wise email. */
  correo?: string;
  pais?: string;
  banco?: string;
  tipoCuenta?: string;
  cuenta?: string;
  /** RUT or tax id of the account holder. */
  idFiscal?: string;
  swift?: string;
  notas?: string;
  actualizado?: string;
}

export interface Afiliado {
  code: string;
  userId: string;
  email: string;
  name: string;
  /** The affiliate's own workspace (never earns on itself). */
  ws: string;
  estado: EstadoAfiliado;
  canal?: string;
  web?: string;
  mensaje?: string;
  creado: string;
  aprobado?: string;
  pago?: DatosPago;
  notas?: string;
}

export interface Referido {
  ws: string;
  email: string;
  at: string;
  via: "link" | "codigo";
  /** Calendar months (YYYY-MM) this customer has paid, in order: their position is the customer's month number. */
  meses: string[];
}

export interface Comision {
  /** The payment id ("mp:123"), or "rev:<payment id>" for a take-back of a commission already paid. */
  id: string;
  ws: string;
  orderId?: string;
  label?: string;
  at: string;
  /** Customer month numbers this payment covers (1-based). */
  meses: number[];
  /** What the customer paid, in US$ (pesos converted on the day). */
  baseUsd: number;
  moneda: string;
  monto: number;
  /** Months of plan the payment covers (0 = a top-up). */
  cubre: number;
  /** Effective % of the payment. */
  pct: number;
  /** The commission in US$ (negative for a take-back). */
  usd: number;
  estado: "activa" | "revertida";
  revertidaEn?: string;
  /** For a take-back: the payment it reverses. */
  revierte?: string;
  pagadoEn?: string;
  pagoId?: string;
}

export interface Libro {
  code: string;
  referidos: Referido[];
  comisiones: Comision[];
}

const DAY = 86_400_000;
const round2 = (n: number) => Math.round(n * 100) / 100;

export const normCode = (s: unknown) => String(s ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);
export const codeOk = (s: string) => /^[A-Z0-9][A-Z0-9-]{2,19}$/.test(s);

/** % the affiliate earns on the customer's month number `i` (1-based). */
export function pctForMonth(i: number) {
  if (!Number.isFinite(i) || i < 1) return 0;
  if (i <= PROGRAMA.mesesTramo1) return PROGRAMA.pctTramo1;
  if (i <= PROGRAMA.maxMeses) return PROGRAMA.pctTramo2;
  return 0;
}

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const addMonth = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));

/**
 * The commission of one payment. The customer's month number is the count of distinct calendar months they
 * have paid (a top-up in a month already paid is that same month). A payment covering several months (an
 * annual plan) is spread evenly over them, each at its own month's rate.
 */
export function comisionDe(o: { mesesPrevios: string[]; at: string; baseUsd: number; cubre: number }) {
  const n = Math.max(1, Math.round(o.cubre || 1));
  const start = new Date(o.at);
  const meses = [...o.mesesPrevios];
  const idx: number[] = [];
  for (let k = 0; k < n; k++) {
    const key = monthKey(addMonth(start, k));
    let i = meses.indexOf(key);
    if (i < 0) { meses.push(key); i = meses.length - 1; }
    idx.push(i + 1);
  }
  const part = o.baseUsd / n;
  const usd = round2(idx.reduce((a, i) => a + (part * pctForMonth(i)) / 100, 0));
  const pct = o.baseUsd > 0 ? Math.round((usd / o.baseUsd) * 10000) / 100 : 0;
  return { meses: idx, mesesNuevos: meses, usd, pct };
}

/** When a commission can be paid: 30 days after the payment (a take-back counts right away). */
export const disponibleDesde = (c: Pick<Comision, "at" | "usd">) => (c.usd < 0 ? Date.parse(c.at) : Date.parse(c.at) + PROGRAMA.retencionDias * DAY);

/** Commissions that would go in a payout made at `hasta`: active, unpaid, past the 30-day hold. */
export const pagables = (cs: Comision[], hasta: number) => cs.filter((c) => c.estado === "activa" && !c.pagadoEn && c.usd !== 0 && disponibleDesde(c) <= hasta);

export interface Saldos {
  /** Earned, still inside the 30-day hold. */
  pendiente: number;
  /** Past the hold and unpaid (net of take-backs). */
  pagable: number;
  pagado: number;
  revertido: number;
  /** pagable reaches the US$50 minimum. */
  listo: boolean;
}

export function saldos(cs: Comision[], now = Date.now()): Saldos {
  let pendiente = 0, pagado = 0, revertido = 0;
  for (const c of cs) {
    if (c.estado === "revertida") { revertido += c.usd; continue; }
    if (c.pagadoEn) { pagado += c.usd; continue; }
    if (disponibleDesde(c) > now) pendiente += c.usd;
  }
  const pagable = round2(pagables(cs, now).reduce((a, c) => a + c.usd, 0));
  return { pendiente: round2(pendiente), pagable, pagado: round2(pagado), revertido: round2(revertido), listo: pagable >= PROGRAMA.minimoUsd };
}

/**
 * Takes back the commission of a refunded payment: still unpaid → marked reversed; already paid → a negative
 * entry that comes off the next payout. Returns the new list, or null when there is nothing to do (unknown
 * payment, already reversed).
 */
export function revertir(cs: Comision[], paymentId: string, now = new Date().toISOString()): Comision[] | null {
  const c = cs.find((x) => x.id === paymentId);
  if (!c || c.estado === "revertida" || c.usd === 0) return null;
  if (!c.pagadoEn) return cs.map((x) => (x === c ? { ...x, estado: "revertida" as const, revertidaEn: now } : x));
  if (cs.some((x) => x.revierte === paymentId)) return null;
  return [...cs, { ...c, id: `rev:${paymentId}`, at: now, usd: -c.usd, pct: -c.pct, revierte: paymentId, pagadoEn: undefined, pagoId: undefined, label: `Devolución · ${c.label ?? paymentId}` }];
}

/** Marks as paid what was payable at `hasta`. Returns the new list and the total paid. */
export function marcarPagado(cs: Comision[], hasta: number, pagoId: string, now = new Date().toISOString()) {
  const ids = new Set(pagables(cs, hasta).map((c) => c.id));
  const total = round2(cs.filter((c) => ids.has(c.id)).reduce((a, c) => a + c.usd, 0));
  return { comisiones: cs.map((c) => (ids.has(c.id) ? { ...c, pagadoEn: now, pagoId } : c)), total, n: ids.size };
}

/** The base of an email for the self-referral check: lower case, no «+tag», Gmail dots ignored. */
export function emailBase(e: string) {
  const [local = "", domain = ""] = e.trim().toLowerCase().split("@");
  const l = local.split("+")[0];
  const d = domain === "googlemail.com" ? "gmail.com" : domain;
  return `${d === "gmail.com" ? l.replace(/\./g, "") : l}@${d}`;
}

/** True when the customer is the affiliate (same email or same workspace): no commission. */
export const autoReferido = (a: Pick<Afiliado, "email" | "ws">, c: { email?: string; ws?: string }) =>
  Boolean((c.ws && c.ws === a.ws) || (c.email && emailBase(c.email) === emailBase(a.email)));

/** Customers paying now and the monthly revenue they bring (plans only; an annual plan counts as 1/12 a month). */
export function mrrDe(cs: Comision[], now = Date.now()) {
  const last = new Map<string, Comision>();
  for (const c of cs) {
    if (c.estado !== "activa" || c.usd < 0 || c.cubre < 1) continue;
    const prev = last.get(c.ws);
    if (!prev || prev.at < c.at) last.set(c.ws, c);
  }
  let mrr = 0, pagando = 0;
  for (const c of last.values()) {
    // a monthly plan stays "paying" a few days past its month (renewals arrive late sometimes)
    if (Date.parse(c.at) + (c.cubre * 31 + 5) * DAY < now) continue;
    pagando++;
    mrr += c.baseUsd / c.cubre;
  }
  return { pagando, mrr: round2(mrr) };
}

/** The email shown to the affiliate: enough to recognise it, not the whole address. */
export const maskEmail = (e: string) => {
  const [l = "", d = ""] = e.split("@");
  return `${l.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(6, l.length - 2)))}@${d}`;
};

const csvCell = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // never a formula when opened in a spreadsheet
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
