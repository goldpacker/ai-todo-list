import type {
  PersonSummary,
  SyncResult,
  TaskDetail,
  TaskSummary,
  TodayView,
  PersonRefView,
  LaneChangeView,
  SourceView,
} from "../core";

// Human-readable output. Machine output is the core's own JSON, so nothing here is load-bearing for agents.

export interface Style {
  bold(s: string): string;
  dim(s: string): string;
}

export const plain: Style = { bold: (s) => s, dim: (s) => s };
export const ansi: Style = { bold: (s) => `\x1b[1m${s}\x1b[22m`, dim: (s) => `\x1b[2m${s}\x1b[22m` };

const pad = (n: number) => String(n).padStart(2, "0");

export function time(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Renders rows as left-aligned columns; the last column is never padded. */
export function table(rows: string[][], header?: string[], style: Style = plain): string {
  const all = header ? [header, ...rows] : rows;
  if (!all.length) return "";
  const widths = all[0].map((_, i) => Math.max(...all.map((r) => visibleLength(r[i] ?? ""))));
  const line = (r: string[]) =>
    r
      .map((cell, i) => (i === r.length - 1 ? cell : cell + " ".repeat(widths[i] - visibleLength(cell))))
      .join("  ")
      .trimEnd();
  const out = rows.map(line);
  return (header ? [style.dim(line(header)), ...out] : out).join("\n");
}

function visibleLength(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

const handleOf = (p: { name: string; handles: string[] }) => p.handles.find((h) => h.startsWith("@"));

export function personLabel(p: PersonRefView): string {
  const extra = [handleOf(p), p.role].filter(Boolean);
  return extra.length ? `${p.name} (${extra.join(", ")})` : p.name;
}

function laneOf(t: TaskSummary): string {
  return t.kind === "initiative" ? "initiative" : (t.lane ?? "");
}

function due(t: TaskSummary): string {
  if (!t.dueDate) return "";
  if (t.overdue) return `${t.dueDate}!`;
  return t.dueDate;
}

function extras(t: TaskSummary): string {
  const bits: string[] = [];
  if (t.progress) bits.push(`${t.progress.resolved}/${t.progress.total} done`);
  if (t.repo) bits.push(`repo:${t.repo}`);
  if (t.people.length) bits.push(t.people.map((p) => handleOf(p) ?? p.name).join(", "));
  if (t.parent) bits.push(`in #${t.parent.id}`);
  if (t.claimedBy) bits.push(`claimed by ${t.claimedBy}`);
  if (t.prUrl) bits.push(t.prUrl);
  return bits.join(" · ");
}

export function taskList<T extends TaskSummary>(
  tasks: T[],
  style: Style,
  empty = "No Tasks.",
  extra?: (t: T) => string,
): string {
  if (!tasks.length) return style.dim(empty);
  const rows = tasks.map((t) => {
    const more = [extra?.(t), extras(t)].filter(Boolean).join(" · ");
    return [`#${t.id}`, laneOf(t), t.status, t.priority, due(t), more ? `${t.title}  ${style.dim(more)}` : t.title];
  });
  return table(rows, ["ID", "LANE", "STATUS", "PRI", "DUE", "TITLE"], style);
}

export function today(view: TodayView, style: Style): string {
  const head = style.bold(`Today ${view.date}`) + style.dim(` · ${view.total} Task${view.total === 1 ? "" : "s"}`);
  if (!view.total) return `${head}\n${style.dim("Nothing needs you right now.")}`;
  const sections = view.lanes.map((g) => {
    const rows = g.tasks.map((t) => [
      `#${t.id}`,
      t.status,
      t.priority,
      due(t),
      t.title,
      style.dim(t.reasons.join(", ")),
    ]);
    return `${style.bold(g.name)}\n${indent(table(rows))}`;
  });
  return [head, ...sections].join("\n\n");
}

function indent(s: string, by = "  "): string {
  return s
    .split("\n")
    .map((l) => (l ? by + l : l))
    .join("\n");
}

function laneChange(c: LaneChangeView): string {
  return `${time(c.createdAt)}  ${c.fromLane} → ${c.toLane} (${c.actor}): ${c.reason}`;
}

export function taskDetail(t: TaskDetail, style: Style): string {
  const out: string[] = [];
  out.push(style.bold(`#${t.id}  ${t.title}`));
  const facts = [
    t.kind === "initiative" ? "initiative" : `lane ${t.lane}`,
    `status ${t.status}`,
    `priority ${t.priority}`,
  ];
  if (t.dueDate) facts.push(`due ${t.dueDate}${t.overdue ? " (overdue)" : t.dueToday ? " (today)" : ""}`);
  if (t.progress) facts.push(`${t.progress.resolved}/${t.progress.total} children resolved`);
  out.push(facts.join(" · "));

  const kv: [string, string][] = [];
  if (t.repoDetail) kv.push(["Repo", `${t.repoDetail.name}  ${style.dim(t.repoDetail.path)}`]);
  if (t.parent) kv.push(["Initiative", `#${t.parent.id} ${t.parent.title}`]);
  if (t.people.length) kv.push(["People", t.people.map(personLabel).join(", ")]);
  if (t.claimedBy) kv.push(["Claimed", `by ${t.claimedBy} until ${time(t.claimExpiresAt)}`]);
  if (t.status === "waiting" && t.waitingNote) {
    kv.push(["Waiting", `${t.waitingNote} ${style.dim(`(since ${time(t.waitingSince)})`)}`]);
    kv.push(["Follow up", `after ${t.followUpDays} days${t.followUpDue ? " (due now)" : ""}`]);
  }
  if (t.prUrl) kv.push(["PR", t.prUrl]);
  kv.push(["Created", time(t.createdAt)]);
  if (t.resolvedAt) kv.push(["Resolved", time(t.resolvedAt)]);
  out.push(table(kv.map(([k, v]) => [style.dim(k), v])));

  const section = (title: string, body: string) => out.push("", style.bold(title), indent(body));
  if (t.description.trim()) section("Description", t.description.trim());
  const sources = (list: SourceView[]) =>
    list.map((s) => `${style.dim(`[source #${s.id}]`)} ${s.url ?? "(no URL)"}\n${indent(s.summary.trim())}`).join("\n");
  if (t.sources.length) section("Sources", sources(t.sources));
  if (t.parentContext) {
    const p = t.parentContext;
    const body = [p.description.trim(), p.sources.length ? sources(p.sources) : ""].filter(Boolean).join("\n\n");
    section(`Initiative #${p.id}: ${p.title}`, body || style.dim("No description or Sources."));
  }
  for (const p of t.preps) {
    section(`Prep: ${p.kind}`, `${style.dim(`by ${p.author}, ${time(p.createdAt)}`)}\n\n${p.body.trim()}`);
  }
  if (t.laneChanges.length) section("Lane changes", t.laneChanges.map(laneChange).join("\n"));
  if (t.notes.length) {
    section("Notes", t.notes.map((n) => `${style.dim(`${time(n.createdAt)} ${n.author}:`)} ${n.body}`).join("\n"));
  }
  if (t.kind === "initiative") section("Children", taskList(t.children, style, "No child Tasks yet."));
  return out.join("\n");
}

export function people(list: PersonSummary[], style: Style): string {
  if (!list.length) return style.dim("No People yet.");
  return table(
    list.map((p) => [String(p.id), p.name, p.handles.join(", "), String(p.activeTaskCount)]),
    ["ID", "NAME", "HANDLES", "ACTIVE"],
    style,
  );
}

export function sync(result: SyncResult, style: Style): string {
  const groups: [string, { id: number; title?: string; prUrl: string; message?: string }[]][] = [
    ["Merged → done", result.merged],
    ["Closed → open", result.closed],
    ["Still open", result.unchanged],
    ["Errors", result.errors],
  ];
  const shown = groups.filter(([, items]) => items.length);
  if (!shown.length) return style.dim("No ready Delegate Tasks with a PR to sync.");
  return shown
    .map(
      ([title, items]) =>
        `${style.bold(title)}\n${indent(
          items.map((i) => `#${i.id}${i.title ? ` ${i.title}` : ""}  ${style.dim(i.message ?? i.prUrl)}`).join("\n"),
        )}`,
    )
    .join("\n\n");
}

/** Pretty error details for the common domain error shapes; falls back to compact JSON. */
export function errorDetails(code: string, details: unknown): string[] {
  if (!details || typeof details !== "object") return [];
  const d = details as Record<string, unknown>;
  const lines: string[] = [];
  if (Array.isArray(d.issues)) {
    for (const i of d.issues as { path: string; message: string }[])
      lines.push(`  ${i.path || "(input)"}: ${i.message}`);
  }
  if (Array.isArray(d.matches)) {
    for (const m of d.matches as {
      url: string;
      tasks: { id: number; title: string; status: string; lane: string }[];
    }[]) {
      lines.push(`  ${m.url}`);
      for (const t of m.tasks) lines.push(`    #${t.id} [${t.lane ?? "initiative"}, ${t.status}] ${t.title}`);
    }
  }
  if (Array.isArray(d.known)) {
    lines.push(
      d.known.length
        ? `  Known repos: ${(d.known as string[]).join(", ")}`
        : "  No repos registered yet; add one with `todo repo add <name> <path>`.",
    );
  }
  if (Array.isArray(d.allowed)) lines.push(`  Allowed from ${d.from}: ${(d.allowed as string[]).join(", ") || "none"}`);
  if (Array.isArray(d.tasks)) {
    for (const t of d.tasks as { id: number; title: string }[]) lines.push(`  #${t.id} ${t.title}`);
  }
  if (Array.isArray(d.people)) {
    const known = (d.people as { name: string; handles: string[] }[]).map((p) =>
      p.handles.length ? `${p.name} (${p.handles.join(", ")})` : p.name,
    );
    lines.push(known.length ? `  Known people: ${known.join(", ")}` : "  No People recorded yet.");
  }
  if (Array.isArray(d.conflicts)) for (const c of d.conflicts as string[]) lines.push(`  ${c}`);
  if (code === "CLAIM_CONFLICT" && typeof d.claimedBy === "string") lines.push(`  Claimed by: ${d.claimedBy}`);
  return lines;
}
