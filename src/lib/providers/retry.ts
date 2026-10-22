// The «fila» in front of every provider (owner, 22 Oct 2026: get ready for hundreds of customers at once).
// When a provider says «too many requests right now» (429), «overloaded» (529) or «busy» (503), the job
// waits its turn — a few seconds, growing, as long as the provider asks (Retry-After) — and tries again,
// instead of failing in front of the customer. These answers mean the provider did NOT take the job, so
// trying again can't charge twice. A dropped connection is only retried on reads (GET), never on a submit.

const RETRY = new Set([429, 503, 529]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RetryOptions { tries?: number; maxWaitMs?: number }

/** How long to wait before the next try: what the provider asked for, else 1.5 s, 3 s, 6 s, 12 s… (± 25%). */
export function backoff(attempt: number, retryAfter: string | null): number {
  const asked = retryAfter ? (isFinite(Number(retryAfter)) ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now())) : NaN;
  const base = isFinite(asked) && asked > 0 ? Math.min(asked, 30_000) : Math.min(12_000, 1500 * 2 ** (attempt - 1));
  return Math.round(base * (0.75 + Math.random() * 0.5));
}

export async function fetchRetry(input: string | URL, init: RequestInit = {}, o: RetryOptions = {}): Promise<Response> {
  const tries = o.tries ?? 6, maxWait = o.maxWaitMs ?? 45_000;
  const read = !init.method || init.method.toUpperCase() === "GET";
  const t0 = Date.now();
  for (let attempt = 1; ; attempt++) {
    let res: Response | null = null;
    let err: unknown = null;
    try { res = await fetch(input, init); } catch (e) { err = e; }
    const aborted = err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
    const again = res ? RETRY.has(res.status) : read && !aborted;
    const wait = backoff(attempt, res?.headers.get("retry-after") ?? null);
    if (!again || attempt >= tries || Date.now() - t0 + wait > maxWait) {
      if (res) return res;
      throw err;
    }
    await res?.body?.cancel().catch(() => {});
    await sleep(wait);
  }
}
