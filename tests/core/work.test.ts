import { describe, expect, it } from "vitest";
import { expectTodoError, setup } from "./helpers";

function withRepo() {
  const env = setup();
  env.core.registerRepo({ name: "billing", path: "/code/billing" });
  return env;
}

describe("claiming", () => {
  it("returns null when nothing in the Lane is open", () => {
    const { core } = setup();
    core.addTask({ title: "Other lane", lane: "review" });
    expect(core.claim("deep-work")).toBeNull();
  });

  it("takes the open Task and returns its full context", () => {
    const { core } = withRepo();
    const initiative = core.createInitiative({ title: "Billing v2" });
    const added = core.addTask({
      title: "Bump stripe",
      lane: "delegate",
      repo: "billing",
      parentId: initiative.id,
      sources: [{ url: "https://jira/B-1", summary: "Stripe SDK v12 is deprecated" }],
      people: ["@priya"],
    });
    const claimed = core.claim("delegate", "nightly")!;
    expect(claimed).toMatchObject({
      id: added.id,
      status: "claimed",
      claimedBy: "nightly",
      repoDetail: { name: "billing", path: "/code/billing", remote: null },
      parent: { id: initiative.id, title: "Billing v2" },
    });
    expect(claimed.sources[0].summary).toBe("Stripe SDK v12 is deprecated");
    expect(claimed.people[0].handles).toEqual(["@priya"]);
  });

  it("sets the claim to expire two hours after claiming", () => {
    const { core, clock } = setup();
    core.addTask({ title: "Investigate", lane: "deep-work" });
    const claimed = core.claim("deep-work")!;
    expect(Date.parse(claimed.claimExpiresAt!) - clock.now().getTime()).toBe(2 * 60 * 60 * 1000);
  });

  it("never hands the same Task to two Workers", () => {
    const { core } = setup();
    core.addTask({ title: "Only one", lane: "review" });
    expect(core.claim("review", "a")).not.toBeNull();
    expect(core.claim("review", "b")).toBeNull();
  });

  it("orders by priority, then due date, then age", () => {
    const { core, clock } = setup();
    const oldNormal = core.addTask({ title: "old normal", lane: "write" });
    clock.advanceHours(1);
    const newNormal = core.addTask({ title: "new normal", lane: "write" });
    clock.advanceHours(1);
    const dueLater = core.addTask({ title: "high due later", lane: "write", priority: "high", dueDate: "2026-11-01" });
    const dueSoon = core.addTask({ title: "high due soon", lane: "write", priority: "high", dueDate: "2026-10-20" });
    const highNoDate = core.addTask({ title: "high no date", lane: "write", priority: "high" });
    const low = core.addTask({ title: "low", lane: "write", priority: "low", dueDate: "2026-10-15" });
    const order = [1, 2, 3, 4, 5, 6].map(() => core.claim("write")!.id);
    expect(order).toEqual([dueSoon.id, dueLater.id, highNoDate.id, oldNormal.id, newNormal.id, low.id]);
  });

  it("only claims Tasks in the requested Lane, never Initiatives", () => {
    const { core } = setup();
    core.createInitiative({ title: "Initiative" });
    core.addTask({ title: "Align", lane: "align" });
    expect(core.claim("align")!.title).toBe("Align");
    expect(core.claim("align")).toBeNull();
  });

  it("lets a lapsed claim be claimed again", () => {
    const { core, clock } = setup();
    const task = core.addTask({ title: "Crashy", lane: "deep-work" });
    core.claim("deep-work", "a");
    clock.advanceHours(2);
    expect(core.task(task.id).status).toBe("open");
    const again = core.claim("deep-work", "b")!;
    expect(again).toMatchObject({ id: task.id, claimedBy: "b", status: "claimed" });
    expect(again.notes.map((n) => n.body)).toEqual(["Claim by a lapsed"]);
  });

  it("keeps a claim alive when renewed", () => {
    const { core, clock } = setup();
    const task = core.addTask({ title: "Long job", lane: "deep-work" });
    core.claim("deep-work", "a");
    clock.advanceHours(1.5);
    core.renewClaim(task.id, "a");
    clock.advanceHours(1.5);
    expect(core.task(task.id).status).toBe("claimed");
    expect(core.claim("deep-work", "b")).toBeNull();
  });

  it("refuses to renew another Worker's claim, or an unclaimed Task", () => {
    const { core } = setup();
    const task = core.addTask({ title: "Mine", lane: "deep-work" });
    expectTodoError(() => core.renewClaim(task.id, "a"), "CLAIM_CONFLICT");
    core.claim("deep-work", "a");
    expectTodoError(() => core.renewClaim(task.id, "b"), "CLAIM_CONFLICT");
  });

  it("releases a failed Task back to open with a note", () => {
    const { core } = setup();
    const task = core.addTask({ title: "Hard", lane: "review" });
    core.claim("review", "a");
    const released = core.release(task.id, "Could not access the doc", "a");
    expect(released).toMatchObject({ status: "open", claimedBy: null });
    expect(released.notes).toEqual([expect.objectContaining({ body: "Could not access the doc", author: "a" })]);
    expect(core.claim("review")!.id).toBe(task.id);
  });

  it("requires a note to release, and a claim to release", () => {
    const { core } = setup();
    const task = core.addTask({ title: "Hard", lane: "review" });
    expectTodoError(() => core.release(task.id, "why"), "CLAIM_CONFLICT");
    core.claim("review");
    expectTodoError(() => core.release(task.id, " "), "VALIDATION");
  });
});

