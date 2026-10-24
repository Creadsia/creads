import { test } from "node:test";
import assert from "node:assert/strict";
import { sinVoseo } from "../src/lib/image-batch";

test("image copy speaks Chilean tú, never vos", () => {
  assert.equal(sinVoseo("Dejá de pagar por cada anuncio nuevo"), "Deja de pagar por cada anuncio nuevo");
  assert.equal(sinVoseo("PROBÁ CREADS IA AHORA"), "PRUEBA CREADS IA AHORA");
  assert.equal(sinVoseo("Si vos tenés una tienda, esto está listo"), "Si tú tienes una tienda, esto está listo");
});
