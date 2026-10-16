import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";
import { createCore, type Core } from "@/core";

const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

/** A core over a fresh temporary SQLite file with a fixed clock (Friday 2026-10-16, 09:00 local). */
export function tempCore(now = new Date(2026, 9, 16, 9, 0, 0)): Core {
  const dir = mkdtempSync(join(tmpdir(), "aitodo-web-"));
  const core = createCore({
    dbPath: join(dir, "todo.db"),
    clock: { now: () => now },
    prStatus: { getState: async () => "open" },
  });
  cleanups.push(() => {
    core.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return core;
}

export function form(fields: Record<string, string | number>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, String(v));
  return fd;
}
