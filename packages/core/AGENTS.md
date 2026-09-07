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

Two related rules:

- **Wrap delete-then-insert in a transaction.** `SafetyRepository.replaceAll` does, because
  the intermediate state — allergies deleted, not yet re-inserted — is a profile with *no*
  restrictions. Nothing may observe that gap.
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
