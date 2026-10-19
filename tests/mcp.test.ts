import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

process.env.SUPABASE_URL = "https://sb.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
process.env.FAL_KEY = "test";

import { checkRequest, issueCode, okRedirect, readClient, redeemCode, registerClient } from "../src/lib/oauth";
import { handle, TOOLS, type Call } from "../src/lib/mcp";

test("apps register themselves; the client id can't be forged or changed", () => {
  const r = registerClient("Claude", ["https://claude.ai/api/mcp/auth_callback"]);
  assert.equal(typeof r, "object");
  const { id } = r as { id: string };
  assert.deepEqual(readClient(id), { name: "Claude", redirects: ["https://claude.ai/api/mcp/auth_callback"] });
  const forged = id.replace(/^cr_[^.]+/, "cr_" + Buffer.from(JSON.stringify({ n: "Claude", r: ["https://evil.example/cb"] })).toString("base64url"));
  assert.equal(readClient(forged), null);
  assert.equal(typeof registerClient("x", ["http://evil.example/cb"]), "string");
  assert.ok(okRedirect("http://localhost:6274/cb"));
  assert.ok(!okRedirect("javascript:alert(1)"));
});

test("an authorization request needs the registered address and PKCE S256", () => {
  const { id } = registerClient("ChatGPT", ["https://chatgpt.com/connector_platform_oauth_redirect"]) as { id: string };
  const base = { client_id: id, redirect_uri: "https://chatgpt.com/connector_platform_oauth_redirect", response_type: "code", code_challenge: "a".repeat(43), code_challenge_method: "S256" };
  assert.equal(typeof checkRequest(base), "object");
  assert.match(String(checkRequest({ ...base, redirect_uri: "https://evil.example/cb" })), /regreso/);
  assert.match(String(checkRequest({ ...base, code_challenge_method: "plain" })), /PKCE/);
});

test("a code works once, only for the same app and address, and only with the right PKCE secret", async () => {
  const store = new Map<string, string>();
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/storage/v1/bucket")) return new Response("{}");
    const m = url.match(/\/storage\/v1\/object\/[^/]+\/(.+)$/);
    if (m) {
      if (init?.method === "POST") { store.set(m[1], String(init.body)); return new Response("{}"); }
      return store.has(m[1]) ? new Response(store.get(m[1])) : new Response("not found", { status: 404 });
    }
    throw new Error("unexpected " + url);
  }) as typeof fetch;
  const verifier = randomBytes(40).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const o = { userId: "11111111-1111-1111-1111-111111111111", clientId: "cr_x", redirectUri: "https://claude.ai/cb", challenge };
  const code = await issueCode(o);
  assert.equal(await redeemCode({ code, clientId: "cr_x", redirectUri: "https://claude.ai/cb", verifier: randomBytes(40).toString("base64url") }), null, "wrong secret");
  const code2 = await issueCode(o);
  assert.equal(await redeemCode({ code: code2, clientId: "cr_other", redirectUri: "https://claude.ai/cb", verifier }), null, "other app");
  const code3 = await issueCode(o);
  assert.equal(await redeemCode({ code: code3, clientId: "cr_x", redirectUri: "https://claude.ai/cb", verifier }), o.userId);
  assert.equal(await redeemCode({ code: code3, clientId: "cr_x", redirectUri: "https://claude.ai/cb", verifier }), null, "used once");
});

test("MCP: initialize, tools with titles and read/write annotations, and a tool call", async () => {
  const noCall: Call = async () => { throw new Error("no"); };
  const init = await handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, noCall, "https://www.creadsia.com");
  assert.equal((init!.result as { protocolVersion: string }).protocolVersion, "2025-06-18");
  assert.equal(await handle({ jsonrpc: "2.0", method: "notifications/initialized" }, noCall, ""), null);
  const list = await handle({ jsonrpc: "2.0", id: 2, method: "tools/list" }, noCall, "");
  const tools = (list!.result as { tools: { name: string; title: string; annotations: Record<string, unknown> }[] }).tools;
  assert.equal(tools.length, TOOLS.length);
  for (const t of tools) {
    assert.ok(t.title, `${t.name} has a title`);
    for (const k of ["readOnlyHint", "destructiveHint", "openWorldHint"]) assert.equal(typeof t.annotations[k], "boolean", `${t.name}.${k}`);
    assert.ok(!("run" in t));
  }
  const asked: unknown[] = [];
  const call: Call = async <T,>(path: string, body?: unknown) => { asked.push([path, body]); return { url: "/m/img.png" } as T; };
  const r = await handle({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "creads_crear_imagen", arguments: { descripcion: "Un medidor de luz en una pared de ladrillo, foto realista" } } }, call, "https://www.creadsia.com");
  const res = r!.result as { content: { text: string }[]; isError: boolean; structuredContent: { url: string } };
  assert.equal(res.isError, false);
  assert.equal(res.structuredContent.url, "https://www.creadsia.com/m/img.png");
  assert.deepEqual(asked[0], ["/api/generate/image", { prompt: "Un medidor de luz en una pared de ladrillo, foto realista", aspect: "4:5" }]);
  const broke: Call = async () => { throw new Error("No te quedan créditos. Compra un plan en /app/planes"); };
  const e = await handle({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "creads_saldo", arguments: {} } }, broke, "");
  const er = e!.result as { content: { text: string }[]; isError: boolean };
  assert.equal(er.isError, true);
  assert.doesNotMatch(er.content[0].text, /plan|compra/i, "no upgrade pitch inside the chat");
  const out: Call = async () => { throw new Error("El proveedor de imágenes se quedó sin saldo. Carga saldo y vuelve a intentar."); };
  const e2 = await handle({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "creads_saldo", arguments: {} } }, out, "");
  assert.match((e2!.result as { content: { text: string }[] }).content[0].text, /sin saldo/, "other problems keep their real message");
});
