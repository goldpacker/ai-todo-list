"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LANES, type Lane } from "@/core/domain";
import { Dialog } from "./ui/dialog";
import { NEW_TASK_EVENT, type NewTaskRequest } from "./events";
import { TaskForm, type TaskFormDefaults } from "./task-form";

/** Infers sensible defaults from the current page: a Lane page preselects its Lane, an Initiative page itself. */
function defaultsFor(pathname: string, request: NewTaskRequest): TaskFormDefaults {
  const laneMatch = pathname.match(/^\/lanes\/([^/]+)/);
  const initiativeMatch = pathname.match(/^\/initiatives\/(\d+)/);
  const lane = request.lane ?? laneMatch?.[1];
  return {
    kind: request.kind,
    lane: lane && (LANES as readonly string[]).includes(lane) ? (lane as Lane) : undefined,
    parentId: request.parentId ?? (initiativeMatch ? Number(initiativeMatch[1]) : undefined),
  };
}

export function NewTaskDialog({
  repos,
  initiatives,
}: {
  repos: string[];
  initiatives: { id: number; title: string }[];
}) {
  const router = useRouter();
  const [session, setSession] = useState<{ n: number; defaults: TaskFormDefaults } | null>(null);

  useEffect(() => {
    function onOpen(e: Event) {
      const request = (e as CustomEvent<NewTaskRequest>).detail ?? {};
      setSession((s) => ({ n: (s?.n ?? 0) + 1, defaults: defaultsFor(window.location.pathname, request) }));
    }
    window.addEventListener(NEW_TASK_EVENT, onOpen);
    return () => window.removeEventListener(NEW_TASK_EVENT, onOpen);
  }, []);

  const close = () => setSession(null);

  return (
    <Dialog
      open={!!session}
      onClose={close}
      title="New"
      description="Add a Task by hand, or create an Initiative to group Tasks."
      wide
    >
      {session && (
        <TaskForm
          key={session.n}
          repos={repos}
          initiatives={initiatives}
          defaults={session.defaults}
          autoFocus
          onCancel={close}
          onDone={(id, kind) => {
            close();
            router.push(kind === "initiative" ? `/initiatives/${id}` : `/tasks/${id}`);
          }}
        />
      )}
    </Dialog>
  );
}
