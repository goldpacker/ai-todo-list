import { describe, expect, it } from "vitest";
import type { TaskSummary, TodayView } from "@/core/core";
import { buildTodayBoard, greeting, preppedCount, workerStatus } from "@/lib/today-board";

let nextId = 1;
function task(overrides: Partial<TaskSummary>): TaskSummary {
  return {
    id: nextId++,
    kind: "task",
    title: "T",
    lane: "quick",
    status: "open",
    priority: "normal",
    dueDate: null,
    overdue: false,
    dueToday: false,
    parent: null,
    repo: null,
    prUrl: null,
    people: [],
    claimedBy: null,
    claimedAt: null,
    claimExpiresAt: null,
    waitingNote: null,
    waitingSince: null,
    prepCount: 0,
    progress: null,
    createdAt: "2026-10-10T00:00:00Z",
    updatedAt: "2026-10-10T00:00:00Z",
    resolvedAt: null,
    ...overrides,
  };
}

function todayOf(
  tasks: (TaskSummary & { reasons: TodayView["lanes"][number]["tasks"][number]["reasons"] })[],
): TodayView {
  return { date: "2026-10-16", total: tasks.length, lanes: [{ lane: "quick", name: "Quick", tasks }] };
}

describe("buildTodayBoard", () => {
  it("puts each Task in exactly one column", () => {
    const readyReview = task({ lane: "review", status: "ready", prepCount: 1 });
    const claimedHigh = task({ lane: "deep-work", status: "claimed", priority: "high", claimedBy: "worker-2" });
    const waitingOverdue = task({ lane: "align", status: "waiting", overdue: true });
    const queued = task({ lane: "delegate", status: "open" });
    const pr = task({ lane: "delegate", status: "ready", prUrl: "https://github.com/a/b/pull/1" });
    const prHigh = task({
      lane: "delegate",
      status: "ready",
      prUrl: "https://github.com/a/b/pull/2",
      priority: "high",
    });
    const waiting = task({ lane: "align", status: "waiting" });

    const board = buildTodayBoard({
      today: todayOf([
        { ...readyReview, reasons: ["ready"] },
        { ...claimedHigh, reasons: ["high"] },
        { ...waitingOverdue, reasons: ["overdue"] },
        { ...prHigh, reasons: ["ready", "high"] },
        { ...pr, reasons: ["ready"] },
      ]),
      active: [readyReview, claimedHigh, waitingOverdue, queued, pr, prHigh, waiting],
      followUpDueIds: new Set([waiting.id]),
    });

    expect(board.yourMove.map((t) => t.id)).toEqual([readyReview.id, prHigh.id, pr.id]);
    expect(board.agents.map((a) => [a.kind, a.task.id])).toEqual([
      ["claimed", claimedHigh.id],
      ["queued", queued.id],
    ]);
    expect(board.waiting.map((w) => [w.task.id, w.followUpDue])).toEqual([
      [waitingOverdue.id, false],
      [waiting.id, true],
    ]);
  });

  it("lists ready Delegate PRs under the agents when they aren't already your move", () => {
    const pr = task({ lane: "delegate", status: "ready", prUrl: "https://github.com/a/b/pull/3" });
    const board = buildTodayBoard({ today: todayOf([]), active: [pr], followUpDueIds: new Set() });
    expect(board.agents).toEqual([{ kind: "pr", task: pr }]);
  });

  it("counts prepared Ready Tasks", () => {
    expect(
      preppedCount([
        task({ status: "ready", prepCount: 2 }),
        task({ status: "ready", prUrl: "https://x/pull/1" }),
        task({ status: "ready" }),
        task({ status: "open", prepCount: 1 }),
      ]),
    ).toBe(2);
  });
});

describe("greeting", () => {
  it("follows the local time of day", () => {
    expect(greeting(8)).toBe("Good morning.");
    expect(greeting(13)).toBe("Good afternoon.");
    expect(greeting(19)).toBe("Good evening.");
    expect(greeting(2)).toBe("Burning the midnight oil?");
  });
});

describe("workerStatus", () => {
  it("describes the first claim by Lane, with a count of the rest", () => {
    expect(workerStatus([])).toEqual({ busy: false, text: "agents are idle", more: 0 });
    expect(
      workerStatus([
        { id: 13, lane: "delegate", claimedBy: "worker-2" },
        { id: 4, lane: "review", claimedBy: "worker-3" },
      ]),
    ).toEqual({ busy: true, text: "worker-2 is coding #13", more: 1 });
    expect(workerStatus([{ id: 7, lane: "deep-work", claimedBy: "w" }]).text).toBe("w is drafting a brief for #7");
  });
});
