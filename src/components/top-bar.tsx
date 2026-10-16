import Link from "next/link";
import { readCore } from "@/lib/core";
import { workerStatus } from "@/lib/today-board";
import { NewTaskDialog } from "./new-task-dialog";
import { AddTaskButton, TopNav } from "./top-nav";

function Brand() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-xl" aria-label="todo — Today">
      <span className="flex size-[34px] items-center justify-center rounded-xl bg-mauve" aria-hidden>
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="var(--color-base)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12l4 4L19 6" />
        </svg>
      </span>
      <span className="font-display text-xl font-extrabold tracking-tight">todo</span>
    </Link>
  );
}

function RobotFace() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="none"
      stroke="var(--color-base)"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="5" y="8" width="14" height="11" rx="3" />
      <path d="M12 4v4M9 13h.01M15 13h.01" />
    </svg>
  );
}

/** Live worker status from claimed Tasks, e.g. "worker-2 is coding #13". */
function WorkerChip({ status, firstId }: { status: ReturnType<typeof workerStatus>; firstId?: number }) {
  const inner = (
    <>
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full ${status.busy ? "bg-green" : "bg-overlay1"}`}
      >
        <RobotFace />
      </span>
      <span className="hidden truncate sm:inline">
        {status.text}
        {status.more > 0 && <span className="text-overlay1"> +{status.more} more</span>}
      </span>
      <span className="sr-only sm:hidden">{status.text}</span>
    </>
  );
  const cls =
    "flex min-w-0 items-center gap-2 rounded-full bg-surface0 py-1.5 pr-1.5 pl-1.5 text-ui text-subtext0 sm:max-w-80 sm:pr-3.5";
  return firstId ? (
    <Link href={`/tasks/${firstId}`} className={`${cls} hover:text-text`} title={status.text}>
      {inner}
    </Link>
  ) : (
    <span className={cls} title={status.text}>
      {inner}
    </span>
  );
}

export async function TopBar() {
  const core = await readCore();
  const claimed = core.list({ status: "claimed", kind: "task" });
  const status = workerStatus(claimed);
  const initiatives = core.initiatives();

  return (
    <header className="sticky top-0 z-20 bg-mantle/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-8 sm:py-4">
        <Brand />
        <TopNav />
        <div className="ml-auto flex min-w-0 items-center gap-2.5">
          <WorkerChip status={status} firstId={claimed[0]?.id} />
          <AddTaskButton />
        </div>
      </div>
      <NewTaskDialog
        repos={core.repos().map((r) => r.name)}
        initiatives={initiatives.map((i) => ({ id: i.id, title: i.title }))}
      />
    </header>
  );
}

export function TopBarFallback() {
  return <div className="h-[66px] bg-mantle sm:h-[72px]" aria-hidden />;
}
