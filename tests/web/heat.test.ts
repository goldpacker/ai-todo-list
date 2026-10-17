import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TaskSummary } from "@/core/core";
import { HomeContent } from "@/components/home-view";
import { heatOf, heatingUp, type Heat } from "@/lib/heat";
import { tempCore } from "./setup";

const TODAY = "2026-10-16";

let nextId = 1;
function task(overrides: Partial<TaskSummary>): TaskSummary {
  return {
    id: nextId++,
    kind: "task",
    title: "T",
    lane: "write",
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
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    resolvedAt: null,
    ...overrides,
  };
}

describe("heatOf", () => {
  it.each([
    [{ dueDate: "2026-10-14" }, "hot", "2d late"],
    [{ dueDate: "2026-10-16" }, "hot", "due today"],
    [{ dueDate: "2026-10-17" }, "hot", "due tomorrow"],
    [{ dueDate: "2026-10-20", priority: "high" as const }, "hot", "high · in 4d"],
    [{ dueDate: "2026-10-21" }, "warm", "in 5d"],
    [{ priority: "high" as const }, "warm", "high"],
    [{ dueDate: "2026-10-30", priority: "high" as const }, "warm", "high"],
    [{ dueDate: "2026-10-30" }, null, null],
    [{}, null, null],
  ])("%o → %s", (overrides, heat, reason) => {
    expect(heatOf(task(overrides), TODAY)).toEqual({ heat, reason });
  });

  it("warms a Waiting Task whose follow-up is due, with how long it's been quiet", () => {
    const t = task({ status: "waiting", waitingSince: "2026-10-10T09:00:00Z" });
    expect(heatOf(t, TODAY, true)).toEqual({ heat: "warm", reason: "6d quiet · nudge" });
    expect(heatOf(t, TODAY, false)).toEqual({ heat: null, reason: null });
  });

  it("never heats resolved Tasks or Initiatives", () => {
    expect(heatOf(task({ status: "done", dueDate: "2026-10-01" }), TODAY).heat).toBeNull();
    expect(heatOf(task({ kind: "initiative", lane: null, priority: "high" }), TODAY).heat).toBeNull();
  });
});

describe("heatingUp", () => {
  it("ranks hot before warm, then soonest due, then high; skips claimed; caps the list", () => {
    const warmHigh = task({ priority: "high" });
    const warmSoon = task({ dueDate: "2026-10-22" });
    const hotLate = task({ dueDate: "2026-10-15" });
    const hotHigh = task({ dueDate: "2026-10-19", priority: "high" });
    const claimedLate = task({ dueDate: "2026-10-01", status: "claimed", claimedBy: "worker-1" });
    const cold = task({});

    const all = [warmHigh, warmSoon, hotLate, hotHigh, claimedLate, cold];
    expect(heatingUp(all, TODAY, new Set()).tasks.map((t) => t.id)).toEqual([
      hotLate.id,
      hotHigh.id,
      warmSoon.id,
      warmHigh.id,
    ]);
    expect(heatingUp(all, TODAY, new Set(), 2)).toMatchObject({
      total: 4,
      tasks: [{ id: hotLate.id }, { id: hotHigh.id }],
    });
  });
});

describe("Home view", () => {
  it("renders the greeting, the heat rail and every Lane column", () => {
    const core = tempCore(new Date(2026, 9, 16, 9, 0, 0));
    core.addTask({ title: "Postmortem for the webhook outage", lane: "write", dueDate: "2026-10-15" });
    core.addTask({ title: "Review Priya's failover PR", lane: "review", priority: "high" });
    core.addTask({ title: "Tidy the runbook", lane: "write" });
    const active = core.list({ kind: "task" });
    const heat = new Map<number, Heat>();
    for (const t of active) {
      const h = heatOf(t, TODAY).heat;
      if (h) heat.set(t.id, h);
    }

    const html = renderToStaticMarkup(
      createElement(HomeContent, {
        header: { greeting: "Good morning.", date: TODAY, prepped: 0 },
        rail: heatingUp(active, TODAY, new Set()),
        active,
        heat,
      }),
    );
    expect(html).toContain("things are heating up");
    expect(html).toContain("Heating up");
    expect(html).toContain("1d late");
    expect(html).toContain("Hot: ");
    expect(html).toContain("Warming up: ");
    for (const lane of ["Delegate", "Deep Work", "Write", "Review", "Align", "Quick"]) expect(html).toContain(lane);
    expect(html).toContain("Tidy the runbook");
  });

  it("says nothing is on fire when nothing is heating up", () => {
    const html = renderToStaticMarkup(
      createElement(HomeContent, {
        header: { greeting: "Good evening.", date: TODAY, prepped: 0 },
        rail: { tasks: [], total: 0 },
        active: [],
        heat: new Map(),
      }),
    );
    expect(html).toContain("on fire");
    expect(html).toContain("Pick whatever you like");
  });
});
