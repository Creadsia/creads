import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSpells, periodStats, reasonCounts, type OrderLite, type PayRow } from "../src/lib/retention";

const PLANS = [{ id: "starter", name: "Emprende", monthly: 55, yearlyPerMonth: 55 }, { id: "plus", name: "Negocio", monthly: 99, yearlyPerMonth: 99 }];
const T = (d: string) => Date.parse(`${d}T12:00:00Z`);
const M = (m: string) => Date.parse(`${m}-01T04:00:00Z`); // month start (Chile, roughly)
let n = 0;
const pay = (owner: string, order: string, d: string): PayRow => ({ id: `mp:${++n}`, order_id: order, owner, amount: 50000, currency: "CLP", created_at: `${d}T12:00:00Z` });
const order = (id: string, owner: string, item: string, cancelled = false): OrderLite => ({ id, owner, item, period: "mensual", mp: { kind: "subscription", cancelled }, created_at: "2026-01-01T00:00:00Z" });

test("retention: renewals keep a customer; a scheduled cancellation is churn only when access ends", () => {
  const orders = [order("a1", "a", "starter"), order("b1", "b", "plus", true), order("c1", "c", "starter")];
  const pays = [
    pay("a", "a1", "2026-07-10"), pay("a", "a1", "2026-08-10"), pay("a", "a1", "2026-09-10"), pay("a", "a1", "2026-10-10"), // a renews every month
    pay("b", "b1", "2026-07-20"), pay("b", "b1", "2026-08-20"), // b cancelled: paid access until 20 Sep
    pay("c", "c1", "2026-08-05"), // c paid once, no renewal: access until 5 Sep, lost after the grace days
  ];
  const spells = buildSpells(pays, orders, PLANS, T("2026-10-22"));
  const aug = periodStats(spells, M("2026-08"), M("2026-09"));
  assert.equal(aug.base, 2); // a and b (c is new in August: not in the denominator)
  assert.equal(aug.perdidos, 0); // b's cancellation is scheduled, access still paid
  assert.equal(aug.churn, 0);
  assert.equal(aug.nuevas, 1);
  const sep = periodStats(spells, M("2026-09"), M("2026-10"));
  assert.equal(sep.base, 3);
  assert.equal(sep.perdidos, 2); // b (access ended 20 Sep) and c (ended 5 Sep, no charge)
  assert.equal(sep.churn, 66.7);
  assert.equal(sep.mrrPerdido, 99 + 55);
  assert.equal(sep.retencion, 33.3);
});

test("retention: a late renewal inside the grace days isn't churn; an upgrade is expansion", () => {
  const orders = [order("a1", "a", "starter"), order("a2", "a", "plus")];
  const pays = [pay("a", "a1", "2026-08-01"), pay("a", "a2", "2026-09-04")]; // 3 days late, and moves to Negocio
  const spells = buildSpells(pays, orders, PLANS, T("2026-10-22"));
  assert.equal(spells.length, 1);
  const sep = periodStats(spells, M("2026-09"), M("2026-10"));
  assert.equal(sep.perdidos, 0);
  assert.equal(sep.mrrExpansion, 44);
  assert.equal(sep.nrr, 180);
});

test("retention: paying again after a long gap is a reactivation, not a new customer", () => {
  const orders = [order("a1", "a", "starter")];
  const spells = buildSpells([pay("a", "a1", "2026-05-01"), pay("a", "a1", "2026-09-15")], orders, PLANS, T("2026-10-22"));
  assert.equal(spells.length, 2);
  const sep = periodStats(spells, M("2026-09"), M("2026-10"));
  assert.equal(sep.reactivaciones, 1);
  assert.equal(sep.nuevas, 0);
});

test("reasons: old wording maps to the new options", () => {
  assert.deepEqual(reasonCounts([{ ws: "x", at: "", reason: "Es muy caro" }, { ws: "y", at: "", reason: "Precio demasiado elevado" }, { ws: "z", at: "", reason: "Problemas técnicos" }]), [{ motivo: "Precio demasiado elevado", n: 2 }, { motivo: "Problemas técnicos", n: 1 }]);
});
