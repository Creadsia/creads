import { DEFAULT_FINANZAS, type Finanzas } from "./finance";
import { readPrivateJSON } from "./supabase";

/** The dollar rate the owner set in Finanzas (server only); prices in pesos are computed with it. */
export async function usdClpRate(): Promise<number> {
  const book = await readPrivateJSON<Finanzas>("finanzas.json").catch(() => null);
  return Number(book?.config?.usdClp) > 0 ? Number(book!.config.usdClp) : DEFAULT_FINANZAS.config.usdClp;
}
