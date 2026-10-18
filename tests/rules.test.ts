// Who may use what: media links, browser writes, voices, roles and access levels.
// Run: npx tsx --test tests/rules.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
process.env.SUPABASE_URL = "https://proj.supabase.co";

import { canEditRules, allowedWrite, canRead, canRemove } from "../src/lib/data-api";
import { ownsMedia, pathOf, workspaceOf } from "../src/lib/media";
import { allowed } from "../src/lib/voices";
import { canManageTeam, hasFullStudio, isOwner, isTheOwner, type User } from "../src/lib/auth";

const A = "/api/media/ws/cliente-a/uploads/images/1.png";
const legacy = "https://proj.supabase.co/storage/v1/object/public/media/uploads/images/x.png";

test("a media link opens only for its own workspace", () => {
  assert.equal(workspaceOf(A), "cliente-a");
  assert.equal(ownsMedia(A, "cliente-a"), true);
  assert.equal(ownsMedia(A, "cliente-b"), false);
  assert.equal(ownsMedia(A, "main"), false);
});

test("tricks in media links are refused", () => {
  for (const bad of [
    "/api/media/ws/cliente-a/../cliente-b/x.png",
    "/api/media/ws/cliente-a/%2e%2e/x.png",
    "/api/media/ws/Cliente A/x.png",
    "/api/media/ws/cliente-a",
    "/api/media/other/cliente-a/x.png",
    "https://evil.com/api/media/ws/cliente-a/x.png",
    "/api/media/ws/cliente-a/x.png\n",
  ]) {
    assert.equal(ownsMedia(bad, "cliente-a"), false, bad);
  }
  assert.equal(pathOf("/api/media/ws/cliente-a/a/../b.png"), null);
});

test("old public links belong to Creadsia only", () => {
  assert.equal(ownsMedia(legacy, "main"), true);
  assert.equal(ownsMedia(legacy, "cliente-a"), false);
  assert.equal(ownsMedia(legacy.replace("/media/", "/media/../admin/"), "main"), false);
  assert.equal(ownsMedia("https://proj.supabase.co/storage/v1/object/public/admin/finanzas.json", "main"), false);
  assert.equal(ownsMedia("https://otro.supabase.co/storage/v1/object/public/media/x.png", "main"), false);
  // WinnerLab files on Creadsia's Higgsfield account
  const hf = "https://d8j0ntlcm91z4.cloudfront.net/user_3DdKYHg29Dc6YLtguhB32IBiQZ7/hf_20261012_152120_576bec66.mp4";
  assert.equal(ownsMedia(hf, "main"), true);
  assert.equal(ownsMedia(hf, "cliente-a"), false);
  assert.equal(ownsMedia("https://d8j0ntlcm91z4.cloudfront.net/user_OTRO/x.mp4", "main"), false);
  assert.equal(ownsMedia("https://d8j0ntlcm91z4.cloudfront.net/user_3DdKYHg29Dc6YLtguhB32IBiQZ7/a/../b.mp4", "main"), false);
});

test("the browser can only write what it should", () => {
  // clips, images, voices and rules are written by the server only
  for (const t of ["clips", "images", "voices", "rules", "users", "workspaces"]) assert.equal(typeof allowedWrite(t, { x: 1 }, "cliente-a"), "string", t);
  // owner/id/status columns are dropped
  const w = allowedWrite("ads", { title: "t", owner: "cliente-b", status: "done", final_url: "x", id: "y" }, "cliente-a");
  assert.notEqual(typeof w, "string");
  if (typeof w !== "string") assert.deepEqual(Object.keys(w.data), ["title"]);
  // another customer's photo is refused; own photo accepted; clearing is allowed
  assert.equal(typeof allowedWrite("avatars", { name: "x", image_url: "/api/media/ws/cliente-b/u/1.png" }, "cliente-a"), "string");
  assert.equal(typeof allowedWrite("avatars", { name: "x", image_url: "https://evil.com/x.png" }, "cliente-a"), "string");
  assert.notEqual(typeof allowedWrite("avatars", { name: "x", image_url: A }, "cliente-a"), "string");
  assert.notEqual(typeof allowedWrite("avatars", { name: "x", image_url: "" }, "cliente-a"), "string");
  assert.equal(canRead("voices"), false);
  assert.equal(canRead("users"), false);
  assert.equal(canRemove("clips"), false);
});

test("cloned voices are private to their customer", () => {
  const reg = new Map([["cloneofA00000", "cliente-a"]]);
  const cloneA = { id: "cloneofA00000", name: "A", category: "cloned" };
  const legacyClone = { id: "oldclone00000", name: "old", category: "cloned" };
  const library = { id: "library000000", name: "Lib", category: "premade" };
  assert.equal(allowed(cloneA, "cliente-a", reg), true);
  assert.equal(allowed(cloneA, "cliente-b", reg), false);
  assert.equal(allowed(cloneA, "main", reg), false);
  assert.equal(allowed(legacyClone, "main", reg), true);
  assert.equal(allowed(legacyClone, "cliente-b", reg), false);
  assert.equal(allowed(library, "cliente-b", reg), true);
});

const user = (p: Partial<User>): User => ({ id: "1", email: "x@y.z", name: null, role: "member", workspace: "main", active: true, created_at: "", last_login: null, ...p });

test("only Creadsia's owner and his partners manage access, finances and shared rules", () => {
  assert.equal(isOwner(user({ role: "owner", workspace: "main" })), true);
  // an "owner" or "admin" role anywhere else is not the platform owner
  assert.equal(isOwner(user({ role: "owner", workspace: "cliente-a" })), false);
  assert.equal(isOwner(user({ role: "admin", workspace: "cliente-a" })), false);
  assert.equal(isOwner(user({ role: "member", workspace: "main" })), false);
  // a partner ("socio" = admin of the owner's team) has full access, but is not THE owner
  assert.equal(isOwner(user({ role: "admin", workspace: "main" })), true);
  assert.equal(isTheOwner(user({ role: "admin", workspace: "main" })), false);
  assert.equal(isTheOwner(user({ role: "owner", workspace: "main" })), true);
  assert.equal(canManageTeam(user({ role: "admin", workspace: "cliente-a" })), false);
  assert.equal(canEditRules(user({ role: "member", workspace: "cliente-a" })), false);
  assert.equal(canManageTeam(null), false);
});

test("'solo anuncios' accounts don't get the full studio", () => {
  assert.equal(hasFullStudio(user({ access: "ads", workspace: "cliente-a" })), false);
  assert.equal(hasFullStudio(user({ access: "full", workspace: "cliente-a" })), true);
  assert.equal(hasFullStudio(null), false);
});
