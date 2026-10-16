import { Sun } from "lucide-react";
import type { TodayView } from "@/core/core";
import { plural, shortDate } from "@/lib/format";
import { EmptyState } from "./ui/empty-state";
import { Kbd } from "./ui/badge";
import { PageHeader, Section } from "./section";
import { LaneDot } from "./task-bits";
import { TaskList, TaskRow } from "./task-row";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function longDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${shortDate(date)}`;
}

/** The Today view: Ready, high-priority, overdue and due-today Tasks grouped by Lane. Pure presentation. */
export function TodayContent({ view }: { view: TodayView }) {
  return (
    <>
      <PageHeader title="Today" meta={longDate(view.date)}>
        {view.total > 0
          ? `${plural(view.total, "Task")} need${view.total === 1 ? "s" : ""} you: ready for your move, high priority, or due.`
          : null}
      </PageHeader>
      {view.total === 0 ? (
        <EmptyState icon={<Sun />} title="Nothing needs you right now">
          Ready, urgent and due Tasks show up here. Ask your agent to capture something, run{" "}
          <code className="font-mono text-xs">todo add</code>, or press <Kbd>N</Kbd> to add a Task by hand.
        </EmptyState>
      ) : (
        view.lanes.map((group) => (
          <Section key={group.lane} title={group.name} icon={<LaneDot lane={group.lane} />} count={group.tasks.length}>
            <TaskList>
              {group.tasks.map((t) => (
                <TaskRow key={t.id} task={t} today={view.date} reasons={t.reasons} />
              ))}
            </TaskList>
          </Section>
        ))
      )}
    </>
  );
}
