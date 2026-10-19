import type { Metadata } from "next";
import { checkRequest } from "@/lib/oauth";
import Conectar from "./conectar";

export const metadata: Metadata = { title: "Conectar una aplicación" };
export const dynamic = "force-dynamic";

// OAuth sign-in screen of the Creads connector (Claude, ChatGPT…). The app layout already asks to sign in.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const p = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) as Record<string, string | undefined>;
  const ok = checkRequest(p);
  if (typeof ok === "string") {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-3 py-10">
        <h1 className="text-2xl font-extrabold">No se pudo conectar</h1>
        <p className="text-muted">{ok}</p>
      </div>
    );
  }
  return (
    <Conectar
      app={ok.client.name}
      host={new URL(p.redirect_uri!).host}
      req={{ client_id: p.client_id!, redirect_uri: p.redirect_uri!, response_type: "code", code_challenge: p.code_challenge!, code_challenge_method: "S256", state: p.state ?? "" }}
    />
  );
}
