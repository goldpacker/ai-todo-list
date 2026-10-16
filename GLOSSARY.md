# AI Todo List

A personal task list for a staff-level engineer, kept on their own machine and written to and worked on by coding agents.

## Work

**Task**:
A single unit of work on the list that someone (the engineer or an agent) is expected to act on.
_Avoid_: Todo, item, action

**Initiative**:
A Task that groups child Tasks belonging to one larger effort. It has no Lane of its own and is done when all its children are done or dropped.
_Avoid_: Epic, project, parent task

**Source**:
Where a Task came from (a Slack thread, a ticket, a conversation), kept as a link plus a summary of the relevant context taken when the Task was written.
_Avoid_: Origin, reference, link

**Person**:
Someone the engineer works with who is linked to Tasks, such as the colleague to align with or the author of the work under review.
_Avoid_: Contact, stakeholder, user

**Repo**:
A code repository registered by a short name, which Delegate Tasks must target.
_Avoid_: Project, codebase

**Prep**:
A document a Worker writes to get the engineer ready to do a Task, such as a research brief, an outline, a review summary or alignment notes.
_Avoid_: Artifact, attachment, note

## Lanes

**Lane**:
The kind of work a Task is, which decides who acts on it next and how. Every Task except an Initiative has exactly one Lane. It is chosen when the Task is written and changed only with a recorded reason.
_Avoid_: Category, kind, type, track

**Delegate**:
A well-scoped code change an agent can complete end to end, ending in a PR for the engineer to review.

**Deep Work**:
Complex implementation, debugging or investigation that needs the engineer's focused time.

**Write**:
Authoring a document such as a design doc, RFC, strategy or postmortem.

**Review**:
Reading and judging someone else's work, such as a PR, design doc or RFC.

**Align**:
Work that needs a conversation with one or more people, to get details, unblock, decide or build consensus.

**Quick**:
A short action that only the engineer can do, taking under about fifteen minutes.

## Roles

**Capturer**:
The agent role that turns Sources or a conversation into Tasks and picks each one's Lane.
_Avoid_: Ingester, planner

**Worker**:
The agent role that runs on a schedule, picks up Tasks, and either completes them (Delegate) or writes Preps for them.
_Avoid_: Bot, runner, executor

**Sweeper**:
The agent role that runs on a schedule, checks active Tasks against the systems they point at, and marks the ones that are verifiably finished as Done, recording its evidence.
_Avoid_: Janitor, closer, reaper

## Status

**Open**:
Captured, and nobody has started on it.

**Claimed**:
A Worker has taken the Task, so no other Worker will pick it up. A claim lapses back to Open if the Worker stops renewing it.

**Ready**:
The next move is the engineer's: the Prep is written, or the PR is up for review.

**Waiting**:
Blocked on someone other than the engineer.

**Done** / **Dropped**:
Finished, or deliberately abandoned.
