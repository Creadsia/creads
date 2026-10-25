// «Control» for ad images: prompts (picture without text), prices of each step, what each stage allows,
// the instruction interpreter, the overlay layout (exact text inside the safe zones) and the quality log.
// Run: npx tsx --test tests/control-imagen.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FORMATOS_PIEZA, MAX_REHACER_GRATIS, type Pedido, type Trabajo, ZONAS, TAMANO, aplicarCambios, contraste, costosPasos, disenoInicial, faltantes,
  interpretarLocal, limpiarDiseno, limpiarInterpretacion, limpiarPedido, modeloBorrador, modeloFinal, promptEdicion, promptFormato, promptPieza,
  puede, qaPrompt, rehacerAuto, textoPlano,
} from "../src/lib/control-imagen";
import { assPieza, layoutPieza, palabras } from "../src/lib/pieza-texto";
import { ancho, cubre, metricas, FUENTES_PIEZA, type FuentePieza } from "../src/lib/fuente-metricas";
import { correoSemanal, resumirImagenes, type RegistroImagen } from "../src/lib/calidad-imagen";

const pedido: Pedido = { estilo: "ugc", escena: "cocina luminosa", idioma: "es-CL", producto: { nombre: "Sérum C", descripcion: "", foto: "ref:foto" } };
const marca = { c1: "#FF2BD6", c2: "#FFD400", logo: "ref:logo", logoPos: "arriba-der" };

test("the picture is always drawn without text, with the real product locked and a clean band for the headline", () => {
  const p = promptPieza(pedido, "4:5", "arriba");
  assert.match(p, /ABSOLUTELY NO TEXT/);
  assert.match(p, /REAL product/);
  assert.match(p, /same label/);
  assert.match(p, /TOP 31% of the frame/);
  assert.match(p, /Chile/);
  assert.match(promptPieza(pedido, "9:16", "abajo"), /BOTTOM [\s\S]*covers the top 14% and the bottom 20%/);
  assert.doesNotMatch(promptPieza({ ...pedido, producto: { ...pedido.producto, foto: "" } }, "1:1", "arriba"), /REAL product/);
  assert.match(promptPieza({ ...pedido, arreglos: ["hands had six fingers"] }, "4:5", "arriba"), /FIX THESE PROBLEMS.*six fingers/);
});

test("final formats are drawn from the approved draft; edits keep everything else; the QA checks product and deformities", () => {
  const f = promptFormato(pedido, "9:16", "arriba");
  assert.match(f, /FIRST attached image is the APPROVED draft/);
  assert.match(f, /SECOND attached image is the real product/);
  assert.match(f, /9:16/);
  assert.match(f, /ABSOLUTELY NO TEXT/);
  const e = promptEdicion(pedido, "Change the background to a kitchen", "4:5", "arriba");
  assert.match(e, /Change ONLY this: Change the background/);
  assert.match(e, /IDENTICAL/);
  const q = qaPrompt(pedido);
  assert.match(q, /different from the real one/);
  assert.match(q, /extra or missing fingers/);
  assert.match(q, /"grave"/);
});

test("prices: the draft uses the cheapest model that's on, approving costs 3 finals, text edits and redos are free", () => {
  const ms = [
    { id: "nano-banana-pro", label: "Pro", usd: 0.134, configured: true },
    { id: "nano-banana-2", label: "NB2", usd: 0.08, configured: true },
    { id: "flux-3-klein", label: "Klein", usd: 0.009, configured: false },
    { id: "flux-3", label: "FLUX", usd: 0.048, configured: true },
  ];
  assert.equal(modeloBorrador(ms)?.id, "flux-3");
  assert.equal(modeloBorrador(ms.map((m) => ({ ...m, configured: true })))?.id, "flux-3-klein");
  assert.equal(modeloFinal(ms)?.id, "nano-banana-2");
  assert.equal(modeloFinal(ms, "nano-banana-pro")?.id, "nano-banana-pro");
  assert.equal(modeloFinal(ms, "flux-3-klein")?.id, "nano-banana-2"); // off → default
  assert.equal(modeloBorrador([]), null);
  assert.deepEqual(costosPasos(0.009, 0.08), { vistaPrevia: 0.009, aprobar: 0.24, editarTexto: 0, editarImagen: 0.08, rehacer: 0 });
});

