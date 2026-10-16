import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRightLeft,
  Bot,
  ChevronRight,
  CircleCheck,
  CirclePause,
  ExternalLink,
  FileText,
  GitPullRequest,
  Link2,
  MessageSquare,
  Plus,
} from "lucide-react";
import type { TaskDetail } from "@/core/core";
import {
  displayUrl,
  dueLabel,
  fullTimestamp,
  isHttpUrl,
  plural,
  shortDate,
  timeAgo,
  timeUntil,
  toDateString,
} from "@/lib/format";
import { LANE_COLOR, PREP_KIND_LABEL, STATUS_LABEL } from "@/lib/ui-meta";
import { Markdown } from "./markdown";
import { NoteForm } from "./note-form";
import { Section } from "./section";
import { TaskActions } from "./task-actions";
import { Avatar, DuePill, LanePill, PriorityPill, ProgressBar, StatusTag } from "./task-bits";
import { CardList, TaskCard, defaultContext } from "./task-card";
import { Pill } from "./ui/badge";

function Time({ iso, now }: { iso: string; now: Date }) {
  return (
    <time dateTime={iso} title={fullTimestamp(iso)}>
      {timeAgo(iso, now)}
    </time>
  );
}

const BANNER_TONE = {
  green: { box: "border-2 border-dashed border-green", icon: "bg-green" },
  peach: { box: "border-2 border-transparent", icon: "bg-peach" },
  mauve: { box: "border-2 border-transparent", icon: "bg-mauve" },
};

