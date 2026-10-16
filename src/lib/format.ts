// Pure presentation helpers (no domain rules): relative dates and small text utilities.
// Callers pass `now` / `today` explicitly so output is deterministic and render-safe.

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar date as YYYY-MM-DD. */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateParts(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Whole calendar days from `today` to `date` (both YYYY-MM-DD); negative when in the past. */
export function daysBetween(today: string, date: string): number {
  return Math.round((dateParts(date).getTime() - dateParts(today).getTime()) / DAY_MS);
}

export function shortDate(date: string, today?: string): string {
  const d = dateParts(date);
  const sameYear = !today || today.slice(0, 4) === date.slice(0, 4);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}${sameYear ? "" : `, ${d.getUTCFullYear()}`}`;
}

export type DueTone = "overdue" | "today" | "soon" | "later";

/** "Overdue 2d", "Due today", "Due tomorrow", "Due Fri", "Due Oct 24". */
export function dueLabel(dueDate: string, today: string): { text: string; tone: DueTone } {
  const diff = daysBetween(today, dueDate);
  if (diff < 0) return { text: `Overdue ${-diff}d`, tone: "overdue" };
  if (diff === 0) return { text: "Due today", tone: "today" };
  if (diff === 1) return { text: "Due tomorrow", tone: "soon" };
  if (diff < 7) return { text: `Due ${WEEKDAYS[dateParts(dueDate).getUTCDay()]}`, tone: "soon" };
  return { text: `Due ${shortDate(dueDate, today)}`, tone: "later" };
}

/** "just now", "5m ago", "3h ago", "2d ago", or a short date beyond two weeks. */
export function timeAgo(iso: string, now: Date): string {
  const ms = now.getTime() - Date.parse(iso);
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  return shortDate(toDateString(new Date(iso)), toDateString(now));
}

/** "in 1h 35m", "in 12m", "now". */
export function timeUntil(iso: string, now: Date): string {
  const min = Math.round((Date.parse(iso) - now.getTime()) / 60000);
  if (min <= 0) return "now";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `in ${m}m`;
  return m === 0 ? `in ${h}h` : `in ${h}h ${m}m`;
}

/** Full local timestamp for `title` tooltips. */
export function fullTimestamp(iso: string): string {
  const d = new Date(iso);
  return `${toDateString(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function initials(name: string): string {
  const parts = name
    .replace(/^@/, "")
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Shortens a URL for display: host + path, without protocol or trailing slash. */
export function displayUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = (u.pathname + u.search).replace(/\/$/, "");
    const full = u.host.replace(/^www\./, "") + path;
    return full.length > 64 ? `${full.slice(0, 61)}…` : full;
  } catch {
    return url;
  }
}

export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}
