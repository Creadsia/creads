// The guarantee, word for word (owner's plan, 25 Oct 2026): the same text on the cards, checkout, FAQ and
// Terms. Browser-safe. The Pack amount comes from the catalog so a price change can't leave an old number here.
import { PRUEBA, clpFor } from "./catalog";

const clp = (usd: number) => `$${clpFor(usd).toLocaleString("es-CL")}`;

export const GARANTIA_DIAS = 7;
/** Share of the balance a customer may have used and still get the plan's first payment back. */
export const GARANTIA_USO_MAX = 0.2;

export const GARANTIA = {
  pack: `Garantía de tu primera tanda: si no te sirve para publicar, escríbenos dentro de ${GARANTIA_DIAS} días y te devolvemos los ${clp(PRUEBA.usd)}.`,
  planes: `${GARANTIA_DIAS} días de garantía: si los anuncios no te sirven, te devolvemos el 100% del primer pago, aunque hayas usado hasta el ${Math.round(GARANTIA_USO_MAX * 100)}% de tu saldo.`,
  labios: "Un video con labios desincronizados se rehace gratis, siempre.",
  boton: `Garantía de ${GARANTIA_DIAS} días. Cancela cuando quieras.`,
  contacto: "Escríbenos a hola@creadsia.com.",
} as const;

export const GARANTIA_EN = {
  pack: `First-batch guarantee: if it isn't good enough to publish, write to us within ${GARANTIA_DIAS} days and we refund your US$${PRUEBA.usd}.`,
  planes: `${GARANTIA_DIAS}-day guarantee: if the ads don't work for you, we refund 100% of your first payment, even if you used up to ${Math.round(GARANTIA_USO_MAX * 100)}% of your balance.`,
  labios: "A video with out-of-sync lips is redone for free, always.",
  boton: `${GARANTIA_DIAS}-day guarantee. Cancel anytime.`,
  contacto: "Write to hola@creadsia.com.",
} as const;
