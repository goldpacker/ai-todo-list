import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { migrate } from "./migrations";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

/** `AI_TODO_DB` overrides the default location; tests rely on it. */
export function defaultDbPath(): string {
  return process.env.AI_TODO_DB || join(homedir(), ".ai-todo", "todo.db");
}

/** Opens (creating and migrating if needed) the shared SQLite store. */
export function openDb(path: string = defaultDbPath()): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  migrate(sqlite);
  return drizzle(sqlite, { schema }) as Db;
}
