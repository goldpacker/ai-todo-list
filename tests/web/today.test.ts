import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TodayContent } from "@/components/today-view";
import { tempCore } from "./setup";

describe("Today view", () => {
  it("renders Ready, high-priority, overdue and due-today Tasks grouped by Lane", () => {
    const core = tempCore();
    core.registerRepo({ name: "payments-api", path: "/code/payments-api" });
    const review = core.addTask({ title: "Review Priya's failover PR", lane: "review", people: ["Priya Shah"] });
    core.attachPrep(review.id, { kind: "review-summary", body: "**Risky:** fail-open", ready: true });
    core.addTask({ title: "Postmortem for the webhook outage", lane: "write", priority: "high" });
    core.addTask({ title: "Reply to Elena about on-call", lane: "quick", dueDate: "2026-10-14" });
    core.addTask({ title: "Approve access request", lane: "quick", dueDate: "2026-10-16" });
    core.addTask({ title: "Bump zod", lane: "delegate", repo: "payments-api" });

    const html = renderToStaticMarkup(createElement(TodayContent, { view: core.today() }));

    expect(html).toContain("Today");
    expect(html).toContain("Friday, Oct 16");
    for (const lane of ["Write", "Review", "Quick"]) expect(html).toContain(lane);
    expect(html).toContain("Review Priya&#x27;s failover PR");
    expect(html).toContain("Postmortem for the webhook outage");
    expect(html).toContain("Overdue 2d");
    expect(html).toContain("Due today");
    expect(html).toContain('href="/tasks/');
    // An open, normal-priority Task with no due date doesn't need the engineer today.
    expect(html).not.toContain("Bump zod");
    expect(html).not.toContain("Delegate");
  });

  it("shows a calm empty state when nothing needs the engineer", () => {
    const core = tempCore();
    const html = renderToStaticMarkup(createElement(TodayContent, { view: core.today() }));
    expect(html).toContain("Nothing needs you right now");
    expect(html).toContain("todo add");
  });
});
