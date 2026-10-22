import { test } from "node:test";
import assert from "node:assert/strict";

// 30 requests add to the same shared file at the same moment: with the lock, none of them is lost.
test("updatePrivateJSON: concurrent updates of one shared file don't lose changes", async () => {
  process.env.SUPABASE_URL = "https://sb.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test";
  const files = new Map<string, string>();
  const locks = new Map<string, number>();
  const real = globalThis.fetch;
  const slow = () => new Promise((r) => setTimeout(r, 2 + Math.random() * 8));
  globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
    const u = String(input);
    await slow();
    if (u.endsWith("/storage/v1/bucket")) return new Response("{}", { status: 200 });
    if (u.includes("/rest/v1/rpc/hit_rate")) {
      const { p_key } = JSON.parse(String(init.body));
      const n = (locks.get(p_key) ?? 0) + 1;
      locks.set(p_key, n);
      return new Response(JSON.stringify(n <= 1), { status: 200 });
    }
    if (u.includes("/rest/v1/rate_limits") && init.method === "DELETE") {
      locks.delete(decodeURIComponent(u.split("key=eq.")[1]));
      return new Response(null, { status: 204 });
    }
    const m = u.match(/\/storage\/v1\/object\/admin\/(.+)$/);
    if (m) {
      if (init.method === "POST") { files.set(m[1], String(init.body)); return new Response("{}", { status: 200 }); }
      const v = files.get(m[1]);
      return v === undefined ? new Response("{}", { status: 404 }) : new Response(v, { status: 200 });
    }
    return new Response("not mocked", { status: 500 });
  }) as typeof fetch;
  try {
    const { updatePrivateJSON, readPrivateJSON } = await import("../src/lib/supabase");
    await Promise.all(Array.from({ length: 30 }, (_, i) => updatePrivateJSON<number[]>("t/list.json", (cur) => [...(cur ?? []), i])));
    const list = (await readPrivateJSON<number[]>("t/list.json")) ?? [];
    assert.equal(list.length, 30);
    assert.equal(new Set(list).size, 30);
  } finally { globalThis.fetch = real; }
});
