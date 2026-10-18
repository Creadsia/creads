import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, cleanConfig, failingModels, mergeIncidents, pageState } from "../src/lib/guardian";
import { oneLine } from "../src/lib/whatsapp";

const c = DEFAULT_CONFIG;

test("a page is ok, slow or down by its time and status", () => {
  assert.equal(pageState(800, 200, c), "ok");
  assert.equal(pageState(4000, 200, c), "lento");
  assert.equal(pageState(12000, 200, c), "falla");
  assert.equal(pageState(300, 503, c), "falla");
  assert.equal(pageState(300, 0, c), "falla");
});

test("only models failing a lot, with enough attempts, count", () => {
  const rows = [
    ...Array(3).fill({ model: "seedance", status: "failed" }), { model: "seedance", status: "done" },
    { model: "veo-fast", status: "failed" }, ...Array(9).fill({ model: "veo-fast", status: "done" }),
    { model: "kling", status: "failed" }, { model: "kling", status: "generating" },
  ];
  assert.deepEqual(failingModels(rows, c), [["seedance", 3, 4]]);
});

test("incidents open, repeat, worsen and close by themselves", () => {
  const p = (key: string, severidad: "aviso" | "critico" = "aviso") => ({ key, area: "plataforma" as const, severidad, titulo: key, detalle: "d" });
  let r = mergeIncidents([], [p("a"), p("b")], "t1");
  assert.equal(r.nuevos.length, 2);
  r = mergeIncidents(r.list, [p("a", "critico")], "t2");
  assert.equal(r.nuevos.length, 0);
  assert.equal(r.peores.length, 1);
  assert.deepEqual(r.resueltos.map((i) => i.key), ["b"]);
  const a = r.list.find((i) => i.key === "a")!;
  assert.equal(a.count, 2);
  assert.equal(a.abierto, true);
  const once = mergeIncidents(r.list, [{ ...p("x"), accion: "hice algo", oneOff: true }], "t3");
  const x = once.list.find((i) => i.key === "x")!;
  assert.equal(x.abierto, false);
  assert.deepEqual(x.acciones, ["hice algo"]);
});

test("thresholds the owner types stay within sane limits", () => {
  const k = cleanConfig({ lentoMs: 50, caidoMs: 40, fallasPct: 500, whatsapp: false, erroresMax: "x" as never }, c);
  assert.equal(k.lentoMs, 500);
  assert.ok(k.caidoMs > k.lentoMs);
  assert.equal(k.fallasPct, 100);
  assert.equal(k.whatsapp, false);
  assert.equal(k.erroresMax, c.erroresMax);
});

test("WhatsApp template text is one line", () => {
  assert.equal(oneLine("a\nb\t c     d"), "a · b · c d");
});
