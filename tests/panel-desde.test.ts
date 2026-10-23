import { test } from "node:test";
import assert from "node:assert/strict";
import { counts } from "../src/lib/panel-desde";

test("panel-desde: only from the chosen moment, never test accounts", () => {
  const d = { desde: "2026-10-23T01:30:00.000Z", pruebas: ["prueba-1"] };
  assert.equal(counts(d, "cliente", "2026-10-23T02:00:00.000Z"), true);
  assert.equal(counts(d, "cliente", "2026-10-22T20:00:00.000Z"), false);
  assert.equal(counts(d, "prueba-1", "2026-10-24T00:00:00.000Z"), false);
  assert.equal(counts({ desde: null, pruebas: [] }, "x", "2020-01-01T00:00:00Z"), true);
});
