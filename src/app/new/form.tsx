"use client";

import { useRouter } from "next/navigation";
import { TaskForm } from "@/components/task-form";

export function NewTaskPageForm(props: { repos: string[]; initiatives: { id: number; title: string }[] }) {
  const router = useRouter();
  return (
    <TaskForm
      {...props}
      autoFocus
      onDone={(id, kind) => router.push(kind === "initiative" ? `/initiatives/${id}` : `/tasks/${id}`)}
    />
  );
}
