import { readCore } from "@/lib/core";
import { PageHeader } from "@/components/section";
import { NewTaskPageForm } from "./form";

export const metadata = { title: "New task" };

export default async function NewTaskPage() {
  const core = await readCore();
  return (
    <div className="max-w-xl">
      <PageHeader title="New">Add a Task by hand, or create an Initiative to group Tasks.</PageHeader>
      <NewTaskPageForm
        repos={core.repos().map((r) => r.name)}
        initiatives={core.initiatives().map((i) => ({ id: i.id, title: i.title }))}
      />
    </div>
  );
}
