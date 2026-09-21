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
| `CRON_SECRET` | any 16+ characters (`openssl rand -base64 32`); the platform sends it as a bearer on a cron call. Two crons are scheduled: the rewrite sweep and the check-in reminder (§3b). Unset, the routes 404 and say so in the log |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | the password-reset sender (`0019`), see §5c. All five together or none: a host without credentials or a sender is refused at boot. With none, reset links go to the log and nobody receives them |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | the check-in reminder on phones (`0054`). Generate the pair once with `npx web-push generate-vapid-keys`; the subject is a `mailto:` or an `https:` URL. All three or none. With none, reminders go by mail only and the profile offers no switch for phones |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | sign in with Google (`0058`). Both or none. An OAuth client of type *Web application* from the Google Cloud console — unrelated to `GOOGLE_API_KEY` — whose one authorised redirect URI is `https://nutr-ia-web-phi.vercel.app/api/v1/auth/callback/google`: the **web** origin, because that is what `BETTER_AUTH_URL` is. With none, the sign-in page has no button and nothing else changes |
| `APPLE_OAUTH_CLIENT_ID`, `APPLE_OAUTH_TEAM_ID`, `APPLE_OAUTH_KEY_ID`, `APPLE_OAUTH_PRIVATE_KEY` | sign in with Apple (`0058`). All four or none; needs the Apple developer programme. The client id is the *Services ID*, the key is the `.p8` (as it is, or with `\n` for its line breaks). Return URL `https://nutr-ia-web-phi.vercel.app/api/v1/auth/callback/apple`. The client secret is signed from these at boot, so nothing is rotated by hand |
| `AI_PROVIDER` | `google` calls Gemini directly with `GOOGLE_API_KEY`; `omniroute` goes through a gateway and needs `AI_BASE_URL`, `OMNIROUTE_API_KEY` and `OMNIROUTE_MODEL` — the whole setup is in [`ai-gateway.md`](./ai-gateway.md) |
| `AI_BUDGET_SECONDS` | leave empty: 170 seconds for the model half of a generation, which fits the 300-second function (§4) |

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

There is no staging database between a merged migration and production, so three things
stand in front of the merge instead:

- **`node scripts/check-migrations.mjs --drift`**, in CI's required check. It refuses a
  merged migration that was edited, a schema changed with no migration, a journal that does
  not describe its files, and any statement that destroys data or fails on the rows already
  there — `DROP`, a type change, a rename, `NOT NULL` with no default — unless the file says
  a person looked: `-- reviewed-destructive: <where the data goes, and why it is safe>`.
- **The upgrade is rehearsed.** When a pull request brings a migration, the end-to-end job
  first builds the database the way `main` does, with the reference data in it, and only
  then applies what is new. A constraint the existing rows do not satisfy fails there. The
  user tables are empty in that container, which is what the third thing is for.
- **The `migration-reviewer` agent**, on every schema change: whether the API still running
  during the deploy survives the new schema, locks, and the way back.

The build log is expected to be clean. If it ever shows TypeScript errors from the
builder itself (`Property 'headers' does not exist on type 'Request'`, hundreds of
them), the entry has been pointed back at a `.ts` file — see `apps/api/AGENTS.md`
§ Deployment for why that is noise and why the cure is the shim, not hoisting.

`ignoreCommand` skips every branch but `main`. This is deliberate: a preview URL is
in neither `ALLOWED_ORIGINS` nor `COOKIE_DOMAIN`, so authentication cannot work on
one, and a preview that half-works is worse than none.

## 3b. The crons

`apps/api/vercel.json` schedules **two** of the three:
- the rewrite sweep, daily at 03:30 UTC, when nobody is building a plan;
- the check-in reminder, daily at 08:00 UTC ([`0054`](../decisions/0054-the-check-in-reminder-comes-back-behind-a-switch.md)).

The illustration sweep stays off. It was removed on 2026-09-09, at the owner's request, while
the project runs on free tiers, and can only be reached by hand with the bearer. Every cron
call needs `CRON_SECRET` on the API project: the platform sends it as the bearer, and without
it the route answers 404.

