# Preps: what great looks like, per Lane

A Prep gets the engineer from "sitting down" to "doing" in a few minutes. It's markdown, rendered on the Task page.

## Every Prep

- **Lead with the bottom line**, in 2–3 sentences: what this is, your best read, and what to do first.
- **Cite everything:** `path/to/file.ts:120-180`, PR and ticket links, and "Priya (Oct 13): …". The engineer should be able to check any claim in one click.
- **Separate facts from inference.** Label guesses ("My read: …") and mark unknowns explicitly.
- **Do the legwork the template implies.** Read the code, run `git log -S` / `git blame`, read the full PR diff, read the doc. Run safe local experiments when they're cheap. Read-only access to external systems is fine. Never touch production.
- **Keep it tight:** one screen to a few. Leave a section out rather than pad it.
- **Refreshing an earlier Prep:** write a complete new Prep (not a diff) and open it with `> Updated <date>: <what changed since the last Prep>`.
- **Drafts are drafts.** Anything meant for another person appears in the Prep as quoted text for the engineer to send.
- **The engineer's voice:** direct, warm, concise, no corporate filler. If the Sources contain the engineer's own messages, match their tone.

Use the Lane's `prepKind` from `todo help --json`:

| Lane      | prepKind          | Template                            |
| --------- | ----------------- | ----------------------------------- |
| Deep Work | `brief`           | [Deep Work brief](#deep-work-brief) |
| Write     | `outline`         | [Write outline](#write-outline)     |
| Review    | `review-summary`  | [Review summary](#review-summary)   |
| Align     | `alignment-notes` | [Alignment notes](#alignment-notes) |
| Quick     | `reply-draft`     | [Reply draft](#reply-draft)         |
| (Waiting) | `follow-up`       | [Follow-up nudge](#follow-up-nudge) |

---

## Deep Work brief

Legwork: find the code involved and read it. Check history for prior attempts (`git log -S`, related PRs and issues, earlier notes). Reproduce locally if it's cheap and safe. Pull out what the Sources' metrics and dashboards already say.

```markdown
# Brief: <Task title>

**Bottom line:** <What's going on as far as you can tell, how confident you are, and where to start.>

## Problem

<The question to answer or the thing to build, and what "done" means (from the Task).>

## What we know

- <Fact>: <source/citation>
- <Fact>: <source/citation>

## Code map

- `src/ratelimit/token_bucket.py:40-95`: `acquire()` makes one Redis call per request and blocks on `pool.get_connection()`
- `config/settings.py:212`: `REDIS_POOL_SIZE = 10`
- `tests/ratelimit/`: no coverage of pool exhaustion

## Prior art and attempts

- <PR/commit/issue>: <what was tried, outcome>

## Constraints

- <Deadlines, things ruled out, required sign-offs, compatibility needs>

## Open questions

- [ ] <Question>: <who can answer / how to find out>

## Candidate approaches

### A. <name>

<How.> **Pros:** … **Cons:** … **Effort:** S/M/L **Risk:** …

### B. <name>

…
**My leaning:** <A or B, and why, in one line>

## Suggested first step

<The first 30–60 minutes, concretely: the experiment, query or command to run.>
```

## Write outline

Legwork: collect every fact the doc needs from the Sources and the code. Find the team's template if the Sources mention one, or look in the repo's `docs/`. Identify who will read and approve the doc.

```markdown
# Outline: <document title>

**Purpose:** <the decision or outcome this doc should produce>
**Audience:** <who reads it, and what they already know>
**Format:** <design doc / RFC / postmortem / strategy; team template link if any>
**Due:** <date and why>

## Stakeholders

- <Name (@handle)>: <role; what they care about; likely objections>

## Skeleton

### 1. <Heading>

- <Known point>: <citation>
- [TODO: engineer] <what only the engineer can supply: opinion, decision, number>

### 2. <Heading>

…

## Facts to draw on

- <Fact, figure, quote>: <citation>

## Gaps the engineer must fill

- [TODO: engineer] <gap>, and why it matters

## Suggested review path

<Who to share the draft with first, and in what order.>
```

Shape the skeleton to the doc type:

- **Design doc / RFC:** Context, Goals and non-goals, Proposal, Alternatives considered, Risks, Rollout, Open questions.
- **Postmortem:** Summary, Impact, Timeline (timestamped, from the Sources), Root cause and contributing factors, What went well and badly, Action items with owners.
- **Strategy:** Where we are, Where we need to be, Bets and trade-offs, What we won't do, Milestones.

## Review summary

Legwork for a PR: `gh pr view <url> --json title,body,author,files,additions,deletions,reviews,statusCheckRollup`, `gh pr diff <url>`, `gh pr checks <url>`, and the existing review threads (`gh pr view <url> --comments`). Read the whole diff and the code around the risky hunks. Check the PR out in a worktree to run tests if that helps. For a doc, read all of it and compare it with the constraints in the Sources. Never post comments, approve or request changes.

```markdown
# Review: <PR/doc title> by <author>

**What it is:** <one or two sentences>
**Size and state:** <+X/−Y across N files; CI status; other reviewers and their verdicts>
**Leaning:** <approve / approve with nits / request changes / needs discussion>: <one-line reason>. (Your call.)

## What changed

- <area>: <what and why>

## Risk areas

- `path/file.py:88-120`: <why it's risky: concurrency, error handling, data, security, perf, compatibility>

## Check before deciding

- [ ] <specific thing to verify, and how>

## Questions for the author

- <question, with file/section reference>

## Nits

- <optional, short>

## Not checked

- <what you couldn't verify, and why>
```

## Alignment notes

Legwork: work out who decides and who is affected, what each person has already said (from the Sources), what the options really are, and what the engineer needs out of the conversation.

```markdown
# Alignment notes: <topic>

**The ask:** <the decision or information needed, in one sentence>
**By when:** <date and what depends on it>

## Who and why

- <Name (@handle)>: <why them: decider, owner, affected; what they've said so far>

## What's known

- <fact>: <citation>

## Options and positions

- <Option>: <who favours it; trade-offs>

## Questions to ask

1. <question>
2. <question>

## Draft opening message

To <@handle>, via <DM / thread link / meeting agenda>:

> <2–5 sentences in the engineer's voice. Lead with the ask, give just enough context with links, and make it easy to answer (propose a default or offer two options).>

## If it stalls

- <fallback plan, or who to escalate to and when>
```

## Reply draft

Use this for Quick Tasks only, and only when a written reply clearly helps. The draft is the Prep. Keep everything else to the minimum.

```markdown
**Reply to:** <who>, in <channel/thread/email link>
**Their question:** <one line, quoted if short>

> <The reply, ready to paste. Mark any fact you couldn't confirm as [TODO: engineer: …].>
```

## Follow-up nudge

The Task is Waiting. Marking it Ready with this Prep clears its waiting note, so copy the note into the Prep word for word.

Write a short, polite, specific nudge. Reference the original ask and its date. Make it easy to answer: offer a yes/no, a proposed default or a quick call. Never guilt-trip. If an earlier follow-up Prep exists, this is a second nudge: offer a call, or suggest who else could answer.

```markdown
**Waiting on:** <waiting note, verbatim>, since <date> (<N> days)
**Original ask:** <what was asked, when, where (link)>
**Send via:** <reply in thread / DM @handle / email>

> Hi <Name>, following up on my question from <weekday, date> about <topic>: <the specific ask>. <Make it easy: "If it helps, I'm happy to go with <default> unless you object by <day>." / "Happy to do a quick call instead.">

After sending: `todo wait <id> --note "<who and what>"` to resume waiting.
```
