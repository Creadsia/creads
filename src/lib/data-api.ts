import { NextResponse } from "next/server";
import { isOwner, type User } from "./auth";
import { DbError, type TenantTable } from "./db";
import { publicError } from "./public-error";
import { ownsMedia } from "./media";

// Rules for the /api/data routes: what a customer may read and change from the browser.
// Everything else (clips, generated images, cloned voices…) is written only by the server.

export const failJson = (err: unknown) =>
  err instanceof DbError
    ? NextResponse.json({ error: publicError(err, err.status === 400 ? "No se pudo guardar: revisa los datos." : "No se pudo guardar."), missingTable: err.missingTable }, { status: err.missingTable ? 503 : err.status === 400 ? 400 : 502 })
    : NextResponse.json({ error: publicError(err, "No se pudo completar.") }, { status: 500 });

/** Learned rules are shared by every customer: only Creadsia's owner edits them. */
export const canEditRules = (u: User) => isOwner(u);

const READ: TenantTable[] = ["avatars", "products", "scripts", "ads", "clips", "images"];
/** Columns the browser may write, per table (absent = read-only from the browser). */
const WRITE: Partial<Record<TenantTable, string[]>> = {
  avatars: ["name", "description", "image_url", "voice_id", "voice_name", "lang", "consent", "notes"],
  products: ["name", "description", "image_url", "notes"],
  scripts: ["title", "lang", "format", "text", "cuts", "favorite", "notes"],
  // settings drive what the server generates and charges: the browser may only change the niche
  ads: ["title", "favorite", "niche"],
};
const REMOVE: TenantTable[] = ["avatars", "products", "scripts", "ads", "images"];

export const canRead = (t: string): t is TenantTable => (READ as string[]).includes(t);
export const canRemove = (t: string): t is TenantTable => (REMOVE as string[]).includes(t);

/**
 * The part of a browser write that is allowed, or an error message. Photos must be the customer's
 * own files (a link to another customer's file is refused).
 */
export function allowedWrite(t: string, body: Record<string, unknown>, ws: string): { table: TenantTable; data: Record<string, unknown> } | string {
  const cols = WRITE[t as TenantTable];
  if (!cols) return "Esa información no se puede cambiar desde aquí.";
  const data = Object.fromEntries(Object.entries(body).filter(([k]) => cols.includes(k)));
  if ("image_url" in data && data.image_url != null && data.image_url !== "" && !ownsMedia(data.image_url, ws)) return "Esa foto no es de tu cuenta. Súbela de nuevo.";
  return { table: t as TenantTable, data };
}
