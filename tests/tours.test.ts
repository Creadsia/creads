import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { TOURS, VIDEOS, toursFor } from "../src/lib/tours";

test("guides: unique ids, each video exists, targets are marked somewhere in the studio", () => {
  assert.equal(new Set(TOURS.map((t) => t.id)).size, TOURS.length);
  for (const v of VIDEOS) {
    assert.ok(fs.existsSync(`public/ayuda/${v.id}.mp4`), `falta ${v.id}.mp4`);
    assert.ok(fs.existsSync(`public/ayuda/${v.id}.jpg`), `falta ${v.id}.jpg`);
    assert.ok(v.secs > 0);
  }
  for (const t of TOURS) if (t.video) assert.ok(VIDEOS.some((v) => v.id === t.video), t.id);
  // every data-tour target used by a guide is written in some studio file
  const files: string[] = [];
  const walk = (d: string) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) f.isDirectory() ? walk(`${d}/${f.name}`) : f.name.endsWith(".tsx") && files.push(fs.readFileSync(`${d}/${f.name}`, "utf8")); };
  walk("src/app/app");
  const all = files.join("\n");
  const targets = TOURS.flatMap((t) => [t.when, ...t.steps.map((s) => s.target)]).filter(Boolean).flatMap((x) => x!.split("|"));
  for (const id of new Set(targets)) assert.ok(all.includes(`"${id}"`), `no hay data-tour="${id}"`);
});

test("guides: the right guides for each screen", () => {
  assert.deepEqual(toursFor("/app").map((t) => t.id), ["inicio"]);
  assert.ok(toursFor("/app/crear").map((t) => t.id).includes("crear-escenas"));
  assert.equal(toursFor("/app/creditos").length, 0);
});

test("Seedance is refused before charging when the clip would show a real face", async () => {
  const { refusesFrame } = await import("../src/lib/formats");
  const seedance = { noFaces: true }, veo = {};
  assert.equal(refusesFrame(seedance, "ugc", { face: true, product: false }), true);
  assert.equal(refusesFrame(seedance, "ugc", { face: false, product: true }), true); // a person holding the product
  assert.equal(refusesFrame(seedance, "faceless", { face: false, product: true }), false); // only scenes
  assert.equal(refusesFrame(seedance, "ugc", { face: false, product: false }), false); // text-to-video
  assert.equal(refusesFrame(veo, "ugc", { face: true, product: true }), false);
});
