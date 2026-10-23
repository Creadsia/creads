import { test } from "node:test";
import assert from "node:assert/strict";
import { etapaOf } from "../src/lib/leads";

test("leads: how far an account got", () => {
  assert.equal(etapaOf({ pagosAbiertos: 0, pagado: false, generaciones: 0, anunciosListos: 0 }), "registro");
  assert.equal(etapaOf({ pagosAbiertos: 2, pagado: false, generaciones: 0, anunciosListos: 0 }), "pago-abierto");
  assert.equal(etapaOf({ pagosAbiertos: 1, pagado: true, generaciones: 0, anunciosListos: 0 }), "pago");
  assert.equal(etapaOf({ pagosAbiertos: 1, pagado: true, generaciones: 3, anunciosListos: 0 }), "creando");
  assert.equal(etapaOf({ pagosAbiertos: 1, pagado: true, generaciones: 3, anunciosListos: 1 }), "anuncio");
});
