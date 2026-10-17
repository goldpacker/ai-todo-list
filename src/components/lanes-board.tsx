import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { TaskSummary } from "@/core/core";
import { LANES, LANE_INFO } from "@/core/domain";
import type { Heat } from "@/lib/heat";
import { ACTIVE_STATUS_ORDER, STATUS_LABEL } from "@/lib/ui-meta";
import { BoardColumn, ColumnEmpty } from "./section";
import { LanePill, StatusIcon } from "./task-bits";
import { CardList, TaskCard, defaultContext } from "./task-card";

const EMPTY: Record<string, string> = {
  delegate: "No code for the agents yet.",
  "deep-work": "No focus work queued. Enjoy it.",
  write: "Nothing to write. Rare!",
  review: "Nobody needs your eyes.",
  align: "No conversations pending.",
  quick: "No quick hits.",
};

/** Every active Task in six Lane columns, grouped by status, with heat edges on the pressing ones. */
export function LanesBoard({
  active,
  today,
  heat,
}: {
  active: TaskSummary[];
  today: string;
  heat: ReadonlyMap<number, Heat>;
}) {
  return (
    <div className="relative -mx-4 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
      <div className="flex w-max items-start gap-4">
        {LANES.map((lane) => {
          const info = LANE_INFO[lane];
          const tasks = active.filter((t) => t.lane === lane);
          return (
            <BoardColumn
              key={lane}
              className="w-[300px] shrink-0"
              title={
                <Link
                  href={`/lanes/${lane}`}
                  className="group inline-flex items-center gap-2 rounded-full hover:opacity-90"
                  aria-label={`${info.name} Lane, ${tasks.length} active`}
                >
                  <LanePill lane={lane} className="h-6 px-3 text-xs" />
                  <ArrowUpRight aria-hidden className="size-4 text-overlay1 group-hover:text-text" />
                </Link>
              }
              count={tasks.length}
              header={<p className="line-clamp-2 text-xs text-subtext0">{info.description}</p>}
            >
              {tasks.length === 0 ? (
                <ColumnEmpty emoji="✨">{EMPTY[lane]}</ColumnEmpty>
              ) : (
                ACTIVE_STATUS_ORDER.map((status) => {
                  const group = tasks.filter((t) => t.status === status);
                  if (!group.length) return null;
                  return (
                    <div key={status} className="flex flex-col gap-2">
                      <p className="flex items-center gap-1.5 px-1 text-xs font-semibold text-subtext0">
                        <StatusIcon status={status} className="size-3.5" />
                        {STATUS_LABEL[status]}
                      </p>
                      <CardList>
                        {group.map((t) => (
                          <TaskCard
                            key={t.id}
                            task={t}
                            today={today}
                            hideLane
                            context={defaultContext(t)}
                            dashed={t.status === "claimed"}
                            heat={heat.get(t.id) ?? null}
                          />
                        ))}
                      </CardList>
                    </div>
                  );
                })
              )}
            </BoardColumn>
          );
        })}
      </div>
    </div>
  );
}
