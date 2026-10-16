"use client";

import { useId, useState, useTransition } from "react";
import { ArrowRightLeft, Check, CircleArrowRight, CirclePause, Pencil, Plus, RotateCcw, Ban } from "lucide-react";
import { LANES, LANE_INFO, PRIORITIES, TRANSITIONS, type Lane, type Priority, type Status } from "@/core/domain";
import {
  changeLaneAction,
  dropAction,
  markDoneAction,
  markReadyAction,
  reopenAction,
  setWaitingAction,
  updateTaskAction,
} from "@/app/actions";
import type { ActionState } from "@/lib/mutations";
import { Button, Spinner } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Field, Input, Select, Textarea, describedBy } from "./ui/field";
import { FormError, SubmitButton, useServerForm } from "./ui/form";
import { LanePicker } from "./lane-picker";
import { openNewTask } from "./events";

export interface ActionableTask {
  id: number;
  kind: "task" | "initiative";
  title: string;
  description: string;
  status: Status;
  lane: Lane | null;
  priority: Priority;
  dueDate: string | null;
  repo: string | null;
  people: string[];
}

type DialogKind = "edit" | "lane" | "waiting" | "drop" | null;

const PRIORITY_LABEL = { high: "High", normal: "Normal", low: "Low" } as const;

/** A one-click action (done, ready, reopen) with a pending state; errors go to the toolbar's message slot. */
function QuickAction({
  id,
  action,
  icon,
  label,
  variant = "secondary",
  onResult,
}: {
  id: number;
  action: (fd: FormData) => Promise<ActionState>;
  icon: React.ReactNode;
  label: string;
  variant?: "primary" | "secondary";
  onResult: (s: ActionState) => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          onResult(await action(fd));
        });
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant={variant} disabled={pending} aria-busy={pending || undefined}>
        {pending ? <Spinner /> : icon}
        {label}
      </Button>
    </form>
  );
}

export function TaskActions({ task, repos }: { task: ActionableTask; repos: string[] }) {
  const [open, setOpen] = useState<DialogKind>(null);
  const [error, setError] = useState<ActionState>({ ok: false });
  const [celebrations, setCelebrations] = useState(0);
  const close = () => setOpen(null);
  const can = (to: Status) => TRANSITIONS[task.status].includes(to);
  const resolved = task.status === "done" || task.status === "dropped";
  const isInitiative = task.kind === "initiative";

  return (
    <div>
      <div role="toolbar" aria-label="Task actions" className="flex flex-wrap items-center gap-1.5">
        {!isInitiative && !resolved && can("done") && (
          <QuickAction
            id={task.id}
            action={markDoneAction}
            icon={<Check />}
            label="Mark done"
            variant="primary"
            onResult={(r) => {
              setError(r);
              if (r.ok) setCelebrations((n) => n + 1);
            }}
          />
        )}
        {!isInitiative && !resolved && task.status !== "ready" && can("ready") && (
          <QuickAction
            id={task.id}
            action={markReadyAction}
            icon={<CircleArrowRight />}
            label="Mark ready"
            onResult={setError}
          />
        )}
        {!isInitiative && !resolved && task.status !== "waiting" && can("waiting") && (
          <Button size="sm" onClick={() => setOpen("waiting")}>
            <CirclePause /> Waiting…
          </Button>
        )}
        {!isInitiative && !resolved && (
          <Button size="sm" onClick={() => setOpen("lane")}>
            <ArrowRightLeft /> Move Lane…
          </Button>
        )}
        {isInitiative && !resolved && (
          <Button size="sm" variant="primary" onClick={() => openNewTask({ parentId: task.id })}>
            <Plus /> Add a Task
          </Button>
        )}
        <Button size="sm" onClick={() => setOpen("edit")}>
          <Pencil /> Edit
        </Button>
        {!resolved && (
          <Button size="sm" variant="ghost" onClick={() => setOpen("drop")}>
            <Ban /> Drop…
          </Button>
        )}
        {(task.status === "dropped" || (!isInitiative && task.status === "done")) && (
          <QuickAction id={task.id} action={reopenAction} icon={<RotateCcw />} label="Reopen" onResult={setError} />
        )}
      </div>
      <div aria-live="polite">
        {error.message && (
          <div className="mt-3">
            <FormError state={error} />
          </div>
        )}
        {celebrations > 0 && <Celebration key={celebrations} />}
      </div>

      <Dialog open={open === "edit"} onClose={close} title={isInitiative ? "Edit Initiative" : "Edit Task"} wide>
        <EditForm task={task} repos={repos} onDone={close} />
      </Dialog>
      <Dialog
        open={open === "lane"}
        onClose={close}
        title="Move to another Lane"
        description="The reason is recorded in the Task’s Lane history."
      >
        <LaneForm task={task} repos={repos} onDone={close} />
      </Dialog>
      <Dialog
        open={open === "waiting"}
        onClose={close}
        title="Mark Waiting"
        description="Blocked on someone else. A follow-up is drafted once the threshold passes."
      >
        <WaitingForm task={task} onDone={close} />
      </Dialog>
      <Dialog
        open={open === "drop"}
        onClose={close}
        title={isInitiative ? "Drop Initiative" : "Drop Task"}
        description={
          isInitiative
            ? "Its unresolved child Tasks are dropped too. You can reopen later."
            : "It leaves your list. You can reopen it later."
        }
      >
        <DropForm task={task} onDone={close} />
      </Dialog>
    </div>
  );
}

