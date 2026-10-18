import { test } from "node:test";
import assert from "node:assert/strict";
import { budgetUnits, unitsToUsd } from "../src/lib/meta-graph";
import { cleanCampaign, matchesKeywords } from "../src/lib/marketing";
import { DEFAULT_STATE, cleanAction, describe } from "../src/lib/oficina";

const ad = "0f8e2c3a-1b2c-4d5e-8f90-123456789abc";

test("budgets in the ad account's currency", () => {
  assert.equal(budgetUnits(10, "USD", 1), 1000); // cents
  assert.equal(budgetUnits(10, "CLP", 950), 9500); // whole pesos
  assert.equal(unitsToUsd(9500, "CLP", 950), 10);
  assert.equal(unitsToUsd(1000, "USD", 1), 10);
});

test("campaigns are checked: cap, link, ad and audience", () => {
  const ok = cleanCampaign({ nombre: "Prueba", objetivo: "leads", paises: ["cl", "MX"], edadMin: 16, edadMax: 80, presupuestoUsd: 10, link: "https://www.creadsia.com", adId: ad, cta: "HACK" }, 30);
  assert.ok(typeof ok !== "string");
  assert.deepEqual(ok.paises, ["CL", "MX"]);
  assert.equal(ok.edadMin, 18);
  assert.equal(ok.edadMax, 65);
  assert.equal(ok.cta, "LEARN_MORE");
  assert.equal(typeof cleanCampaign({ presupuestoUsd: 50, link: "https://a.com", adId: ad }, 30), "string"); // over the cap
  assert.equal(typeof cleanCampaign({ presupuestoUsd: 5, link: "http://a.com", adId: ad }, 30), "string"); // not https
  assert.equal(typeof cleanCampaign({ presupuestoUsd: 5, link: "https://a.com", adId: "x" }, 30), "string"); // no ad
});

test("auto-reply keywords ignore accents and case", () => {
  assert.ok(matchesKeywords("Wow DONDE lo hacen??", ["dónde"]));
  assert.ok(!matchesKeywords("qué lindo", ["dónde", "link"]));
});

test("marketing moves are validated like the others", () => {
  const st = DEFAULT_STATE();
  const c = cleanAction({ tipo: "campana", nombre: "Leads CL", presupuestoUsd: 10, link: "https://www.creadsia.com", adId: ad, motivo: "probar" }, st, 30)!;
  assert.equal(describe(c), "Subir campaña en pausa: Leads CL");
  assert.equal(cleanAction({ tipo: "presupuesto", campaignId: "123456789", usd: 100 }, st, 30), null); // over the cap
  assert.equal(cleanAction({ tipo: "campana_estado", campaignId: "abc", on: true }, st, 30), null);
  assert.equal(cleanAction({ tipo: "anuncio", titulo: "Corto", guion: "muy corto" }, st), null);
  const p = cleanAction({ tipo: "publicacion", cuenta: "creads.videos", adId: ad, texto: "Hecho con Creads IA ✨" }, st)!;
  assert.equal(p.tipo, "publicacion");
});
