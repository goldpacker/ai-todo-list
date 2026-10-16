import { describe, expect, it } from "vitest";
import { expectTodoError, setup } from "./helpers";

describe("status transitions", () => {
  it("lets a Quick Task go straight from open to done", () => {
    const { core } = setup();
    const task = core.addTask({ title: "Approve access request", lane: "quick" });
    const done = core.markDone(task.id);
    expect(done.status).toBe("done");
    expect(done.resolvedAt).not.toBeNull();
  });

  it("records why a Task is done, with its author, when marking it done", () => {
    const { core } = setup();
    const task = core.addTask({ title: "Review Priya's PR", lane: "review" });
    const done = core.markDone(task.id, "PR #4821 merged on 2026-10-14", "sweeper-mbp");
    expect(done.status).toBe("done");
    expect(done.notes).toMatchObject([{ body: "PR #4821 merged on 2026-10-14", author: "sweeper-mbp" }]);
  });

  it("lets the engineer finish or drop a Task from any active status", () => {
    const { core } = setup();
    for (const lane of ["deep-work", "write", "review", "align"] as const) {
      const t = core.addTask({ title: `t-${lane}`, lane });
      core.claim(lane);
      expect(core.markDone(t.id).status).toBe("done");
    }
    const waiting = core.addTask({ title: "w", lane: "align" });
    core.setWaiting(waiting.id, { note: "Sam is checking with legal" });
    expect(core.drop(waiting.id, "No longer needed").status).toBe("dropped");
  });

  it("moves a Task to waiting with who/what it waits on, then back", () => {
    const { core, clock } = setup();
    const task = core.addTask({ title: "Get schema sign-off", lane: "align" });
    const waiting = core.setWaiting(task.id, { note: "Waiting on Priya's review", followUpDays: 5 });
    expect(waiting).toMatchObject({
      status: "waiting",
      waitingNote: "Waiting on Priya's review",
      waitingSince: clock.now().toISOString(),
      followUpDays: 5,
    });
    const reopened = core.reopen(task.id);
    expect(reopened).toMatchObject({ status: "open", waitingNote: null, waitingSince: null });
  });

  it("requires a waiting note", () => {
    const { core } = setup();
    const task = core.addTask({ title: "x", lane: "align" });
    expectTodoError(() => core.setWaiting(task.id, { note: "" }), "VALIDATION");
  });

  it("marks a Task ready", () => {
    const { core } = setup();
    const task = core.addTask({ title: "x", lane: "write" });
    expect(core.markReady(task.id).status).toBe("ready");
  });

  it("rejects transitions out of done and dropped other than reopening", () => {
    const { core } = setup();
    const task = core.addTask({ title: "x", lane: "quick" });
    core.markDone(task.id);
    expectTodoError(() => core.markReady(task.id), "INVALID_TRANSITION");
    expectTodoError(() => core.setWaiting(task.id, { note: "n" }), "INVALID_TRANSITION");
    expectTodoError(() => core.drop(task.id), "INVALID_TRANSITION");
    expectTodoError(() => core.markDone(task.id), "INVALID_TRANSITION");
    expect(core.reopen(task.id, "Turned out not finished")).toMatchObject({ status: "open", resolvedAt: null });
  });

  it("rejects marking a ready Task ready again and claiming a non-open Task", () => {
    const { core } = setup();
    const task = core.addTask({ title: "x", lane: "write" });
    core.markReady(task.id);
    expectTodoError(() => core.markReady(task.id), "INVALID_TRANSITION");
    expect(core.claim("write")).toBeNull();
  });

  it("clears the claim when a claimed Task moves on", () => {
    const { core } = setup();
    const task = core.addTask({ title: "x", lane: "review" });
    core.claim("review", "w");
    expect(core.markReady(task.id)).toMatchObject({ status: "ready", claimedBy: null, claimExpiresAt: null });
  });

  it("reports NOT_FOUND for unknown Tasks", () => {
    const { core } = setup();
    expectTodoError(() => core.task(999), "NOT_FOUND");
    expectTodoError(() => core.markDone(999), "NOT_FOUND");
  });

  it("records notes on a Task", () => {
    const { core } = setup();
    const task = core.addTask({ title: "x", lane: "review" });
    expect(core.addNote(task.id, "Pinged Sam").notes).toEqual([
      expect.objectContaining({ body: "Pinged Sam", author: "engineer" }),
    ]);
  });
});

