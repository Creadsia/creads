import { PRUEBA_DESCUENTO_DIAS } from "./catalog";
import type { Tanda } from "./tanda-tipos";

// Activation emails (owner's plan, block F, 25 Oct 2026): the pure rules of who gets which email when.
// Sending lives in /api/cron/correos and /api/tanda; all of them only with CORREOS_COMPORTAMIENTO=1.

/**
 * When the Pack Prueba discount ends. The real rule (lib/billing.ts packParaDescontar, used by /api/pagos):
 * a plan ordered while the pack's payment (orders.closed_at) is less than PRUEBA_DESCUENTO_DIAS days old,
 * for an account that never paid a plan, gets the pack's price off. So the deadline is closed_at + 7 days.
 */
export const vencePack = (packPagadoEn: string) => new Date(Date.parse(packPagadoEn) + PRUEBA_DESCUENTO_DIAS * 86400_000);

/** Day 5 after the Pack Prueba payment (the hourly cron catches it within that day), and the discount still running. */
export function tocaPackDia5(packPagadoEn: string | null | undefined, now = Date.now()) {
  if (!packPagadoEn) return false;
  const days = (now - Date.parse(packPagadoEn)) / 86400_000;
  return Number.isFinite(days) && days >= 5 && days < 6 && vencePack(packPagadoEn).getTime() > now;
}

/** A batch is ready when every piece has both formats (4:5 and 9:16). */
export const tandaCompleta = (t: Pick<Tanda, "piezas"> | null | undefined) => Boolean(t?.piezas.length && t.piezas.every((p) => p.f45 && p.f916));

/** «domingo 1 de noviembre» and «15:40», in Chile's time. */
export function fechaChile(d: Date) {
  const tz = "America/Santiago";
  const weekday = d.toLocaleDateString("es-CL", { timeZone: tz, weekday: "long" });
  const date = d.toLocaleDateString("es-CL", { timeZone: tz, day: "numeric", month: "long" });
  const hora = d.toLocaleTimeString("es-CL", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
  return { fecha: `${weekday} ${date}`, hora };
}
