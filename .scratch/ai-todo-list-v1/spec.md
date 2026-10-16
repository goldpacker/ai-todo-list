# Spec: AI Todo List v1

Status: ready-for-agent

## Problem Statement

As a staff engineer, my work comes in from everywhere: Slack threads, tickets, review requests, hallway conversations. Very little of it arrives as a clean, actionable unit. Turning a long thread into "here's what I actually need to do" takes effort, so it often doesn't happen and the work gets lost. Even when I do write it down, a plain todo list treats every item the same. In reality, some work an agent could just do, some needs a block of focus time, some needs a document written, some needs me to read someone else's work, and some needs a conversation with a particular person. Nothing helps me get ready for any of these, and nothing does the simple ones for me.

I already use coding agents all day. I want them to turn my inputs into well-formed Tasks, sort each Task by who should act on it, and then work through the list on a schedule: finish what they can and prepare me for the rest.

## Solution

A personal task list that runs only on my machine and is built for agents to write to and work on. It has a `todo` CLI for agents (and me) and a local web app for me.

- I hand my agent, acting as the **Capturer**, a Slack thread, a ticket link, or just a conversation. It reads the material, breaks it down, and writes **Tasks** through the CLI. Each Task gets a **Lane** (Delegate, Deep Work, Write, Review, Align or Quick), a priority, an optional due date, its **Sources** with a summary of the relevant context, and any **People** involved. Three or more related Tasks from one capture are grouped under an **Initiative**.
- Scheduled agents acting as **Workers** claim Tasks one at a time. A Delegate Task gets done end to end and becomes a PR for me to review. Every other Lane gets a **Prep**: a research brief, a document outline, a review summary, alignment notes, or a drafted reply, so that when I sit down to do the Task, the groundwork is done.
- Tasks stuck **Waiting** on someone get a drafted follow-up after a few days. Merged PRs close their Tasks automatically.
- I open the web app to see my **Today** view: what's ready for me, what's urgent, and what's overdue, grouped by Lane. I can also browse by Lane or by Person.

The app itself never calls an LLM (ADR 0001). All the judgment comes from my agents, guided by two skills that ship with the repo: `capture` and `work`.

## User Stories

### Capturing

1. As the engineer, I want to give my agent a Slack thread link and have it write the resulting Tasks, so that a long discussion becomes actionable work without me summarising it.
2. As the engineer, I want to give my agent a ticket link and have it break the ticket into Tasks, so that a large ticket becomes concrete steps.
3. As the engineer, I want to describe something in conversation with my agent and have it write a Task, so that I can capture work that never had a link.
4. As the Capturer, I want to read the CLI's machine-readable schema (`todo help --json`), so that I know the valid Lanes, fields and rules without separate instructions that could go out of date.
5. As the Capturer, I want every Task to require exactly one Lane, so that each Task is clearly routed as soon as it's written.
6. As the Capturer, I want each Lane's description in the schema, so that I pick Lanes consistently.
7. As the Capturer, I want to attach one or more Sources to a Task, each with a URL and a summary of the relevant context, so that a Worker can act on the Task days later without access to the original thread.
8. As the Capturer, I want to attach a Source with no URL (for example, "conversation with the engineer on 2026-10-15") and only a summary, so that conversational captures still record where they came from.
9. As the Capturer, I want to set a priority (high, normal, low) on a Task, so that Workers and the engineer know what matters most.
10. As the Capturer, I want to set an optional due date, so that deadlines from tickets carry over.
11. As the Capturer, I want to link People to a Task by name or handle and have unknown People created automatically, so that I don't need a separate step to register colleagues.
12. As the Capturer, I want a Delegate Task to be rejected if it has no Repo, so that no Worker is ever handed code work it can't locate.
13. As the Capturer, I want to refer to a registered Repo by its short name, so that I don't guess file paths.
14. As the Capturer, I want to be warned when I add a Task whose Source URL is already on file, with the existing Tasks listed, so that I don't create duplicates when the same thread is captured twice.
15. As the Capturer, I want to look up existing Tasks by Source URL before writing, so that a re-capture updates existing Tasks instead of duplicating them.
16. As the Capturer, I want to override the duplicate warning explicitly, so that genuinely new work from a known Source can still be added.
17. As the Capturer, I want to refresh a Source's summary on an existing Task, so that its context reflects how the thread has developed.
18. As the Capturer, I want to create an Initiative and add child Tasks to it in one capture, so that a larger effort stays grouped.
19. As the Capturer, I want to add new Tasks to an existing Initiative, so that later captures about the same effort land in the right place.
20. As the Capturer, I want an Initiative to be rejected if it's given a Lane, so that only actionable Tasks carry Lanes.
21. As the Capturer, I want to add several Tasks in one atomic call (for example, a JSON document on stdin), so that a capture either fully succeeds or leaves nothing half-written.
22. As the Capturer, I want every CLI command to support `--json` output, so that I can parse results reliably.
23. As the Capturer, I want clear, structured error messages when validation fails, so that I can correct the call and retry without the engineer's help.

