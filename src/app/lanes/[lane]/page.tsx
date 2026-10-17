import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { ChevronLeft } from "lucide-react";
import { LANES, LANE_INFO, type Lane, type Status } from "@/core/domain";
import { readCore } from "@/lib/core";
import { toDateString } from "@/lib/format";
import { ACTIVE_STATUS_ORDER, LANE_COLOR, STATUS_LABEL } from "@/lib/ui-meta";
import { ColumnEmpty, PageHeader, Section } from "@/components/section";
import { StatusIcon } from "@/components/task-bits";
import { TaskCard, defaultContext } from "@/components/task-card";
import { NewTaskButton } from "@/components/shell-client";

const FILTERS: (Status | "all")[] = ["all", ...ACTIVE_STATUS_ORDER, "done"];

function isLane(value: string): value is Lane {
  return (LANES as readonly string[]).includes(value);
}

export async function generateMetadata({ params }: PageProps<"/lanes/[lane]">) {
  const { lane } = await params;
  return { title: isLane(lane) ? LANE_INFO[lane].name : "Lane" };
}

function Grid({ children }: { children: React.ReactNode }) {
  return <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</ul>;
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
  const card = (t: (typeof active)[number]) => (
    <TaskCard key={t.id} task={t} today={today} hideLane context={defaultContext(t)} dashed={t.status === "claimed"} />
  );

  return (
    <div className="max-w-6xl">
      <Link href="/" className="mb-3 inline-flex items-center gap-1 text-ui text-subtext0 hover:text-text">
        <ChevronLeft aria-hidden className="size-4" /> All Lanes
      </Link>
      <PageHeader
        title={
          <span
            className="inline-flex items-center rounded-full px-4 py-0.5 text-on"
            style={{ backgroundColor: LANE_COLOR[lane] }}
          >
            {info.name}
          </span>
        }
        meta={active.length}
        actions={<NewTaskButton request={{ lane }} />}
      >
        <p>{info.description}</p>
        <p className="mt-1.5 text-xs text-overlay1">
          <span className="font-semibold text-subtext0">Who acts:</span> {info.whoActs}.{" "}
          <span className="font-semibold text-subtext0">Worker:</span> {info.workerAction}
        </p>
      </PageHeader>

      <nav aria-label="Filter by status" className="mb-6 flex flex-wrap gap-1.5">
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
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-ui transition-colors",
                selected ? "bg-surface0 font-semibold text-text" : "text-subtext0 hover:bg-surface0/60 hover:text-text",
              )}
            >
              {f !== "all" && <StatusIcon status={f} className="size-3.5" />}
              {f === "all" ? "All active" : STATUS_LABEL[f]}
              {n ? <span className="text-xs text-overlay1 tabular-nums">{n}</span> : null}
            </Link>
          );
        })}
      </nav>

      {filter === "all" ? (
        active.length === 0 ? (
          <ColumnEmpty emoji="✨">No active {info.name} Tasks. Batch work lands here once it’s captured.</ColumnEmpty>
        ) : (
          ACTIVE_STATUS_ORDER.map((status) => {
            const tasks = active.filter((t) => t.status === status);
            if (!tasks.length) return null;
            return (
              <Section
                key={status}
                title={STATUS_LABEL[status]}
                icon={<StatusIcon status={status} />}
                count={tasks.length}
              >
                <Grid>{tasks.map(card)}</Grid>
              </Section>
            );
          })
        )
      ) : (
        (() => {
          const tasks = filter === "done" ? done : active.filter((t) => t.status === filter);
          return tasks.length === 0 ? (
            <ColumnEmpty emoji="🫥">
              No {STATUS_LABEL[filter].toLowerCase()} {info.name} Tasks.
            </ColumnEmpty>
          ) : (
            <Grid>{tasks.map(card)}</Grid>
          );
        })()
      )}
    </div>
  );
}
