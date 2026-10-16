// Tiny client-side event bus so the sidebar button, keyboard shortcut and page buttons can all open
// the single "New task" dialog that lives in the app shell.
export interface NewTaskRequest {
  kind?: "task" | "initiative";
  lane?: string;
  parentId?: number;
}

export const NEW_TASK_EVENT = "aitodo:new-task";

export function openNewTask(request: NewTaskRequest = {}) {
  window.dispatchEvent(new CustomEvent<NewTaskRequest>(NEW_TASK_EVENT, { detail: request }));
}
