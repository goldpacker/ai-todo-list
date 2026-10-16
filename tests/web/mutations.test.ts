import { describe, expect, it } from "vitest";
import * as m from "@/lib/mutations";
import { form, tempCore } from "./setup";

// The web app's Server Actions forward form fields through these functions to the core.
describe("web mutations", () => {
  it("adds a Task by hand with Source, People and Initiative", () => {
    const core = tempCore();
    const initiative = m.createInitiative(core, form({ title: "Rate limiter migration" }));
    expect(initiative.ok).toBe(true);

    const res = m.addTask(
      core,
      form({
        title: "Agree on defaults",
        lane: "align",
        priority: "high",
        dueDate: "2026-10-20",
        people: "Marcus Lee, @dana",
        sourceUrl: "https://slack.example/p1",
        sourceSummary: "Marcus owns the defaults",
        parentId: initiative.id!,
      }),
    );
    expect(res.ok).toBe(true);
    const task = core.task(res.id!);
    expect(task).toMatchObject({ lane: "align", priority: "high", dueDate: "2026-10-20" });
    expect(task.parent?.id).toBe(initiative.id);
    expect(task.people.map((p) => p.name).sort()).toEqual(["Marcus Lee", "dana"]);
    expect(task.sources[0]).toMatchObject({ url: "https://slack.example/p1", summary: "Marcus owns the defaults" });
  });

  it("surfaces core validation as field errors", () => {
    const core = tempCore();
    const missingRepo = m.addTask(core, form({ title: "Fix bug", lane: "delegate" }));
    expect(missingRepo.ok).toBe(false);
    expect(missingRepo.fieldErrors?.repo).toMatch(/Repo/);

    const noTitle = m.addTask(core, form({ title: "", lane: "quick" }));
    expect(noTitle.fieldErrors?.title).toBeTruthy();

    const noSummary = m.addTask(core, form({ title: "T", lane: "quick", sourceUrl: "https://x.example" }));
    expect(noSummary.fieldErrors?.sourceSummary).toBeTruthy();
  });

  it("reports duplicate Sources and adds anyway when forced", () => {
    const core = tempCore();
    const fields = { title: "Reply", lane: "quick", sourceUrl: "https://slack.example/p9", sourceSummary: "ctx" };
    expect(m.addTask(core, form(fields)).ok).toBe(true);
    const dup = m.addTask(core, form(fields));
    expect(dup.ok).toBe(false);
    expect(dup.duplicates?.[0].tasks).toHaveLength(1);
    expect(m.addTask(core, form({ ...fields, force: "1" })).ok).toBe(true);
  });

  it("runs the lifecycle: Waiting, ready, done, reopen, drop", () => {
    const core = tempCore();
    const { id } = core.addTask({ title: "Ask Marcus", lane: "align" });
    expect(m.setWaiting(core, form({ id, note: "Marcus to reply", followUpDays: 2 })).ok).toBe(true);
    expect(core.task(id)).toMatchObject({ status: "waiting", waitingNote: "Marcus to reply", followUpDays: 2 });
    expect(m.markReady(core, form({ id })).ok).toBe(true);
    expect(m.markDone(core, form({ id })).ok).toBe(true);
    expect(core.task(id).status).toBe("done");
    expect(m.reopen(core, form({ id })).ok).toBe(true);
    expect(m.drop(core, form({ id, note: "No longer needed" })).ok).toBe(true);
    expect(core.task(id).status).toBe("dropped");
    expect(core.task(id).notes.map((n) => n.body)).toContain("No longer needed");

    const invalid = m.markReady(core, form({ id }));
    expect(invalid).toMatchObject({ ok: false });
    expect(invalid.message).toMatch(/cannot move/);
  });

  it("changes Lane as the engineer, requiring a Repo for Delegate", () => {
    const core = tempCore();
    core.registerRepo({ name: "web-console", path: "/code/web" });
    const { id } = core.addTask({ title: "Flaky test", lane: "deep-work" });
    const noRepo = m.changeLane(core, form({ id, lane: "delegate", reason: "It's mechanical" }));
    expect(noRepo.fieldErrors?.repo).toBeTruthy();
    const noReason = m.changeLane(core, form({ id, lane: "quick", reason: "" }));
    expect(noReason.fieldErrors?.reason).toBeTruthy();

    expect(m.changeLane(core, form({ id, lane: "delegate", reason: "It's mechanical", repo: "web-console" })).ok).toBe(
      true,
    );
    const task = core.task(id);
    expect(task).toMatchObject({ lane: "delegate", repo: "web-console" });
    expect(task.laneChanges[0]).toMatchObject({ fromLane: "deep-work", toLane: "delegate", actor: "engineer" });
  });

  it("edits fields, clearing the due date and replacing People", () => {
    const core = tempCore();
    const { id } = core.addTask({ title: "Old", lane: "write", dueDate: "2026-10-20", people: ["Priya Shah"] });
    const res = m.updateTask(
      core,
      form({ id, title: "New title", description: "Body", priority: "low", dueDate: "", repo: "", people: "@elena" }),
    );
    expect(res.ok).toBe(true);
    expect(core.task(id)).toMatchObject({ title: "New title", description: "Body", priority: "low", dueDate: null });
    expect(core.task(id).people.map((p) => p.handles)).toEqual([["@elena"]]);
  });

  it("adds a note as the engineer", () => {
    const core = tempCore();
    const { id } = core.addTask({ title: "T", lane: "quick" });
    expect(m.addNote(core, form({ id, body: "Pinged on Slack" })).ok).toBe(true);
    expect(core.task(id).notes[0]).toMatchObject({ body: "Pinged on Slack", author: "engineer" });
    expect(m.addNote(core, form({ id, body: " " }))).toMatchObject({ ok: false, message: "Note must not be empty" });
  });

  it("parses comma-separated People", () => {
    expect(m.parsePeople(" Priya Shah, @marcus ,, ")).toEqual(["Priya Shah", "@marcus"]);
  });
});