const trabajo = (over: Partial<Trabajo> = {}): Trabajo => ({
  id: "00000000-0000-0000-0000-000000000000", ws: "w", creado: "", pedido, diseno: { ...disenoInicial("ugc", marca, "es-CL"), titular: "Hola" },
  modeloBorrador: "flux-3-klein", modeloFinal: "nano-banana-2", etapa: "borrador", borradores: 1, autoTrabajo: 0, piezas: {}, historial: [], ...over,
});
const pieza = { uid: "u", limpia: "a", final: "b", modelo: "m", intentos: 1, auto: 0, rehechos: 0, ediciones: 0 };

test("each stage allows only what makes sense", () => {
  assert.equal(puede(null, "vista-previa"), null);
  assert.match(puede(null, "aprobar")!, /vista previa/);
  assert.match(puede(trabajo(), "aprobar")!, /vista previa/);
  const conBorrador = trabajo({ piezas: { borrador: pieza } });
  assert.equal(puede(conBorrador, "aprobar"), null);
  assert.equal(puede(conBorrador, "diseno"), null);
  assert.equal(puede(conBorrador, "rehacer", "borrador"), null);
  assert.match(puede(conBorrador, "rehacer", "9:16")!, /no existe/);
  assert.match(puede(trabajo({ borradores: 6 }), "vista-previa")!, /varias vistas previas/);
  const final = trabajo({ etapa: "final", piezas: { borrador: pieza, "4:5": pieza, "9:16": pieza, "1:1": pieza } });
  assert.match(puede(final, "aprobar")!, /Ya está aprobada/);
  assert.match(puede(final, "vista-previa")!, /nueva/);
  // a format that failed (refunded) can be made by approving again
  const parcial = trabajo({ etapa: "final", piezas: { borrador: pieza, "4:5": pieza } });
  assert.deepEqual(faltantes(parcial), ["9:16", "1:1"]);
  assert.equal(puede(parcial, "aprobar"), null);
  // free redos: 2 per piece
  assert.match(puede(trabajo({ piezas: { borrador: { ...pieza, rehechos: MAX_REHACER_GRATIS } } }), "rehacer", "borrador")!, /rehechos gratis/);
});

test("automatic redo only for severe QA problems: once per piece, at most 3 per image", () => {
  const malo = { ok: false, grave: true };
  assert.equal(rehacerAuto(malo, { auto: 0 }, { autoTrabajo: 0 }), true);
  assert.equal(rehacerAuto({ ok: false, grave: false }, { auto: 0 }, { autoTrabajo: 0 }), false);
  assert.equal(rehacerAuto({ ok: true, grave: false }, { auto: 0 }, { autoTrabajo: 0 }), false);
  assert.equal(rehacerAuto(malo, { auto: 1 }, { autoTrabajo: 0 }), false);
  assert.equal(rehacerAuto(malo, { auto: 0 }, { autoTrabajo: 3 }), false);
});

test("«Editar con una instrucción»: text and layout changes are free, picture changes are an image edit", () => {
  assert.deepEqual(interpretarLocal("texto más grande"), { tipo: "diseno", cambios: { tam: "mas" } });
  assert.deepEqual(interpretarLocal("cambia el fondo a cocina"), { tipo: "imagen", instruccion: "cambia el fondo a cocina" });
  assert.equal(interpretarLocal("quita a la persona").tipo, "imagen");
  assert.deepEqual(interpretarLocal('cambia el titular a "Envío gratis hoy"'), { tipo: "diseno", cambios: { titular: "Envío gratis hoy" } });
  assert.deepEqual(interpretarLocal("botón rojo"), { tipo: "diseno", cambios: { colorBoton: "#E53935" } });
  assert.deepEqual(interpretarLocal("sin logo"), { tipo: "diseno", cambios: { logoPos: "no" } });
  assert.deepEqual(interpretarLocal("pon el texto abajo"), { tipo: "diseno", cambios: { posicion: "abajo" } });
  const d = disenoInicial("oferta", marca, "es-CL");
  assert.equal(aplicarCambios(d, { tam: "mas" }).tam, 1.2);
  assert.equal(aplicarCambios({ ...d, tam: 1.5 }, { tam: "mas" }).tam, 1.5);
  assert.equal(aplicarCambios({ ...d, logo: "" }, { logoPos: "abajo" }).logoPos, "no");
  // Claude's answer is cleaned: junk fields and bad colours dropped
  assert.deepEqual(limpiarInterpretacion({ tipo: "diseno", cambios: { tam: "mas", colorTexto: "red", hack: 1 } }), { tipo: "diseno", cambios: { tam: "mas" } });
  assert.equal(limpiarInterpretacion({ tipo: "diseno", cambios: {} }), null);
  assert.deepEqual(limpiarInterpretacion({ tipo: "imagen", instruccion: "Replace the background with a kitchen" }), { tipo: "imagen", instruccion: "Replace the background with a kitchen" });
});

