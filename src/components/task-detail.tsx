import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRightLeft,
  Bot,
  ChevronRight,
  CirclePause,
  ExternalLink,
  FileText,
  GitPullRequest,
  Link2,
  MessageSquare,
  Plus,
  CircleCheck,
} from "lucide-react";
import type { TaskDetail } from "@/core/core";
import { LANE_INFO } from "@/core/domain";
import {
  displayUrl,
  fullTimestamp,
  isHttpUrl,
  plural,
  timeAgo,
  timeUntil,
  toDateString,
  dueLabel,
  shortDate,
} from "@/lib/format";
import { PREP_KIND_LABEL, STATUS_LABEL } from "@/lib/ui-meta";
import { Markdown } from "./markdown";
import { NoteForm } from "./note-form";
import { Section } from "./section";
import { TaskActions } from "./task-actions";
import { Avatar, LaneDot, LaneTag, PriorityMark, ProgressBar, StatusTag } from "./task-bits";
import { TaskList, TaskRow } from "./task-row";
import { Badge } from "./ui/badge";

function Time({ iso, now }: { iso: string; now: Date }) {
  return (
    <time dateTime={iso} title={fullTimestamp(iso)}>
      {timeAgo(iso, now)}
    </time>
  );
}

function Banner({
  icon,
  tone = "neutral",
  children,
}: {
  icon: ReactNode;
  tone?: "neutral" | "accent" | "warn";
  children: ReactNode;
}) {
  const tones = {
    neutral: "border-line bg-bg-subtle",
    accent: "border-transparent bg-accent-soft",
    warn: "border-line bg-bg-subtle",
  };
  const iconTone = { neutral: "text-subtle", accent: "text-accent", warn: "text-warn" };
  return (
    <div className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-ui ${tones[tone]}`}>
      <span className={`mt-0.5 shrink-0 [&_svg]:size-3.5 ${iconTone[tone]}`}>{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-baseline gap-2 py-1.5 lg:grid-cols-1 lg:gap-0.5">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="min-w-0 text-ui text-fg">{children}</dd>
    </div>
  );
}

type ActivityEntry = { at: string; icon: ReactNode; body: ReactNode };

function activityFor(task: TaskDetail): ActivityEntry[] {
  const entries: ActivityEntry[] = [
    { at: task.createdAt, icon: <Plus />, body: <span className="text-muted">Captured</span> },
    ...task.laneChanges.map((c) => ({
      at: c.createdAt,
      icon: <ArrowRightLeft />,
      body: (
        <div>
          <p className="text-muted">
            <span className="text-fg">{c.actor === "engineer" ? "You" : "Agent"}</span> moved from{" "}
            <span className="inline-flex items-center gap-1 text-fg">
              <LaneDot lane={c.fromLane} /> {LANE_INFO[c.fromLane].name}
            </span>{" "}
            to{" "}
            <span className="inline-flex items-center gap-1 text-fg">
              <LaneDot lane={c.toLane} /> {LANE_INFO[c.toLane].name}
            </span>
          </p>
          <p className="mt-0.5 text-fg">{c.reason}</p>
        </div>
      ),
    })),
    ...task.notes.map((n) => ({
      at: n.createdAt,
      icon: <MessageSquare />,
      body: (
        <div>
          <p className="text-xs text-subtle">{n.author}</p>
          <p className="whitespace-pre-wrap text-fg">{n.body}</p>
        </div>
      ),
    })),
  ];
  if (task.resolvedAt && (task.status === "done" || task.status === "dropped")) {
    entries.push({
      at: task.resolvedAt,
      icon: <CircleCheck />,
      body: <span className="text-muted">Marked {STATUS_LABEL[task.status].toLowerCase()}</span>,
    });
  }
  return entries.sort((a, b) => a.at.localeCompare(b.at));
}

/** Everything about one Task (or Initiative) in one place. */
export function TaskDetailView({ task, repos, now }: { task: TaskDetail; repos: string[]; now: Date }) {
  const today = toDateString(now);
  const isInitiative = task.kind === "initiative";
  const active = !["done", "dropped"].includes(task.status);
  const preps = [...task.preps].reverse();
  const activity = activityFor(task);

  return (
    <article>
      <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-xs text-subtle">
        {isInitiative ? (
          <Link href="/initiatives" className="hover:text-fg">
            Initiatives
          </Link>
        ) : (
          task.lane && (
            <Link href={`/lanes/${task.lane}`} className="inline-flex items-center gap-1.5 hover:text-fg">
              <LaneDot lane={task.lane} /> {LANE_INFO[task.lane].name}
            </Link>
          )
        )}
        {task.parent && (
          <>
            <ChevronRight aria-hidden className="size-3" />
            <Link href={`/initiatives/${task.parent.id}`} className="truncate hover:text-fg">
              {task.parent.title}
            </Link>
          </>
        )}
        <ChevronRight aria-hidden className="size-3" />
        <span className="font-mono">#{task.id}</span>
      </nav>

      <h1 className="mb-4 text-xl font-semibold tracking-tight text-balance text-fg">{task.title}</h1>

      <div className="mb-6">
        <TaskActions
          repos={repos}
          task={{
            id: task.id,
            kind: task.kind,
            title: task.title,
            description: task.description,
            status: task.status,
            lane: task.lane,
            priority: task.priority,
            dueDate: task.dueDate,
            repo: task.repo,
            people: task.people.map((p) => p.name),
          }}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <aside className="lg:order-last">
          <dl className="flex flex-col divide-y divide-line border-y border-line lg:divide-y-0 lg:border-y-0 lg:border-l lg:pl-5">
            <Property label="Status">
              <StatusTag status={task.status} />
            </Property>
            {task.lane && (
              <Property label="Lane">
                <Link href={`/lanes/${task.lane}`} className="hover:underline">
                  <LaneTag lane={task.lane} />
                </Link>
              </Property>
            )}
            <Property label="Priority">
              <span className="inline-flex items-center gap-1.5 capitalize">
                <PriorityMark priority={task.priority} />
                {task.priority}
              </span>
            </Property>
            <Property label="Due">
              {task.dueDate ? (
                <span title={task.dueDate}>
                  {shortDate(task.dueDate, today)}
                  {active && dueLabel(task.dueDate, today).tone !== "later" && (
                    <span className="text-subtle"> · {dueLabel(task.dueDate, today).text.replace(/^Due /, "")}</span>
                  )}
                </span>
              ) : (
                <span className="text-subtle">None</span>
              )}
            </Property>
            {!isInitiative && (
              <Property label="Repo">
                {task.repoDetail ? (
                  <span className="flex flex-col">
                    <span className="font-mono text-xs">{task.repoDetail.name}</span>
                    <span className="truncate font-mono text-2xs text-subtle" title={task.repoDetail.path}>
                      {task.repoDetail.path}
                    </span>
                  </span>
                ) : (
                  <span className="text-subtle">None</span>
                )}
              </Property>
            )}
            {task.prUrl && (
              <Property label="Pull request">
                <a
                  href={task.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  <GitPullRequest aria-hidden className="size-3.5" />
                  <span className="truncate">{displayUrl(task.prUrl).replace(/^github\.com\//, "")}</span>
                </a>
              </Property>
            )}
            <Property label="People">
              {task.people.length ? (
                <ul className="flex flex-col gap-1">
                  {task.people.map((p) => (
                    <li key={p.id}>
                      <Link href={`/people/${p.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                        <Avatar name={p.name} />
                        <span className="truncate">{p.name}</span>
                        {p.role && <span className="text-xs text-subtle">{p.role}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-subtle">None</span>
              )}
            </Property>
            {task.parent && (
              <Property label="Initiative">
                <Link href={`/initiatives/${task.parent.id}`} className="line-clamp-2 hover:underline">
                  {task.parent.title}
                </Link>
              </Property>
            )}
            <Property label="Created">
              <span className="text-muted">
                <Time iso={task.createdAt} now={now} />
              </span>
            </Property>
            <Property label="Updated">
              <span className="text-muted">
                <Time iso={task.updatedAt} now={now} />
              </span>
            </Property>
          </dl>
        </aside>

        <div className="flex min-w-0 flex-col gap-8">
          {(task.status === "claimed" || task.status === "waiting" || (task.status === "ready" && task.prUrl)) && (
            <div className="flex flex-col gap-2">
              {task.status === "claimed" && task.claimedBy && (
                <Banner icon={<Bot />} tone="accent">
                  <span className="font-medium text-fg">Claimed by {task.claimedBy}</span>
                  <span className="text-muted">
                    {task.claimedAt && (
                      <>
                        {" "}
                        · since <Time iso={task.claimedAt} now={now} />
                      </>
                    )}
                    {task.claimExpiresAt && (
                      <>
                        {" "}
                        · claim expires{" "}
                        <time dateTime={task.claimExpiresAt} title={fullTimestamp(task.claimExpiresAt)}>
                          {timeUntil(task.claimExpiresAt, now)}
                        </time>
                      </>
                    )}
                  </span>
                </Banner>
              )}
              {task.status === "waiting" && (
                <Banner icon={<CirclePause />} tone="warn">
                  <p className="text-fg">{task.waitingNote}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {task.waitingSince && (
                      <>
                        Waiting since <Time iso={task.waitingSince} now={now} /> ·{" "}
                      </>
                    )}
                    follow-up after {plural(task.followUpDays, "day")}
                    {task.followUpDue && (
                      <Badge tone="warn" className="ml-2">
                        Follow-up due
                      </Badge>
                    )}
                  </p>
                </Banner>
              )}
              {task.status === "ready" && task.prUrl && (
                <Banner icon={<GitPullRequest />} tone="accent">
                  <span className="text-fg">PR is up for your review: </span>
                  <a
                    href={task.prUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-accent hover:underline"
                  >
                    {displayUrl(task.prUrl)}
                  </a>
                </Banner>
              )}
            </div>
          )}

          {task.description ? (
            <Markdown>{task.description}</Markdown>
          ) : (
            <p className="text-ui text-subtle">No description.</p>
          )}

          {isInitiative && (
            <Section
              title="Tasks"
              count={task.children.length}
              action={
                task.progress && task.progress.total > 0 ? (
                  <span className="flex w-40 items-center gap-2">
                    <ProgressBar resolved={task.progress.resolved} total={task.progress.total} className="flex-1" />
                    <span className="text-xs text-subtle tabular-nums">
                      {task.progress.resolved}/{task.progress.total}
                    </span>
                  </span>
                ) : undefined
              }
            >
              {task.children.length ? (
                <TaskList>
                  {task.children.map((c) => (
                    <TaskRow key={c.id} task={c} today={today} showLane showParent={false} />
                  ))}
                </TaskList>
              ) : (
                <p className="py-3 text-ui text-subtle">
                  No Tasks yet. Add one, or ask your agent to file Tasks under this Initiative.
                </p>
              )}
              {task.status === "done" && (
                <p className="mt-2 text-xs text-subtle">
                  Done: every Task is done or dropped. Reopen a Task to reopen the Initiative.
                </p>
              )}
            </Section>
          )}

          {preps.length > 0 && (
            <Section title="Preps" icon={<FileText className="size-3.5" />} count={preps.length}>
              <div className="flex flex-col gap-3 pt-2">
                {preps.map((p, i) => (
                  <details key={p.id} open={i === 0} className="group rounded-lg border border-line">
                    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-2.5 text-ui hover:bg-hover">
                      <ChevronRight
                        aria-hidden
                        className="size-3.5 text-subtle transition-transform group-open:rotate-90"
                      />
                      <span className="font-medium text-fg">{PREP_KIND_LABEL[p.kind]}</span>
                      {i === 0 && preps.length > 1 && <Badge>Latest</Badge>}
                      <span className="ml-auto text-xs text-subtle">
                        {p.author} · <Time iso={p.createdAt} now={now} />
                      </span>
                    </summary>
                    <div className="border-t border-line px-4 py-4 sm:px-5">
                      <Markdown>{p.body}</Markdown>
                    </div>
                  </details>
                ))}
              </div>
            </Section>
          )}

          {task.sources.length > 0 && (
            <Section title="Sources" icon={<Link2 className="size-3.5" />} count={task.sources.length}>
              <ul className="flex flex-col divide-y divide-line">
                {task.sources.map((s) => (
                  <li key={s.id} className="py-3">
                    {s.url ? (
                      isHttpUrl(s.url) ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-center gap-1 text-ui font-medium text-accent hover:underline"
                        >
                          <span className="truncate">{displayUrl(s.url)}</span>
                          <ExternalLink aria-hidden className="size-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="font-mono text-xs text-muted">{s.url}</span>
                      )
                    ) : (
                      <span className="text-xs text-subtle">No link (conversation)</span>
                    )}
                    <p className="mt-1 text-ui whitespace-pre-wrap text-muted">{s.summary}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Activity">
            <ol className="relative mt-3 flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[9px] before:w-px before:bg-line">
              {activity.map((a, i) => (
                <li key={i} className="relative flex gap-3 text-ui">
                  <span className="z-10 flex size-5 shrink-0 items-center justify-center rounded-full border border-line bg-bg text-subtle [&_svg]:size-3">
                    {a.icon}
                  </span>
                  <div className="min-w-0 flex-1 pt-px">{a.body}</div>
                  <span className="shrink-0 pt-px text-xs text-subtle">
                    <Time iso={a.at} now={now} />
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-5">
              <NoteForm taskId={task.id} />
            </div>
          </Section>
        </div>
      </div>
    </article>
  );
}
