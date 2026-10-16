// Presentation over existing core queries: arranges Today into three board columns.
// Pure, so it is unit-tested without a database. No domain rules: statuses and reasons come from the core.
import type { TaskSummary, TodayReason, TodayView } from "@/core/core";
import type { Lane } from "@/core/domain";
import { WORKER_VERB } from "./ui-meta";

export type TodayTask = TaskSummary & { reasons: TodayReason[] };

export type AgentCard =
  { kind: "claimed"; task: TaskSummary } | { kind: "queued"; task: TaskSummary } | { kind: "pr"; task: TaskSummary };

export interface WaitingCard {
  task: TaskSummary;
  followUpDue: boolean;
}

export interface TodayBoard {
  yourMove: TodayTask[];
  agents: AgentCard[];
  waiting: WaitingCard[];
}

export interface TodayBoardInput {
  today: TodayView;
  /** Active Tasks: claimed ones, open and ready Delegate ones, and Waiting ones are picked from here. */
  active: TaskSummary[];
  /** Ids of Waiting Tasks past their follow-up threshold (core.followUpsDue()). */
  followUpDueIds: ReadonlySet<number>;
}

/**
 * Your move: Today's Tasks that aren't claimed or waiting, in the core's order.
 * Agents on it: claimed Tasks, then open Delegate Tasks queued for Workers, then ready Delegate Tasks with a PR.
 * Waiting on people: Waiting Tasks. Each Task appears in at most one column.
 */
export function buildTodayBoard({ today, active, followUpDueIds }: TodayBoardInput): TodayBoard {
  const yourMove = today.lanes.flatMap((g) => g.tasks).filter((t) => t.status !== "claimed" && t.status !== "waiting");
  const shown = new Set(yourMove.map((t) => t.id));
  const tasks = active.filter((t) => t.kind === "task");

  const agents: AgentCard[] = [];
  const take = (kind: AgentCard["kind"], list: TaskSummary[]) => {
    for (const task of list) {
      if (shown.has(task.id)) continue;
      shown.add(task.id);
      agents.push({ kind, task });
    }
  };
  take(
    "claimed",
    tasks.filter((t) => t.status === "claimed"),
  );
  take(
    "queued",
    tasks.filter((t) => t.lane === "delegate" && t.status === "open"),
  );
  take(
    "pr",
    tasks.filter((t) => t.lane === "delegate" && t.status === "ready" && t.prUrl),
  );

  const waiting = tasks
    .filter((t) => t.status === "waiting" && !shown.has(t.id))
    .map((task) => ({ task, followUpDue: followUpDueIds.has(task.id) }));

  return { yourMove, agents, waiting };
}

/** Ready Tasks the agents have prepared: a Prep is written or a PR is up. */
export function preppedCount(active: TaskSummary[]): number {
  return active.filter((t) => t.status === "ready" && (t.prepCount > 0 || t.prUrl)).length;
}

export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning.";
  if (hour >= 12 && hour < 17) return "Good afternoon.";
  if (hour >= 17 && hour < 23) return "Good evening.";
  return "Burning the midnight oil?";
}

/** "worker-2 is coding #12", "+2 more" when several are claimed, or "agents are idle". */
export function workerStatus(claimed: { id: number; lane: Lane | null; claimedBy: string | null }[]): {
  busy: boolean;
  text: string;
  more: number;
} {
  const first = claimed[0];
  if (!first) return { busy: false, text: "agents are idle", more: 0 };
  const verb = first.lane ? WORKER_VERB[first.lane] : "working on";
  return { busy: true, text: `${first.claimedBy ?? "a worker"} is ${verb} #${first.id}`, more: claimed.length - 1 };
}
