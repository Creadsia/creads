// Keeps an Automático conversation in a shape Claude accepts (shared by the route and its tests).

type Block = Record<string, unknown> & { type: string };
export type Msg = { role: "user" | "assistant"; content: string | Block[] };

/**
 * A conversation Claude accepts: a tool call is answered by the very next message, and an answer always has its
 * call. A turn cut halfway (a reply that ran out of room mid tool call, an error) used to leave a call without
 * its answer, and then every next message failed (Benjamín, 22 Oct 2026). Unanswered calls and orphan answers
 * are dropped; a message left empty goes away.
 */
export function repair(input: Msg[]): Msg[] {
  const list = merge(input);
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
    // answers go first in their message, as Claude requires
    if (m.role === "user") blocks = [...blocks.filter((x) => x.type === "tool_result"), ...blocks.filter((x) => x.type !== "tool_result")];
    if (blocks.length) out.push({ role: m.role, content: blocks });
  }
  // dropping things can leave two messages of the same side together, or a call whose answer went away: once more
  const again = merge(out);
  return again.length === out.length ? again : repair(again);
}

const asBlocks = (c: Msg["content"]): Block[] => (typeof c === "string" ? (c.trim() ? [{ type: "text", text: c }] : []) : c);

/** Two messages in a row from the same side become one (a call and its answer must be in neighbouring messages). */
function merge(list: Msg[]): Msg[] {
  const out: Msg[] = [];
  for (const m of list) {
    const prev = out[out.length - 1];
    if (prev && prev.role === m.role) out[out.length - 1] = { role: m.role, content: [...asBlocks(prev.content), ...asBlocks(m.content)] };
    else out.push(m);
  }
  return out;
}

/**
 * Last resort when Claude still refuses the conversation: every tool call and answer becomes plain text, so
 * nothing can be unpaired. The assistant keeps the whole story (what it ordered, the ad ids), just as notes.
 */
export function flatten(list: Msg[]): Msg[] {
  const plain = list.map((m) => ({
    role: m.role,
    content: asBlocks(m.content).map((x) => {
      if (x.type === "tool_use") return { type: "text", text: `(Usé ${String(x.name)} con ${JSON.stringify(x.input ?? {}).slice(0, 600)})` };
      if (x.type === "tool_result") return { type: "text", text: `(Resultado${x.is_error ? " con error" : ""}: ${String(typeof x.content === "string" ? x.content : JSON.stringify(x.content)).slice(0, 1500)})` };
      return x;
    }).filter((x) => x.type === "text" && String(x.text ?? "").trim()),
  })).filter((m) => m.content.length) as Msg[];
  const out = merge(plain);
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

