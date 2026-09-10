# apps/api AGENTS.md

The NestJS backend. Rules here are more specific than the root `AGENTS.md` — both apply.

---

## What this app is

The **only** process that opens a database connection, holds an auth secret, or talks to an AI provider. `apps/web` is a browser client that reaches it over HTTPS and nothing else.

```
apps/api/src/
  main.ts            — bootstrap: helmet, CORS, parsers, Swagger, shutdown hooks
  app.module.ts      — root module; registers the global guards, filter, interceptor
  config/            — Env.validation.ts (boot-time contract), swagger.config.ts
  database/          — DatabaseModule + the health indicator
  shared/            — decorators/ guards/ filters/ interceptors/ pipes/
  modules/           — auth, users, profiles, onboarding, safety, health, email, …
test/                — e2e specs; need a real database (see test/README.md)
```

## Layering — what belongs here and what does not

```
apps/api/modules   ← HTTP: routes, DTO validation, guards, DI, I/O orchestration
       ↓
packages/core      ← controllers/ (business rules) → repositories/ (Drizzle) → entities/ (Zod)
                     plus domain/ — pure, framework-free logic
       ↓
packages/database  ← schemas + the Neon client
```

A Nest controller method should read as: take `@CurrentUser()`, validate the body, call one `packages/core` controller, return. **If a route method contains a business rule, it is in the wrong file.**

Nest controllers never import `database` or `drizzle-orm`. Data access lives in `packages/core/repositories`.

**Naming collision to keep straight:** a *controller* in `packages/core` is an application service; a *controller* here is an HTTP endpoint class. The root `AGENTS.md` vocabulary records this.

## Module system — ESM, deliberately

NestJS 12 ships ESM only, so this app is `"type": "module"` with `module: nodenext`.

- **Every relative import needs a `.js` extension**, including directory barrels (`'../../config/index.js'`). Node will not guess.
- `packages/core` and `packages/database` compile to **CommonJS** and are consumed through Node's ESM→CJS interop. That is why they have a `build` step and why `exports` splits `types` (source) from `default` (`dist`). Run `pnpm --filter core build` after changing them, or `pnpm dev`, which watches.
- Jest runs with `NODE_OPTIONS=--experimental-vm-modules`. That is not optional under ESM.

## Security invariants

Not style preferences. Changing one is a security regression.

- **Denials are 404, never 401 or 403.** A distinct status confirms to precisely the blocked caller that the route or resource exists. `SessionGuard`, `AdminGuard` and the exception filter all agree on this, so no handler can drift into being the one that confirms.
- **`SessionGuard` is global and deny-by-default.** A route is protected unless it carries `@Public()`. Opting *in* to protection means a forgotten decorator is an open endpoint.
- **The session is re-read on every request.** Never cache authorisation. A logout or a deleted account must take effect immediately, not at token expiry.
- **Completeness of a profile is the API's judgement, not the client's.** `RequiresOnboardingGuard` is global and opted into per route with `@RequiresOnboarding()`; the meal-plan controller carries it on the class. Opt-in, not deny-by-default, because most routes are how someone *finishes* onboarding. It is the one refusal that is **not** a 404 — a 409 with code `ONBOARDING_INCOMPLETE` — because the caller owns the account and the only useful answer is which step they left. A check the web app performs and the API does not is a suggestion.
- **`@CurrentUser()` is the only sanctioned source of a user id.** An id from a path param, query string or body is an id the caller chose. Never scope a query with one.
- **Every route body has a schema, bound to the `@Body()` parameter.** `@Body() body: SomeType` with no pipe gets *no* validation and arrives as whatever was sent. Use `@Body(new ZodValidationPipe(schema))` with a schema from `packages/core/entities` — the same one the web form uses. **Never `@UsePipes(...)` at the handler**: that binds the pipe to *every* parameter, so the body schema also validates `@CurrentUser()` and rejects every valid request. That shipped once; see the traps below.
- **Nothing internal reaches a response.** `AllExceptionsFilter` is the single translation point. Driver messages carry connection strings, Zod issues describe the schema, stacks carry paths. An unrecognised error is a bare 500.
- **`code` is stable, `message` is not.** The frontend switches on `code`; messages are free to be reworded.
- **Responses default to `no-store`.** Absent an explicit directive a shared cache may apply heuristic freshness to an authenticated body — here, someone's health data.
- **Roles come from the database row, never the request.**
- **Never log a request body, a cookie, an `Authorization` header or an email address.** The pino redaction list in `app.module.ts` covers the known carriers; new ones get added there.

