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

## 1. One origin, or a domain you own

This is the first decision, not the last, because everything else is downstream of it.

The browser calls the API with `credentials: 'include'`, and the session cookie is
`sameSite: 'lax'`. The web app must be able to **read** that cookie, not only the API:
`proxy.ts` checks it to decide whether a visitor is signed out, and `server-api.ts`
forwards it on every server-rendered read. Two `*.vercel.app` hosts cannot share one:
`vercel.app` is on the Public Suffix List, so to a browser they are different *sites*,
the same as two unrelated websites. Sign-in succeeds and every protected page then
bounces to `/acceder`, with nothing in any log.

There are two shapes that work. **This deployment uses the first.**

### Shape A — one origin, no custom domain (current)

The browser only ever talks to the web host. `next.config.js` proxies `/api/v1/*` to
the API deployment (`API_UPSTREAM_URL`), so the cookie is an ordinary first-party
cookie on the web host. Server-rendered reads go to the API directly.

| | Host |
| --- | --- |
| Web (the only origin a browser sees) | `https://nutr-ia-web-phi.vercel.app` |
| API (reached through the proxy, and by the web server directly) | `https://api-liard-kappa.vercel.app` |

`COOKIE_DOMAIN` stays **empty**. `BETTER_AUTH_URL` and `ALLOWED_ORIGINS` are the
**web** origin, because that is the origin the browser's requests carry.

### Shape B — sibling subdomains of a domain you own

`nutria.app` for the web and `api.nutria.app` for the API. The browser talks to the API
directly; `COOKIE_DOMAIN=.nutria.app` (leading dot) makes the cookie a parent-domain
cookie both hosts see. Sibling subdomains are the same *site*, so `sameSite: 'lax'` is
unchanged. `API_UPSTREAM_URL` is unset — no proxy — and `BETTER_AUTH_URL` is the API
origin. Move to this when there is a domain; nothing in the code changes.

## 2. Environment

The web app takes **two** variables, and no secret among them:

| Variable | Shape A (current) |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://nutr-ia-web-phi.vercel.app/api/v1` — the web app's **own** origin |
| `API_UPSTREAM_URL` | `https://api-liard-kappa.vercel.app/api/v1` — server-only; the proxy target |

No database URL, no auth secret, no provider key is ever set on the web project.
That is not a convention, it is the architecture: the browser must never reach
PostgreSQL, and an AI key in a `NEXT_PUBLIC_` variable is a key in the page source.

The API takes the inventory in `apps/api/.env.example`. The ones whose values differ
from local development:

| Variable | Shape A (current) |
| --- | --- |
| `NODE_ENV` | `production` — the process refuses to boot otherwise on a production deployment |
| `APP_URL` | `https://nutr-ia-web-phi.vercel.app` |
| `BETTER_AUTH_URL` | `https://nutr-ia-web-phi.vercel.app` — the web origin, not the API's |
| `ALLOWED_ORIGINS` | `https://nutr-ia-web-phi.vercel.app` — required, and rejected if it contains localhost |
| `COOKIE_DOMAIN` | *(empty)* |
| `SWAGGER_ENABLED` | leave unset — off by default outside development; an explicit `true` is refused, because the schema describes every endpoint to anyone who asks |
| `DATABASE_URL` | Neon's **pooled** endpoint (host contains `-pooler`) |
| `DIRECT_DATABASE_URL` | Neon's **direct** endpoint — the build runs migrations through it |
| `AI_REWRITE_STEPS` | `false` on a free-tier project: the rewrite sweep would spend the daily request cap generation needs in ~2 hours; `true` with billing |
| `AI_ILLUSTRATIONS` | `false` until billing is enabled on the Google AI project (its free tier allows **zero** image generations); then `true` |
| `CRON_SECRET` | any 16+ characters (`openssl rand -base64 32`); the platform sends it as a bearer on a cron call. **No cron is scheduled today** — see §3b. Unset, the routes 404 and say so in the log |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | the password-reset sender (`0019`), see §5c. All five together or none: a host without credentials or a sender is refused at boot. With none, reset links go to the log and nobody receives them |

