import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";
import { Layers } from "lucide-react";
import type { TaskSummary, TodayReason } from "@/core/core";
import type { Heat } from "@/lib/heat";
import { ACTIVE_STATUSES } from "@/core/domain";
import { Pill } from "./ui/badge";
import { DuePill, LanePill, PeopleStack, PriorityPill, StatusIcon } from "./task-bits";

export const HEAT_EDGE: Record<Heat, string> = {
  hot: "shadow-[inset_4px_0_0_var(--color-red)]",
  warm: "shadow-[inset_4px_0_0_var(--color-peach)]",
};

/** A Task as a rounded surface0 card: pills, title, one context line, people. A heat edge marks pressing ones. */
export function TaskCard({
  task,
  today,
  context,
  reasons,
  extraPills,
  showStatus = false,
  dashed = false,
  hideLane = false,
  heat = null,
}: {
  task: TaskSummary;
  today: string;
  context?: ReactNode;
  reasons?: TodayReason[];
  extraPills?: ReactNode;
  showStatus?: boolean;
  dashed?: boolean;
  hideLane?: boolean;
  heat?: Heat | null;
}) {
  const active = ACTIVE_STATUSES.includes(task.status);
  const isReady = reasons ? reasons.includes("ready") : false;
  return (
    <li className="list-none">
      <Link
        href={task.kind === "initiative" ? `/initiatives/${task.id}` : `/tasks/${task.id}`}
        className={clsx(
          "group relative flex flex-col gap-2.5 rounded-2xl bg-surface0 p-3.5 transition-[background-color,transform] hover:-translate-y-px hover:bg-surface1/70",
          dashed && "border-2 border-dashed border-green",
          heat && [HEAT_EDGE[heat], "pl-[18px]"],
        )}
      >
        {heat && <span className="sr-only">{heat === "hot" ? "Hot: " : "Warming up: "}</span>}
        <span className="flex flex-wrap items-center gap-1.5">
          {showStatus && <StatusIcon status={task.status} className="mr-0.5" />}
          {task.kind === "initiative" ? (
            <Pill tone="neutral">
              <Layers aria-hidden className="size-3" /> Initiative
            </Pill>
          ) : (
            task.lane && !hideLane && <LanePill lane={task.lane} />
          )}
          {isReady && <Pill tone="accent">ready</Pill>}
          <PriorityPill priority={task.priority} />
          <DuePill dueDate={task.dueDate} today={today} active={active} />
          {extraPills}
        </span>
        <span
          className={clsx(
            "text-[15px] leading-snug font-semibold",
            active ? "text-text" : "text-subtext0 line-through decoration-overlay0",
          )}
        >
          {task.title}
        </span>
        {(context || task.people.length > 0) && (
          <span className="flex min-w-0 items-center gap-2 text-ui text-subtext0">
            <PeopleStack people={task.people} />
            {context && <span className="min-w-0 truncate">{context}</span>}
          </span>
        )}
      </Link>
    </li>
  );
}

export function CardList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={clsx("flex flex-col gap-3", className)}>{children}</ul>;
}

/** A sensible default context line from summary fields alone. */
export function defaultContext(task: TaskSummary): string | undefined {
  if (task.status === "claimed" && task.claimedBy) return `${task.claimedBy} is on it`;
  if (task.status === "waiting" && task.waitingNote) return task.waitingNote;
  if (task.status === "ready" && task.prUrl) return "PR is up for review";
  if (task.progress) return `${task.progress.resolved} of ${task.progress.total} resolved`;
  if (task.parent) return task.parent.title;
  return undefined;
}
