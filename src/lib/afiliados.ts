import { randomBytes } from "node:crypto";
import { readPrivateJSON, updatePrivateJSON } from "./supabase";
import { usdClpRate } from "./usd-clp";
import {
  type Afiliado, type Comision, type DatosPago, type EstadoAfiliado, type Libro, type Referido,
  COOKIE_REF, PROGRAMA, autoReferido, codeOk, comisionDe, marcarPagado, mrrDe, normCode, revertir, saldos,
} from "./afiliados-calc";

// The affiliate program's records, in private JSON files (no tables: tens of affiliates, hundreds of customers):
//   afiliados/index.json            every affiliate (application, status, payout details)
//   afiliados/libro/<CODE>.json     the customers they brought and the commission ledger
//   afiliados/clientes/<ws>.json    which affiliate brought a workspace (written once, at sign-up)
//   afiliados/clics/<CODE>.json     link clicks
// Every change goes through updatePrivateJSON (read → change → write under a lock).

const INDEX = "afiliados/index.json";
const libroPath = (code: string) => `afiliados/libro/${code}.json`;
const clientePath = (ws: string) => `afiliados/clientes/${encodeURIComponent(ws)}.json`;
const clicsPath = (code: string) => `afiliados/clics/${code}.json`;

interface Index { afiliados: Afiliado[] }
export interface Atribucion { ws: string; code: string; email: string; at: string; via: "link" | "codigo" }
interface Clics { total: number; dias: Record<string, number> }

const asIndex = (x: unknown): Index => (x && typeof x === "object" && Array.isArray((x as Index).afiliados) ? (x as Index) : { afiliados: [] });
const asLibro = (x: unknown, code: string): Libro => {
  const l = x && typeof x === "object" ? (x as Partial<Libro>) : {};
  return { code, referidos: Array.isArray(l.referidos) ? l.referidos : [], comisiones: Array.isArray(l.comisiones) ? l.comisiones : [] };
};

export async function listAfiliados(): Promise<Afiliado[]> {
  return asIndex(await readPrivateJSON<Index>(INDEX)).afiliados;
}
export const afiliadoPorCodigo = async (code: string) => (await listAfiliados()).find((a) => a.code === normCode(code)) ?? null;
export const afiliadoDeUsuario = async (userId: string) => (await listAfiliados()).find((a) => a.userId === userId) ?? null;
export const libroDe = async (code: string) => asLibro(await readPrivateJSON<Libro>(libroPath(code)), code);
export const clicsDe = async (code: string): Promise<Clics> => {
  const c = await readPrivateJSON<Clics>(clicsPath(code)).catch(() => null);
  return c && typeof c.total === "number" ? c : { total: 0, dias: {} };
};

async function atribucionDe(ws: string): Promise<Atribucion | null> {
  const a = await readPrivateJSON<Atribucion>(clientePath(ws)).catch(() => null);
  return a && typeof a === "object" && typeof a.code === "string" && a.code ? a : null;
}

