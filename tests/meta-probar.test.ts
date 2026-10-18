import { test } from "node:test";
import assert from "node:assert/strict";

// «Probar conexión»: the pixel is READ with the system-user token, and the Conversions API token is only used
// to SEND a test event, and only when there's a test event code (never a real or purchase event).
process.env.META_ADS_TOKEN = "A".repeat(60);
process.env.META_CAPI_TOKEN = "C".repeat(60);
process.env.META_AD_ACCOUNT_ID = "123456789";
process.env.META_PAGE_ID = "987654321";
process.env.NEXT_PUBLIC_META_PIXEL_ID = "2078637222831496";

type Call = { url: string; method: string; token: string | null; body: URLSearchParams | null };
function mockMeta(calls: Call[]) {
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body instanceof URLSearchParams ? init.body : null;
    calls.push({ url: url.pathname, method: init?.method ?? "GET", token: url.searchParams.get("access_token") ?? body?.get("access_token") ?? null, body });
    if (url.hostname !== "graph.facebook.com") return new Response("{}", { status: 404 });
    if (url.pathname.endsWith("/events")) return Response.json({ events_received: 1 });
    if (url.pathname.endsWith("/act_123456789")) return Response.json({ name: "Cuenta", currency: "USD", account_status: 1 });
    return Response.json({ name: "ok" });
  }) as typeof fetch;
}

test("the pixel is read with the system-user token, never with the Conversions API token", async () => {
  const calls: Call[] = [];
  mockMeta(calls);
  const { probarMeta } = await import("../src/lib/meta-graph");
  const r = await probarMeta();
  const read = calls.find((c) => c.url.endsWith("/2078637222831496") && c.method === "GET");
  assert.ok(read, "reads the pixel");
  assert.equal(read!.token, process.env.META_ADS_TOKEN);
  assert.ok(!calls.some((c) => c.token === process.env.META_CAPI_TOKEN), "the CAPI token isn't used without a test code");
  assert.ok(!calls.some((c) => c.url.endsWith("/events")), "no event is sent without a test code");
  assert.equal(r.find((x) => x.item === "Píxel (lectura)")?.ok, true);
});

test("with a test event code, one ViewContent test event goes to /events with the Conversions API token", async () => {
  process.env.META_TEST_EVENT_CODE = "TEST12345";
  const calls: Call[] = [];
  mockMeta(calls);
  const { probarMeta } = await import("../src/lib/meta-graph");
  const r = await probarMeta();
  const sent = calls.filter((c) => c.url.endsWith("/2078637222831496/events"));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].method, "POST");
  assert.equal(sent[0].token, process.env.META_CAPI_TOKEN);
  assert.equal(sent[0].body?.get("test_event_code"), "TEST12345");
  const data = JSON.parse(sent[0].body?.get("data") ?? "[]");
  assert.equal(data[0].event_name, "ViewContent");
  assert.ok(!("value" in (data[0].custom_data ?? {})), "no purchase value");
  assert.equal(r.find((x) => x.item === "API de conversiones (envío)")?.ok, true);
  delete process.env.META_TEST_EVENT_CODE;
});