const CONFETTI_COLORS = ["mauve", "pink", "peach", "yellow", "green", "teal", "sky", "blue", "lavender", "red"];

/** A brief burst of Catppuccin dots plus a toast. CSS only; the dots are hidden under reduced motion. */
function Celebration() {
  const dots = Array.from({ length: 22 }, (_, i) => {
    const angle = (i / 22) * Math.PI * 2;
    const dist = 70 + ((i * 37) % 60);
    return {
      color: `var(--color-${CONFETTI_COLORS[i % CONFETTI_COLORS.length]})`,
      dx: `${Math.round(Math.cos(angle) * dist)}px`,
      dy: `${Math.round(Math.sin(angle) * dist - 30)}px`,
      size: 6 + (i % 3) * 2,
    };
  });
  return (
    <div className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center">
      <div className="relative">
        {dots.map((d, i) => (
          <span
            key={i}
            aria-hidden
            className="confetti absolute top-1/2 left-1/2 animate-confetti rounded-full"
            style={
              {
                width: d.size,
                height: d.size,
                backgroundColor: d.color,
                "--dx": d.dx,
                "--dy": d.dy,
              } as React.CSSProperties
            }
          />
        ))}
        <p
          role="status"
          className="animate-toast rounded-full bg-green px-5 py-2.5 font-display text-base font-extrabold text-on shadow-[0_12px_32px_-8px_rgb(0_0_0/0.6)]"
        >
          Done! One less thing. ✨
        </p>
      </div>
    </div>
  );
}

function useIds() {
  const uid = useId();
  return (name: string) => `${uid}-${name}`;
}

function Footer({
  pending,
  label,
  onCancel,
  variant,
}: {
  pending: boolean;
  label: string;
  onCancel: () => void;
  variant?: "primary" | "danger";
}) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <SubmitButton pending={pending} variant={variant}>
        {label}
      </SubmitButton>
    </div>
  );
}

