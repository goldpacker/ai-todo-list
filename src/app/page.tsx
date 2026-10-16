import type { PrepKind } from "@/core/domain";
import { TodayContent } from "@/components/today-view";
import { readCore } from "@/lib/core";
import { toDateString } from "@/lib/format";
import { buildTodayBoard, greeting, preppedCount } from "@/lib/today-board";

export const metadata = { title: "Today" };

export default async function TodayPage() {
  const core = await readCore();
  const now = new Date();
  const active = core.list({ kind: "task" });
  const board = buildTodayBoard({
    today: core.today(),
    active,
    followUpDueIds: new Set(core.followUpsDue().map((t) => t.id)),
  });

  // The latest Prep's kind gives "your move" cards their context line ("Brief's ready").
  const prepKinds: Partial<Record<number, PrepKind>> = {};
  for (const t of board.yourMove) {
    if (t.prepCount > 0) prepKinds[t.id] = core.task(t.id).preps.at(-1)?.kind;
  }

  return (
    <TodayContent
      board={board}
      now={now}
      prepKinds={prepKinds}
      header={{ greeting: greeting(now.getHours()), date: toDateString(now), prepped: preppedCount(active) }}
    />
  );
}
