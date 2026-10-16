"use client";

import { addNoteAction } from "@/app/actions";
import { Textarea } from "./ui/field";
import { FormError, SubmitButton, useServerForm } from "./ui/form";

export function NoteForm({ taskId }: { taskId: number }) {
  const form = useServerForm(addNoteAction);
  return (
    <form onSubmit={form.onSubmit} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={taskId} />
      <label htmlFor={`note-${taskId}`} className="sr-only">
        Add a note
      </label>
      <Textarea
        id={`note-${taskId}`}
        name="body"
        rows={2}
        required
        placeholder="Add a note…"
        className="min-h-16"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
        }}
      />
      <FormError state={form.state} />
      <div className="flex justify-end">
        <SubmitButton pending={form.pending} variant="secondary" size="sm">
          Add note
        </SubmitButton>
      </div>
    </form>
  );
}
