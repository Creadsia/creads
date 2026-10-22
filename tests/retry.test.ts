import { test } from "node:test";
import assert from "node:assert/strict";
import { backoff, fetchRetry } from "../src/lib/providers/retry";

test("backoff: grows 1.5 s → 3 s → 6 s (±25%) and follows Retry-After", () => {
  for (const [n, base] of [[1, 1500], [2, 3000], [3, 6000], [5, 12000]] as const) {
    const w = backoff(n, null);
    assert.ok(w >= base * 0.75 && w <= base * 1.25, `${n}: ${w}`);
  }
  const w = backoff(1, "4");
  assert.ok(w >= 3000 && w <= 5000);
});

test("fetchRetry: waits on 429 and returns the good answer; gives up after the tries", async () => {
  const real = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response(calls < 3 ? "busy" : "ok", { status: calls < 3 ? 429 : 200, headers: { "retry-after": "0.01" } }); }) as typeof fetch;
  try {
    const r = await fetchRetry("https://x.test", { method: "POST", body: "{}" });
    assert.equal(r.status, 200);
    assert.equal(calls, 3);
    calls = 0;
    globalThis.fetch = (async () => { calls++; return new Response("busy", { status: 429, headers: { "retry-after": "0.01" } }); }) as typeof fetch;
    const r2 = await fetchRetry("https://x.test", { method: "POST" }, { tries: 3 });
    assert.equal(r2.status, 429);
    assert.equal(calls, 3);
    // a dropped connection on a submit is NOT retried (it could charge twice)
    calls = 0;
    globalThis.fetch = (async () => { calls++; throw new TypeError("fetch failed"); }) as typeof fetch;
    await assert.rejects(fetchRetry("https://x.test", { method: "POST" }));
    assert.equal(calls, 1);
  } finally { globalThis.fetch = real; }
});
