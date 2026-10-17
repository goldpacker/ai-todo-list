import Link from "next/link";
import clsx from "clsx";
import type { TaskSummary } from "@/core/core";
import type { Heat, HeatedTask } from "@/lib/heat";
import { LanesBoard } from "./lanes-board";
import { LanePill } from "./task-bits";
import { HEAT_EDGE } from "./task-card";
import { Pill } from "./ui/badge";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function weekday(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export interface HomeHeader {
  greeting: string;
  /** YYYY-MM-DD (local). */
  date: string;
  prepped: number;
}

/** The few most pressing Tasks across every Lane, as a strip above the board. */
function HeatRail({ tasks, total }: { tasks: HeatedTask[]; total: number }) {
  return (
    <section aria-labelledby="heat-rail" className="mb-6 rounded-[20px] bg-mantle p-4">
      <h2 id="heat-rail" className="mb-3 flex items-center gap-2 px-1 font-display text-[17px] font-bold">
        <span aria-hidden>{tasks.length ? "🔥" : "🧊"}</span>
        Heating up
        <span className="rounded-full bg-surface1 px-2.5 font-sans text-xs leading-5 font-bold text-text tabular-nums">
          {total}
        </span>
        {total > tasks.length && (
          <span className="font-sans text-xs font-normal text-subtext0">
            top {tasks.length} shown · the rest have heat edges below
          </span>
        )}
      </h2>
      {tasks.length === 0 ? (
        <p className="px-1 pb-1 text-ui text-subtext0">
          Nothing&apos;s overdue, due this week or flagged high. Pick whatever you like.
        </p>
      ) : (
        <ul className="relative -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
          {tasks.map((t) => (
            <li key={t.id} className="w-[260px] shrink-0 list-none lg:w-auto">
              <Link
                href={`/tasks/${t.id}`}
                className={clsx(
                  "relative flex h-full flex-col gap-2 rounded-2xl bg-surface0 p-3 pl-[18px] transition-[background-color,transform] hover:-translate-y-px hover:bg-surface1/70",
                  HEAT_EDGE[t.heat],
                )}
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  {t.lane && <LanePill lane={t.lane} />}
                  <Pill tone={t.heat === "hot" ? "red" : "peach"}>
                    <span className="sr-only">{t.heat === "hot" ? "Hot: " : "Warming up: "}</span>
                    {t.reason}
                  </Pill>
                </span>
                <span className="line-clamp-2 text-[15px] leading-snug font-semibold text-text">{t.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Home: a greeting, the heat rail, then every active Task by Lane. Pure presentation. */
export function HomeContent({
  header,
  rail,
  active,
  heat,
}: {
  header: HomeHeader;
  rail: { tasks: HeatedTask[]; total: number };
  active: TaskSummary[];
  heat: ReadonlyMap<number, Heat>;
}) {
  const n = rail.total;
  return (
    <>
      <header className="mb-6 flex flex-col gap-x-4 gap-y-1 lg:flex-row lg:items-baseline">
        <h1 className="font-display text-[34px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[44px]">
          {header.greeting}{" "}
          {n === 0 ? (
            <>
              Nothing&apos;s <span className="text-mauve">on fire</span>.
            </>
          ) : (
            <>
              <span className="text-mauve">{n}</span> {n === 1 ? "thing is" : "things are"} heating up.
            </>
          )}
        </h1>
        <p className="text-[15px] text-subtext0">
          {weekday(header.date)} · {active.length} active ·{" "}
          {header.prepped > 0
            ? `the agents prepped ${header.prepped} ${header.prepped === 1 ? "thing" : "things"}`
            : "all quiet"}
        </p>
      </header>
      <HeatRail tasks={rail.tasks} total={rail.total} />
      <LanesBoard active={active} today={header.date} heat={heat} />
      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-overlay1">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-1 rounded-full bg-red" /> overdue, due within a day, or high and due this
          week
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-1 rounded-full bg-peach" /> due this week, high, or a follow-up is due
        </span>
      </p>
    </>
  );
}
