// Affiliate program: commission calendar, 30-day hold, US$50 minimum, reversal, self-referral.
// Run: npx tsx --test tests/afiliados.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type Comision, PROGRAMA, autoReferido, codeOk, comisionDe, marcarPagado, mrrDe, normCode, pctForMonth, revertir, saldos, toCsv,
} from "../src/lib/afiliados-calc";
import { afTotal, DEFAULT_FINANZAS } from "../src/lib/finance";

const DAY = 86_400_000;

/** Runs a customer's payments through the calendar like the ledger does. */
function pagar(pagos: { at: string; usd: number; cubre?: number }[]) {
  let meses: string[] = [];
  return pagos.map((p, i): Comision => {
    const k = comisionDe({ mesesPrevios: meses, at: p.at, baseUsd: p.usd, cubre: p.cubre ?? 1 });
    meses = k.mesesNuevos;
    return { id: `mp:${i}`, ws: "c-1", at: p.at, meses: k.meses, baseUsd: p.usd, moneda: "USD", monto: p.usd, cubre: p.cubre ?? 1, pct: k.pct, usd: k.usd, estado: "activa" };
  });
}

test("calendar: 30% months 1–3, 20% months 4–12, nothing from month 13", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 12, 13, 24].map(pctForMonth), [0, 30, 30, 30, 20, 20, 0, 0]);
  const cs = pagar(Array.from({ length: 14 }, (_, i) => ({ at: new Date(Date.UTC(2026, 10 + i, 5)).toISOString(), usd: 50 })));
  assert.deepEqual(cs.map((c) => c.meses[0]), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  assert.deepEqual(cs.map((c) => c.usd), [15, 15, 15, 10, 10, 10, 10, 10, 10, 10, 10, 10, 0, 0]);
  assert.equal(cs.reduce((a, c) => a + c.usd, 0), 135, "a US$50/month customer leaves US$135 over 12 months");
});

test("calendar: a top-up in a month already paid is the same month; a skipped month doesn't count", () => {
  const cs = pagar([
    { at: "2026-11-02T10:00:00Z", usd: 50 }, // month 1
    { at: "2026-11-20T10:00:00Z", usd: 10 }, // top-up, still month 1 → 30%
    { at: "2027-01-03T10:00:00Z", usd: 50 }, // December not paid: month 2
  ]);
  assert.deepEqual(cs.map((c) => c.meses), [[1], [1], [2]]);
  assert.deepEqual(cs.map((c) => c.usd), [15, 3, 15]);
});

