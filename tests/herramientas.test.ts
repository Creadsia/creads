import { test } from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { HOOKS_TOTAL, USOS_DIA, entradaHooks, hooksPrompt, leerHooks } from "../src/lib/generador-hooks";
import { CSV_PLANTILLA, PASOS_PLANTILLA, csvPlantilla, zipPlantilla } from "../src/lib/plantilla-meta";
import { META_COLUMNS } from "../src/lib/tanda-meta";
import { origenLead } from "../src/lib/waitlist";
import { bucketLimit } from "../src/lib/rate";
import type { Pagina } from "../src/lib/tanda";

const pagina: Pagina = { url: "https://tienda.cl/faja", titulo: "Faja Ñandú", descripcion: "Faja de algodón.", precio: "24990 CLP", imagenes: [], texto: "Faja cómoda que se lava a máquina." };

test("hooks prompt: reads the page or the description, asks for 3 angles and 10 hooks, never invented proof", () => {
  const p = hooksPrompt({ pagina, idioma: "es" });
  assert.match(p, /PRODUCT PAGE \(https:\/\/tienda\.cl\/faja\)/);
  assert.match(p, /Price: 24990 CLP/);
  assert.match(p, /3 STRONGEST/);
  assert.match(p, /Exactly 10 hooks in total: 4 for the first angle, 3 for the second, 3 for the third/);
  assert.match(p, /no invented testimonials/);
  assert.match(p, /Spanish \(neutral Latin American/);
  const d = hooksPrompt({ descripcion: "Curso de Excel para administrativos", idioma: "en" });
  assert.match(d, /THE ADVERTISER DESCRIBES THEIR PRODUCT: """Curso de Excel para administrativos"""/);
  assert.match(d, /English \(United States\)/);
  assert.doesNotMatch(d, /PRODUCT PAGE/);
});

test("hooks answer: max 3 angles and 10 hooks, duplicates and empties dropped, bad types fixed", () => {
  const mk = (n: number, pre: string) => Array.from({ length: n }, (_, i) => `${pre} ${i + 1}`);
  const out = leerHooks({
    producto: "  Faja  ",
    angulos: [
      { tipo: "dolor", titulo: "Adiós dolor de espalda", por_que: "Habla del problema.", hooks: ["«¿Te duele la espalda?»", "¿te duele la ESPALDA?", "", ...mk(5, "Dolor")] },
      { tipo: "raro", titulo: "Lo que quieres", por_que: "x", hooks: mk(4, "Deseo") },
      { tipo: "oferta", titulo: "", hooks: mk(3, "Sin título") },
      { tipo: "oferta", titulo: "Precio claro", hooks: mk(3, "Oferta") },
      { tipo: "mecanismo", titulo: "Cuarto", hooks: mk(3, "Cuarto") },
    ],
  });
  assert.ok(out);
  assert.equal(out.producto, "Faja");
  // only the first 3 angles are read; the one without a title is dropped
  assert.deepEqual(out.angulos.map((a) => a.titulo), ["Adiós dolor de espalda", "Lo que quieres"]);
  assert.equal(out.angulos[0].hooks[0], "¿Te duele la espalda?"); // quotes stripped, case-insensitive duplicate dropped
  assert.equal(out.angulos[1].tipo, "deseo");
  assert.equal(out.angulos.reduce((n, a) => n + a.hooks.length, 0), HOOKS_TOTAL);
  assert.equal(leerHooks({ angulos: [{ titulo: "Uno", hooks: ["a", "b"] }] }), null);
  assert.equal(leerHooks(null), null);
  // voseo is fixed only in Spanish
  assert.equal(leerHooks({ angulos: [{ titulo: "A", hooks: ["¿Querés dormir mejor?", "h2", "h3"] }, { titulo: "B", hooks: ["h4", "h5"] }] }, "es")!.angulos[0].hooks[0], "¿Quieres dormir mejor?");
});

test("hooks input: link or a real description, checked before anything is spent", () => {
  assert.ok("error" in entradaHooks({}));
  assert.ok("error" in entradaHooks({ descripcion: "corto" }));
  assert.ok("error" in entradaHooks({ url: "no es un link" }));
  assert.deepEqual(entradaHooks({ url: " https://tienda.cl/p ", idioma: "en" }), { url: "https://tienda.cl/p", descripcion: "", idioma: "en" });
  assert.deepEqual(entradaHooks({ descripcion: "Botella térmica para gente que entrena", idioma: "fr" }), { url: "", descripcion: "Botella térmica para gente que entrena", idioma: "es" });
});

test("rate limit: the free hook generator allows 3 uses per connection per day", async () => {
  assert.deepEqual(bucketLimit("hooksIp"), [24 * 60 * 60, USOS_DIA]);
  process.env.SUPABASE_URL = "https://sb.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test";
  const counts = new Map<string, number>();
  const seen: Record<string, unknown>[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
    if (!String(input).includes("/rest/v1/rpc/hit_rate")) return new Response("not mocked", { status: 500 });
    const a = JSON.parse(String(init.body));
    seen.push(a);
    const n = (counts.get(a.p_key) ?? 0) + 1;
    counts.set(a.p_key, n);
    return new Response(JSON.stringify(n <= a.p_max), { status: 200 });
  }) as typeof fetch;
  try {
    const { tooMany } = await import("../src/lib/rate");
    const r = [];
    for (let i = 0; i < 4; i++) r.push(await tooMany("hooksIp", "1.2.3.4"));
    assert.deepEqual(r.slice(0, 3), [null, null, null]);
    assert.equal(r[3]?.status, 429);
    assert.match(String((await r[3]!.json()).error), /3 usos gratis/);
    assert.equal(await tooMany("hooksIp", "5.6.7.8"), null); // another connection has its own count
    assert.deepEqual(seen[0], { p_key: "hooksIp:1.2.3.4", p_window: 86400, p_max: 3 });
  } finally { globalThis.fetch = real; }
});

test("Meta template: same columns as a batch, 6 paused example rows, ZIP with the CSV and the LEEME", () => {
  const csv = csvPlantilla();
  const lines = csv.slice(1).trimEnd().split("\r\n");
  assert.equal(lines[0], META_COLUMNS.join(","));
  assert.equal(lines.length, 7);
  assert.ok(lines.slice(1).every((l) => l.includes("PAUSED") && l.includes("https://www.tu-tienda.com/producto")));
  assert.equal(PASOS_PLANTILLA.length, 4);
  const files = unzipSync(zipPlantilla());
  assert.deepEqual(Object.keys(files).sort(), ["LEEME.txt", CSV_PLANTILLA].sort());
  assert.equal(Buffer.from(files[CSV_PLANTILLA]).toString("utf8"), csv); // BOM kept, so Excel shows accents
  const leeme = strFromU8(files["LEEME.txt"]);
  assert.match(leeme, /Importar anuncios en bloque/);
  assert.match(leeme, /4\) Completa y activa/);
});

test("template lead: the niche keeps the tool and where the visitor came from", () => {
  assert.equal(origenLead("Plantilla Meta", {}), "Plantilla Meta");
  assert.equal(origenLead("Plantilla Meta", { src: "instagram", camp: "octubre" }), "Plantilla Meta · fuente instagram · campaña octubre");
  assert.ok(origenLead("Plantilla Meta", { src: "x", camp: "y".repeat(200) }).length <= 80);
});
