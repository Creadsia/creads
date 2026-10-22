import { readPrivateJSON, updatePrivateJSON } from "./supabase";

// What the in-app assistant handled, one small file per day in the private bucket
// (soporte/<YYYY-MM-DD>.json): the topic, whether it was solved, and the question (shortened).
// The owner sees the totals in the morning report, and the questions it couldn't answer
// become fixes to the help center or the product.

export interface ChatLog { at: string; ws: string; topic: string; solved: boolean; q: string }

const file = (day: string) => `soporte/${day}.json`;
const today = () => new Date().toISOString().slice(0, 10);

/** Best effort: a lost log line never breaks the chat. */
export async function logChat(entry: Omit<ChatLog, "at">) {
  try {
    const day = today();
    await updatePrivateJSON<ChatLog[]>(file(day), (cur) => {
      const list = cur ?? [];
      if (list.length >= 3000) return undefined;
      list.push({ ...entry, q: entry.q.slice(0, 240), at: new Date().toISOString() });
      return list;
    });
  } catch (err) {
    console.error("support log", err instanceof Error ? err.message : err);
  }
}

export interface SupportSummary { chats: number; people: number; solved: number; topics: [string, number][]; unsolved: string[] }

export function summarize(list: ChatLog[]): SupportSummary {
  const topics = new Map<string, number>();
  for (const c of list) topics.set(c.topic, (topics.get(c.topic) ?? 0) + 1);
  const unsolved = [...new Set(list.filter((c) => !c.solved).map((c) => c.q.trim()).filter(Boolean))];
  return {
    chats: list.length,
    people: new Set(list.map((c) => c.ws)).size,
    solved: list.filter((c) => c.solved).length,
    topics: [...topics.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    unsolved: unsolved.slice(0, 8),
  };
}

export async function supportDay(day: string): Promise<SupportSummary> {
  const list = (await readPrivateJSON<ChatLog[]>(file(day)).catch(() => null)) ?? [];
  return summarize(Array.isArray(list) ? list : []);
}
