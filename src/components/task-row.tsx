import Link from "next/link";
import clsx from "clsx";
import { Layers, MessageSquareText, GitPullRequest } from "lucide-react";
import type { TaskSummary, TodayReason } from "@/core/core";
import { ACTIVE_STATUSES } from "@/core/domain";
import { TODAY_REASON_LABEL } from "@/lib/ui-meta";
import { Badge } from "./ui/badge";
import { DueLabel, LaneDot, PeopleStack, PriorityMark, StatusIcon } from "./task-bits";

/** One Task as a compact, fully clickable row. */
export function TaskRow({
  task,
  today,
  showLane = false,
  showParent = true,
  reasons,
}: {
  task: TaskSummary;
  today: string;
  showLane?: boolean;
  showParent?: boolean;
  reasons?: TodayReason[];
}) {
  const active = ACTIVE_STATUSES.includes(task.status);
  // Overdue / due-today show through the due label and high priority through its mark; only "Ready" needs a badge.
  const badges = (reasons ?? []).filter((r) => r === "ready");
  return (
    <li>
      <Link
        href={`/tasks/${task.id}`}
        className="group flex min-h-10 items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-hover"
      >
        <StatusIcon status={task.status} />
        {showLane && task.lane && <LaneDot lane={task.lane} labelled />}
        {task.kind === "initiative" && <Layers aria-label="Initiative" className="size-3.5 shrink-0 text-subtle" />}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
          <span
            className={clsx("truncate text-sm", active ? "text-fg" : "text-muted line-through decoration-line-strong")}
          >
            {task.title}
          </span>
          {showParent && task.parent && (
            <span className="truncate text-xs text-subtle sm:max-w-[14rem]">{task.parent.title}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {badges.map((r) => (
            <Badge key={r} tone="accent" className="hidden sm:inline-flex">
              {TODAY_REASON_LABEL[r]}
            </Badge>
          ))}
          {task.status === "claimed" && task.claimedBy && (
            <span className="hidden text-xs text-subtle md:inline">{task.claimedBy}</span>
          )}
          {task.prUrl && <GitPullRequest aria-label="Has a PR" className="size-3.5 text-subtle" />}
          {task.prepCount > 0 && (
            <span
              className="hidden items-center gap-0.5 text-xs text-subtle sm:inline-flex"
              title={`${task.prepCount} Prep(s)`}
            >
              <MessageSquareText aria-hidden className="size-3.5" />
              {task.prepCount}
            </span>
          )}
          {task.progress && (
            <span className="text-xs text-subtle tabular-nums">
              {task.progress.resolved}/{task.progress.total}
            </span>
          )}
          <PriorityMark priority={task.priority} />
          <DueLabel dueDate={task.dueDate} today={today} active={active} />
          <span className="hidden sm:flex">
            <PeopleStack people={task.people} />
          </span>
        </span>
      </Link>
    </li>
  );
}

export function TaskList({ children }: { children: React.ReactNode }) {
  return <ul className="-mx-2 flex flex-col">{children}</ul>;
}
