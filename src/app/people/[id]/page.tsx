import { CircleCheck } from "lucide-react";
import { LANES, LANE_INFO } from "@/core/domain";
import { readCore } from "@/lib/core";
import { orNotFound, parseId } from "@/lib/load";
import { plural, toDateString } from "@/lib/format";
import { PageHeader, Section } from "@/components/section";
import { Avatar, LaneDot } from "@/components/task-bits";
import { TaskList, TaskRow } from "@/components/task-row";
import { EmptyState } from "@/components/ui/empty-state";

async function loadPerson(idParam: string) {
  const id = parseId(idParam);
  const core = await readCore();
  return orNotFound(() => core.person(id));
}

export async function generateMetadata({ params }: PageProps<"/people/[id]">) {
  const person = await loadPerson((await params).id);
  return { title: person.name };
}

export default async function PersonPage({ params }: PageProps<"/people/[id]">) {
  const person = await loadPerson((await params).id);
  const today = toDateString(new Date());
  const initiatives = person.tasks.filter((t) => t.kind === "initiative");
  const tasks = person.tasks.filter((t) => t.kind === "task");

  return (
    <>
      <PageHeader title={person.name} icon={<Avatar name={person.name} className="size-7 text-[11px]" />}>
        {person.handles.length > 0 && (
          <span className="mr-2 font-mono text-xs text-subtle">{person.handles.join(" ")}</span>
        )}
        {person.activeTaskCount
          ? `${plural(person.activeTaskCount, "active Task")} to discuss.`
          : "Nothing open with them right now."}
      </PageHeader>

      {person.tasks.length === 0 ? (
        <EmptyState icon={<CircleCheck />} title={`Nothing open with ${person.name}`}>
          Done and dropped Tasks are hidden. New Tasks that link them will appear here.
        </EmptyState>
      ) : (
        <>
          {initiatives.length > 0 && (
            <Section title="Initiatives" count={initiatives.length}>
              <TaskList>
                {initiatives.map((t) => (
                  <TaskRow key={t.id} task={t} today={today} />
                ))}
              </TaskList>
            </Section>
          )}
          {LANES.map((lane) => {
            const inLane = tasks.filter((t) => t.lane === lane);
            if (!inLane.length) return null;
            return (
              <Section key={lane} title={LANE_INFO[lane].name} icon={<LaneDot lane={lane} />} count={inLane.length}>
                <TaskList>
                  {inLane.map((t) => (
                    <TaskRow key={t.id} task={t} today={today} />
                  ))}
                </TaskList>
              </Section>
            );
          })}
        </>
      )}
    </>
  );
}
