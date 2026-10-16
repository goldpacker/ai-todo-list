import { LANES, LANE_INFO } from "@/core/domain";
import { readCore } from "@/lib/core";
import { orNotFound, parseId } from "@/lib/load";
import { plural, toDateString } from "@/lib/format";
import { ColumnEmpty, PageHeader, Section } from "@/components/section";
import { Avatar, LanePill } from "@/components/task-bits";
import { TaskCard, defaultContext } from "@/components/task-card";

async function loadPerson(idParam: string) {
  const id = parseId(idParam);
  const core = await readCore();
  return orNotFound(() => core.person(id));
}

export async function generateMetadata({ params }: PageProps<"/people/[id]">) {
  const person = await loadPerson((await params).id);
  return { title: person.name };
}

function Grid({ children }: { children: React.ReactNode }) {
  return <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</ul>;
}

export default async function PersonPage({ params }: PageProps<"/people/[id]">) {
  const person = await loadPerson((await params).id);
  const today = toDateString(new Date());
  const initiatives = person.tasks.filter((t) => t.kind === "initiative");
  const tasks = person.tasks.filter((t) => t.kind === "task");

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={person.name}
        icon={<Avatar name={person.name} colorKey={person.id} className="size-11 text-sm" />}
      >
        {person.handles.length > 0 && (
          <span className="mr-2 font-mono text-xs text-overlay1">{person.handles.join(" ")}</span>
        )}
        {person.activeTaskCount
          ? `${plural(person.activeTaskCount, "open thing")} to talk about.`
          : "Nothing open with them right now."}
      </PageHeader>

      {person.tasks.length === 0 ? (
        <ColumnEmpty emoji="🤝">You’re all square with {person.name.split(" ")[0]}.</ColumnEmpty>
      ) : (
        <>
          {initiatives.length > 0 && (
            <Section title="Initiatives" count={initiatives.length}>
              <Grid>
                {initiatives.map((t) => (
                  <TaskCard key={t.id} task={t} today={today} context={defaultContext(t)} />
                ))}
              </Grid>
            </Section>
          )}
          {LANES.map((lane) => {
            const inLane = tasks.filter((t) => t.lane === lane);
            if (!inLane.length) return null;
            return (
              <Section
                key={lane}
                title={<LanePill lane={lane} className="h-6 px-3 text-xs" />}
                count={inLane.length}
                action={<span className="sr-only">{LANE_INFO[lane].name}</span>}
              >
                <Grid>
                  {inLane.map((t) => (
                    <TaskCard key={t.id} task={t} today={today} hideLane showStatus context={defaultContext(t)} />
                  ))}
                </Grid>
              </Section>
            );
          })}
        </>
      )}
    </div>
  );
}