function Banner({ icon, tone, children }: { icon: ReactNode; tone: keyof typeof BANNER_TONE; children: ReactNode }) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl bg-surface0 px-4 py-3 text-sm ${BANNER_TONE[tone].box}`}>
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-on [&_svg]:size-4 ${BANNER_TONE[tone].icon}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </div>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-baseline gap-2 py-2 lg:grid-cols-1 lg:gap-1">
      <dt className="text-xs font-semibold text-overlay1">{label}</dt>
      <dd className="min-w-0 text-sm text-text">{children}</dd>
    </div>
  );
}

type ActivityEntry = { at: string; icon: ReactNode; color: string; body: ReactNode };

function activityFor(task: TaskDetail): ActivityEntry[] {
  const entries: ActivityEntry[] = [
    {
      at: task.createdAt,
      icon: <Plus />,
      color: "var(--color-surface2)",
      body: <span className="text-subtext0">Captured</span>,
    },
    ...task.laneChanges.map((c) => ({
      at: c.createdAt,
      icon: <ArrowRightLeft />,
      color: LANE_COLOR[c.toLane],
      body: (
        <div>
          <p className="flex flex-wrap items-center gap-1.5 text-subtext0">
            <span className="font-semibold text-text">{c.actor === "engineer" ? "You" : "An agent"}</span> moved it
            <LanePill lane={c.fromLane} />
            <span aria-hidden>→</span>
            <span className="sr-only">to</span>
            <LanePill lane={c.toLane} />
          </p>
          <p className="mt-1 text-text">“{c.reason}”</p>
        </div>
      ),
    })),
    ...task.notes.map((n) => ({
      at: n.createdAt,
      icon: <MessageSquare />,
      color: "var(--color-lavender)",
      body: (
        <div>
          <p className="font-mono text-xs text-overlay1">{n.author}</p>
          <p className="whitespace-pre-wrap text-text">{n.body}</p>
        </div>
      ),
    })),
  ];
  if (task.resolvedAt && (task.status === "done" || task.status === "dropped")) {
    entries.push({
      at: task.resolvedAt,
      icon: <CircleCheck />,
      color: task.status === "done" ? "var(--color-green)" : "var(--color-surface2)",
      body: <span className="text-subtext0">Marked {STATUS_LABEL[task.status].toLowerCase()}</span>,
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
    <article className="mx-auto max-w-6xl">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-ui text-subtext0">
        {isInitiative ? (
          <Link href="/initiatives" className="hover:text-text">
            Initiatives
          </Link>
        ) : (
          task.lane && (
            <Link href={`/lanes/${task.lane}`} className="rounded-full hover:opacity-90">
              <LanePill lane={task.lane} />
            </Link>
          )
        )}
        {task.parent && (
          <>
            <ChevronRight aria-hidden className="size-3.5 text-overlay1" />
            <Link href={`/initiatives/${task.parent.id}`} className="truncate hover:text-text">
              {task.parent.title}
            </Link>
          </>
        )}
        <ChevronRight aria-hidden className="size-3.5 text-overlay1" />
        <span className="font-mono text-xs text-overlay1">#{task.id}</span>
      </nav>

      <h1 className="mb-3 font-display text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl">
        {task.title}
      </h1>
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        <PriorityPill priority={task.priority} />
        <DuePill dueDate={task.dueDate} today={today} active={active} />
        {task.status === "ready" && <Pill tone="accent">ready for you</Pill>}
      </div>

      <div className="mb-8">
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

      <div className="mb-8 lg:mr-[18rem] empty:hidden">
        {(task.status === "claimed" || task.status === "waiting" || (task.status === "ready" && task.prUrl)) && (
          <div className="flex flex-col gap-3">
            {task.status === "claimed" && task.claimedBy && (
              <Banner icon={<Bot />} tone="green">
                <span className="font-semibold">{task.claimedBy} is on it</span>
                <span className="block font-mono text-xs text-green">
                  claimed {task.claimedAt ? <Time iso={task.claimedAt} now={now} /> : "recently"}
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
              <Banner icon={<CirclePause />} tone="peach">
                <p className="font-semibold">{task.waitingNote}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-subtext0">
                  {task.waitingSince && (
                    <span>
                      Waiting since <Time iso={task.waitingSince} now={now} />
                    </span>
                  )}
                  <span>· follow-up after {plural(task.followUpDays, "day")}</span>
                  {task.followUpDue && <Pill tone="peach">follow-up due</Pill>}
                </p>
              </Banner>
            )}
            {task.status === "ready" && task.prUrl && (
              <Banner icon={<GitPullRequest />} tone="mauve">
                <span>PR is up for your review: </span>
                <a
                  href={task.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold break-all text-mauve hover:underline"
                >
                  {displayUrl(task.prUrl)}
                </a>
              </Banner>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <aside className="lg:order-last">
          <dl className="flex flex-col divide-y divide-surface0 rounded-2xl bg-mantle px-4 py-2 lg:sticky lg:top-24 lg:divide-y-0 lg:py-3">
            <Property label="Status">
              <StatusTag status={task.status} />
            </Property>
            {task.lane && (
              <Property label="Lane">
                <Link href={`/lanes/${task.lane}`} className="inline-flex rounded-full hover:opacity-90">
                  <LanePill lane={task.lane} />
                </Link>
              </Property>
            )}
            <Property label="Priority">
              <span className={`capitalize ${task.priority === "high" ? "font-semibold text-red" : ""}`}>
                {task.priority}
              </span>
            </Property>
            <Property label="Due">
              {task.dueDate ? (
                <span title={task.dueDate}>
                  {shortDate(task.dueDate, today)}
                  {active && dueLabel(task.dueDate, today).tone !== "later" && (
                    <span className="text-subtext0"> · {dueLabel(task.dueDate, today).text.replace(/^Due /, "")}</span>
                  )}
                </span>
              ) : (
                <span className="text-overlay1">None</span>
              )}
            </Property>
            {!isInitiative && (
              <Property label="Repo">
                {task.repoDetail ? (
                  <span className="flex flex-col">
                    <span className="font-mono text-xs text-peach">{task.repoDetail.name}</span>
                    <span className="truncate font-mono text-2xs text-overlay1" title={task.repoDetail.path}>
                      {task.repoDetail.path}
                    </span>
                  </span>
                ) : (
                  <span className="text-overlay1">None</span>
                )}
              </Property>
            )}
            {task.prUrl && (
              <Property label="Pull request">
                <a
                  href={task.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center gap-1 text-mauve hover:underline"
                >
                  <GitPullRequest aria-hidden className="size-4 shrink-0" />
                  <span className="truncate">{displayUrl(task.prUrl).replace(/^github\.com\//, "")}</span>
                </a>
              </Property>
            )}
            <Property label="People">
              {task.people.length ? (
                <ul className="flex flex-col gap-1.5">
                  {task.people.map((p) => (
                    <li key={p.id}>
                      <Link href={`/people/${p.id}`} className="inline-flex items-center gap-2 hover:text-mauve">
                        <Avatar name={p.name} colorKey={p.id} />
                        <span className="truncate">{p.name}</span>
                        {p.role && <span className="text-xs text-overlay1">{p.role}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-overlay1">None</span>
              )}
            </Property>
            {task.parent && (
              <Property label="Initiative">
                <Link href={`/initiatives/${task.parent.id}`} className="line-clamp-2 hover:text-mauve">
                  {task.parent.title}
                </Link>
              </Property>
            )}
            <Property label="Created">
              <span className="text-subtext0">
                <Time iso={task.createdAt} now={now} />
              </span>
            </Property>
            <Property label="Updated">
              <span className="text-subtext0">
                <Time iso={task.updatedAt} now={now} />
              </span>
            </Property>
          </dl>
        </aside>

        <div className="flex min-w-0 flex-col gap-8">
          {task.description ? (
            <Markdown>{task.description}</Markdown>
          ) : (
            <p className="text-sm text-overlay1 italic">No description. The title says it all.</p>
          )}

          {isInitiative && (
            <Section
              title="Tasks"
              count={task.children.length}
              action={
                task.progress && task.progress.total > 0 ? (
                  <span className="flex w-44 items-center gap-2">
                    <ProgressBar resolved={task.progress.resolved} total={task.progress.total} className="flex-1" />
                    <span className="text-xs font-semibold text-subtext0 tabular-nums">
                      {task.progress.resolved}/{task.progress.total}
                    </span>
                  </span>
                ) : undefined
              }
            >
              {task.children.length ? (
                <CardList className="sm:grid sm:grid-cols-2">
                  {task.children.map((c) => (
                    <TaskCard
                      key={c.id}
                      task={{ ...c, parent: null }}
                      today={today}
                      showStatus
                      context={defaultContext({ ...c, parent: null })}
                      dashed={c.status === "claimed"}
                    />
                  ))}
                </CardList>
              ) : (
                <p className="rounded-2xl border-2 border-dashed border-surface0 p-6 text-center text-sm text-subtext0">
                  No Tasks yet. Add one, or ask your agent to file Tasks under this Initiative.
                </p>
              )}
              {task.status === "done" && (
                <p className="mt-3 text-ui text-green">
                  All done. 🎉 Every Task is done or dropped; reopen one to reopen the Initiative.
                </p>
              )}
            </Section>
          )}

          {preps.length > 0 && (
            <Section title="Preps" icon={<FileText className="size-4 text-mauve" />} count={preps.length}>
              <div className="flex flex-col gap-3">
                {preps.map((p, i) => (
                  <details key={p.id} open={i === 0} className="group rounded-2xl bg-mantle">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 rounded-2xl px-4 py-3 text-sm hover:bg-surface0/50">
                      <ChevronRight
                        aria-hidden
                        className="size-4 text-overlay1 transition-transform group-open:rotate-90"
                      />
                      <span className="font-display font-bold">{PREP_KIND_LABEL[p.kind]}</span>
                      {i === 0 && preps.length > 1 && <Pill tone="accent">latest</Pill>}
                      <span className="ml-auto font-mono text-xs text-overlay1">
                        {p.author} · <Time iso={p.createdAt} now={now} />
                      </span>
                    </summary>
                    <div className="px-5 pt-1 pb-5 sm:px-6">
                      <Markdown>{p.body}</Markdown>
                    </div>
                  </details>
                ))}
              </div>
            </Section>
          )}

          {task.sources.length > 0 && (
            <Section title="Sources" icon={<Link2 className="size-4 text-sky" />} count={task.sources.length}>
              <ul className="flex flex-col gap-3">
                {task.sources.map((s) => (
                  <li key={s.id} className="rounded-2xl bg-mantle px-4 py-3">
                    {s.url ? (
                      isHttpUrl(s.url) ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-center gap-1 text-sm font-semibold text-sky hover:underline"
                        >
                          <span className="truncate">{displayUrl(s.url)}</span>
                          <ExternalLink aria-hidden className="size-3.5 shrink-0" />
                        </a>
                      ) : (
                        <span className="font-mono text-xs text-subtext0">{s.url}</span>
                      )
                    ) : (
                      <span className="text-xs font-semibold text-overlay1">From a conversation</span>
                    )}
                    <p className="mt-1 text-sm whitespace-pre-wrap text-subtext1">{s.summary}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Activity">
            <ol className="relative flex flex-col gap-4 before:absolute before:top-3 before:bottom-3 before:left-[13px] before:w-0.5 before:rounded-full before:bg-surface0">
              {activity.map((a, i) => (
                <li key={i} className="relative flex gap-3 text-sm">
                  <span
                    className="z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-on [&_svg]:size-3.5"
                    style={{ backgroundColor: a.color }}
                  >
                    {a.icon}
                  </span>
                  <div className="min-w-0 flex-1 pt-1">{a.body}</div>
                  <span className="shrink-0 pt-1 font-mono text-xs text-overlay1">
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
