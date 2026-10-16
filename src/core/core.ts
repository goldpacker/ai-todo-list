import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { type Db, openDb } from "./db";
import {
  ACTIVE_STATUSES,
  type Actor,
  CLAIM_DURATION_MS,
  DEFAULT_FOLLOW_UP_DAYS,
  type Lane,
  LANE_INFO,
  LANES,
  PREP_KINDS,
  PRIORITIES,
  PRIORITY_RANK,
  type PrepKind,
  type Priority,
  RESOLVED_STATUSES,
  STATUS_DESCRIPTIONS,
  STATUSES,
  type Status,
  TRANSITIONS,
} from "./domain";
import { notFound, TodoError } from "./errors";
import {
  captureInput,
  type CaptureInput,
  initiativeInput,
  type InitiativeInput,
  laneChangeInput,
  type LaneChangeInput,
  parse,
  personRef,
  type PersonRef,
  prepInput,
  type PrepInput,
  repoInput,
  type RepoInput,
  sourceInput,
  type SourceInput,
  taskInput,
  type TaskInput,
  taskPatch,
  type TaskPatch,
  waitingInput,
  type WaitingInput,
} from "./inputs";
import { type Clock, ghPrStatus, type PrStatusAdapter, systemClock } from "./ports";
import {
  laneChanges,
  notes,
  people,
  preps,
  repos,
  sources,
  taskPeople,
  tasks,
  type PersonRow,
  type RepoRow,
  type TaskRow,
} from "./schema";

// ---------- Read model ----------

export interface PersonRefView {
  id: number;
  name: string;
  handles: string[];
  role: string | null;
}

