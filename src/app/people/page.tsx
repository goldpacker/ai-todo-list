import Link from "next/link";
import { Users } from "lucide-react";
import { readCore } from "@/lib/core";
import { PageHeader } from "@/components/section";
import { Avatar } from "@/components/task-bits";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "People" };

export default async function PeoplePage() {
  const core = await readCore();
  const people = core.people();
  const withWork = people.filter((p) => p.activeTaskCount > 0).sort((a, b) => b.activeTaskCount - a.activeTaskCount);
  const rest = people.filter((p) => p.activeTaskCount === 0);

  return (
    <div className="max-w-5xl">
      <PageHeader title="People" meta={people.length}>
        Everyone your Tasks mention. Peek before a 1:1 to see what to bring up.
      </PageHeader>
      {people.length === 0 ? (
        <EmptyState icon={<Users />} title="No People yet">
          People appear automatically when a Task links them by name or @handle.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...withWork, ...rest].map((p) => (
            <li key={p.id}>
              <Link
                href={`/people/${p.id}`}
                className="flex items-center gap-3 rounded-2xl bg-surface0 p-3.5 transition-[background-color,transform] hover:-translate-y-px hover:bg-surface1/70"
              >
                <Avatar name={p.name} colorKey={p.id} className="size-10 text-sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold">{p.name}</span>
                  <span className="truncate font-mono text-xs text-overlay1">
                    {p.handles.length ? p.handles.join(" ") : "no handle"}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                    p.activeTaskCount ? "bg-mauve text-on" : "bg-surface1 text-subtext0"
                  }`}
                  aria-label={`${p.activeTaskCount} active Tasks`}
                >
                  {p.activeTaskCount}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
