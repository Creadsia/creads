import { test } from "node:test";
import assert from "node:assert/strict";
import { cuerpoEvento, uuidDe } from "../src/lib/posthog-server";

test("the same dedupe key always gives the same valid uuid", () => {
  const a = uuidDe("buy-ord_123"), b = uuidDe("buy-ord_123");
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, uuidDe("buy-ord_124"));
});

test("an event body carries the account id, the props and the uuid only when deduped", () => {
  const now = new Date("2026-10-25T12:00:00Z");
  const b = cuerpoEvento({ distinctId: "u1", event: "purchase", props: { valor: 9 }, dedupe: "buy-o1", key: "k", now });
  assert.equal(b.distinct_id, "u1");
  assert.equal(b.event, "purchase");
  assert.equal((b.properties as Record<string, unknown>).valor, 9);
  assert.equal(b.uuid, uuidDe("buy-o1"));
  assert.equal(b.timestamp, now.toISOString());
  assert.equal("uuid" in cuerpoEvento({ distinctId: "u1", event: "signup", key: "k" }), false);
});
