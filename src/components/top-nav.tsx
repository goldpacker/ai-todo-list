"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { openNewTask } from "./events";

const ITEMS = [
  { href: "/", label: "Lanes" },
  { href: "/today", label: "Today" },
  { href: "/initiatives", label: "Initiatives" },
  { href: "/people", label: "People" },
];

function isActive(pathname: string, href: string) {
  // Lane pages (/lanes/review) sit under the Lanes board, which is the home page.
  if (href === "/") return pathname === "/" || pathname.startsWith("/lanes/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Pill navigation. On phones it drops to its own row and scrolls sideways inside itself. */
export function TopNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-1.5 overflow-x-auto px-4 pb-0.5 sm:order-none sm:mx-0 sm:ml-3 sm:w-auto sm:px-0"
    >
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "shrink-0 rounded-full px-3.5 py-2 text-sm transition-colors",
              active ? "bg-surface0 font-semibold text-text" : "text-subtext0 hover:bg-surface0/60 hover:text-text",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AddTaskButton() {
  return (
    <button
      type="button"
      onClick={() => openNewTask()}
      aria-keyshortcuts="n"
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-mauve px-3 text-sm font-bold text-on transition-[background-color,transform] hover:bg-lavender active:scale-[0.97] sm:h-[38px] sm:px-[18px]"
    >
      <Plus aria-hidden className="size-4" strokeWidth={3} />
      <span className="hidden sm:inline">Add task</span>
      <span className="sr-only sm:hidden">Add task</span>
    </button>
  );
}
