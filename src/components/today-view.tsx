import type { TaskSummary } from "@/core/core";
import type { PrepKind } from "@/core/domain";
import { daysBetween, displayUrl, timeAgo, toDateString } from "@/lib/format";
import type { TodayBoard } from "@/lib/today-board";
import { PREP_READY_LABEL } from "@/lib/ui-meta";
import { Kbd, Pill } from "./ui/badge";
import { BoardColumn, ColumnEmpty } from "./section";
import { Avatar } from "./task-bits";
import { CardList, TaskCard } from "./task-card";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface TodayHeader {
  greeting: string;
  /** YYYY-MM-DD (local). */
  date: string;
  prepped: number;
}

function weekday(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function moveContext(task: TaskSummary, prepKinds: Partial<Record<number, PrepKind>>): string | undefined {
  if (task.status === "ready" && task.prUrl)
    return `PR is up · ${displayUrl(task.prUrl).replace(/^github\.com\//, "")}`;
  const kind = prepKinds[task.id];
  if (kind) return PREP_READY_LABEL[kind];
  return task.parent?.title;
}

/** The Today board: Your move, Agents on it, Waiting on people. Pure presentation over `buildTodayBoard`. */
export function TodayContent({
  board,
  header,
  now,
  prepKinds = {},
}: {
  board: TodayBoard;
  header: TodayHeader;
  now: Date;
  prepKinds?: Partial<Record<number, PrepKind>>;
}) {
  const today = header.date;
  const n = board.yourMove.length;
  return (
    <>
      <header className="mb-6 flex flex-col gap-x-4 gap-y-1 lg:flex-row lg:items-baseline">
        <h1 className="font-display text-[34px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[44px]">
          {header.greeting} <span className="text-mauve">Your move</span> on {n}.
        </h1>
        <p className="text-[15px] text-subtext0">
          {weekday(today)} ·{" "}
          {header.prepped > 0
            ? `the agents prepped ${header.prepped} ${header.prepped === 1 ? "thing" : "things"}`
            : "all quiet"}
        </p>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-3 lg:gap-[18px]">
        <BoardColumn title="Your move" count={n} accent>
          {n === 0 ? (
            <ColumnEmpty emoji="🌿">
              <span>Nothing here. Go touch grass.</span>
              <span className="text-xs text-overlay1">
                Or press <Kbd>N</Kbd> to add something.
              </span>
            </ColumnEmpty>
          ) : (
            <CardList>
              {board.yourMove.map((t) => (
                <TaskCard key={t.id} task={t} today={today} reasons={t.reasons} context={moveContext(t, prepKinds)} />
              ))}
            </CardList>
          )}
        </BoardColumn>

        <BoardColumn title="Agents on it" count={board.agents.length}>
          {board.agents.length === 0 ? (
            <ColumnEmpty emoji="🤖">
              <span>Agents are idle.</span>
              <span className="text-xs text-overlay1">Delegate Tasks show up here once captured.</span>
            </ColumnEmpty>
          ) : (
            <CardList>
              {board.agents.map(({ kind, task }) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  today={today}
                  dashed={kind === "claimed"}
                  context={
                    kind === "claimed" ? (
                      <span className="font-mono text-xs text-green">
                        {task.claimedBy} · claimed {task.claimedAt ? timeAgo(task.claimedAt, now) : "just now"}
                      </span>
                    ) : kind === "pr" ? (
                      <span className="text-mauve">PR is up · ready for your review</span>
                    ) : (
                      <span className="text-overlay1">queued for the next run</span>
                    )
                  }
                />
              ))}
            </CardList>
          )}
        </BoardColumn>

        <BoardColumn title="Waiting on people" count={board.waiting.length}>
          {board.waiting.length === 0 ? (
            <ColumnEmpty emoji="🕊️">
              <span>Nobody owes you anything.</span>
            </ColumnEmpty>
          ) : (
            <CardList>
              {board.waiting.map(({ task, followUpDue }) => {
                const person = task.people[0];
                const quiet = task.waitingSince ? daysBetween(toDateString(new Date(task.waitingSince)), today) : 0;
                return (
                  <TaskCard
                    key={task.id}
                    task={{ ...task, people: [] }}
                    today={today}
                    extraPills={followUpDue ? <Pill tone="peach">follow-up due</Pill> : undefined}
                    context={
                      <span className="flex min-w-0 items-center gap-2" title={task.waitingNote ?? undefined}>
                        {person && <Avatar name={person.name} colorKey={person.id} />}
                        <span className="truncate">
                          {person
                            ? `${person.name.split(" ")[0]} · ${quiet === 0 ? "asked today" : `${quiet} ${quiet === 1 ? "day" : "days"} quiet`}`
                            : (task.waitingNote ?? "Waiting")}
                        </span>
                      </span>
                    }
                  />
                );
              })}
            </CardList>
          )}
        </BoardColumn>
      </div>
    </>
  );
}
