import { describe, expect, it } from "vitest";
import { expectTodoError, setup } from "./helpers";

describe("capture", () => {
  it("writes a Task with its Lane, priority, due date, Sources and People", () => {
    const { core } = setup();
    const task = core.addTask({
      title: "Reply to Priya about rate limits",
      lane: "quick",
      priority: "high",
      dueDate: "2026-10-20",
      sources: [{ url: "https://slack.com/archives/C1/p1", summary: "Priya asked whether the limit is per org" }],
      people: ["@priya"],
    });
    expect(task).toMatchObject({
      kind: "task",
      lane: "quick",
      status: "open",
      priority: "high",
      dueDate: "2026-10-20",
    });
    expect(task.sources).toEqual([
      expect.objectContaining({
        url: "https://slack.com/archives/C1/p1",
        summary: "Priya asked whether the limit is per org",
      }),
    ]);
    expect(task.people.map((p) => p.handles)).toEqual([["@priya"]]);
  });

  it("defaults priority to normal", () => {
    const { core } = setup();
    expect(core.addTask({ title: "Read RFC", lane: "review" }).priority).toBe("normal");
  });

  it("requires exactly one valid Lane on a Task", () => {
    const { core } = setup();
    expectTodoError(() => core.addTask({ title: "No lane" } as never), "VALIDATION");
    expectTodoError(() => core.addTask({ title: "Bad lane", lane: "someday" } as never), "VALIDATION");
  });

  it("rejects an empty title and an invalid due date", () => {
    const { core } = setup();
    expectTodoError(() => core.addTask({ title: "  ", lane: "quick" }), "VALIDATION");
    expectTodoError(() => core.addTask({ title: "x", lane: "quick", dueDate: "next friday" }), "VALIDATION");
  });

  it("accepts a Source with only a summary, for conversational captures", () => {
    const { core } = setup();
    const task = core.addTask({
      title: "Sketch the on-call rotation",
      lane: "write",
      sources: [{ summary: "Conversation with the engineer on 2026-10-14" }],
    });
    expect(task.sources[0]).toMatchObject({ url: null, summary: "Conversation with the engineer on 2026-10-14" });
  });

  it("rejects a Delegate Task without a Repo", () => {
    const { core } = setup();
    const err = expectTodoError(() => core.addTask({ title: "Bump deps", lane: "delegate" }), "REPO_REQUIRED");
    expect(err.details).toMatchObject({ known: [] });
  });

  it("rejects a Delegate Task naming an unregistered Repo, listing the known ones", () => {
    const { core } = setup();
    core.registerRepo({ name: "billing", path: "/code/billing" });
    const err = expectTodoError(
      () => core.addTask({ title: "Bump deps", lane: "delegate", repo: "payments" }),
      "NOT_FOUND",
    );
    expect(err.details).toMatchObject({ known: ["billing"] });
  });

  it("files a Delegate Task against a registered Repo by short name", () => {
    const { core } = setup();
    core.registerRepo({ name: "billing", path: "/code/billing" });
    const task = core.addTask({ title: "Bump deps", lane: "delegate", repo: "billing" });
    expect(task.repo).toBe("billing");
    expect(task.repoDetail).toEqual({ name: "billing", path: "/code/billing", remote: null });
  });

  describe("atomic bulk capture", () => {
    it("writes an Initiative with child Tasks in one call", () => {
      const { core } = setup();
      const { initiativeId, taskIds } = core.capture({
        initiative: { title: "Migrate billing to v2" },
        tasks: [
          { title: "Agree on cutover date", lane: "align" },
          { title: "Write migration plan", lane: "write" },
          { title: "Review data model PR", lane: "review" },
        ],
      });
      expect(taskIds).toHaveLength(3);
      const initiative = core.task(initiativeId!);
      expect(initiative).toMatchObject({ kind: "initiative", lane: null, status: "open" });
      expect(initiative.children.map((c) => c.id).sort()).toEqual(taskIds.sort());
      expect(initiative.progress).toEqual({ resolved: 0, total: 3 });
    });

    it("writes nothing when any Task is invalid", () => {
      const { core } = setup();
      expectTodoError(
        () =>
          core.capture({
            initiative: { title: "Half-written" },
            tasks: [
              { title: "Fine", lane: "align" },
              { title: "Delegate without repo", lane: "delegate" },
            ],
          }),
        "REPO_REQUIRED",
      );
      expect(core.list({ includeResolved: true })).toEqual([]);
      expect(core.initiatives(true)).toEqual([]);
    });

    it("adds new Tasks to an existing Initiative", () => {
      const { core } = setup();
      const initiative = core.createInitiative({ title: "Billing v2" });
      const { initiativeId, taskIds } = core.capture({
        initiative: { id: initiative.id },
        tasks: [{ title: "Follow-up work", lane: "deep-work" }],
      });
      expect(initiativeId).toBe(initiative.id);
      expect(core.task(taskIds[0]).parent).toEqual({ id: initiative.id, title: "Billing v2" });
    });

    it("rejects an Initiative given a Lane", () => {
      const { core } = setup();
      expectTodoError(() => core.createInitiative({ title: "x", lane: "align" } as never), "VALIDATION");
      expectTodoError(
        () =>
          core.capture({ initiative: { title: "x", lane: "align" }, tasks: [{ title: "y", lane: "quick" }] } as never),
        "VALIDATION",
      );
    });

    it("rejects filing a Task under something that is not an Initiative", () => {
      const { core } = setup();
      const plain = core.addTask({ title: "Plain", lane: "quick" });
      expectTodoError(() => core.addTask({ title: "Child", lane: "quick", parentId: plain.id }), "VALIDATION");
    });

    it("requires at least one Task", () => {
      const { core } = setup();
      expectTodoError(() => core.capture({ tasks: [] }), "VALIDATION");
    });
  });

  describe("duplicate Sources", () => {
    const url = "https://slack.com/archives/C1/p42";

    it("refuses a Task whose Source URL is already on file and lists the existing Tasks", () => {
      const { core } = setup();
      const first = core.addTask({ title: "Original", lane: "align", sources: [{ url, summary: "v1" }] });
      const err = expectTodoError(
        () => core.addTask({ title: "Again", lane: "align", sources: [{ url, summary: "v2" }] }),
        "DUPLICATE_SOURCE",
      );
      expect(err.details).toEqual({
        matches: [{ url, tasks: [{ id: first.id, title: "Original", status: "open", lane: "align" }] }],
      });
      expect(core.list()).toHaveLength(1);
    });

    it("refuses a bulk capture containing a known Source URL, writing nothing", () => {
      const { core } = setup();
      core.addTask({ title: "Original", lane: "align", sources: [{ url, summary: "v1" }] });
      expectTodoError(
        () =>
          core.capture({
            tasks: [
              { title: "New", lane: "quick" },
              { title: "Dup", lane: "quick", sources: [{ url, summary: "v2" }] },
            ],
          }),
        "DUPLICATE_SOURCE",
      );
      expect(core.list()).toHaveLength(1);
    });

    it("adds anyway when forced", () => {
      const { core } = setup();
      core.addTask({ title: "Original", lane: "align", sources: [{ url, summary: "v1" }] });
      core.addTask({ title: "Genuinely new", lane: "quick", sources: [{ url, summary: "v2" }], force: true });
      expect(
        core
          .findBySourceUrl(url)
          .map((t) => t.title)
          .sort(),
      ).toEqual(["Genuinely new", "Original"]);
    });

    it("lets several Tasks in one capture share a new Source", () => {
      const { core } = setup();
      const { taskIds } = core.capture({
        tasks: [
          { title: "A", lane: "quick", sources: [{ url, summary: "s" }] },
          { title: "B", lane: "align", sources: [{ url, summary: "s" }] },
        ],
      });
      expect(taskIds).toHaveLength(2);
    });

    it("finds Tasks by Source URL and refreshes a Source's summary", () => {
      const { core, clock } = setup();
      const task = core.addTask({ title: "Original", lane: "align", sources: [{ url, summary: "v1" }] });
      expect(core.findBySourceUrl(url).map((t) => t.id)).toEqual([task.id]);
      expect(core.findBySourceUrl("https://elsewhere")).toEqual([]);
      clock.advanceHours(1);
      const updated = core.updateSourceSummary(task.sources[0].id, "v2: thread moved on, decision made");
      expect(updated.sources[0].summary).toBe("v2: thread moved on, decision made");
      expect(updated.sources[0].updatedAt > updated.sources[0].createdAt).toBe(true);
    });

    it("adds a Source to an existing Task", () => {
      const { core } = setup();
      const task = core.addTask({ title: "Original", lane: "align" });
      expect(core.addSource(task.id, { url: "https://jira/T-1", summary: "ticket" }).sources).toHaveLength(1);
    });
  });

  describe("People", () => {
    it("creates unknown People and reuses known ones by handle or name", () => {
      const { core } = setup();
      core.addTask({ title: "A", lane: "align", people: ["@priya", "Sam Lee"] });
      core.addTask({ title: "B", lane: "review", people: ["@Priya", "sam lee"] });
      const everyone = core.people();
      expect(everyone).toHaveLength(2);
      expect(everyone.map((p) => p.activeTaskCount)).toEqual([2, 2]);
    });

    it("records a Person's role on a Task and merges new handles", () => {
      const { core } = setup();
      core.addTask({ title: "A", lane: "align", people: ["Priya Shah"] });
      const task = core.addTask({
        title: "Review Priya's RFC",
        lane: "review",
        people: [{ name: "Priya Shah", handles: ["@priya"], role: "author" }],
      });
      expect(task.people).toEqual([
        expect.objectContaining({ name: "Priya Shah", handles: ["@priya"], role: "author" }),
      ]);
      expect(core.people()).toHaveLength(1);
    });

    it("upgrades a Person first known only by handle when their name is given", () => {
      const { core } = setup();
      core.addTask({ title: "A", lane: "align", people: ["@priya"] });
      core.addTask({ title: "B", lane: "align", people: [{ name: "Priya Shah", handles: ["@priya"] }] });
      expect(core.people()).toEqual([expect.objectContaining({ name: "Priya Shah", handles: ["@priya"] })]);
    });
  });
});

