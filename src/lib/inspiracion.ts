import { randomUUID } from "node:crypto";
import { readPrivateJSON, writePrivateJSON } from "./supabase";

// "Inspiración": example videos Creadsia publishes so customers can recreate them with their own
// characters and products (like a gallery of winning ads, each with a "Recrear" button).
// The list lives in the private bucket; the videos stay in Creadsia's workspace and are copied into
// the customer's own folder only when they press "Recrear".

export type RecreateMode = "editar-video" | "copiar-movimiento";

export interface Example {
  id: string;
  title: string;
  /** Media link in the owner's workspace. */
  video: string;
  /** Seconds, measured when it was added. */
  secs: number;
  /** Suggested instruction, filled in for the customer. */
  prompt: string;
  /** Tool it opens with. */
  mode: RecreateMode;
  /** Short label shown on the card (niche or format), e.g. "Seguros · UGC". */
  tag: string;
  created_at: string;
}

const FILE = "inspiracion.json";
export const MODES: RecreateMode[] = ["editar-video", "copiar-movimiento"];

export async function listExamples(): Promise<Example[]> {
  const list = await readPrivateJSON<Example[]>(FILE);
  return Array.isArray(list) ? list : [];
}

export async function addExample(e: Omit<Example, "id" | "created_at">) {
  const list = await listExamples();
  const row: Example = { ...e, id: randomUUID().slice(0, 12), created_at: new Date().toISOString() };
  await writePrivateJSON(FILE, [row, ...list].slice(0, 200));
  return row;
}

export async function removeExample(id: string) {
  const list = await listExamples();
  await writePrivateJSON(FILE, list.filter((x) => x.id !== id));
}

/** Clamp what the owner typed (the gallery is shown to every customer). */
export function cleanExample(b: Record<string, unknown>) {
  const s = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const mode = MODES.includes(b.mode as RecreateMode) ? (b.mode as RecreateMode) : "editar-video";
  return { title: s(b.title, 80), prompt: s(b.prompt, 600), tag: s(b.tag, 40), mode };
}