`Env.validation.ts` refuses to boot on a bad environment and reports every problem at
once. In production it is stricter than in development on purpose — and it checks
that it *is* in production: the platform sets `VERCEL_ENV=production` on every
production deployment, and a `NODE_ENV` that disagrees is refused, because every
production-only rule depends on it. Do not copy a local `.env` into the project's
environment wholesale; `NODE_ENV=development` and the localhost URLs in it are
exactly what the rules exist to reject, and the build will fail naming each one.

Both `vercel.json` files pin their functions to `fra1`, the platform's name for
the `eu-central-1` region the Neon database lives in. Left unset, functions run
in `iad1` (Washington), and every one of the several database round trips a
request makes crosses the Atlantic — measured at ~100 ms each, against ~2 ms
colocated. The web app is pinned too, not only the API: its server components
call the API on every page, so the two must sit together. If the database ever
moves, move both pins with it. One region is all a Hobby project may choose,
which is fine — one is all this needs.

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

## 3b. The crons are off

`apps/api/vercel.json` has **no `crons` block**, so the platform schedules nothing and the
three routes are only reachable by hand with the bearer. They were removed on 2026-09-09,
at the owner's request, while the project runs on free tiers.

| Route | What it spends | Also gated by |
| --- | --- | --- |
| `/api/v1/cron/illustrate` | one image generation per recipe — the expensive one | `AI_ILLUSTRATIONS`, off by default |
| `/api/v1/cron/rewrite-steps` | one text generation per recipe, from the same daily cap generation needs | `AI_REWRITE_STEPS`, off by default |
| `/api/v1/cron/reminders` | **nothing from the AI provider** — one SMTP send per account, at most once a fortnight | `SMTP_HOST`; sends nothing without it |

Turning one back on is putting its entry back:

```jsonc
"crons": [{ "path": "/api/v1/cron/reminders", "schedule": "0 8 * * *" }]
```

Vercel reads the block at deploy time, so a redeploy is what starts it. Note that a
scheduled call costs a function invocation whether or not the route does any work: with the
block removed, even that stops.

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
   composed from catalogue slugs. **Re-run it whenever `packages/database/src/seed/`
   changes** — a new ingredient, a new substitution pair — with `DATABASE_URL`
   pointing at the deployed database. A deploy runs migrations, never the seed,
   so a pair added in the repository is invisible until someone does.

## 5b. Activating an account

Access is opened account by account (`0017`). A new sign-up can sign in but lands
on `/pendiente` until its email is marked verified. Until a mail provider is
configured, that is a row update on the direct (session-mode) endpoint:

```sql
update "user" set email_verified = true, updated_at = now() where email = 'persona@ejemplo.com';
```

To see who is waiting: `select email, created_at from "user" where not email_verified order by created_at;`.
The change takes effect on the person's next page load; nothing needs redeploying.

## 5c. Mail: the password-reset link

The product sends exactly one mail, the password-reset link (`0019`). Verification
links are never mailed — activation is §5b. Any SMTP provider works; the API talks
to it on port 587 (STARTTLS) or 465 (implicit TLS). Port 25 is blocked by the platform
and is not needed.

**Gmail, until there is a domain.** A dedicated Google account, not a personal one —
the app password grants full send rights on it.

1. In the Google account, turn on two-step verification (Security → 2-Step Verification).
   App passwords do not exist without it.
2. Security → *App passwords* → create one named `NutrIA`. Google shows sixteen characters
   once; copy them without the spaces.
3. On the API project's environment (production):

   | Variable | Value |
   | --- | --- |
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `465` |
   | `SMTP_USER` | the Gmail address |
   | `SMTP_PASS` | the sixteen-character app password |
   | `EMAIL_FROM` | the same Gmail address — Gmail rewrites any other sender to the account's own |

4. Redeploy the API (environment changes do not apply to a running deployment), then
   request a reset from `/recuperar` for your own account. The mail arrives from
   "NutrIA <address>"; the link opens `/restablecer`. If nothing arrives, the API log
   has one line per attempt: `password reset mail sent` or `mail NOT sent` with the
   provider's reason, never the address.

