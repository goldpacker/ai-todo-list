import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";

export type PillTone = "none" | "neutral" | "accent" | "red" | "redText" | "yellowText" | "peach" | "green";

const tones: Record<PillTone, string> = {
  none: "",
  neutral: "bg-surface1 text-subtext1",
  accent: "bg-mauve text-on",
  red: "bg-red text-on",
  redText: "bg-mantle text-red ring-1 ring-surface1",
  yellowText: "bg-surface1 text-yellow",
  peach: "bg-peach text-on",
  green: "bg-green text-on",
};

/** Small rounded pill: lanes, reasons, counts. */
export function Pill({
  tone = "neutral",
  className,
  style,
  children,
}: {
  tone?: PillTone;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <span
      style={style}
      className={clsx(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2.5 text-2xs font-bold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-surface1 px-1.5 font-mono text-2xs font-medium text-subtext1">
      {children}
    </kbd>
  );
}
