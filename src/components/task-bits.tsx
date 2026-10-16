// Small, server-safe display pieces for Tasks: Lane pill, status icon, priority and due pills, people.
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
import { LANE_COLOR, STATUS_LABEL, personColor } from "@/lib/ui-meta";
import { Pill } from "./ui/badge";

/** Lane identity: a solid pastel pill with dark text. */
export function LanePill({ lane, className }: { lane: Lane; className?: string }) {
  return (
    <Pill tone="none" className={clsx("text-on", className)} style={{ backgroundColor: LANE_COLOR[lane] }}>
      {LANE_INFO[lane].name}
    </Pill>
  );
}

export function LaneDot({ lane, className }: { lane: Lane; className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: LANE_COLOR[lane] }}
    />
  );
}

const STATUS_ICON: Record<Status, { icon: LucideIcon; className: string }> = {
  open: { icon: Circle, className: "text-overlay1" },
  claimed: { icon: CircleDotDashed, className: "text-green" },
  ready: { icon: CircleArrowRight, className: "text-mauve" },
  waiting: { icon: CirclePause, className: "text-peach" },
  done: { icon: CircleCheck, className: "text-green" },
  dropped: { icon: CircleX, className: "text-overlay1" },
};

export function StatusIcon({ status, className }: { status: Status; className?: string }) {
  const { icon: Icon, className: tone } = STATUS_ICON[status];
  return (
    <Icon
      role="img"
      aria-label={STATUS_LABEL[status]}
      strokeWidth={2.25}
      className={clsx("size-4 shrink-0", tone, className)}
    />
  );
}

export function StatusTag({ status }: { status: Status }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-text">
      <StatusIcon status={status} />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Only high priority gets a pill; normal and low stay quiet. */
export function PriorityPill({ priority }: { priority: Priority }) {
  if (priority !== "high") return null;
  return <Pill tone="redText">high</Pill>;
}

/** Overdue is a red pill, due today yellow text; later dates are plain muted pills. */
export function DuePill({
  dueDate,
  today,
  active = true,
}: {
  dueDate: string | null;
  today: string;
  active?: boolean;
}) {
  if (!dueDate || !active) return null;
  const { text, tone } = dueLabel(dueDate, today);
  const label = text.charAt(0).toLowerCase() + text.slice(1);
  if (tone === "overdue") return <Pill tone="red">{label}</Pill>;
  if (tone === "today") return <Pill tone="yellowText">{label}</Pill>;
  return <Pill>{label}</Pill>;
}

export function Avatar({
  name,
  colorKey,
  className,
}: {
  name: string;
  colorKey?: string | number;
  className?: string;
}) {
  return (
    <span
      title={name}
      style={{ backgroundColor: personColor(colorKey ?? name) }}
      className={clsx(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tracking-wide text-on",
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
        <Avatar key={p.id} name={p.name} colorKey={p.id} className="ring-2 ring-surface0" />
      ))}
      {extra > 0 && <span className="pl-2.5 text-2xs font-semibold text-subtext0">+{extra}</span>}
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
      className={clsx("h-2 overflow-hidden rounded-full bg-surface0", className)}
    >
      <div className="h-full rounded-full bg-mauve transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}