## Allergy safety

Allergies are a hard constraint enforced in **code**, never by prompting a model.

- The validator is `findSafetyViolations` in `packages/core/domain/Safety`. It compares allergen **ids**, so nothing depends on spelling or on a model obeying an instruction.
- Load the profile with `SafetyController.getSafetyProfile(userId)`. It is a named method so the call site is greppable: **a code path that never calls it is a code path with no allergy check.**
- Anything that produces or shows food — generation, replacement, shopping lists — validates before it stores and before it returns.
- `contains` blocks anyone with that allergy or intolerance. `may_contain` blocks only users who set `crossContaminationSensitive`.
- **Free text is resolved once, deterministically, in `core/domain/Safety`.** A matched entry becomes an excluded ingredient id and goes through `findSafetyViolations` like everything else. An unmatched one becomes `SafetyProfile.unenforceableLabels` — the only allergy data that ever reaches a prompt, and only because there is no id to withhold. Never treat a label as a guarantee, and never add a second checker for one.

## Adding a module

1. `src/modules/<name>/<name>.controller.ts` + `<name>.module.ts`, registered in `app.module.ts`.
2. Routes take `@CurrentUser()` and delegate to a `packages/core` controller.
3. Bodies go through `ZodValidationPipe` with a schema from `packages/core/entities`.
4. `@ApiTags` / `@ApiOperation` on everything — Swagger is the API's documentation.
5. Public routes need an explicit `@Public()`, and a comment saying why.

## Environment

`src/config/Env.validation.ts` is the contract; `.env.example` is the inventory. The process refuses to boot on a bad environment and prints **every** problem at once, with no values echoed — a startup crash is often the most widely read log a service produces.

Production is stricter than development, by design: `ALLOWED_ORIGINS` is required and may not contain localhost, and `SWAGGER_ENABLED` must be false.

## Deployment

**This app deploys as a serverless function, and deploying applies migrations — treat it as high-stakes.**

- `src/config/CreateApp.ts` is the **one** place an application is assembled. There are
  two entry points — `main.ts` (owns a port) and `src/api/index.ts` (the deployed
  handler, reached through `vercel/index.js`) — and neither owns the configuration list. Anything added to one and
  forgotten in the other is a bug that exists in exactly one environment.
- It is deliberately **not** re-exported from `config/index.ts`: that barrel is imported
  by specs that want only the `Env` type, and reaching the whole application graph
  behind them breaks them under Jest's ESM interop with a require cycle naming
  neither file.
- `vercel.json` uses the legacy `builds` array pointed at **`vercel/index.js`**, a
  committed one-line re-export of `dist/api/index.js`. Two constraints meet there:
  the builder compiles any `.ts` it is handed with its own symlink-blind TypeScript
  pass (a wall of errors under pnpm's strict store, cosmetic but noisy, and a
  deployed artifact nothing had type-checked), and the `builds[].src` glob is matched
  against the tree *before* `vercel-build` runs, so a path under `dist/` matches
  nothing and silently emits no function. The shim is JavaScript, so nothing is
  compiled; it is committed, so the glob matches; `dist/` exists by the time the
  entry is traced because the builder runs `vercel-build` first. The function ships
  the artifact the gate passed. Never point `src` at `dist/` directly, and never
  quiet a builder error by hoisting (`shamefully-hoist`, `node-linker=hoisted`).
- `vercel-build` runs `turbo run build --filter=api...` **then** `database migrate`, so
  a type error stops the deploy before it touches the database. Every production
  deploy still applies pending migrations: review them as production changes.
- `ignoreCommand` deploys only `main`. Preview URLs would be in neither
  `ALLOWED_ORIGINS` nor `COOKIE_DOMAIN`, so authentication cannot work on them.
