# packages/core AGENTS.md

Shared business logic for the entire monorepo. Rules here are more specific than root `AGENTS.md` — both apply.

---

## Architecture overview

Three layers:

```
entities/       — Zod schemas + derived types + domain errors
domain/         — pure functions: nutrition maths, allergy validation. No I/O, no framework.
repositories/   — static objects; call database() directly for every query
controllers/    — static objects; orchestrate repositories, apply business rules, present results
```

Dependency direction — **never break this**:

```
controllers  →  repositories  →  entities
controllers  →  domain        →  entities
repositories →  [entities, database, drizzle-orm]
domain       →  [entities]          ← nothing else, ever
```

`domain/` is where the deterministic safety code lives — the allergy validator and the
nutrition maths. It has no I/O and no framework dependency, which is what makes it fast to
test exhaustively and impossible to bypass by rewiring. It carries the highest coverage
floor in the workspace (see `vitest.config.ts`). See
[`docs/decisions/0004`](../../docs/decisions/0004-deterministic-safety-layer.md).

Inner layers know nothing about outer layers. A repository never imports from a controller. A controller never imports `database` or `drizzle-orm` directly.

Each domain is a folder inside its layer — `entities/User/`, `repositories/User/`, `controllers/User/` — with an `index.ts` barrel export.

---

## Import paths

The package exposes granular export paths. Use the most specific one for what you need:

| What you need                         | Import from               |
| ------------------------------------- | ------------------------- |
| Controllers (what `apps/api` imports) | `'core/controllers/User'` |
| Pure domain logic                     | `'core/domain/Nutrition'`, `'core/domain/Safety'` |
| View types (`UserView`)               | `'core/controllers/User'` |
| Entity types (`User`, `CreateUser`)   | `'core/entities/User'`    |
| Domain errors (`NotFoundError`, etc.) | `'core/entities/Error'`   |

There is no root `'core'` entry — every import uses a granular path.

```ts
// ✅ correct
import { UserController } from 'core/controllers/User';
import { ProfileController } from 'core/controllers/Profile';
import type { UserView } from 'core/controllers/User';
import type { User } from 'core/entities/User';
import { NotFoundError } from 'core/entities/Error';

// ❌ wrong — bypasses the public API, breaks encapsulation
import { UserController } from 'core/src/controllers/User/UserController';
```

### Internal imports inside `packages/core` — two patterns by intent

The path itself encodes whether the module is part of the public API or private to this package. Pick the right one based on what you're importing:

```ts
// ✅ Public API surface — same path apps would use. Read as "this thing
//    is part of core's public contract".
import { ConflictError, NotFoundError } from 'core/entities/Error';
import type { User, CreateUser } from 'core/entities/User';

// ✅ Private to this package — apps CANNOT reach these. Read as "internal
//    only; the controller layer is what apps actually call".
import { UserRepository } from '#repositories/User';
import { makeUser } from '#test/fixtures';

// ❌ avoid — relative noise on cross-layer hops
import { ConflictError } from '../../entities/Error';
import { UserRepository } from '../../repositories/User';
```

**Why two patterns?**

