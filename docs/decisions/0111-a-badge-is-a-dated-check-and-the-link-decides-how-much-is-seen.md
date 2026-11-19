# 0111 — A badge is a dated check, and the link decides how much is seen

> **Purpose**: one decision record (ADR). Captures the WHY that chat sessions lose.
> **Audience**: future agents and humans. **Committed**: yes. **Maintained by**: agents
> draft one immediately after any decision that constrains future work. ADRs are
> immutable: a changed decision is a NEW record that supersedes the old one.

- **Status**: accepted
- **Date**: 2026-11-18
- **Deciders**: agent (planner of project 025), approved by the owner with the plan on 2026-11-18
  (tapped option), within his decisions of
  [`0110`](./0110-anyone-may-offer-their-services-and-a-checked-badge-is-what-opens-health-data.md)
  and his answers of 2026-11-18 recorded in the PRD
- **Project**: [`docs/projects/025-anyone-can-open-a-practice`](../projects/025-anyone-can-open-a-practice/)

## Context

`0110` decides *what* holds: anybody may practise, a badge checked by the owner opens health
data, and an un-badged practitioner sees only the plan they write. It does not decide *how*
the code holds it. Project 025 reshapes `CareController.withClient`, the one audited path into
a client's data (`0059`), and the shapes below are what every later project of
[`0013`](../reference/architecture/0013-a-marketplace-of-professionals-2026-11-18.md) § 9
builds on. Choosing them during execution would let a phase choose them by accident.

## Decision

1. **"May practise" stays the `professionals` row.** It becomes self-service;
   `collegiate_number` becomes nullable and is no longer read by any screen. Every join on the
   delegated path keeps reading the same row (`0013` § 2.3).
2. **A badge is derived, never stored as a flag.** An append-only `professional_badge_checks`
   table holds each step — the practitioner's application (`applied`, with the register and
   number they declared), then the owner's checks with checker, date, result, channel, and,
   for a failure, withdrawal or lapse, its reason — and the badge *is* "the latest decisive
   row (an application is not one) is a pass not more than 30 days past its due date (twelve
   months after the check)". It is computed in one
   repository function, read on every request and cached nowhere, so a lapse or a removal
   closes access on the next request with no job having to run first. The grants of project
   004 are backfilled as one pass each, due 30 days after the migration.
3. **The code is its own row.** `professional_badge_codes`: hashed, single-use, bound to one
   check and one channel, expiring after 30 days (post is slow). The contact it went to is
   typed by the owner in the console; no practitioner route accepts a contact.
4. **The link decides the view.** `CareRepository.activeLink` returns a `scope`: `full` only
   when the badge stands **and** the link's own consent covers the badged list
   (`care_links.consent_scope`, existing rows backfilled `full`, because they consented to 004's
   list), else `plan`. `withClient` refuses every kind outside the scope with the same 404 as
   any denial, beside its health branch; the health branch needs `full` too. A badge gained
   mid-link widens nothing until the client consents again; a badge lost narrows on the next
   request. *Amended 2026-11-19 (project 025 phase 5, the invariant review):* a badge lost also
   narrows the **stored** consent — the practitioner's open links become `plan` with the health
   line off and `narrowed_at` dated, in the owner's removal, in the daily sweep, and before any
   pass recorded while no badge stood — so a badge that comes back finds nothing wider than
   `plan`. Only the client's re-consent widens, and it leaves its own date and version
   (`scope_consented_at`, `scope_consent_version`) without rewriting the acceptance's.
5. **A plan made through a link carries the link.** `meal_plans.care_link_id`, nullable, set
   null if the link row goes, written when the professional generates through `withClient`,
   when a plan lands `pending_review` for that link (reviewing it is how it becomes theirs),
   and at publish. A `plan` scope lists and opens only plans carrying its own link. Project 2's
   `authored_by` may derive from it; it does not replace it.
6. **A free practice's seats are an allowance** in `0097`'s registry (`practiceClients`,
   structural, 10 on both tiers), read for the practitioner's account and enforced in the same
   transaction as the invitation, as `0097` requires. A practice with `practiceOpen` keeps
   `includedClients`. `tierOf` is not touched.
7. **The protected words are one function in `core/domain`.** It normalises case, accents,
   punctuation and spacing, and the profile's schema runs it with the badge as context. When a
   badge goes, a profile carrying badge-only words returns to the owner's queue and those
   fields stop rendering until edited.
8. **The illness rule has three enforcement points and no fourth**: the acceptance transaction
   (`CareRepository.accept`), the declaration transaction (`HealthController.replace`), and the
   daily `/cron/reminders` sweep for a badge lost under a client who has one. Each ends or
   refuses the link. *Amended 2026-11-19 (phase 5; legal F4, `textos/06` § Y):* **nothing
   distinct reaches the practitioner** — a refused acceptance is an invitation left unanswered,
   and a rule ending reads to them exactly as a link the client ended (`ended_by` `declared` and
   `badge_lost` are the client's to read, and map to `client` in anything a practitioner sees).
   The client is told: on the screen at acceptance and at the save, and by one mail when the
   sweep ends the link. The sentence this replaces said a notice was queued to the
   practitioner; the approved texts and PRD 22 decided otherwise before any code was written.
9. **The owner's grant route is retired.** `POST /admin/accounts/:id/professional` goes; its
   successor is the badge check. The owner's revoke of "may practise" stays.

## Alternatives considered

- **Badge columns on `professionals`** (`0013` § 3's first sketch). Simpler, but a yearly
  re-check and statements of reasons need history, and a stored flag needs a job to clear it on
  time; a lapse that waits for a cron is a day of health data to someone unchecked.
- **The view decided by the badge alone.** Lost: a badge granted mid-link would widen what the
  client consented to without asking them (legal § 3.e).
- **The view cut on the screens or in the API presenters.** Lost: a forgotten route leaks; the
  cut belongs in core where every delegated read already passes.
- **"Plans they made" as the plan under way and its history** (`0013` § 14). The owner chose
  otherwise on 2026-11-18.
- **A seat constant in code.** Lost to `0097`: a number a tier is allowed is read, not assumed,
  and the console is where the owner moves it.

## Consequences

- One migration, additive except a `DROP NOT NULL` and two backfills; it goes through
  `migration-reviewer`.
- `invariant-reviewer` reads every phase that touches `withClient`, `activeLink`, `roster`,
  `activeProfessional` or the guard.
- Project 4 reads `professional_profiles`' first-look state to decide appearance; project 2
  reads `care_link_id`.