The page the link lands on is written into the link as an absolute URL on `APP_URL`
before it is mailed. Better Auth resolves a relative one against the host *it*
received the request on — the API's own host behind the proxy — and the first
production link ended on the API's 404 page. `APP_URL` must therefore be the web
origin (it is, in §2) whichever shape the deployment has.

Gmail allows a few hundred messages a day from an ordinary account, which a
hand-activated user base does not approach.

**A provider on the product's own domain, when there is one.** A transactional service
(Resend, Postmark, Brevo — all have a free tier and all speak SMTP) verifies the domain
once with three DNS records (SPF, DKIM, DMARC) and then any address on it may send.
Nothing in the code changes: the same five variables, the service's SMTP host and
credentials, `EMAIL_FROM` becoming `hola@` the domain. Buying the domain through the
hosting platform puts the DNS where the deployments already are, and gives the web app
its real address at the same time (§1, shape B).

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

## 8. Backups

Two different questions, and they have different answers.

**"I deleted the wrong rows an hour ago."** The database host's own history. Neon keeps a
restore window on every branch and restoring is creating a branch from a moment in the past:
Console → the project → Branches → *Create branch* → *From a point in time*. The new branch
comes up with its own connection string, so nothing is overwritten while you look — point
`DIRECT_DATABASE_URL` at it, check the rows are there, and only then decide whether to move
the app to it or copy rows back.

**Check the window's length in the console and write it here — it is the one number this
file cannot know**, because it is a property of the plan, not of the code:

> Restore window on this project: ______ (Neon Console → Settings → *History retention*).

That number is also the honest limit of this line of defence: past it, and for anything that
loses the Neon project itself (an account closed, a plan expired, a database dropped by
hand), the host has nothing.

**"The project is gone."** A logical export, run by hand:

```bash
cd packages/database
DIRECT_DATABASE_URL='postgresql://…' BACKUP_DIR=~/nutria-backups pnpm backup
```

It writes one newline-delimited JSON file per table plus a `manifest.json` with the row
counts and the migration the data was shaped by — 46 tables and about 2 MB today. The schema
is **not** in that folder: it is the migrations in git, which is why the manifest names the
last one applied. A restore is therefore: create a database, `pnpm --filter database migrate`
up to that migration, then load the rows in foreign-key order.

Three things to be honest about:

- **There is no restore script.** Loading 46 tables in dependency order is a program that
  must be right the day it is used, and one written now and never run is not a backup, it is
  a belief. The export exists so the data survives; the host's own restore is the path that
  has been tested by the people who wrote it.
- **The file carries every user's health data.** It is not encrypted and it is not uploaded
  anywhere — `backups/` is in `.gitignore` and the script picks no destination, because
  where a file like that lives is a decision, not a default.
- **Nothing runs it on a schedule.** No cron is scheduled at all right now (§3b), and a
  backup nobody runs is worth what it sounds like. Until that changes, it is a habit: before
  a migration that drops or rewrites a column, and before anything else you would not want
  to do twice.

## 7. Known gaps

- **The app's rate limiter still counts per instance.** `RateLimitGuard` holds its windows
  in memory, so its effective limit multiplies by however many instances are warm. The
  auth routes no longer do — Better Auth counts those in the database (`0007`, amended) —
  and the expensive paths are quota'd in Postgres already (one redo a fortnight, five swaps
  a plan). What is left is a coarse abuse guard on ordinary reads, where a database write
  per request would cost more than it protects.
- **The gate runs, the deploy does not wait for it.** `.github/workflows/ci.yml` runs
  `pnpm turbo lint ts:check test` on every push to `main` and every pull request, but the
  host still builds whatever lands on `main` regardless. A red run is a record, not a
  brake; making it one means a branch protection rule on the repository, which is a
  setting rather than a file. The end-to-end suites are not in CI: they need a live
  throwaway database, which means a secret and a branch to reset.
- **No backup runs on a schedule, and no restore has been rehearsed.** §8 says how to take
  an export and how the host's own restore works, and the export has been run; neither has
  been used in anger. The restore window's length is still a blank in §8 that only the
  console can fill.