### Working

24. As a Worker, I want to claim the highest-priority open Task in a given Lane with a single atomic command, so that two Workers never take the same Task.
25. As a Worker, I want claim order to consider priority first, then due date, then age, so that I always work on what matters most.
26. As a Worker, I want claiming to return everything needed for the Task (Sources, People, Repo, Initiative context, previous Preps, Lane history), so that I can do the work from one call.
27. As a Worker, I want my claim to expire after two hours unless I renew it, so that a crashed run doesn't lock a Task forever.
28. As a Worker, I want to renew my claim, so that long jobs keep their Task.
29. As a Worker on a Delegate Task, I want to record the PR URL and move the Task to Ready, so that the engineer knows a PR is waiting for review.
30. As a Worker on any other Lane, I want to attach a Prep as markdown and move the Task to Ready, so that the engineer finds the groundwork done.
31. As a Worker, I want to attach more than one Prep to a Task over time, so that later runs can add to or refresh earlier preparation.
32. As a Worker, I want to change a Task's Lane with a required reason, so that a Delegate Task that turns out to need a decision becomes an Align or Deep Work Task instead of a bad PR.
33. As a Worker, I want to release a Task back to Open with a note when I fail, so that it can be retried and the engineer can see what went wrong.
34. As a Worker, I want to start each run by syncing PR state for Delegate Tasks, so that merged PRs close their Tasks and closed PRs reopen theirs.
35. As a Worker, I want to find Waiting Tasks whose follow-up threshold has passed, so that I can draft nudges.
36. As a Worker, I want to attach a follow-up Prep with a drafted nudge message and move the Task to Ready, so that the engineer can send it in seconds.
37. As a Worker, I want explicit guidance that I must never send messages to people for the engineer, so that drafted nudges stay drafts.
38. As a Worker, I want to skip Quick Tasks that need no preparation, so that I don't waste runs on them.

### Using the web app

39. As the engineer, I want a Today view showing Ready Tasks plus high-priority and overdue ones, grouped by Lane, so that I can see at a glance what needs me.
40. As the engineer, I want a view for each Lane, so that I can batch similar work, such as clearing all Reviews at once.
41. As the engineer, I want a People view listing open Tasks linked to each Person, so that before a 1:1 I can see everything I need to discuss with them.
42. As the engineer, I want an Initiative view showing its children and progress, so that I can see how a larger effort is going.
43. As the engineer, I want a Task detail page showing Sources, rendered Preps, the PR link, People, status and Lane history, so that I have everything in one place.
44. As the engineer, I want to mark a Task done or dropped, so that it leaves my list.
45. As the engineer, I want to mark a Task Waiting with a note on who and what I'm waiting for and an optional follow-up threshold, so that the follow-up flow can pick it up.
46. As the engineer, I want to change a Task's Lane with a reason, so that I can correct a Capturer's misjudgement.
47. As the engineer, I want to edit a Task's title, description, priority, due date, People and Repo, so that I can fix mistakes.
48. As the engineer, I want to add a Task by hand with a required Lane, so that I can capture something without an agent.
49. As the engineer, I want an Initiative to show as done once all its children are done or dropped, so that I don't maintain it by hand.
50. As the engineer, I want to see that a Task is Claimed and since when, so that I know a Worker is working on it.

### Using the CLI myself

