import { test } from "node:test";
import assert from "node:assert/strict";
import { planesPorPieza } from "../src/lib/rentabilidad";
import { SHOWN_PLANS } from "../src/lib/catalog";

test("real cost per plan: Agencia's worst case is product videos (~US$75,81, ~51%)", () => {
  const rows = planesPorPieza(SHOWN_PLANS);
  const ag = rows.find((r) => r.precio === 149)!;
  assert.equal(ag.todo.producto.piezas, 133);
  assert.equal(ag.todo.producto.usd, 75.81);
  assert.equal(ag.peor, "producto");
  assert.equal(ag.pctPeor, 51);
  const es = rows.find((r) => r.precio === 59)!;
  assert.equal(es.todo.imagen.piezas, 95);
  assert.ok(es.queda > 0);
});
