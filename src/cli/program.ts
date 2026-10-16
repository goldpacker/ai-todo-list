import { Argument, Command, CommanderError, InvalidArgumentError, Option } from "commander";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  type Core,
  createCore,
  type Lane,
  type PrepKind,
  type Priority,
  type Status,
  describeSchema,
  LANES,
  PREP_KINDS,
  PRIORITIES,
  STATUSES,
  type TaskDetail,
  type TaskPatch,
  type TaskSummary,
  TodoError,
} from "../core";
import * as fmt from "./format";
import { CliError, findPackageRoot, installSkills, runWeb, webPlan } from "./system";

export interface Output {
  write(chunk: string): unknown;
  isTTY?: boolean;
}

export interface CliDeps {
  /** Opens the core; `dbPath` comes from `--db`, otherwise the core's default (`AI_TODO_DB` or ~/.ai-todo/todo.db). */
  openCore: (dbPath?: string) => Core;
  stdout: Output;
  stderr: Output;
  readStdin: () => Promise<string>;
  stdinIsTTY: boolean;
  packageRoot: string;
  homeDir: string;
}

export function defaultDeps(): CliDeps {
  return {
    openCore: (dbPath) => createCore({ dbPath }),
    stdout: process.stdout,
    stderr: process.stderr,
    readStdin,
    stdinIsTTY: !!process.stdin.isTTY,
    packageRoot: findPackageRoot(),
    homeDir: homedir(),
  };
}

function readStdin(): Promise<string> {
  return new Promise((res, rej) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (c: Buffer) => chunks.push(c));
    process.stdin.on("end", () => res(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", rej);
  });
}

/** What a command produced: `data` is printed for --json, `text` otherwise. */
interface Result {
  data: unknown;
  text: string | (() => string);
  exitCode?: number;
}

interface Ctx {
  readonly core: Core;
  readonly style: fmt.Style;
  json: boolean;
}

interface GlobalOpts {
  json?: boolean;
  db?: string;
}

type Opts = Record<string, unknown> & GlobalOpts;
type Handler<A extends unknown[]> = (ctx: Ctx, opts: Opts, ...args: A) => Result | Promise<Result>;

// ---------- Argument helpers ----------

