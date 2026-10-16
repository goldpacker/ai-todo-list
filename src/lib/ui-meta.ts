// UI-only metadata layered on top of the core's domain vocabulary: Catppuccin Mocha colors, labels
// and microcopy. Safe for client components: it imports only the pure `domain` module.
import type { Lane, PrepKind, Status } from "@/core/domain";

/** Each Lane's identity color (CSS variables from the Mocha palette in globals.css). */
export const LANE_COLOR: Record<Lane, string> = {
  delegate: "var(--color-mauve)",
  "deep-work": "var(--color-blue)",
  write: "var(--color-teal)",
  review: "var(--color-yellow)",
  align: "var(--color-red)",
  quick: "var(--color-green)",
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

/** One-line context for a card whose latest Prep is of this kind. */
export const PREP_READY_LABEL: Record<PrepKind, string> = {
  brief: "Brief's ready",
  outline: "Outline's ready",
  "review-summary": "Review summary's ready",
  "alignment-notes": "Alignment notes are ready",
  "reply-draft": "Reply's drafted",
  "follow-up": "Nudge drafted",
};

/** What a Worker is doing on a claimed Task, by Lane ("worker-2 is coding #12"). */
export const WORKER_VERB: Record<Lane, string> = {
  delegate: "coding",
  "deep-work": "drafting a brief for",
  write: "outlining",
  review: "pre-reading",
  align: "prepping notes for",
  quick: "drafting a reply for",
};

/** Catppuccin accents used for People avatars, picked deterministically per person. */
const PERSON_COLORS = [
  "var(--color-pink)",
  "var(--color-peach)",
  "var(--color-sky)",
  "var(--color-teal)",
  "var(--color-yellow)",
  "var(--color-lavender)",
  "var(--color-green)",
  "var(--color-maroon)",
  "var(--color-sapphire)",
  "var(--color-flamingo)",
];

export function personColor(key: string | number): string {
  const s = String(key);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PERSON_COLORS[h % PERSON_COLORS.length];
}
