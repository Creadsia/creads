import { test } from "node:test";
import assert from "node:assert/strict";

// The automatic producer walks one approved request to a finished video, step by step, through the studio's
// own endpoints (faked here), as the robot account; one step per round.
process.env.SUPABASE_URL = "https://sb.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "k".repeat(40);
process.env.SITE_URL = "https://site.test";
delete process.env.CRON_SECRET;
process.env.FAL_KEY = "x"; // a video model must look configured

const files = new Map<string, string>();
const users: { id: string; email: string; workspace: string; role: string }[] = [];
const calls: { path: string; body: Record<string, unknown> | null; cookie: string | null }[] = [];
const clipState: Record<string, string> = {};

globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
  const u = new URL(String(input));
  const method = init?.method ?? "GET";
  const body = typeof init?.body === "string" ? JSON.parse(init.body || "null") : null;
  if (u.hostname === "sb.test") {
    if (u.pathname === "/storage/v1/bucket") return Response.json({});
    const m = u.pathname.match(/^\/storage\/v1\/object\/[^/]+\/(.+)$/);
    if (m) {
      if (method === "POST") { files.set(m[1], String(init?.body)); return Response.json({}); }
      return files.has(m[1]) ? new Response(files.get(m[1])) : new Response("{}", { status: 404 });
    }
    if (u.pathname === "/rest/v1/rpc/hit_rate") return Response.json(true);
    if (u.pathname === "/rest/v1/users") {
      if (method === "POST") { const r = { id: "00000000-0000-0000-0000-000000000001", email: body.email, workspace: body.workspace, role: body.role }; users.push(r); return Response.json([r]); }
      if (method === "PATCH") return new Response(null, { status: 204 });
      const email = u.searchParams.get("email")?.replace("eq.", "");
      return Response.json(users.filter((x) => x.email === email));
    }
    if (u.pathname === "/rest/v1/sessions") return new Response(null, { status: 201 });
    return Response.json([]);
  }
  if (u.hostname === "site.test") {
    calls.push({ path: u.pathname + u.search, body, cookie: new Headers(init?.headers).get("cookie") });
    switch (u.pathname) {
      case "/api/cuts": return Response.json({ titulo: "Gánster de los años 20", cortes: [{ tipo: "a", texto: "Hola" }, { tipo: "b", texto: "Chao" }] });
      case "/api/scenes": return Response.json({ scenes: [{ prompt: "p1", dir: { setting: "calle" } }, { prompt: "p2" }] });
      case "/api/ads/start": return Response.json({ ad: { id: "ad-1" }, clips: [{ id: "c1" }, { id: "c2" }] });
      case "/api/clips/run": clipState[body.id] = "generating"; return Response.json({});
      case "/api/clips/status": { const id = u.searchParams.get("id")!; return Response.json({ clip: { status: clipState[id] } }); }
      case "/api/review": return Response.json({ results: [] });
      case "/api/montage": return Response.json({ url: "https://cdn.test/final.mp4" });
    }
  }
  return new Response("{}", { status: 404 });
}) as typeof fetch;

test("an approved request becomes a finished video, one step per round", async () => {
  const { addPedido, loadMarketing } = await import("../src/lib/marketing");
  const { enqueue, advanceProduction } = await import("../src/lib/autoprod");
  const ped = await addPedido({ titulo: "Gánster", formato: "ugc", idioma: "es-CL", guion: "Hola. Chao.", idea: "" });
  assert.equal(await enqueue(ped), true);
  assert.equal(await enqueue(ped), false, "never twice");
  const estado = async () => (await loadMarketing()).produccion![0];

  await advanceProduction();
  assert.equal((await estado()).estado, "escenas");
  await advanceProduction();
  const j = await estado();
  assert.equal(j.estado, "generando");
  assert.deepEqual(j.clipIds, ["c1", "c2"]);
  const start = calls.find((c) => c.path === "/api/ads/start")!;
  assert.equal(start.body!.aspect, "9:16");
  assert.equal((start.body!.clips as unknown[]).length, 2);
  assert.match(start.cookie ?? "", /^creads_session=/, "acts as the robot account");
  assert.equal(users[0]?.email, "robot@creadsia.com");
  assert.equal(users[0]?.workspace, "main");

  await advanceProduction();
  assert.equal((await estado()).estado, "generando", "waits while clips generate");
  clipState.c1 = "done"; clipState.c2 = "done";
  await advanceProduction();
  assert.equal((await estado()).estado, "revisando");
  await advanceProduction();
  assert.equal((await estado()).estado, "armando");
  await advanceProduction();
  const done = await estado();
  assert.equal(done.estado, "listo");
  assert.equal(done.videoUrl, "https://cdn.test/final.mp4");
  const montage = calls.find((c) => c.path === "/api/montage")!;
  assert.equal((montage.body!.style as { sello: boolean }).sello, true, "with the Creads badge");
  assert.equal((await loadMarketing()).pedidos.find((p) => p.id === ped.id)?.estado, "listo");
});

test("a clip that fails twice stops the job with a plain message", async () => {
  const { addPedido, loadMarketing, commitMarketing } = await import("../src/lib/marketing");
  const { enqueue, advanceProduction } = await import("../src/lib/autoprod");
  await commitMarketing((s) => { s.produccion = []; });
  const ped = await addPedido({ titulo: "Otro", formato: "ugc", idioma: "es-CL", guion: "Hola.", idea: "" });
  await enqueue(ped);
  await advanceProduction(); await advanceProduction();
  clipState.c1 = "failed"; clipState.c2 = "done";
  await advanceProduction(); // retry once
  clipState.c1 = "failed";
  await advanceProduction();
  const j = (await loadMarketing()).produccion![0];
  assert.equal(j.estado, "error");
  assert.match(j.error ?? "", /falló dos veces/);
});
