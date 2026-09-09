# Roadmap

> **Purpose**: where the product is going, at milestone level. Projects are born here:
> each milestone becomes one or more projects under `docs/projects/`.
> **Audience**: humans and agents. **Committed**: yes. **Maintained by**: owner and
> agents together — agents propose reordering when reality diverges, the owner decides.

## Now

**Milestone: a user receives a real 14-day plan.**

[`002-plan-generation`](./projects/002-plan-generation/) — **delivered**, confirmed
working end to end by the owner on 2026-09-07 against a live database and a real AI
provider. Phase 7's end-to-end suites now run: 31 tests, seven suites, against a
throwaway database on the dev branch with a scripted model (see
`apps/api/test/README.md`). Their first execution found a real safety gap in
free-text allergies, fixed in `0004`'s amendment.

Next: [`003-trust-depth-and-polish`](./projects/003-trust-depth-and-polish/) — PRD
approved, plan being written. Trustworthy and overridable targets, onboarding that
resumes and is enforced server-side, a deeper profile (free-text allergens, conditions,
medications, supplements), English throughout, and a design pass.

*Delivered:* [`001-workspace-kickoff`](./projects/001-workspace-kickoff/) — landing page,
authentication, the ten-step onboarding, the profile, computed daily targets, the allergy
validator, the full schema, and the NestJS foundation.

**Blocked on the owner.** Nothing further can be verified without this:

1. A Neon project; `DATABASE_URL` (pooled) and `DIRECT_DATABASE_URL` (direct) in
   `apps/api/.env` and `packages/database/.env`.
2. `BETTER_AUTH_SECRET` — `openssl rand -base64 48`.
3. `pnpm --filter database migrate` then `pnpm --filter database seed`. The seed is
   **reference data, not sample data**: the allergy layer has nothing to enforce without it,
   and generation cannot resolve a single ingredient.
4. Optionally `AI_PROVIDER=google` with a free key from `aistudio.google.com/apikey`.
   Without a provider the engine runs on reuse alone, so the first generation against an
   empty recipe library fails with `GENERATION_POOL_TOO_SMALL` — by design, and the UI
   says so.

Then: `pnpm --filter api test:e2e` (see `apps/api/test/README.md`) and a look at the plan
screens at phone width, which closes project 002's two open gates.

## Next

1. **A user can live inside the plan.** Day navigation, meal detail with recipe and macros
   (done), favourite / dislike (done, `0014`), meal replacement (done, `0015`: library first,
   five a plan, list rebuilt), complete / skip (done, `0016`), the quicker / no cooking /
   more protein and vegetarian axes on a swap (done, `0022`). Cheaper waits for a price per
   ingredient.
2. **A user can shop from it.** Done: consolidated list per plan, grouped by aisle, editable,
   rebuilt on every swap, always matching the active plan.
3. **The loop closes.** Weight tracking (done), eaten / skipped on each meal (done, `0016`),
   the fortnightly check-in feeding the next plan (done, `0018`), a progress screen over
   the data already kept (done, `0020`), plan history, read-only (done, `0021`).
4. **Settings and notifications.** Preference editing outside onboarding (done, from the
   profile), password-reset mail (done, `0019`), the check-in reminder and its switch
   (done, `0027`), the owner told when an account is waiting (done, `0029`). Remaining:
   verification mail (done, `0030`) and any further reminder that can argue for itself.
   Opening access to everyone is now one switch: with automatic activation on, confirming
   the address opens the account (`0031`, amended); off, an admin turns the key.

## Later / someday

- Admin: generation monitoring and failure review are done (`0028`, `/admin`). Safety-flag
  triage has no flags to triage yet; catalogue management is a seed file in git, which is a
  better place to edit a catalogue than a form.
- English alongside Spanish; country-aware ingredient availability.
- Vacation mode: done (`0032`) — a trip pauses the plan and the days after it move with it,
  so nothing counts as skipped and the fortnight resumes on return. A generated plan *for*
  the trip is deliberately not built: it costs a model call per trip, and the question it
  answers is not the one people were asking.
- Analytics on the events already reserved in `analytics_events`.
- CI: the gate and the end-to-end suites both run on every push and pull request
  (`.github/workflows/ci.yml`); the suites get a Postgres container that dies with the job,
  so they need no secret and no shared branch. One thing remains, and it is the owner's: a
  branch protection rule, so a red run actually blocks a merge.
- Error visibility: done (`0024`). Set `SENTRY_DSN` on the API project to turn it on; unset,
  nothing is sent.

## Last, and deliberately so

**The assistant.** Nutrition-scoped, context-efficient, with the medical boundaries in
`PRODUCT.md` enforced rather than requested.

It sits at the end of this file, not because it is the least valuable — it may be the most
— but because of what it costs. Every message a user sends is a model call, on the same
free-tier daily cap that plan generation needs, and unlike generation it has no ceiling: a
plan is one call a fortnight per person, a conversation is as many as they feel like. Until
there is billing, shipping it would mean choosing between answering a question and building
a plan.

Two things to settle before writing any of it, both of them harder than the plumbing: what
it refuses to answer and how that refusal is enforced in code rather than asked for in a
prompt (`0004`); and what it is allowed to read, given that everything it could usefully
know about someone is health data.
