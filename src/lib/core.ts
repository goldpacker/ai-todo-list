import "server-only";
import { connection } from "next/server";
import { createCore, defaultDbPath, type Core } from "@/core";

// One core per process (and per database path), kept on globalThis so dev-mode HMR reloads reuse the
// same SQLite connection instead of leaking a new one on every edit.
const globalForCore = globalThis as typeof globalThis & { __aiTodoCore?: { path: string; core: Core } };

/** The shared core for mutations (Server Actions). Honors `AI_TODO_DB`. */
export function getCore(): Core {
  const path = defaultDbPath();
  const cached = globalForCore.__aiTodoCore;
  if (cached && cached.path === path) return cached.core;
  cached?.core.close();
  const core = createCore({ dbPath: path });
  globalForCore.__aiTodoCore = { path, core };
  return core;
}

/**
 * The core for reads in Server Components. The database changes underneath the app (agents write
 * through the CLI), and better-sqlite3 is synchronous, so we wait for a real request before reading:
 * nothing from SQLite is ever baked into the prerendered shell or prefetched ahead of a navigation.
 */
export async function readCore(): Promise<Core> {
  await connection();
  return getCore();
}
