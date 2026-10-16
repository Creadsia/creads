import { type User, userFromRequest } from "./auth";
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
