import { test } from "node:test";
import assert from "node:assert/strict";
import { pageOf, summarize } from "../src/lib/presence";

test("presence: pages and one count per tab (its latest page)", () => {
  assert.equal(pageOf("/"), "inicio");
  assert.equal(pageOf("/empezar?plan=plus"), "empezar");
  assert.equal(pageOf("/app/automatico"), "automatico");
  assert.equal(pageOf("/app/biblioteca"), "terminados");
  assert.equal(pageOf("/terminos"), "otra");
  const now = Date.parse("2026-10-22T21:00:00Z");
  const at = (s: number) => new Date(now - s * 1000).toISOString();
  const r = summarize([
    { key: "live:aaaaaaaaaa:inicio", window_start: at(40) },
    { key: "live:aaaaaaaaaa:empezar", window_start: at(5) },
    { key: "live:bbbbbbbbbb:automatico", window_start: at(10) },
    { key: "live:cccccccccc:inicio", window_start: at(120) },
  ], now);
  assert.equal(r.total, 2);
  assert.deepEqual(r.byPage, { empezar: 1, automatico: 1 });
});