function EditForm({ task, repos, onDone }: { task: ActionableTask; repos: string[]; onDone: () => void }) {
  const id = useIds();
  const form = useServerForm(updateTaskAction, { onSuccess: onDone });
  const err = form.state.fieldErrors ?? {};
  const ctl = (name: string, hint?: unknown) => ({
    id: id(name),
    name,
    invalid: !!err[name],
    "aria-describedby": describedBy(id(name), err[name], hint),
  });
  return (
    <form onSubmit={form.onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={task.id} />
      <Field id={id("title")} label="Title" error={err.title}>
        <Input {...ctl("title")} defaultValue={task.title} required autoComplete="off" />
      </Field>
      <Field id={id("description")} label="Description" optional error={err.description} hint="Markdown supported.">
        <Textarea {...ctl("description", true)} defaultValue={task.description} rows={6} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={id("priority")} label="Priority" error={err.priority}>
          <Select {...ctl("priority")} defaultValue={task.priority}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={id("dueDate")} label="Due date" optional error={err.dueDate} hint="Clear to remove.">
          <Input {...ctl("dueDate", true)} type="date" defaultValue={task.dueDate ?? ""} />
        </Field>
        {task.kind === "task" && (
          <Field
            id={id("repo")}
            label="Repo"
            optional={task.lane !== "delegate"}
            error={err.repo}
            hint={task.lane === "delegate" ? "Required for Delegate." : undefined}
          >
            <Select {...ctl("repo")} defaultValue={task.repo ?? ""}>
              <option value="">None</option>
              {repos.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <Field
        id={id("people")}
        label="People"
        optional
        error={err.people}
        hint="Names or @handles, comma-separated. Replaces the current list."
      >
        <Input {...ctl("people", true)} defaultValue={task.people.join(", ")} autoComplete="off" />
      </Field>
      <FormError state={form.state} />
      <Footer pending={form.pending} label="Save" onCancel={onDone} />
    </form>
  );
}

function LaneForm({ task, repos, onDone }: { task: ActionableTask; repos: string[]; onDone: () => void }) {
  const id = useIds();
  const options = LANES.filter((l) => l !== task.lane);
  const [lane, setLane] = useState<Lane>(options[0]);
  const form = useServerForm(changeLaneAction, { onSuccess: onDone });
  const err = form.state.fieldErrors ?? {};
  const needsRepo = lane === "delegate" && !task.repo;
  return (
    <form onSubmit={form.onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={task.id} />
      <div>
        <LanePicker
          legend="New Lane"
          name="lane"
          value={lane}
          onChange={setLane}
          exclude={task.lane}
          invalid={!!err.lane}
          describedBy={`${id("lane")}-hint`}
        />
        <p id={`${id("lane")}-hint`} className={err.lane ? "mt-1.5 text-xs text-red" : "mt-1.5 text-xs text-subtext0"}>
          {err.lane ?? LANE_INFO[lane].description}
        </p>
      </div>
      {needsRepo && (
        <Field
          id={id("repo")}
          label="Repo"
          error={err.repo}
          hint={
            repos.length
              ? "Delegate Tasks must target a registered Repo."
              : "No Repos registered. Run `todo repo add <name> <path>`."
          }
        >
          <Select id={id("repo")} name="repo" required defaultValue="" invalid={!!err.repo}>
            <option value="" disabled>
              Choose a Repo…
            </option>
            {repos.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field id={id("reason")} label="Reason" error={err.reason}>
        <Textarea
          id={id("reason")}
          name="reason"
          required
          rows={3}
          invalid={!!err.reason}
          placeholder="Why this Lane fits better, e.g. needs a decision before any code is written"
        />
      </Field>
      <FormError state={form.state} />
      <Footer pending={form.pending} label="Move" onCancel={onDone} />
    </form>
  );
}

function WaitingForm({ task, onDone }: { task: ActionableTask; onDone: () => void }) {
  const id = useIds();
  const form = useServerForm(setWaitingAction, { onSuccess: onDone });
  const err = form.state.fieldErrors ?? {};
  return (
    <form onSubmit={form.onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={task.id} />
      <Field id={id("note")} label="Waiting on" error={err.note}>
        <Textarea
          id={id("note")}
          name="note"
          required
          rows={3}
          invalid={!!err.note}
          placeholder="Who, and what for, e.g. Marcus to share Q3 traffic numbers"
        />
      </Field>
      <Field
        id={id("followUpDays")}
        label="Follow up after"
        optional
        error={err.followUpDays}
        hint="Days. Defaults to 3."
      >
        <Input
          id={id("followUpDays")}
          name="followUpDays"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          placeholder="3"
          className="w-28"
          invalid={!!err.followUpDays}
        />
      </Field>
      <FormError state={form.state} />
      <Footer pending={form.pending} label="Mark Waiting" onCancel={onDone} />
    </form>
  );
}

function DropForm({ task, onDone }: { task: ActionableTask; onDone: () => void }) {
  const id = useIds();
  const form = useServerForm(dropAction, { onSuccess: onDone });
  return (
    <form onSubmit={form.onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={task.id} />
      <Field id={id("note")} label="Note" optional>
        <Textarea id={id("note")} name="note" rows={2} placeholder="Why it’s no longer needed" />
      </Field>
      <FormError state={form.state} />
      <Footer pending={form.pending} label="Drop" variant="danger" onCancel={onDone} />
    </form>
  );
}
