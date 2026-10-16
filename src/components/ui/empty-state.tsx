import type { ReactNode } from "react";

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-surface0 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-overlay1 [&_svg]:size-6">{icon}</div>}
      <p className="font-display text-base font-bold text-subtext1">{title}</p>
      {children && <div className="mt-1.5 max-w-sm text-ui text-subtext0">{children}</div>}
    </div>
  );
}
