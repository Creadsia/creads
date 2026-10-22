// Keeps an Automático conversation in a shape Claude accepts (shared by the route and its tests).

type Block = Record<string, unknown> & { type: string };
export type Msg = { role: "user" | "assistant"; content: string | Block[] };

/**
 * A conversation Claude accepts: a tool call is answered by the very next message, and an answer always has its
 * call. A turn cut halfway (a reply that ran out of room mid tool call, an error) used to leave a call without
 * its answer, and then every next message failed (Benjamín, 22 Oct 2026). Unanswered calls and orphan answers
 * are dropped; a message left empty goes away.
 */
export function repair(list: Msg[]): Msg[] {
  const out: Msg[] = [];
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    if (typeof m.content === "string") { out.push(m); continue; }
    let blocks = m.content;
    if (m.role === "assistant") {
      const next = list[i + 1];
      const answered = new Set(next && next.role === "user" && Array.isArray(next.content) ? next.content.filter((x) => x.type === "tool_result").map((x) => String(x.tool_use_id)) : []);
      blocks = blocks.filter((x) => x.type !== "tool_use" || answered.has(String(x.id)));
    } else {
      const prev = out[out.length - 1];
      const asked = new Set(prev && prev.role === "assistant" && Array.isArray(prev.content) ? prev.content.filter((x) => x.type === "tool_use").map((x) => String(x.id)) : []);
      blocks = blocks.filter((x) => x.type !== "tool_result" || asked.has(String(x.tool_use_id)));
    }
    blocks = blocks.filter((x) => x.type !== "text" || String(x.text ?? "").trim());
    if (blocks.length) out.push({ role: m.role, content: blocks });
  }
  return out;
}