function nuevoCodigo(name: string, taken: Set<string>) {
  const base = normCode(name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "")).replace(/-/g, "").slice(0, 10) || "CREADS";
  for (let i = 0; i < 20; i++) {
    const c = `${base.length >= 3 ? base : `${base}AF`}${randomBytes(2).readUInt16BE() % 1000}`;
    if (!taken.has(c)) return c;
  }
  return `AF${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** A Creads user applies to the program (one application per person). */
export async function postular(u: { id: string; email: string; name: string | null; workspace: string }, o: { name: string; canal: string; web: string; mensaje: string; code?: string }) {
  let out: Afiliado | null = null;
  let error = "";
  await updatePrivateJSON<Index>(INDEX, (cur) => {
    const idx = asIndex(cur);
    const mine = idx.afiliados.find((a) => a.userId === u.id);
    if (mine) { out = mine; return undefined; }
    const taken = new Set(idx.afiliados.map((a) => a.code));
    let code = normCode(o.code);
    if (code && (!codeOk(code) || taken.has(code) || code === "CREADS")) { error = "Ese código ya está en uso o no sirve: usa de 3 a 20 letras o números."; return undefined; }
    if (!code) code = nuevoCodigo(o.name || u.name || u.email.split("@")[0], taken);
    out = { code, userId: u.id, email: u.email, name: o.name || u.name || "", ws: u.workspace, estado: "pendiente", canal: o.canal, web: o.web, mensaje: o.mensaje, creado: new Date().toISOString() };
    idx.afiliados.push(out);
    return idx;
  });
  if (error) throw new Error(error);
  return out as Afiliado | null;
}

/** Admin: approve, pause, reactivate or reject an affiliate. */
export async function setEstado(code: string, estado: EstadoAfiliado, notas?: string) {
  let found: Afiliado | null = null;
  await updatePrivateJSON<Index>(INDEX, (cur) => {
    const idx = asIndex(cur);
    const a = idx.afiliados.find((x) => x.code === code);
    if (!a) return undefined;
    a.estado = estado;
    if (estado === "activo" && !a.aprobado) a.aprobado = new Date().toISOString();
    if (notas !== undefined) a.notas = notas.slice(0, 500);
    found = a;
    return idx;
  });
  return found as Afiliado | null;
}

/** The affiliate fills in where to receive the money. */
export async function guardarDatosPago(userId: string, pago: DatosPago) {
  let ok = false;
  await updatePrivateJSON<Index>(INDEX, (cur) => {
    const idx = asIndex(cur);
    const a = idx.afiliados.find((x) => x.userId === userId);
    if (!a) return undefined;
    a.pago = { ...pago, actualizado: new Date().toISOString() };
    ok = true;
    return idx;
  });
  return ok;
}

/** Counts a click on an affiliate's link (only for active affiliates). */
export async function contarClic(code: string) {
  const a = await afiliadoPorCodigo(code);
  if (!a || a.estado !== "activo") return false;
  const day = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);
  await updatePrivateJSON<Clics>(clicsPath(a.code), (cur) => {
    const c = cur && typeof cur.total === "number" ? cur : { total: 0, dias: {} };
    c.total++;
    c.dias[day] = (c.dias[day] ?? 0) + 1;
    for (const d of Object.keys(c.dias)) if (d < cutoff) delete c.dias[d];
    return c;
  });
  return true;
}

/**
 * At sign-up: the customer's workspace is tied to the affiliate whose link they clicked last (cookie) or whose
 * code they typed (the typed one wins: it's the latest thing they did). Only active affiliates; never the
 * affiliate themself. Written once: a workspace never changes affiliate. Never throws.
 */
export async function atribuirRegistro(o: { ws: string; email: string; cookie?: string | null; codigo?: string | null }): Promise<Atribucion | null> {
  try {
    const typed = normCode(o.codigo);
    const fromCookie = normCode(o.cookie);
    const code = typed || fromCookie;
    if (!code) return null;
    const a = await afiliadoPorCodigo(code);
    if (!a || a.estado !== "activo" || autoReferido(a, { email: o.email, ws: o.ws })) return null;
    if (await atribucionDe(o.ws)) return null;
    const at: Atribucion = { ws: o.ws, code: a.code, email: o.email, at: new Date().toISOString(), via: typed && typed !== fromCookie ? "codigo" : "link" };
    let wrote = false;
    await updatePrivateJSON<Atribucion>(clientePath(o.ws), (cur) => {
      if (cur && typeof cur === "object" && cur.code) return undefined;
      wrote = true;
      return at;
    });
    if (!wrote) return null;
    await updatePrivateJSON<Libro>(libroPath(a.code), (cur) => {
      const l = asLibro(cur, a.code);
      if (l.referidos.some((r) => r.ws === o.ws)) return undefined;
      l.referidos.push({ ws: o.ws, email: o.email, at: at.at, via: at.via, meses: [] });
      return l;
    });
    return at;
  } catch (e) {
    console.error("afiliados: atribución", o.ws, e instanceof Error ? e.message : e);
    return null;
  }
}

/** The affiliate code remembered in the browser (cookie set by the middleware on «?ref=»). */
export function refDeRequest(req: Request) {
  const m = (req.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${COOKIE_REF}=([^;]+)`));
  return m ? normCode(decodeURIComponent(m[1])) : "";
}

export interface PagoCliente {
  /** Unique per payment, with its source: "mp:123", "manual:…", later "stripe:pi_…". */
  paymentId: string;
  ws: string;
  amount: number;
  /** "CLP" or "USD". */
  currency: string;
  /** Months of plan the payment covers (0 for a top-up). */
  months: number;
  at?: string;
  orderId?: string;
  label?: string;
}

