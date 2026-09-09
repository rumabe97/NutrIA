# 0024 — A failure nobody saw

- **Status**: accepted
- **Date**: 2026-09-09
- **Project**: none (task, at the owner's decision)

## Context

Every fault in this product has reached the owner the same way: a person hit
it, took a screenshot, and sent it. That works for the ones somebody notices
and reports. It finds nothing else — a background generation that fails for one
account at three in the morning, a route that 500s for a single profile shape,
a provider that starts refusing after a quota resets. The log holds them, and
the log is a serverless function's stdout that nobody reads.

## Decision

**Failures are reported to Sentry, off by default, carrying nothing about the
person they happened to.**

- `SENTRY_DSN` unset — a fresh clone, the local machine, the test suites —
  means no client is initialised and nothing is sent. Same shape as every other
  optional integration here.
- Two hooks, both places where a failure is otherwise invisible: the exception
  filter, for anything it turns into a 5xx, and the plan job runner, where
  nobody is waiting on a response at all.
- **What is not sent, and why it is enumerated rather than trusted to a
  default.** This is a health product. A plan is what someone eats; a prompt
  carries their conditions, their medication and their body; an email is an
  identifier. So `beforeSend` deletes the request, the user and the response
  context whatever the SDK collected, `sendDefaultPii` is off, and messages pass
  through the same redaction the AI client logs use. The report is the error,
  its stack, the route *pattern* — never the URL, which carries ids — and the
  commit as the release.
- Traces are off. They would carry a timing for every request and buy nothing
  a log line does not already give, and the free tier is for errors.

## Consequences

- The owner learns about a failure before a user reports it, which is the whole
  point; nobody's data is the price.
- A report groups by a stable label (`GET /api/v1/meal-plans/:id`,
  `plan-generation:GENERATION_POOL_TOO_SMALL`), so a spike reads against a
  release rather than dissolving into one issue per id.
- The web app is not covered. Its own errors would need `@sentry/nextjs`,
  instrumentation files and source maps; the API is where the work happens and
  where a failure is silent.
