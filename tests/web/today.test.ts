import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Core } from "@/core";
import { TodayContent } from "@/components/today-view";
import { buildTodayBoard, preppedCount } from "@/lib/today-board";
import { tempCore } from "./setup";

const NOW = new Date(2026, 9, 16, 9, 0, 0);

function render(core: Core) {
  const active = core.list({ kind: "task" });
  const board = buildTodayBoard({
    today: core.today(),
    active,
    followUpDueIds: new Set(core.followUpsDue().map((t) => t.id)),
  });
  return renderToStaticMarkup(
    createElement(TodayContent, {
      board,
      now: NOW,
      prepKinds: {},
      header: { greeting: "Good morning.", date: "2026-10-16", prepped: preppedCount(active) },
    }),
  );
}

describe("Today view", () => {
  it("renders the three-column board with greeting, lane pills and reasons", () => {
    const core = tempCore(NOW);
    core.registerRepo({ name: "payments-api", path: "/code/payments-api" });
    const review = core.addTask({ title: "Review Priya's failover PR", lane: "review", people: ["Priya Shah"] });
    core.attachPrep(review.id, { kind: "review-summary", body: "**Risky:** fail-open", ready: true });
    core.addTask({ title: "Postmortem for the webhook outage", lane: "write", priority: "high" });
    core.addTask({ title: "Reply to Elena about on-call", lane: "quick", dueDate: "2026-10-14" });
    core.addTask({ title: "Bump zod", lane: "delegate", repo: "payments-api" });
    const waiting = core.addTask({ title: "Agree on limits", lane: "align", people: ["Marcus Lee"] });
    core.setWaiting(waiting.id, { note: "Marcus to share numbers" });

    const html = render(core);

    expect(html).toContain("Good morning.");
    expect(html).toContain("Your move</span> on 3.");
    expect(html).toContain("Friday");
    expect(html).toContain("the agents prepped 1 thing");
    for (const column of ["Your move", "Agents on it", "Waiting on people"]) expect(html).toContain(column);
    expect(html).toContain("Review Priya&#x27;s failover PR");
    expect(html).toContain("2d late");
    expect(html).toContain(">high<");
    expect(html).toContain("Bump zod");
    expect(html).toContain("queued for the next run");
    expect(html).toContain("Marcus · asked today");
    expect(html).toContain('href="/tasks/');
  });

  it("shows playful empty columns when nothing is going on", () => {
    const html = render(tempCore(NOW));
    expect(html).toContain("Go touch grass");
    expect(html).toContain("Agents are idle");
    expect(html).toContain("Nobody owes you anything");
    expect(html).toContain("all quiet");
  });
});
