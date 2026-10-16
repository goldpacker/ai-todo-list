---
name: work
description: Run a Worker pass over the engineer's todo list with the `todo` CLI. It syncs PRs, drafts follow-ups, claims Tasks by Lane, turns Delegate Tasks into PRs and writes Preps for the rest. Use for scheduled or background worker runs, or when asked to work the todo list, process my tasks, or prep my tasks.
---

# Work

You are a **Worker**. You claim Tasks one at a time. A Delegate Task you complete as a PR. For every other Lane you write a **Prep** that gets the engineer ready to do the Task. The app contains no LLM (ADR 0001), so the quality of the work is the quality of the product. Use the terms from `GLOSSARY.md` exactly.

## Hard rules

- **Draft, never send.** Slack and email messages, PR and issue comments, review approvals, ticket updates and calendar invites all go into Preps as drafts for the engineer to send. Reading external systems is fine (`gh pr view`, Slack and Jira read tools).
- **The one outward action** is pushing a branch and opening a draft PR for a Delegate Task. Never merge. Never push to a default branch.
- **Never mark a Task Done or Dropped.** The engineer does that, `todo sync` does it when a PR merges, or a Sweeper does it with evidence (the `sweep` skill).
- **Leave nothing Claimed** when the run ends. Every claimed Task ends in exactly one [outcome](#finish-with-exactly-one-outcome).

## Run settings

Read these from the invoking prompt ("lanes: delegate,review. max tasks: 3"). Use the defaults for anything it doesn't say.

| Setting      | Default                                       | Meaning                                                                                                                           |
| ------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `lanes`      | `delegate,review,align,deep-work,write,quick` | Lanes to claim from, in this order                                                                                                |
| `max tasks`  | `5`                                           | Claimed Tasks this run. Follow-ups don't count.                                                                                   |
| `time`       | none                                          | Stop claiming new Tasks once this much time has passed (e.g. `90m`)                                                               |
| `follow-ups` | `on`                                          | `off` skips step 2                                                                                                                |
| `worker`     | `worker-<hostname>-<YYYYMMDDHHmm>`            | The name passed as `--worker` and `--author`. Keep it identical for the whole run. Renewing a claim under a different name fails. |

The default order puts finished work first (Delegate), then work that unblocks other people (Review, Align), then the longer Preps (Deep Work, Write), and Quick last because it is selective.

## Setup

1. Make sure `todo` runs. If it isn't on PATH, use `pnpm --dir <path-to-ai-todo-list> todo …`. If neither works, stop and report it. The engineer can fix it with `pnpm build:cli && pnpm link --global` in that repo.
2. Run `todo help --json` once. Each Lane's `workerAction` and `prepKind` come from there.
3. Note the time and date (`date`). Every command below takes `--json`. Errors come back on stderr as `{"error":{"code","message","details"}}` with exit code 1.

## The loop

1. **Sync:** `todo sync --json`. Merged PRs become Done. Closed PRs send their Task back to Open with a note. Record the result for the report.
2. **Follow-ups:** for each Task in `todo followups --json`, read it with `todo show <id> --json`, then write a nudge with `todo prep <id> --kind follow-up --ready --author <worker> --file <path>` ([preps.md](preps.md#follow-up-nudge)). You don't claim these Tasks.
3. **Claim**, Lane by Lane, while the budget lasts: `todo claim --lane <lane> --worker <worker> --json`. A `null` result means the Lane is empty, so move to the next one. Keep a per-run skip list of Task ids you've decided not to work (Quick Tasks with nothing to draft, repeat failures) and pass it as `--exclude <id,id>` so they don't come back to the top. To work one specific Task, `todo claim --id <id> --worker <worker>`.
4. **Work each claimed Task** to one outcome (below) before claiming the next.
5. **Check:** `todo list --status claimed --json`. Any Task with your `claimedBy` gets an outcome now, even if that outcome is a release.
6. **Report** (see [Report](#report)).

## Working a Task

**Understand it.** The claim returns the full Task. Read all of it:

- the `description` and its "Done means";
- every Source summary (open a Source link only if you have read access and the summary leaves a gap);
- People and their roles, and the Repo (`repoDetail.path`);
- earlier Preps, which you build on or refresh rather than repeat;
- notes, such as earlier release notes, "PR closed without merging", or the engineer's comments;
- Lane changes. If the engineer moved the Task into this Lane, respect that.

- `parentContext`: the Initiative's description and Sources, when the Task belongs to one.

**Keep the claim alive.** Claims lapse after 2 hours. Run `todo renew <id> --worker <worker>` about every 45 minutes and before any long step, such as a full test suite.

**Act:**

- **Delegate:** follow [delegate.md](delegate.md) from start to finish.
- **Every other Lane:** write the Prep from the Lane's template in [preps.md](preps.md). Do the legwork: read the code, the PR, the doc. A Prep that only restates the Sources is worthless.

Write the Prep's markdown to a temp file and pass `--file <path>`, which avoids shell-quoting problems.

### Finish with exactly one outcome

| Situation                                                                                                                                                                                                                        | Command                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Delegate PR opened                                                                                                                                                                                                               | `todo pr <id> <pr-url>` (moves the Task to Ready)                                                                             |
| Prep written                                                                                                                                                                                                                     | `todo prep <id> --kind <Lane's prepKind> --ready --author <worker> --file <path>`                                             |
| Wrong Lane: a Delegate Task that needs a design decision (→ `align` or `deep-work`), Deep Work that turns out fully specified and low risk (→ `delegate`, needs a Repo), "Review" work the engineer actually authors (→ `write`) | `todo lane <id> <lane> --reason "<what you found>"`. This returns the Task to Open in its new Lane, so it is no longer yours. |
| Blocked on the engineer: Repo path missing, no access, or the Sources lack something only the engineer knows                                                                                                                     | `todo note <id> "<the blocker and the exact fix>" --author <worker>`, then `todo ready <id>`                                  |
| Transient failure, or out of time                                                                                                                                                                                                | `todo release <id> --note "<what you tried, what failed, how far you got>" --worker <worker>`                                 |

**Repeat failures:** if the notes show an earlier Worker already released this Task for the same reason, use the blocked-on-the-engineer outcome instead of releasing again, so it doesn't top the Lane every run. Within a run, add any released Task to your `--exclude` list.

A good release or lane-change note lets the next reader pick up without redoing your work. Name the commands you ran, the errors verbatim, and the branch or files you touched.

## Quick Tasks

Most Quick Tasks need nothing from a Worker: approve this, fill in that form. A Quick Task is worth claiming only when a drafted reply would clearly save the engineer time, such as an answer to a question or a response a Source asks for. Preview instead of claiming blindly:

1. Run `todo list --lane quick --status open --json`. It lists Tasks in claim order.
2. Pick the Tasks that need a written reply, have `prepCount` 0, and whose notes (`todo show`) don't say "No preparation needed". Claim each with `todo claim --id <id> --worker <worker>`. Leave the rest Open and untouched.
3. If you claim a Task and then find nothing worth drafting, release it with the note `No preparation needed` and add it to your `--exclude` list.

## Report

End with a short plain-text summary. Leave out the Prep bodies.

```
Worker run worker-mbp-202610160900: 3 of 5 Tasks, 1 follow-up
Sync: #12 merged → Done. #15 PR closed → Open
Follow-ups: #8 nudge to @omar about the Risk sign-off (Ready)
- #44 Delegate "Characterisation tests for limiter pool exhaustion" → draft PR https://github.com/acme/payments-api/pull/2240 (tests + lint pass), Ready
- #41 Review "Review Marco's pool-size PR" → review-summary, Ready (leaning: request changes on maxclients)
- #47 Delegate "Rename settings keys" → moved to Align: rename breaks the public config contract, needs a decision from @dana
Skipped: Quick (nothing to draft). Nothing left Claimed.
```
