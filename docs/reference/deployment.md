# Deployment runbook

> **Purpose**: how NutrIA reaches production, what the owner must do by hand, and the
> failure modes that are specific to running this API as a serverless function.
> **Audience**: humans and agents. **Committed**: yes. **Maintained by**: agents draft,
> owner approves. Update it in the same change that invalidates it.

Two projects on one host, from one repository:

| Project | Root directory | Serves |
| --- | --- | --- |
| `nutria-web` | `apps/web` | The Next.js app the browser loads |
| `nutria-api` | `apps/api` | The NestJS API, as a single function |

`apps/docs` is not deployed. It is developer documentation and has no production role.

---

## 1. The domain decides whether authentication works

This is the first decision, not the last, because everything else is downstream of it.

The browser calls the API directly with `credentials: 'include'`, and the session
cookie is `sameSite: 'lax'`. Two things must therefore be true:

1. The web app and the API must be on the **same site** — the same registrable
   domain. `nutria.app` and `api.nutria.app` qualify. Two `*.vercel.app` subdomains
   do **not**: `vercel.app` is on the Public Suffix List, so the platform's own
   subdomains are different sites to a browser, and the cookie is neither stored
   nor sent.
2. The cookie must be **readable by the web app**, not only by the API. `proxy.ts`
   checks it to decide whether a visitor is signed out, and `server-api.ts`
   forwards it on every server-rendered read. A host-only cookie on the API's
   subdomain is invisible to both, and the symptom is that sign-in succeeds and
   every protected page then bounces to `/acceder`.

So: **a custom domain is required**, and `COOKIE_DOMAIN` must be set to the parent
with its leading dot.

Suggested layout — DNS records point at the host, one per project:

| Host | Project |
| --- | --- |
| `nutria.app`, `www.nutria.app` | `nutria-web` |
| `api.nutria.app` | `nutria-api` |

## 2. Environment

The web app takes **one** variable, and it is public by construction:

```
NEXT_PUBLIC_API_URL=https://api.nutria.app/api/v1
```

No database URL, no auth secret, no provider key is ever set on the web project.
That is not a convention, it is the architecture: the browser must never reach
PostgreSQL, and an AI key in a `NEXT_PUBLIC_` variable is a key in the page source.

The API takes the inventory in `apps/api/.env.example`. The ones whose values differ
from local development:

| Variable | Production value |
| --- | --- |
| `NODE_ENV` | `production` |
| `APP_URL` | `https://nutria.app` |
| `BETTER_AUTH_URL` | `https://api.nutria.app` |
| `ALLOWED_ORIGINS` | `https://nutria.app,https://www.nutria.app` — required, and rejected if it contains localhost |
| `COOKIE_DOMAIN` | `.nutria.app` |
| `SWAGGER_ENABLED` | `false` — the schema describes every endpoint to anyone who asks |
| `DATABASE_URL` | Neon's **pooled** endpoint (host contains `-pooler`) |
| `DIRECT_DATABASE_URL` | Neon's **direct** endpoint — the build runs migrations through it |

`Env.validation.ts` refuses to boot on a bad environment and reports every problem at
once. In production it is stricter than in development on purpose — and it checks
that it *is* in production: the platform sets `VERCEL_ENV=production` on every
production deployment, and a `NODE_ENV` that disagrees is refused, because every
production-only rule depends on it. Do not copy a local `.env` into the project's
environment wholesale; `NODE_ENV=development` and the localhost URLs in it are
exactly what the rules exist to reject, and the build will fail naming each one.

Set the API's region to the one holding the Neon database. Every request makes
several round trips, and a cross-continent hop multiplies all of them.

## 3. What each deploy does

`apps/api/vercel.json` points the `@vercel/node` builder at `vercel/index.js` — a
committed one-line re-export of the built `dist/api/index.js`, so the builder has
nothing to compile and the function ships the same artifact the type gate passed —
and `vercel-build` runs:

```
turbo run build --filter=api...   # builds core + database, type-gates the API, then preflight
pnpm --filter database migrate    # applies pending migrations to the live database
```

`preflight` does two things the platform otherwise reports only at the first
request. It loads the deployed entry under the module rule the function runtime
applies — it refuses `require()` of an ES module, which local Node allows, so a
violating dependency passes every local check and kills the function at boot. And
it validates the environment exactly as boot would, so a development `NODE_ENV` on
a production deployment, or a localhost origin, fails the build — before anything
is migrated — naming each problem.

**Every production deploy applies migrations.** The build runs first so a type error
stops the deploy before it touches anything; a bad migration still blocks every
subsequent deploy. Review migrations as production changes, not as code.

The build log is expected to be clean. If it ever shows TypeScript errors from the
builder itself (`Property 'headers' does not exist on type 'Request'`, hundreds of
them), the entry has been pointed back at a `.ts` file — see `apps/api/AGENTS.md`
§ Deployment for why that is noise and why the cure is the shim, not hoisting.

`ignoreCommand` skips every branch but `main`. This is deliberate: a preview URL is
in neither `ALLOWED_ORIGINS` nor `COOKIE_DOMAIN`, so authentication cannot work on
one, and a preview that half-works is worse than none.

## 4. Long work outlives the response

Plan generation returns a job id in milliseconds and then works for thirty to
forty-five seconds. On a serverless host the invocation can be frozen the moment the
response is sent, so `PlanJobRunner` hands the work to `BackgroundTaskService`, which
calls `waitUntil` to keep the invocation alive until it settles.

Two consequences worth knowing before the first real generation:

- `maxDuration` in `vercel.json` is **300 seconds**. That needs a plan whose ceiling
  allows it; a 60-second ceiling does not leave enough headroom over a 45-second
  generation for one slow provider response.
- If the invocation dies anyway, the job row is the contract. `adoptCompleted` recovers
  the case where the plan committed, and `failStale` releases the rest. Nothing partial
  is ever stored — the plan is written in one transaction at the end.

## 5. Order of operations, first deploy

1. Create both projects, each with its root directory set, pointed at `main`.
2. Add the custom domain to each and wait for DNS.
3. Set the environment on each project — API first, so the first API deploy is not a
   boot failure.
4. Deploy the API. Then check `https://api.nutria.app/api/v1/health` returns
   `{"status":"ok"}` with the database up.
5. Deploy the web app. Sign up, and confirm the session survives a page reload — that
   is the check that `COOKIE_DOMAIN` is right, and it is the one that fails silently
   if it is not.
6. Seed the reference catalogue if this is a fresh database:
   `pnpm --filter database seed`. Generation cannot run without it — every dish is
   composed from catalogue slugs.

## 6. Before changing how the app is assembled

`src/config/CreateApp.ts` is the only place an application is put together, shared by
`main.ts` and the deployed entry. After touching it, run:

```
pnpm --filter api smoke:function
```

It stands a plain Node server in front of the deployed handler and checks that it
boots, that an unauthenticated read is 404 rather than 401, and that an unmatched
route returns the JSON envelope rather than the framework's HTML page. It needs a
live database, so it is not part of the green gate.

## 7. Known gaps

- **The rate limiter counts per instance.** `RateLimitGuard` holds its windows in
  memory, so the effective limit multiplies by however many instances are warm. It
  was already a documented trade; serverless is the moment it wants a shared store.
- **Nothing here is automated.** No CI workflow runs the gate before a deploy; the
  host builds whatever lands on `main`. Running `pnpm turbo lint ts:check test`
  before merging is currently a human step.
- **Backups are undocumented.** The database host has its own retention and this
  repository does not say what it is, how to restore, or who checks. A migration that
  drops a column after back-filling is exactly when that matters.
