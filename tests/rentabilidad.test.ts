import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FINANZAS } from "../src/lib/finance";
import { type AdRow, type ChargeRow, type ClipRow, cheaperSteps, customerSegment, familyOf, internalSegment, leaks, planMargins, realCostPerCredit } from "../src/lib/rentabilidad";

const old = "2026-09-01T12:00:00Z";
const ad = (o: Partial<AdRow>): AdRow => ({ id: "a1", owner: "w1", format: "ugc", status: "done", final_url: "x", created_at: old, ...o });
const clip = (o: Partial<ClipRow>): ClipRow => ({ id: "c1", owner: "w1", ad_id: "a1", kind: "cut", model: "veo-fast", status: "done", usd: 0.8, created_at: old, ...o });
const ch = (o: Partial<ChargeRow>): ChargeRow => ({ id: 1, owner: "w1", delta: -40, kind: "charge", note: "Corte 1 · Veo 3.1 Fast", ref: "c1", usd: 0.8, created_at: old, ...o });

test("provider families from models and notes", () => {
  assert.equal(familyOf("veo-fast"), "Veo");
  assert.equal(familyOf("Corte 2 · Seedance 2.0"), "Seedance");
  assert.equal(familyOf("Historia · narrador"), "ElevenLabs");
  assert.equal(familyOf("Imagen · Nano Banana Pro"), "Nano Banana");
  assert.equal(familyOf("Quitar fondo"), "Herramientas");
});

test("customers: retries, failures and free redos are all in the cost of finished ads", () => {
  const ads = [ad({}), ad({ id: "a2", status: "failed", final_url: null })];
  const clips = [clip({}), clip({ id: "c2" }), clip({ id: "c3", ad_id: "a2", model: "seedance" })];
  const charges = [
    ch({ id: 1, ref: "c1" }), ch({ id: 2, ref: "c1" }), // c1 tried twice
    ch({ id: 3, ref: "c2", delta: 0 }), // free redo
    ch({ id: 4, ref: "c3", note: "Corte 1 · Seedance 2.0", usd: 2.4 }),
    { id: 5, owner: "w1", delta: 40, kind: "refund", note: "Devuelto", ref: "charge:4", usd: null, created_at: old },
  ];
  const s = customerSegment(ads, clips, charges, Date.parse("2026-10-17T12:00:00Z"));
  assert.equal(s.usd, 4.8);
  assert.equal(s.usdFallas, 2.4);
  assert.equal(s.usdRehechosGratis, 0.8);
  assert.equal(s.usdAbandonados, 2.4);
  const f = s.formatos[0];
  assert.equal(f.terminados, 1);
  assert.equal(f.usdPorTerminado, 4.8); // the failed ad's cost lands on the finished one
  assert.equal(f.intentosPorCorte, 4 / 3 > 1 ? 1.33 : 1);
  const seed = s.proveedores.find((p) => p.familia === "Seedance")!;
  assert.deepEqual([seed.intentos, seed.fallas, seed.usdFallas], [1, 1, 2.4]);
});

test("internal account uses the clips' own cost", () => {
  const s = internalSegment([ad({ owner: "main" })], [clip({ owner: "main" }), clip({ id: "c2", owner: "main", status: "failed", usd: 0.4 })]);
  assert.equal(s.usd, 1.2);
  assert.equal(s.usdFallas, 0.4);
});

test("real cost per credit needs enough data and counts failures and free redos on top", () => {
  assert.equal(realCostPerCredit([ch({})]), null);
  const many = Array.from({ length: 20 }, (_, i) => ch({ id: i + 1, delta: -50, usd: 1 }));
  const r = realCostPerCredit([...many, ch({ id: 99, delta: 0, usd: 1 })])!;
  assert.equal(r.base, 0.02);
  assert.equal(r.usd, 0.021);
});

test("plan margins at full use and leaks rank biggest first", () => {
  const c = DEFAULT_FINANZAS.config;
  const rows = planMargins(c, c.planes, 0.05);
  assert.ok(rows.length > 0);
  const empty = { formatos: [], proveedores: [], usd: 0, usdFallas: 0, usdRehechosGratis: 0, usdAbandonados: 0, anunciosAbandonados: 0 };
  const l = leaks({ days: 30, clientes: { ...empty, usdRehechosGratis: 5 }, interno: empty, planes: rows, ordersByPlan: {} });
  assert.ok(l.length >= 2);
  for (let i = 1; i < l.length; i++) assert.ok(l[i - 1].usdMes >= l[i].usdMes);
});

test("cheaper steps only suggest models that really cost less", () => {
  const tips = cheaperSteps(DEFAULT_FINANZAS.modelos, { Veo: 100 }, 30);
  assert.ok(tips.length > 0);
  for (const t of tips) assert.ok(t.ahorroPct > 0 && t.ahorroPct < 100);
  assert.ok(tips.find((t) => t.paso.startsWith("Cortes con persona"))!.ahorroMes > 0);
});