- `'core/...'` (package self-import via `exports` in `package.json`) is what *external* consumers see. Using the same path internally signals "you're touching the public API."
- `'#...'` ([Node.js subpath imports](https://nodejs.org/api/packages.html#subpath-imports)) only resolve **inside** this package — they're invisible to `apps/web`. That's exactly what keeps repositories and test fixtures private.

The asymmetry is intentional: the import path tells you, at a glance, whether crossing it would also be a layer-boundary crossing for an external caller.

**Where they're configured:** `"exports"` and `"imports"` both in `packages/core/package.json`. When adding a new internal directory (e.g. a `services/` layer that shouldn't be exposed), add a matching `#services/*` entry to `imports`. When adding a new public directory, add a `./X/*` entry to `exports`.

---

## Layer rules

### `entities/`

Data shapes and validation rules only. Nothing else lives here.

Each entity folder exports:

- A Zod schema — runtime validation (`min`, `max`, `email`, `uuid`, `enum`, etc.)
- Types derived from the schema with `z.infer<>` — never written by hand
- Derived schemas for mutations — `schema.omit()` for creates, `.partial()` for updates

```ts
// entities/User/User.ts
import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  createdAt: z.date()
});

export type User = z.infer<typeof userSchema>;

export const createUserSchema = userSchema.omit({ id: true, createdAt: true });
export type CreateUser = z.infer<typeof createUserSchema>;
```

**Why Zod instead of TypeScript interfaces?** Zod validates at runtime. If the database returns `null` for a required field, `schema.parse(row)` throws immediately at the boundary with a clear message. A TypeScript interface fails silently — wrong data flows through and surfaces as a confusing bug downstream.

Domain error classes live in `entities/Error/`. They use `class` because they need `instanceof` for control flow — that is a different concern from data shapes.

**What does NOT belong in entities:**

- Database calls or any I/O
- Calls to repositories or controllers
- Presentation formatting (belongs in controllers)
- Orchestration across multiple entities (belongs in controllers)

### `repositories/`

Static objects that talk to the database. The only layer allowed to import `database` and `drizzle-orm`.

Each repository method:

1. Calls `await database()` to get the Drizzle client
2. Runs the query
3. Parses the raw row with `schema.parse(row)` — catches schema drift immediately
4. Wraps errors: `ZodError` → `DatabaseOperationError` with context; anything else → generic `DatabaseOperationError`

```ts
// repositories/User/UserRepository.ts
import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';
import { database } from 'database';
import { users } from 'database/schema/users';
import { DatabaseOperationError } from '../../entities/Error';
import { userSchema } from '../../entities/User';
import type { CreateUser, User } from '../../entities/User';

export const UserRepository = {
  async findById(id: string): Promise<User | undefined> {
    try {
      const [row] = await database().select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
      if (!row) return undefined;
      return userSchema.parse(row);
    } catch (error) {
      if (error instanceof ZodError) throw new DatabaseOperationError(`Schema mismatch on users: ${error.message}`);
      throw new DatabaseOperationError();
    }
  }
};
```

Method names follow a consistent verb convention: `findById`, `findByEmail`, `findByUserId`, `create`, `update`, `delete`.

**Every user-scoped method takes `userId` as its first argument, and every query filters on
it.** There is one database client and no row-level security behind this package — the API
is the only process that connects, so there is no untrusted caller for a policy to
constrain. That makes the `WHERE` clause the ownership boundary, not a performance detail:
a query missing it returns another user's rows.

`userId` always originates from the verified session (`@CurrentUser()` in `apps/api`).
A repository must never receive an id that came from a path parameter, a query string or a
request body.

**One named exception: a professional reading or changing a linked client's data
([`0059`](../../docs/decisions/0059-a-professional-reaches-a-client-only-through-a-link.md)).**
`CareController.withClient(professionalId, linkId, kind, action, fn)` is **the only function
in the codebase that turns a professional's session into another account's id.** It
resolves the link by `(link id, professionalId = session, status = 'active')` with the
grant still standing (`CareRepository.activeLink`, the only query that returns a client's
id to a professional), answers every other case with the same `NotFoundError`, writes the
client's `care_access_log` row, and only then calls `fn(clientId)` — which passes that id
to the existing controllers exactly as a session's would be passed. A **write**'s row is the
exception to "before": `fn` gets a third argument, `record`, and hands it to the repository
that writes, which calls it inside the write's own transaction — so a refused or failed
write leaves no row, and a write that returns without having recorded fails. So:

- a professional route takes a **link** id, never a client's user id;
- any code that reads or writes a client's data on a professional's behalf goes through
  `withClient`, one call per kind of data (the client page is one `overview` call plus, under
  the health line only, one `health` call — one trail row each);
- the professional's list (`CareRepository.roster`) reads every active client at once, so
  it cannot be one `withClient` call; it keeps the same promise another way: in one
  repeatable-read transaction it writes one `list` row in the trail of every client with an
  active link whose grant stands, **then** reads their stages, and returns no client id and
  no client data beyond a stage. Every read of a client's data leaves its row (PRD 004,
  criterion 6) — there is no unaudited door. A new method that returns a client's id or data
  to a professional without writing that client's row is a second way in, and a P0.