test("what the browser sends is made safe (no ASS tags, only the customer's files, known values)", () => {
  const base = disenoInicial("ugc", marca, "es-CL");
  const d = limpiarDiseno({ titular: "Hola {\\fs200}mundo\\N", colorBoton: "rojo", logo: "ref:otro", logoPos: "abajo", tam: 9 }, base, (r) => r === "ref:logo");
  assert.equal(d.titular, "Hola fs200mundoN");
  assert.equal(d.colorBoton, base.colorBoton);
  assert.equal(d.logo, "ref:logo");
  assert.equal(d.logoPos, "abajo");
  assert.equal(d.tam, 1.5);
  const p = limpiarPedido({ estilo: "x", idioma: "fr", producto: { foto: "ajena", nombre: "  Sérum  " } }, () => false);
  assert.equal(p.estilo, "ugc");
  assert.equal(p.idioma, "es-CL");
  assert.equal(p.producto.foto, "");
  assert.equal(p.producto.nombre, "Sérum");
  assert.equal(disenoInicial("oferta", marca, "en-US").cta, "Shop now");
  assert.equal(disenoInicial("oferta", marca, "es-CL").fondoCaja, "#FF2BD6"); // brand colour boxes
  assert.equal(disenoInicial("ugc", { ...marca, logo: "" }, "es").logoPos, "no");
  assert.equal(contraste("#FFFFFF"), "#000000");
  assert.equal(contraste("#111111"), "#FFFFFF");
});

test("brand fonts are read exactly and draw Spanish (accents, ñ, ¿¡)", () => {
  for (const f of Object.keys(FUENTES_PIEZA) as FuentePieza[]) {
    const m = metricas(f);
    assert.ok(cubre(m, "¿Ñandú? ¡Sí! áéíóú ÁÉÍÓÚ ü $ % «»"), f);
    const w = ancho(m, "Hola mundo", 100);
    assert.ok(w > 150 && w < 700, `${f}: ${w}`);
    assert.ok(Math.abs(ancho(m, "Hola mundo", 200) - 2 * w) < 0.01);
  }
});

test("the headline is laid out exactly as typed, inside each format's safe zone, and auto-fits", () => {
  assert.deepEqual(palabras("Envío *gratis hoy* ya"), [
    { t: "Envío", partes: [{ t: "Envío", h: false }] }, { t: "gratis", partes: [{ t: "gratis", h: true }] },
    { t: "hoy", partes: [{ t: "hoy", h: true }] }, { t: "ya", partes: [{ t: "ya", h: false }] },
  ]);
  // punctuation glued to a highlighted word stays glued (no extra space), and only the word is highlighted
  assert.deepEqual(palabras("de *verdad*, ya"), [
    { t: "de", partes: [{ t: "de", h: false }] }, { t: "verdad,", partes: [{ t: "verdad", h: true }, { t: ",", h: false }] }, { t: "ya", partes: [{ t: "ya", h: false }] },
  ]);
  const titular = "Llevo 3 meses usándolo y mi piel cambió *de verdad*, ¿y tú qué esperas?";
  for (const f of FORMATOS_PIEZA) for (const posicion of ["arriba", "abajo"] as const) for (const logoPos of ["arriba-izq", "abajo"] as const) {
    const d = { ...disenoInicial("ugc", { ...marca, logoPos }, "es-CL"), titular, posicion, logoPos };
    const L = layoutPieza(d, f);
    const [W, H] = TAMANO[f], z = ZONAS[f];
    assert.ok(L.titular?.cabe, `${f} ${posicion}`);
    // every word, in order, exactly once; no asterisks
    assert.equal(L.titular!.lineas.flatMap((l) => l.palabras.map((p) => p.t)).join(" "), textoPlano(titular));
    for (const l of L.titular!.lineas) {
      assert.ok(l.cx - l.w / 2 >= z.x0 * W - 1 && l.cx + l.w / 2 <= z.x1 * W + 1, `${f} line inside the sides`);
      assert.ok(l.cy - L.titular!.lineH / 2 >= z.y0 * H - 1 && l.cy + L.titular!.lineH / 2 <= z.y1 * H + 1, `${f} line inside top/bottom`);
    }
    const b = L.cta!.caja;
    assert.ok(b.y >= z.y0 * H && b.y + b.h <= z.y1 * H + 1, `${f} button inside`);
    assert.ok(L.logo!.y >= z.y0 * H - 1 && L.logo!.y + L.logo!.h <= z.y1 * H + 1, `${f} logo inside`);
    // nothing overlaps: headline, button and logo
    const top = Math.min(...L.titular!.lineas.map((l) => l.cy)) - L.titular!.lineH / 2;
    const bottom = Math.max(...L.titular!.lineas.map((l) => l.cy)) + L.titular!.lineH / 2;
    assert.ok(bottom <= b.y + 1 || top >= b.y + b.h - 1, `${f} ${posicion} headline vs button`);
    if (logoPos === "arriba-izq") assert.ok(top >= L.logo!.y + L.logo!.h, `${f} headline under the logo`);
  }
  // a short headline gets bigger letters than a long one; «más grande» never makes it smaller
  const corto = layoutPieza({ ...disenoInicial("oferta", marca, "es-CL"), titular: "2x1 hoy" }, "4:5").titular!;
  const largo = layoutPieza({ ...disenoInicial("oferta", marca, "es-CL"), titular }, "4:5").titular!;
  assert.ok(corto.size > largo.size);
  const grande = layoutPieza({ ...disenoInicial("oferta", marca, "es-CL"), titular, tam: 1.3 }, "4:5").titular!;
  assert.ok(grande.size >= largo.size);
  // lines are balanced: no lonely last word
  const bal = layoutPieza({ ...disenoInicial("lifestyle", marca, "es-CL"), titular: "Tu mañana, *más simple*", logoPos: "no" }, "4:5").titular!;
  assert.deepEqual(bal.lineas.map((l) => l.palabras.map((p) => p.t).join(" ")), ["Tu mañana,", "más simple"]);
});

