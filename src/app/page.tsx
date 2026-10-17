import { HomeContent } from "@/components/home-view";
import { readCore } from "@/lib/core";
import { toDateString } from "@/lib/format";
import { heatOf, heatingUp, type Heat } from "@/lib/heat";
import { greeting, preppedCount } from "@/lib/today-board";

export const metadata = { title: { absolute: "Lanes · todo" } };

export default async function HomePage() {
  const core = await readCore();
  const now = new Date();
  const today = toDateString(now);
  const active = core.list({ kind: "task" });
  const followUpDueIds = new Set(core.followUpsDue().map((t) => t.id));

  const heat = new Map<number, Heat>();
  for (const t of active) {
    const h = heatOf(t, today, followUpDueIds.has(t.id)).heat;
    if (h) heat.set(t.id, h);
  }

  return (
    <HomeContent
      header={{ greeting: greeting(now.getHours()), date: today, prepped: preppedCount(active) }}
      rail={heatingUp(active, today, followUpDueIds)}
      active={active}
      heat={heat}
    />
  );
}
