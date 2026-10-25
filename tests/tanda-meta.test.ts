import { test } from "node:test";
import assert from "node:assert/strict";
import { META_COLUMNS, csvMeta, filasMeta, LEEME } from "../src/lib/tanda-meta";
import { extDe, zipName, type Tanda } from "../src/lib/tanda-tipos";
import { HOOKS, RUBROS, rellenar, todosLosHooks } from "../src/lib/hooks-biblioteca";
import { TIPOS } from "../src/lib/tanda-tipos";
import { sinVoseo } from "../src/lib/image-batch";

const tanda: Tanda = {
  id: "t_abc12345", createdAt: "2026-10-25T12:00:00.000Z", updatedAt: "2026-10-25T12:00:00.000Z", idioma: "es",
  producto: { nombre: "Faja Ñandú", descripcion: "Faja de algodón, cómoda. Se lava a máquina.", precio: "$24.990", publico: "mamás", beneficios: [], objeciones: [], foto: "", url: "https://tienda.cl/faja" },
  angulos: [],
  piezas: [
    { n: 1, tipo: "prueba_social", titular: "Lo que más nos preguntan, \"respondido\"", estilo: "a", prompt: "x", f45: "/api/media/ws/tandas/a.png", f916: "/api/media/ws/tandas/b.jpg" },
    { n: 2, tipo: "dolor", titular: "¿Te duele la espalda?", estilo: "b", prompt: "x", f45: "/api/media/ws/tandas/c.webp" },
    { n: 3, tipo: "oferta", titular: "Sin imagen", estilo: "c", prompt: "x" },
  ],
};

test("Meta CSV: BOM, header, one paused ad per finished image, names equal to the ZIP files", () => {
  const csv = csvMeta(tanda);
  assert.ok(csv.startsWith("﻿"));
  const lines = csv.slice(1).trimEnd().split("\r\n");
  assert.equal(lines[0], META_COLUMNS.join(","));
  const rows = filasMeta(tanda);
  assert.equal(rows.length, 3); // 2 feed + 1 stories; the piece without images is left out
  for (const r of rows) {
    assert.equal(r["Campaign Status"], "PAUSED");
    assert.equal(r["Ad Set Run Status"], "PAUSED");
    assert.equal(r["Ad Status"], "PAUSED");
    assert.equal(r["Link"], "https://tienda.cl/faja");
    assert.equal(r["Countries"], "CL");
    assert.equal(r["Ad Name"], r["Image File Name"].replace(/\.[a-z]+$/, ""));
  }
  assert.equal(new Set(rows.map((r) => r["Campaign Name"])).size, 1);
  assert.equal(new Set(rows.map((r) => r["Ad Set Name"])).size, 2);
  assert.equal(rows[0]["Image File Name"], zipName(tanda.piezas[0], "4x5", "png").split("/")[1]);
  assert.equal(rows[1]["Image File Name"], zipName(tanda.piezas[1], "4x5", "webp").split("/")[1]);
  assert.equal(rows[2]["Image File Name"], zipName(tanda.piezas[0], "9x16", "jpg").split("/")[1]);
  assert.match(rows[0]["Body"], /^Lo que más nos preguntan, "respondido"\. Faja de algodón, cómoda\. Conoce Faja Ñandú en el link\.$/);
  assert.match(csv, /"Lo que más nos preguntan, ""respondido""\./); // quotes and commas escaped
  assert.match(rows[1]["Body"], /^¿Te duele la espalda\? Faja/);
  assert.equal(rows[0]["Call to Action"], "SHOP_NOW");
  assert.equal(filasMeta(tanda, { pais: "MX" })[0]["Countries"], "MX");
  assert.match(LEEME("x.csv"), /biblioteca/);
});

test("extDe prefers the ref's extension, then the content type", () => {
  assert.equal(extDe("/a/b.jpeg"), "jpg");
  assert.equal(extDe("/a/b", "image/png"), "png");
  assert.equal(extDe("/a/b"), "jpg");
});

test("hooks library: every rubro has 6 angle families with 4-6 hooks, both languages, no voseo, no invented counts", () => {
  for (const r of RUBROS) for (const t of TIPOS) {
    const list = HOOKS[r][t];
    assert.ok(list.length >= 4 && list.length <= 6, `${r}/${t}`);
  }
  for (const h of todosLosHooks()) {
    assert.ok(h.es && h.en);
    assert.equal(sinVoseo(h.es), h.es, h.es);
    if (h.tipo === "prueba_social") assert.doesNotMatch(`${h.es} ${h.en}`, /\d/, h.es);
    assert.doesNotMatch(`${h.es} ${h.en}`, /\b(cura|curar|sana|kilos|ganar dinero|cure|heal|earn|income)\b/i, h.es);
  }
  assert.equal(rellenar("{producto} a {precio}", { producto: "Faja" }), "Faja a {precio}");
});