test("the ASS overlay prints the exact words, highlights, the button and nothing from the asterisks", () => {
  const d = { ...disenoInicial("oferta", marca, "es-CL"), titular: "Envío *gratis* a todo Chile", cta: "Compra aquí" };
  const ass = assPieza(d, layoutPieza(d, "9:16"));
  assert.match(ass, /PlayResX: 1080\nPlayResY: 1920/);
  assert.match(ass, /WrapStyle: 2/);
  assert.doesNotMatch(ass, /\*/);
  assert.match(ass, /Envío/);
  assert.match(ass, /gratis/);
  assert.match(ass, /Compra aquí/);
  assert.match(ass, /\\fnAnton/);
  assert.match(ass, /\\1c&H00D4FF&/); // the highlight box in #FFD400
  assert.match(ass, /\\p1\}m /); // drawn boxes / pill
  const sinBoton = assPieza({ ...d, cta: "" }, layoutPieza({ ...d, cta: "" }, "1:1"));
  assert.doesNotMatch(sinBoton, /Compra aquí/);
});

const row = (r: Partial<RegistroImagen>): RegistroImagen => ({ at: "2026-10-20T10:00:00Z", ws: "w", evento: "pieza", uid: "x", pieza: "4:5", estilo: "ugc", ...r });

test("quality log: «primer intento OK» per type of piece, automatic and manual redos, and the weekly email", () => {
  const rows = [
    row({ uid: "a:borrador", pieza: "borrador", primerOk: true }),
    row({ uid: "a:4:5", primerOk: true }),
    row({ uid: "a:9:16", pieza: "9:16", primerOk: false }),
    row({ uid: "a:9:16", pieza: "9:16", evento: "auto", motivo: "manos raras" }),
    row({ uid: "a:1:1", pieza: "1:1", primerOk: true }),
    row({ uid: "a:1:1", pieza: "1:1", evento: "manual", motivo: "Producto deformado o distinto" }),
    row({ uid: "a:diseno", pieza: "diseno", evento: "edicion", motivo: "texto" }),
  ];
  const r = resumirImagenes(rows, 7);
  assert.equal(r.total.piezas, 4);
  assert.equal(r.total.primerOk, 2); // 9:16 needed the QA redo, 1:1 the customer asked for one
  assert.equal(r.total.tasa, 0.5);
  assert.equal(r.porPieza.find((f) => f.tipo === "9:16")?.auto, 1);
  assert.equal(r.porPieza.find((f) => f.tipo === "1:1")?.manual, 1);
  assert.equal(r.porPieza.find((f) => f.tipo === "borrador")?.tasa, 1);
  assert.deepEqual(r.ediciones, { texto: 1, imagen: 0 });
  assert.equal(r.motivos.length, 2);
  const c = correoSemanal(r);
  assert.match(c.subject, /50% salió bien al primer intento \(meta 90%\)/);
  assert.match(c.text, /Historias 9:16/);
  assert.match(c.text, /bajo la meta/);
  assert.equal(resumirImagenes([], 7).total.tasa, null);
});