function parseId(value: string): number {
  const n = Number(value.replace(/^#/, ""));
  if (!Number.isInteger(n) || n <= 0) throw new InvalidArgumentError("Expected a positive integer id.");
  return n;
}

function parseCount(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new InvalidArgumentError("Expected a whole number.");
  return n;
}

const NONE = "none";

// Commander turns a parser's null into "", so "none" survives parsing and becomes null in the action.
const orNone =
  <T>(inner: (v: string) => T) =>
  (value: string): T | typeof NONE =>
    value === NONE ? NONE : inner(value);

const noneToNull = <T>(value: T | typeof NONE): T | null => (value === NONE ? null : value);

const collect = (value: string, previous: string[] = []) => [...previous, value];

const repeatableOptions = new WeakSet<Option>();

function repeatable(flags: string, description: string): Option {
  const opt = new Option(flags, `${description} (repeatable)`).argParser(collect);
  repeatableOptions.add(opt);
  return opt;
}

const oneOf = (values: readonly string[]) => values.join("|");

/** One Source from `--source`/`--summary`; the core validates that a summary is present. */
function sourceFrom(opts: Opts) {
  if (opts.source === undefined && opts.summary === undefined) return undefined;
  return [{ url: opts.source as string | undefined, summary: opts.summary as string }];
}

function nonEmptyList(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.length ? (value as string[]) : undefined;
}

/** Resolves `<id|name|@handle>` to a Person id without creating anyone. */
function resolvePersonId(core: Core, ref: string): number {
  const person = core.findPerson(ref);
  if (!person) {
    throw new CliError("NOT_FOUND", `Person "${ref}" not found`, {
      what: "Person",
      id: ref,
      people: core.people().map((p) => ({ id: p.id, name: p.name, handles: p.handles })),
    });
  }
  return person.id;
}

async function readBody(deps: CliDeps, file: string | undefined, what: string): Promise<string> {
  if (file) {
    try {
      return readFileSync(file === "-" ? 0 : resolve(file), "utf8");
    } catch (e) {
      throw new CliError("FILE_ERROR", `Could not read ${file}: ${(e as Error).message}`, { file });
    }
  }
  if (deps.stdinIsTTY) {
    throw new CliError("NO_INPUT", `No ${what} given; pipe it on stdin or pass --file <path>`, {});
  }
  return deps.readStdin();
}

// ---------- Program ----------

/** `state.exitCode` lets a command (e.g. `web`) pass on a child's exit code. */
export function buildProgram(deps: CliDeps, state: { exitCode: number } = { exitCode: 0 }): Command {
  let core: Core | undefined;
  const styleFor = (out: Output) => (out.isTTY ? fmt.ansi : fmt.plain);

  const program = new Command("todo")
    .description(
      "A personal, local task list for a staff engineer that coding agents write to and work on.\n" +
        "Run `todo help --json` for the machine-readable schema (Lanes, statuses, rules, capture format, commands).",
    )
    .option("--json", "machine-readable output on stdout; errors as JSON on stderr")
    .option("--db <path>", "SQLite file to use (default: $AI_TODO_DB or ~/.ai-todo/todo.db)")
    .helpCommand(false)
    .configureHelp({ showGlobalOptions: true, sortSubcommands: false })
    .exitOverride()
    .configureOutput({
      writeOut: (s) => deps.stdout.write(s),
      writeErr: (s) => deps.stderr.write(s),
      // Usage errors are rendered by `run`, so they can be JSON when --json is given.
      outputError: () => {},
    });

  /** Declares a command; `<id>`-style arguments are parsed as positive integers. */
  const cmd = (parent: Command, nameAndArgs: string, description: string) => {
    const [name, ...args] = nameAndArgs.split(" ");
    const c = parent.command(name).description(description).helpCommand(false);
    for (const a of args) {
      const arg = new Argument(a);
      if (/^(id|\w+Id)$/.test(arg.name())) arg.argParser(parseId);
      c.addArgument(arg);
    }
    return c;
  };

  /** Wraps a handler: resolves options, runs it, prints the result. */
  const act =
    <A extends unknown[]>(handler: Handler<A>) =>
    async (...raw: unknown[]) => {
      const command = raw[raw.length - 1] as Command;
      const opts = command.optsWithGlobals<Opts>();
      const args = raw.slice(0, -2) as A;
      const json = !!opts.json;
      const ctx: Ctx = {
        get core() {
          core ??= deps.openCore(opts.db ? resolve(opts.db) : undefined);
          return core;
        },
        style: styleFor(deps.stdout),
        json,
      };
      try {
        const result = await handler(ctx, opts, ...args);
        if (json) deps.stdout.write(JSON.stringify(result.data, null, 2) + "\n");
        else {
          const text = typeof result.text === "function" ? result.text() : result.text;
          if (text) deps.stdout.write(text.endsWith("\n") ? text : text + "\n");
        }
        if (result.exitCode) state.exitCode = result.exitCode;
      } finally {
        core?.close();
        core = undefined;
      }
    };

  const detail = (ctx: Ctx, t: TaskDetail, headline?: string): Result => ({
    data: t,
    text: () => (headline ? `${headline}\n\n` : "") + fmt.taskDetail(t, ctx.style),
  });
  const brief = (ctx: Ctx, t: TaskDetail, verb: string): Result => ({
    data: t,
    text: `${verb} #${t.id} ${t.title} ${ctx.style.dim(`[${t.lane ?? "initiative"}, ${t.status}]`)}`,
  });
  const list = (ctx: Ctx, tasks: TaskSummary[], empty?: string): Result => ({
    data: tasks,
    text: () => fmt.taskList(tasks, ctx.style, empty),
  });

  // ----- help -----

  cmd(program, "help [command...]", "show help; with --json, the full schema and command list")
    .addHelpText("after", "\nWith --json: the core schema (lanes, statuses, rules, captureInput) plus `commands`.")
    .action(
      act((_ctx, _opts, path: string[]) => {
        const target = path.reduce<Command | undefined>(
          (c, name) => c?.commands.find((s) => s.name() === name || s.aliases().includes(name)),
          program,
        );
        if (!target) throw new CliError("UNKNOWN_COMMAND", `Unknown command: ${path.join(" ")}`, {});
        return {
          data: { ...describeSchema(), globalOptions: describeOptions(program), commands: describeCommands(program) },
          text: () => target.helpInformation(),
        };
      }),
    );

  // ----- Capture -----

  cmd(program, "add", "add one Task")
    .requiredOption("--title <title>", "short imperative title")
    .requiredOption("--lane <lane>", oneOf(LANES))
    .option("--description <text>", "what done looks like, constraints, acceptance criteria")
    .option("--priority <priority>", oneOf(PRIORITIES))
    .option("--due <date>", "due date, YYYY-MM-DD")
    .option("--repo <name>", "registered Repo name (required for delegate)")
    .option("--source <url>", "Source URL (needs --summary)")
    .option("--summary <text>", "Source summary; alone, records a conversational Source")
    .addOption(repeatable("--person <name|@handle>", "linked Person"))
    .option("--parent <initiativeId>", "file under an existing Initiative", parseId)
    .option("--force", "add even if the Source URL is already on file")
    .action(
      act((ctx, o) => {
        const t = ctx.core.addTask({
          title: o.title as string,
          lane: o.lane as Lane,
          description: o.description as string | undefined,
          priority: o.priority as Priority | undefined,
          dueDate: o.due as string | undefined,
          repo: o.repo as string | undefined,
          sources: sourceFrom(o),
          people: nonEmptyList(o.person),
          parentId: o.parent as number | undefined,
          force: !!o.force,
        });
        return brief(ctx, t, "Added");
      }),
    );

  cmd(program, "capture", "atomically add Tasks (and optionally an Initiative) from a CaptureInput JSON document")
    .option("--file <path>", "read the document from a file instead of stdin")
    .option("--force", "add even if a Source URL is already on file")
    .addHelpText("after", "\nThe CaptureInput JSON schema is in `todo help --json` under `captureInput`.")
    .action(
      act(async (ctx, o) => {
        const text = await readBody(deps, o.file as string | undefined, "CaptureInput JSON");
        let doc: unknown;
        try {
          doc = JSON.parse(text);
        } catch (e) {
          throw new TodoError("VALIDATION", `Capture input is not valid JSON: ${(e as Error).message}`, {});
        }
        if (o.force && doc && typeof doc === "object") doc = { ...doc, force: true };
        const { initiativeId, taskIds, tasks } = ctx.core.capture(doc);
        return {
          data: { initiativeId, taskIds, tasks },
          text: () =>
            [
              initiativeId != null ? `Initiative #${initiativeId}` : "",
              `Added ${taskIds.length} Task${taskIds.length === 1 ? "" : "s"}:`,
              fmt.taskList(tasks, ctx.style),
            ]
              .filter(Boolean)
              .join("\n"),
        };
      }),
    );

  const initiative = cmd(program, "initiative", "manage Initiatives");
  cmd(initiative, "add", "create an Initiative (no Lane)")
    .requiredOption("--title <title>", "title")
    .option("--description <text>", "description")
    .option("--priority <priority>", oneOf(PRIORITIES))
    .option("--due <date>", "due date, YYYY-MM-DD")
    .option("--source <url>", "Source URL (needs --summary)")
    .option("--summary <text>", "Source summary")
    .addOption(repeatable("--person <name|@handle>", "linked Person"))
    .option("--force", "add even if the Source URL is already on file")
    .action(
      act((ctx, o) => {
        const t = ctx.core.createInitiative({
          title: o.title as string,
          description: o.description as string | undefined,
          priority: o.priority as Priority | undefined,
          dueDate: o.due as string | undefined,
          sources: sourceFrom(o),
          people: nonEmptyList(o.person),
          force: !!o.force,
        });
        return brief(ctx, t, "Created Initiative");
      }),
    );

  cmd(program, "initiatives", "list Initiatives with progress")
    .option("--all", "include done and dropped Initiatives")
    .action(act((ctx, o) => list(ctx, ctx.core.initiatives(!!o.all), "No Initiatives.")));

  cmd(program, "find", "find Tasks by Source URL (check before capturing)")
    .requiredOption("--source <url>", "Source URL")
    .action(
      act((ctx, o) => {
        const found = ctx.core.findBySourceUrl(o.source as string);
        return {
          data: found,
          text: () =>
            fmt.taskList(found, ctx.style, "No Tasks with that Source.", (t) =>
              t.sourceIds.map((id) => `source #${id}`).join(", "),
            ),
        };
      }),
    );

  const source = cmd(program, "source", "manage a Task's Sources");
  cmd(source, "add <taskId>", "attach a Source to a Task")
    .option("--url <url>", "Source URL; omit for a conversation")
    .requiredOption("--summary <text>", "the relevant context")
    .action(
      act((ctx, o, taskId: number) =>
        brief(
          ctx,
          ctx.core.addSource(taskId, { url: o.url as string | undefined, summary: o.summary as string }),
          "Added Source to",
        ),
      ),
    );
  cmd(source, "update <sourceId>", "refresh a Source's summary")
    .requiredOption("--summary <text>", "the new summary")
    .action(
      act((ctx, o, sourceId: number) =>
        brief(ctx, ctx.core.updateSourceSummary(sourceId, o.summary as string), "Updated Source on"),
      ),
    );

  // ----- Query -----

  cmd(program, "show <id>", "show a Task in full: Sources, People, Repo, Preps, Lane changes, notes, children").action(
    act((ctx, _o, id: number) => detail(ctx, ctx.core.task(id))),
  );

  cmd(program, "list", "list Tasks (active only unless --all or --status)")
    .option("--lane <lane>", oneOf(LANES))
    .addOption(repeatable("--status <status>", oneOf(STATUSES)))
    .option("--person <id|name|@handle>", "linked Person")
    .option("--initiative <id>", "children of an Initiative", parseId)
    .option("--repo <name>", "registered Repo")
    .option("--all", "include done and dropped")
    .action(
      act((ctx, o) =>
        list(
          ctx,
          ctx.core.list({
            lane: o.lane as Lane,
            status: nonEmptyList(o.status) as Status[] | undefined,
            personId: o.person ? resolvePersonId(ctx.core, o.person as string) : undefined,
            initiativeId: o.initiative as number | undefined,
            repo: o.repo as string | undefined,
            includeResolved: !!o.all,
          }),
        ),
      ),
    );

  cmd(program, "today", "Ready, high-priority, overdue and due-today Tasks, grouped by Lane").action(
    act((ctx) => {
      const view = ctx.core.today();
      return { data: view, text: () => fmt.today(view, ctx.style) };
    }),
  );

  cmd(program, "followups", "Waiting Tasks due a follow-up").action(
    act((ctx) => list(ctx, ctx.core.followUpsDue(), "No follow-ups due.")),
  );

  cmd(program, "people", "list People and their active Task counts").action(
    act((ctx) => {
      const everyone = ctx.core.people();
      return { data: everyone, text: () => fmt.people(everyone, ctx.style) };
    }),
  );

  cmd(program, "person <ref>", "show a Person (by id, name or @handle) and their active Tasks").action(
    act((ctx, _o, ref: string) => {
      const p = ctx.core.person(resolvePersonId(ctx.core, ref));
      return {
        data: p,
        text: () =>
          `${ctx.style.bold(p.name)}${p.handles.length ? ` ${ctx.style.dim(p.handles.join(", "))}` : ""}\n` +
          fmt.taskList(p.tasks, ctx.style, "No active Tasks."),
      };
    }),
  );

  // ----- Edit -----

  cmd(program, "edit <id>", "edit a Task's fields")
    .option("--title <title>", "title")
    .option("--description <text>", "description")
    .option("--priority <priority>", oneOf(PRIORITIES))
    .option("--due <date|none>", "due date, YYYY-MM-DD, or none to clear", orNone(String))
    .option("--repo <name|none>", "registered Repo, or none to clear", orNone(String))
    .addOption(repeatable("--person <name|@handle>", "replaces the linked People"))
    .option("--parent <id|none>", "Initiative, or none to detach", orNone(parseId))
    .option("--follow-up-days <n|none>", "days Waiting before a follow-up, or none for the default", orNone(parseCount))
    .action(
      act((ctx, o, id: number) => {
        const patch: TaskPatch = {};
        if (o.title !== undefined) patch.title = o.title as string;
        if (o.description !== undefined) patch.description = o.description as string;
        if (o.priority !== undefined) patch.priority = o.priority as Priority;
        if (o.due !== undefined) patch.dueDate = noneToNull(o.due as string);
        if (o.repo !== undefined) patch.repo = noneToNull(o.repo as string);
        if (o.person !== undefined) patch.people = o.person as string[];
        if (o.parent !== undefined) patch.parentId = noneToNull(o.parent as number);
        if (o.followUpDays !== undefined) patch.followUpDays = noneToNull(o.followUpDays as number);
        if (!Object.keys(patch).length) throw new CliError("NOTHING_TO_EDIT", "Pass at least one field to change", {});
        return brief(ctx, ctx.core.updateTask(id, patch), "Updated");
      }),
    );

  cmd(program, "lane <id> <lane>", "change a Task's Lane, recording why")
    .requiredOption("--reason <text>", "why the Lane changes")
    .option("--repo <name>", "Repo, when moving into delegate without one")
    .option("--actor <actor>", "engineer|agent (default agent)")
    .action(
      act((ctx, o, id: number, lane: Lane) =>
        brief(
          ctx,
          ctx.core.changeLane(id, {
            lane: lane as Lane,
            reason: o.reason as string,
            repo: o.repo as string | undefined,
            actor: o.actor as "engineer" | "agent" | undefined,
          }),
          "Moved",
        ),
      ),
    );

  cmd(program, "note <id> <text...>", "add a note to a Task")
    .option("--author <name>", "who wrote it (default engineer)")
    .action(
      act((ctx, o, id: number, text: string[]) =>
        brief(ctx, ctx.core.addNote(id, text.join(" "), o.author as string | undefined), "Noted on"),
      ),
    );

  // ----- Work -----

  cmd(program, "claim", "atomically claim the best open Task in a Lane, or one Task by --id (null when none)")
    .option("--lane <lane>", oneOf(LANES))
    .option("--id <id>", "claim this specific open Task instead", parseId)
    .addOption(
      repeatable("--exclude <id,...>", "skip these Task ids when claiming by Lane").argParser(
        (value: string, previous: number[] = []) => [...previous, ...value.split(",").filter(Boolean).map(parseId)],
      ),
    )
    .option("--worker <name>", "claiming Worker (default worker)")
    .action(
      act((ctx, o) => {
        const worker = o.worker as string | undefined;
        if ((o.lane === undefined) === (o.id === undefined)) {
          throw new CommanderError(1, "todo.claimTarget", "pass exactly one of --lane <lane> or --id <id>");
        }
        const t =
          o.id !== undefined
            ? ctx.core.claimTask(o.id as number, worker)
            : ctx.core.claim(o.lane as Lane, worker, { exclude: o.exclude as number[] | undefined });
        if (!t) return { data: null, text: `Nothing to claim in ${o.lane}` };
        return detail(ctx, t, `Claimed #${t.id} until ${fmt.time(t.claimExpiresAt)}`);
      }),
    );

  cmd(program, "renew <id>", "extend your claim on a Task")
    .option("--worker <name>", "claiming Worker (default worker)")
    .action(
      act((ctx, o, id: number) => {
        const t = ctx.core.renewClaim(id, o.worker as string | undefined);
        return { data: t, text: `Renewed #${t.id} until ${fmt.time(t.claimExpiresAt)}` };
      }),
    );

  cmd(program, "release <id>", "give a claimed Task back to open, with a note on what went wrong")
    .requiredOption("--note <text>", "what happened")
    .option("--worker <name>", "releasing Worker (default worker)")
    .action(
      act((ctx, o, id: number) =>
        brief(ctx, ctx.core.release(id, o.note as string, o.worker as string | undefined), "Released"),
      ),
    );

  cmd(program, "prep <id>", "attach a Prep (markdown) from --body, --file or stdin")
    .requiredOption("--kind <kind>", oneOf(PREP_KINDS))
    .option("--body <markdown>", "Prep body")
    .option("--file <path>", "read the body from a file")
    .option("--ready", "also mark the Task ready")
    .option("--author <name>", "who wrote it (default worker)")
    .action(
      act(async (ctx, o, id: number) => {
        const body =
          (o.body as string | undefined) ?? (await readBody(deps, o.file as string | undefined, "Prep body"));
        const t = ctx.core.attachPrep(id, {
          kind: o.kind as PrepKind,
          body,
          author: o.author as string | undefined,
          ready: !!o.ready,
        });
        return brief(ctx, t, "Attached Prep to");
      }),
    );

  cmd(program, "pr <id> <url>", "record a Delegate Task's PR and mark it ready").action(
    act((ctx, _o, id: number, url: string) => brief(ctx, ctx.core.recordPr(id, url), "Recorded PR on")),
  );

  // ----- Lifecycle -----

  cmd(program, "ready <id>", "mark a Task ready for the engineer").action(
    act((ctx, _o, id: number) => brief(ctx, ctx.core.markReady(id), "Ready:")),
  );
  cmd(program, "done <id>", "mark a Task done").action(
    act((ctx, _o, id: number) => brief(ctx, ctx.core.markDone(id), "Done:")),
  );
  cmd(program, "drop <id>", "drop a Task (or an Initiative and its unresolved children)")
    .option("--note <text>", "why")
    .action(act((ctx, o, id: number) => brief(ctx, ctx.core.drop(id, o.note as string | undefined), "Dropped")));
  cmd(program, "reopen <id>", "reopen a Task")
    .option("--note <text>", "why")
    .action(act((ctx, o, id: number) => brief(ctx, ctx.core.reopen(id, o.note as string | undefined), "Reopened")));
  cmd(program, "wait <id>", "mark a Task waiting on someone else")
    .requiredOption("--note <text>", "who and what it waits on")
    .option("--follow-up-days <n>", "days before a follow-up is drafted (default 3)", parseCount)
    .action(
      act((ctx, o, id: number) =>
        brief(
          ctx,
          ctx.core.setWaiting(id, {
            note: o.note as string,
            followUpDays: o.followUpDays as number | undefined,
          }),
          "Waiting:",
        ),
      ),
    );

  cmd(program, "sync", "reconcile ready Delegate Tasks with their PRs (merged → done, closed → open)").action(
    act(async (ctx) => {
      const result = await ctx.core.syncPrs();
      return { data: result, text: () => fmt.sync(result, ctx.style) };
    }),
  );

  // ----- Repos -----

  const repo = cmd(program, "repo", "manage Repos that Delegate Tasks target");
  cmd(repo, "add <name> <path>", "register a Repo by short name")
    .option("--remote <url>", "git remote URL")
    .action(
      act((ctx, o, name: string, path: string) => {
        const r = ctx.core.registerRepo({ name, path: resolve(path), remote: o.remote as string | undefined });
        return { data: r, text: `Registered repo ${r.name} → ${r.path}` };
      }),
    );
  cmd(repo, "list", "list registered Repos").action(
    act((ctx) => {
      const repos = ctx.core.repos();
      return {
        data: repos,
        text: () =>
          repos.length
            ? fmt.table(
                repos.map((r) => [r.name, r.path, r.remote ?? ""]),
                ["NAME", "PATH", "REMOTE"],
                ctx.style,
              )
            : ctx.style.dim("No repos registered. Add one with `todo repo add <name> <path>`."),
      };
    }),
  );
  cmd(repo, "rm <name>", "remove a Repo").action(
    act((ctx, _o, name: string) => {
      ctx.core.removeRepo(name);
      return { data: { removed: name }, text: `Removed repo ${name}` };
    }),
  );

  // ----- Setup -----

  const skills = cmd(program, "skills", "manage the agent skills shipped with this CLI");
  cmd(skills, "install", "symlink the bundled skills into ~/.claude/skills")
    .option("--dir <path>", "target skills directory")
    .option("--force", "replace existing skill directories")
    .action(
      act((ctx, o) => {
        const dir = o.dir ? resolve(o.dir as string) : join(deps.homeDir, ".claude", "skills");
        const linked = installSkills(deps.packageRoot, dir, !!o.force);
        return {
          data: { dir, linked },
          text: () =>
            linked
              .map(
                (l) =>
                  `Linked ${l.target} → ${l.source}${l.replaced ? ctx.style.dim(` (replaced ${l.replaced})`) : ""}`,
              )
              .join("\n"),
        };
      }),
    );

  cmd(program, "web", "serve the web app on localhost")
    .option("--port <port>", "port", parseCount, 4477)
    .action(
      act(async (ctx, o) => {
        const plan = webPlan(deps.packageRoot, o.port as number);
        const announce = ctx.json
          ? JSON.stringify({ mode: plan.mode, url: plan.url }) + "\n"
          : `Starting web app (next ${plan.mode}) at ${plan.url}\n`;
        deps.stdout.write(announce);
        const exitCode = await runWeb(plan);
        return { data: undefined, text: "", exitCode };
      }),
    );

  return program;
}

// ---------- Introspection for `help --json` ----------

function describeOptions(command: Command) {
  return command.options.map((o) => ({
    flags: o.flags,
    name: o.attributeName(),
    description: o.description,
    required: o.mandatory,
    takesValue: o.required || o.optional,
    repeatable: repeatableOptions.has(o),
    ...(o.defaultValue !== undefined ? { default: o.defaultValue } : {}),
  }));
}

function describeCommands(program: Command) {
  const out: {
    name: string;
    usage: string;
    description: string;
    arguments: { name: string; required: boolean; variadic: boolean }[];
    options: ReturnType<typeof describeOptions>;
  }[] = [];
  const walk = (c: Command, prefix: string[]) => {
    for (const sub of c.commands) {
      const path = [...prefix, sub.name()];
      if (sub.commands.length) walk(sub, path);
      else {
        out.push({
          name: path.join(" "),
          usage: `todo ${path.join(" ")} ${sub.usage()}`.trim(),
          description: sub.description(),
          arguments: sub.registeredArguments.map((a) => ({
            name: a.name(),
            required: a.required,
            variadic: a.variadic,
          })),
          options: describeOptions(sub),
        });
      }
    }
  };
  walk(program, []);
  return out;
}

// ---------- Entry ----------

/** Runs the CLI in-process and returns the exit code: 0 ok, 1 domain or runtime error, 2 usage error. */
export async function run(argv: string[], deps: CliDeps = defaultDeps()): Promise<number> {
  const json = argv.includes("--json");
  const fail = (code: string, message: string, details?: unknown, human?: string) => {
    if (json) deps.stderr.write(JSON.stringify({ error: { code, message, details: details ?? null } }) + "\n");
    else deps.stderr.write((human ?? `Error: ${message}`) + "\n");
  };
  const state = { exitCode: 0 };
  try {
    await buildProgram(deps, state).parseAsync(argv, { from: "user" });
    return state.exitCode;
  } catch (e) {
    if (e instanceof CommanderError) {
      if (e.exitCode === 0) return 0;
      const message = e.message.replace(/^error: /, "");
      fail("USAGE", message, { commanderCode: e.code }, `Error: ${message}\nRun \`todo help\` for usage.`);
      return 2;
    }
    if (e instanceof TodoError || e instanceof CliError) {
      const extra = fmt.errorDetails(e.code, e.details);
      fail(e.code, e.message, e.details, [`Error (${e.code}): ${e.message}`, ...extra].join("\n"));
      return 1;
    }
    const err = e instanceof Error ? e : new Error(String(e));
    fail("INTERNAL", err.message, null, `Error: ${err.stack ?? err.message}`);
    return 1;
  }
}