describe("Initiatives", () => {
  function initiativeWithThree() {
    const env = setup();
    const { initiativeId, taskIds } = env.core.capture({
      initiative: { title: "Billing v2" },
      tasks: [
        { title: "a", lane: "align" },
        { title: "b", lane: "write" },
        { title: "c", lane: "review" },
      ],
    });
    return { ...env, initiativeId: initiativeId!, taskIds };
  }

  it("is done once every child is done or dropped", () => {
    const { core, initiativeId, taskIds } = initiativeWithThree();
    core.markDone(taskIds[0]);
    core.markDone(taskIds[1]);
    expect(core.task(initiativeId)).toMatchObject({ status: "open", progress: { resolved: 2, total: 3 } });
    core.drop(taskIds[2]);
    expect(core.task(initiativeId)).toMatchObject({ status: "done", progress: { resolved: 3, total: 3 } });
  });

  it("reopens when a child reopens", () => {
    const { core, initiativeId, taskIds } = initiativeWithThree();
    taskIds.forEach((id) => core.markDone(id));
    expect(core.task(initiativeId).status).toBe("done");
    core.reopen(taskIds[0]);
    expect(core.task(initiativeId).status).toBe("open");
  });

  it("stays open with no children", () => {
    const { core } = setup();
    expect(core.createInitiative({ title: "Empty" }).status).toBe("open");
  });

  it("cannot be marked done by hand", () => {
    const { core, initiativeId } = initiativeWithThree();
    expectTodoError(() => core.markDone(initiativeId), "VALIDATION");
  });

  it("drops its unresolved children when dropped", () => {
    const { core, initiativeId, taskIds } = initiativeWithThree();
    core.markDone(taskIds[0]);
    const dropped = core.drop(initiativeId, "Project cancelled");
    expect(dropped.status).toBe("dropped");
    expect(dropped.children.map((c) => c.status).sort()).toEqual(["done", "dropped", "dropped"]);
  });

  it("does not nest", () => {
    const { core, initiativeId } = initiativeWithThree();
    const other = core.createInitiative({ title: "Other" });
    expectTodoError(() => core.updateTask(other.id, { parentId: initiativeId }), "VALIDATION");
  });
});

describe("editing", () => {
  it("updates fields and clears the due date with null", () => {
    const { core } = setup();
    core.registerRepo({ name: "web", path: "/code/web" });
    const task = core.addTask({ title: "x", lane: "write", dueDate: "2026-10-20" });
    const edited = core.updateTask(task.id, {
      title: "Write the caching RFC",
      description: "Done means: circulated to the infra group",
      priority: "high",
      dueDate: null,
      repo: "web",
      people: ["@sam"],
    });
    expect(edited).toMatchObject({
      title: "Write the caching RFC",
      description: "Done means: circulated to the infra group",
      priority: "high",
      dueDate: null,
      repo: "web",
    });
    expect(edited.people.map((p) => p.handles[0])).toEqual(["@sam"]);
  });

  it("replaces People rather than appending", () => {
    const { core } = setup();
    const task = core.addTask({ title: "x", lane: "align", people: ["@a", "@b"] });
    expect(core.updateTask(task.id, { people: ["@c"] }).people.map((p) => p.handles[0])).toEqual(["@c"]);
  });

  it("keeps a Repo on Delegate Tasks", () => {
    const { core } = setup();
    core.registerRepo({ name: "web", path: "/code/web" });
    const task = core.addTask({ title: "x", lane: "delegate", repo: "web" });
    expectTodoError(() => core.updateTask(task.id, { repo: null }), "REPO_REQUIRED");
  });

  it("moves a Task into and out of an Initiative", () => {
    const { core } = setup();
    const initiative = core.createInitiative({ title: "i" });
    const task = core.addTask({ title: "x", lane: "write" });
    expect(core.updateTask(task.id, { parentId: initiative.id }).parent?.id).toBe(initiative.id);
    expect(core.updateTask(task.id, { parentId: null }).parent).toBeNull();
  });
});

describe("Repos", () => {
  it("registers, lists and removes Repos", () => {
    const { core } = setup();
    core.registerRepo({ name: "web", path: "/code/web", remote: "git@github.com:acme/web.git" });
    core.registerRepo({ name: "api", path: "/code/api" });
    expect(core.repos().map((r) => r.name)).toEqual(["api", "web"]);
    core.removeRepo("api");
    expect(core.repos().map((r) => r.name)).toEqual(["web"]);
  });

  it("rejects duplicate names and invalid names", () => {
    const { core } = setup();
    core.registerRepo({ name: "web", path: "/code/web" });
    expectTodoError(() => core.registerRepo({ name: "web", path: "/elsewhere" }), "CONFLICT");
    expectTodoError(() => core.registerRepo({ name: "has space", path: "/x" }), "VALIDATION");
  });

  it("refuses to remove a Repo that active Tasks use", () => {
    const { core } = setup();
    core.registerRepo({ name: "web", path: "/code/web" });
    const task = core.addTask({ title: "x", lane: "delegate", repo: "web" });
    expectTodoError(() => core.removeRepo("web"), "CONFLICT");
    core.markDone(task.id);
    core.removeRepo("web");
    expect(core.task(task.id).repo).toBeNull();
  });
});
