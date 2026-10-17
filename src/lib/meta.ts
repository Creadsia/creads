import { createHash, randomUUID } from "node:crypto";

// Meta Conversions API: the same events as the browser pixel, sent from our server, so they count even
// with ad blockers, and so a payment confirmed by hand (no browser involved) still reaches Meta.
// Needs META_CAPI_TOKEN in Vercel; without it nothing is sent. Events carry the same event_id as the
// browser pixel, so Meta counts each one once. Only sent for people who accepted cookies.

export const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "2078637222831496";
const API = "https://graph.facebook.com/v21.0";

const sha = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

/** What we know about the visitor from the request (consent, Meta cookies, IP, browser). */
export interface Visitor { consent: boolean; fbp?: string; fbc?: string; ip?: string; ua?: string; url?: string; src?: string }

export function visitorFrom(req: Request): Visitor {
  const cookies = Object.fromEntries((req.headers.get("cookie") ?? "").split(/;\s*/).map((c) => {
    const i = c.indexOf("=");
    return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
  }));
  return {
    consent: cookies.creads_consent === "1",
    fbp: cookies._fbp,
    fbc: cookies._fbc,
    ip: (req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "").trim() || undefined,
    // the channel the person first came from (instagram, google…), for "Ventas por fuente"
    src: cookies.creads_consent === "1" && /^[a-z0-9._-]{2,40}$/.test(cookies.creads_src ?? "") ? cookies.creads_src : undefined,
    ua: req.headers.get("user-agent") ?? undefined,
    url: req.headers.get("referer") ?? undefined,
  };
}

export interface MetaEvent {
  name: "Lead" | "CompleteRegistration" | "InitiateCheckout" | "Purchase" | "Subscribe";
  eventId?: string;
  email?: string;
  value?: number;
  currency?: string;
  content?: string;
  source?: "website" | "system_generated";
}

/** Sends one event. Never throws (measurement must not break the product). */
export async function sendMeta(ev: MetaEvent, v: Visitor) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token || !v.consent) return false;
  const event_id = ev.eventId && /^[\w.:-]{6,80}$/.test(ev.eventId) ? ev.eventId : randomUUID();
  const body = {
    data: [{
      event_name: ev.name,
      event_time: Math.floor(Date.now() / 1000),
      event_id,
      action_source: ev.source ?? "website",
      ...(v.url ? { event_source_url: v.url } : {}),
      user_data: {
        ...(ev.email ? { em: [sha(ev.email)] } : {}),
        ...(v.ip ? { client_ip_address: v.ip } : {}),
        ...(v.ua ? { client_user_agent: v.ua } : {}),
        ...(v.fbp ? { fbp: v.fbp } : {}),
        ...(v.fbc ? { fbc: v.fbc } : {}),
      },
      custom_data: {
        ...(ev.value !== undefined ? { value: +ev.value.toFixed(2), currency: ev.currency ?? "USD" } : {}),
        ...(ev.content ? { content_name: ev.content } : {}),
      },
    }],
    ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
  };
  try {
    const res = await fetch(`${API}/${PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store",
    });
    if (!res.ok) console.error("meta capi", ev.name, res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (err) {
    console.error("meta capi", ev.name, err instanceof Error ? err.message : err);
    return false;
  }
}