Five related rules:

- **An action that must leave a trail takes an optional `record` callback and calls it
  inside its own transaction, after checking the row it changed actually exists.**
  `CareRepository.logAccess`'s shape (`0059`), and `core/repositories/Audit`'s
  `RecordAudit` type reuses it for every admin mutation (`0071`): the repository never
  imports `AuditRepository` itself — the controller builds the closure and hands it
  down — so a repository stays ignorant of which domain is watching it, and an action
  that is refused or fails leaves no row, exactly as it would with no watcher at all.
- **Wrap delete-then-insert in a transaction.** `SafetyRepository.replaceAll` does, because
  the intermediate state — allergies deleted, not yet re-inserted — is a profile with *no*
  restrictions. Nothing may observe that gap.
- **Spend an allowance atomically, never by read-then-compare.** A transaction is not a
  lock: under READ COMMITTED two transactions that count and then insert both count before
  either commits, and both land. Spend by a guarded `UPDATE … WHERE counter < limit`
  (`PlanRepository.rebuildLoadedDays`), count with the row the allowance belongs to held
  `FOR UPDATE` (`PlanRepository.swapMeal`), or — where there is no row to hold, because
  what is being counted is spread across many rows rather than owned by one — a
  transaction-scoped advisory lock that re-counts inside it, with a bounded, jittered retry
  so a blocking wait never pins a pooled connection (`EventRepository.createWithinQuota`).
- **"Is there one already?" and "make one" are a single statement.** A transaction is not a
  lock: under READ COMMITTED two requests that both read *none* before either inserts both
  insert. Where a row exists to hold, hold it (`FOR UPDATE`); where the thing being defended
  is the row that does **not** exist yet, take a transaction-scoped advisory lock keyed on
  the owner — `PlanJobRepository.claim` — or give the table a partial unique index and let
  the insert fail, as `meal_plans_one_active_per_user` does.
- **When two bounds can refuse the same write, only the lock may order them.** A service
  pre-check that refuses early reads its count *outside* the lock, so it picks the sentence
  before the authoritative count exists — and for somebody who has both spent their
  allowance and filled the day it picks the wrong one. `FixedMealRepository.createWithinQuota`
  re-counts both the tier allowance and `MAX_FIXED_MEALS_PER_DAY` inside its own
  transaction, allowance first, and that ordering lives there and nowhere else (`0103`).
  A cheap pre-check added later "for a nicer error" reintroduces exactly this: it was
  written once, found by an end-to-end test on 2026-10-16, and deleted rather than
  reordered.
- **Drizzle returns `numeric` columns as strings** to avoid float loss. Convert at the
  repository boundary so entities and controllers only ever see numbers.

Every repository method should carry a one-line comment on which mode it chose and why — see `ProfileRepository.ts` for the canonical example.

**Repositories wrap all I/O in try/catch.** They never let raw ORM or driver errors escape — always convert to a `DatabaseOperationError`.

### `controllers/`

Static objects that orchestrate repositories and apply business rules. The only layer that knows about business rules (e.g., "a username must be unique", "a user must exist before creating their profile").

Every controller file has two clearly labelled sections:

#### 1. Presenters (top of file)

Pure functions. No I/O, no side effects. Transform domain types into view types safe for consumers (UI, CLI, API responses). Dates are always serialised to ISO strings here — never pass raw `Date` objects to consumers.

```ts
export interface UserView {
  id: string;
  name: string;
  email: string;
  createdAt: string; // always ISO 8601
}

function presentUser(user: User): UserView {
  return { ...user, createdAt: user.createdAt.toISOString() };
}
```

#### 2. Controller object

A named `export const` object of async methods. Each method:

1. Applies business rules (throws `NotFoundError`, `ConflictError`, etc. on violation)
2. Calls the repository
3. Returns `present*(result)`

Controllers accept **typed parameters** — not `unknown`. Input validation (Zod parsing, form parsing) belongs at the **app boundary** (server action, CLI command, API route), not here.

