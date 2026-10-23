import { test } from "node:test";
import assert from "node:assert/strict";
import { regaloCheck, regaloEmailOk, regaloSign } from "../src/lib/regalo";
import { PRUEBA, onSale, quote } from "../src/lib/catalog";
import { orderGrant } from "../src/lib/settle";

test("gift link: signed per user, a changed id or signature fails", () => {
  const s = regaloSign("user-123");
  assert.ok(regaloCheck("user-123", s));
  assert.ok(!regaloCheck("user-124", s));
  assert.ok(!regaloCheck("user-123", s.slice(0, -1) + (s.endsWith("A") ? "B" : "A")));
  assert.ok(!regaloCheck("user-123", ""));
});

test("gift: throwaway inboxes don't get it", () => {
  assert.ok(regaloEmailOk("ana@gmail.com"));
  assert.ok(!regaloEmailOk("x@mailinator.com"));
  assert.ok(!regaloEmailOk("x@yopmail.com"));
});

test("trial video: US$9, 200 credits, on sale without a plan, no months", () => {
  assert.ok(onSale(PRUEBA.id, "mensual"));
  const q = quote(PRUEBA.id, "mensual")!;
  assert.equal(q.total, 9);
  assert.equal(q.credits, 200);
  assert.equal(q.label, "Video de prueba (15 s)");
  const g = orderGrant({ item: PRUEBA.id, quote: q } as never);
  assert.deepEqual(g, { credits: 200, months: 0, plan: null });
});
