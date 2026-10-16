import clsx from "clsx";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  icon,
  meta,
  actions,
  children,
}: {
  title: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex min-w-0 flex-wrap items-center gap-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {icon}
          <span className="min-w-0">{title}</span>
          {meta !== undefined && (
            <span className="rounded-full bg-surface1 px-2.5 py-0.5 font-sans text-sm font-bold text-text tabular-nums">
              {meta}
            </span>
          )}
        </h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-2.5 max-w-2xl text-sm text-subtext0">{children}</div>}
    </header>
  );
}

/** A titled group on a page (detail sections, status groups). */
export function Section({
  title,
  icon,
  count,
  action,
  children,
}: {
  title: ReactNode;
  icon?: ReactNode;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          {icon}
          {title}
          {count !== undefined && (
            <span className="rounded-full bg-surface1 px-2 font-sans text-xs font-bold text-text tabular-nums">
              {count}
            </span>
          )}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A rounded mantle board column with a display-font header and a count badge. */
export function BoardColumn({
  title,
  count,
  accent = false,
  header,
  className,
  children,
}: {
  title: ReactNode;
  count?: number;
  accent?: boolean;
  header?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={clsx("flex min-w-0 flex-col gap-3 rounded-[20px] bg-mantle p-4", className)}>
      <div className="flex flex-col gap-1.5 px-1 pt-0.5">
        <h2 className="flex items-center gap-2 font-display text-[17px] font-bold">
          {title}
          {count !== undefined && (
            <span
              className={clsx(
                "rounded-full px-2.5 font-sans text-xs leading-5 font-bold tabular-nums",
                accent ? "bg-mauve text-on" : "bg-surface1 text-text",
              )}
            >
              {count}
            </span>
          )}
        </h2>
        {header}
      </div>
      {children}
    </section>
  );
}

/** Empty column copy with a little personality. */
export function ColumnEmpty({ emoji, children }: { emoji: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-surface0 px-4 py-8 text-center text-ui text-subtext0">
      <span aria-hidden className="text-2xl">
        {emoji}
      </span>
      {children}
    </div>
  );
}
