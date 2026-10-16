import { spawn } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readdirSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** A failure in the CLI's own plumbing (files, stdin, skills, web), reported like a domain error. */
export class CliError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "CliError";
  }
}

function moduleDir(): string {
  if (typeof __dirname !== "undefined") return __dirname;
  return dirname(fileURLToPath(import.meta.url));
}

/** The package root: the nearest ancestor of this file (in `src/cli/` or `dist/`) holding package.json. */
export function findPackageRoot(start = moduleDir()): string {
  let dir = resolve(start);
  while (!existsSync(join(dir, "package.json"))) {
    const up = dirname(dir);
    if (up === dir) return resolve(start, "..");
    dir = up;
  }
  return dir;
}

export interface LinkedSkill {
  name: string;
  source: string;
  target: string;
  replaced: "symlink" | "directory" | null;
}

/** Symlinks every directory under `<root>/skills` into `targetDir`. Refuses to clobber real files unless forced. */
export function installSkills(root: string, targetDir: string, force: boolean): LinkedSkill[] {
  const skillsDir = join(root, "skills");
  const names = existsSync(skillsDir)
    ? readdirSync(skillsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
    : [];
  if (!names.length) throw new CliError("NOT_FOUND", `No skills found in ${skillsDir}`, { skillsDir });

  const plan = names.map((name) => {
    const target = join(targetDir, name);
    const existing = lstatOrNull(target);
    const replaced: LinkedSkill["replaced"] = !existing ? null : existing.isSymbolicLink() ? "symlink" : "directory";
    return { name, source: join(skillsDir, name), target, replaced };
  });
  const conflicts = plan.filter((p) => p.replaced === "directory").map((p) => p.target);
  if (conflicts.length && !force) {
    throw new CliError("CONFLICT", "Refusing to replace existing skill directories; pass --force to overwrite", {
      conflicts,
    });
  }

  mkdirSync(targetDir, { recursive: true });
  for (const p of plan) {
    if (p.replaced === "symlink") unlinkSync(p.target);
    else if (p.replaced === "directory") rmSync(p.target, { recursive: true, force: true });
    symlinkSync(p.source, p.target, "dir");
  }
  return plan;
}

function lstatOrNull(path: string) {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

export interface WebPlan {
  mode: "start" | "dev";
  url: string;
  command: string;
  args: string[];
  cwd: string;
}

/** `next start` when a production build exists, otherwise `next dev`. Always bound to localhost. */
export function webPlan(root: string, port: number): WebPlan {
  const mode = existsSync(join(root, ".next", "BUILD_ID")) ? "start" : "dev";
  return {
    mode,
    url: `http://127.0.0.1:${port}`,
    command: join(root, "node_modules", ".bin", "next"),
    args: [mode, "-H", "127.0.0.1", "-p", String(port)],
    cwd: root,
  };
}

export function runWeb(plan: WebPlan): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(plan.command, plan.args, { cwd: plan.cwd, stdio: "inherit" });
    // Pass termination on so Next.js never outlives the CLI.
    const forward = (signal: NodeJS.Signals) => child.kill(signal);
    const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];
    for (const s of signals) process.on(s, forward);
    const cleanup = () => signals.forEach((s) => process.off(s, forward));
    child.on("error", (e) => {
      cleanup();
      reject(new CliError("WEB_FAILED", `Could not start Next.js: ${e.message}`, plan));
    });
    child.on("exit", (code, signal) => {
      cleanup();
      resolvePromise(code ?? (signal ? 1 : 0));
    });
  });
}