**A controller method's return type is declared, never inferred.** `Promise<UserView>`,
not whatever the object literal at the `return` happened to hold. Two methods here had
drifted into the inferred form and their shapes were the API's response shapes, declared
nowhere: `RestrictionsView` and `ShoppingListView` exist because of that. A view an app
can name is a view an app can be checked against.

```ts
export const UserController = {
  async getUser(input: Pick<User, 'id'>): Promise<UserView> {
    const user = await UserRepository.findById(input.id);
    if (!user) throw new NotFoundError(`User "${input.id}" not found`);
    return presentUser(user);
  }
};
```

When a controller needs data from another domain, it imports that domain's repository directly — it **never calls another controller**.

```ts
// controllers/Profile/ProfileController.ts
import { ProfileRepository } from '../../repositories/Profile';
import { UserRepository } from '../../repositories/User'; // cross-domain: fine to import

export const ProfileController = {
  async createProfile(input: CreateProfile): Promise<ProfileView> {
    const user = await UserRepository.findById(input.userId); // cross-domain lookup
    if (!user) throw new NotFoundError(`User "${input.userId}" not found`);
    // ...
  }
};
```

**Controllers do NOT catch errors.** Business rule violations they throw intentionally. Repository errors bubble up naturally. The app boundary (server action, CLI command) is responsible for catching and translating.

#### Error handling — where try/catch lives

| Layer        | try/catch? | Reason                                                                        |
| ------------ | ---------- | ----------------------------------------------------------------------------- |
| Repositories | **Yes**    | Wrap every I/O call. Convert ORM/driver errors to `DatabaseOperationError`.   |
| Controllers  | **No**     | Throw intentionally for business rule violations. Let everything else bubble. |
| App boundary | **Yes**    | Catch domain errors, translate to user-facing messages or HTTP status codes.  |

---

## Testing

Vitest with `vi.mock()` for dependencies. Reference tests live next to the code they cover:

- **Controllers**: see [`UserController.test.ts`](src/controllers/User/UserController.test.ts) — mock the repository, assert (1) the presented view shape, (2) the typed errors thrown for business-rule violations, (3) which repository methods were invoked with which args.
- **Repositories**: see [`UserRepository.test.ts`](src/repositories/User/UserRepository.test.ts) — mock `database()` with a chainable stub for the Drizzle methods the repo touches. Verifies error wrapping + schema-parse logic. **Trade-off**: mocks don't test the actual SQL. For SQL-level confidence add integration tests against a real Postgres (Testcontainers, pg-in-memory); the template stays mock-only to avoid forcing a test-database dependency on forkers.
- **Fixtures**: see [`src/test/fixtures.ts`](src/test/fixtures.ts) — `makeUser()`, `makeProfile()`, etc. Object-mother pattern: each factory returns a complete, valid entity with sensible defaults; pass `overrides` to set only the fields that matter to your test. This keeps tests DRY *and* readable (`makeUser({ email: 'taken@…' })` signals "the email is what matters here"). When you add a new entity, add a matching factory.
- **The picture judge's acceptance set** (project 010): `src/domain/DishPicture/judge.{pilot,forms,reverse,holes}.test.ts`, built on [`src/test/dish-picture/acceptance.ts`](src/test/dish-picture/acceptance.ts) — the whole seed catalogue as production shapes it, and example dishes written for the tests. `judge.pilot.fixture.json` is the 2026-09-27 pilot's judge answers, reduced from a private record by a script outside the repository; its `about` says what was kept and what is assumed. It holds no dish name and must never gain one — no title, recipe id or file name from the private library. It is not edited or regenerated: the pilot is the floor every change to the rule is held to.

**What we test**

- Controllers — business rules, error branches, presenter output
- Repositories — error wrapping (`ZodError` → `DatabaseOperationError`), happy paths

**What we skip and why**

- Entities (Zod schemas) — testing them would just restate the schema
- Presenters — pure functions, exercised implicitly by controller tests that go through them
- `database()` itself — a thin lazily-created Drizzle client, lives in `packages/database` and is mostly delegation

