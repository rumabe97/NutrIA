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
   five a plan, list rebuilt) — the "faster, cheaper, vegetarian, no cooking, more protein"
   axes and complete / skip remain.
2. **A user can shop from it.** Consolidated list per plan, grouped by aisle, editable,
   regenerable, always matching the active plan.
3. **The loop closes.** Progress tracking, the biweekly check-in, and next-plan generation
   that actually reads the previous fortnight's feedback. Plan history, immutable.
4. **The assistant.** Nutrition-scoped, context-efficient, with the medical boundaries in
   `PRODUCT.md` enforced rather than requested.
5. **Settings and notifications.** Preference editing outside onboarding, email delivery
   (SMTP is stubbed to the log today), reminders, and notification preferences.

## Later / someday

- Admin: generation monitoring, AI failure review, safety-flag triage, catalogue management.
- English alongside Spanish; country-aware ingredient availability.
- Vacation mode — a temporary lifestyle override that does not destroy the normal plan.
- Analytics on the events already reserved in `analytics_events`.
- Deployment and CI. Nothing is wired yet; the reference workspace's Vercel + GitHub Actions
  approach is the starting point, minus its known problems.
