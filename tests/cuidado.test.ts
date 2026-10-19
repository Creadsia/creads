import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL = "https://sb.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
process.env.RESEND_API_KEY = "re_test";
process.env.EMAIL_FROM = "Creads <hola@creadsia.com>";

import { careSweep, casos } from "../src/lib/cuidado";
import { careEmail } from "../src/lib/emails";

const WS = "ws_cliente";
const JOB = "11111111-1111-1111-1111-111111111111";

function mock() {
  const files = new Map<string, string>();
  const mails: { to: string; subject: string; text: string }[] = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = decodeURIComponent(String(input));
    if (url.includes("/storage/v1/bucket")) return new Response("{}");
    const m = url.match(/\/storage\/v1\/object\/[^/]+\/(.+)$/);
    if (m) {
      if (init?.method === "POST") { files.set(m[1], String(init.body)); return new Response("{}"); }
      return files.has(m[1]) ? new Response(files.get(m[1])) : new Response("not found", { status: 404 });
    }
    if (url.includes("/rest/v1/clips")) return new Response(JSON.stringify([{ id: JOB, owner: WS, kind: "gen:image", ad_id: null, created_at: new Date().toISOString() }, { id: "22222222-2222-2222-2222-222222222222", owner: "main", kind: "gen:image", ad_id: null, created_at: new Date().toISOString() }]));
    if (url.includes("/rest/v1/credits") && url.includes("kind=eq.charge")) return new Response(JSON.stringify([{ id: 7, ref: JOB }]));
    if (url.includes("/rest/v1/credits") && url.includes("kind=eq.refund")) return new Response(JSON.stringify([{ ref: "charge:7" }]));
    if (url.includes("/rest/v1/users")) return new Response(JSON.stringify([{ email: "cliente@ejemplo.cl", name: "Ana Pérez", role: "owner", active: true }]));
    if (url.includes("api.resend.com")) { const b = JSON.parse(String(init?.body)); mails.push({ to: Array.isArray(b.to) ? b.to[0] : b.to, subject: b.subject, text: b.text }); return new Response(JSON.stringify({ id: "e1" })); }
    throw new Error("unexpected " + url);
  }) as typeof fetch;
  return { files, mails };
}

test("a failed, refunded generation: the customer gets one email and the owner a case to follow up", async () => {
  const { mails } = mock();
  const r = await careSweep();
  assert.equal(r.correos, 1);
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, "cliente@ejemplo.cl");
  assert.match(mails[0].text, /imagen no se pudo terminar/);
  assert.match(mails[0].text, /créditos ya volvieron/);
  const list = await casos();
  assert.equal(list.length, 1);
  assert.equal(list[0].estado, "pendiente");
  assert.equal(list[0].motivo, "falla");
  // the next round (5 min later) doesn't write again about the same job, nor about Creadsia's own account
  const again = await careSweep(Date.now() + 5 * 60_000);
  assert.equal(again.correos, 0);
  assert.equal(mails.length, 1);
});

test("the care email talks like a person and never pitches plans", () => {
  const e = careEmail("a@b.cl", "Ana", { items: [{ what: "una imagen", href: "/app/laboratorio" }], whatsapp: "56912345678" });
  assert.match(e.text, /Hola Ana/);
  assert.match(e.text, /wa\.me\/56912345678/);
  assert.doesNotMatch(e.text, /plan|descuento|compra/i);
});