When you add a new controller or repository, copy the pattern from the reference test in the same domain folder.

---

## How apps use this package

```ts
// apps/web/src/app/actions/user-create.ts (server action)
import { UserController } from 'core/controllers/User';
import { ConflictError } from 'core/entities/Error';

export async function createUserAction(input: CreateUser) {
  try {
    return await UserController.createUser(input);
  } catch (error) {
    if (error instanceof ConflictError) return { error: 'Email already in use' };
    throw error; // unexpected — let Next.js handle it
  }
}

// apps/web/src/app/dashboard/page.tsx (server component)
import { UserController } from 'core/controllers/User';

export default async function DashboardPage({ params }: { params: { id: string } }) {
  const user = await UserController.getUser({ id: params.id });
  return <Dashboard user={user} />;
}
```

---

## How to add a new domain

Example: adding `Bookmark`.

**1. Entity** — `src/entities/Bookmark/Bookmark.ts` + `index.ts`
Define the Zod schema and derive all types. No logic.

**2. Repository** — `src/repositories/Bookmark/BookmarkRepository.ts` + `index.ts`
Static object. Import `database` and `drizzle-orm`. Follow the try/catch + `schema.parse()` pattern.

**3. Controller** — `src/controllers/Bookmark/BookmarkController.ts` + `index.ts`
Two sections: presenters, then the static controller object. Import only the repository (or other repositories for cross-domain rules). No `database` import here.

**4. Package exports** — add to `package.json`:

```json
"./entities/Bookmark": "./src/entities/Bookmark/index.ts",
"./repositories/Bookmark": "./src/repositories/Bookmark/index.ts",
"./controllers/Bookmark": "./src/controllers/Bookmark/index.ts"
```

---

## Pricing a rule in the scheduler

`schedulePlan` holds the macro bands hard and **prices** everything else — the food-group
maximums and minimums, the starch and legume caps, the vegetables and fruit of `0087`.
Three things a new price must respect (`0093`).

- **A rule that is a step is priced as a step.** `0087` wants 150 g of vegetables at a
  main; a main at 75 g keeps it no better than one at nothing. Priced as the distance to
  150 g it came out *worse than no price at all*, because a half portion of a vegetable
  side fits a day's macros better than a whole one: the search bought the half, paid less
  and still broke the rule. Ask what the rule answers — yes or no, or how far — and price
  that shape, not the shape that is easier to differentiate.
- **A new term goes in five places or the search quietly stops working.** `balancedDay`'s
  day cost is summed bit-exactly and pruned by a branch-and-bound. A term belongs in
  `Term`, `DaySums`, `addTerm`, `closingCost` **and** `lowestBelow` — bounded by the least
  it can still add (as `strays` is) or by the most it can still remove (as `tenths` is for
  the energy floor). Leave it out of the bound and the bound stops being admissible: the
  search prunes branches that held the cheapest day, and nothing fails.
- **No price outranks `BAND_MISS_WEIGHT`, and a group price only applies to a banded day.**
  Every macro of every day inside 5% is the product's promise and the condition of all this
  work. Measured: the same vegetables term at four times its weight bought nine points of
  the rule and took a day out of its band, and the same term in the *unbanded* first build
  did it on the thinnest pool there is. Run the evaluator (`--rotate 10 --flag
  accompaniments`) and read `Days inside 5% on all four macros` before anything else; one
  day short is a failure whatever the rule gained.

## A dish somebody fixed is not the scheduler's to change

`SchedulerInput.pinned` is the recurring fixed meal — *"every Friday dinner is tortilla de
patata"* — and it is the one input that takes a dish out of the search's hands.