51. As the engineer, I want to list Tasks from the CLI, filtered by Lane, status, Person, Initiative or Repo, so that I can check the list from the terminal.
52. As the engineer, I want to mark Tasks done, dropped or Waiting from the CLI, so that I don't have to switch to the browser.
53. As the engineer, I want to register, list and remove Repos by short name and path, so that Delegate Tasks have valid targets.
54. As the engineer, I want to run the PR sync myself, so that I can update Delegate Tasks without waiting for a Worker run.

### Setting up and data

55. As the engineer, I want all data stored in one SQLite file in my home directory, so that the data stays on my machine and is easy to back up.
56. As the engineer, I want the CLI to work without the web app running, so that agents can write at any time.
57. As the engineer, I want the database created and migrated automatically on first use, so that there's no setup step.
58. As the engineer, I want the `capture` and `work` skills versioned with the CLI, so that agent instructions and CLI behaviour never drift apart.
59. As the engineer, I want the web app to listen only on localhost, so that my work data isn't exposed on the network.

## Implementation Decisions

### Shape

- One TypeScript package containing three layers: a **core** domain module over SQLite, a **`todo` CLI**, and a **Next.js web app** served on localhost only.
- The CLI and the web app are thin adapters: they parse input, call the core, and format output. All rules (validation, status transitions, claiming, duplicate detection, Initiative completion, follow-up eligibility) live in the core, so both surfaces behave identically.
- Both the CLI and the web app open the same SQLite file directly. No server process is needed for agents to write. SQLite runs in WAL mode so that the CLI and the web app can use it at the same time.
- Persistence uses Drizzle on top of better-sqlite3. Migrations run automatically when the core opens the database.
- The database lives at a default path in the user's home directory, overridable by an environment variable. Tests rely on the override.
- No LLM calls anywhere in the app (ADR 0001).

### Core interface

The core exposes domain operations, roughly:

- **Capture**: add one or more Tasks atomically (with Sources, People, Repo, priority, due date and optional Initiative); create an Initiative; find Tasks by Source URL; update a Source summary.
- **Work**: claim the next Task in a Lane; renew a claim; release a claim with a note; attach a Prep; record a PR URL; change Lane with a reason; list Waiting Tasks due for follow-up.
- **Lifecycle**: mark done, dropped, Waiting (with note and threshold) or Ready.
- **Sync**: reconcile Delegate Tasks against PR state.
- **Query**: Today, by Lane, by Person, by Initiative, Task detail, filtered lists.
- **Repos**: register, list, remove.
- **Schema**: a self-description of Lanes (with descriptions), statuses, fields and rules, which the CLI emits as `todo help --json`.

The core takes two injected dependencies:

- A **clock**, used for claim expiry, follow-up thresholds, overdue checks and Today.
- A **PR status adapter** that answers "is this PR open, merged or closed?" The production implementation calls the `gh` CLI. Tests use a fake.

### Domain rules

- **Lanes**: Delegate, Deep Work, Write, Review, Align, Quick. Every Task except an Initiative has exactly one. Every Lane change records the old Lane, new Lane, reason, who made the change (engineer or agent) and when.
- **Statuses**: Open → Claimed → Ready → Done; Waiting and Dropped can be reached from any active status. Quick Tasks may go straight from Open to Done. A failed Worker releases its claim back to Open with a note. Transitions outside these are rejected.
- **Claiming** is one atomic transaction: pick the best eligible Open Task in the requested Lane (priority, then due date, then creation time), mark it Claimed with an expiry two hours ahead, and return it with its full context. Claims past their expiry count as Open for eligibility. Renewing pushes the expiry forward.
- **Delegate Tasks** require a registered Repo. A Worker may claim them as soon as they're captured, with no approval step.
- **Initiatives** are Tasks with no Lane, holding child Tasks one level deep (no nested Initiatives). An Initiative's status is derived: done once every child is Done or Dropped. The Capturer's guidance is to create one when a capture produces three or more related Tasks, or on request.
- **Sources**: a Task has zero or more, each with an optional URL and a required summary. Adding a Task whose Source URL already exists fails with a duplicate warning listing the matching Tasks, unless forced.
- **People** have a name and optional handles. Any Task can link any number of them. Unknown names or handles create People automatically, and existing People are matched by handle or exact name.
- **Preps** are markdown documents attached to a Task. Each records its kind (brief, outline, review summary, alignment notes, reply draft or follow-up), its author and when it was written. A Task can have several.
- **Sync**: for each Delegate Task in Ready with a PR URL, merged → Done, and closed without merge → Open with a note. Open PRs leave the Task unchanged.
- **Follow-ups**: a Waiting Task becomes eligible for follow-up once it has waited longer than its threshold (default three days, settable per Task). Waiting days count calendar days in v1.

