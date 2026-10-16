# Choosing a Lane

`todo help --json` holds the official Lane definitions. This file is the judgment that goes with them: a procedure to follow, examples from a staff engineer's week, and the boundaries where Capturers most often go wrong.

A Lane decides **who acts next and how**. Delegate goes to a Worker, which writes code and opens a PR. Every other Lane goes to the engineer, and a Worker writes a Prep for it first. A wrong Lane wastes a Worker run, or worse, produces a bad PR.

## Decision procedure

Ask these questions in order and stop at the first yes.

1. **Must the engineer talk to someone before the work can move?** That covers getting missing details, a decision someone else owns, agreement across teams, or unblocking. **Align.** If code or a doc follows the conversation, it's a separate Task (see [Align + code](#something-needs-alignment-and-code)).
2. **Is the engineer judging someone else's work?** **Review.**
3. **Is the engineer the author of a document?** **Write.**
4. **Is it a single short action only the engineer can do, under about 15 minutes, with no back-and-forth?** **Quick.**
5. **Is it a code change that passes all five Delegate tests below?** **Delegate.**
6. Everything else, including code changes that fail any Delegate test and all investigation, debugging and spikes: **Deep Work.**

### The five Delegate tests

Every answer must be yes:

1. **Fully specified.** What to change and what "done" means are written down. No design choices remain for the Worker to make.
2. **Low risk.** The change is reversible, and it doesn't touch data migrations, auth or security, billing, public API or schema contracts, production config or flags, or infrastructure.
3. **Verifiable.** The repo's tests, lint or typecheck can show the change is right. A new test can be part of the Task.
4. **In a registered Repo.** It's in `todo repo list`, and it's one Repo, not several.
5. **One focused PR.** Small enough for the engineer to review in one sitting.

A Worker claims a Delegate Task as soon as it's written, with no approval step. **When in doubt, choose Deep Work**, or capture an Align Task first to settle the open question. A Delegate Task captured too early becomes a bad PR the engineer has to close.

## Examples

### Delegate

- Fix the off-by-one in `paginate()` that issue #812 reproduces with a failing case.
- Bump `axios` 1.6 → 1.7 in `web-app` and fix the type errors. CI must pass.
- Add unit tests for `RetryPolicy.backoff()` covering jitter bounds and the max-attempts cap.
- Rename `userId` to `accountId` in the `billing-ui` components (mechanical; no API change).
- Delete the `legacy_export` feature flag and its dead code path (flag is 100% off and was removed from config last sprint).
- Add a `--dry-run` flag to the `migrate-users` script, with the behaviour spelled out in the ticket.
- Fix the lint and typecheck errors CI flags on `main` in `platform-tools`.
- Update the README setup steps to match the new `make bootstrap` target.

### Deep Work

- Root-cause the p99 latency regression in `/checkout` since Monday's deploy.
- Track down why `OrdersSyncTest` fails about 1 in 20 CI runs.
- Spike: can we replace the hand-rolled job queue with SQS FIFO? Prototype and measure.
- Implement idempotency keys across the payments API and the webhook consumer (several systems, design choices).
- Investigate a memory leak in the ingestion worker using heap snapshots.
- Plan and execute the Postgres 14 → 16 upgrade for the orders database (risky, sequenced).
- Code change in a Repo that isn't registered yet.

### Write

- Design doc for multi-region failover of the session service.
- RFC proposing a monorepo build cache.
- Postmortem for last Tuesday's checkout outage.
- 2027 platform technical strategy, first draft.
- Migration plan for moving teams off the legacy auth SDK.
- Promotion packet input or a peer-feedback write-up the engineer owes.
- Revise the engineer's own design doc to address the review comments (if it's more than a few minutes of work; otherwise Quick).

### Review

- Review Marco's PR payments-api#2231 (connection pool size).
- Review Lena's RFC on event schema versioning before Thursday's arch review.
- Architecture review of the data team's proposed CDC pipeline.
- Read the vendor's security questionnaire answers and say whether they're acceptable.
- Second-pass review of an incident postmortem drafted by another team.
- Evaluate a candidate's take-home submission.

### Align

- Get the missing acceptance criteria for PLAT-1432 from its author.
- Agree with Omar (Risk) on whether `rate_limiter_v2` can be disabled as a mitigation.
- Drive a decision between gRPC and REST for the new internal API with the two teams that consume it.
- Unblock Sam, who is waiting on infra access approval. Escalate to their manager if needed.
- Negotiate moving the deprecation deadline with the mobile team.
- 1:1 topic: discuss scope creep on the search project with Dana.
- Ask the SRE on-call whether last night's alert was related to our deploy.

### Quick

- Reply to Priya's question in the thread about which dashboard to use.
- Approve the access request for the new contractor.
- Sign off on the release notes.
- Fill in the quarterly on-call availability form.
- Answer yes or no to the conference talk invite.
- Re-run the flaky CI job on PR #2201 and post the result. (Only if it's genuinely a minute's work. If it needs debugging, it's Deep Work.)

## Tricky boundaries

### Delegate vs Deep Work

Run the five tests honestly. Common traps:

- "Fix the bug" with no reproduction: **Deep Work.** Finding the cause is the hard part.
- "Add tests for X" when X's expected behaviour is disputed or unspecified: **Align** or Deep Work. Characterisation tests that pin down _current_ behaviour can be Delegate if you say so explicitly.
- Flipping a production flag or changing production config, even as a one-line diff: **not Delegate** (it fails the low-risk test). It's usually Align (who owns the decision?) or Quick (the engineer clicks the button once it's decided).
- Small but touching auth, billing or migrations: **Deep Work.**
- Spans two repos: split it into one Delegate Task per Repo only if each half stands alone. Otherwise Deep Work.

### Review vs Write

The question is who authors. Someone else's artifact that the engineer gives feedback on is **Review**. An artifact the engineer produces, including their own doc revised after feedback, is **Write**. "Co-write section 3 of Lena's RFC" is Write, because the engineer authors that section.

### Align vs Quick

Can the engineer finish it by sending **one** message or clicking **one** button, without needing a reply? That's **Quick**. Does it need a conversation, someone else's decision, or several exchanges? That's **Align**. "Tell Dana the ETA" is Quick. "Agree the ETA with Dana and the PM" is Align.

### Something needs alignment and code

Write **two Tasks**: an Align Task now, and the code Task as a separate Task. Don't write the code Task as Delegate yet, because a Worker would claim it before the decision exists. Choose one:

- Describe the follow-on in the Align Task ("Done means: decision recorded; then capture the implementation (likely Delegate in payments-api)").
- If the engineer wants it on the list now, capture the implementation (as Deep Work, or as Delegate only if fully specified) and park it right away with `todo wait <id> --note "Blocked on #<align id>: decision from @omar" --follow-up-days 14`.

### Deep Work vs Write

Use **Deep Work** when the investigation is the work and a write-up is a by-product. Use **Write** when the document is the deliverable and the facts are mostly known. "Investigate and write up the options for X" is usually Deep Work first, with a Write Task to follow if a formal doc is needed.

### Not a Task at all

Announcements, FYIs, decisions already made with nothing for the engineer to do, and other people's action items the engineer doesn't depend on. Put them in summaries, or leave them out.
