import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";
import { createCore, type Core } from "@/core";
import type { PrState, PrStatusAdapter } from "@/core";

export class FakeClock {
  constructor(private current: Date) {}
  now() {
    return new Date(this.current);
  }
  set(iso: string) {
    this.current = new Date(iso);
  }
  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  }
  advanceHours(h: number) {
    this.advance(h * 60 * 60 * 1000);
  }
  advanceDays(d: number) {
    this.advance(d * 24 * 60 * 60 * 1000);
  }
}

export class FakePrStatus implements PrStatusAdapter {
  states = new Map<string, PrState | Error>();
  async getState(url: string): Promise<PrState> {
    const s = this.states.get(url) ?? "open";
    if (s instanceof Error) throw s;
    return s;
  }
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

export interface TestEnv {
  core: Core;
  clock: FakeClock;
  prs: FakePrStatus;
  dbPath: string;
}

/** A core over a real SQLite file in a temp dir, with a fake clock and PR adapter. */
export function setup(now = "2026-10-14T09:00:00"): TestEnv {
  const dir = mkdtempSync(join(tmpdir(), "ai-todo-test-"));
  const dbPath = join(dir, "todo.db");
  const clock = new FakeClock(new Date(now));
  const prs = new FakePrStatus();
  const core = createCore({ dbPath, clock, prStatus: prs });
  cleanups.push(() => {
    core.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { core, clock, prs, dbPath };
}

export function expectTodoError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (e) {
    const err = e as { code?: string };
    if (err.code !== code) throw new Error(`Expected TodoError ${code}, got ${err.code ?? e}`);
    return e as { code: string; message: string; details: unknown };
  }
  throw new Error(`Expected TodoError ${code}, but nothing was thrown`);
}
