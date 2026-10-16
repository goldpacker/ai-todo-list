import clsx from "clsx";
import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "danger" | "warn";

const tones: Record<BadgeTone, string> = {
  neutral: "border-line text-muted",
  accent: "border-transparent bg-accent-soft text-accent",
  danger: "border-transparent bg-danger-soft text-danger",
  warn: "border-line text-warn",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 text-2xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ color, className, label }: { color: string; className?: string; label?: string }) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={clsx("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded border border-line-strong px-1 font-sans text-2xs font-medium text-subtle">
      {children}
    </kbd>
  );
}
