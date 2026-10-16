import { describe, expect, it } from "vitest";
import { createCore, describeSchema, LANES } from "@/core";
import { setup } from "./helpers";

function delegateReady(env: ReturnType<typeof setup>, title: string, prUrl: string) {
  const task = env.core.addTask({ title, lane: "delegate", repo: "web" });
  return env.core.recordPr(task.id, prUrl);
}

describe("PR sync", () => {
  it("marks merged PRs done, reopens closed ones with a note, and leaves open ones", async () => {
    const env = setup();
    env.core.registerRepo({ name: "web", path: "/code/web" });
    const merged = delegateReady(env, "merged", "https://github.com/a/web/pull/1");
    const closed = delegateReady(env, "closed", "https://github.com/a/web/pull/2");
    const open = delegateReady(env, "open", "https://github.com/a/web/pull/3");
    env.prs.states.set(merged.prUrl!, "merged");
    env.prs.states.set(closed.prUrl!, "closed");

    const result = await env.core.syncPrs();

    expect(result.merged.map((t) => t.id)).toEqual([merged.id]);
    expect(result.closed.map((t) => t.id)).toEqual([closed.id]);
    expect(result.unchanged.map((t) => t.id)).toEqual([open.id]);
    expect(env.core.task(merged.id).status).toBe("done");
    const reopened = env.core.task(closed.id);
    expect(reopened).toMatchObject({ status: "open", prUrl: null });
    expect(reopened.notes.map((n) => n.body)).toEqual(["PR closed without merging: https://github.com/a/web/pull/2"]);
    expect(env.core.task(open.id).status).toBe("ready");
  });

  it("reports PR lookups that fail without touching the Task", async () => {
    const env = setup();
    env.core.registerRepo({ name: "web", path: "/code/web" });
    const task = delegateReady(env, "x", "https://github.com/a/web/pull/9");
    env.prs.states.set(task.prUrl!, new Error("gh: not logged in"));
    const result = await env.core.syncPrs();
    expect(result.errors).toEqual([{ id: task.id, prUrl: task.prUrl, message: "gh: not logged in" }]);
    expect(env.core.task(task.id).status).toBe("ready");
  });

  it("ignores Delegate Tasks that are not ready", async () => {
    const env = setup();
    env.core.registerRepo({ name: "web", path: "/code/web" });
    const task = delegateReady(env, "x", "https://github.com/a/web/pull/4");
    env.core.setWaiting(task.id, { note: "CI is broken upstream" });
    env.prs.states.set("https://github.com/a/web/pull/4", "merged");
    expect((await env.core.syncPrs()).merged).toEqual([]);
  });
});

describe("follow-ups", () => {
  it("are due once a Task has waited longer than the default three days", () => {
    const { core, clock } = setup();
    const task = core.addTask({ title: "Schema sign-off", lane: "align" });
    core.setWaiting(task.id, { note: "Waiting on Priya" });
    clock.advanceDays(3);
    expect(core.followUpsDue()).toEqual([]);
    clock.advance(1);
    expect(core.followUpsDue().map((t) => t.id)).toEqual([task.id]);
    expect(core.task(task.id).followUpDue).toBe(true);
  });

  it("honour a per-Task threshold", () => {
    const { core, clock } = setup();
    const task = core.addTask({ title: "Quick answer", lane: "align" });
    core.setWaiting(task.id, { note: "Waiting on Sam", followUpDays: 1 });
    clock.advanceDays(1.5);
    expect(core.followUpsDue().map((t) => t.id)).toEqual([task.id]);
  });

  it("leave the queue once a follow-up Prep moves the Task to ready", () => {
    const { core, clock } = setup();
    const task = core.addTask({ title: "Schema sign-off", lane: "align" });
    core.setWaiting(task.id, { note: "Waiting on Priya" });
    clock.advanceDays(4);
    core.attachPrep(task.id, { kind: "follow-up", body: "Hi Priya, checking in on…", ready: true });
    expect(core.followUpsDue()).toEqual([]);
    expect(core.task(task.id).status).toBe("ready");
  });
});