describe("Source URL matching", () => {
  it("treats URLs differing only by fragment or trailing slash as the same Source", () => {
    const { core } = setup();
    const task = core.addTask({
      title: "Original",
      lane: "review",
      sources: [{ url: "https://github.com/acme/web/pull/7/", summary: "PR" }],
    });
    expectTodoError(
      () =>
        core.addTask({
          title: "Again",
          lane: "review",
          sources: [{ url: "https://github.com/acme/web/pull/7#issuecomment-123", summary: "PR" }],
        }),
      "DUPLICATE_SOURCE",
    );
    expect(core.findBySourceUrl("https://github.com/acme/web/pull/7")).toEqual([
      expect.objectContaining({ id: task.id, sourceIds: [task.sources[0].id] }),
    ]);
  });
});

describe("capture results and Person lookup", () => {
  it("returns summaries of the created Tasks in input order", () => {
    const { core } = setup();
    const result = core.capture({
      tasks: [
        { title: "first", lane: "write" },
        { title: "second", lane: "quick", priority: "high" },
      ],
    });
    expect(result.tasks.map((t) => [t.id, t.title, t.lane, t.priority])).toEqual([
      [result.taskIds[0], "first", "write", "normal"],
      [result.taskIds[1], "second", "quick", "high"],
    ]);
  });

  it("finds a Person by id, handle or name without creating one", () => {
    const { core } = setup();
    core.addTask({ title: "x", lane: "align", people: [{ name: "Priya Shah", handles: ["@priya"] }] });
    const priya = core.people()[0];
    expect(core.findPerson(priya.id)).toMatchObject({ id: priya.id, activeTaskCount: 1 });
    expect(core.findPerson(String(priya.id))?.id).toBe(priya.id);
    expect(core.findPerson("@Priya")?.id).toBe(priya.id);
    expect(core.findPerson("priya shah")?.id).toBe(priya.id);
    expect(core.findPerson("@nobody")).toBeNull();
    expect(core.findPerson("Nobody")).toBeNull();
    expect(core.people()).toHaveLength(1);
  });
});
