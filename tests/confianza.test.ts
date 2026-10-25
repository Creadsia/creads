import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bloquesTexto,
  contadoresVisibles,
  enLinea,
  esArchivoGaleria,
  fechaValida,
  filtrarPorNicho,
  formatoContador,
  itemPublico,
  limpiarEntrada,
  limpiarItemGaleria,
  marcasActivas,
  metodosPago,
  mover,
  nichosConItems,
  ordenarEntradas,
  promesaSoporte,
  roadmapPorEstado,
  umbralesContadores,
  type EntradaRoadmap,
} from "../src/lib/confianza";

const raw = (anuncios: number, marcas: number) => ({ anuncios, marcas, actualizado: "2026-10-25T00:00:00Z" });

test("confianza: counters stay hidden below their threshold (defaults 1000 / 50)", () => {
  assert.deepEqual(contadoresVisibles(raw(999, 49), {}), []);
  assert.deepEqual(contadoresVisibles(null, {}), []);
  const both = contadoresVisibles(raw(1234, 57), {});
  assert.deepEqual(both.map((c) => [c.id, c.texto]), [["anuncios", "1.200+"], ["marcas", "50+"]]);
  // only the one that passed
  assert.deepEqual(contadoresVisibles(raw(5000, 3), {}).map((c) => c.id), ["anuncios"]);
});

test("confianza: thresholds come from env; bad values fall back; zero never shows", () => {
  assert.deepEqual(umbralesContadores({ CONTADOR_MIN_ANUNCIOS: "200", CONTADOR_MIN_MARCAS: "abc" }), { anuncios: 200, marcas: 50 });
  assert.deepEqual(umbralesContadores({ CONTADOR_MIN_ANUNCIOS: "0", CONTADOR_MIN_MARCAS: "" }), { anuncios: 1000, marcas: 50 });
  assert.equal(contadoresVisibles(raw(250, 0), { CONTADOR_MIN_ANUNCIOS: "200", CONTADOR_MIN_MARCAS: "1" }).length, 1);
});

test("confianza: counter numbers are rounded down, never up", () => {
  assert.equal(formatoContador(7), "7");
  assert.equal(formatoContador(99), "90+");
  assert.equal(formatoContador(1000), "1.000+");
  assert.equal(formatoContador(1999), "1.900+");
  assert.equal(formatoContador(12_345), "12.000+");
  assert.equal(formatoContador(987_654), "980.000+");
});

test("confianza: active brands = kits of accounts that produced in 30 days (no Creadsia, no tests)", () => {
  const since = "2026-09-25T00:00:00Z";
  const files = [
    { name: "cliente-uno.json", updated_at: "2026-01-01T00:00:00Z" }, // active account → counts
    { name: "cliente-uno-2.json", updated_at: "2026-01-01T00:00:00Z" }, // 2nd kit of the same active account → counts
    { name: "cliente-uno-activa.json", updated_at: "2026-10-20T00:00:00Z" }, // not a kit
    { name: "cliente-dos.json", updated_at: "2026-10-20T00:00:00Z" }, // kit saved recently → counts
    { name: "cliente-tres.json", updated_at: "2026-01-01T00:00:00Z" }, // idle → no
    { name: "main.json", updated_at: "2026-10-20T00:00:00Z" }, // Creadsia → no
    { name: "prueba-x.json", updated_at: "2026-10-20T00:00:00Z" }, // test account → no
    { name: "notes.txt", updated_at: "2026-10-20T00:00:00Z" },
  ];
  assert.equal(marcasActivas(files, new Set(["cliente-uno", "main"]), since, ["prueba-x"]), 3);
});

test("confianza: gallery niche filter and chips (never an empty chip)", () => {
  const items = [{ id: "a", nicho: "moda" }, { id: "b", nicho: "belleza" }, { id: "c", nicho: "moda" }];
  assert.deepEqual(filtrarPorNicho(items, "moda").map((i) => i.id), ["a", "c"]);
  assert.deepEqual(filtrarPorNicho(items, "todos").map((i) => i.id), ["a", "b", "c"]);
  assert.deepEqual(filtrarPorNicho(items, null).length, 3);
  assert.deepEqual(filtrarPorNicho(items, "hogar"), []);
  // fixed order (belleza before moda), only niches with items
  assert.deepEqual(nichosConItems(items), [["belleza", "Belleza"], ["moda", "Moda"]]);
  assert.deepEqual(nichosConItems([]), []);
  assert.deepEqual(mover(items, "c", -1).map((i) => i.id), ["a", "c", "b"]);
  assert.deepEqual(mover(items, "a", -1).map((i) => i.id), ["a", "b", "c"]);
});

