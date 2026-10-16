## Project

A personal, local task list for a staff engineer. Agents write and work Tasks through the `todo` CLI; the engineer uses a Next.js web app on 127.0.0.1:4477. Vocabulary: `GLOSSARY.md`. Design: `.scratch/ai-todo-list-v1/spec.md`.

- `src/core` holds every domain rule (SQLite via Drizzle, hand-written migrations in `migrations.ts`, kept in sync with `schema.ts`). The CLI (`src/cli`) and the web app (`src/app`, `src/components`, `src/lib`) are thin adapters: never put rules in them.
- The app never calls an LLM (ADR 0001). Agent judgment lives in `skills/capture`, `skills/work` and `skills/sweep`; keep them in step with CLI changes.
- Tests go through the core's interface against a real temp SQLite file with a fake clock and fake PR adapter (`tests/core/helpers.ts`). CLI and web get smoke tests only.
- Commands: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm dev`, `pnpm todo <cmd>`, `pnpm build` (web + `dist/cli.js`). Demo data: `pnpm tsx scripts/seed-demo.ts <db> --reset`, then run with `AI_TODO_DB=<db>`.
- This Next.js version differs from older ones; read `node_modules/next/dist/docs/` before changing web code (see `AGENTS.md`).

## Agent skills

### Issue tracker

Issues are local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default triage labels (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
