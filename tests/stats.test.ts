import { test } from "node:test";
import assert from "node:assert/strict";
import { cohorts, compare, dayList, deviceOf, landingOf, period, previousOf, sourceOf, type OrderRow, type StatRow, type WsRow } from "../src/lib/stats";

const order = (o: Partial<OrderRow>): OrderRow => ({ id: "o", owner: "w1", item: "starter", status: "pagado", quote: { subtotal: 119, total: 59.5 }, visitor: null, created_at: "2026-10-05T15:00:00Z", closed_at: "2026-10-05T15:00:00Z", ...o });

test("previous period has the same length and ends the day before", () => {
  assert.deepEqual(previousOf({ from: "2026-10-01", to: "2026-10-17" }), { from: "2026-09-14", to: "2026-09-30" });
  assert.deepEqual(previousOf({ from: "2026-10-17", to: "2026-10-17" }), { from: "2026-10-16", to: "2026-10-16" });
  assert.equal(dayList({ from: "2026-02-27", to: "2026-03-02" }).length, 4);
});

test("sources, devices and landing pages", () => {
  assert.equal(sourceOf({ utm: "IG" }), "instagram");
  assert.equal(sourceOf({ ref: "https://l.facebook.com/x" }), "facebook");
  assert.equal(sourceOf({ ref: "https://www.creadsia.com/precios", host: "creadsia.com" }), "directo");
  assert.equal(sourceOf({ fbclid: true }), "facebook");
  assert.equal(sourceOf({ gclid: true, ref: "https://x.com" }), "google");
  assert.equal(sourceOf({}), "directo");
  assert.equal(deviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)"), "Móvil");
  assert.equal(deviceOf("Mozilla/5.0 (iPad; CPU OS 17_0)"), "Tableta");
  assert.equal(deviceOf("Mozilla/5.0 (Linux; Android 14; SM-X200)"), "Tableta");
  assert.equal(deviceOf("Mozilla/5.0 (Windows NT 10.0)"), "Escritorio");
  assert.equal(landingOf("/app/crear?x=1#a"), "/app/crear");
  assert.equal(landingOf("/es/"), "/es");
  assert.equal(landingOf("/r/0f8e2c3a-1b2c-4d5e-8f90-123456789abc/"), "otra");
  assert.equal(landingOf("/compra-viagra-barato"), "otra"); // junk sent by a script isn't stored by name
  assert.equal(sourceOf({ utm: "spam-spam-spam" }), "otros");
  assert.equal(sourceOf({ ref: "https://random-site.xyz/page" }), "otros sitios");
  assert.equal(landingOf(""), "/");
});

test("period: sales, discounts, repeat customers and conversion", () => {
  const r = { from: "2026-10-01", to: "2026-10-10" };
  const orders = [
    order({ id: "a", owner: "w1" }),
    order({ id: "b", owner: "w1", item: "pack-500", quote: { subtotal: 25, total: 25 }, closed_at: "2026-10-06T15:00:00Z" }),
    order({ id: "c", owner: "w2", closed_at: "2026-10-07T15:00:00Z" }),
    order({ id: "d", owner: "w3", created_at: "2026-09-20T15:00:00Z", closed_at: "2026-09-20T15:00:00Z" }), // before the range
    order({ id: "e", owner: "w3", closed_at: "2026-10-08T15:00:00Z" }),
    order({ id: "f", owner: "w4", status: "pendiente", closed_at: null, created_at: "2026-10-09T15:00:00Z" }),
  ];
  const ws: WsRow[] = [{ id: "w1", created_at: "2026-10-01T15:00:00Z" }, { id: "w2", created_at: "2026-10-02T15:00:00Z" }, { id: "w9", created_at: "2026-09-02T15:00:00Z" }];
  const stats: StatRow[] = [{ day: "2026-10-05", dim: "ses", key: "all", n: 80 }, { day: "2026-10-06", dim: "ses", key: "all", n: 20 }, { day: "2026-10-06", dim: "dev", key: "Móvil", n: 15 }];
  const p = period(r, orders, ws, stats);
  assert.equal(p.pedidos, 4);
  assert.equal(p.neto, 59.5 * 3 + 25);
  assert.equal(p.bruto, 119 * 3 + 25);
  assert.equal(p.descuentos, 59.5 * 3);
  assert.equal(p.clientes, 3);
  assert.equal(p.habituales, 2 / 3); // w1 paid twice, w3 had paid before
  assert.equal(p.nuevos, 2);
  assert.equal(p.sesiones, 100);
  assert.equal(p.checkout, 5); // orders started in the range (paid or not)
  assert.equal(p.conversion, 0.04);
  assert.equal(p.daily.length, 10);
  assert.equal(p.daily[4].ventas, 59.5);
  assert.equal(p.daily[5].sesiones, 20);
});

test("orders are dated in Chilean time", () => {
  // 02:00 UTC on the 11th is still the 10th in Santiago
  const p = period({ from: "2026-10-10", to: "2026-10-10" }, [order({ closed_at: "2026-10-11T02:00:00Z" })], [], []);
  assert.equal(p.pedidos, 1);
});

test("compare keeps keys from both periods, biggest first", () => {
  const rows = compare(new Map([["a", 1], ["b", 5]]), new Map([["c", 3], ["a", 2]]), 2);
  assert.deepEqual(rows, [{ k: "b", n: 5, prev: 0 }, { k: "a", n: 1, prev: 2 }]);
});

test("cohorts: share of each month's accounts that paid in later months", () => {
  const ws: WsRow[] = [{ id: "w1", created_at: "2026-09-03T15:00:00Z" }, { id: "w2", created_at: "2026-09-10T15:00:00Z" }];
  const orders = [order({ owner: "w1", closed_at: "2026-09-04T15:00:00Z" }), order({ owner: "w1", closed_at: "2026-10-04T15:00:00Z" }), order({ owner: "w2", closed_at: "2026-10-05T15:00:00Z" })];
  const c = cohorts(orders, ws, 3, new Date("2026-10-17T15:00:00Z"));
  assert.deepEqual(c.map((x) => x.month), ["2026-08", "2026-09", "2026-10"]);
  assert.deepEqual(c[1], { month: "2026-09", size: 2, cells: [0.5, 1] });
  assert.equal(c[2].cells.length, 1);
});

test("owner's channels: explicit utm_source names and paid Meta", async () => {
  const { sourceOf } = await import("../src/lib/stats");
  assert.equal(sourceOf({ utm: "meta_ads" }), "meta_ads");
  assert.equal(sourceOf({ utm: "facebook", medium: "paid" }), "meta_ads");
  assert.equal(sourceOf({ utm: "instagram", medium: "cpc" }), "meta_ads");
  assert.equal(sourceOf({ utm: "instagram" }), "instagram");
  assert.equal(sourceOf({ utm: "tiktok" }), "tiktok");
  assert.equal(sourceOf({ utm: "youtube" }), "youtube");
  assert.equal(sourceOf({ utm: "comunidad" }), "comunidad");
  assert.equal(sourceOf({ utm: "partner" }), "partner");
  assert.equal(sourceOf({ utm: "outreach" }), "outreach");
});
