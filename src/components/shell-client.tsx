"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { buttonClass, type ButtonVariant } from "./ui/button";
import { openNewTask, type NewTaskRequest } from "./events";

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

const GO_TO: Record<string, string> = { l: "/", t: "/today", i: "/initiatives", p: "/people" };

/** Light keyboard layer: `n`/`c` new Task, `g l` Lanes (home), `g t` Today, `g i` Initiatives, `g p` People. */
export function KeyboardShortcuts() {
  const router = useRouter();
  useEffect(() => {
    let pendingG = 0;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isTyping(e.target)) return;
      if (document.querySelector("dialog[open]")) return;
      const key = e.key.toLowerCase();
      if (pendingG && Date.now() - pendingG < 1200 && GO_TO[key]) {
        e.preventDefault();
        pendingG = 0;
        router.push(GO_TO[key]);
        return;
      }
      pendingG = key === "g" ? Date.now() : 0;
      if (key === "n" || key === "c") {
        e.preventDefault();
        openNewTask();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}

/**
 * Agents write to the database while the page is open, so re-render the current route when the tab
 * regains focus (throttled), unless a dialog is open.
 */
export function RefreshOnFocus() {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    function maybeRefresh() {
      if (document.visibilityState !== "visible" || document.querySelector("dialog[open]")) return;
      if (Date.now() - last < 5000) return;
      last = Date.now();
      router.refresh();
    }
    window.addEventListener("focus", maybeRefresh);
    document.addEventListener("visibilitychange", maybeRefresh);
    return () => {
      window.removeEventListener("focus", maybeRefresh);
      document.removeEventListener("visibilitychange", maybeRefresh);
    };
  }, [router]);
  return null;
}

export function NewTaskButton({
  request,
  children,
  variant = "secondary",
}: {
  request?: NewTaskRequest;
  children?: ReactNode;
  variant?: ButtonVariant;
}) {
  return (
    <button type="button" className={buttonClass(variant, "sm")} onClick={() => openNewTask(request)}>
      <Plus aria-hidden />
      {children ?? "New task"}
    </button>
  );
}