/**
 * The generic payment hook (Mercado Pago today, Stripe later): if the paying workspace came through an
 * affiliate, writes the commission of this payment in their ledger following the program's calendar. Once per
 * payment id. Never throws: a problem here must never break a payment.
 */
export async function comisionPorPago(p: PagoCliente): Promise<Comision | null> {
  try {
    const at = await atribucionDe(p.ws);
    if (!at) return null;
    const a = await afiliadoPorCodigo(at.code);
    // a paused or rejected affiliate earns nothing new; nobody earns on their own account
    if (!a || a.estado !== "activo" || autoReferido(a, { ws: p.ws })) return null;
    const cur = String(p.currency).toUpperCase();
    if (!(p.amount > 0) || (cur !== "CLP" && cur !== "USD")) return null;
    const baseUsd = cur === "USD" ? p.amount : Math.round((p.amount / (await usdClpRate())) * 100) / 100;
    const when = p.at && !Number.isNaN(Date.parse(p.at)) ? new Date(p.at).toISOString() : new Date().toISOString();
    let made: Comision | null = null;
    await updatePrivateJSON<Libro>(libroPath(a.code), (raw) => {
      const l = asLibro(raw, a.code);
      if (l.comisiones.some((c) => c.id === p.paymentId)) return undefined;
      let r: Referido | undefined = l.referidos.find((x) => x.ws === p.ws);
      if (!r) { r = { ws: p.ws, email: at.email, at: at.at, via: at.via, meses: [] }; l.referidos.push(r); }
      const k = comisionDe({ mesesPrevios: r.meses ?? [], at: when, baseUsd, cubre: p.months });
      r.meses = k.mesesNuevos;
      made = {
        id: p.paymentId, ws: p.ws, orderId: p.orderId, label: p.label?.slice(0, 120), at: when, meses: k.meses,
        baseUsd, moneda: cur, monto: p.amount, cubre: Math.max(0, Math.round(p.months)), pct: k.pct, usd: k.usd, estado: "activa",
      };
      l.comisiones.push(made);
      return l;
    });
    return made;
  } catch (e) {
    console.error("afiliados: comisión", p.paymentId, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * A payment was refunded or charged back: its commission is taken back (unpaid → reversed; already paid →
 * comes off the next payout). `ws` makes it direct; without it every ledger is searched. Never throws.
 */
export async function reverseCommission(paymentId: string, ws?: string): Promise<boolean> {
  try {
    let codes: string[] = [];
    const at = ws ? await atribucionDe(ws) : null;
    if (at) codes = [at.code];
    else if (!ws) codes = (await listAfiliados()).map((a) => a.code);
    let done = false;
    for (const code of codes) {
      await updatePrivateJSON<Libro>(libroPath(code), (raw) => {
        const l = asLibro(raw, code);
        const next = revertir(l.comisiones, paymentId);
        if (!next) return undefined;
        done = true;
        return { ...l, comisiones: next };
      });
      if (done) break;
    }
    if (done) console.warn("afiliados: comisión revertida", paymentId);
    return done;
  } catch (e) {
    console.error("afiliados: revertir", paymentId, e instanceof Error ? e.message : e);
    return false;
  }
}

/** Admin: marks as paid what was payable at `hasta` (the moment the payout list was made). */
export async function registrarPago(code: string, hasta: number) {
  const pagoId = `P-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(2).toString("hex")}`;
  let res = { total: 0, n: 0, pagoId };
  await updatePrivateJSON<Libro>(libroPath(code), (raw) => {
    const l = asLibro(raw, code);
    const m = marcarPagado(l.comisiones, Math.min(hasta, Date.now()), pagoId);
    if (!m.n || m.total <= 0) return undefined;
    res = { total: m.total, n: m.n, pagoId };
    return { ...l, comisiones: m.comisiones };
  });
  return res;
}

/** Everything the affiliate's panel (and the admin list) shows about one affiliate. */
export async function resumenDe(a: Afiliado, now = Date.now()) {
  const [l, clics] = await Promise.all([libroDe(a.code), clicsDe(a.code)]);
  const s = saldos(l.comisiones, now);
  const m = mrrDe(l.comisiones, now);
  const pagaron = new Set(l.comisiones.filter((c) => c.estado === "activa" && c.usd >= 0).map((c) => c.ws)).size;
  return { clics: clics.total, clicsDias: clics.dias, registros: l.referidos.length, pagaron, pagando: m.pagando, mrr: m.mrr, ...s, libro: l };
}

export { PROGRAMA };
