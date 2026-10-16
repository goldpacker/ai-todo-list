# Evidence by Lane

Where to look for each Lane, what counts as Done, and the near-misses that don't count. Throughout, "the engineer" means the identities you found in setup (`gh api user --jq .login`, and their Slack or Jira profile). Only activity after the Task's `createdAt` counts.

Useful commands:

```sh
gh pr view <url> --json state,mergedAt,closedAt,isDraft,author,reviews,latestReviews,comments
gh issue view <url> --json state,stateReason,closedAt,comments
gh pr list --repo <org/repo> --state merged --search "<keywords> merged:>=<createdAt date>" --json number,title,url,mergedAt,author
git -C <path> fetch --quiet && git -C <path> log origin/HEAD --since=<createdAt> --oneline --grep=<keyword>
```

If `origin/HEAD` is missing, find the default branch with `gh repo view --json defaultBranchRef`.

## Delegate

`todo sync` already closes Ready Delegate Tasks whose PR merged. That leaves:

- **Open Delegate Tasks that landed some other way**, because a teammate or the engineer made the change by hand. Search merged PRs and the default branch since `createdAt` for the change the acceptance criteria describe. **Done** only if a merged change meets _every_ acceptance criterion. Read the diff; a matching title isn't enough.
- **Ready Delegate Tasks whose recorded PR is still open** aren't yours to judge. Leave them for sync.

## Review

Find the thing under review from the Sources: usually a PR, sometimes a doc or RFC.

- **Done:** the engineer submitted a review on the PR (`reviews[]` with `author.login` = the engineer, state `APPROVED` or `CHANGES_REQUESTED`, or `COMMENTED` with real content) after `createdAt`. For a doc, the engineer's comments or sign-off appear in it.
- **Moot:** the PR merged or closed without a review from the engineer, or the doc was finalised without them. Flag it; don't close it. They may still want to look.
- **Not done:** someone else approved; the engineer left one emoji or a "will look" comment; the PR got new commits after the engineer's review and the Task says to re-review.

## Align

Align Tasks end in a decision or an agreement. Find where it would be recorded: the Slack thread, the ticket, a meeting-notes doc, a design doc's decision log.

- **Done:** the decision named in "Done means" is written down in a system of record, with the engineer or the decider stating it ("Agreed: we keep the flag on until Nov 1 — Omar").
- **Looks done:** the meeting happened and the thread went positive, but nobody wrote the decision down. Flag it with what you saw.
- **Not done:** a meeting was scheduled or held; people are still discussing; the decision is "let's revisit".

## Write

The deliverable is a document: a design doc, RFC, postmortem or strategy.

- **Done:** the document exists where it should, in its final state: an RFC PR merged, a doc marked Final/Published/Approved, a postmortem shared in the channel "Done means" names. Check the content is the document the Task describes, not a stub.
- **Looks done:** a full draft exists, but its status says Draft, or it hasn't gone where "Done means" says it should.
- **Not done:** an outline or a Prep exists; a doc was created but is mostly empty.

Write Tasks often live in docs you can't read. Then all you have is indirect evidence (a link shared in a thread), which is at most "looks done".

## Deep Work

Deep Work ends in a merged fix, a finished investigation, or a resolved ticket.

- **Done:** the fix merged on the default branch (search by ticket key or keywords), and the ticket, if there is one, is resolved; or the investigation's findings are written where "Done means" says (ticket comment, doc, thread).
- **Looks done:** the fix merged but the ticket is still open, or the ticket was resolved by someone else with no visible fix.
- **Not done:** a PR is open or in draft; the ticket is "in progress".

## Quick

Quick Tasks are small actions only the engineer can take: approve, reply, fill in, sign off.

- **Done:** the action is visible: the access request shows approved by the engineer, the engineer's reply is in the thread (compare it to any drafted reply in the Preps), the form or ticket shows their sign-off.
- **Moot:** someone else did it (another approver granted access, the question got answered by a colleague). Flag it.
- **Not done:** no trace of the action.

## Waiting

A Waiting Task can be in any Lane. Its `waitingNote` names who owes what.

- If what was owed has arrived (the reply came, the sign-off landed, the PR it waited on merged) and the engineer's part still needs doing, it's **Unblocked**: note what arrived and move the Task to Ready.
- If what arrived _was_ the whole Task (the Task was "get the risk sign-off from Omar" and Omar signed off), it's **Done**.
- If nothing has arrived, leave it. Nudges are the Worker's job (`todo followups`).

## Any Lane: the engineer's own notes

Read the Task's notes from `engineer`. "Sent it", "Done in standup", "Approved on the phone" is first-hand evidence from the person who did the work. It counts as observed: quote it in your Done note ("Engineer's note on 10-15: 'sent it'"). A note that says what they _plan_ to do does not count.