- `maxDuration` is 300s because generation runs *after* the response: `PlanJobRunner`
  hands its work to `BackgroundTaskService`, which calls `waitUntil` to keep the
  invocation alive. A bare `void promise` is frozen the moment the response is sent
  and leaves a job row `running` with no log line. Generation takes 30–45s, so a
  60s ceiling is not enough headroom.
- **The function runtime cannot `require()` an ES module.** Its own loader throws
  `ERR_REQUIRE_ESM`, while Node 22.12+ allows it by default — so a CommonJS dependency
  that `require()`s the ESM `@nestjs/*` passes every local run and every test, and
  kills the function on its first cold start with nothing else in the log. This is
  independent of the Node version setting: the throw comes from the platform's
  loader, not from Node. `nestjs-pino` was the live example and is gone; logging is
  `shared/logging`, plain `pino` + `pino-http`. `preflight` imports the deployed entry
  under `--no-experimental-require-module`, the rule the runtime applies, and runs as
  part of `build` — so a violating dependency fails the deploy at build time, before
  migrations, rather than at the first request. Every `@nestjs/*` package is ESM;
  before adding any Nest-adjacent third-party package, check it ships an ESM build.
- **`NODE_ENV` must be `production` on the deployed function, and the process checks.**
  The platform sets `VERCEL_ENV=production`; if `NODE_ENV` disagrees, every
  production-only rule in `Env.validation.ts` is silently skipped — cookies are not
  `secure`, `ALLOWED_ORIGINS` may contain localhost, Swagger is one flag from public.
  The first deploy ran that way and the only symptom was a crash on the development
  pretty-printer. Validation now refuses to boot on the mismatch and names the fix.
  `preflight` calls `validateEnv` explicitly at build time — it has to, because
  `ConfigModule.forRoot` is async and a validation failure at import is a rejected
  promise nothing observes until bootstrap — so the deploy fails there, before
  migrations.
- **The request log carries an allow-list of headers, never the whole object.** The
  first production log line held a platform bearer credential valid for hours
  (`x-vercel-oidc-token`), a proxy signature, and the caller's city, postal code and
  coordinates, because the default records every header. `LOGGED_REQUEST_HEADERS` in
  `shared/logging/pino.ts` names what is wanted; add to it deliberately, and never
  replace it with a block-list — the next header the platform adds is not one you
  will know about. The client IP is personal data and is deliberately absent;
  correlate on `x-vercel-id` with the platform's own access log if it is ever needed.
- **The pretty-printer degrades, it never crashes.** `pino-pretty` is a devDependency
  resolved at runtime, so a traced bundle never contains it; `createPino` checks it
  is resolvable and falls back to JSON with one warning line. Do not make any
  logging option able to stop the process.
- **A recipe records which prompt wrote its steps** (`recipes.steps_version`), and
  `RecipeRewriter` rewrites everything an older one wrote — bounded, on
  `GET /cron/rewrite-steps`. Only `instructions` changes: ingredients, grams and the
  macros every past plan computed from them are untouched, so a rewrite cannot alter
  what a plan says anyone ate, and cannot reach the allergy layer, which matches ids
  and never prose. Bump `PROMPT_VERSION` when the standard for steps changes and the
  library re-sweeps itself; the stamp is why a rewrite that comes back terse is not
  swept for ever. What it asks for scales in the same three bands `domain/Method`
  enforces — uncooked, briefly cooked, properly cooked — because a prompt that asks
  for more than the schema accepts just fails twice.
- **A plan is discarded only for structure or a safety bound**, never for missing a
  nutrition target — see [`0011`](../../docs/decisions/0011-nutrition-targets-are-advisory.md).
  `validatePlan` reports every violation, `isBlocking` says which are worth throwing
  fourteen days of food away for, and the rest ride along in
  `generation_metadata.advisories`. If you add a rule, decide which it is: the default
  is advisory, and a new blocking rule needs a reason a user would accept losing their
  plan over.
- **The model is a preference, not a dependency, once the library can serve.** A
  returning user's rotation holds back last fortnight and caps the rest, and the model
  fills the gap; with the model gone (quota, key, outage) the gap stayed open and only
  returning users failed — a new user has nothing to exclude and needs no model. Now
  the scheduler is offered the whole safe library once, without asking the failed
  provider again, and the plan records `fallback: full_library`. What still fails is
  a library that genuinely cannot fill a fortnight, which is `GENERATION_AI_UNAVAILABLE`
  when the provider failed and `POOL_TOO_SMALL` when there simply is none.
