# Worked example: Slack thread → capture document

## The request

> Engineer: put this on my list https://acme.slack.com/archives/C04PAYENG/p1791885720001200

Today is Tuesday 2026-10-13. The engineer is `@alex`.

## Before writing

```sh
todo find --source https://acme.slack.com/archives/C04PAYENG/p1791885720001200 --json   # → []  (new Source)
todo find --source https://github.com/acme/payments-api/pull/2231 --json                 # → []
todo repo list --json      # → payments-api is registered
todo people --json         # → "Marco Ruiz" (@marco) and "Dana Okafor" (@dana) already exist
todo initiatives --json    # → nothing related
```

The Slack MCP returns the full thread:

> **Dana Okafor (@dana, EM Payments)**, 10:02: p99 on /checkout went from ~420ms to 1.3s since yesterday's deploy (release 2026.10.12). @alex can you take point? Leadership wants an update at Friday's ops review.
>
> **Marco Ruiz (@marco)**, 10:09: Suspect the new token-bucket limiter in payments-api. It does a Redis round-trip per request. PR #2214 introduced it, and flag `rate_limiter_v2` is at 100%.
>
> **Priya Shah (@priya, SRE)**, 10:15: Dashboard: https://grafana.acme.internal/d/checkout-latency. Redis p99 is fine (2ms), so maybe it's the connection pool. Pool size is 10 and we run 64 gunicorn workers.
>
> **Dana**, 10:21: Can we just turn the flag off?
>
> **Marco**, 10:24: Not without Risk. The limiter went in for the card-testing fraud spike. Omar (@omar) owns that call.
>
> **Marco**, 10:40: Put up a quick test PR bumping the pool to 64: https://github.com/acme/payments-api/pull/2231. Can someone review today?
>
> **Priya**, 10:44: Also, there are no tests for the pool-exhaustion path in the limiter at all.
>
> **Dana**, 10:52: @alex once we know the cause, let's do a lightweight incident note. Nothing heavy.

`gh pr view 2231 --repo acme/payments-api` shows a one-line change to `REDIS_POOL_SIZE` in `config/settings.py`, with CI green.

## Reasoning

- There are six distinct pieces of the engineer's work, all serving one outcome, so they go under an **Initiative**.
- "Turn the flag off?" is a production flag change that needs Risk's sign-off. That fails the low-risk test and needs a decider, so it's **Align** with Omar, not Delegate.
- Marco's PR is someone else's work for the engineer to judge: **Review**. It's due today because Marco asked for today.
- Finding the cause is investigation: **Deep Work**. It's due Friday, because the ops review needs an answer.
- Priya's missing tests could be specified, but the _intended_ pool-exhaustion behaviour is undecided, so the Task asks for characterisation tests of the current behaviour. That makes it fully specified, low risk, verifiable and in a registered Repo: **Delegate**.
- The update for leadership is one message from the engineer: **Quick**. It's due the day before the review.
- The incident note is a doc the engineer authors: **Write**. It has no date because it depends on the root cause.
- Priya is linked only where her input matters. Omar is new to the list, so he's created from his handle.

## The capture document

