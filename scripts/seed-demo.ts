/**
 * Seeds a demo database with a realistic week of staff-engineer work across all six Lanes.
 *
 *   pnpm tsx scripts/seed-demo.ts <db-path> [--reset]
 *   AI_TODO_DB=/tmp/demo.db pnpm tsx scripts/seed-demo.ts [--reset]
 *
 * Refuses to touch an existing file unless --reset is given, and never defaults to your real database.
 * Then run the app against it: AI_TODO_DB=<db-path> pnpm dev
 */
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { createCore, defaultDbPath, localDate } from "../src/core";

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const target = args.find((a) => !a.startsWith("--")) ?? process.env.AI_TODO_DB;

if (!target) {
  console.error("Usage: tsx scripts/seed-demo.ts <db-path> [--reset]   (or set AI_TODO_DB)");
  process.exit(1);
}
const dbPath = resolve(target);
if (!process.env.AI_TODO_DB && dbPath === resolve(defaultDbPath())) {
  console.error(`Refusing to seed your real database at ${dbPath}. Pick another path.`);
  process.exit(1);
}
if (existsSync(dbPath)) {
  if (!reset) {
    console.error(`${dbPath} already exists. Re-run with --reset to replace it.`);
    process.exit(1);
  }
  for (const suffix of ["", "-wal", "-shm"]) rmSync(dbPath + suffix, { force: true });
}

// A movable clock so history (Lane changes, notes, waiting) is spread over the past week.
const realNow = Date.now();
const DAY = 24 * 60 * 60 * 1000;
let now = realNow - 6 * DAY;
const at = (daysAgo: number, hours = 0) => {
  now = realNow - daysAgo * DAY - hours * 60 * 60 * 1000;
};
const core = createCore({
  dbPath,
  clock: { now: () => new Date(now) },
  prStatus: { getState: async () => "open" },
});
const day = (offset: number) => localDate(new Date(realNow + offset * DAY));

// ----- Repos -----
core.registerRepo({
  name: "payments-api",
  path: "~/code/payments-api",
  remote: "git@github.com:acme/payments-api.git",
});
core.registerRepo({ name: "web-console", path: "~/code/web-console", remote: "git@github.com:acme/web-console.git" });

// ----- An Initiative with a Task in every Lane -----
at(6);
const { initiativeId, taskIds } = core.capture({
  initiative: {
    title: "Migrate checkout to the new rate limiter",
    description:
      "Move checkout traffic from the legacy fixed-window limiter to the token-bucket service before Black Friday load tests.\n\n**Exit criteria:** p99 under 40ms at 3× peak, per-tenant overrides documented.",
    priority: "high",
    dueDate: day(24),
    sources: [
      {
        url: "https://acme.slack.com/archives/C042PAY/p1728912000",
        summary:
          "Payments leads agreed to migrate checkout first; Dana owns the rollout, Marcus owns limit defaults. Load test window opens Nov 10.",
      },
    ],
    people: [{ name: "Dana Kim", handles: ["@dana"], role: "rollout owner" }],
  },
  tasks: [
    {
      title: "Add rate-limit headers to checkout responses",
      lane: "delegate",
      repo: "payments-api",
      description: "Return `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset` on every checkout response.",
      sources: [
        {
          url: "https://github.com/acme/payments-api/issues/912",
          summary: "Clients need headers to back off gracefully; follow the IETF draft names.",
        },
      ],
    },
    {
      title: "Investigate p99 latency spike in token bucket refill",
      lane: "deep-work",
      priority: "high",
      description: "p99 jumps from 12ms to 90ms every ~60s under load. Suspect refill lock contention.",
      people: ["@dana"],
    },
    {
      title: "Draft RFC: per-tenant rate limit overrides",
      lane: "write",
      dueDate: day(3),
      people: ["Marcus Lee"],
    },
    {
      title: "Review Priya's PR #4821: Redis cluster failover for the limiter",
      lane: "review",
      priority: "high",
      people: [{ name: "Priya Shah", handles: ["@priya"], role: "author" }],
      sources: [
        {
          url: "https://github.com/acme/payments-api/pull/4821",
          summary: "Adds sentinel-based failover; Priya asked for review before Thursday's deploy.",
        },
      ],
    },
    {
      title: "Agree on default limits with the Payments team",
      lane: "align",
      people: ["Marcus Lee", "@dana"],
      description: "We need one default per plan tier, plus who can approve overrides.",
    },
  ],
});
const [headersTask, latencyTask, rfcTask, reviewTask, alignTask] = taskIds;

// Delegate: a Worker opened a PR.
at(5, 3);
core.claim("delegate", "worker-1");
at(5, 2);
core.recordPr(headersTask, "https://github.com/acme/payments-api/pull/4830");

// Deep Work: a research brief.
at(4, 6);
core.attachPrep(latencyTask, {
  kind: "brief",
  author: "worker-2",
  ready: true,
  body: `## Summary

The spike lines up with the **refill ticker**: every 60s all buckets refill under one mutex, blocking \`take()\` for ~70ms at 40k buckets.

## Relevant code

- \`limiter/bucket.go\`: \`refillAll()\` holds \`mu\` for the whole sweep
- \`limiter/store.go\`: buckets live in one \`map[string]*bucket\`

\`\`\`go
func (l *Limiter) refillAll() {
    l.mu.Lock()
    defer l.mu.Unlock()
    for _, b := range l.buckets { b.refill(l.now()) }
}
\`\`\`

## Candidate approaches

| Approach | Effort | Risk |
| --- | --- | --- |
| Lazy refill on \`take()\` | Small | Low; standard token-bucket trick |
| Shard the map (64 stripes) | Medium | Low |
| Move to Redis + Lua | Large | Changes failure modes |

## Open questions

1. Is the 60s ticker relied on for metrics anywhere?
2. Do we need exact fairness across tenants, or is approximate fine?

- [x] Reproduced locally with \`make bench-refill\`
- [ ] Confirm with production profile`,
});

