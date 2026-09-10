# 0039 — A route names what it takes and what it answers

**Status**: accepted · **Date**: 2026-09-10 · **Deciders**: owner, agent

## Context

`apps/api` grew a module at a time, and every module found its own shape. Some
have a service (`meal-plans`, `ai`, `notifications`), most do not. A route that
needs two calls to `packages/core` makes them itself, so the ordering of a
lookup and a write sits in an HTTP handler next to a `@Get` decorator. Four
routes answer with an object literal written at the `return` — `{ seen }`,
`{ email }`, `Paged<FeedbackView> & { waiting: number }` — so the shape the web
app depends on is declared nowhere and greppable only by reading the handler.
Swagger says what a route is *for* and nothing at all about what it takes or
what comes back, which makes `/api/docs` a table of contents rather than a
contract.

None of that is a bug today. It is the reason the next module is a guess, and
the reason a shape can change without anything saying so.

The obvious way to fix the last two — the NestJS way, and the way the owner's
reference backend does it — is a DTO class per route body carrying
`class-validator` decorators and `@ApiProperty`. This workspace cannot take it
without paying for it twice: `docs/ARCHITECTURE.md` already records that "every
route body has a Zod schema", and the schema it means lives in
`packages/core/entities` and is the same object `apps/web`'s forms validate
against. A DTO class would be a second statement of every rule, in the one
process where being wrong is a security question.

## Decision

**Every module has the same five parts, and every route names its input type and
its output type.**

```
modules/<name>/
  <name>.module.ts        wiring, and nothing else
  controllers/            HTTP: routing, guards, validation, status codes
  services/               orchestration: the only caller of packages/core here
  dto/in/                 one declared input per route body
  dto/out/                one declared answer per route
  index.ts                the module's public surface
```

A module creates only the parts it has — `settings` takes no body, `email` has
no routes — but never a different part under a different name.

**The controller does not call `packages/core`.** It takes `@CurrentUser()`,
binds the body to its DTO, calls one method on its own service, and returns.
The service is where a second core call, an analytics write, or a header
belongs. Most services are one line long today, and that is the point: the seam
exists before the day something needs to go in it, rather than being cut into a
handler under pressure.

Business rules stay in `packages/core`. The test is unchanged and unambiguous:
if the logic needs NestJS or an I/O provider it is a service here, and if it
does not it is a core controller. An API service that grew a rule is a bug.

**The Zod schemas in `packages/core/entities` remain the single source of truth
for what a valid value is.** A body DTO does not restate a rule; it *names* one:

```ts
export const SubmitFeedbackDto = zodDto('SubmitFeedback', submitFeedbackSchema);
export type SubmitFeedbackDto = InferDto<typeof SubmitFeedbackDto>;
```

`@ZodBody(SubmitFeedbackDto)` then binds three things that used to be written
separately and could disagree: the validation pipe, the parameter type, and the
OpenAPI request schema, which is generated from the same Zod schema by
`z.toJSONSchema`. There is one definition of the rule, in core, and the
documentation cannot drift from it because it is derived rather than written.
It is also the only way to declare a body, which makes a bare `@Body()` — a
parameter with no validation at all — visible instead of invisible.

**Outputs are declared types, not literals.** `dto/out` names every answer a
module can give: for a shape `packages/core` presents, the DTO names and
re-exports that view, so a module's whole answer surface reads in one file; for
a shape this app composes itself, the DTO *is* the declaration and the literal
now has to satisfy it. Every route carries `@ApiOkResponse` (or the status it
actually returns) with prose.

**OpenAPI describes request bodies fully and responses by status and prose.**
That asymmetry is deliberate and is stated here so nobody reads it as unfinished
work — see Alternatives.

**Cross-cutting concerns keep one home each.** `shared/` holds `decorators/`,
`dto/`, `filters/`, `guards/`, `interceptors/`, `pipes/`, plus the `logging/`,
`observability/` and `services/` providers. `shared/index.ts` re-exports only
what a controller writes — decorators, DTO helpers, pipes — because a barrel
that also re-exported the filter would pull Sentry, and one that re-exported the
guards would pull Better Auth, into the import graph of every module and every
unit spec that touches one. Nothing inside `shared/` imports that barrel.

The five guards are unchanged in behaviour, in registration order, and in where
they live. This decision moves no guard and refuses nothing new.

## Alternatives considered

- **DTO classes with `class-validator`, the shape the owner's reference backend
  uses.** Rejected: it would put a second definition of every rule in
  `apps/api`, next to the one in `packages/core` that `apps/web`'s forms already
  share. The first time a maximum changed in one and not the other, the API and
  the form would disagree and neither file would look wrong. A second, drifting
  definition of a rule is worse than none.
- **`nestjs-zod`, or generating DTO classes from the Zod schemas at build time.**
  Rejected: a dependency and a code generator to reach the same place a
  fourteen-line decorator reaches, and it lands on classes anyway — so every
  schema feature it cannot express becomes a silent gap rather than a
  `toJSONSchema` that says what it could not represent.
- **Hand-written response classes so OpenAPI documents outputs too.** Rejected
  for the same reason, one layer up: a response class is a copy of a core
  presenter, checked by nobody. `PlanView` alone would be about a hundred and
  fifty lines of copy that TypeScript cannot verify stayed equal. The truthful
  contract for an answer is core's presenter and the route's declared return
  type; a prose description of an answer that is right beats a schema that is
  right today.
- **Keeping the controllers as they are and adding services only where a module
  needs one.** Rejected: that is exactly today's state, and it is why the shape
  of the next module is a judgement call rather than a copy.
- **Leaving `docs/ARCHITECTURE.md` alone.** Its sentence was already true — a
  Zod schema per route body, through `ZodValidationPipe` — and stays true. It is
  amended only to add what is now also true: the schema is named by a DTO, and
  OpenAPI is generated from it rather than absent.

## Consequences

- One more hop per route: controller → service → core controller. Most services
  are pass-throughs, and reading a route now costs opening two files instead of
  one. Bought deliberately, for a seam that exists everywhere rather than where
  somebody once needed it.
- `/api/docs` becomes usable as a contract for anything that takes a body: the
  request schema is the enforced one, always, because it is generated from it.
- Responses stay documented as status plus prose. If that ever needs to be a
  schema, the honest way to get one is Zod schemas beside core's presenters —
  in core, where the presenter is — not a copy in this app.
- A new module is a copy of an existing folder. That is the whole objective, and
  it is also the risk: five folders is ceremony for a module with one route, and
  the answer is to create only the parts it has, never a variation.
- No route path, request shape, response shape or status code changes anywhere
  in this decision. The eighty-seven end-to-end assertions are the proof, and
  they are what this was checked against.