- **Both sweeps are off by default** (`AI_ILLUSTRATIONS`, `AI_REWRITE_STEPS`), because a free-tier project's daily request cap is generation's. Turn them on with billing, or deliberately, for a while.
- **Both sweeps stop at the first exhausted quota** (`isQuotaExhausted`). The provider's
  free tier caps *requests*, not only spend, and generation draws on the same allowance:
  a sweep that keeps going after a refusal attempted eighteen recipes three times each
  and emptied the day's budget, blocking plan generation. Treat "the sweep is free
  because the text tier is free" as false — it is bounded, and the bound is shared.
- **Illustrations are drawn after the plan, never before it, and are off by default.**
  `RecipeIllustrator` (in `modules/ai`, so the health-data boundary test covers it)
  draws from the recipe's name and ingredients only, resizes to a phone-sized WebP and
  stores it in `recipe_images`; `GET /recipes/:id/image` is the one public route that
  serves bytes, immutable for a year. A bounded batch runs in the background after a
  generation and `GET /cron/illustrate` (bearer `CRON_SECRET`, else 404) sweeps the
  rest every ten minutes. An unconfigured `CRON_SECRET` is logged at warn on each call:
  a cron quietly 404ing every ten minutes has to be tellable from someone knocking, and
  the response deliberately cannot say which. `AI_ILLUSTRATIONS=false` resolves no image model and every
  sweep is a no-op: the configured provider's free tier allows zero image calls, so the
  switch is the owner's. Every screen that shows one carries the "AI-generated
  illustration" label from the dictionary ([`0010`](../../docs/decisions/0010-illustrate-recipes-not-photograph-them.md)).
- `pnpm --filter api smoke:function` runs the deployed entry behind a plain Node
  server and checks it boots, denies with 404, and returns the JSON envelope for an
  unmatched route. Needs a live database, so it is not in the gate. Run it after any
  change to how the application is assembled.
- **`COOKIE_DOMAIN` is what makes sign-in work across subdomains.** The web app reads
  the session cookie itself — in `proxy.ts` and when forwarding it server-side — so a
  cookie scoped to the API's own host is invisible to it and every protected page
  redirects to sign-in. Sibling subdomains of one registrable domain are the same
  *site*, so `sameSite: 'lax'` is unchanged. Two `*.vercel.app` subdomains are **not**:
  that domain is on the Public Suffix List. Without a custom domain, leave it empty and
  proxy the API through the web app's origin instead (`apps/web/next.config.js`,
  `API_UPSTREAM_URL`); then `BETTER_AUTH_URL` and `ALLOWED_ORIGINS` are the **web**
  origin, because that is the only origin a browser ever sees.

- **Verdicts** (`0014`): `PUT /recipes/:id/verdict` with `{ verdict: 'liked' | 'disliked' | 'none' }`
  records what the session's user thinks of a recipe. Generation reads them: disliked
  slugs join the rotation's `avoidSlugs`, liked ones its `preferSlugs`, and both are named
  to the model. The verdict is on the recipe, never on the meal.
- **Allowances** (`0015`): `GET /meal-plans/allowances` says what the fortnight still allows;
  `POST /meal-plans/meals/:id/swap` replaces one meal of the active plan (library first, the
  model only when the library has nothing for the slot) and rebuilds the shopping list in the
  same transaction. A spent allowance is 429 `QUOTA_EXCEEDED`, with `retryAt` when it renews
  on a date. The redo check lives in `PlanJobController.start`, never in a route.
- **Two locks** (`0030`, `0031`): an account is usable when `email_verified` **and**
  `activated_at` are both set. `VerifiedEmailGuard` refuses on either — 409 `EMAIL_NOT_VERIFIED`
  first, because that is the half the person can fix themselves, then 409 `ACCOUNT_NOT_ACTIVATED`.
  Signing up is never refused. Opening an account is `UserController.activate({ email | id })`,
  by button from the owner's mail (a signed, expiring token, one account, nothing else) or from
  the list on `/admin`.
