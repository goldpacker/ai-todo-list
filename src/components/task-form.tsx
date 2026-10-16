"use client";

import Link from "next/link";
import { useId, useState } from "react";
import clsx from "clsx";
import { TriangleAlert } from "lucide-react";
import { LANE_INFO, PRIORITIES, type Lane } from "@/core/domain";
import { addTaskAction, createInitiativeAction } from "@/app/actions";
import { LANE_COLOR, STATUS_LABEL } from "@/lib/ui-meta";
import { Button } from "./ui/button";
import { LanePicker } from "./lane-picker";
import { Field, Input, Select, Textarea, describedBy } from "./ui/field";
import { FormError, SubmitButton, useServerForm } from "./ui/form";

export interface TaskFormDefaults {
  kind?: "task" | "initiative";
  lane?: Lane;
  parentId?: number;
}

const PRIORITY_LABEL = { high: "High", normal: "Normal", low: "Low" } as const;

/** Add a Task (Lane required) or an Initiative by hand. The core validates; errors land on fields. */
export function TaskForm({
  repos,
  initiatives,
  defaults = {},
  onDone,
  onCancel,
  autoFocus,
}: {
  repos: string[];
  initiatives: { id: number; title: string }[];
  defaults?: TaskFormDefaults;
  onDone: (id: number, kind: "task" | "initiative") => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const uid = useId();
  const [kind, setKind] = useState<"task" | "initiative">(defaults.kind ?? "task");
  const [lane, setLane] = useState<Lane | "">(defaults.lane ?? "");
  const form = useServerForm(kind === "task" ? addTaskAction : createInitiativeAction, {
    onSuccess: (s) => s.id && onDone(s.id, kind),
  });
  const { state, pending } = form;
  const err = state.fieldErrors ?? {};
  const id = (name: string) => `${uid}-${name}`;
  const ctl = (name: string, hint?: unknown) => ({
    id: id(name),
    name,
    invalid: !!err[name],
    "aria-describedby": describedBy(id(name), err[name], hint),
  });

  const repoHint =
    lane === "delegate"
      ? repos.length
        ? "Required: Delegate Tasks must target a registered Repo."
        : "Required for Delegate, but no Repos are registered. Run `todo repo add <name> <path>`."
      : undefined;

  return (
    <form onSubmit={form.onSubmit} className="flex flex-col gap-4" noValidate={false}>
      <div role="radiogroup" aria-label="What to add" className="inline-flex w-fit gap-1 rounded-full bg-mantle p-1">
        {(["task", "initiative"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => {
              setKind(k);
              form.reset();
            }}
            className={clsx(
              "h-8 rounded-full px-4 text-ui font-semibold transition-colors",
              kind === k ? "bg-surface0 text-text" : "text-subtext0 hover:text-text",
            )}
          >
            {k === "task" ? "Task" : "Initiative"}
          </button>
        ))}
      </div>

      <Field id={id("title")} label="Title" error={err.title}>
        <Input
          {...ctl("title")}
          required
          autoFocus={autoFocus}
          data-autofocus
          autoComplete="off"
          placeholder={
            kind === "task" ? "What needs doing?" : "The larger effort, e.g. Migrate checkout to the new rate limiter"
          }
        />
      </Field>

      {kind === "task" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <LanePicker
              legend="Lane"
              name="lane"
              value={lane}
              onChange={setLane}
              required
              invalid={!!err.lane}
              describedBy={`${id("lane")}-hint`}
            />
            <p
              id={`${id("lane")}-hint`}
              className={clsx("mt-1.5 text-xs", err.lane ? "font-medium text-red" : "text-subtext0")}
            >
              {err.lane ?? (lane ? LANE_INFO[lane].description : "Who acts next, and how. Pick one.")}
            </p>
          </div>
          <Field id={id("repo")} label="Repo" optional={lane !== "delegate"} error={err.repo} hint={repoHint}>
            <Select {...ctl("repo", repoHint)} required={lane === "delegate"} defaultValue="">
              <option value="">{lane === "delegate" ? "Choose a Repo…" : "None"}</option>
              {repos.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("priority")} label="Priority" error={err.priority}>
          <Select {...ctl("priority")} defaultValue="normal">
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={id("dueDate")} label="Due date" optional error={err.dueDate}>
          <Input {...ctl("dueDate")} type="date" />
        </Field>
      </div>

      <Field id={id("description")} label="Description" optional error={err.description}>
        <Textarea {...ctl("description")} rows={3} placeholder="What done looks like, constraints, context…" />
      </Field>

      <Field
        id={id("people")}
        label="People"
        optional
        error={err.people}
        hint="Names or @handles, comma-separated. New People are created."
      >
        <Input {...ctl("people", true)} autoComplete="off" placeholder="Priya Shah, @marcus" />
      </Field>

      <fieldset className="flex flex-col gap-3 rounded-2xl bg-mantle/60 p-4 pt-2">
        <legend className="px-1 text-ui font-semibold text-subtext1">
          Source <span className="font-normal text-overlay1">· optional</span>
        </legend>
        <Field id={id("sourceUrl")} label="Link" error={err.sourceUrl}>
          <Input {...ctl("sourceUrl")} type="url" inputMode="url" placeholder="https://…" />
        </Field>
        <Field
          id={id("sourceSummary")}
          label="Summary"
          error={err.sourceSummary}
          hint="The relevant context, so it can be acted on without opening the link."
        >
          <Textarea {...ctl("sourceSummary", true)} rows={2} />
        </Field>
      </fieldset>

      {kind === "task" && initiatives.length > 0 && (
        <Field id={id("parentId")} label="Initiative" optional error={err.parentId}>
          <Select {...ctl("parentId")} defaultValue={defaults.parentId ? String(defaults.parentId) : ""}>
            <option value="">None</option>
            {initiatives.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {state.duplicates && state.duplicates.length > 0 && (
        <div role="alert" className="rounded-2xl border-2 border-peach/60 bg-peach/10 p-4 text-ui">
          <p className="flex items-center gap-1.5 font-semibold text-peach">
            <TriangleAlert aria-hidden className="size-4" />
            This Source is already on file
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {state.duplicates.flatMap((d) =>
              d.tasks.map((t) => (
                <li key={`${d.url}-${t.id}`} className="flex items-center gap-2">
                  {t.lane && (
                    <span className="size-2 rounded-full" style={{ backgroundColor: LANE_COLOR[t.lane] }} aria-hidden />
                  )}
                  <Link
                    href={`/tasks/${t.id}`}
                    className="truncate font-semibold text-mauve hover:underline"
                    onClick={onCancel}
                  >
                    {t.title}
                  </Link>
                  <span className="text-xs text-subtext0">{STATUS_LABEL[t.status]}</span>
                </li>
              )),
            )}
          </ul>
          <p className="mt-2 text-xs text-subtext0">Update the existing Task instead, or add this one anyway.</p>
        </div>
      )}

      <FormError state={state} />

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {state.duplicates?.length ? (
          <SubmitButton pending={pending} name="force" value="1">
            Add anyway
          </SubmitButton>
        ) : (
          <SubmitButton pending={pending}>{kind === "task" ? "Add Task" : "Create Initiative"}</SubmitButton>
        )}
      </div>
    </form>
  );
}
