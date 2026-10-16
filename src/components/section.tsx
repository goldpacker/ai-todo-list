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
        <h1 className="flex min-w-0 items-center gap-2.5 text-lg font-semibold tracking-tight text-fg">
          {icon}
          <span className="truncate">{title}</span>
          {meta && <span className="text-sm font-normal text-subtle tabular-nums">{meta}</span>}
        </h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-2 max-w-2xl text-ui text-muted">{children}</div>}
    </header>
  );
}

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
      <div className="mb-1 flex items-center justify-between gap-2 border-b border-line pb-1.5">
        <h2 className="flex items-center gap-2 text-xs font-medium text-muted">
          {icon}
          {title}
          {count !== undefined && <span className="text-subtle tabular-nums">{count}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