- **One switch** (`0031`, amended): `app_settings.automatic_activation` decides what confirming
  an address does — opens the account, or leaves it in the owner's queue. Read in Better Auth's
  `emailVerification.afterEmailVerification` at the moment of the click, never remembered from
  sign-up. Automatic is the default: a missing settings row must never start queueing people.
  `GET /settings` (`@AllowUnverified()`) is how the waiting screen knows which wait it is.
- **Owner notice** (`0029`, amended): sent from `afterEmailVerification` when activation is
  manual — the only moment an account joins the queue. It never throws (a confirmation must not
  fail because a mailbox did) and it is the only mail carrying a user's address, because
  activation matches on it.
- **Admin** (`0028`): `GET /admin/overview`, `/admin/failures` and `/admin/accounts`,
  `@Roles('admin')` on the controller class so a new route is guarded by default.
  `AdminRepository` selects no column that carries content — no dish, no profile. The account
  list carries address, dates and role and nothing else. Keep it that way: the questions worth
  a screen are "is generation working", "how big is the catalogue" and "who is waiting".
- **Analytics** (`0033`): the funnel on `/admin` is counted from state — `AdminRepository.funnel()`
  — never from events, so it is correct retroactively and cannot disagree with the rows it
  counts. `analytics_events` holds only what leaves no row: `session_started` and
  `swap_requested`. The set is closed in `ANALYTICS_EVENTS`, no HTTP route writes one, an
  event never carries content, and `AnalyticsController.record` never throws.
- **Vacations** (`0032`): `POST /vacations` moves every plan day at or after the trip forward
  by its length, in one transaction, so those dates hold no plan day at all. Nothing else was
  taught about holidays — skipping, adherence and the check-in mail all follow the dates.
  Cancelling gives back only the days not yet spent. Refused for a trip in the past, one that
  overlaps another, or one longer than ninety days.
- **Reminders** (`0027`): `/cron/reminders`, guarded by `CRON_SECRET` like the other two
  sweeps. `CheckInReminderService` sends one mail per fortnight to accounts whose plan reached
  its last day, and writes the `notifications` row only after the provider accepted it — the
  row is what stops a second one. Never put plan or health content in a reminder; it is read on
  a lock screen. `PATCH /notifications/settings` is the switch. **No cron is scheduled**: the
  `crons` block is out of `apps/api/vercel.json` while the project runs on free tiers, so all
  three routes only run when called by hand with the bearer.
- **Error reporting** (`0024`): `ErrorReporter` in `shared/observability` — off without
  `SENTRY_DSN`. The exception filter reports what it turns into a 5xx and `PlanJobRunner`
  reports a failed generation. It sends the error, its stack and the route *pattern* only:
  `beforeSend` deletes request, user and response context, and messages go through
  `redactSecrets`. Never add a body, a header or an id to a report.
- **Weights, not filters** (`0026`): `isPreferredDish` (core `domain/Variety`) decides what the
  library offers first — a liked dish, a chosen cuisine, a liked food. `rotatePool` partitions
  on it and `pickReplacement` ranks on it; neither ever removes a dish, so a preference here
  cannot leave a slot unfillable. Exclusions are `0023`'s job and stay separate.
- **Every answer changes something** (`0025`): before adding an onboarding field, decide which
  it is — a rule in code or a line in the prompt — and say so where it is read. The cooking-time
  limit is a rule (`withinTime`, applied in `PoolBuilder` and in reuse); the day
  (`dayShapeOf`) is a prompt line. A field that is neither does not get asked.
- **Preferences are enforced** (`0023`): `GenerationContext.preferences` carries the ingredient ids
  a way of eating or a dislike rules out, resolved once in `RecipeController.generationContext`.
  `PoolBuilder` filters the catalogue it shows the model and drops a dish that uses one anyway;
  reuse filters the library. Only unresolved dislikes reach the prompt. Beside the safety profile,
  never inside it: a preference must never be reported as an allergy violation.
- **Swap axes** (`0022`): the swap body may name `axis` — `quicker`, `no_cooking`, `more_protein` —
  and `axisFilter` (core) is applied to the library pick and to the model's dishes alike; the
  model is told the wish in the prompt (`2.7.0`) but never trusted to honour it.