export interface TaskSummary {
  id: number;
  kind: "task" | "initiative";
  title: string;
  lane: Lane | null;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  overdue: boolean;
  dueToday: boolean;
  parent: { id: number; title: string } | null;
  repo: string | null;
  prUrl: string | null;
  people: PersonRefView[];
  claimedBy: string | null;
  claimedAt: string | null;
  claimExpiresAt: string | null;
  waitingNote: string | null;
  waitingSince: string | null;
  prepCount: number;
  progress: { resolved: number; total: number } | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface SourceView {
  id: number;
  url: string | null;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrepView {
  id: number;
  kind: PrepKind;
  body: string;
  author: string;
  createdAt: string;
}

export interface LaneChangeView {
  id: number;
  fromLane: Lane;
  toLane: Lane;
  reason: string;
  actor: Actor;
  createdAt: string;
}

export interface NoteView {
  id: number;
  body: string;
  author: string;
  createdAt: string;
}

export interface TaskDetail extends TaskSummary {
  description: string;
  repoDetail: { name: string; path: string; remote: string | null } | null;
  sources: SourceView[];
  preps: PrepView[];
  laneChanges: LaneChangeView[];
  notes: NoteView[];
  children: TaskSummary[];
  followUpDays: number;
  followUpDue: boolean;
}

export interface TodayView {
  date: string;
  total: number;
  lanes: { lane: Lane; name: string; tasks: (TaskSummary & { reasons: TodayReason[] })[] }[];
}

export type TodayReason = "ready" | "high" | "overdue" | "due-today";

export interface ListFilters {
  lane?: Lane;
  status?: Status | Status[];
  personId?: number;
  initiativeId?: number;
  repo?: string;
  kind?: "task" | "initiative";
  /** Include done and dropped Tasks; ignored when `status` is given. */
  includeResolved?: boolean;
}

export interface DuplicateMatch {
  url: string;
  tasks: { id: number; title: string; status: Status; lane: Lane | null }[];
}

export interface SyncResult {
  merged: { id: number; title: string; prUrl: string }[];
  closed: { id: number; title: string; prUrl: string }[];
  unchanged: { id: number; title: string; prUrl: string }[];
  errors: { id: number; prUrl: string; message: string }[];
}

export interface PersonSummary {
  id: number;
  name: string;
  handles: string[];
  activeTaskCount: number;
}

export interface CoreOptions {
  db?: Db;
  dbPath?: string;
  clock?: Clock;
  prStatus?: PrStatusAdapter;
}

// ---------- Helpers ----------

const pad = (n: number) => String(n).padStart(2, "0");

/** The engineer's local calendar date for `d`. */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const isActive = (s: Status) => ACTIVE_STATUSES.includes(s);
const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeHandle(h: string): string {
  return h.trim().replace(/^@/, "").toLowerCase();
}

// ---------- Core ----------

export type Core = ReturnType<typeof createCore>;

export function createCore(options: CoreOptions = {}) {
  const db: Db = options.db ?? openDb(options.dbPath);
  const clock = options.clock ?? systemClock;
  const prStatus = options.prStatus ?? ghPrStatus;

  const nowIso = () => clock.now().toISOString();
  const today = () => localDate(clock.now());

  /** A claim past its expiry counts as open. */
  function effectiveStatus(row: TaskRow): Status {
    if (row.status === "claimed" && row.claimExpiresAt && row.claimExpiresAt <= nowIso()) return "open";
    return row.status;
  }

  function getRow(id: number): TaskRow {
    const row = db.select().from(tasks).where(eq(tasks.id, id)).get();
    if (!row) throw notFound("Task", id);
    return row;
  }

  function getTaskRow(id: number): TaskRow {
    const row = getRow(id);
    if (row.kind === "initiative") {
      throw new TodoError("VALIDATION", `Task ${id} is an Initiative; this operation applies to Tasks only`, { id });
    }
    return row;
  }

  function getInitiativeRow(id: number): TaskRow {
    const row = getRow(id);
    if (row.kind !== "initiative") throw new TodoError("VALIDATION", `Task ${id} is not an Initiative`, { id });
    return row;
  }

  function findRepo(name: string): RepoRow {
    const repo = db.select().from(repos).where(eq(repos.name, name)).get();
    if (!repo) {
      const known = db
        .select({ name: repos.name })
        .from(repos)
        .all()
        .map((r) => r.name);
      throw new TodoError("NOT_FOUND", `Repo "${name}" is not registered`, { repo: name, known });
    }
    return repo;
  }

  function assertTransition(row: TaskRow, to: Status) {
    const from = effectiveStatus(row);
    if (!TRANSITIONS[from].includes(to)) {
      throw new TodoError("INVALID_TRANSITION", `Task ${row.id} cannot move from ${from} to ${to}`, {
        id: row.id,
        from,
        to,
        allowed: TRANSITIONS[from],
      });
    }
  }

  const clearClaim = { claimedBy: null, claimedAt: null, claimExpiresAt: null } as const;
  const clearWaiting = { waitingNote: null, waitingSince: null } as const;

  function setStatus(row: TaskRow, to: Status, extra: Partial<TaskRow> = {}) {
    assertTransition(row, to);
    const now = nowIso();
    const patch: Partial<TaskRow> = {
      status: to,
      updatedAt: now,
      ...(to !== "claimed" ? clearClaim : {}),
      ...(to !== "waiting" ? clearWaiting : {}),
      resolvedAt: RESOLVED_STATUSES.includes(to) ? now : null,
      ...extra,
    };
    db.update(tasks).set(patch).where(eq(tasks.id, row.id)).run();
  }

  function addNote(taskId: number, body: string, author: string) {
    db.insert(notes).values({ taskId, body, author, createdAt: nowIso() }).run();
  }

  // ----- People -----

  function allPeople(): PersonRow[] {
    return db.select().from(people).all();
  }

  /** Matches by handle first, then exact (case-insensitive) name; creates the Person if unknown. */
  function resolvePerson(ref: PersonRef): { person: PersonRow; role: string | null } {
    const now = nowIso();
    const everyone = allPeople();
    if (typeof ref === "string") {
      const value = ref.trim();
      const isHandle = value.startsWith("@");
      const key = normalizeHandle(value);
      const byHandle = everyone.find((p) => p.handles.some((h) => normalizeHandle(h) === key));
      if (byHandle) return { person: byHandle, role: null };
      if (!isHandle) {
        const byName = everyone.find((p) => p.name.toLowerCase() === value.toLowerCase());
        if (byName) return { person: byName, role: null };
      }
      const created = db
        .insert(people)
        .values({ name: isHandle ? value.slice(1) : value, handles: isHandle ? [value] : [], createdAt: now })
        .returning()
        .get();
      return { person: created, role: null };
    }
    const handles = ref.handles ?? [];
    const keys = handles.map(normalizeHandle);
    let match =
      everyone.find((p) => p.handles.some((h) => keys.includes(normalizeHandle(h)))) ??
      everyone.find((p) => p.name.toLowerCase() === ref.name.toLowerCase());
    if (match) {
      const known = match.handles.map(normalizeHandle);
      const added = handles.filter((h) => !known.includes(normalizeHandle(h)));
      // A Person first seen only as a handle gets their real name once someone supplies it.
      const nameWasHandle = known.includes(match.name.toLowerCase()) && match.name !== ref.name;
      if (added.length || nameWasHandle) {
        match = db
          .update(people)
          .set({ handles: [...match.handles, ...added], ...(nameWasHandle ? { name: ref.name } : {}) })
          .where(eq(people.id, match.id))
          .returning()
          .get();
      }
      return { person: match!, role: ref.role ?? null };
    }
    const created = db.insert(people).values({ name: ref.name, handles, createdAt: now }).returning().get();
    return { person: created, role: ref.role ?? null };
  }

  function linkPeople(taskId: number, refs: PersonRef[]) {
    for (const ref of refs) {
      const { person, role } = resolvePerson(ref);
      db.insert(taskPeople)
        .values({ taskId, personId: person.id, role })
        .onConflictDoUpdate({ target: [taskPeople.taskId, taskPeople.personId], set: { role } })
        .run();
    }
  }

  function insertSources(taskId: number, list: SourceInput[]) {
    const now = nowIso();
    for (const s of list) {
      db.insert(sources)
        .values({ taskId, url: s.url ?? null, summary: s.summary, createdAt: now, updatedAt: now })
        .run();
    }
  }

  function duplicateMatches(urls: string[]): DuplicateMatch[] {
    const unique = [...new Set(urls)];
    if (!unique.length) return [];
    const rows = db
      .select({ url: sources.url, task: tasks })
      .from(sources)
      .innerJoin(tasks, eq(sources.taskId, tasks.id))
      .where(inArray(sources.url, unique))
      .all();
    const byUrl = new Map<string, DuplicateMatch>();
    for (const r of rows) {
      const m = byUrl.get(r.url!) ?? { url: r.url!, tasks: [] };
      if (!m.tasks.some((t) => t.id === r.task.id)) {
        m.tasks.push({ id: r.task.id, title: r.task.title, status: statusOf(r.task), lane: r.task.lane });
      }
      byUrl.set(r.url!, m);
    }
    return [...byUrl.values()];
  }

  // ----- Initiative status (derived) -----

  function childrenRows(initiativeId: number): TaskRow[] {
    return db.select().from(tasks).where(eq(tasks.parentId, initiativeId)).all();
  }

  function statusOf(row: TaskRow, children?: TaskRow[]): Status {
    if (row.kind !== "initiative") return effectiveStatus(row);
    if (row.status === "dropped") return "dropped";
    const kids = children ?? childrenRows(row.id);
    if (kids.length && kids.every((k) => RESOLVED_STATUSES.includes(k.status))) return "done";
    return "open";
  }

  // ----- Summaries -----

  function summarize(rows: TaskRow[]): TaskSummary[] {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const todayStr = today();

    const peopleRows = db
      .select({ taskId: taskPeople.taskId, role: taskPeople.role, person: people })
      .from(taskPeople)
      .innerJoin(people, eq(taskPeople.personId, people.id))
      .where(inArray(taskPeople.taskId, ids))
      .all();
    const repoIds = [...new Set(rows.map((r) => r.repoId).filter((x): x is number => x != null))];
    const repoRows = repoIds.length ? db.select().from(repos).where(inArray(repos.id, repoIds)).all() : [];
    const parentIds = [...new Set(rows.map((r) => r.parentId).filter((x): x is number => x != null))];
    const parentRows = parentIds.length
      ? db.select({ id: tasks.id, title: tasks.title }).from(tasks).where(inArray(tasks.id, parentIds)).all()
      : [];
    const prepCounts = db
      .select({ taskId: preps.taskId, n: sql<number>`count(*)` })
      .from(preps)
      .where(inArray(preps.taskId, ids))
      .groupBy(preps.taskId)
      .all();
    const initiativeIds = rows.filter((r) => r.kind === "initiative").map((r) => r.id);
    const childRows = initiativeIds.length
      ? db.select().from(tasks).where(inArray(tasks.parentId, initiativeIds)).all()
      : [];

    return rows.map((r) => {
      const kids = childRows.filter((c) => c.parentId === r.id);
      const status = statusOf(r, kids);
      const active = isActive(status);
      return {
        id: r.id,
        kind: r.kind,
        title: r.title,
        lane: r.lane,
        status,
        priority: r.priority,
        dueDate: r.dueDate,
        overdue: active && r.dueDate != null && r.dueDate < todayStr,
        dueToday: active && r.dueDate === todayStr,
        parent: parentRows.find((p) => p.id === r.parentId) ?? null,
        repo: repoRows.find((x) => x.id === r.repoId)?.name ?? null,
        prUrl: r.prUrl,
        people: peopleRows
          .filter((p) => p.taskId === r.id)
          .map((p) => ({ id: p.person.id, name: p.person.name, handles: p.person.handles, role: p.role })),
        claimedBy: status === "claimed" ? r.claimedBy : null,
        claimedAt: status === "claimed" ? r.claimedAt : null,
        claimExpiresAt: status === "claimed" ? r.claimExpiresAt : null,
        waitingNote: r.waitingNote,
        waitingSince: r.waitingSince,
        prepCount: Number(prepCounts.find((p) => p.taskId === r.id)?.n ?? 0),
        progress:
          r.kind === "initiative"
            ? { resolved: kids.filter((k) => RESOLVED_STATUSES.includes(k.status)).length, total: kids.length }
            : null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        resolvedAt: r.resolvedAt,
      };
    });
  }

  function sortTasks<T extends TaskSummary>(list: T[]): T[] {
    return [...list].sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99") ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id - b.id,
    );
  }

  function followUpDue(row: TaskRow): boolean {
    if (row.status !== "waiting" || !row.waitingSince) return false;
    const days = row.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS;
    return clock.now().getTime() - Date.parse(row.waitingSince) > days * DAY_MS;
  }

  function detail(id: number): TaskDetail {
    const row = getRow(id);
    const [summary] = summarize([row]);
    const repo = row.repoId ? db.select().from(repos).where(eq(repos.id, row.repoId)).get() : undefined;
    return {
      ...summary,
      description: row.description,
      repoDetail: repo ? { name: repo.name, path: repo.path, remote: repo.remote } : null,
      sources: db
        .select()
        .from(sources)
        .where(eq(sources.taskId, id))
        .orderBy(asc(sources.id))
        .all()
        .map(({ taskId: _taskId, ...s }) => s),
      preps: db
        .select()
        .from(preps)
        .where(eq(preps.taskId, id))
        .orderBy(asc(preps.id))
        .all()
        .map(({ taskId: _taskId, ...p }) => p),
      laneChanges: db
        .select()
        .from(laneChanges)
        .where(eq(laneChanges.taskId, id))
        .orderBy(asc(laneChanges.id))
        .all()
        .map(({ taskId: _taskId, ...c }) => c),
      notes: db
        .select()
        .from(notes)
        .where(eq(notes.taskId, id))
        .orderBy(asc(notes.id))
        .all()
        .map(({ taskId: _taskId, ...n }) => n),
      children: row.kind === "initiative" ? sortTasks(summarize(childrenRows(id))) : [],
      followUpDays: row.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS,
      followUpDue: followUpDue(row),
    };
  }

  // ----- Capture -----

  function insertTask(input: TaskInput, parentId: number | null): number {
    if (input.lane === "delegate" && !input.repo) {
      throw new TodoError("REPO_REQUIRED", `Delegate Task "${input.title}" needs a registered Repo`, {
        title: input.title,
        known: db
          .select({ name: repos.name })
          .from(repos)
          .all()
          .map((r) => r.name),
      });
    }
    const repo = input.repo ? findRepo(input.repo) : null;
    const parent = input.parentId ?? parentId;
    if (parent != null) getInitiativeRow(parent);
    const now = nowIso();
    const row = db
      .insert(tasks)
      .values({
        kind: "task",
        title: input.title,
        description: input.description ?? "",
        lane: input.lane,
        status: "open",
        priority: input.priority ?? "normal",
        dueDate: input.dueDate ?? null,
        parentId: parent,
        repoId: repo?.id ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: tasks.id })
      .get();
    insertSources(row.id, input.sources ?? []);
    linkPeople(row.id, input.people ?? []);
    return row.id;
  }

  function insertInitiative(input: InitiativeInput): number {
    const now = nowIso();
    const row = db
      .insert(tasks)
      .values({
        kind: "initiative",
        title: input.title,
        description: input.description ?? "",
        lane: null,
        status: "open",
        priority: input.priority ?? "normal",
        dueDate: input.dueDate ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: tasks.id })
      .get();
    insertSources(row.id, input.sources ?? []);
    linkPeople(row.id, input.people ?? []);
    return row.id;
  }

  function rejectLaneOnInitiative(value: unknown) {
    if (value && typeof value === "object" && "lane" in value && (value as { lane?: unknown }).lane != null) {
      throw new TodoError("VALIDATION", "An Initiative has no Lane; put Lanes on its child Tasks", {});
    }
  }

  function checkDuplicates(urls: string[], force: boolean | undefined) {
    if (force) return;
    const matches = duplicateMatches(urls);
    if (matches.length) {
      throw new TodoError(
        "DUPLICATE_SOURCE",
        `Source already on file: ${matches.map((m) => m.url).join(", ")}. Update the existing Tasks, or pass force to add anyway.`,
        { matches },
      );
    }
  }

  function list(filters: ListFilters = {}): TaskSummary[] {
    const conds = [];
    if (filters.lane) conds.push(eq(tasks.lane, parse(z.enum(LANES), filters.lane)));
    if (filters.kind) conds.push(eq(tasks.kind, filters.kind));
    if (filters.initiativeId != null) conds.push(eq(tasks.parentId, filters.initiativeId));
    if (filters.repo) conds.push(eq(tasks.repoId, findRepo(filters.repo).id));
    if (filters.personId != null) {
      const ids = db
        .select({ id: taskPeople.taskId })
        .from(taskPeople)
        .where(eq(taskPeople.personId, filters.personId))
        .all()
        .map((r) => r.id);
      if (!ids.length) return [];
      conds.push(inArray(tasks.id, ids));
    }
    const rows = db
      .select()
      .from(tasks)
      .where(conds.length ? and(...conds) : undefined)
      .all();
    const wanted = filters.status
      ? (Array.isArray(filters.status) ? filters.status : [filters.status]).map((s) => parse(z.enum(STATUSES), s))
      : filters.includeResolved
        ? [...STATUSES]
        : [...ACTIVE_STATUSES];
    return sortTasks(summarize(rows).filter((t) => wanted.includes(t.status)));
  }

  const transaction = <T>(fn: () => T): T => db.$client.transaction(fn)();

  return {
    db,

    // ----- Capture -----

    /** Writes an optional Initiative plus Tasks atomically. Returns the created ids. */
    capture(raw: CaptureInput | unknown): { initiativeId: number | null; taskIds: number[] } {
      if (raw && typeof raw === "object" && "initiative" in raw)
        rejectLaneOnInitiative((raw as { initiative?: unknown }).initiative);
      const input = parse(captureInput, raw);
      const urls = [
        ...input.tasks.flatMap((t) => t.sources ?? []),
        ...(input.initiative && "title" in input.initiative ? (input.initiative.sources ?? []) : []),
      ]
        .map((s) => s.url)
        .filter((u): u is string => !!u);
      return transaction(() => {
        checkDuplicates(urls, input.force);
        let initiativeId: number | null = null;
        if (input.initiative) {
          initiativeId =
            "id" in input.initiative ? getInitiativeRow(input.initiative.id).id : insertInitiative(input.initiative);
        }
        const taskIds = input.tasks.map((t) => insertTask(t, initiativeId));
        return { initiativeId, taskIds };
      });
    },

    addTask(raw: TaskInput & { force?: boolean }): TaskDetail {
      const { force, ...rest } = (raw ?? {}) as TaskInput & { force?: boolean };
      const input = parse(taskInput, rest);
      const id = transaction(() => {
        checkDuplicates(
          (input.sources ?? []).map((s) => s.url).filter((u): u is string => !!u),
          force,
        );
        return insertTask(input, null);
      });
      return detail(id);
    },

    createInitiative(raw: InitiativeInput & { force?: boolean }): TaskDetail {
      rejectLaneOnInitiative(raw);
      const { force, ...rest } = (raw ?? {}) as InitiativeInput & { force?: boolean };
      const input = parse(initiativeInput, rest);
      const id = transaction(() => {
        checkDuplicates(
          (input.sources ?? []).map((s) => s.url).filter((u): u is string => !!u),
          force,
        );
        return insertInitiative(input);
      });
      return detail(id);
    },

    findBySourceUrl(url: string): TaskSummary[] {
      const ids = db
        .select({ id: sources.taskId })
        .from(sources)
        .where(eq(sources.url, url.trim()))
        .all()
        .map((r) => r.id);
      if (!ids.length) return [];
      return summarize(
        db
          .select()
          .from(tasks)
          .where(inArray(tasks.id, [...new Set(ids)]))
          .all(),
      );
    },

    addSource(taskId: number, raw: SourceInput): TaskDetail {
      const input = parse(sourceInput, raw);
      getRow(taskId);
      insertSources(taskId, [input]);
      db.update(tasks).set({ updatedAt: nowIso() }).where(eq(tasks.id, taskId)).run();
      return detail(taskId);
    },

    updateSourceSummary(sourceId: number, summary: string): TaskDetail {
      const text = parse(z.string().trim().min(1, "Source summary must not be empty"), summary);
      const src = db.select().from(sources).where(eq(sources.id, sourceId)).get();
      if (!src) throw notFound("Source", sourceId);
      const now = nowIso();
      db.update(sources).set({ summary: text, updatedAt: now }).where(eq(sources.id, sourceId)).run();
      db.update(tasks).set({ updatedAt: now }).where(eq(tasks.id, src.taskId)).run();
      return detail(src.taskId);
    },

    // ----- Edit -----

    updateTask(id: number, raw: TaskPatch): TaskDetail {
      const patch = parse(taskPatch, raw);
      const row = getRow(id);
      return transaction(() => {
        const set: Partial<TaskRow> = { updatedAt: nowIso() };
        if (patch.title !== undefined) set.title = patch.title;
        if (patch.description !== undefined) set.description = patch.description;
        if (patch.priority !== undefined) set.priority = patch.priority;
        if (patch.dueDate !== undefined) set.dueDate = patch.dueDate;
        if (patch.followUpDays !== undefined) set.followUpDays = patch.followUpDays;
        if (patch.repo !== undefined) {
          if (patch.repo === null && row.lane === "delegate") {
            throw new TodoError("REPO_REQUIRED", `Delegate Task ${id} must keep a Repo`, { id });
          }
          set.repoId = patch.repo === null ? null : findRepo(patch.repo).id;
        }
        if (patch.parentId !== undefined) {
          if (row.kind === "initiative" && patch.parentId !== null) {
            throw new TodoError("VALIDATION", "Initiatives cannot be nested", { id });
          }
          if (patch.parentId !== null) getInitiativeRow(patch.parentId);
          set.parentId = patch.parentId;
        }
        db.update(tasks).set(set).where(eq(tasks.id, id)).run();
        if (patch.people !== undefined) {
          db.delete(taskPeople).where(eq(taskPeople.taskId, id)).run();
          linkPeople(id, patch.people);
        }
        return detail(id);
      });
    },

    linkPeople(id: number, refs: PersonRef[]): TaskDetail {
      const list = parse(z.array(personRef), refs);
      getRow(id);
      transaction(() => linkPeople(id, list));
      return detail(id);
    },

    changeLane(id: number, raw: LaneChangeInput): TaskDetail {
      const input = parse(laneChangeInput, raw);
      const row = getTaskRow(id);
      if (row.lane === input.lane) {
        throw new TodoError("VALIDATION", `Task ${id} is already in the ${input.lane} Lane`, { id });
      }
      if (!isActive(effectiveStatus(row))) {
        throw new TodoError("INVALID_TRANSITION", `Task ${id} is ${effectiveStatus(row)}; reopen it first`, { id });
      }
      return transaction(() => {
        let repoId = row.repoId;
        if (input.repo) repoId = findRepo(input.repo).id;
        if (input.lane === "delegate" && repoId == null) {
          throw new TodoError("REPO_REQUIRED", `Moving Task ${id} to delegate needs a Repo`, {
            id,
            known: db
              .select({ name: repos.name })
              .from(repos)
              .all()
              .map((r) => r.name),
          });
        }
        const now = nowIso();
        db.insert(laneChanges)
          .values({
            taskId: id,
            fromLane: row.lane!,
            toLane: input.lane,
            reason: input.reason,
            actor: input.actor ?? "agent",
            createdAt: now,
          })
          .run();
        // A claimed Task returns to the pool in its new Lane.
        const wasClaimed = effectiveStatus(row) === "claimed";
        db.update(tasks)
          .set({
            lane: input.lane,
            repoId,
            updatedAt: now,
            ...(wasClaimed ? { status: "open" as Status, ...clearClaim } : {}),
          })
          .where(eq(tasks.id, id))
          .run();
        return detail(id);
      });
    },

    // ----- Work -----

    /** Atomically takes the best open Task in a Lane, or returns null when none is eligible. */
    claim(lane: Lane, worker = "worker"): TaskDetail | null {
      const l = parse(z.enum(LANES), lane);
      const who = parse(z.string().trim().min(1), worker);
      const id = transaction(() => {
        const now = nowIso();
        const candidates = db
          .select()
          .from(tasks)
          .where(and(eq(tasks.kind, "task"), eq(tasks.lane, l), inArray(tasks.status, ["open", "claimed"])))
          .all()
          .filter((r) => effectiveStatus(r) === "open")
          .sort(
            (a, b) =>
              PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
              (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99") ||
              a.createdAt.localeCompare(b.createdAt) ||
              a.id - b.id,
          );
        const pick = candidates[0];
        if (!pick) return null;
        if (pick.status === "claimed") addNote(pick.id, `Claim by ${pick.claimedBy} lapsed`, "system");
        db.update(tasks)
          .set({
            status: "claimed",
            claimedBy: who,
            claimedAt: now,
            claimExpiresAt: new Date(clock.now().getTime() + CLAIM_DURATION_MS).toISOString(),
            updatedAt: now,
          })
          .where(eq(tasks.id, pick.id))
          .run();
        return pick.id;
      });
      return id == null ? null : detail(id);
    },

    renewClaim(id: number, worker = "worker"): TaskDetail {
      const row = getTaskRow(id);
      if (row.status !== "claimed") {
        throw new TodoError("CLAIM_CONFLICT", `Task ${id} is not claimed`, { id, status: effectiveStatus(row) });
      }
      if (row.claimedBy !== worker) {
        throw new TodoError("CLAIM_CONFLICT", `Task ${id} is claimed by ${row.claimedBy}, not ${worker}`, {
          id,
          claimedBy: row.claimedBy,
        });
      }
      db.update(tasks)
        .set({
          claimExpiresAt: new Date(clock.now().getTime() + CLAIM_DURATION_MS).toISOString(),
          updatedAt: nowIso(),
        })
        .where(eq(tasks.id, id))
        .run();
      return detail(id);
    },

    /** Gives a claimed Task back to the pool, recording why. */
    release(id: number, note: string, author = "worker"): TaskDetail {
      const text = parse(z.string().trim().min(1, "A release note is required"), note);
      const row = getTaskRow(id);
      if (effectiveStatus(row) !== "claimed") {
        throw new TodoError("CLAIM_CONFLICT", `Task ${id} is not claimed`, { id, status: effectiveStatus(row) });
      }
      transaction(() => {
        setStatus(row, "open");
        addNote(id, text, author);
      });
      return detail(id);
    },

    attachPrep(id: number, raw: PrepInput): TaskDetail {
      const input = parse(prepInput, raw);
      const row = getTaskRow(id);
      if (!isActive(effectiveStatus(row))) {
        throw new TodoError("INVALID_TRANSITION", `Task ${id} is ${effectiveStatus(row)}; Preps go on active Tasks`, {
          id,
        });
      }
      transaction(() => {
        db.insert(preps)
          .values({
            taskId: id,
            kind: input.kind,
            body: input.body,
            author: input.author ?? "worker",
            createdAt: nowIso(),
          })
          .run();
        if (input.ready) setStatus(getRow(id), "ready");
        else db.update(tasks).set({ updatedAt: nowIso() }).where(eq(tasks.id, id)).run();
      });
      return detail(id);
    },

    /** Records a Delegate Task's PR and moves it to ready. */
    recordPr(id: number, url: string): TaskDetail {
      const prUrl = parse(z.string().trim().url("PR URL must be a URL"), url);
      const row = getTaskRow(id);
      if (row.lane !== "delegate") {
        throw new TodoError("VALIDATION", `Only delegate Tasks carry a PR; Task ${id} is ${row.lane}`, { id });
      }
      setStatus(row, "ready", { prUrl });
      return detail(id);
    },

    // ----- Lifecycle -----

    markReady(id: number): TaskDetail {
      setStatus(getTaskRow(id), "ready");
      return detail(id);
    },

    markDone(id: number): TaskDetail {
      const row = getRow(id);
      if (row.kind === "initiative") {
        throw new TodoError("VALIDATION", `Initiative ${id} is done automatically when all its children are resolved`, {
          id,
        });
      }
      setStatus(row, "done");
      return detail(id);
    },

    /** Drops a Task, or an Initiative together with its unresolved children. */
    drop(id: number, note?: string): TaskDetail {
      const row = getRow(id);
      transaction(() => {
        if (row.kind === "initiative") {
          const now = nowIso();
          db.update(tasks).set({ status: "dropped", updatedAt: now, resolvedAt: now }).where(eq(tasks.id, id)).run();
          for (const child of childrenRows(id)) {
            if (isActive(effectiveStatus(child))) setStatus(child, "dropped");
          }
        } else {
          setStatus(row, "dropped");
        }
        if (note?.trim()) addNote(id, note.trim(), "engineer");
      });
      return detail(id);
    },

    reopen(id: number, note?: string): TaskDetail {
      const row = getRow(id);
      transaction(() => {
        if (row.kind === "initiative") {
          db.update(tasks).set({ status: "open", updatedAt: nowIso(), resolvedAt: null }).where(eq(tasks.id, id)).run();
        } else {
          setStatus(row, "open");
        }
        if (note?.trim()) addNote(id, note.trim(), "engineer");
      });
      return detail(id);
    },

    setWaiting(id: number, raw: WaitingInput): TaskDetail {
      const input = parse(waitingInput, raw);
      const row = getTaskRow(id);
      setStatus(row, "waiting", {
        waitingNote: input.note,
        waitingSince: nowIso(),
        followUpDays: input.followUpDays ?? row.followUpDays ?? null,
      });
      return detail(id);
    },

    addNote(id: number, body: string, author = "engineer"): TaskDetail {
      const text = parse(z.string().trim().min(1, "Note must not be empty"), body);
      getRow(id);
      addNote(id, text, author);
      return detail(id);
    },

    /** Waiting Tasks that have waited longer than their follow-up threshold. */
    followUpsDue(): TaskSummary[] {
      const rows = db.select().from(tasks).where(eq(tasks.status, "waiting")).all().filter(followUpDue);
      return sortTasks(summarize(rows));
    },

    // ----- Sync -----

    /** Reconciles ready Delegate Tasks with their PR state: merged → done, closed → open. */
    async syncPrs(): Promise<SyncResult> {
      const rows = db
        .select()
        .from(tasks)
        .where(and(eq(tasks.lane, "delegate"), eq(tasks.status, "ready"), isNotNull(tasks.prUrl)))
        .all();
      const result: SyncResult = { merged: [], closed: [], unchanged: [], errors: [] };
      for (const row of rows) {
        const prUrl = row.prUrl!;
        let state;
        try {
          state = await prStatus.getState(prUrl);
        } catch (e) {
          result.errors.push({ id: row.id, prUrl, message: e instanceof Error ? e.message : String(e) });
          continue;
        }
        const entry = { id: row.id, title: row.title, prUrl };
        const fresh = getRow(row.id);
        if (fresh.status !== "ready" || fresh.prUrl !== prUrl) continue;
        if (state === "merged") {
          setStatus(fresh, "done");
          result.merged.push(entry);
        } else if (state === "closed") {
          transaction(() => {
            setStatus(fresh, "open", { prUrl: null });
            addNote(row.id, `PR closed without merging: ${prUrl}`, "system");
          });
          result.closed.push(entry);
        } else {
          result.unchanged.push(entry);
        }
      }
      return result;
    },

    // ----- Queries -----

    task(id: number): TaskDetail {
      return detail(id);
    },

    list(filters: ListFilters = {}): TaskSummary[] {
      return list(filters);
    },

    /** Ready Tasks plus high-priority, overdue and due-today active Tasks, grouped by Lane. */
    today(): TodayView {
      const rows = db
        .select()
        .from(tasks)
        .where(and(eq(tasks.kind, "task"), inArray(tasks.status, [...ACTIVE_STATUSES])))
        .all();
      const picked = summarize(rows)
        .map((t) => {
          const reasons: TodayReason[] = [];
          if (t.status === "ready") reasons.push("ready");
          if (t.priority === "high" && isActive(t.status)) reasons.push("high");
          if (t.overdue) reasons.push("overdue");
          if (t.dueToday) reasons.push("due-today");
          return { ...t, reasons };
        })
        .filter((t) => t.reasons.length > 0);
      const lanes = LANES.map((lane) => ({
        lane,
        name: LANE_INFO[lane].name,
        tasks: sortTasks(picked.filter((t) => t.lane === lane)),
      })).filter((g) => g.tasks.length);
      return { date: today(), total: picked.length, lanes };
    },

    initiatives(includeResolved = false): TaskSummary[] {
      const rows = db.select().from(tasks).where(eq(tasks.kind, "initiative")).orderBy(desc(tasks.createdAt)).all();
      const list = summarize(rows);
      return includeResolved ? list : list.filter((t) => isActive(t.status));
    },

    people(): PersonSummary[] {
      const everyone = db.select().from(people).orderBy(asc(people.name)).all();
      const links = db
        .select({ personId: taskPeople.personId, task: tasks })
        .from(taskPeople)
        .innerJoin(tasks, eq(taskPeople.taskId, tasks.id))
        .all();
      return everyone.map((p) => ({
        id: p.id,
        name: p.name,
        handles: p.handles,
        activeTaskCount: links.filter((l) => l.personId === p.id && isActive(statusOf(l.task))).length,
      }));
    },

    person(id: number): PersonSummary & { tasks: TaskSummary[] } {
      const p = db.select().from(people).where(eq(people.id, id)).get();
      if (!p) throw notFound("Person", id);
      const tasksForPerson = list({ personId: id });
      return {
        id: p.id,
        name: p.name,
        handles: p.handles,
        activeTaskCount: tasksForPerson.length,
        tasks: tasksForPerson,
      };
    },

    // ----- Repos -----

    registerRepo(raw: RepoInput): RepoRow {
      const input = parse(repoInput, raw);
      if (db.select().from(repos).where(eq(repos.name, input.name)).get()) {
        throw new TodoError("CONFLICT", `Repo "${input.name}" is already registered`, { name: input.name });
      }
      return db
        .insert(repos)
        .values({ name: input.name, path: input.path, remote: input.remote ?? null, createdAt: nowIso() })
        .returning()
        .get();
    },

    repos(): RepoRow[] {
      return db.select().from(repos).orderBy(asc(repos.name)).all();
    },

    removeRepo(name: string): void {
      const repo = findRepo(name);
      const using = db
        .select()
        .from(tasks)
        .where(eq(tasks.repoId, repo.id))
        .all()
        .filter((t) => isActive(effectiveStatus(t)));
      if (using.length) {
        throw new TodoError("CONFLICT", `Repo "${name}" is used by active Tasks`, {
          tasks: using.map((t) => ({ id: t.id, title: t.title })),
        });
      }
      transaction(() => {
        db.update(tasks).set({ repoId: null }).where(eq(tasks.repoId, repo.id)).run();
        db.delete(repos).where(eq(repos.id, repo.id)).run();
      });
    },

    // ----- Schema -----

    describe() {
      return describeSchema();
    },

    close() {
      db.$client.close();
    },
  };
}

/** Self-description emitted by `todo help --json`, so agent skills never restate it. */
export function describeSchema() {
  return {
    lanes: LANES.map((l) => LANE_INFO[l]),
    statuses: STATUSES.map((s) => ({ id: s, description: STATUS_DESCRIPTIONS[s], next: TRANSITIONS[s] })),
    priorities: PRIORITIES,
    prepKinds: PREP_KINDS,
    defaults: {
      priority: "normal",
      claimDurationHours: CLAIM_DURATION_MS / 3_600_000,
      followUpDays: DEFAULT_FOLLOW_UP_DAYS,
    },
    rules: [
      "Every Task except an Initiative has exactly one Lane.",
      "An Initiative has no Lane; it is done when all its children are done or dropped. Initiatives do not nest.",
      "Delegate Tasks must target a registered Repo.",
      "Adding a Task whose Source URL is already on file fails with DUPLICATE_SOURCE unless forced; prefer updating the existing Tasks.",
      "Changing a Lane requires a reason, which is recorded. A claimed Task returns to open in its new Lane.",
      "Claims expire after two hours unless renewed; expired claims count as open.",
      "Claim order: priority (high first), then due date (earliest first), then oldest.",
      "Workers draft; they never send messages to people on the engineer's behalf. Opening a PR for a Delegate Task is the only outward action.",
    ],
    captureInput: z.toJSONSchema(captureInput),
  };
}
