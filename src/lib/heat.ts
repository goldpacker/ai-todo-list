// Presentation over Task summaries: how pressing a Task looks on the board. Pure, so it is unit-tested
// without a database. No domain rules: priority, due dates and follow-ups come from the core.
import type { TaskSummary } from "@/core/core";
import { RESOLVED_STATUSES } from "@/core/domain";
import { daysBetween } from "./format";

/** hot: overdue, due within a day, or high priority due within a week. warm: due within a week, high, or a follow-up due. */
export type Heat = "hot" | "warm";

export interface HeatInfo {
  heat: Heat | null;
  /** Why, in a few words: "2d late", "due today", "high · in 3d", "6d quiet". Null when not heating up. */
  reason: string | null;
}

const NONE: HeatInfo = { heat: null, reason: null };

function dueText(diff: number): string {
  if (diff < 0) return `${-diff}d late`;
  if (diff === 0) return "due today";
  if (diff === 1) return "due tomorrow";
  return `in ${diff}d`;
}

export function heatOf(task: TaskSummary, today: string, followUpDue = false): HeatInfo {
  if (task.kind !== "task" || RESOLVED_STATUSES.includes(task.status)) return NONE;
  const diff = task.dueDate ? daysBetween(today, task.dueDate) : null;
  const high = task.priority === "high";

  if (diff !== null && diff <= 1) return { heat: "hot", reason: dueText(diff) };
  if (high && diff !== null && diff <= 7) return { heat: "hot", reason: `high · ${dueText(diff)}` };
  if (followUpDue && task.waitingSince) {
    const quiet = Math.max(0, daysBetween(task.waitingSince.slice(0, 10), today));
    return { heat: "warm", reason: `${quiet}d quiet · nudge` };
  }
  if (diff !== null && diff <= 7) return { heat: "warm", reason: dueText(diff) };
  if (high) return { heat: "warm", reason: "high" };
  return NONE;
}

export type HeatedTask = TaskSummary & { heat: Heat; reason: string };

/**
 * The few most pressing Tasks across every Lane: hot before warm, then soonest due, then high priority.
 * Claimed Tasks are left out because an agent is already on them.
 */
export function heatingUp(
  tasks: TaskSummary[],
  today: string,
  followUpDueIds: ReadonlySet<number>,
  limit = 6,
): { tasks: HeatedTask[]; total: number } {
  const heated: HeatedTask[] = [];
  for (const t of tasks) {
    if (t.status === "claimed") continue;
    const { heat, reason } = heatOf(t, today, followUpDueIds.has(t.id));
    if (heat && reason) heated.push({ ...t, heat, reason });
  }
  const dueRank = (t: TaskSummary) => (t.dueDate ? daysBetween(today, t.dueDate) : Number.POSITIVE_INFINITY);
  heated.sort(
    (a, b) =>
      Number(b.heat === "hot") - Number(a.heat === "hot") ||
      dueRank(a) - dueRank(b) ||
      Number(b.priority === "high") - Number(a.priority === "high") ||
      a.id - b.id,
  );
  return { tasks: heated.slice(0, limit), total: heated.length };
}
