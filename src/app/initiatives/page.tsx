import Link from "next/link";
import { Layers } from "lucide-react";
import type { TaskSummary } from "@/core/core";
import { readCore } from "@/lib/core";
import { toDateString } from "@/lib/format";
import { PageHeader, Section } from "@/components/section";
import { DuePill, PeopleStack, PriorityPill, ProgressBar } from "@/components/task-bits";
import { Pill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { NewTaskButton } from "@/components/shell-client";

export const metadata = { title: "Initiatives" };

function InitiativeCard({ initiative: i, today }: { initiative: TaskSummary; today: string }) {
  const progress = i.progress ?? { resolved: 0, total: 0 };
  const active = i.status !== "done" && i.status !== "dropped";
  return (
    <li>
      <Link
        href={`/initiatives/${i.id}`}
        className="flex h-full flex-col gap-3 rounded-2xl bg-surface0 p-4 transition-[background-color,transform] hover:-translate-y-px hover:bg-surface1/70"
      >
        <span className="flex flex-wrap items-center gap-1.5">
          {i.status === "done" && <Pill tone="green">done</Pill>}
          {i.status === "dropped" && <Pill>dropped</Pill>}
          <PriorityPill priority={i.priority} />
          <DuePill dueDate={i.dueDate} today={today} active={active} />
        </span>
        <span className={`font-display text-lg leading-snug font-bold ${active ? "" : "text-subtext0"}`}>
          {i.title}
        </span>
        <span className="mt-auto flex items-center gap-3">
          <ProgressBar resolved={progress.resolved} total={progress.total} className="flex-1" />
          <span className="text-xs font-semibold text-subtext0 tabular-nums">
            {progress.resolved}/{progress.total}
          </span>
          <PeopleStack people={i.people} />
        </span>
      </Link>
    </li>
  );
}

export default async function InitiativesPage() {
  const core = await readCore();
  const today = toDateString(new Date());
  const all = core.initiatives(true);
  const active = all.filter((i) => i.status !== "done" && i.status !== "dropped");
  const resolved = all.filter((i) => i.status === "done" || i.status === "dropped");

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Initiatives"
        meta={active.length}
        actions={<NewTaskButton request={{ kind: "initiative" }}>New Initiative</NewTaskButton>}
      >
        The bigger efforts. Each one wraps itself up once every Task inside is done or dropped.
      </PageHeader>
      {all.length === 0 ? (
        <EmptyState icon={<Layers />} title="No Initiatives yet">
          Your agent makes one when a capture turns into three or more related Tasks.
        </EmptyState>
      ) : (
        <>
          <Section title="In flight" count={active.length}>
            {active.length ? (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {active.map((i) => (
                  <InitiativeCard key={i.id} initiative={i} today={today} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-subtext0">Everything’s wrapped up. 🎉</p>
            )}
          </Section>
          {resolved.length > 0 && (
            <details className="group">
              <summary className="mb-3 inline-flex cursor-pointer items-center gap-2 font-display text-lg font-bold text-subtext0 hover:text-text">
                Wrapped up
                <span className="rounded-full bg-surface1 px-2 font-sans text-xs font-bold text-text">
                  {resolved.length}
                </span>
              </summary>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {resolved.map((i) => (
                  <InitiativeCard key={i.id} initiative={i} today={today} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
