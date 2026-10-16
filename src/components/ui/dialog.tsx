"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Modal built on the native <dialog> element: focus trapping, Escape-to-close and the top layer come
 * from the browser. Controlled by `open`; `onClose` fires for Escape, backdrop clicks and the close button.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // showModal() focuses the first focusable element (the close button); start in the first field instead.
      el.querySelector<HTMLElement>(
        "[data-autofocus], input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])",
      )?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="ui-dialog"
      style={wide ? { width: "min(40rem, calc(100vw - 2rem))" } : undefined}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        // A press on the backdrop targets the <dialog> element itself.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-4rem)] flex-col">
          <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-sm font-semibold text-fg">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-0.5 text-ui text-muted">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 rounded-md p-1 text-subtle hover:bg-hover hover:text-fg"
            >
              <X className="size-4" />
            </button>
          </header>
          <div className="overflow-y-auto px-5 pb-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
