// Domain vocabulary. Terms match GLOSSARY.md; descriptions here are what agents see via `todo help --json`.

export const LANES = ["delegate", "deep-work", "write", "review", "align", "quick"] as const;
export type Lane = (typeof LANES)[number];

export const STATUSES = ["open", "claimed", "ready", "waiting", "done", "dropped"] as const;
export type Status = (typeof STATUSES)[number];

export const ACTIVE_STATUSES: readonly Status[] = ["open", "claimed", "ready", "waiting"];
export const RESOLVED_STATUSES: readonly Status[] = ["done", "dropped"];

export const PRIORITIES = ["high", "normal", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PREP_KINDS = [
  "brief",
  "outline",
  "review-summary",
  "alignment-notes",
  "reply-draft",
  "follow-up",
] as const;
export type PrepKind = (typeof PREP_KINDS)[number];

export const ACTORS = ["engineer", "agent"] as const;
export type Actor = (typeof ACTORS)[number];

export const CLAIM_DURATION_MS = 2 * 60 * 60 * 1000;
export const DEFAULT_FOLLOW_UP_DAYS = 3;

export interface LaneInfo {
  id: Lane;
  name: string;
  description: string;
  whoActs: string;
  workerAction: string;
  prepKind: PrepKind | null;
  examples: string[];
}

export const LANE_INFO: Record<Lane, LaneInfo> = {
  delegate: {
    id: "delegate",
    name: "Delegate",
    description:
      "A well-scoped code change an agent can complete end to end, ending in a PR for the engineer to review. Requires a Repo.",
    whoActs: "A Worker agent",
    workerAction: "Implement the change in the Task's Repo, open a PR, record the PR URL and mark the Task ready.",
    prepKind: null,
    examples: [
      "Fix a bug with a clear reproduction",
      "Bump a dependency and fix the resulting breakages",
      "Add missing tests for a module",
      "Small, fully specified feature or config change",
      "Mechanical cleanup or rename",
    ],
  },
  "deep-work": {
    id: "deep-work",
    name: "Deep Work",
    description: "Complex implementation, debugging or investigation that needs the engineer's focused time.",
    whoActs: "The engineer, in a focus block",
    workerAction:
      "Write a research brief: map the relevant code, prior attempts, open questions and candidate approaches.",
    prepKind: "brief",
    examples: [
      "Hard debugging or a performance investigation",
      "A spike to evaluate a technical approach",
      "Complex implementation across several systems",
      "Root-causing a flaky or intermittent failure",
    ],
  },
  write: {
    id: "write",
    name: "Write",
    description: "Authoring a document such as a design doc, RFC, strategy or postmortem.",
    whoActs: "The engineer, as author",
    workerAction: "Draft an outline or skeleton from the Sources, with the gaps the engineer must fill marked.",
    prepKind: "outline",
    examples: ["Design doc or RFC", "Technical strategy or roadmap", "Postmortem", "Migration plan"],
  },
  review: {
    id: "review",
    name: "Review",
    description: "Reading and judging someone else's work, such as a PR, design doc or RFC.",
    whoActs: "The engineer, as reviewer",
    workerAction: "Pre-read the work and summarise what changed, the risky areas and suggested questions.",
    prepKind: "review-summary",
    examples: ["Review a colleague's PR", "Review a design doc or RFC", "Architecture review"],
  },
  align: {
    id: "align",
    name: "Align",
    description:
      "Work that needs a conversation with one or more people, to get details, unblock, decide or build consensus.",
    whoActs: "The engineer, with the linked People",
    workerAction:
      "Write alignment notes: who to talk to, what is known, the decision needed, questions to ask and a draft opening message.",
    prepKind: "alignment-notes",
    examples: [
      "Get missing details from a ticket's author",
      "Drive agreement on an approach across teams",
      "Unblock a colleague or escalate a blocker",
      "Negotiate scope or priority",
    ],
  },
  quick: {
    id: "quick",
    name: "Quick",
    description: "A short action that only the engineer can do, taking under about fifteen minutes.",
    whoActs: "The engineer, between meetings",
    workerAction: "Draft the reply if there is one; otherwise leave the Task alone.",
    prepKind: "reply-draft",
    examples: ["Reply to a question", "Approve or sign off on something", "Fill in a form"],
  },
};

export const STATUS_DESCRIPTIONS: Record<Status, string> = {
  open: "Captured, and nobody has started on it.",
  claimed:
    "A Worker has taken the Task, so no other Worker will pick it up. The claim lapses after two hours unless renewed.",
  ready: "The next move is the engineer's: the Prep is written, or the PR is up for review.",
  waiting: "Blocked on someone other than the engineer.",
  done: "Finished.",
  dropped: "Deliberately abandoned.",
};

/** Allowed status transitions for Tasks (Initiatives derive their status). */
export const TRANSITIONS: Record<Status, readonly Status[]> = {
  open: ["claimed", "ready", "waiting", "done", "dropped"],
  claimed: ["open", "ready", "waiting", "done", "dropped"],
  ready: ["open", "waiting", "done", "dropped"],
  waiting: ["open", "ready", "done", "dropped"],
  done: ["open"],
  dropped: ["open"],
};

export const PRIORITY_RANK: Record<Priority, number> = { high: 0, normal: 1, low: 2 };
