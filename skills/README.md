# Agent skills

The app never calls an LLM (ADR 0001). All of the judgment lives in these two Claude Code skills, versioned with the CLI so that instructions and behaviour can't drift apart.

| Skill                         | Role     | Use it for                                                                                                                                                                                                                                                |
| ----------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`capture`](capture/SKILL.md) | Capturer | Turning a Slack thread, ticket, PR, doc or conversation into Tasks: breaking down the work, choosing Lanes, writing Source summaries, linking People and Repos, grouping Tasks into Initiatives, and updating existing Tasks instead of duplicating them. |
| [`work`](work/SKILL.md)       | Worker   | A scheduled or on-demand pass over the list: sync PRs, draft follow-ups, claim Tasks by Lane, turn Delegate Tasks into draft PRs, and write Preps for everything else. It only ever drafts. Opening a PR is its one outward action.                       |

Both skills read the live schema from `todo help --json` rather than restating it.

## Install

The `todo` command must be on PATH:

```sh
pnpm install && pnpm build:cli && pnpm link --global   # from this repo
todo skills install                                     # symlinks skills/* into ~/.claude/skills
```

Because the skills are symlinked, a `git pull` updates them. After that, any Claude Code session in any repo can use them:

> put this on my list: https://acme.slack.com/archives/C04PAYENG/p1791885720001200

> work my todo list. lanes: review,align. max tasks: 2

## Scheduling the Worker (your own tooling)

Scheduling is out of scope for the app, which provides the commands and not the scheduler. The Worker has to run **on your machine**, because the database is a local SQLite file. Cloud-hosted schedulers can't reach it.

A headless Claude Code run from cron or launchd works:

```sh
# crontab -e: every two hours, 8:00–18:00, weekdays
PATH=/opt/homebrew/bin:/Users/<you>/Library/pnpm:/usr/bin:/bin
0 8-18/2 * * 1-5  cd ~ && claude -p "Use the work skill. lanes: delegate,review,align,deep-work. max tasks: 3" --allowedTools "Bash,Read,Write,Edit" >> ~/Library/Logs/todo-worker.log 2>&1
```

- cron runs with a minimal `PATH`. Include wherever `todo`, `git`, `gh`, `node` and `claude` live.
- Headless runs can't answer permission prompts. Grant only the tools the Worker needs, and narrow `Bash` (for example to `todo`, `git` and `gh` patterns) if you prefer.
- Run settings go in the prompt: `lanes`, `max tasks`, `time` (e.g. `90m`), `follow-ups: off`, `worker: <name>`. See [work/SKILL.md](work/SKILL.md#run-settings).
- Inside an open Claude Code session, `/loop 2h Use the work skill. max tasks: 2` does the same while the session is open.
