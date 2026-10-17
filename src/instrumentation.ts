// Next.js calls this when a server route or page crashes: it goes to Creads' error log (and the
// owner gets an alarm the first time a new kind of crash shows up).
export async function onRequestError(err: unknown, request: { path: string; method: string }) {
  // written as an `if` block (not an early return) so the edge bundle drops the Node-only import
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logError } = await import("./lib/errlog");
    const e = err as { message?: string; digest?: string };
    await logError({ area: "servidor", message: `${request.method} ${e?.message ?? String(err)}`, path: String(request.path ?? "").split("?")[0], ref: e?.digest });
  }
}
