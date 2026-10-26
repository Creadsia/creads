// The guarantee, word for word (owner's plan, 25 Oct 2026): the same text on the cards, checkout, FAQ and
// Terms. Browser-safe. No amounts (owner, 25 Oct 2026: «te devolvemos tu pago», never a figure in pesos).

export const GARANTIA_DIAS = 7;
/** Share of the balance a customer may have used and still get the plan's first payment back. */
export const GARANTIA_USO_MAX = 0.2;

export const GARANTIA = {
  /** The 7-day free trial with card (since 26 Oct 2026): nothing is charged if cancelled before the first charge. */
  prueba: `Prueba gratis de ${GARANTIA_DIAS} días: si no te sirve, cancelas con un clic y no pagas nada.`,
  /** The Pack Prueba (only while it's on sale, MODO_PACK=1). */
  pack: `Garantía de tu primera tanda: si no te sirve para publicar, escríbenos dentro de ${GARANTIA_DIAS} días y te devolvemos tu pago.`,
  planes: `${GARANTIA_DIAS} días de garantía: si los anuncios no te sirven, te devolvemos el 100% de tu primer pago, aunque hayas usado hasta el ${Math.round(GARANTIA_USO_MAX * 100)}% de tu saldo.`,
  labios: "Un video con labios desincronizados se rehace gratis, siempre.",
  boton: `Garantía de ${GARANTIA_DIAS} días. Cancela cuando quieras.`,
  contacto: "Escríbenos a hola@creadsia.com.",
} as const;

export const GARANTIA_EN = {
  prueba: `${GARANTIA_DIAS}-day free trial: nothing is charged today and, if you cancel before the first charge, you pay nothing.`,
  pack: `First-batch guarantee: if it isn't good enough to publish, write to us within ${GARANTIA_DIAS} days and we refund your payment.`,
  planes: `${GARANTIA_DIAS}-day guarantee: if the ads don't work for you, we refund 100% of your first payment, even if you used up to ${Math.round(GARANTIA_USO_MAX * 100)}% of your balance.`,
  labios: "A video with out-of-sync lips is redone for free, always.",
  boton: `${GARANTIA_DIAS}-day guarantee. Cancel anytime.`,
  contacto: "Write to hola@creadsia.com.",
} as const;
