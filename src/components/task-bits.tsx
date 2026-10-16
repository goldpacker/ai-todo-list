// Small, server-safe display pieces for Tasks: Lane dot, status icon, priority marker, due label, people.
import clsx from "clsx";
import {
  Circle,
  CircleCheck,
  CircleDotDashed,
  CirclePause,
  CircleX,
  CircleArrowRight,
  type LucideIcon,
} from "lucide-react";
import { LANE_INFO, type Lane, type Priority, type Status } from "@/core/domain";
import { dueLabel, initials } from "@/lib/format";
import { LANE_COLOR, STATUS_LABEL } from "@/lib/ui-meta";
import { Dot } from "./ui/badge";

export function LaneDot({ lane, className, labelled }: { lane: Lane; className?: string; labelled?: boolean }) {
  return <Dot color={LANE_COLOR[lane]} className={className} label={labelled ? LANE_INFO[lane].name : undefined} />;
}

export function LaneTag({ lane }: { lane: Lane }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-ui text-muted">
      <LaneDot lane={lane} />
      {LANE_INFO[lane].name}
    </span>
  );
}

const STATUS_ICON: Record<Status, { icon: LucideIcon; className: string }> = {
  open: { icon: Circle, className: "text-subtle" },
  claimed: { icon: CircleDotDashed, className: "text-accent" },
  ready: { icon: CircleArrowRight, className: "text-accent" },
  waiting: { icon: CirclePause, className: "text-warn" },
  done: { icon: CircleCheck, className: "text-success" },
  dropped: { icon: CircleX, className: "text-subtle" },
};

export function StatusIcon({ status, className }: { status: Status; className?: string }) {
  const { icon: Icon, className: tone } = STATUS_ICON[status];
  return (
    <Icon
      role="img"
      aria-label={STATUS_LABEL[status]}
      strokeWidth={2}
      className={clsx("size-3.5 shrink-0", tone, className)}
    />
  );
}

export function StatusTag({ status }: { status: Status }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-ui text-fg">
      <StatusIcon status={status} />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Only high priority gets a mark; normal and low stay quiet. */
export function PriorityMark({ priority }: { priority: Priority }) {
  if (priority !== "high") return null;
  return (
    <span
      title="High priority"
      className="inline-flex shrink-0 items-center text-danger"
      aria-label="High priority"
      role="img"
    >
      <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
        <rect x="1.5" y="6" width="2" height="4.5" rx="0.6" fill="currentColor" />
        <rect x="5" y="3.75" width="2" height="6.75" rx="0.6" fill="currentColor" />
        <rect x="8.5" y="1.5" width="2" height="9" rx="0.6" fill="currentColor" />
      </svg>
    </span>
  );
}

export function DueLabel({
  dueDate,
  today,
  active = true,
}: {
  dueDate: string | null;
  today: string;
  active?: boolean;
}) {
  if (!dueDate) return null;
  const { text, tone } = dueLabel(dueDate, today);
  return (
    <span
      title={`Due ${dueDate}`}
      className={clsx(
        "shrink-0 text-xs whitespace-nowrap tabular-nums",
        !active
          ? "text-subtle"
          : tone === "overdue"
            ? "font-medium text-danger"
            : tone === "today"
              ? "font-medium text-warn"
              : "text-muted",
      )}
    >
      {active ? text : `Due ${dueDate}`}
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      title={name}
      className={clsx(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-avatar ring-2 ring-bg text-[9px] font-semibold tracking-wide text-muted",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function PeopleStack({ people, max = 3 }: { people: { id: number; name: string }[]; max?: number }) {
  if (!people.length) return null;
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="flex shrink-0 items-center -space-x-1.5" aria-label={people.map((p) => p.name).join(", ")}>
      {shown.map((p) => (
        <Avatar key={p.id} name={p.name} />
      ))}
      {extra > 0 && <span className="pl-2.5 text-2xs text-subtle">+{extra}</span>}
    </span>
  );
}

export function ProgressBar({ resolved, total, className }: { resolved: number; total: number; className?: string }) {
  const pct = total ? Math.round((resolved / total) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={resolved}
      aria-label={`${resolved} of ${total} resolved`}
      className={clsx("h-1 overflow-hidden rounded-full bg-active", className)}
    >
      <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}
