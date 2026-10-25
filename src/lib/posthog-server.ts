import { createHash } from "node:crypto";

// PostHog from the server (owner's plan P0, 25 Oct 2026): the funnel events that matter most are sent from
// here, tied to the account id (the same id the browser uses in posthog.identify), so they count even when
// the browser blocks scripts. A dedupe key becomes a fixed event uuid, so a retried payment notification
// is counted once (the same key as Meta's Purchase eventID). Never throws: measurement never breaks a step.

export type FunnelEvent =
  | "signup" | "brand_created" | "angles_generated" | "batch_started" | "batch_ready"
  | "zip_downloaded" | "paywall_view" | "checkout_start" | "purchase";

const HOST = "https://us.i.posthog.com";

/** A stable UUID (v4 layout) from any text, so the same dedupe key always gives the same event. */
export function uuidDe(key: string) {
  const h = createHash("sha256").update(key).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function cuerpoEvento(o: { distinctId: string; event: FunnelEvent; props?: Record<string, unknown>; dedupe?: string; key: string; now?: Date }) {
  return {
    api_key: o.key,
    event: o.event,
    distinct_id: o.distinctId,
    timestamp: (o.now ?? new Date()).toISOString(),
    ...(o.dedupe ? { uuid: uuidDe(o.dedupe) } : {}),
    properties: { ...o.props, $lib: "creads-server", entorno: process.env.VERCEL_ENV ?? "development" },
  };
}

export async function phCapture(distinctId: string, event: FunnelEvent, props: Record<string, unknown> = {}, dedupe?: string) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
  if (!key || !distinctId) return;
  try {
    await fetch(`${HOST}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpoEvento({ distinctId, event, props, dedupe, key })),
      signal: AbortSignal.timeout(3000),
    });
  } catch (e) {
    console.warn("posthog", event, e instanceof Error ? e.message : e);
  }
}
