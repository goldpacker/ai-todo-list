import { LANES, LANE_INFO } from "@/core/domain";
import { readCore } from "@/lib/core";
import { SidebarNav, type NavItem } from "./sidebar-nav";
import { NewTaskDialog } from "./new-task-dialog";

/** Loads the counts and pick-lists the shell needs, then hands them to the client nav and dialog. */
export async function Sidebar() {
  const core = await readCore();
  const active = core.list({ kind: "task" });
  const today = core.today();
  const initiatives = core.initiatives();
  const people = core.people();

  const items: NavItem[] = [
    { href: "/", label: "Today", icon: "today", count: today.total },
    ...LANES.map((lane) => ({
      href: `/lanes/${lane}`,
      label: LANE_INFO[lane].name,
      icon: "lane" as const,
      lane,
      count: active.filter((t) => t.lane === lane).length,
    })),
    { href: "/initiatives", label: "Initiatives", icon: "initiatives", count: initiatives.length },
    { href: "/people", label: "People", icon: "people", count: people.filter((p) => p.activeTaskCount > 0).length },
  ];

  return (
    <>
      <SidebarNav items={items} />
      <NewTaskDialog
        repos={core.repos().map((r) => r.name)}
        initiatives={initiatives.map((i) => ({ id: i.id, title: i.title }))}
      />
    </>
  );
}

export function SidebarFallback() {
  return (
    <div className="hidden w-56 shrink-0 border-r border-line bg-bg-subtle md:block" aria-hidden>
      <div className="h-14" />
    </div>
  );
}
