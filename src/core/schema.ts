import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import type { Actor, Lane, Priority, PrepKind, Status } from "./domain";

// Keep in sync with migrations.ts: migrations are hand-written SQL so the CLI bundle and
// the web app can apply them without locating migration files on disk.

export const repos = sqliteTable(
  "repos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    path: text("path").notNull(),
    remote: text("remote"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("repos_name_unique").on(t.name)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind").$type<"task" | "initiative">().notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    lane: text("lane").$type<Lane>(),
    status: text("status").$type<Status>().notNull(),
    priority: text("priority").$type<Priority>().notNull(),
    dueDate: text("due_date"),
    parentId: integer("parent_id"),
    repoId: integer("repo_id").references(() => repos.id),
    prUrl: text("pr_url"),
    claimedBy: text("claimed_by"),
    claimedAt: text("claimed_at"),
    claimExpiresAt: text("claim_expires_at"),
    waitingNote: text("waiting_note"),
    waitingSince: text("waiting_since"),
    followUpDays: integer("follow_up_days"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    resolvedAt: text("resolved_at"),
  },
  (t) => [index("tasks_lane_status").on(t.lane, t.status), index("tasks_parent").on(t.parentId)],
);

export const sources = sqliteTable(
  "sources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    url: text("url"),
    summary: text("summary").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("sources_url").on(t.url), index("sources_task").on(t.taskId)],
);

export const people = sqliteTable("people", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  handles: text("handles", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  createdAt: text("created_at").notNull(),
});

export const taskPeople = sqliteTable(
  "task_people",
  {
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    role: text("role"),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.personId] })],
);

export const preps = sqliteTable(
  "preps",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    kind: text("kind").$type<PrepKind>().notNull(),
    body: text("body").notNull(),
    author: text("author").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("preps_task").on(t.taskId)],
);

export const laneChanges = sqliteTable(
  "lane_changes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    fromLane: text("from_lane").$type<Lane>().notNull(),
    toLane: text("to_lane").$type<Lane>().notNull(),
    reason: text("reason").notNull(),
    actor: text("actor").$type<Actor>().notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("lane_changes_task").on(t.taskId)],
);

export const notes = sqliteTable(
  "notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    author: text("author").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("notes_task").on(t.taskId)],
);

export type TaskRow = typeof tasks.$inferSelect;
export type SourceRow = typeof sources.$inferSelect;
export type PersonRow = typeof people.$inferSelect;
export type RepoRow = typeof repos.$inferSelect;
export type PrepRow = typeof preps.$inferSelect;
export type LaneChangeRow = typeof laneChanges.$inferSelect;
export type NoteRow = typeof notes.$inferSelect;
