import Link from "next/link";
import { Layers } from "lucide-react";
import type { TaskSummary } from "@/core/core";
import { readCore } from "@/lib/core";
import { toDateString } from "@/lib/format";
import { PageHeader, Section } from "@/components/section";
import { DueLabel, PeopleStack, PriorityMark, ProgressBar, StatusIcon } from "@/components/task-bits";
import { EmptyState } from "@/components/ui/empty-state";
import { NewTaskButton } from "@/components/shell-client";

export const metadata = { title: "Initiatives" };

function InitiativeRow({ initiative: i, today }: { initiative: TaskSummary; today: string }) {
  const progress = i.progress ?? { resolved: 0, total: 0 };
  const active = i.status !== "done" && i.status !== "dropped";
  return (
    <li>
      <Link
        href={`/initiatives/${i.id}`}
        className="flex flex-col gap-2 rounded-md px-2 py-2.5 transition-colors hover:bg-hover sm:flex-row sm:items-center sm:gap-4"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <StatusIcon status={i.status} />
          <span className={active ? "truncate text-sm text-fg" : "truncate text-sm text-muted"}>{i.title}</span>
          <PriorityMark priority={i.priority} />
        </span>
        <span className="flex shrink-0 items-center gap-3 pl-6 sm:pl-0">
          <DueLabel dueDate={i.dueDate} today={today} active={active} />
          <PeopleStack people={i.people} />
          <span className="flex w-36 items-center gap-2">
            <ProgressBar resolved={progress.resolved} total={progress.total} className="flex-1" />
            <span className="w-9 text-right text-xs text-subtle tabular-nums">
              {progress.resolved}/{progress.total}
            </span>
          </span>
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
    <>
      <PageHeader
        title="Initiatives"
        meta={active.length || undefined}
        actions={<NewTaskButton request={{ kind: "initiative" }}>New Initiative</NewTaskButton>}
      >
        Larger efforts grouping related Tasks. An Initiative is done once every child is done or dropped.
      </PageHeader>
      {all.length === 0 ? (
        <EmptyState icon={<Layers />} title="No Initiatives yet">
          Your agent creates one when a capture produces three or more related Tasks.
        </EmptyState>
      ) : (
        <>
          <Section title="Active" count={active.length}>
            {active.length ? (
              <ul className="-mx-2 flex flex-col">
                {active.map((i) => (
                  <InitiativeRow key={i.id} initiative={i} today={today} />
                ))}
              </ul>
            ) : (
              <p className="py-3 text-ui text-subtle">All Initiatives are wrapped up.</p>
            )}
          </Section>
          {resolved.length > 0 && (
            <details className="group">
              <summary className="mb-1 cursor-pointer list-none border-b border-line pb-1.5 text-xs font-medium text-muted hover:text-fg">
                Resolved <span className="text-subtle tabular-nums">{resolved.length}</span>
              </summary>
              <ul className="-mx-2 flex flex-col">
                {resolved.map((i) => (
                  <InitiativeRow key={i.id} initiative={i} today={today} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </>
  );
}
