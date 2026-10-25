import { test } from "node:test";
import assert from "node:assert/strict";
import { embudoPorCanal, type CanalPedido } from "../src/lib/embudo-canal";

const pedido = (o: Partial<CanalPedido>): CanalPedido => ({ owner: "w1", item: "pack-prueba", status: "pagado", period: null, created_at: "2026-10-20T12:00:00Z", closed_at: "2026-10-20T12:00:00Z", payments: ["mp:1"], visitor: null, ...o });

test("funnel by channel: signups, activation, pack, pack→plan in 7 days, month-2 renewal", () => {
  const filas = embudoPorCanal({
    visitasPorCanal: { meta_ads: 100, instagram: 40 },
    cuentas: [{ ws: "w1", creada: "2026-10-20" }, { ws: "w2", creada: "2026-10-20" }, { ws: "w3", creada: "2026-10-21" }, { ws: "w4", creada: "2026-10-21" }],
    origen: { w1: "meta_ads", w2: "meta_ads", w3: "instagram" },
    referido: { w4: "JUAN" },
    activadas: new Set(["w1", "w2", "w3"]),
    pedidos: [
      pedido({ owner: "w1" }),
      pedido({ owner: "w1", item: "escala", period: "mensual", closed_at: "2026-10-24T12:00:00Z", payments: ["mp:2", "mp:3"] }),
      pedido({ owner: "w2" }),
      pedido({ owner: "w2", item: "testea", period: "mensual", closed_at: "2026-11-05T12:00:00Z" }), // after 7 days
      pedido({ owner: "w3", status: "pendiente" }),
    ],
  });
  const meta = filas.find((f) => f.canal === "meta_ads")!;
  assert.equal(meta.visitas, 100);
  assert.equal(meta.registros, 2);
  assert.equal(meta.activaciones, 2);
  assert.equal(meta.compras_pack, 2);
  assert.equal(meta.pack_a_plan_7d, 1);
  assert.equal(meta.renovaciones_mes2, 1);
  assert.deepEqual(meta.tasas, { activacion: 100, compra_pack: 100, pack_a_plan: 50 });
  const ig = filas.find((f) => f.canal === "instagram")!;
  assert.equal(ig.compras_pack, 0);
  assert.equal(ig.tasas.compra_pack, 0);
  assert.ok(filas.some((f) => f.canal === "ref:JUAN" && f.registros === 1 && f.tasas.activacion === 0));
});

test("accounts without a tag go to «sin dato» and empty bases give null rates", () => {
  const [f] = embudoPorCanal({ visitasPorCanal: {}, cuentas: [{ ws: "x", creada: "2026-10-20" }], origen: {}, referido: {}, activadas: new Set(), pedidos: [] });
  assert.equal(f.canal, "sin dato");
  assert.equal(f.tasas.compra_pack, null);
});
