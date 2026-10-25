import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CASO_TEXTO, PERMISO_TEXTO, type Caso, aplicarAccion, esPublicable, inscribir, recibirTestimonio, retirarPermiso, tocaPedirTestimonio, transicion,
} from "../src/lib/caso-fundador";
import { fechaChile, tandaCompleta, tocaPackDia5, vencePack } from "../src/lib/correos-activacion";
import { embudoEmail } from "../src/lib/emails";

const DAY = 86400_000;
const who = { userId: "u1", ws: "ana-abc123", email: "ana@x.cl", name: "Ana Pérez", pedido: "CR-AAAAAA" };

test("caso fundador: the checkout consent stores the date and the exact text", () => {
  const now = new Date("2026-10-25T15:00:00Z");
  const c = inscribir(undefined, who, now);
  assert.equal(c.estado, "inscrito");
  assert.deepEqual(c.ayuda, { fecha: "2026-10-25T15:00:00.000Z", texto: CASO_TEXTO });
  assert.equal(CASO_TEXTO, "Quiero ayuda para armar mi primera campaña y doy permiso para mostrar mis anuncios y resultados.");
  assert.equal(c.historial.length, 1);
  // ticking again on a later checkout keeps the first acceptance and follows the newest order while waiting
  const again = inscribir(c, { ...who, pedido: "CR-BBBBBB" }, new Date("2026-10-26T15:00:00Z"));
  assert.equal(again.ayuda.fecha, c.ayuda.fecha);
  assert.equal(again.pedido, "CR-BBBBBB");
  const moved = inscribir({ ...c, estado: "recibido" }, { ...who, pedido: "CR-CCCCCC" });
  assert.equal(moved.pedido, "CR-AAAAAA");
  assert.equal(moved.estado, "recibido");
});

test("caso fundador: the testimonial is asked only to ticked cases, days 14 to 21 after the pack was paid", () => {
  const paid = "2026-10-01T12:00:00Z";
  const t0 = Date.parse(paid);
  const c = { estado: "inscrito" as const };
  assert.equal(tocaPedirTestimonio(c, paid, t0 + 13.9 * DAY), false);
  assert.equal(tocaPedirTestimonio(c, paid, t0 + 14 * DAY), true);
  assert.equal(tocaPedirTestimonio(c, paid, t0 + 20.9 * DAY), true);
  assert.equal(tocaPedirTestimonio(c, paid, t0 + 21 * DAY), false);
  assert.equal(tocaPedirTestimonio(c, null, t0 + 15 * DAY), false, "pack not paid: nothing");
  assert.equal(tocaPedirTestimonio({ estado: "pedido" }, paid, t0 + 15 * DAY), false, "only once");
});

test("caso fundador: status transitions (pedido → recibido → aprobado → publicado ⇄ aprobado)", () => {
  const base: Caso = { ...inscribir(undefined, who), estado: "pedido" };
  assert.equal(transicion(base, "aprobar"), null, "nothing received yet");
  const rec = recibirTestimonio(base, { nombre: "Ana", rubro: "Cosmética", texto: "Vendí más con la tanda de anuncios.", permiso: true }, new Date("2026-11-10T10:00:00Z"));
  assert.equal(rec.estado, "recibido");
  assert.deepEqual(rec.testimonio!.permiso, { fecha: "2026-11-10T10:00:00.000Z", texto: PERMISO_TEXTO });
  assert.equal(transicion(rec, "publicar"), null, "approve first");
  const apr = aplicarAccion(rec, "aprobar", "owner@x.cl")!;
  assert.equal(apr.estado, "aprobado");
  assert.ok(apr.aprobadoEn);
  assert.equal(esPublicable(apr), false);
  const pub = aplicarAccion(apr, "publicar", "owner@x.cl")!;
  assert.equal(pub.estado, "publicado");
  assert.equal(esPublicable(pub), true);
  const unpub = aplicarAccion(pub, "despublicar", "owner@x.cl")!;
  assert.equal(unpub.estado, "aprobado");
  assert.equal(unpub.publicadoEn, undefined);
  assert.equal(esPublicable(unpub), false);
  assert.equal(aplicarAccion(unpub, "despublicar", "o"), null);
  // editing sends it back for approval; withdrawing the permission stops it from being shown at once
  const edit = recibirTestimonio(pub, { nombre: "Ana", rubro: "", texto: "Versión nueva del testimonio.", permiso: true });
  assert.equal(edit.estado, "recibido");
  assert.equal(esPublicable(edit), false);
  const gone = retirarPermiso(pub);
  assert.equal(gone.testimonio!.permiso, undefined);
  assert.equal(esPublicable(gone), false);
  assert.equal(transicion(gone, "aprobar"), null, "no permission, no approval");
  // without the checkout consent stored it's never publishable either
  assert.equal(esPublicable({ ...pub, ayuda: undefined as unknown as Caso["ayuda"] }), false);
});

test("activation: Pack Prueba day 5 and the real discount deadline (pack paid + 7 days)", () => {
  const paid = "2026-10-25T18:40:00Z";
  const t0 = Date.parse(paid);
  assert.equal(vencePack(paid).toISOString(), "2026-11-01T18:40:00.000Z");
  assert.equal(tocaPackDia5(paid, t0 + 4.9 * DAY), false);
  assert.equal(tocaPackDia5(paid, t0 + 5 * DAY), true);
  assert.equal(tocaPackDia5(paid, t0 + 6 * DAY), false);
  assert.equal(tocaPackDia5(null, t0 + 5 * DAY), false);
  const f = fechaChile(vencePack(paid));
  assert.equal(f.fecha, "domingo 1 de noviembre");
  assert.equal(f.hora, "15:40");
});

test("activation: a batch is ready only when every piece has both formats", () => {
  assert.equal(tandaCompleta(null), false);
  assert.equal(tandaCompleta({ piezas: [] }), false);
  const p = (f45?: string, f916?: string) => ({ n: 1, tipo: "dolor" as const, titular: "", estilo: "", prompt: "", f45, f916 });
  assert.equal(tandaCompleta({ piezas: [p("a", "b"), p("c")] }), false);
  assert.equal(tandaCompleta({ piezas: [p("a", "b"), p("c", "d")] }), true);
});

test("activation emails: filled per customer, one button, opt-out line", () => {
  const unsub = "https://x.cl/api/correos/baja?e=a&t=b";
  const pack = embudoEmail("a@x.cl", "Ana", "pack-dia-5", unsub, { monto: "US$9", fecha: "domingo 1 de noviembre", hora: "15:40" });
  assert.equal(pack.subject, "Tu descuento de US$9 vence el domingo 1 de noviembre");
  assert.ok(pack.text.includes("hasta el domingo 1 de noviembre a las 15:40 (hora de Chile)"));
  assert.ok(pack.html.includes("No quiero recibir más consejos") && pack.unsub === unsub);
  assert.equal((pack.html.match(/<a href=/g) ?? []).length, 2, "one button + the opt-out link");
  const tanda = embudoEmail("a@x.cl", null, "tanda-lista", unsub, { n: "10", producto: "Sérum <b>", id: "t_abc12345" });
  assert.ok(tanda.html.includes("/app/tanda?id=t_abc12345"));
  assert.ok(tanda.html.includes("Sérum &lt;b&gt;") && !tanda.html.includes("Sérum <b>"));
  const caso = embudoEmail("a@x.cl", "Ana", "caso-dia-14", unsub);
  assert.ok(caso.html.includes("/app/caso"));
  assert.ok(!/\{\w+\}/.test(pack.html + tanda.html + caso.html), "no placeholder left");
});
