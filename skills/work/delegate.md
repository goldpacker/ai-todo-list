# Delegate Tasks: from claim to PR

The goal is a small, focused, verified PR the engineer can review in one sitting. A PR built on a guess costs the engineer more than a lane change, so step 1 is a real gate.

## 1. Re-check the fit

Now that you can see the code, test the Task against the Delegate criteria again. Is it fully specified, low risk, verifiable by tests, in one Repo and one PR?

- A design choice remains, or the acceptance criteria are ambiguous: `todo lane <id> align --reason "…"` if a person must decide, or `deep-work` if the problem is hard rather than ambiguous.
- It turns out to touch auth, billing, migrations, public contracts, production config or infrastructure: `todo lane <id> deep-work --reason "…"`.

Make the reason specific: "Spec says 'handle exhaustion' but doesn't say fail-open vs fail-closed; `TokenBucket.acquire` callers assume both."

## 2. Set up a workspace

- The Repo path is `repoDetail.path` from the claim. If it's missing or isn't a git repo, use the blocked-on-the-engineer outcome: add a note, then `todo ready`.
- Find the default branch: `git -C <path> symbolic-ref --short refs/remotes/origin/HEAD`, or `gh repo view --json defaultBranchRef`. Then run `git -C <path> fetch origin`.
- **Use a git worktree** so the engineer's checkout is never disturbed. It is mandatory if `git status --porcelain` shows changes or the checkout isn't on the default branch:
  ```sh
  git -C <path> worktree add <tmpdir>/todo-<id> -b todo/<id>-<slug> origin/<default>
  ```
  The slug is 3–5 kebab-case words from the title. Leave the engineer's checkout alone: don't stash, reset, switch branches or commit there.
- If `todo/<id>-…` already exists from an earlier attempt, read the Task's notes. Reuse the branch if it holds useful progress. Otherwise start `todo/<id>-<slug>-2`.
- Install dependencies in the worktree the way the repo expects (lockfile, `make bootstrap`, and so on).

## 3. Learn the repo's conventions

Read the README, CONTRIBUTING, `AGENTS.md` / `CLAUDE.md`, the CI config, and the package scripts or Makefile. Check `git log --oneline -20` for commit message style. The commands CI runs are the ones you must run.

## 4. Implement

- Make the smallest change that satisfies "Done means".
- Add or update tests that cover the new behaviour.
- Follow the patterns already in the code.
- Keep the diff on scope: no drive-by refactors, formatting churn or new dependencies unless the Task asks for them.
- Run `todo renew <id> --worker <worker>` before long builds or test runs.

## 5. Verify

- Run the repo's tests, lint and typecheck or build: the same checks CI runs. Record the exact commands and their results.
- If a check fails on the base branch too, confirm that on `origin/<default>` and mention it in the PR. Don't fix unrelated failures.
- If you can't get your change green, release the Task with the failing output in the note, or change its Lane if the failure points to a design problem. Never open a PR that is red because of your change.

## 6. Commit and push

- Use focused commits in the repo's message style. Never commit secrets, local config or generated output.
- Push the branch: `git push -u origin todo/<id>-<slug>`. Push to your own `todo/…` branch only. Never push to the default branch, and never force-push a branch you didn't create.

## 7. Open the PR

```sh
gh pr create --draft --base <default> --head todo/<id>-<slug> --title "<title>" --body-file <path>
```

- Open it as a **draft**, so CODEOWNERS and auto-assigned reviewers aren't pinged before the engineer has looked. The engineer marks it ready.
- Add no reviewers, labels, assignees or milestones.
- Link issues with `Refs #123` rather than `Fixes` or `Closes`, unless the Task says otherwise. The engineer decides what closes.
- If the repo is public (`gh repo view --json visibility`), leave internal links and summary text out of the PR body and reference only the Task id.
- Make the title match the repo's convention, or else use the Task title in imperative form.

PR body template:

```markdown
## What

<1–3 sentences: the change.>

## Why

<The problem, from the Task description and Sources.>
Sources: <Slack thread / ticket / issue links from the Task>
Task: todo #<id> "<Task title>"

## Changes

- <file or area>: <what and why>

## Verification

- `<test command>`: pass (<count> tests)
- `<lint command>`: pass
- `<typecheck/build command>`: pass
- Not verified: <anything you couldn't check, and why>

## Notes for the reviewer

<Assumptions, judgment calls, pre-existing failures, anything you're unsure of.>

---

Opened by a coding agent from the engineer's todo list. Not yet reviewed by the engineer.
```

## 8. Record and clean up

- `todo pr <id> <pr-url> --json` records the PR and moves the Task to Ready. `todo sync` later moves it to Done when the PR merges, or back to Open with a note when it's closed.
- Remove the worktree (`git -C <path> worktree remove <tmpdir>/todo-<id>`). The branch stays on the remote.

## When a closed PR comes back

If the notes say "PR closed without merging", read the closed PR's comments (`gh pr view <url> --comments`) before you do anything. Don't resubmit the same approach. If the comments ask for changes you can make, make them on a fresh branch. If they question the approach itself, change the Lane to `align` or `deep-work` with the reviewer's objection in the reason.
