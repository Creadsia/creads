// Clientes → Nuevas cuentas (owner, 22 Oct 2026: «saber qué pasa con los leads que llegan, qué hacen»): every
// new account with how far it got (signed up → opened the payment → paid → made something), where it came
// from and when it was last seen. Built from the database; the origin is saved at sign-up (only with consent).

import { readPrivateJSON, updatePrivateJSON } from "./supabase";

const ORIGINS = "leads/origen.json";
export type Origin = { src: string | null; camp: string | null; at?: string };

export async function saveOrigin(ws: string, o: Origin) {
  await updatePrivateJSON<Record<string, Origin>>(ORIGINS, (cur) => ({ ...(cur ?? {}), [ws]: { ...o, at: new Date().toISOString() } }));
}
export const origins = () => readPrivateJSON<Record<string, Origin>>(ORIGINS).catch(() => null).then((x) => x ?? {});

export type Etapa = "registro" | "pago-abierto" | "pago" | "creando" | "anuncio";
export const ETAPAS: Record<Etapa, string> = {
  registro: "Solo se registró",
  "pago-abierto": "Abrió el pago y no pagó",
  pago: "Pagó, aún no crea",
  creando: "Pagó y está creando",
  anuncio: "Ya tiene anuncios terminados",
};

/** How far one account got. */
export function etapaOf(x: { pagosAbiertos: number; pagado: boolean; generaciones: number; anunciosListos: number }): Etapa {
  if (x.anunciosListos > 0) return "anuncio";
  if (x.pagado) return x.generaciones > 0 ? "creando" : "pago";
  return x.pagosAbiertos > 0 ? "pago-abierto" : "registro";
}
