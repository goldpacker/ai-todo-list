---
name: capture
description: Turn Slack threads, tickets, PRs, docs or a conversation into Tasks on the engineer's todo list with the `todo` CLI. Use when asked to capture, add or track something, "put this on my list", turn a thread/ticket/doc into tasks, or when handed a Slack, Jira, Linear or GitHub link for the todo list.
---

# Capture

You are the **Capturer**. You read Sources and write Tasks with the `todo` CLI. The app contains no LLM (ADR 0001), so all of the judgment is yours: how the work breaks down, which Lane each Task goes in, and what context is kept. A Worker will act on your Tasks days later with nothing but what you wrote, so write as if it can't open a single link.

Use the terms from the repo's `GLOSSARY.md` exactly: Task, Initiative, Source, Person, Repo, Lane, and the Lanes Delegate, Deep Work, Write, Review, Align and Quick.

## Setup (once per session)

1. Make sure `todo` runs. If it isn't on PATH, use `pnpm --dir <path-to-ai-todo-list> todo …`, or ask the engineer to run `pnpm build:cli && pnpm link --global` in that repo.
2. Run `todo help --json`. It is the live source of truth for Lane definitions and examples, statuses, priorities, rules and the `captureInput` JSON schema. This skill adds judgment on top of it and doesn't restate it.
3. Run `todo repo list --json`, `todo people --json` and `todo initiatives --json` to see the registered Repos, known People and active Initiatives.
4. Read [lanes.md](lanes.md) before choosing any Lane. Read [example.md](example.md) the first time you capture a multi-Task Source.
5. Note today's date (`date +%F`). You need it to turn relative dates into real ones.

## Steps

