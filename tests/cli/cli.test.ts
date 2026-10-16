import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { createCore } from "@/core";
import { type CliDeps, run } from "@/cli/program";

// Smoke tests: they confirm the CLI wiring (args → core → output), not the domain rules.

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function tempDb() {
  const dir = mkdtempSync(join(tmpdir(), "ai-todo-cli-"));
  dirs.push(dir);
  return join(dir, "todo.db");
}

async function todo(db: string, argv: string[], stdin = "") {
  let stdout = "";
  let stderr = "";
  const deps: CliDeps = {
    openCore: (path) => createCore({ dbPath: path ?? db }),
    stdout: { write: (s: string) => (stdout += s) },
    stderr: { write: (s: string) => (stderr += s) },
    readStdin: async () => stdin,
    stdinIsTTY: false,
    packageRoot: resolve(__dirname, "../.."),
    homeDir: tmpdir(),
  };
  const code = await run(argv, deps);
  return { code, stdout, stderr, json: () => JSON.parse(stdout) };
}

describe("todo CLI", () => {
  it("help --json describes Lanes, the capture schema and every command", async () => {
    const res = await todo(tempDb(), ["help", "--json"]);
    expect(res.code).toBe(0);
    const out = res.json();
    expect(out.lanes.map((l: { id: string }) => l.id)).toContain("delegate");
    expect(out.captureInput).toHaveProperty("properties.tasks");
    const names = out.commands.map((c: { name: string }) => c.name);
    expect(names).toEqual(expect.arrayContaining(["add", "capture", "claim", "repo add", "skills install"]));
  });

  it("adds a Delegate Task against a registered Repo and claims it", async () => {
    const db = tempDb();
    expect((await todo(db, ["repo", "add", "api", "/tmp/api", "--json"])).code).toBe(0);
    const added = await todo(db, ["add", "--title", "Fix flaky test", "--lane", "delegate", "--repo", "api", "--json"]);
    expect(added.code).toBe(0);
    const id = added.json().id;

    const claimed = await todo(db, ["--db", db, "claim", "--lane", "delegate", "--worker", "w1", "--json"]);
    expect(claimed.code).toBe(0);
    expect(claimed.json()).toMatchObject({ id, status: "claimed", claimedBy: "w1", repo: "api" });

    const none = await todo(db, ["claim", "--lane", "delegate", "--json"]);
    expect(none).toMatchObject({ code: 0, stdout: "null\n" });

    const second = (
      await todo(db, ["add", "--title", "Bump lib", "--lane", "delegate", "--repo", "api", "--json"])
    ).json();
    const skipped = await todo(db, ["claim", "--lane", "delegate", "--exclude", `${second.id},999`, "--json"]);
    expect(skipped.stdout).toBe("null\n");
    const byId = await todo(db, ["claim", "--id", String(second.id), "--json"]);
    expect(byId.json()).toMatchObject({ id: second.id, status: "claimed" });
  });

  it("captures a JSON document from stdin", async () => {
    const doc = {
      initiative: { title: "Auth migration" },
      tasks: [
        { title: "Write the RFC", lane: "write", sources: [{ url: "https://slack/t1", summary: "Agreed to migrate" }] },
        { title: "Agree token TTL", lane: "align", people: ["@sam"] },
      ],
    };
    const res = await todo(tempDb(), ["capture", "--json"], JSON.stringify(doc));
    expect(res.code).toBe(0);
    const out = res.json();
    expect(out.initiativeId).toEqual(expect.any(Number));
    expect(out.taskIds).toHaveLength(2);
    expect(out.tasks.map((t: { title: string }) => t.title)).toEqual(["Write the RFC", "Agree token TTL"]);
  });

  it("reports domain errors as JSON on stderr with exit code 1", async () => {
    const res = await todo(tempDb(), ["add", "--title", "No repo", "--lane", "delegate", "--json"]);
    expect(res.code).toBe(1);
    expect(res.stdout).toBe("");
    expect(JSON.parse(res.stderr)).toEqual({
      error: { code: "REPO_REQUIRED", message: expect.any(String), details: expect.anything() },
    });
  });

  it("exits 2 on usage errors", async () => {
    const res = await todo(tempDb(), ["show", "not-a-number", "--json"]);
    expect(res.code).toBe(2);
    expect(JSON.parse(res.stderr).error.code).toBe("USAGE");
  });

  it("runs as a process against AI_TODO_DB", async () => {
    const root = resolve(__dirname, "../..");
    const exec = promisify(execFile);
    const env = { ...process.env, AI_TODO_DB: tempDb() };
    const tsx = join(root, "node_modules", ".bin", "tsx");
    const { stdout } = await exec(tsx, ["src/cli/main.ts", "help", "--json"], { cwd: root, env });
    expect(JSON.parse(stdout).commands.length).toBeGreaterThan(10);

    const failure = await exec(tsx, ["src/cli/main.ts", "add", "--title", "x", "--lane", "delegate", "--json"], {
      cwd: root,
      env,
    }).catch((e: { code: number; stderr: string }) => e);
    expect(failure).toMatchObject({ code: 1 });
    expect(JSON.parse((failure as { stderr: string }).stderr).error.code).toBe("REPO_REQUIRED");
  }, 30_000);
});
