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
  modules/           — auth, users, profiles, onboarding, safety, health
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
  handler) — and neither owns the configuration list. Anything added to one and
  forgotten in the other is a bug that exists in exactly one environment.
- It is deliberately **not** re-exported from `config/index.ts`: that barrel is imported
  by specs that want only the `Env` type, and reaching the whole application graph
  behind them breaks them under Jest's ESM interop with a require cycle naming
  neither file.
- `vercel.json` uses the legacy `builds` array pointed at the **`.ts`** entry. The
  platform then runs its own TypeScript pass over that file, and under pnpm's strict
  store it resolves modules without following symlinks, so transitive packages are
  invisible to it and it emits a wall of type errors. **They are cosmetic** — the
  builder emits JavaScript regardless, and `vercel-build` runs the real type gate.
  Do not "fix" them by hoisting (`shamefully-hoist`, `node-linker=hoisted`); that
  throws away the phantom-dependency protection pnpm was adopted for.
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
- `pnpm --filter api smoke:function` runs the deployed entry behind a plain Node
  server and checks it boots, denies with 404, and returns the JSON envelope for an
  unmatched route. Needs a live database, so it is not in the gate. Run it after any
  change to how the application is assembled.
- **`COOKIE_DOMAIN` is what makes sign-in work across subdomains.** The web app reads
  the session cookie itself — in `proxy.ts` and when forwarding it server-side — so a
  cookie scoped to the API's own host is invisible to it and every protected page
  redirects to sign-in. Sibling subdomains of one registrable domain are the same
  *site*, so `sameSite: 'lax'` is unchanged. Two `*.vercel.app` subdomains are **not**:
  that domain is on the Public Suffix List, so a custom domain is required.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm --filter api dev` | Watch mode on :3001 |
| `pnpm --filter api build` | `nest build` → `dist/` |
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
- **`emitDecoratorMetadata` is what makes DI work.** Without it every injection needs an explicit `@Inject`. It is on in `tsconfig.json`; `verbatimModuleSyntax` must stay off, or type-only imports stop producing metadata.
- **`HealthIndicatorService`, not `HealthCheckError`.** Terminus 12 removed the old error class; return `indicator.down()`.
- **A module that provides a Terminus indicator must import `TerminusModule` itself.** Importing it only in `HealthModule` leaves `DatabaseModule` unable to resolve the dependency.
- **`drizzle-orm` types differ between the ESM and CommonJS resolutions.** Do not build SQL here — add a helper to `packages/database` (as `ping()` does) and call that.
