import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

// An in-memory Postgres with Creads' real schema and the tenancy rules applied, for isolation tests.
export async function testDatabase() {
  const db = new PGlite();
  const root = path.join(__dirname, "..", "supabase");
  const schema = readFileSync(path.join(root, "schema.sql"), "utf8");
  const tenancy = readFileSync(path.join(root, "tenancy.sql"), "utf8").replace("PEGA-AQUI-TU-CLAVE-LARGA", "test-password-0123456789-abcdef");
  await db.exec("create role service_role; create role anon; create role authenticated;");
  await db.exec(schema.replace(/create extension if not exists pgcrypto;/i, ""));
  await db.exec(tenancy);
  return db;
}
