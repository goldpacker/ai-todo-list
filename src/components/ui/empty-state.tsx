import type { ReactNode } from "react";

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line px-6 py-14 text-center">
      {icon && <div className="mb-3 text-subtle [&_svg]:size-5">{icon}</div>}
      <p className="text-sm font-medium text-fg">{title}</p>
      {children && <div className="mt-1.5 max-w-sm text-ui text-muted">{children}</div>}
    </div>
  );
}