| Route | What it spends | Also gated by |
| --- | --- | --- |
| `/api/v1/cron/illustrate` | one image generation per recipe — the expensive one | `AI_ILLUSTRATIONS`, off by default |
| `/api/v1/cron/rewrite-steps` | one text generation per recipe, at most twelve a run, ending by 240 s. Through the gateway, its free models; on Google directly, the daily cap generation needs | `AI_REWRITE_STEPS`, off by default; `AI_REWRITE_MODEL` picks its model ([`ai-gateway.md`](./ai-gateway.md) §6) |
| `/api/v1/cron/reminders` | **nothing from the AI provider**: a mail and/or a push per account, at most once a fortnight | the **Check-in reminder** switch on `/admin`, off until thrown; `SMTP_HOST` for the mail and `VAPID_*` for the push. Sends nothing without either |

A daily run is what the Hobby plan allows. On a plan that runs crons hourly, `0 * * * *`
clears the 160 stale recipes of 2026-09-12 in about fourteen hours instead of two weeks.

Turning another one back on is adding its entry:

```jsonc
"crons": [{ "path": "/api/v1/cron/illustrate", "schedule": "0 4 * * *" }]
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
- Through a gateway's free models a generation takes longer — a model call runs 50 to
  100 seconds, and a combo that falls to its second model adds the first one's failure
  to it. So the model half has a budget of its own, `AI_BUDGET_SECONDS` (170 by
  default): every round of calls shares it, a call still waiting when it ends is cut
  and logged as a `timeout`, and the library covers the rest. The job ends inside the
  function whatever the model does.
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

Anyone may create an account. What happens when they confirm their address is the
switch on `/admin` (`0031`):

| Automatic activation | What confirming the address does | Who opens the account |
| --- | --- | --- |
| **On** (default) | Opens it. Nothing waits on you. | Nobody — the person does |
| **Off** | Only confirms the address | You, from `/admin` or the mail |

An account is usable only when **both** are true: `email_verified` and
`activated_at`. A new sign-up can always sign in, and lands on `/pendiente` until
they are. With the door closed the second one is your act — the button in the mail,
the list on `/admin`, or a row update on the direct (session-mode) endpoint:

```sql
update "user" set activated_at = now(), updated_at = now() where email = 'persona@ejemplo.com';
```

If somebody cannot receive the confirmation mail at all, the other half is a statement too —
you vouching for the address rather than them proving it:

```sql
update "user" set email_verified = true, updated_at = now() where email = 'persona@ejemplo.com';
```

Two easier ways than either: the button in the mail you get when an account lands in the
queue, and the list on `/admin`, which shows every account with both locks and needs an
account whose `role` is `admin`:

```sql
update "user" set role = 'admin', updated_at = now() where email = 'tu@correo.com';
```

To see who is waiting: `select email, created_at from "user" where activated_at is null order by created_at;`.

With `OWNER_EMAIL` set on the API project, you do not have to look: when somebody confirms
their address while activation is manual — the only moment an account joins the queue — that
address gets one mail naming the account and carrying the statement above, ready to paste
(`0029`, `0031`). Unset, nothing is sent and the query is the only way to know.
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
- **Nothing runs it on a schedule.** Neither of the two scheduled crons is a backup (§3b), and a
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
- **The deploy does not wait for the gate — the merge does.** The host builds whatever
  lands on `main`, regardless. What changed is that nothing lands there unchecked any more:
  the repository is public, so the ruleset on `main` is enforced (§9) — a pull request,
  both checks green and up to date, no force push. A red run is now a brake. What is left
  is the window *after* the merge, which §10 watches.
- **No backup runs on a schedule, and no restore has been rehearsed.** §8 says how to take
  an export and how the host's own restore works, and the export has been run; neither has
  been used in anger. The restore window's length is still a blank in §8 that only the
  console can fill.

## 9. Protecting `main` — the settings only the owner can change

Everything below is on github.com, under **Settings** for the repository. None of it lives
in this repo, which is why it keeps being listed as a gap rather than fixed in a commit.

### First, the plan wall

**A personal account on GitHub Free cannot enforce any branch rule on a private
repository.** The ruleset can be created, saved and shown as Active, and GitHub says so
in a banner while quietly applying none of it. Protected branches on private repositories
are the first thing GitHub Pro adds (~$4 a month); an organisation on Team is the other
route, and making the repository public is the third.

Until one of those, the brake is `.githooks/pre-push`, enabled once with
`pnpm hooks:install`: it runs `pnpm turbo lint ts:check test` and refuses the push if it
fails. It is a worse brake than a ruleset — it runs on the machine it restrains and
`--no-verify` walks past it — but it catches the failure worth catching here, which is a
red commit reaching `main` because the change looked too small to check. The end-to-end
suites are deliberately not in it: six minutes is too long to pay on every push, and CI
runs them on the pull request.

The rest of this section is what to configure the day the plan allows it.

### The rule that makes a red run a brake

**Settings → Rules → Rulesets → New branch ruleset.**

| Field | Value |
| --- | --- |
| Ruleset name | `main` |
| Enforcement status | **Active** (a ruleset left in "Evaluate" reports and blocks nothing) |
| Target branches | Add target → **Include default branch** |
| Restrict deletions | on |
| Block force pushes | on |
| Require a pull request before merging | on — *Required approvals: 0* |
| Require status checks to pass | on → **Add checks**: `lint · types · tests` and `end-to-end` |

Two of those deserve a word:

- **Required approvals: 0.** A solo owner cannot approve their own pull request, and a rule
  demanding one approval would lock the repository against its only developer. Zero still
  forces the branch → pull request → checks path, which is the part that matters.
- **The check names are the job `name:` fields**, not the job ids. GitHub only offers a
  check it has seen run at least once, so if the list is empty, push a branch first and
  come back.

With that in place the workflow becomes: branch, push, open a pull request, wait for both
checks, merge. A direct push to `main` is refused, and the host never sees a commit the
gate has not agreed to.

### Deploys

Vercel builds whatever reaches `main`. Once `main` can only be reached through a green pull
request, that *is* the deploy protection — there is nothing to configure on the host side,
and nothing that would help if there were: a host-side gate would still be building a commit
this repository had already accepted.

If a deploy must ever be stopped without touching the code: **Vercel → project → Settings →
Git → Ignored Build Step**, or disconnect the repository. Both are levers for an incident,
not for everyday work.

### While there is one developer

The rule is worth having even alone, and not because of mistakes an approval would catch.
It is worth having because it makes "the tests passed" a fact about `main` rather than a
thing that was true on a laptop at some point. Every gap in this document was found that
way.

## 10. Production, watched

`.github/workflows/production.yml` runs `scripts/smoke.mjs` after every production
deployment the host reports to GitHub, and hourly. It asks what a person would: both hosts
up, the web app reaching the API through its proxy, every public page there and marked
with its language, the sitemap and `robots.txt`, and **the doors that must be shut still
shut** — a stranger asking for a profile, health data or the admin overview gets a 404, an
unsigned payment webhook gets a 404, a signed-in screen redirects to sign-in. It signs in
to nothing, writes nothing and holds no secret.

- A wrong answer, three times a minute apart, **opens an issue** labelled `production-down`
  — one, added to on every further failure — and the first right answer closes it. Watch
  the repository's issues by mail and that is the alarm.
- Nothing is rolled back by a machine. The way back is the host's own: promote the previous
  deployment from its dashboard. A migration is **not** undone by that — which is why the
  migration reviewer asks, before the merge, whether the previous API survives the new schema.
- `WEB_URL` and `API_URL` are repository *variables*, not secrets; unset, the script uses
  the origins of Shape A. Set them the day there is a domain.
- To ask by hand: `node scripts/smoke.mjs`.

**Dependencies.** Dependabot opens one grouped pull request a week for minor and patch
updates and one per major (`.github/dependabot.yml`); each goes through the whole gate.
Security updates do not wait for the week. In the repository's settings, **secret scanning,
push protection, Dependabot alerts and security updates are on** since 2026-09-21 — free on
a public repository, and the only secret check that runs on the server: `pnpm check:leaks`
reads a pattern list that is gitignored, so it runs on the owner's machine and nowhere else.

**What is still not here: a preview environment.** Everything goes from CI to production.
`docs/reference/preview-environment.md` says what it would take.

