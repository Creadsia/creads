import { test } from "node:test";
import assert from "node:assert/strict";
import { characterLimit, cleanTraits, describe, fieldsFor, sheetPrompt, surprise } from "../src/lib/influencer/traits";
import { toolRequest } from "../src/lib/providers/tools";

test("each character type only offers its own options", () => {
  const normal = fieldsFor("normal");
  assert.ok(!normal.some((f) => f.key === "especie"), "no animal species for people");
  assert.ok(!normal.find((f) => f.key === "peinado")!.opts.some((o) => o.id === "cuernos"), "weird hair only in Raro/Total");
  assert.ok(fieldsFor("raro").find((f) => f.key === "peinado")!.opts.some((o) => o.id === "cuernos"));
  assert.ok(fieldsFor("total").find((f) => f.key === "cuerpo")!.opts.some((o) => o.id === "centauro"));
  assert.ok(!fieldsFor("raro").find((f) => f.key === "cuerpo")!.opts.some((o) => o.id === "centauro"));
  assert.ok(fieldsFor("animal").some((f) => f.key === "especie"));
  assert.ok(!fieldsFor("animal").some((f) => f.key === "etnia"));
});

test("traits are cleaned: unknown, disallowed and extra picks drop", () => {
  const t = cleanTraits({ tier: "normal", picks: { peinado: ["cuernos", "afro"], accesorios: ["lentes", "joyas", "bolso", "sombrero"], nada: ["x"] }, color: "#123456" });
  assert.deepEqual(t.picks.peinado, ["afro"]);
  assert.equal(t.picks.accesorios.length, 3);
  assert.equal(t.picks.nada, undefined);
  assert.equal(t.color, undefined, "no body color for a normal person");
});

test("«Sorpréndeme» fills what wasn't chosen and keeps the choices", () => {
  let n = 0;
  const rand = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
  const t = surprise({ tier: "raro", picks: { genero: ["mujer"] } }, rand);
  assert.deepEqual(t.picks.genero, ["mujer"]);
  for (const f of fieldsFor("raro").filter((x) => x.max === 1)) assert.equal(t.picks[f.key]?.length, 1, f.key);
});

test("the sheet prompt describes the character and the four views, never a real person", () => {
  const p = sheetPrompt({ tier: "animal", picks: { especie: ["capibara"], ropa: ["terno"], accesorios: ["lentes"] }, color: "#8a5cff" });
  assert.match(p, /capybara/);
  assert.match(p, /tailored suit/);
  assert.match(p, /front view[\s\S]*side profile[\s\S]*back view[\s\S]*close-up/);
  assert.match(p, /not a real or famous person/);
  assert.match(p, /#8A5CFF/);
  assert.match(describe({ tier: "normal", picks: { genero: ["hombre"], vello: ["bigote"] } }), /man.*moustache/);
});

test("saved characters per plan: Starter 1, Plus 3, Studio and the owner's team unlimited", () => {
  assert.equal(characterLimit("Starter"), 1);
  assert.equal(characterLimit(null), 1);
  assert.equal(characterLimit("Plus"), 3);
  assert.equal(characterLimit("Studio"), Infinity);
  assert.equal(characterLimit(null, true), Infinity);
});

test("a sheet without references is drawn from the text; with references it uses them", () => {
  const a = toolRequest("crear-personaje", { prompt: "x" })!;
  assert.equal(a.endpoint, "fal-ai/nano-banana-pro");
  assert.equal(a.body.aspect_ratio, "16:9");
  assert.equal("image_urls" in a.body, false);
  const b = toolRequest("crear-personaje", { prompt: "x", images: ["/api/media/ws/a.png"] })!;
  assert.equal(b.endpoint, "fal-ai/nano-banana-pro/edit");
  assert.deepEqual(b.body.image_urls, ["/api/media/ws/a.png"]);
});

test("the character's personality is kept (and trimmed) for the marketing team", async () => {
  const { bibleText } = await import("../src/lib/influencer/traits");
  const t = cleanTraits({ tier: "animal", picks: { especie: ["perro"] }, bible: { arquetipo: "refinado", frases: "Esto es inaceptable, querido.", tono: "x".repeat(2000), otro: "no" } as never });
  assert.equal(t.bible?.arquetipo, "refinado");
  assert.equal(t.bible?.tono?.length, 800);
  assert.equal((t.bible as Record<string, unknown>).otro, undefined);
  assert.match(bibleText(t.bible), /Tierno \/ refinado.*inaceptable/);
  assert.equal(cleanTraits({ tier: "normal", picks: {}, bible: { arquetipo: "inventado" } }).bible, undefined);
});
