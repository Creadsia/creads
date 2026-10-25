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

test("Pack Prueba: US$9 once, 125 credits; an old trial-video order still settles with its 200 credits", () => {
  assert.ok(onSale(PRUEBA.id, "mensual"));
  const q = quote(PRUEBA.id, "mensual")!;
  assert.equal(q.total, 9);
  assert.equal(q.credits, 125);
  assert.deepEqual(orderGrant({ item: PRUEBA.id, quote: q } as never), { credits: 125, months: 0, plan: null });
  assert.deepEqual(orderGrant({ item: PRUEBA.id, quote: { ...q, credits: 200 } } as never), { credits: 200, months: 0, plan: null });
});