### CLI contract

- Every command supports `--json` and writes structured errors to stderr with a non-zero exit code.
- Bulk capture accepts a JSON document on stdin.
- `todo help --json` emits the core's schema description. The skills refer to it instead of restating it.

### Skills

- The repo ships two Claude Code skills, `capture` and `work`, versioned with the CLI.
- `capture` covers: reading Sources, writing context summaries, choosing a Lane (with examples of staff-engineer work in each), looking up a Source before writing, when to create an Initiative, and linking People and Repos.
- `work` covers: the Worker loop (sync, then claim by Lane, then act, then mark Ready, change Lane or release), what a good Prep looks like for each Lane, Delegate PR conventions, follow-up drafting, and the rule that Workers never send messages to people.

### Web app

- Views: Today, per-Lane, People, Initiative, and Task detail.
- Actions: mark done or dropped, set Waiting (with note and threshold), change Lane (with reason), edit fields, add a Task by hand (Lane required).
- No chat or capture-by-AI in the web app.

## Testing Decisions

- **One seam, agreed with the engineer**: tests go through the core module's public interface against a real SQLite database in a temporary file, with an injected fake clock and a fake PR status adapter. This seam covers both the CLI and the web app, because both are thin adapters over the core.
- Good tests describe external behaviour in domain language ("a Delegate Task without a Repo is rejected", "a lapsed claim can be claimed again", "an Initiative is done when its last child is dropped"). They don't inspect tables, ORM calls or internal helpers.
- Core behaviours to cover:
  - capture validation (Lane required, Initiative without a Lane, Delegate requires a Repo)
  - atomic bulk capture
  - duplicate Source detection and override
  - automatic People creation and matching
  - claim ordering, atomicity, expiry and renewal
  - every allowed and disallowed status transition
  - Lane changes recording history
  - Prep attachment
  - Initiative completion
  - PR sync outcomes for merged, closed and open PRs
  - follow-up eligibility around the threshold
  - Today composition, including overdue handling with the fake clock
- **The CLI and the web app** get a small number of smoke tests: the CLI binary run against a temporary database with `--json` for add, claim and help; one rendering check of the Today view. They confirm the wiring, not the rules.
- **Prior art**: none. The repo is empty, so these tests set the conventions.

## Out of Scope

- Scheduling and running Workers. The engineer's own agent tooling (for example, Claude Code routines or cron) invokes the `work` skill. The app provides the commands, not the scheduler.
- Any LLM calls inside the app (ADR 0001).
- An MCP server. It may come later as a thin wrapper over the core.
- Multiple users, accounts, sharing or authentication. The app is single-user and localhost only.
- Sending messages, posting comments or acting on external systems for the engineer. Workers only draft. The one exception is opening PRs for Delegate Tasks.
- Automatic ingestion from Slack, Jira or GitHub (webhooks, polling, review-request import). Capture always goes through an agent.
- Recurring Tasks, calendar integration and time-blocking.
- Nesting Initiatives inside Initiatives.
- Mobile apps and remote access.

## Further Notes

- Domain vocabulary is defined in `GLOSSARY.md`; this spec uses its terms throughout.
- ADR 0001 records the decision to keep LLMs out of the app. Consistent Lane choice therefore depends on clear Lane descriptions in the CLI schema and on the `capture` skill.
- If the engineer finds themselves closing many bad Delegate PRs, revisit adding an approval step before Workers can claim Delegate Tasks.
- Possible later additions: counting follow-up thresholds in working days, an MCP wrapper, and a Lane for short human tasks split out of Deep Work if that Lane gets bloated.