describe("finishing work", () => {
  it("records a Delegate Task's PR and moves it to ready", () => {
    const { core } = withRepo();
    const task = core.addTask({ title: "Bump deps", lane: "delegate", repo: "billing" });
    core.claim("delegate");
    const done = core.recordPr(task.id, "https://github.com/acme/billing/pull/7");
    expect(done).toMatchObject({ status: "ready", prUrl: "https://github.com/acme/billing/pull/7", claimedBy: null });
  });

  it("only records PRs on Delegate Tasks", () => {
    const { core } = setup();
    const task = core.addTask({ title: "Investigate", lane: "deep-work" });
    expectTodoError(() => core.recordPr(task.id, "https://github.com/a/b/pull/1"), "VALIDATION");
  });

  it("attaches Preps, optionally moving the Task to ready", () => {
    const { core, clock } = setup();
    const task = core.addTask({ title: "Investigate p99", lane: "deep-work" });
    core.claim("deep-work");
    const first = core.attachPrep(task.id, { kind: "brief", body: "# Brief\n\nInitial map" });
    expect(first.status).toBe("claimed");
    clock.advanceHours(1);
    const second = core.attachPrep(task.id, { kind: "brief", body: "# Brief v2", author: "nightly", ready: true });
    expect(second.status).toBe("ready");
    expect(second.preps.map((p) => [p.kind, p.author, p.body])).toEqual([
      ["brief", "worker", "# Brief\n\nInitial map"],
      ["brief", "nightly", "# Brief v2"],
    ]);
    expect(second.prepCount).toBe(2);
  });

  it("refuses Preps on resolved Tasks and unknown Prep kinds", () => {
    const { core } = setup();
    const task = core.addTask({ title: "Reply", lane: "quick" });
    expectTodoError(() => core.attachPrep(task.id, { kind: "poem" as never, body: "x" }), "VALIDATION");
    core.markDone(task.id);
    expectTodoError(() => core.attachPrep(task.id, { kind: "reply-draft", body: "x" }), "INVALID_TRANSITION");
  });
});

describe("changing Lane", () => {
  it("requires a reason and records the change in the Task's history", () => {
    const { core } = withRepo();
    const task = core.addTask({ title: "Change auth flow", lane: "delegate", repo: "billing" });
    expectTodoError(() => core.changeLane(task.id, { lane: "align", reason: "" }), "VALIDATION");
    const moved = core.changeLane(task.id, { lane: "align", reason: "Needs a decision from security first" });
    expect(moved.lane).toBe("align");
    expect(moved.laneChanges).toEqual([
      expect.objectContaining({
        fromLane: "delegate",
        toLane: "align",
        reason: "Needs a decision from security first",
        actor: "agent",
      }),
    ]);
  });

  it("returns a claimed Task to open in its new Lane", () => {
    const { core } = withRepo();
    const task = core.addTask({ title: "Too big", lane: "delegate", repo: "billing" });
    core.claim("delegate", "w");
    const moved = core.changeLane(task.id, { lane: "deep-work", reason: "Touches three services", actor: "agent" });
    expect(moved).toMatchObject({ status: "open", claimedBy: null, lane: "deep-work" });
    expect(core.claim("deep-work")!.id).toBe(task.id);
  });

  it("records the engineer as the actor when they change it", () => {
    const { core } = setup();
    const task = core.addTask({ title: "Misfiled", lane: "write" });
    expect(
      core.changeLane(task.id, { lane: "review", reason: "It's Sam's doc", actor: "engineer" }).laneChanges[0].actor,
    ).toBe("engineer");
  });

  it("needs a Repo to move into the delegate Lane", () => {
    const { core } = withRepo();
    const task = core.addTask({ title: "Turned out simple", lane: "deep-work" });
    expectTodoError(() => core.changeLane(task.id, { lane: "delegate", reason: "Simple fix" }), "REPO_REQUIRED");
    const moved = core.changeLane(task.id, { lane: "delegate", reason: "Simple fix", repo: "billing" });
    expect(moved).toMatchObject({ lane: "delegate", repo: "billing" });
  });

  it("rejects a no-op change, a change on an Initiative, and a change on a resolved Task", () => {
    const { core } = setup();
    const task = core.addTask({ title: "x", lane: "write" });
    expectTodoError(() => core.changeLane(task.id, { lane: "write", reason: "same" }), "VALIDATION");
    const initiative = core.createInitiative({ title: "i" });
    expectTodoError(() => core.changeLane(initiative.id, { lane: "write", reason: "r" }), "VALIDATION");
    core.markDone(task.id);
    expectTodoError(() => core.changeLane(task.id, { lane: "quick", reason: "r" }), "INVALID_TRANSITION");
  });
});
