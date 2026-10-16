import clsx from "clsx";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

const control =
  "w-full rounded-xl border bg-mantle px-3 text-sm text-text placeholder:text-overlay1 transition-colors hover:border-surface2 focus-visible:border-mauve focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-mauve/25 disabled:opacity-60";

const tone = (invalid?: boolean) => (invalid ? "border-red" : "border-surface1");

type Invalid = { invalid?: boolean };

export function Input({ className, invalid, ...props }: InputHTMLAttributes<HTMLInputElement> & Invalid) {
  return (
    <input aria-invalid={invalid || undefined} className={clsx(control, tone(invalid), "h-10", className)} {...props} />
  );
}

export function Textarea({ className, invalid, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & Invalid) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={clsx(control, tone(invalid), "min-h-20 resize-y py-2 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Select({ className, invalid, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & Invalid) {
  return (
    <div className={clsx("relative", className)}>
      <select
        aria-invalid={invalid || undefined}
        className={clsx(control, tone(invalid), "h-10 appearance-none pr-8")}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-overlay1"
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
    <div className={clsx("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-ui font-semibold text-subtext1">
        {label}
        {optional && <span className="font-normal text-overlay1"> · optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-red">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-subtext0">
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