```sh
todo capture --json <<'EOF'
{
  "initiative": {
    "title": "Bring /checkout p99 back under 500ms",
    "description": "p99 on /checkout regressed from ~420ms to ~1.3s after release 2026.10.12, likely related to rate_limiter_v2. Done means: p99 back near baseline, cause understood, leadership updated, incident note written.",
    "priority": "high",
    "dueDate": "2026-10-16",
    "sources": [
      {
        "url": "https://acme.slack.com/archives/C04PAYENG/p1791885720001200",
        "summary": "#payments-eng thread, 2026-10-13. Dana (EM) asked @alex to take point on the /checkout p99 regression (~420ms → 1.3s since release 2026.10.12) and update leadership at Friday's ops review (2026-10-16). Suspect: rate_limiter_v2 (PR #2214, flag at 100%)."
      }
    ],
    "people": [{ "name": "Dana Okafor", "handles": ["@dana"], "role": "requester" }]
  },
  "tasks": [
    {
      "title": "Review Marco's pool-size PR (payments-api#2231)",
      "lane": "review",
      "priority": "high",
      "dueDate": "2026-10-13",
      "repo": "payments-api",
      "description": "Marco's quick test bumping the Redis connection pool from 10 to 64 to relieve suspected pool contention from rate_limiter_v2. Done means: approve or request changes, with a view on whether 64 is safe against Redis maxclients and whether this is a real fix or a band-aid.",
      "sources": [
        {
          "url": "https://github.com/acme/payments-api/pull/2231",
          "summary": "One-line change: REDIS_POOL_SIZE 10 → 64 in config/settings.py. CI green as of 2026-10-13. Opened by Marco as a quick test, not a reviewed fix."
        },
        {
          "url": "https://acme.slack.com/archives/C04PAYENG/p1791885720001200",
          "summary": "Marco (10:40, 2026-10-13) asked for a review today. Context: Priya (SRE) noted Redis p99 is 2ms, so latency is likely pool wait, not Redis. Pool size is 10 and there are 64 gunicorn workers. The limiter (PR #2214, flag rate_limiter_v2 at 100%) does one Redis round-trip per request. Open question: does Redis maxclients allow 64 × number of pods?"
        }
      ],
      "people": [{ "name": "Marco Ruiz", "handles": ["@marco"], "role": "author" }]
    },
    {
      "title": "Root-cause the /checkout p99 regression since release 2026.10.12",
      "lane": "deep-work",
      "priority": "high",
      "dueDate": "2026-10-16",
      "repo": "payments-api",
      "description": "Confirm or rule out connection-pool contention from rate_limiter_v2 as the cause of the p99 jump. Done means: cause identified with evidence (traces or metrics), and a recommended fix or mitigation ready for Friday's ops review.",
      "sources": [
        {
          "url": "https://acme.slack.com/archives/C04PAYENG/p1791885720001200",
          "summary": "Facts so far (2026-10-13): p99 /checkout ~420ms → 1.3s since release 2026.10.12 (Dana). Marco suspects the new token-bucket limiter from PR #2214, which does one Redis round-trip per request. Flag rate_limiter_v2 is at 100%. Priya (SRE): Redis p99 is 2ms; pool size 10 vs 64 gunicorn workers, so pool wait is plausible. Dashboard: https://grafana.acme.internal/d/checkout-latency. Marco opened PR #2231 (pool 10 → 64) as a test. Disabling the flag needs Risk sign-off (Omar), because the limiter guards against card-testing fraud. Deadline: answer for Friday's ops review, 2026-10-16."
        }
      ],
      "people": [
        { "name": "Priya Shah", "handles": ["@priya"], "role": "SRE, has the metrics" },
        { "name": "Marco Ruiz", "handles": ["@marco"], "role": "limiter context" }
      ]
    },
    {
      "title": "Agree with Omar (Risk) whether rate_limiter_v2 can be disabled or relaxed",
      "lane": "align",
      "priority": "high",
      "description": "Turning the flag off would likely fix latency but removes card-testing fraud protection. Omar owns that call. Done means: Omar has decided whether we may disable it, lower its scope (for example, checkout only), or must keep it while we fix performance.",
      "sources": [
        {
          "url": "https://acme.slack.com/archives/C04PAYENG/p1791885720001200",
          "summary": "Dana (2026-10-13) asked whether we can just turn rate_limiter_v2 off. Marco: not without Risk sign-off, because the limiter was added for the card-testing fraud spike, and Omar (@omar) owns that decision. Flag is at 100%. The p99 regression is ~420ms → 1.3s, and leadership wants an update at Friday's ops review (2026-10-16)."
        }
      ],
      "people": [
        { "name": "Omar", "handles": ["@omar"], "role": "decider (Risk)" },
        { "name": "Dana Okafor", "handles": ["@dana"], "role": "requester" }
      ]
    },
    {
      "title": "Add characterisation tests for the rate limiter's pool-exhaustion path",
      "lane": "delegate",
      "repo": "payments-api",
      "description": "The token-bucket limiter added in PR #2214 has no tests for what happens when the Redis connection pool is exhausted. Done means: tests that simulate an exhausted pool (all connections checked out) and assert the limiter's *current* behaviour (whatever it does today: block, time out, raise, fail open or fail closed), with the observed behaviour described in the PR body. No production code changes. The existing test suite and lint pass.",
      "sources": [
        {
          "url": "https://acme.slack.com/archives/C04PAYENG/p1791885720001200",
          "summary": "Priya (SRE, 2026-10-13): there are no tests for the pool-exhaustion path in the limiter. The limiter came in with PR #2214 and does one Redis round-trip per request. Pool size is currently 10 (PR #2231 proposes 64). The intended behaviour on exhaustion hasn't been decided, so these tests pin down current behaviour only."
        }
      ]
    },
    {
      "title": "Send Dana a status update ahead of Friday's ops review",
      "lane": "quick",
      "dueDate": "2026-10-15",
      "description": "Dana needs a short status on the /checkout regression for leadership at the 2026-10-16 ops review. Done means: a reply in the thread with the cause (or best current theory), the mitigation status and the next steps.",
      "sources": [
        {
          "url": "https://acme.slack.com/archives/C04PAYENG/p1791885720001200",
          "summary": "Dana (EM Payments, 2026-10-13): leadership wants an update on the /checkout p99 regression at Friday's ops review (2026-10-16). Reply in the same #payments-eng thread."
        }
      ],
      "people": [{ "name": "Dana Okafor", "handles": ["@dana"], "role": "requester" }]
    },
    {
      "title": "Write a lightweight incident note for the /checkout latency regression",
      "lane": "write",
      "description": "Dana asked for a lightweight incident note once the cause is known. Done means: a short note (summary, impact, timeline, cause, fix, follow-ups) shared in #payments-eng.",
      "sources": [
        {
          "url": "https://acme.slack.com/archives/C04PAYENG/p1791885720001200",
          "summary": "Dana (2026-10-13): \"once we know the cause, let's do a lightweight incident note. Nothing heavy.\" Timeline so far: release 2026.10.12 shipped (Mon). By 2026-10-13 10:02, p99 /checkout was ~1.3s, up from ~420ms. Suspect rate_limiter_v2 (PR #2214) with pool contention (pool 10 vs 64 workers). PR #2231 tests a pool bump. Disabling the flag needs Risk (Omar) sign-off. Dashboard: https://grafana.acme.internal/d/checkout-latency."
        }
      ],
      "people": [{ "name": "Dana Okafor", "handles": ["@dana"], "role": "requester" }]
    }
  ]
}
EOF
```

The CLI returns something like `{"initiativeId": 40, "taskIds": [41, 42, 43, 44, 45, 46]}`.

## Confirmation to the engineer

```
Captured the #payments-eng thread → Initiative #40 "Bring /checkout p99 back under 500ms" (high, due Fri 10-16):
- #41 Review Marco's pool-size PR: Review, high, due today
- #42 Root-cause the p99 regression: Deep Work, high, due 10-16
- #43 Agree with Omar whether rate_limiter_v2 can be relaxed: Align, high
- #44 Characterisation tests for limiter pool exhaustion: Delegate (payments-api)
- #45 Status update to Dana before ops review: Quick, due 10-15
- #46 Lightweight incident note: Write
Judgment calls: turning the flag off is Align with Omar, not a code change. #44 only pins down current behaviour because the intended behaviour isn't decided.
```
