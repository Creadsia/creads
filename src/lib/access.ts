import { NextResponse } from "next/server";
import { type User, hasFullStudio, userFromRequest } from "./auth";
import { type Db, dbFor } from "./db";

export const SESSION_ENDED = "Tu sesión terminó. Vuelve a entrar.";

// Every studio API route checks that the request comes from a signed-in, active account.
// Returns an error message, or null when the request may proceed (for routes that don't touch customer data).
export async function checkAccess(req: Request): Promise<string | null> {
  const user = await userFromRequest(req);
  return user ? null : SESSION_ENDED;
}

/**
 * For routes that read or write customer data: the signed-in user and the database as seen by
 * their workspace (and only theirs). Null when there is no valid session.
 */
export async function session(req: Request): Promise<{ user: User; db: Db } | null> {
  const user = await userFromRequest(req);
  return user ? { user, db: dbFor(user.workspace) } : null;
}

export const ADS_ONLY = "Tu acceso es solo para crear anuncios. Pídele al dueño de Creads el acceso completo.";

/**
 * Like `session`, for the parts of the studio outside "Crear anuncio" (tools, free generation):
 * returns the session, or the response to send back (no session, or "solo anuncios" access).
 */
export async function fullSession(req: Request): Promise<{ user: User; db: Db } | NextResponse> {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  if (!hasFullStudio(s.user)) return NextResponse.json({ error: ADS_ONLY }, { status: 403 });
  return s;
}
