import { randomBytes } from "node:crypto";
import { sbRest } from "./supabase";
import { WORKSPACE_RE } from "./db";

// Self-serve accounts: a visitor who picks a plan on the website gets their own customer workspace
// (full studio, no credits until they pay) and becomes its first member.

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

/** Creates a customer workspace named after the person or company and returns its id. */
export async function createClientWorkspace(name: string): Promise<string> {
  let id = slug(name);
  if (id.length < 3 || !WORKSPACE_RE.test(id) || id === "main") id = "cliente";
  // a random tail so names never collide and ids can't be guessed from a company name
  id = `${id}-${randomBytes(3).toString("hex")}`;
  await sbRest("workspaces", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ id, name: name.slice(0, 80), kind: "client", plan: null, access: "full", discount: 0, notes: "Se registró solo desde la web" }),
  });
  return id;
}

export const removeWorkspace = (id: string) =>
  sbRest(`workspaces?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { prefer: "return=minimal" } }).catch(() => null);

export const emailOk = (e: string) => /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/.test(e) && e.length <= 200;
