# AI Todo List

A personal task list for a staff engineer that lives on your own machine. Coding agents write Tasks to it and work through them; you see and act on the result in a minimal local web app.

- **Capture**: hand your agent a Slack thread, a ticket or just a conversation. Acting as the **Capturer**, it breaks the work into **Tasks**, gives each one a **Lane**, and records its **Sources** and **People** through the `todo` CLI.
- **Work**: scheduled agents acting as **Workers** claim Tasks one at a time. **Delegate** Tasks become PRs for you to review. Every other Lane gets a **Prep** (a research brief, an outline, a review summary, alignment notes or a drafted reply), so the groundwork is done when you sit down to it.
- **Sweep**: a scheduled agent acting as the **Sweeper** checks your active Tasks against their PRs, tickets and threads, and marks the ones you've actually finished as Done, with the evidence recorded. Anything it isn't sure about gets a note instead.
- **Review**: the web app opens on the **Lanes** board, every active Task by the kind of work it is. A **Heating up** strip on top and red or peach card edges show what's pressing: overdue, due this week, high priority, or a follow-up due. The **Today** tab still groups things by your move, the agents' and other people's.

The app itself never calls an LLM ([ADR 0001](docs/adr/0001-no-llm-inside-the-app.md)). All the judgment lives in your agents, guided by the three skills in [`skills/`](skills/).

## Lanes

| Lane          | What it is                                                      | What a Worker does                            |
| ------------- | --------------------------------------------------------------- | --------------------------------------------- |
| **Delegate**  | A well-scoped code change an agent can finish end to end        | Implements it and opens a PR                  |
| **Deep Work** | Complex implementation, debugging or investigation              | Writes a research brief                       |
| **Write**     | Design docs, RFCs, strategy, postmortems                        | Drafts an outline with the gaps marked        |
| **Review**    | Someone else's PR, design doc or RFC                            | Pre-reads it and summarises the risks         |
| **Align**     | Needs a conversation: details, unblocking, decisions, consensus | Writes alignment notes and an opening message |
| **Quick**     | Under about 15 minutes, only you can do it                      | Drafts the reply, if there is one             |

Vocabulary is defined in [`GLOSSARY.md`](GLOSSARY.md); the full design is in [the v1 spec](.scratch/ai-todo-list-v1/spec.md).

## Setup

Requires Node 20+ and pnpm. `gh` (logged in) is needed for PR sync.

```sh
pnpm install
pnpm build            # builds the web app and the CLI (dist/cli.js)
pnpm link --global    # puts `todo` on your PATH
todo skills install   # links the capture, work and sweep skills into ~/.claude/skills
todo repo add billing ~/code/billing   # register Repos that Delegate Tasks can target
```

Data lives in `~/.ai-todo/todo.db` (a single SQLite file). Set `AI_TODO_DB` or pass `--db <path>` to use a different file.

## Using it

**Run the web app** (localhost only):

```sh
todo web              # or: pnpm start (after pnpm build), pnpm dev for development
open http://127.0.0.1:4477
```

**Capture**: ask your agent, for example "use the capture skill on https://acme.slack.com/archives/C1/p123". It looks up the Source first (`todo find --source`) so a thread captured twice updates its existing Tasks instead of duplicating them.

**Work**: schedule a Worker with your own tooling, for example cron or launchd running Claude Code headless:

```sh
claude -p "Use the work skill. lanes: delegate,review. max tasks: 3"
```

Each run syncs PRs first (merged → Done, closed → Open), drafts follow-ups for Tasks stuck in Waiting for more than three days, then claims and works Tasks lane by lane.

**From the terminal**: every command supports `--json`. Run `todo help` for the full list, or `todo help --json` for the machine-readable schema that agents read.

```sh
todo today
todo list --lane review
todo show 12
todo done 12
todo wait 14 --note "Waiting on Priya's schema review" --follow-up-days 2
todo lane 15 align --reason "Needs a decision from security" --actor engineer
```

## Development

```sh
pnpm dev              # web app with hot reload on 127.0.0.1:4477
pnpm todo <command>   # run the CLI from source
pnpm test             # vitest: core behaviour plus CLI and web smoke tests
pnpm typecheck
pnpm lint
```

To try the app with realistic data, seed a scratch database and point the app at it:

```sh
pnpm tsx scripts/seed-demo.ts /tmp/todo-demo.db --reset
AI_TODO_DB=/tmp/todo-demo.db pnpm dev
```

Layout: `src/core` holds the domain module (all rules, over SQLite via Drizzle), `src/cli` the `todo` CLI, `src/app` the Next.js web app, and `skills/` the agent skills. The CLI and the web app are thin adapters over the core. Tests go through the core's interface against a real SQLite file with a fake clock and a fake PR-status adapter.

## License

MIT. See [LICENSE](LICENSE).
