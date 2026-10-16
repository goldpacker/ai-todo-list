// Translates submitted form fields into core calls and core errors into UI state.
// No domain rules live here: every validation and transition check is the core's. This module is
// framework-free so tests can drive it against a temporary database.
import type { Core, DuplicateMatch } from "@/core/core";
import type { Lane, Priority } from "@/core/domain";
import { TodoError } from "@/core/errors";

export interface ActionState {
  ok: boolean;
  /** A summary message (shown when an error isn't tied to one field). */
  message?: string;
  /** Errors keyed by form field name. */
  fieldErrors?: Record<string, string>;
  /** Present when adding failed because a Source URL is already on file. */
  duplicates?: DuplicateMatch[];
  /** Id of the created or affected Task. */
  id?: number;
}

export const idle: ActionState = { ok: false };

const str = (fd: FormData, key: string): string => {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
};

const opt = (fd: FormData, key: string): string | undefined => str(fd, key) || undefined;

function intField(fd: FormData, key: string): number | undefined {
  const s = str(fd, key);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isInteger(n) ? n : NaN;
}

function taskId(fd: FormData): number {
  const n = intField(fd, "id");
  if (n === undefined || Number.isNaN(n)) throw new TodoError("VALIDATION", "Missing Task id");
  return n;
}

/** "Priya Shah, @marcus" → ["Priya Shah", "@marcus"]. */
export function parsePeople(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Maps core issue paths ("sources.0.summary") onto form field names ("sourceSummary"). */
function fieldFor(path: string): string {
  if (path.startsWith("sources.")) return path.endsWith(".url") ? "sourceUrl" : "sourceSummary";
  if (path.startsWith("people")) return "people";
  return path.split(".")[0];
}

/** Converts a thrown error into displayable state. Unknown errors are re-thrown to the error boundary. */
export function toActionState(err: unknown): ActionState {
  if (!(err instanceof TodoError)) throw err;
  const details = (err.details ?? {}) as Record<string, unknown>;
  switch (err.code) {
    case "VALIDATION": {
      const issues = (details.issues as { path: string; message: string }[] | undefined) ?? [];
      if (!issues.length) return { ok: false, message: err.message };
      const fieldErrors: Record<string, string> = {};
      for (const i of issues) if (i.path) fieldErrors[fieldFor(i.path)] ??= i.message;
      const general = issues.filter((i) => !i.path).map((i) => i.message);
      if (!Object.keys(fieldErrors).length) return { ok: false, message: general.join("; ") || err.message };
      return { ok: false, message: general.join("; ") || "Check the highlighted fields.", fieldErrors };
    }
    case "REPO_REQUIRED": {
      const known = (details.known as string[] | undefined) ?? [];
      const hint = known.length ? "" : " No Repos are registered yet — add one with `todo repo add`.";
      return {
        ok: false,
        message: err.message,
        fieldErrors: { repo: `Delegate Tasks need a registered Repo.${hint}` },
      };
    }
    case "NOT_FOUND":
      if (details.repo) return { ok: false, message: err.message, fieldErrors: { repo: err.message } };
      return { ok: false, message: err.message };
    case "DUPLICATE_SOURCE":
      return {
        ok: false,
        message: "This Source is already on file.",
        duplicates: (details.matches as DuplicateMatch[] | undefined) ?? [],
      };
    default:
      return { ok: false, message: err.message };
  }
}

function attempt(fn: () => number | void): ActionState {
  try {
    const id = fn();
    return { ok: true, id: typeof id === "number" ? id : undefined };
  } catch (err) {
    return toActionState(err);
  }
}

function sourcesFrom(fd: FormData) {
  const url = opt(fd, "sourceUrl");
  const summary = str(fd, "sourceSummary");
  if (!url && !summary) return undefined;
  return [{ url, summary }];
}

// ----- Create -----

export function addTask(core: Core, fd: FormData): ActionState {
  return attempt(() => {
    const people = parsePeople(str(fd, "people"));
    const parentId = intField(fd, "parentId");
    return core.addTask({
      title: str(fd, "title"),
      description: opt(fd, "description"),
      lane: str(fd, "lane") as Lane,
      priority: (opt(fd, "priority") as Priority | undefined) ?? undefined,
      dueDate: opt(fd, "dueDate"),
      repo: opt(fd, "repo"),
      sources: sourcesFrom(fd),
      people: people.length ? people : undefined,
      parentId,
      force: str(fd, "force") === "1",
    }).id;
  });
}

export function createInitiative(core: Core, fd: FormData): ActionState {
  return attempt(() => {
    const people = parsePeople(str(fd, "people"));
    return core.createInitiative({
      title: str(fd, "title"),
      description: opt(fd, "description"),
      priority: (opt(fd, "priority") as Priority | undefined) ?? undefined,
      dueDate: opt(fd, "dueDate"),
      sources: sourcesFrom(fd),
      people: people.length ? people : undefined,
      force: str(fd, "force") === "1",
    }).id;
  });
}

// ----- Edit -----

/** Applies the edit form. Empty due date / repo clear the field; people replace the linked People. */
export function updateTask(core: Core, fd: FormData): ActionState {
  return attempt(() => {
    const id = taskId(fd);
    const patch: Parameters<Core["updateTask"]>[1] = {
      title: str(fd, "title"),
      description: typeof fd.get("description") === "string" ? String(fd.get("description")) : undefined,
      priority: (opt(fd, "priority") as Priority | undefined) ?? undefined,
      dueDate: opt(fd, "dueDate") ?? null,
      people: parsePeople(str(fd, "people")),
    };
    if (fd.has("repo")) patch.repo = opt(fd, "repo") ?? null;
    core.updateTask(id, patch);
    return id;
  });
}

export function changeLane(core: Core, fd: FormData): ActionState {
  return attempt(() => {
    const id = taskId(fd);
    core.changeLane(id, {
      lane: str(fd, "lane") as Lane,
      reason: str(fd, "reason"),
      actor: "engineer",
      repo: opt(fd, "repo"),
    });
    return id;
  });
}

// ----- Lifecycle -----

export function markDone(core: Core, fd: FormData): ActionState {
  return attempt(() => core.markDone(taskId(fd)).id);
}

export function markReady(core: Core, fd: FormData): ActionState {
  return attempt(() => core.markReady(taskId(fd)).id);
}

export function drop(core: Core, fd: FormData): ActionState {
  return attempt(() => core.drop(taskId(fd), opt(fd, "note")).id);
}

export function reopen(core: Core, fd: FormData): ActionState {
  return attempt(() => core.reopen(taskId(fd), opt(fd, "note")).id);
}

export function setWaiting(core: Core, fd: FormData): ActionState {
  return attempt(() => {
    const followUpDays = intField(fd, "followUpDays");
    return core.setWaiting(taskId(fd), { note: str(fd, "note"), followUpDays }).id;
  });
}

export function addNote(core: Core, fd: FormData): ActionState {
  return attempt(() => core.addNote(taskId(fd), str(fd, "body"), "engineer").id);
}