// Write: an outline, still open.
at(3, 5);
core.attachPrep(rfcTask, {
  kind: "outline",
  author: "worker-2",
  body: `# RFC: Per-tenant rate limit overrides

## Context
_TODO(engineer): one paragraph on why defaults aren't enough (link the Q3 incident)._

## Proposal
- Overrides stored in \`tenant_limits\`, cached 60s
- Approvals: Payments on-call for ≤2×, Marcus for anything above

## Alternatives
- Static config per deploy
- Plan-tier only (no per-tenant)

## Open questions
- Who audits stale overrides?`,
});

// Review: a review summary, ready.
at(2, 4);
core.attachPrep(reviewTask, {
  kind: "review-summary",
  author: "worker-3",
  ready: true,
  body: `**What changed:** sentinel client replaces the static primary address; limiter falls back to *allow* during failover.

**Risky areas**
1. Fail-open during failover could let a burst through. Is that acceptable for checkout?
2. No test covers a failover mid-\`EVALSHA\`.

**Suggested questions**
- What's the expected failover duration in prod?
- Should fail-open be configurable per route?`,
});

// Align: waiting on Marcus, follow-up overdue.
at(4);
core.attachPrep(alignTask, {
  kind: "alignment-notes",
  author: "worker-3",
  body: "**Decision needed:** default limits per plan tier.\n\n**Ask Marcus:** Q3 peak RPS per tier, and whether Enterprise needs a separate pool.\n\n> Draft opener: *Hey Marcus, before we lock checkout limits, could you share Q3 peak traffic by plan tier?*",
});
at(3, 20);
core.setWaiting(alignTask, { note: "Marcus to share Q3 traffic numbers by plan tier", followUpDays: 2 });

// ----- Standalone Tasks -----
at(5);
const flaky = core.addTask({
  title: "Root-cause flaky checkout e2e test",
  lane: "delegate",
  repo: "web-console",
  description: "`checkout.spec.ts › applies coupon` fails ~1 in 15 runs on CI.",
  sources: [
    {
      url: "https://ci.acme.dev/runs/88123",
      summary: "Fails on the coupon step; screenshots show a stale cart total.",
    },
  ],
});
at(4, 2);
core.changeLane(flaky.id, {
  lane: "deep-work",
  reason: "Not a mechanical fix: needs a decision on test isolation (shared cart fixture vs per-test tenants).",
  actor: "agent",
});
core.addNote(flaky.id, "Tried retrying the coupon step; masks the race rather than fixing it.", "worker-1");

at(2);
core.addTask({
  title: "Reply to Elena about the on-call swap",
  lane: "quick",
  dueDate: day(-2),
  people: [{ name: "Elena Rossi", handles: ["@elena"] }],
  sources: [{ summary: "Elena asked in DM whether we can swap the Nov 3 on-call week." }],
});

at(1);
core.addTask({
  title: "Approve Sam's access request to the prod read replica",
  lane: "quick",
  dueDate: day(0),
  people: ["Sam Patel"],
});

core.addTask({
  title: "Postmortem: 2026-10-09 payment webhook outage",
  lane: "write",
  priority: "high",
  dueDate: day(-1),
  people: ["@elena", "@dana"],
  sources: [
    {
      url: "https://acme.atlassian.net/browse/INC-311",
      summary: "Webhook workers OOM'd after a payload size change; 42 minutes of delayed events.",
    },
  ],
});

core.addTask({
  title: "Review design doc: Ledger v2 event schema",
  lane: "review",
  priority: "low",
  dueDate: day(8),
  people: ["@elena"],
  sources: [
    {
      url: "https://docs.google.com/document/d/1ledgerV2",
      summary: "Elena wants feedback on idempotency keys and event versioning.",
    },
  ],
});

core.addTask({
  title: "1:1 with Priya: growth plan and on-call load",
  lane: "align",
  people: ["@priya"],
  description: "- Feedback on her failover PR\n- Is on-call load sustainable?\n- Staff promo packet timeline",
});

core.addTask({
  title: "Bump zod to v4 in web-console",
  lane: "delegate",
  repo: "web-console",
  priority: "low",
  sources: [
    { url: "https://github.com/acme/web-console/issues/301", summary: "Dependabot can't do it; schema API changed." },
  ],
});

// Done and dropped history.
at(3);
const rotate = core.addTask({ title: "Rotate staging API keys", lane: "quick" });
at(2, 22);
core.markDone(rotate.id);
const spike = core.addTask({ title: "Spike: evaluate Envoy global rate limiting", lane: "deep-work", priority: "low" });
at(1, 5);
core.drop(spike.id, "Superseded by the token-bucket service.");

// A live claim, at the real current time.
now = realNow - 25 * 60 * 1000;
const claimed = core.claim("delegate", "worker-2");

core.close();
console.log(`Seeded ${dbPath}`);
console.log(`  Initiative #${initiativeId} with ${taskIds.length} Tasks; live claim on #${claimed?.id}`);
console.log(`Run the app:  AI_TODO_DB=${dbPath} pnpm dev`);