test("calendar: an annual plan is spread over its 12 months, each at its own rate", () => {
  const [c] = pagar([{ at: "2026-11-02T10:00:00Z", usd: 600, cubre: 12 }]);
  assert.deepEqual(c.meses, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(c.usd, 3 * 15 + 9 * 10); // 50/month: 3 × 30% + 9 × 20%
  assert.equal(c.pct, 22.5);
});

test("30-day hold and US$50 minimum", () => {
  const t0 = Date.parse("2026-11-01T00:00:00Z");
  const cs = pagar([{ at: new Date(t0).toISOString(), usd: 100 }, { at: new Date(t0 + 40 * DAY).toISOString(), usd: 100 }]);
  // day 10: everything pending
  let s = saldos(cs, t0 + 10 * DAY);
  assert.deepEqual([s.pendiente, s.pagable, s.listo], [60, 0, false]);
  // day 31: the first one is payable, but US$30 is below the minimum
  s = saldos(cs, t0 + 31 * DAY);
  assert.deepEqual([s.pendiente, s.pagable, s.listo], [30, 30, false]);
  // day 71: both payable, US$60 ≥ US$50
  s = saldos(cs, t0 + 71 * DAY);
  assert.deepEqual([s.pendiente, s.pagable, s.listo], [0, 60, true]);
  assert.equal(PROGRAMA.minimoUsd, 50);
  // paying at day 71 pays exactly what was payable then
  const m = marcarPagado(cs, t0 + 71 * DAY, "P-1", new Date(t0 + 72 * DAY).toISOString());
  assert.deepEqual([m.n, m.total], [2, 60]);
  s = saldos(m.comisiones, t0 + 80 * DAY);
  assert.deepEqual([s.pagable, s.pagado], [0, 60]);
});

test("payout list cut-off: a commission that becomes payable after the list was made isn't marked paid", () => {
  const t0 = Date.parse("2026-11-01T00:00:00Z");
  const cs = pagar([{ at: new Date(t0).toISOString(), usd: 200 }, { at: new Date(t0 + 5 * DAY).toISOString(), usd: 100 }]);
  const m = marcarPagado(cs, t0 + 31 * DAY, "P-1");
  assert.equal(m.n, 1);
  assert.equal(m.total, 60);
  assert.ok(!m.comisiones[1].pagadoEn);
});

test("reversal: unpaid → cancelled; already paid → comes off the next payout; only once", () => {
  const t0 = Date.parse("2026-11-01T00:00:00Z");
  const cs = pagar([{ at: new Date(t0).toISOString(), usd: 200 }, { at: new Date(t0 + 31 * DAY).toISOString(), usd: 200 }]);
  // the second one (unpaid) is refunded
  const r1 = revertir(cs, "mp:1")!;
  assert.equal(r1[1].estado, "revertida");
  assert.equal(saldos(r1, t0 + 100 * DAY).pagable, 60);
  assert.equal(saldos(r1, t0 + 100 * DAY).revertido, 60);
  assert.equal(revertir(r1, "mp:1"), null, "twice does nothing");
  assert.equal(revertir(r1, "mp:999"), null, "unknown payment does nothing");
  // the first one was paid, then charged back: a negative entry, payable right away
  const paid = marcarPagado(r1, t0 + 40 * DAY, "P-1").comisiones;
  const r2 = revertir(paid, "mp:0", new Date(t0 + 50 * DAY).toISOString())!;
  assert.equal(r2.length, 3);
  assert.equal(r2[2].usd, -60);
  assert.equal(r2[2].revierte, "mp:0");
  assert.equal(saldos(r2, t0 + 50 * DAY).pagable, -60);
  assert.equal(revertir(r2, "mp:0"), null, "the take-back is written once");
});

test("self-referral: same email (with +tags or Gmail dots) or same workspace", () => {
  const a = { email: "Ana.Perez@gmail.com", ws: "ana-1" };
  assert.ok(autoReferido(a, { email: "anaperez+creads@gmail.com" }));
  assert.ok(autoReferido(a, { ws: "ana-1" }));
  assert.ok(!autoReferido(a, { email: "otra@gmail.com", ws: "otra-2" }));
});

test("codes and CSV", () => {
  assert.equal(normCode(" ana25 "), "ANA25");
  assert.ok(codeOk("ANA25"));
  assert.ok(!codeOk("AB"));
  assert.ok(!codeOk(normCode("a")));
  assert.equal(toCsv([["a", "b,c", "=1+1"]]), 'a,"b,c",\'=1+1\n');
});

test("MRR: active plan customers only, annual counted per month", () => {
  const now = Date.parse("2026-12-10T00:00:00Z");
  const base: Omit<Comision, "id" | "ws" | "at" | "baseUsd" | "cubre"> = { meses: [1], moneda: "USD", monto: 0, pct: 30, usd: 1, estado: "activa" };
  const cs: Comision[] = [
    { ...base, id: "a", ws: "w1", at: "2026-12-01T00:00:00Z", baseUsd: 50, cubre: 1 },
    { ...base, id: "b", ws: "w2", at: "2026-06-01T00:00:00Z", baseUsd: 600, cubre: 12 },
    { ...base, id: "c", ws: "w3", at: "2026-08-01T00:00:00Z", baseUsd: 50, cubre: 1 }, // lapsed
    { ...base, id: "d", ws: "w4", at: "2026-12-01T00:00:00Z", baseUsd: 20, cubre: 0 }, // top-up only
  ];
  assert.deepEqual(mrrDe(cs, now), { pagando: 2, mrr: 100 });
});

test("finance book: projection uses the same two-tier program", () => {
  const a = DEFAULT_FINANZAS.config.afiliado;
  assert.equal(afTotal({ ...a, vida: 12 }, 50), 135);
  assert.equal(afTotal({ ...a, vida: 24 }, 50), 135, "nothing after month 12");
  assert.equal(afTotal({ ...a, vida: 2 }, 50), 30);
});
