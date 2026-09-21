# A preview environment — what it would take

> **Purpose**: the one recommendation of 2026-09-21 that was **not built**, written down so
> it can be: a deployment of every pull request, on its own database, before anything
> reaches production. It needs the owner's Neon and Vercel accounts and one decision about
> people's data, so it is a proposal, not a runbook yet.
> **Audience**: the owner, and the agent that builds it. **Committed**: yes.
> **Maintained by**: agents draft, owner approves. Facts are labelled **confirmed** or
> **hypothesis**.

## What is missing without it

Everything goes from CI to production. CI is thorough — the gate, coverage, the web build,
the end-to-end suites, the migration guard, the upgrade rehearsed on reference data — and
all of it runs on a container that was empty a minute earlier. Two things are never seen
before production: **a migration meeting real rows**, and **the two deployed projects
talking to each other** as they do on the host (the proxy, the cookie, the function limits).

## Why there is none today — confirmed

`ignoreCommand` in both `vercel.json` files skips every branch but `main`, on purpose
(`deployment.md` § 3): a preview URL is in neither `ALLOWED_ORIGINS` nor `BETTER_AUTH_URL`,
so nobody can sign in on one, and a preview that half-works is worse than none.

## The shape

1. **A database per pull request.** Neon branches are copy-on-write and cost nothing until
   they diverge; its GitHub Action creates one when a pull request opens and deletes it when
   it closes. The API's preview build then runs `migrate` against *that* branch — which is
   the rehearsal that matters. Needs `NEON_API_KEY` and the project id as repository
   secrets. **hypothesis**: the free plan's branch limit (ten) is enough for one developer.
2. **Both projects deployed per branch, knowing each other.** The host's branch URLs are
   deterministic (`<project>-git-<branch>-<team>.vercel.app`) — **hypothesis**, to be
   confirmed on this account. So on a preview the web app's `API_UPSTREAM_URL` and the
   API's `APP_URL`, `BETTER_AUTH_URL` and `ALLOWED_ORIGINS` can be *derived* from
   `VERCEL_GIT_COMMIT_REF` instead of set by hand. That is code: `next.config.js`,
   `Env.validation.ts` (derive only when `VERCEL_ENV=preview`, never in production), and
   removing the two `ignoreCommand`s.
3. **Nothing leaves a preview.** No mail (`SMTP_*` unset in the Preview scope), no model
   (`AI_PROVIDER=stub`), Stripe test keys only (a live key on a preview is already refused
   at boot), and crons do not run on previews — **confirmed** for the host's crons.
4. **The smoke test, pointed at it.** `WEB_URL=… API_URL=… node scripts/smoke.mjs` already
   takes any origin; CI would run it against the preview before the merge is allowed.

## The decision that is the owner's

A Neon branch of production **contains production's data**: what people eat, their
allergies, their conditions and medication. A preview is a URL on the internet.

- **Branch from production** — the migration is rehearsed against real rows, which is the
  whole point; the preview must then be behind the host's deployment protection, never
  shared, and deleted with the pull request. People's health data sits in a second place.
- **Branch from a `staging` branch** that has production's schema and the seed, and no
  people — nothing sensitive is copied; the migration meets reference data only, which is
  what CI's rehearsal already does.

The second is the safer default and the first is the more useful one. `PRODUCT.md` and the
privacy policy say health data is held for one purpose; a copy for testing is a second one.
**Recommended: `staging`, plus the migration reviewer for the user tables** — and revisit
the day a migration on a big user table is worth a protected, short-lived copy.

## What the owner does, and what an agent does

| Step | Who |
| --- | --- |
| Decide between the two shapes above | Owner |
| Create the `staging` branch in Neon; an API key for the Action; add both as repository secrets | Owner |
| Set the Preview-scope variables on both host projects (the secrets that cannot be derived) | Owner |
| The derivation in `next.config.js` and `Env.validation.ts`, with tests; the workflow; removing `ignoreCommand` | Agent — `/team`, with `invariant-reviewer`, since it touches what the API trusts |
| Deployment protection on previews, confirmed from a private window | Owner |