- **The past is read-only** (`0021`): `GET /meal-plans` lists every plan with `replaced` (the next
  lived plan began before it ended); `GET /meal-plans/:id` serves any plan of theirs; a meal's
  detail carries `planId` and `planStatus`. A status change or a swap on a meal of a plan that is
  not active is a 409 conflict, never silently applied.
- **Eaten or skipped**: `PATCH /meal-plans/meals/:id/status` with `{ status }` marks a meal;
  `meal_completions` keeps the day it was said. `planned` takes it back.
- **Activation** (`0017`): `VerifiedEmailGuard` is global; a signed-in account with
  `email_verified = false` gets 409 `EMAIL_UNVERIFIED` on every route not marked `@Public()`
  or `@AllowUnverified()`. Keep the allow-list to what an unactivated account needs: who am
  I, and leave.
- **Mail** (`0019`): `modules/email` is the one door mail leaves through — `EmailService.send`
  over SMTP (nodemailer), unconfigured without `SMTP_HOST` and then returning `false`. The only
  message today is the password-reset link, composed in `modules/email/templates` in the
  request's language and sent from Better Auth's hook (`modules/auth/PasswordResetMail.ts`),
  which never throws: the hook runs only for existing accounts, so an escaping error would tell
  a caller which addresses are registered. Verification links are logged, not mailed (`0017`).
  Addresses never reach the log.
- **Progress** (`0020`): `GET /progress/summary` — the weight line and one entry per fortnight
  lived, with meal marks counted only for days that have arrived and the check-in that closed
  it. Reads only; nothing is collected for it. `GET`/`POST /progress/weight` are the dashboard's.
- **Check-in** (`0018`): `GET /check-ins/status`, `POST /check-ins` — once per plan, from its last
  day. Weight → progress log (targets follow the latest weight); portions → a 5 % calorie nudge
  through the target override; words → the next plan's prompt. Never a restriction.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm --filter api dev` | Watch mode on :3001 |
| `pnpm --filter api build` | `nest build` → `dist/`, then `preflight` |
| `pnpm --filter api preflight` | Load the deployed entry under the function runtime's module rule and validate the environment as boot would (no database needed) |
| `pnpm --filter api test` | Unit specs (no database needed) |
| `pnpm --filter api test:e2e` | e2e specs — **needs a real database**, see `test/README.md` |
| `pnpm --filter api ts:check` | Type-check, specs included |
| `pnpm --filter api smoke:function` | Serve the deployed entry locally — **needs a real database** |

## Traps

- **`@UsePipes` binds to every parameter, not just the body.** A handler-level
  `@UsePipes(new ZodValidationPipe(bodySchema))` also runs that schema over
  `@CurrentUser()`, which has none of the body's fields — so a valid request fails with a
  confusing validation error naming a field the client did send correctly. Bind the pipe to
  the parameter: `@Body(new ZodValidationPipe(schema))`. Unit-testing the controller method
  directly cannot see this, because it bypasses the pipeline entirely; the specs that catch
  it (`onboarding.controller.spec.ts`, `profiles.controller.spec.ts`) go through a real
  Nest application with supertest.
- **Better Auth must receive an unread request body.** `CreateApp.ts` mounts `express.json()` *after* the auth path. Moving the parser earlier makes sign-in receive an empty body, and the failure looks like bad credentials.
- **A CommonJS package that `require()`s `@nestjs/*` works locally and dies on the platform.** See § Deployment. `preflight` catches it; run it after adding any dependency that touches Nest.
- **`emitDecoratorMetadata` is what makes DI work.** Without it every injection needs an explicit `@Inject`. It is on in `tsconfig.json`; `verbatimModuleSyntax` must stay off, or type-only imports stop producing metadata.
- **`HealthIndicatorService`, not `HealthCheckError`.** Terminus 12 removed the old error class; return `indicator.down()`.
- **A module that provides a Terminus indicator must import `TerminusModule` itself.** Importing it only in `HealthModule` leaves `DatabaseModule` unable to resolve the dependency.
- **`drizzle-orm` types differ between the ESM and CommonJS resolutions.** Do not build SQL here — add a helper to `packages/database` (as `ping()` does) and call that.