describe("Today", () => {
  it("shows ready, high-priority, overdue and due-today Tasks grouped by Lane", () => {
    const { core } = setup("2026-10-14T09:00:00");
    const ready = core.addTask({ title: "ready review", lane: "review" });
    core.markReady(ready.id);
    const high = core.addTask({ title: "high align", lane: "align", priority: "high" });
    const overdue = core.addTask({ title: "overdue write", lane: "write", dueDate: "2026-10-13" });
    const dueToday = core.addTask({ title: "due today", lane: "write", dueDate: "2026-10-14" });
    core.addTask({ title: "not today", lane: "write", dueDate: "2026-10-15" });
    const finished = core.addTask({ title: "finished high", lane: "align", priority: "high" });
    core.markDone(finished.id);

    const today = core.today();

    expect(today.date).toBe("2026-10-14");
    expect(today.total).toBe(4);
    expect(today.lanes.map((l) => [l.lane, l.tasks.map((t) => [t.id, t.reasons])])).toEqual([
      [
        "write",
        [
          [overdue.id, ["overdue"]],
          [dueToday.id, ["due-today"]],
        ],
      ],
      ["review", [[ready.id, ["ready"]]]],
      ["align", [[high.id, ["high"]]]],
    ]);
  });

  it("treats a Task as overdue only after its due date passes", () => {
    const { core, clock } = setup("2026-10-14T23:00:00");
    const task = core.addTask({ title: "x", lane: "quick", dueDate: "2026-10-14" });
    expect(core.task(task.id)).toMatchObject({ overdue: false, dueToday: true });
    clock.advanceHours(2);
    expect(core.task(task.id)).toMatchObject({ overdue: true, dueToday: false });
  });

  it("is empty when nothing needs the engineer", () => {
    const { core } = setup();
    core.addTask({ title: "someday", lane: "deep-work", priority: "low" });
    expect(core.today()).toEqual({ date: "2026-10-14", total: 0, lanes: [] });
  });
});

describe("queries", () => {
  it("lists active Tasks by Lane, status, Person, Initiative and Repo", () => {
    const { core } = setup();
    core.registerRepo({ name: "web", path: "/code/web" });
    const initiative = core.createInitiative({ title: "i" });
    const a = core.addTask({ title: "a", lane: "align", people: ["@priya"], parentId: initiative.id });
    const b = core.addTask({ title: "b", lane: "delegate", repo: "web" });
    const c = core.addTask({ title: "c", lane: "align" });
    core.markDone(c.id);

    expect(core.list({ lane: "align" }).map((t) => t.id)).toEqual([a.id]);
    expect(core.list({ lane: "align", includeResolved: true }).map((t) => t.id)).toEqual([a.id, c.id]);
    expect(core.list({ status: "done" }).map((t) => t.id)).toEqual([c.id]);
    expect(core.list({ initiativeId: initiative.id }).map((t) => t.id)).toEqual([a.id]);
    expect(core.list({ repo: "web" }).map((t) => t.id)).toEqual([b.id]);
    const priya = core.people().find((p) => p.handles.includes("@priya"))!;
    expect(core.list({ personId: priya.id }).map((t) => t.id)).toEqual([a.id]);
    expect(core.person(priya.id).tasks.map((t) => t.id)).toEqual([a.id]);
    expect(core.list({ kind: "initiative" }).map((t) => t.id)).toEqual([initiative.id]);
  });

  it("shows who holds a claim and since when", () => {
    const { core, clock } = setup();
    const task = core.addTask({ title: "x", lane: "review" });
    core.claim("review", "nightly");
    expect(core.list({ status: "claimed" })).toEqual([
      expect.objectContaining({ id: task.id, claimedBy: "nightly", claimedAt: clock.now().toISOString() }),
    ]);
  });

  it("lists active Initiatives with progress", () => {
    const { core } = setup();
    const { initiativeId, taskIds } = core.capture({
      initiative: { title: "i" },
      tasks: [
        { title: "a", lane: "align" },
        { title: "b", lane: "align" },
      ],
    });
    core.markDone(taskIds[0]);
    expect(core.initiatives()).toEqual([
      expect.objectContaining({ id: initiativeId, progress: { resolved: 1, total: 2 } }),
    ]);
    core.markDone(taskIds[1]);
    expect(core.initiatives()).toEqual([]);
    expect(core.initiatives(true)).toHaveLength(1);
  });
});

describe("schema description", () => {
  it("describes every Lane, status and rule, and the capture input", () => {
    const schema = describeSchema();
    expect(schema.lanes.map((l) => l.id)).toEqual([...LANES]);
    for (const lane of schema.lanes) {
      expect(lane.description.length).toBeGreaterThan(20);
      expect(lane.examples.length).toBeGreaterThan(0);
    }
    expect(schema.statuses.find((s) => s.id === "done")!.next).toEqual(["open"]);
    expect(schema.captureInput).toMatchObject({ type: "object", required: ["tasks"] });
  });
});

describe("storage", () => {
  it("persists across reopening the same database file", () => {
    const { core, dbPath } = setup();
    const task = core.addTask({ title: "persisted", lane: "write" });
    const other = createCore({ dbPath });
    expect(other.task(task.id).title).toBe("persisted");
    other.close();
  });
});
