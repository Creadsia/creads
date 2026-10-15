// Temporary gate for the studio until real login exists (Phase 2):
// the caller must send the access code that is set in Vercel as CREADS_ACCESS_CODE.
export function checkAccess(req: Request): string | null {
  const expected = process.env.CREADS_ACCESS_CODE;
  if (!expected) return "Falta configurar CREADS_ACCESS_CODE en Vercel.";
  const given = req.headers.get("x-creads-code") ?? "";
  if (given !== expected) return "Código de acceso incorrecto.";
  return null;
}
