// UI-only metadata layered on top of the core's domain vocabulary: colors, short labels and ordering.
// Safe for client components: it imports only the pure `domain` module, never the database.
import type { Lane, PrepKind, Status } from "@/core/domain";

/** CSS variable (defined in globals.css) holding each Lane's identity hue. */
export const LANE_COLOR: Record<Lane, string> = {
  delegate: "var(--lane-delegate)",
  "deep-work": "var(--lane-deep-work)",
  write: "var(--lane-write)",
  review: "var(--lane-review)",
  align: "var(--lane-align)",
  quick: "var(--lane-quick)",
};

export const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  claimed: "Claimed",
  ready: "Ready",
  waiting: "Waiting",
  done: "Done",
  dropped: "Dropped",
};

/** Order for grouping a Lane's active Tasks: what needs the engineer first. */
export const ACTIVE_STATUS_ORDER: Status[] = ["ready", "open", "claimed", "waiting"];

export const PREP_KIND_LABEL: Record<PrepKind, string> = {
  brief: "Research brief",
  outline: "Outline",
  "review-summary": "Review summary",
  "alignment-notes": "Alignment notes",
  "reply-draft": "Reply draft",
  "follow-up": "Follow-up draft",
};

export const TODAY_REASON_LABEL = {
  ready: "Ready",
  high: "High priority",
  overdue: "Overdue",
  "due-today": "Due today",
} as const;
