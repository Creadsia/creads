"use client";

import { capture } from "./posthog";

// PostHog events of the free tools, with where the visitor came from: the UTM of this visit and the
// first-touch channel and campaign that visit-beacon.tsx keeps (creads_src / creads_camp cookies, only with
// consent). The same cookies travel with the sign-up and the lead, so the account keeps its source.

export type EventoHerramienta = "tool_hooks_used" | "tool_hooks_signup_click" | "tool_template_lead";

export function origen(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const q = new URLSearchParams(window.location.search);
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      const v = (q.get(k) || "").trim().slice(0, 80);
      if (v) out[k] = v;
    }
    const c = Object.fromEntries(document.cookie.split(/;\s*/).map((x) => { const i = x.indexOf("="); return [x.slice(0, i), x.slice(i + 1)]; }));
    if (c.creads_src) out.fuente = decodeURIComponent(c.creads_src).slice(0, 40);
    if (c.creads_camp) out.campana = decodeURIComponent(c.creads_camp).slice(0, 80);
  } catch { /* measurement never breaks the page */ }
  return out;
}

export const evento = (e: EventoHerramienta, props: Record<string, unknown> = {}) => capture(e, { ...origen(), ...props });
