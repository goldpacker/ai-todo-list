"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { Layers, Menu, Plus, Sun, Users, X } from "lucide-react";
import type { Lane } from "@/core/domain";
import { LANE_COLOR } from "@/lib/ui-meta";
import { Kbd } from "./ui/badge";
import { openNewTask } from "./events";

export interface NavItem {
  href: string;
  label: string;
  icon: "today" | "lane" | "initiatives" | "people";
  lane?: Lane;
  count: number;
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function ItemIcon({ item }: { item: NavItem }) {
  if (item.icon === "lane" && item.lane) {
    return (
      <span className="flex size-4 items-center justify-center" aria-hidden>
        <span className="size-2 rounded-full" style={{ backgroundColor: LANE_COLOR[item.lane] }} />
      </span>
    );
  }
  const Icon = item.icon === "today" ? Sun : item.icon === "initiatives" ? Layers : Users;
  return <Icon aria-hidden className="size-4 text-subtle" />;
}

function NavList({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate?: () => void }) {
  const groups = [
    items.filter((i) => i.icon === "today"),
    items.filter((i) => i.icon === "lane"),
    items.filter((i) => i.icon === "initiatives" || i.icon === "people"),
  ];
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {groups.map((group, gi) => (
        <div key={gi}>
          {gi === 1 && <p className="mb-1 px-2 text-2xs font-medium tracking-wide text-subtle uppercase">Lanes</p>}
          <ul className="flex flex-col gap-px">
            {group.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "flex h-8 items-center gap-2.5 rounded-md px-2 text-ui transition-colors",
                      active ? "bg-active font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg",
                    )}
                  >
                    <ItemIcon item={item} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.count > 0 && <span className="text-xs text-subtle tabular-nums">{item.count}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-md text-sm font-semibold tracking-tight text-fg">
      <span className="flex size-5 items-center justify-center rounded-[5px] bg-fg text-bg" aria-hidden>
        <svg viewBox="0 0 12 12" className="size-3" fill="none">
          <path
            d="M2.5 6.2 5 8.5l4.5-5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      Todo
    </Link>
  );
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-line bg-bg-subtle px-3 md:flex">
        <div className="flex h-14 items-center justify-between px-2">
          <Brand />
        </div>
        <button
          type="button"
          onClick={() => openNewTask()}
          className="mb-5 flex h-8 items-center gap-2 rounded-md border border-line-strong bg-bg px-2 text-ui text-muted shadow-[0_1px_0_rgb(0_0_0/0.02)] transition-colors hover:text-fg"
        >
          <Plus aria-hidden className="size-4" />
          <span className="flex-1 text-left">New task</span>
          <Kbd>N</Kbd>
        </button>
        <div className="flex-1 overflow-y-auto pb-6">
          <NavList items={items} pathname={pathname} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur md:hidden">
        <div className="flex h-12 items-center justify-between px-4">
          <Brand />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => openNewTask()}
              aria-label="New task"
              className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-fg"
            >
              <Plus className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-fg"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div id="mobile-nav" className="max-h-[calc(100dvh-3rem)] overflow-y-auto border-t border-line px-3 py-4">
            <NavList items={items} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
          </div>
        )}
      </div>
    </>
  );
}