test("confianza: gallery items only from Creadsia's gallery folder, public shape hides the storage path", () => {
  const ref = "/api/media/ws/main/portada/0a1b2c3d-1111-2222-3333-444455556666.mp4";
  assert.equal(esArchivoGaleria(ref), true);
  assert.equal(esArchivoGaleria("/api/media/ws/cliente/portada/x.mp4"), false);
  assert.equal(esArchivoGaleria("/api/media/ws/main/images/x.png"), false);
  assert.equal(esArchivoGaleria("/api/media/ws/main/portada/../x.png"), false);
  assert.equal(esArchivoGaleria("https://evil.example/x.png"), false);

  const r = limpiarItemGaleria({ ref, nicho: "mascotas", tipo: "video-producto", caption: "  Collar   GPS ", poster: "/api/media/ws/main/portada/p.jpg" }, "item-123456", new Date("2026-10-25T12:00:00Z"));
  assert.ok("item" in r);
  assert.equal(r.item.media, "video");
  assert.equal(r.item.formato, "9:16");
  assert.equal(r.item.caption, "Collar GPS");
  const pub = itemPublico(r.item);
  assert.equal(pub.src, "/api/galeria/item-123456");
  assert.equal(pub.poster, "/api/galeria/item-123456?poster=1");
  assert.equal(pub.nichoLabel, "Mascotas");
  assert.ok(!JSON.stringify(pub).includes("/api/media/"));

  assert.ok("error" in limpiarItemGaleria({ ref, nicho: "autos", tipo: "imagen" }, "item-123456"));
  assert.ok("error" in limpiarItemGaleria({ ref, nicho: "moda", tipo: "gif" }, "item-123456"));
  assert.ok("error" in limpiarItemGaleria({ nicho: "moda", tipo: "imagen" }, "item-123456"));
  const img = limpiarItemGaleria({ ref: "/api/media/ws/main/portada/a.png", nicho: "moda", tipo: "imagen", poster: "/api/media/ws/main/portada/b.png" }, "item-654321");
  assert.ok("item" in img && img.item.formato === "4:5" && img.item.poster === undefined);
});

test("confianza: changelog / roadmap entries are validated", () => {
  assert.equal(fechaValida("2026-10-25"), true);
  assert.equal(fechaValida("2026-02-30"), false);
  assert.equal(fechaValida("25-10-2026"), false);
  const ok = limpiarEntrada({ fecha: "2026-10-25", titulo: "  Llegó Veo 3.1 ", texto: "Más rápido.\r\n\r\n\r\n- Uno\n- Dos" }, "novedades", "nov-000001");
  assert.ok("entrada" in ok);
  assert.equal(ok.entrada.titulo, "Llegó Veo 3.1");
  assert.equal(ok.entrada.texto, "Más rápido.\n\n- Uno\n- Dos");
  assert.ok(!("estado" in ok.entrada));
  assert.ok("error" in limpiarEntrada({ fecha: "2026-13-01", titulo: "Hola mundo" }, "novedades", "nov-000001"));
  assert.ok("error" in limpiarEntrada({ fecha: "2026-10-25", titulo: "ab" }, "novedades", "nov-000001"));
  assert.ok("error" in limpiarEntrada({ fecha: "2026-10-25", titulo: "Algo nuevo" }, "roadmap", "rm-0000001"));
  const rm = limpiarEntrada({ fecha: "2026-10-25", titulo: "Algo nuevo", estado: "en-curso" }, "roadmap", "rm-0000001");
  assert.ok("entrada" in rm && (rm.entrada as EntradaRoadmap).estado === "en-curso");
  assert.ok("error" in limpiarEntrada({ fecha: "2026-10-25", titulo: "Algo nuevo" }, "novedades", "bad id!"));
});

test("confianza: entries newest first, roadmap grouped by status without empty groups", () => {
  const xs: EntradaRoadmap[] = [
    { id: "a", fecha: "2026-10-01", titulo: "A", texto: "", estado: "listo" },
    { id: "b", fecha: "2026-10-20", titulo: "B", texto: "", estado: "en-curso" },
    { id: "c", fecha: "2026-10-20", titulo: "C", texto: "", estado: "listo" },
  ];
  assert.deepEqual(ordenarEntradas(xs).map((x) => x.id), ["c", "b", "a"]);
  assert.deepEqual(roadmapPorEstado(xs).map((g) => [g.estado, g.entradas.map((e) => e.id)]), [["en-curso", ["b"]], ["listo", ["c", "a"]]]);
});

test("confianza: simple text format (paragraphs, lists, bold, safe links only)", () => {
  assert.deepEqual(enLinea("Ahora con **Kling 3** y [más](https://creadsia.com/novedades)."), [
    { t: "Ahora con " }, { t: "Kling 3", b: true }, { t: " y " }, { t: "más", href: "https://creadsia.com/novedades" }, { t: "." },
  ]);
  // javascript: links stay plain text
  assert.deepEqual(enLinea("[x](javascript:alert(1))"), [{ t: "[x](javascript:alert(1))" }]);
  const b = bloquesTexto("Primera línea\nsigue\n\n- uno\n- dos\nfin");
  assert.deepEqual(b.map((x) => x.tipo), ["p", "ul", "p"]);
  assert.deepEqual(b[0], { tipo: "p", trozos: [{ t: "Primera línea sigue" }] });
  assert.equal(bloquesTexto("   ").length, 0);
});

test("confianza: support promise and payment methods", () => {
  assert.equal(promesaSoporte({}), "Respondemos en menos de 12 horas hábiles");
  assert.equal(promesaSoporte({ SOPORTE_PROMESA: " Respondemos el mismo día " }), "Respondemos el mismo día");
  assert.equal(promesaSoporte({ SOPORTE_PROMESA: "-" }), "");
  assert.equal(promesaSoporte({ SOPORTE_PROMESA: "  " }), "Respondemos en menos de 12 horas hábiles");
  assert.deepEqual(metodosPago({}), []);
  assert.deepEqual(metodosPago({ MP_ACCESS_TOKEN: "APP_USR-x" }), ["mercadopago"]);
  assert.deepEqual(metodosPago({ NEXT_PUBLIC_MP_PUBLIC_KEY: "APP_USR-y" }), ["mercadopago"]);
  assert.deepEqual(metodosPago({ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live" }), []);
  assert.deepEqual(metodosPago({ STRIPE_SECRET_KEY: "sk", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk", MP_ACCESS_TOKEN: "t" }), ["mercadopago", "stripe"]);
});
