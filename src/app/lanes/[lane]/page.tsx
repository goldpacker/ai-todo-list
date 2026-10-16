import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { Inbox } from "lucide-react";
import { LANES, LANE_INFO, type Lane, type Status } from "@/core/domain";
import { readCore } from "@/lib/core";
import { toDateString } from "@/lib/format";
import { ACTIVE_STATUS_ORDER, STATUS_LABEL } from "@/lib/ui-meta";
import { PageHeader, Section } from "@/components/section";
import { LaneDot, StatusIcon } from "@/components/task-bits";
import { TaskList, TaskRow } from "@/components/task-row";
import { EmptyState } from "@/components/ui/empty-state";
import { NewTaskButton } from "@/components/shell-client";

const FILTERS: (Status | "all")[] = ["all", ...ACTIVE_STATUS_ORDER, "done"];

function isLane(value: string): value is Lane {
  return (LANES as readonly string[]).includes(value);
}

export async function generateMetadata({ params }: PageProps<"/lanes/[lane]">) {
  const { lane } = await params;
  return { title: isLane(lane) ? LANE_INFO[lane].name : "Lane" };
}

export default async function LanePage({ params, searchParams }: PageProps<"/lanes/[lane]">) {
  const { lane } = await params;
  if (!isLane(lane)) notFound();
  const sp = await searchParams;
  const filter = (typeof sp.status === "string" && (FILTERS as string[]).includes(sp.status) ? sp.status : "all") as
    Status | "all";

  const core = await readCore();
  const today = toDateString(new Date());
  const info = LANE_INFO[lane];
  const active = core.list({ lane });
  const done = filter === "done" ? core.list({ lane, status: "done" }) : [];
  const count = (f: Status | "all") =>
    f === "all" ? active.length : f === "done" ? null : active.filter((t) => t.status === f).length;

  return (
    <>
      <PageHeader
        title={info.name}
        icon={<LaneDot lane={lane} className="size-2.5" />}
        meta={active.length || undefined}
        actions={<NewTaskButton request={{ lane }} />}
      >
        <p>{info.description}</p>
        <p className="mt-1.5 text-xs text-subtle">
          <span className="text-muted">Who acts:</span> {info.whoActs}. <span className="text-muted">Worker:</span>{" "}
          {info.workerAction}
        </p>
      </PageHeader>

      <nav aria-label="Filter by status" className="-mx-1 mb-6 flex flex-wrap gap-1">
        {FILTERS.map((f) => {
          const n = count(f);
          const selected = f === filter;
          return (
            <Link
              key={f}
              href={f === "all" ? `/lanes/${lane}` : `/lanes/${lane}?status=${f}`}
              aria-current={selected ? "page" : undefined}
              scroll={false}
              className={clsx(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-ui transition-colors",
                selected ? "bg-active font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg",
              )}
            >
              {f !== "all" && <StatusIcon status={f} className="size-3" />}
              {f === "all" ? "All active" : STATUS_LABEL[f]}
              {n ? <span className="text-xs text-subtle tabular-nums">{n}</span> : null}
            </Link>
          );
        })}
      </nav>

      {filter === "all" ? (
        active.length === 0 ? (
          <EmptyState icon={<Inbox />} title={`No active ${info.name} Tasks`}>
            Batch similar work here once Tasks are captured into this Lane.
          </EmptyState>
        ) : (
          ACTIVE_STATUS_ORDER.map((status) => {
            const tasks = active.filter((t) => t.status === status);
            if (!tasks.length) return null;
            return (
              <Section
                key={status}
                title={STATUS_LABEL[status]}
                icon={<StatusIcon status={status} className="size-3" />}
                count={tasks.length}
              >
                <TaskList>
                  {tasks.map((t) => (
                    <TaskRow key={t.id} task={t} today={today} />
                  ))}
                </TaskList>
              </Section>
            );
          })
        )
      ) : (
        (() => {
          const tasks = filter === "done" ? done : active.filter((t) => t.status === filter);
          return tasks.length === 0 ? (
            <EmptyState icon={<Inbox />} title={`No ${STATUS_LABEL[filter].toLowerCase()} ${info.name} Tasks`} />
          ) : (
            <TaskList>
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} today={today} />
              ))}
            </TaskList>
          );
        })()
      )}
    </>
  );
}
