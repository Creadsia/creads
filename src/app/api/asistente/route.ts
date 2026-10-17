import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { hasFullStudio, isOwner } from "@/lib/auth";
import { ordersOf } from "@/lib/billing";
import { PLANS } from "@/lib/catalog";
import { creditStatus, history } from "@/lib/credits";
import { tooMany } from "@/lib/rate";
import { textAI } from "@/lib/providers";
import { parseJSON } from "@/lib/providers/claude";
import { quietCustomerText } from "@/lib/public-error";
import { findTool } from "@/lib/tools";
import { type AccountView, ASSISTANT_SYSTEM, assistantPrompt, cleanTurns, tidyAssistant } from "@/lib/assistant";
import { logChat } from "@/lib/support";

export const maxDuration = 60;

// POST {messages:[{role,content}], page?} → the assistant's next reply. Works for every signed-in
// account (also without a plan: "how do I pay?" is a support question). Each message is a paid AI call,
// so it's limited per person; the answer only links to known pages and never names vendors.

const STATUS: Record<string, string> = { done: "finished", failed: "FAILED (credits refunded automatically)", running: "in progress", pending: "queued", stuck: "unknown" };

function jobLabel(kind: string | null, adId: unknown) {
  if (adId) return "Scene of an ad (Crear anuncio)";
  if (kind === "gen:video") return "Video IA (Video e imagen IA)";
  if (kind === "gen:image") return "Imagen IA (Video e imagen IA)";
  if (kind?.startsWith("tool:")) return `Tool «${findTool(kind.slice(5))?.name ?? kind.slice(5)}» (Herramientas IA)`;
  if (kind === "voice") return "Voice";
  return kind || "Job";
}
const short = (iso: string) => String(iso).slice(0, 16).replace("T", " ");

async function accountOf(s: NonNullable<Awaited<ReturnType<typeof session>>>): Promise<AccountView> {
  const ws = s.user.workspace;
  const [st, jobs, moves, orders] = await Promise.all([
    creditStatus(ws).catch(() => null),
    s.db.list("clips", "order=created_at.desc&limit=10").catch(() => [] as Record<string, unknown>[]),
    history(ws, 12).catch(() => []),
    isOwner(s.user) ? Promise.resolve([]) : ordersOf(ws).catch(() => []),
  ]);
  const sub = orders.find((o) => o.status === "pagado" && o.mp?.kind === "subscription" && !o.mp.cancelled);
  const planName = st?.plan ? PLANS.find((p) => p.id === String(st.plan).toLowerCase())?.name ?? String(st.plan) : null;
  return {
    name: s.user.name,
    plan: planName,
    unlimited: Boolean(st?.unlimited),
    balance: st?.balance ?? null,
    paidUntil: st?.paidUntil ?? null,
    expired: Boolean(st?.expired),
    renews: st?.plan ? Boolean(sub) : null,
    adsOnly: !hasFullStudio(s.user),
    jobs: (jobs as Record<string, unknown>[]).map((j) => ({
      what: jobLabel(j.kind as string | null, j.ad_id),
      status: STATUS[String(j.status)] ?? String(j.status),
      when: short(String(j.created_at)),
      error: j.status === "failed" ? quietCustomerText(j.error as string | null) || undefined : undefined,
    })),
    moves: moves.map((m) => ({ credits: m.delta, kind: m.kind, note: (m.note ?? "").slice(0, 80), when: short(m.created_at) })),
  };
}

export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = (await tooMany("assist", s.user.id)) ?? (await tooMany("assistDay", s.user.id));
  if (limited) return limited;
  if (!textAI.configured()) return NextResponse.json({ error: "El asistente no está disponible en este momento. Revisa el Centro de ayuda o escribe a hola@creadsia.com." }, { status: 503 });

  const b = await req.json().catch(() => null);
  const turns = cleanTurns(b?.messages);
  if (!turns.length) return NextResponse.json({ error: "Escribe tu pregunta." }, { status: 400 });
  const page = typeof b?.page === "string" && /^\/[\w/-]{0,60}$/.test(b.page) ? b.page : undefined;

  try {
    const account = await accountOf(s);
    const raw = await textAI.complete({ system: ASSISTANT_SYSTEM, prompt: assistantPrompt(account, turns, page), json: true, maxTokens: 900 });
    const out = tidyAssistant(parseJSON<Record<string, unknown>>(raw));
    if (!out.answer) throw new Error("empty answer");
    await logChat({ ws: s.user.workspace, topic: out.topic, solved: out.solved, q: turns[turns.length - 1].content });
    return NextResponse.json(out);
  } catch (err) {
    console.error("asistente", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "No pude responder ahora. Vuelve a intentarlo en un momento, o revisa el Centro de ayuda." }, { status: 502 });
  }
}
