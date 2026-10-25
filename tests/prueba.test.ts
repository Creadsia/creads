import { test } from "node:test";
import assert from "node:assert/strict";
import { darRegalo, tarjetaObligatoria } from "../src/lib/regalo";

test("card trial: without a card the gift is not given (checked before anything else)", async () => {
  const before = process.env.REGALO_CON_TARJETA;
  process.env.REGALO_CON_TARJETA = "1";
  try {
    assert.equal(tarjetaObligatoria(), true);
    assert.deepEqual(await darRegalo("ws-test", "ana@example.com"), { ok: false, why: "tarjeta" });
  } finally {
    if (before === undefined) delete process.env.REGALO_CON_TARJETA; else process.env.REGALO_CON_TARJETA = before;
  }
  assert.equal(tarjetaObligatoria(), before === "1");
});
