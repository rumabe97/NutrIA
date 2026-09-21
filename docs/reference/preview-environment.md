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

## What the two accounts say — read on 2026-09-21, nothing changed

Read-only, names and targets only, no value decrypted. All **confirmed**.

- **The Preview scope is production.** On both host projects every variable that reaches a
  preview is *the same entry* as production's, ticked for both. For the API that is
  `DATABASE_URL`, `DIRECT_DATABASE_URL`, `BETTER_AUTH_SECRET`, `SMTP_*`, `CRON_SECRET` and
  the provider keys; for the web app, the three URLs. So `ignoreCommand` is today the only
  thing between a branch and the production database: remove it and change nothing else,
  and the first preview build runs `migrate` against production, then serves production's
  people from a second URL.
- **Only in production**, so absent on a preview: the Google pair, the three VAPID keys,
  the gateway's key and models, `OWNER_EMAIL`. Every one belongs to an all-or-none group
  that `Env.validation.ts` lets be absent.
- **Deployment protection is on** for everything except the production domains, on both
  projects. The owner signs in to see a preview; the web app's server, calling the API's
  preview, meets the same wall. **hypothesis**: the free plan's bypass secret for
  automation covers a project calling another.
- **Branch URLs are deterministic**: `<project>-git-<branch>-<scope>.vercel.app`.
- **The database is one free project with two branches** — `develop` is the root,
  `production` its child and the default. The allowance is *per project*: 100 compute
  hours, 0.5 GB, 5 GB of network transfer and ten branches a month. Going over compute or
  transfer **suspends the project's compute until the month turns** — no charge is
  possible, and production is in that project. Fifteen days in: 19 compute hours, 77 MB,
  and **2.0 of the 5 GB of transfer, 87% of it from `develop`** — the end-to-end suites run
  locally, the seed library, the plan evaluator. CI is not in that number: it uses a
  container.
- **The host's free plan**: 100 deployments a day, and a merge is two. Going over pauses the
  feature, it never bills. The plan is for non-commercial use: the day a real payment is
  taken, the host's terms ask for the paid one.

Two things follow, and the second is true with or without previews:

1. **Order.** The Preview scope gets its own database variables *first*, that is checked by
   names and targets, and only then does `ignoreCommand` go. And the build carries its own
   refusal: on `VERCEL_ENV=preview`, `migrate` does not run unless a variable that exists
   only in the Preview scope says the database is a preview one.
2. **Nothing that is not production should spend production's allowance.** A branch per
   pull request *in this project* adds its transfer and compute to the 5 GB and the 100
   hours production lives on. Previews belong in **a second free project** — its own
   allowance, no card, and no branch of production possible from it, which is the
   `staging` shape recommended below anyway. Moving `develop` there too is the same
   argument, and the larger saving.

## The shape

1. **A database per pull request.** Neon branches are copy-on-write and cost nothing until
   they diverge; its GitHub Action creates one when a pull request opens and deletes it when
   it closes. The API's preview build then runs `migrate` against *that* branch — which is
   the rehearsal that matters. Needs `NEON_API_KEY` and the project id as repository
   secrets. **confirmed**: the free plan allows ten branches a project, two are in use.
2. **Both projects deployed per branch, knowing each other.** The host's branch URLs are
   deterministic (see above). So on a preview the web app's `API_UPSTREAM_URL` and the
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
| Create the second free project and its `staging` branch in Neon; an API key for the Action; add both as repository secrets | Owner, or an agent with a yes for each act |
| Give the Preview scope its own database variables on the API project, **before** anything else, and check it by names and targets | Owner, or an agent with a yes for each act |
| Set the rest of the Preview-scope variables on both host projects (the secrets that cannot be derived) | Owner |
| The derivation in `next.config.js` and `Env.validation.ts`, with tests; the workflow; removing `ignoreCommand` | Agent — `/team`, with `invariant-reviewer`, since it touches what the API trusts |
| Deployment protection on previews, confirmed from a private window | Owner |
