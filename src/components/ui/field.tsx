import clsx from "clsx";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

const control =
  "w-full rounded-md border bg-bg px-2.5 text-ui text-fg placeholder:text-subtle transition-colors hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft disabled:opacity-60";

const tone = (invalid?: boolean) => (invalid ? "border-danger" : "border-line");

type Invalid = { invalid?: boolean };

export function Input({ className, invalid, ...props }: InputHTMLAttributes<HTMLInputElement> & Invalid) {
  return (
    <input aria-invalid={invalid || undefined} className={clsx(control, tone(invalid), "h-8", className)} {...props} />
  );
}

export function Textarea({ className, invalid, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & Invalid) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={clsx(control, tone(invalid), "min-h-20 resize-y py-1.5 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Select({ className, invalid, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & Invalid) {
  return (
    <div className={clsx("relative", className)}>
      <select
        aria-invalid={invalid || undefined}
        className={clsx(control, tone(invalid), "h-8 appearance-none pr-7")}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-subtle"
      />
    </div>
  );
}

/** Label + control + hint/error, wired up for screen readers via ids. */
export function Field({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={clsx("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
        {optional && <span className="font-normal text-subtle"> · optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** aria-describedby value for a control rendered inside <Field>. */
export function describedBy(id: string, error?: string, hint?: unknown) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}
