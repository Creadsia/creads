// The brand's organic autopilot (lib/piloto.ts). No real calls: storage, database, Claude and Meta are mocked.
// Run: npx tsx --test tests/piloto.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { avanzarPiloto, chileOffset, decidirReel, nextSlot, parseReels, planPrompt } from "../src/lib/piloto";
import { loadMarketing } from "../src/lib/marketing";

test("publishing hours are Chile time, at most N a day, never twice in the same hour", () => {
  const now = new Date("2026-10-20T15:00:00Z"); // 12:00 in Chile (summer time, UTC−3)
  assert.equal(chileOffset(now), -180);
  assert.equal(nextSlot(now, [12, 19], 1, []), "2026-10-20T22:00:00.000Z", "12:00 is now: next is 19:00");
  assert.equal(nextSlot(now, [12, 19], 1, ["2026-10-20T22:00:00.000Z"]), "2026-10-21T15:00:00.000Z", "one a day: tomorrow at 12:00");
  assert.equal(nextSlot(now, [12, 19], 2, ["2026-10-20T22:00:00.000Z"]), "2026-10-21T15:00:00.000Z");
  assert.equal(nextSlot(now, [], 1, []), null);
});

test("reels from Claude are checked; the prompt carries the role, the angle and the rules", () => {
  const ok = parseReels('Aquí va: {"reels":[{"titulo":"Hook que para el scroll","guion":"' + "palabra ".repeat(50) + '","caption":"Masterclass gratis en creadsia.com/curso #ia"},{"titulo":"x","guion":"corto","caption":""}]}');
  assert.equal(ok.length, 1, "the short one is dropped");
  assert.deepEqual(parseReels("nada"), []);
  const p = planPrompt({ id: "ig-1", nombre: "profe.creads", igUserId: "1", rol: "profesor", angulo: "e-commerce" }, "Profe: 40 años, barba corta", ["Tema viejo"], 3);
  assert.match(p, /PROFESOR/);
  assert.match(p, /e-commerce/);
  assert.match(p, /creadsia\.com\/curso/);
  assert.match(p, /promesas de ingresos/);
  assert.match(p, /Tema viejo/);
  assert.doesNotMatch(planPrompt({ id: "ig-2", nombre: "raro", igUserId: "2", rol: "personaje" }, "", [], 2), /creadsia\.com\/curso/, "characters don't sell");
});

test("the round: plan → approve → produce with the character → schedule → publish (modo ensayo)", async () => {
  process.env.SUPABASE_URL = "https://sb.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
  process.env.ANTHROPIC_API_KEY = "a";
  process.env.CRON_SECRET = "x".repeat(20);
  delete process.env.META_ADS_TOKEN;
  const avatar = "11111111-2222-3333-4444-555555555555";
  const files = new Map<string, string>();
  files.set("marketing/estado.json", JSON.stringify({ cuentas: [{ id: "ig-1", nombre: "profe.creads", igUserId: "123456", rol: "profesor", avatarId: avatar, piloto: { on: true, porDia: 1, horas: [12, 19], revisar: true } }] }));
  let claudeCalls = 0;
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
    const obj = url.match(/\/storage\/v1\/object\/[^/]+\/(.+)$/);
    if (obj) {
      if (init?.method === "POST") { files.set(obj[1], String(init.body)); return json({}); }
      return files.has(obj[1]) ? new Response(files.get(obj[1])) : json({ statusCode: "404", error: "not_found" }, 400);
    }
    if (url.includes("/storage/v1/bucket")) return json({});
    if (url.includes("/rest/v1/rpc/hit_rate")) return json(true);
    if (url.includes("/rest/v1/avatars")) return json([{ name: "Profe", description: "40 años, barba corta", notes: null }]);
    if (url.includes("/rest/v1/")) return json([]);
    if (url.startsWith("https://api.anthropic.com")) {
      claudeCalls++;
      const reels = [1, 2, 3].map((i) => ({ titulo: `Reel ${i}`, guion: `Tip ${i}: ` + "palabra ".repeat(40), caption: `Masterclass gratis en creadsia.com/curso #ia ${i}` }));
      return json({ content: [{ type: "text", text: JSON.stringify({ reels }) }], stop_reason: "end_turn" });
    }
    if (url.includes("/api/produccion")) return json({ ok: true });
    return new Response("not mocked " + url, { status: 500 });
  }) as typeof fetch;

  const t0 = new Date("2026-10-20T15:00:00Z");
  let r = await avanzarPiloto(t0);
  assert.equal(r.planeados, 3, "3 days × 1 a day");
  let m = await loadMarketing();
  assert.deepEqual(m.reels!.map((x) => x.estado), ["propuesta", "propuesta", "propuesta"], "with «revisar» nothing is produced yet");

  // nothing new is planned while the queue is full (and not before 20 hours)
  r = await avanzarPiloto(new Date(t0.getTime() + 600_000));
  assert.equal(r.planeados, 0);
  assert.equal(claudeCalls, 1);

  await decidirReel(m.reels![0].id, "aprobar");
  r = await avanzarPiloto(new Date(t0.getTime() + 1200_000));
  assert.equal(r.producir, 1);
  m = await loadMarketing();
  const reel = m.reels!.find((x) => x.estado === "produciendo")!;
  const job = m.produccion!.find((j) => j.pedidoId === reel.pedidoId)!;
  assert.equal(job.avatarId, avatar, "produced with the account's character");

  // the producer finishes → it's scheduled at the account's next hour
  m.produccion!.find((j) => j.id === job.id)!.estado = "listo";
  m.produccion!.find((j) => j.id === job.id)!.adId = "0f8e2c3a-1b2c-4d5e-8f90-123456789abc";
  files.set("marketing/estado.json", JSON.stringify(m));
  r = await avanzarPiloto(new Date(t0.getTime() + 1800_000));
  assert.equal(r.programados, 1);
  m = await loadMarketing();
  assert.equal(m.reels!.find((x) => x.id === reel.id)!.publicarEn, "2026-10-20T22:00:00.000Z");

  // at 19:00 Chile it's published (modo ensayo: Meta not connected)
  r = await avanzarPiloto(new Date("2026-10-20T22:01:00Z"));
  assert.equal(r.publicados, 1);
  m = await loadMarketing();
  const done = m.reels!.find((x) => x.id === reel.id)!;
  assert.equal(done.estado, "publicada");
  assert.equal(done.ensayo, true);
  assert.equal(m.publicaciones[0].estado, "ensayo");
});
