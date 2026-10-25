import { NextResponse } from "next/server";
import { getUserById } from "@/lib/auth";
import { CORS, readClient, redeemCode, SCOPE, TOKEN_DAYS, tokenFor } from "@/lib/oauth";
import { clientIp, tooMany } from "@/lib/rate";

export const dynamic = "force-dynamic";

const err = (error: string, error_description: string, status = 400) => NextResponse.json({ error, error_description }, { status, headers: { ...CORS, "cache-control": "no-store" } });

// The one-time code (with its PKCE secret) for an access token of the user's account.
export async function POST(req: Request) {
  const limited = await tooMany("oauthRegister", clientIp(req));
  if (limited) return err("slow_down", "Demasiados intentos. Intenta en una hora.", 429);
  const type = req.headers.get("content-type") ?? "";
  const raw = type.includes("application/json") ? ((await req.json().catch(() => null)) ?? {}) : Object.fromEntries(new URLSearchParams(await req.text().catch(() => "")));
  const p = raw as Record<string, string>;
  if (p.grant_type !== "authorization_code") return err("unsupported_grant_type", "Solo authorization_code.");
  const client = readClient(p.client_id);
  if (!client) return err("invalid_client", "Aplicación desconocida.", 401);
  const userId = await redeemCode({ code: String(p.code ?? ""), clientId: p.client_id, redirectUri: String(p.redirect_uri ?? ""), verifier: String(p.code_verifier ?? "") });
  if (!userId) return err("invalid_grant", "El código no sirve (vencido, usado o no coincide).");
  const user = await getUserById(userId).catch(() => null);
  if (!user?.active) return err("invalid_grant", "La cuenta no está activa.");
  const token = await tokenFor(userId, client);
  return NextResponse.json({ access_token: token, token_type: "Bearer", expires_in: TOKEN_DAYS * 86400, scope: SCOPE }, { headers: { ...CORS, "cache-control": "no-store", pragma: "no-cache" } });
}
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
