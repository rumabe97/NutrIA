# 0028 — An admin screen that cannot read anyone

- **Status**: accepted
- **Date**: 2026-09-09
- **Project**: none (task, at the owner's decision)

## Context

The owner runs this alone and has had no way to see the service. Whether
generation is working, what it failed on, how much of the catalogue is
illustrated — all of it lived in a serverless function's log, or in a database
they had to query by hand. `0024` made a failure reportable to Sentry; that
still needs the DSN set, and it says nothing about the shape of the whole.

The roadmap's admin entry read "generation monitoring, AI failure review,
safety-flag triage, catalogue management" — four things, and three of them are
ways to end up reading people's food.

## Decision

**One screen, answering only questions that need nobody's data.**

- `/admin`, behind `@Roles('admin')`, which the guard resolves from the stored
  role and never from the request. Anyone else gets 404, on the route and on the
  page: a 403 would confirm that `/admin` exists.
- It shows: accounts and how many wait for activation; recipes and how many are
  without a picture; the catalogue's size; plans by state; and the last
  twenty-five generations with their state, duration, attempts, stable failure
  code and the provider's own redacted message.
- **No user list, no plan viewer, no profile.** Those are the screens an admin
  surface grows by accident, and each one turns "I run this" into "I can read
  your health data". The two questions worth a screen — is generation working,
  and how big is the catalogue — are answerable without any of it. The repository
  behind it selects no column that carries content.
- There is no link to it. The person who needs it knows the address.

## Consequences

- A failed generation is now visible without a screenshot from the person it
  failed, and the stable code says whether it was the quota, the key or a pool
  too small.
- Safety-flag triage and catalogue management stay unbuilt. The first has no
  flags to triage yet; the second is a seed file in git, which is a better place
  to edit a catalogue than a form.
- The screen reads the same tables the product writes; nothing new is recorded
  for it.
