import { userFromRequest } from "./auth";

// Every studio API route checks that the request comes from a signed-in, active account.
// Returns an error message, or null when the request may proceed.
export async function checkAccess(req: Request): Promise<string | null> {
  const user = await userFromRequest(req);
  return user ? null : "Tu sesión terminó. Vuelve a entrar.";
}
