import { NextResponse } from "next/server";
import { canManageTeam, type User } from "./auth";
import { DbError } from "./db";

// Helpers shared by the /api/data routes.

export const failJson = (err: unknown) =>
  err instanceof DbError
    ? NextResponse.json({ error: err.message, missingTable: err.missingTable }, { status: err.missingTable ? 503 : err.status === 400 ? 400 : 502 })
    : NextResponse.json({ error: err instanceof Error ? err.message : "Error inesperado." }, { status: 500 });

/** Learned rules are shared by every customer: only Creadsia's team (workspace "main") edits them. */
export const canEditRules = (u: User) => u.workspace === "main" && canManageTeam(u);
