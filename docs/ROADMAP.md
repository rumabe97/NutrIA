# Roadmap

> **Purpose**: where the product is going, at milestone level. Projects are born here:
> each milestone becomes one or more projects under `docs/projects/`.
> **Audience**: humans and agents. **Committed**: yes. **Maintained by**: owner and
> agents together — agents propose reordering when reality diverges, the owner decides.

## Now

**Milestone: a user receives a real 14-day plan.**

[`002-plan-generation`](./projects/002-plan-generation/) — **delivered**, confirmed
working end to end by the owner on 2026-09-07 against a live database and a real AI
provider. One gate remains: phase 7's end-to-end suites are written and type-checked but
have never been executed, and want a throwaway database rather than the working one.

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
   five a plan, list rebuilt), complete / skip (done, `0016`) — the "faster, cheaper,
   vegetarian, no cooking, more protein" axes on a swap remain.
2. **A user can shop from it.** Done: consolidated list per plan, grouped by aisle, editable,
   rebuilt on every swap, always matching the active plan.
3. **The loop closes.** Weight tracking (done), eaten / skipped on each meal (done, `0016`),
   the fortnightly check-in feeding the next plan (done, `0018`), a progress screen over
   the data already kept (done, `0020`), plan history, read-only (done, `0021`).
4. **The assistant.** Nutrition-scoped, context-efficient, with the medical boundaries in
   `PRODUCT.md` enforced rather than requested.
5. **Settings and notifications.** Preference editing outside onboarding (done, from the
   profile), password-reset mail (done, `0019`), reminders and notification preferences —
   and verification mail, the day access opens to everyone (`0017`).

## Later / someday

- Admin: generation monitoring, AI failure review, safety-flag triage, catalogue management.
- English alongside Spanish; country-aware ingredient availability.
- Vacation mode — a temporary lifestyle override that does not destroy the normal plan.
- Analytics on the events already reserved in `analytics_events`.
- CI. The deployment is live (`docs/reference/deployment.md`) but no workflow runs the gate
  before the host builds `main`; the end-to-end suites still want a throwaway database.
- Error visibility. Failures reach the owner as screenshots; an error tracker's free tier
  would reach them first.
