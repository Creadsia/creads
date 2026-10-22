import { test } from "node:test";
import assert from "node:assert/strict";
import { cueFixes, parseSrt } from "../src/lib/subtitle-diff";

test("parseSrt reads cues", () => {
  const c = parseSrt("1\n00:00:00,000 --> 00:00:01,200\nHola soy\n\n2\n00:00:01,200 --> 00:00:02,000\nde CREATZIA.COM\n");
  assert.equal(c.length, 2);
  assert.equal(c[1].texto, "de CREATZIA.COM");
});

test("cueFixes: one word, a brand split in two, same-length lines, too big", () => {
  assert.deepEqual(cueFixes("entra a CREATZIA.COM hoy", "entra a creadsia.com hoy"), [{ de: "CREATZIA.COM", a: "creadsia.com" }]);
  assert.deepEqual(cueFixes("soy de crea dz ia", "soy de Creads IA"), [{ de: "crea dz ia", a: "Creads IA" }]);
  assert.deepEqual(cueFixes("hola mundo bonito", "hola mundo bonito"), []);
  assert.deepEqual(cueFixes("uno dos tres cuatro cinco seis", "uno 2 tres 4 cinco seis"), [{ de: "dos", a: "2" }, { de: "cuatro", a: "4" }]);
  assert.ok("error" in (cueFixes("a b c d e f", "x y") as object));
});

test("cueFixes: an added word is anchored to its neighbour", () => {
  assert.deepEqual(cueFixes("entra ya", "entra ahora ya"), [{ de: "entra", a: "entra ahora" }]);
});
