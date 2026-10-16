import { redirect } from "next/navigation";
import { readCore } from "@/lib/core";
import { orNotFound, parseId } from "@/lib/load";
import { TaskDetailView } from "@/components/task-detail";

async function load(param: string) {
  const id = parseId(param);
  const core = await readCore();
  return { core, task: orNotFound(() => core.task(id)) };
}

export async function generateMetadata({ params }: PageProps<"/initiatives/[id]">) {
  const { task } = await load((await params).id);
  return { title: task.title };
}

export default async function InitiativePage({ params }: PageProps<"/initiatives/[id]">) {
  const { core, task } = await load((await params).id);
  if (task.kind !== "initiative") redirect(`/tasks/${task.id}`);
  return <TaskDetailView task={task} repos={core.repos().map((r) => r.name)} now={new Date()} />;
}