- **The pin is decided once, in the day's slot loop, and is the end of the choosing.** It
  is not a candidate that wins a ranking: a rule the person paid for must not lose a
  tie-break. `honouredPin` is where it is refused instead, and only ever for a **hard
  bound** — the pool (which is the allergy gate's own answer), the slot the dish declares,
  and `fitsPlate`. Variety, the repeat rules, the kind caps and the floors' preference all
  yield to it.
- **A day may hold a rule per meal, and the second one is not the first one twice** (`0101`).
  The pins are keyed by day *and then* slot, so two rules on one plate are impossible by
  construction — and two rules on one *day* are allowed only because the offer knows about
  them: `pinnable` takes a `held` map and filters its candidates through `dayHolds`, which
  schedules that one day with both and reads the same `PLAN_TOLERANCE` bands validation
  reports. Measured, two rules chosen without regard for each other broke a macro band on
  204 of 280 such days; chosen from what fits, on 8 of 1960 plan days. **Never offer a
  second rule from the unfiltered list**, and never make `dayHolds` a promise: it builds
  one day alone, with no variety pressure from the other thirteen, so it is optimistic by
  construction and `honouredPin` is still the backstop.
- **Every pass that swaps a dish must skip a pinned pick, and there are six of them**:
  `improveDay`, `spreadAcrossDays` (**both ends** of the exchange — a pinned plate is
  neither given away nor taken), `repairOutOfBand`, `repairToRule` (floors and maximums),
  `enforceDistinctDays`, and `couldChange`, which is how `bandNeededExceptions` asks
  whether a meal could have been another. A seventh pass that forgets the guard does not
  fail a test: it serves somebody else's dinner on the day they fixed theirs, once a
  fortnight, for ever.
- **Never carry the flag onto another dish.** `spreadAcrossDays` builds its replacement by
  spreading the pick it replaces, so a missed guard there would hand `pinned: true` to a
  dish nobody fixed. The flag rides on the dish it pinned or on nothing.
- **Sizing is not swapping.** `balanceDay`, `meetSides`, `holdSideStarches` and the portion
  search treat a pinned plate exactly like any other, and must keep doing so: the person
  asked for tortilla on Friday, not for 300 g of it.
- **A placement is built from a pick by `placementOf`, and by nothing else** (`0099`).
  `Placement.fixed` is what tells a kind rule whose choice the meal was, and the scheduler
  builds placements in fifteen places; one inline literal that forgets the flag charges
  somebody's fixed Friday to the cap the generator is judged by, and no test fails. The
  helper is three lines and it is the only defence that does not depend on remembering.
- **A variety cap counts the meals the generator chose; a health maximum counts every
  meal.** `KindRule.fixedSpendsCap` says which a rule is, required so a new one has to
  answer, and `excessOfKind` is the one place that reads it. `STARCH_RULES`,
  `LEGUME_RULES` and `SNACK_RULES` are preferences that exist to stop the generator
  reaching for pasta a fifth time; PRD 019's maximums are about what a person eats, and a
  Friday they chose is still a Friday they eat. Either way **`apart` counts every meal**:
  the penalty for a day beside a fixed one lands on the day the generator can still move,
  which is the only day it could act on.
- **The flag leaves the scheduler once**, onto `ScheduledMeal.pinned`, so the balance
  report can keep a fixed meal out of the starch cap. Nothing a person sees reads it.

## A preference may never remove a dish

A kitchen is three stances per appliance (`0102`), and they are **not one scale with three
points**. `missing` is a constraint, enforced in code the way an allergy is. `prefers` is a
preference, asked of the model. Confusing them is the one mistake in this area that reaches
a person's plate as *less food*.

- **The whole rule is one line, and keep it that way**: `withinEquipment` compares
  `missing` and nothing else (`domain/Preference`). A `prefers` stance may never shrink a
  pool, never filter a candidate and never refuse a reuse — otherwise somebody who said
  *"I'd rather use my air fryer"* is served fewer dishes for having said so. What `prefers`
  may do is send a prompt line, move the order inside the rotation's per-slot cap
  (`Rotation.isPreferredDish`) and **hold a share of that cap**
  (`APPLIANCE_DISHES_PER_SLOT`).
- **The share's size is measured, and the measurement says keep it whole.** Seven of
  nineteen, half of it and two of it are the same plan to three decimal places (877, 874 and
  868 plates over 42 fortnights, identical bands, rescues and rungs); a share of **zero** —
  the order kept, the quota dropped — loses 35 plates and buys **18 rescues instead of 8**,
  because `narrowerShares` returns nothing at zero and a band miss then goes straight to the
  whole library. **The share is what gives the ladder something to give way with**, which is
  the opposite of what the thin library suggested (`0102` § *The share's size is seven of
  nineteen*). A kitchen measurement without `--flag accompaniments` is not a measurement:
  the same run reads 180 plates instead of 877.
- **A null kitchen means nobody asked, not an empty kitchen.** `withinEquipment(dish, null)`
  is `true`. A caller that reads a missing kitchen as "has nothing" empties the library for
  every account that never opened the screen.
- **An unknown appliance is no requirement.** `recipes.equipment` is `text[]` and can hold a
  string this build has never heard of, so `appliancesOf` filters at the boundary. Treating
  the unknown as a requirement would empty the library for every kitchen missing anything —
  the same asymmetry `0102` applies to an unclassified dish.
- **An order is not enough, and that is measured.** `isPreferredDish` is **one bucket for
  four leanings** — a liked dish, a liked cuisine, a liked ingredient or a preferred
  appliance — with no rank inside it, and `rotatePool` fills each slot's cap from the front
  of that bucket. On 2026-10-18 the owner's four liked cuisines put **548 of his 672
  servable dishes** in it, so the appliance he had asked for was one in 22.8 of what the cap
  took: **3 dishes reached the pool and none reached a plate**, on the day the library
  gained 30 of them. The appliance therefore keeps a third of every slot's cap, taken
  **after** the food groups' reservation (`reserveGroups`) and never from it, because a
  legume minimum is what validation refuses a fortnight for and a preference is not. If you
  add a fifth leaning, ask what it does to this one before you put it in the same bucket.
- **A rescued fortnight shows none of it, and the share is what sends it there.** A fortnight
  that misses a macro band on the rotation's pool is rescued from the whole library
  (`wider_rotation`), and there the share has nothing left to be scarce against: it still
  sits at the front of each slot, but `pickBest` reads pool order only inside `FIT_TIE`, so
  fourteen dishes ahead of six hundred buy nothing. The trap is that **the share itself
  causes the miss** — it takes 7 of every slot's 19 from the dishes that were fitting the
  macros. Measured on the owner's own fortnight, nothing moved but whether the kitchen is
  read: preferred, the rotation's pool holds 12 of 14 days and the rescue delivers 14 of 14
  with **0** air-fryer plates; unread, the pool holds **14 of 14**, no rescue fires and **3**
  air-fryer plates survive. Asking for the appliance returned fewer of it than not asking.
  Across 42 fortnights the preference raised the rescues from 5 to 8, and 7 of those 8 served
  zero preferred plates against a median of 16 (`0102` § *A rescued fortnight has no kitchen,
  and the share is what sends it there*). So: the order is deliberate (`0045` before `0102`)
  and is not the thing to change — **the share yields to the bands by degrees, before the
  rotation itself is given up** (the ladder below, shipped 2026-10-18: on the library of
  that morning, rescues 8 → 5 of 42 fortnights, plates 580 → 583, bands unmoved at 587/588).
  **Almost every rung that has held a band was zero** — 3 fortnights before the batch, 10
  after it, and exactly **one** has ever held at the half rung (`patron-tradicional-espanola`,
  the owner's pinned shape, the full share; it does not hold there at a smaller first rung) —
  so what the ladder reliably saves is the plan's own rotation, not the plates, and a
  fuller library makes the share bind *harder*, not softer, because a quota of 7 in 19 that
  could not be filled displaced nothing. The plates come from supply: 280 dishes took the
  preferred plates of 42 fortnights from 583 to 877 and the fortnights serving none from 5 to
  1, while the first attempt missed a band more often than before. A measurement of a preference counts the rescues it causes, not only the bands
  that survive it — and on the loaded library asking **costs no rescue at all**: 8 of 42
  fortnights rescued with the preference against **9 with none**, and in the owner's pinned
  shape **8 against 16**, bands identical either way (`0102` § *The share's size is seven of
  nineteen*). The ladder is an extra attempt that only a plan with a leaning gets.
- **The share is a ceiling with a ladder under it, and the bottom rung is no preference at
  all.** On a band miss the caller walks `narrowerShares` — half the share, then none —
  rebuilding the pick with `RecipeController.rotateFor` and `withApplianceShare`, keeping the
  first rung that holds every band and discarding any rung that does not miss by less. Build
  a narrowed rotation **only** with `withApplianceShare`: at zero it empties
  `preferAppliances` rather than only zeroing the share, because `isPreferredDish` would
  otherwise keep every dish needing the appliance at the front of the pick — a share by
  another name, and measured as enough on its own to hold a fortnight out of band. The rung a
  plan ended on is stored as `kitchenShare`, so what the bands cost the kitchen is countable.
- **Never answer a thin appliance by strengthening the prompt.** Measured twice: the prompt
  line alone produced **zero** air-fryer dishes in a real fortnight with the air fryer
  preferred (2026-10-16), and asking as hard as the machinery can — `prefers`, every other
  non-default appliance `missing`, *and* a wish demanding it — reaches **34%** and no further
  (project 021 phase 8, 2026-10-17). A preference is worth what the library holds for it. The
  lever is supply; the prompt is a third of the answer at best.
- **`MAX_PREFERRED_APPLIANCES` is 3 and is not a price.** The same on both tiers, said on the
  screen before it is hit (`maxPreferred` travels in the payload), and `missing` is never
  capped. **Nothing about a kitchen is in `Allowance.ts`**, and that is a decision rather
  than an omission (`marketing`, 2026-10-15): a profile field that narrows or steers a plan
  has never been sold here. Do not add a row for it without that decision being revisited.

## ⛔ Anti-patterns

### 1. Database calls in controllers

```ts
// ❌ WRONG — controllers never import database
import { database } from 'database';

export const UserController = {
  async getUser(id: string) {
    const db = database(); // DB logic belongs in the repository, not here
  }
};

// ✅ CORRECT — delegate to the repository
export const UserController = {
  async getUser(input: Pick<User, 'id'>): Promise<UserView> {
    const user = await UserRepository.findById(input.id);
    if (!user) throw new NotFoundError(`User "${input.id}" not found`);
    return presentUser(user);
  }
};
```

### 2. Business logic in repositories

```ts
// ❌ WRONG — uniqueness check is business logic, not data access
export const UserRepository = {
  async create(input: CreateUser): Promise<User> {
    const existing = await findByEmail(input.email); // business rule inside a repository
    if (existing) throw new ConflictError('Email taken');
    // ...
  }
};

// ✅ CORRECT — repository creates blindly; controller checks the rule
export const UserController = {
  async createUser(input: CreateUser): Promise<UserView> {
    const existing = await UserRepository.findByEmail(input.email);
    if (existing) throw new ConflictError(`Email "${input.email}" is already taken`);
    const user = await UserRepository.create(input);
    return presentUser(user);
  }
};
```

### 3. Repositories calling controllers

```ts
// ❌ WRONG — creates a circular dependency, makes both layers untestable
import { UserController } from '../../controllers/User';

export const BookmarkRepository = {
  async create(input: CreateBookmark) {
    const user = await UserController.getUser({ id: input.userId }); // wrong direction
  }
};

// ✅ CORRECT — if the controller needs a user, it fetches it before calling the repository
export const BookmarkController = {
  async createBookmark(input: CreateBookmark) {
    const user = await UserRepository.findById(input.userId); // controller fetches cross-domain
    if (!user) throw new NotFoundError(`User not found`);
    const bookmark = await BookmarkRepository.create(input);
    return presentBookmark(bookmark);
  }
};
```

### 4. Importing internal paths from outside the package

```ts
// ❌ WRONG — bypasses the public API
import { UserController } from 'core/src/controllers/User/UserController';

// ✅ CORRECT — always use the package export
import { UserController } from 'core/controllers/User';
```

### 5. Using `any`

```ts
// ❌ WRONG
async function getUser(input: any) { ... }

// ✅ CORRECT — typed parameters at the controller, unknown + validation at the app boundary
async getUser(input: Pick<User, 'id'>): Promise<UserView> { ... }
```
