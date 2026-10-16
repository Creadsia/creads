// Meta events: nothing leaves without consent or token; emails go hashed; the browser's id is reused.
// Run: npx tsx --test tests/meta.test.ts
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { afterEach, test } from "node:test";
import { sendMeta, visitorFrom } from "../src/lib/meta";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; delete process.env.META_CAPI_TOKEN; });

test("no consent or no token: nothing is sent", async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response("{}"); }) as typeof fetch;
  process.env.META_CAPI_TOKEN = "t";
  assert.equal(await sendMeta({ name: "Lead", email: "a@b.cl" }, { consent: false }), false);
  delete process.env.META_CAPI_TOKEN;
  assert.equal(await sendMeta({ name: "Lead", email: "a@b.cl" }, { consent: true }), false);
  assert.equal(calls, 0);
});

test("sends hashed email, value and the browser's event id", async () => {
  let body: { data: { event_name: string; event_id: string; user_data: { em: string[]; fbp?: string }; custom_data: { value: number } }[] } | null = null;
  globalThis.fetch = (async (_u: RequestInfo | URL, init?: RequestInit) => { body = JSON.parse(String(init?.body)); return new Response("{}"); }) as typeof fetch;
  process.env.META_CAPI_TOKEN = "t";
  const req = new Request("https://x.cl/api/pagos", { headers: { cookie: "creads_consent=1; _fbp=fb.1.123.456", "x-real-ip": "1.2.3.4" } });
  const v = visitorFrom(req);
  assert.equal(v.consent, true);
  assert.equal(await sendMeta({ name: "InitiateCheckout", eventId: "abc-123-xyz", email: " Juan@Mail.CL ", value: 64.5 }, v), true);
  const d = body!.data[0];
  assert.equal(d.event_name, "InitiateCheckout");
  assert.equal(d.event_id, "abc-123-xyz");
  assert.equal(d.user_data.em[0], createHash("sha256").update("juan@mail.cl").digest("hex"));
  assert.equal(d.user_data.fbp, "fb.1.123.456");
  assert.equal(d.custom_data.value, 64.5);
});