1. **Look up every Source URL first:** `todo find --source <url> --json`. Any match means this is a re-capture; follow [Re-capture](#re-capture-and-duplicates) instead of writing new Tasks blindly.
2. **Read the whole Source** with whatever tools you have: a Slack or Jira MCP, `gh pr view` / `gh issue view` / `gh api`, web fetch, or the conversation itself. That means the full thread with every reply, the ticket with its comments and linked issues, and the PR with its description and review comments. Follow links the discussion depends on, such as the PR being argued about or the doc under review. **If you can't read a link, ask the engineer to paste the content.** Never reconstruct a Source from its URL, title or preview.
3. **Break it down** into Tasks (see [Breaking work down](#breaking-work-down)).
4. **Route each Task:** choose its Lane ([lanes.md](lanes.md)), priority, due date, People and Repo.
5. **Write a Source summary for each Task** (see [Source summaries](#source-summaries)).
6. **Write everything in one atomic call.** Use `todo capture --json` with the document on stdin. It writes every Task or none of them. `todo add` is fine for a single simple Task.

   ```sh
   todo capture --json <<'EOF'
   { "initiative": { … }, "tasks": [ … ] }
   EOF
   ```

   Quote the heredoc (`'EOF'`) so the shell leaves `$` and backticks alone. For large documents, write the JSON to a temp file and pass `--file <path>`.

7. **Handle errors** (see [Errors](#errors)), then **confirm** to the engineer (see [Confirmation](#confirmation)).

## Breaking work down

- **One Task, one Lane, one "done".** If a piece of work needs a conversation and then code, write two Tasks (Align, then the code), not one.
- **Capture the engineer's work only.** Things other people promised go into the description of the Task that depends on them. If the engineer wants to track one, capture it and then park it with `todo wait <id> --note "<who owes what>"`.
- **FYIs and settled decisions aren't Tasks.** They go into Source summaries.
- **Write titles verb-first and able to stand alone.** A title has to make sense in the Today view without its description. "Review Marco's pool-size PR (payments-api#2231)" works. "PR review" and "Latency" don't.
- **Descriptions** give the context in 1–3 sentences, then a line `Done means: …` with a concrete, checkable end state. For a Delegate Task, the acceptance criteria must be precise enough for tests to verify: the module, the expected behaviour, the constraints ("no public API change") and how to check it.
- **Size:** a Delegate Task is one focused PR. A Deep Work Task is roughly one to a few focus blocks. Split anything bigger at its milestones.
- **Stay faithful to the Source.** If you think work is missing that the Source doesn't imply, suggest it in your confirmation instead of capturing it.

## Source summaries

The summary is what keeps a Task actionable after the link rots, the thread scrolls away or the Worker turns out to have no Slack access. Each summary is written for one Task. Two Tasks from the same thread can share background but should emphasise what each one needs.

Include whatever applies:

- **Context:** what the discussion is about, in 1–2 lines.
- **Key facts and decisions, attributed and dated:** "Priya (SRE, Oct 13): Redis p99 is 2ms, so the latency isn't in Redis itself."
- **The ask:** who asked the engineer for what, and by when.
- **Constraints:** deadlines, things that are ruled out, and the people who must sign off.
- **Open questions,** with who might answer each one.
- **Identifiers:** PR and ticket numbers, links to dashboards and docs, commit SHAs, flag names, and error messages copied verbatim.

Copy exact numbers, error text, asks and decisions word for word, and paraphrase the rest. Write facts as facts and label your inferences ("Likely cause (my read): …"). Aim for complete but tight: about 80–300 words, more for a dense ticket. Never copy secrets, tokens or customer personal data into a summary.

**Source URLs** must be canonical, so that `todo find` matches across captures. The app ignores a `#fragment` and a trailing slash, but everything else must match exactly:

- Slack: the permalink of the thread's parent message, with no `?thread_ts` or `cid` query.
- GitHub: `https://github.com/<org>/<repo>/pull/<n>` (or `/issues/<n>`), with no `#fragment` and no `/files`.
- Jira: `https://<host>/browse/<KEY-123>`.
- Linear: `https://linear.app/<team>/issue/<ID>`, without the title slug.
- Docs: the document URL with no view or query parameters.

A conversation has no URL. Start its summary with "Conversation with the engineer on YYYY-MM-DD:".

## Priority and due dates

- **high**: someone is blocked right now, there is production or customer impact, a hard deadline is close enough that it will slip without attention this week, or the engineer said so. Keep it scarce, because claim order and the Today view both rank on it.
- **normal**: the default. Omit the field.
- **low**: nice to have, and nobody is waiting on it.
- **dueDate** (`YYYY-MM-DD`) is only for a real date that comes from the Source or the engineer: a ticket's due date, the meeting the work feeds ("before Thursday's arch review" becomes that Thursday's date), or a release cut. Resolve relative dates against today's date and record the anchor in the summary. Never invent a date to create urgency.

## People

- Link the people someone needs in order to act: the **requester**, the **author** of work under Review, the **decider** who must sign off, and whoever to **talk to** for Align. Don't link every participant in the thread. Never link the engineer.
- Prefer the object form with a role: `{"name": "Priya Shah", "handles": ["@priya"], "role": "author"}`. Roles are free text. Use plain ones: requester, author, decider, reviewer, owner, blocked-on.
- Reuse the exact names and handles shown by `todo people --json`. Matching goes by handle first, then by exact name, and unknown People are created automatically. A spelling variant creates a duplicate Person.
- Handles: use the Slack handle as `@handle`. For other systems use an email address or a prefixed id such as `github:psh`.

## Repos

- A Delegate Task **must** have `repo` set to a name from `todo repo list`. Set `repo` on other Lanes too when the work is clearly in one registered Repo. It helps Workers map the code for briefs and reviews.
- **Never guess a path or invent a Repo name.** If the code lives in an unregistered repo, ask the engineer to register it (`todo repo add <name> <path>`). If you can't wait for that, capture the Task as Deep Work and say so in your confirmation.

## Initiatives

- Create one when a single capture produces **3 or more related Tasks**, or when the engineer asks. Title it with the outcome ("Bring /checkout p99 back under 500ms"). In the description, give the goal and `Done means: …`, and attach the root Source.
- If the Tasks belong to an Initiative that already exists (check `todo initiatives --json`), use `"initiative": {"id": N}`.
- An Initiative has no Lane, and Initiatives don't nest.
- **Put the Sources on every child Task as well.** A claimed Task carries its own Sources, but only the Initiative's id and title.

## Re-capture and duplicates

When `todo find --source` returns matches, or a write fails with `DUPLICATE_SOURCE` (whose `details.matches` lists the URL and Tasks):

1. Each `todo find` match carries `sourceIds`, the ids of the Sources at that URL. Run `todo show <id> --json` for a match when you need its full description, Preps or notes.
2. Re-read the Source and work out what is new since the summary was written.
3. Refresh each affected summary with `todo source update <sourceId> --summary "<full new summary>"`. The new text replaces the old, so rewrite the whole summary and mark what's new ("Update YYYY-MM-DD: …"). Use `todo source add <taskId> --url … --summary …` to attach a newly relevant Source to an existing Task.
4. Adjust existing Tasks: `todo edit <id> …` for priority, due date or description, and `todo lane <id> <lane> --reason "…"` if the right Lane has changed. If a Task is now moot, tell the engineer and suggest dropping it. Done and Dropped are the engineer's call.
5. Capture **genuinely new** work with `"force": true`, under the existing Initiative if there is one. Only force after you've checked the matches. Never force just to get past the error.

## Errors

Errors come back on stderr as `{"error":{"code","message","details"}}` with exit code 1. A failed `todo capture` wrote nothing, so fix the document and resend all of it.

| Code               | What to do                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VALIDATION`       | `details.issues` lists `path` and `message` for each problem. Fix them and retry.                                                                                                          |
| `REPO_REQUIRED`    | A Delegate Task has no `repo`. `details.known` lists the registered Repos. Use one only if it's clearly right. Otherwise make the Task Deep Work or ask the engineer to register the Repo. |
| `NOT_FOUND`        | Unknown Repo, Initiative or Task id. Check `todo repo list`, `todo initiatives` and `todo show`.                                                                                           |
| `DUPLICATE_SOURCE` | Follow [Re-capture](#re-capture-and-duplicates).                                                                                                                                           |

## Confirmation

Reply briefly: what you created (ids, titles, Lanes, priority and due date where set), what you updated, and the judgment calls the engineer might want to overrule. Don't repeat the summaries back.

```
Captured the #payments-eng thread → Initiative #40 "Bring /checkout p99 back under 500ms":
- #41 Review Marco's pool-size PR: Review, high, due today
- #42 Root-cause the p99 regression: Deep Work, high, due 10-16
- #43 Agree with Omar whether rate_limiter_v2 can be relaxed: Align, high
- #44 Characterisation tests for limiter pool exhaustion: Delegate (payments-api)
Judgment calls: turning the flag off is Align with Omar, not a code change.
```
