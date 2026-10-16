import { execFile } from "node:child_process";
import { promisify } from "node:util";

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export type PrState = "open" | "merged" | "closed";

/** Answers "is this PR open, merged or closed?". Production uses the gh CLI; tests use a fake. */
export interface PrStatusAdapter {
  getState(url: string): Promise<PrState>;
}

const execFileAsync = promisify(execFile);

export const ghPrStatus: PrStatusAdapter = {
  async getState(url) {
    let stdout: string;
    try {
      ({ stdout } = await execFileAsync("gh", ["pr", "view", url, "--json", "state"]));
    } catch (e) {
      // Surface gh's own explanation ("not logged in", "Could not resolve…") rather than the exec wrapper.
      const stderr = (e as { stderr?: string }).stderr?.trim();
      throw new Error(stderr || (e instanceof Error ? e.message : String(e)));
    }
    const state = String(JSON.parse(stdout).state).toUpperCase();
    if (state === "MERGED") return "merged";
    if (state === "CLOSED") return "closed";
    return "open";
  },
};
