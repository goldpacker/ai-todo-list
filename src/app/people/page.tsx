import Link from "next/link";
import { Users } from "lucide-react";
import { readCore } from "@/lib/core";
import { plural } from "@/lib/format";
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
    <>
      <PageHeader title="People" meta={people.length || undefined}>
        Everyone linked to your Tasks. Open someone before a 1:1 to see what to discuss.
      </PageHeader>
      {people.length === 0 ? (
        <EmptyState icon={<Users />} title="No People yet">
          People are added automatically when a Task links them by name or @handle.
        </EmptyState>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {[...withWork, ...rest].map((p) => (
            <li key={p.id}>
              <Link
                href={`/people/${p.id}`}
                className="flex min-h-11 items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-hover"
              >
                <Avatar name={p.name} className="size-6 text-[10px]" />
                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className={p.activeTaskCount ? "truncate text-sm text-fg" : "truncate text-sm text-muted"}>
                    {p.name}
                  </span>
                  {p.handles.length > 0 && (
                    <span className="hidden truncate font-mono text-xs text-subtle sm:inline">
                      {p.handles.join(" ")}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-subtle tabular-nums">
                  {p.activeTaskCount ? plural(p.activeTaskCount, "active Task") : "No active Tasks"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
