"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import type { ActionState } from "@/lib/mutations";
import { Button, Spinner, type ButtonSize, type ButtonVariant } from "./button";

type ServerAction = (fd: FormData) => Promise<ActionState>;

/**
 * Submits a form to a Server Action inside a transition and keeps the typed values on error
 * (unlike `<form action>`, which resets uncontrolled fields after every submission).
 */
export function useServerForm(action: ServerAction, options: { onSuccess?: (state: ActionState) => void } = {}) {
  const [state, setState] = useState<ActionState>({ ok: false });
  const [pending, startTransition] = useTransition();

  function submit(fd: FormData, form?: HTMLFormElement) {
    startTransition(async () => {
      const result = await action(fd);
      setState(result);
      if (result.ok) {
        form?.reset();
        options.onSuccess?.(result);
      }
    });
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    submit(new FormData(form, submitter), form);
  }

  function reset() {
    setState({ ok: false });
  }

  return { state, pending, onSubmit, submit, reset };
}

export function FormError({ state }: { state: ActionState }) {
  if (state.ok || !state.message || state.duplicates) return null;
  return (
    <p role="alert" className="flex items-start gap-1.5 rounded-md bg-danger-soft px-2.5 py-2 text-ui text-danger">
      <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>{state.message}</span>
    </p>
  );
}

export function SubmitButton({
  pending,
  children,
  variant = "primary",
  size = "md",
  ...rest
}: {
  pending: boolean;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  name?: string;
  value?: string;
  className?: string;
}) {
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} aria-busy={pending || undefined} {...rest}>
      {pending && <Spinner />}
      {children}
    </Button>
  );
}
