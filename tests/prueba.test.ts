import { test } from "node:test";
import assert from "node:assert/strict";
import { darRegalo, tarjetaObligatoria } from "../src/lib/regalo";

test("card trial: without a card the gift is not given (checked before anything else)", async () => {
  const before = process.env.REGALO_CON_TARJETA, pack = process.env.MODO_PACK;
  process.env.REGALO_CON_TARJETA = "1";
  process.env.MODO_PACK = "0"; // the card trial only exists without the Pack Prueba
  try {
    assert.equal(tarjetaObligatoria(), true);
    assert.deepEqual(await darRegalo("ws-test", "ana@example.com"), { ok: false, why: "tarjeta" });
  } finally {
    if (before === undefined) delete process.env.REGALO_CON_TARJETA; else process.env.REGALO_CON_TARJETA = before;
    if (pack === undefined) delete process.env.MODO_PACK; else process.env.MODO_PACK = pack;
  }
  // Pack Prueba (default since 25 Oct 2026): no card trial and no free gift
  assert.equal(tarjetaObligatoria(), false);
  assert.deepEqual(await darRegalo("ws-test", "ana@example.com"), { ok: false, why: "pack" });
});
