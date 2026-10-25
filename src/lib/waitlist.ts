// Sign-ups and leads from the public site, table `waitlist` (supabase/schema.sql), read in Panel → Registros.
// Uses the REST endpoint with the service-role key, which stays on the server. One row per email (a repeat
// is ignored, never an error).

export interface FilaLista { email: string; niche: string; ads_per_month: string; plan?: string; lang?: string }

export type GuardarLista = { ok: true } | { ok: false; status: number; detail: string };

export async function guardarEnLista(row: FilaLista): Promise<GuardarLista> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, status: 503, detail: "not configured" };
  const insert = (r: object) =>
    fetch(`${url}/rest/v1/waitlist`, {
      method: "POST",
      headers: {
        apikey: key,
        // Legacy service_role keys are JWTs and also go in Authorization; new sb_secret_ keys only need apikey.
        ...(key.startsWith("eyJ") ? { authorization: `Bearer ${key}` } : {}),
        "content-type": "application/json",
        prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(r),
    });
  const { plan, lang, ...base } = row;
  let res = await insert({ ...base, plan: plan ?? "", lang: lang ?? "" });
  // If the plan/lang columns haven't been added yet (schema.sql), save the sign-up without them.
  if (res.status === 400) res = await insert(base);
  if (!res.ok && res.status !== 409) return { ok: false, status: res.status, detail: (await res.text().catch(() => "")).slice(0, 500) };
  return { ok: true };
}

/** Where a free-tool lead came from (first-touch channel and campaign, only with cookie consent), for the niche column. */
export function origenLead(herramienta: string, v: { src?: string; camp?: string }) {
  return [herramienta, v.src ? `fuente ${v.src}` : "", v.camp ? `campaña ${v.camp}` : ""].filter(Boolean).join(" · ").slice(0, 80);
}
