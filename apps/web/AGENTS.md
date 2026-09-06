# apps/web AGENTS.md

Main web application. Rules here are more specific than root `AGENTS.md` — both apply.

---

> **Status: starter shell.** Today this app only contains `src/app/layout.tsx`, `src/app/page.tsx`, and the auth proxy (`src/proxy.ts`) — no server actions, no forms, no `core` integrations yet. The sections below describe **the patterns to follow when you add those features**, not what's already there. Don't expect to find example code matching every section; the conventions are forward-looking and meant to be applied as you build.

## Stack

- Next.js 16 App Router, `src/` layout
- Absolute imports via `tsconfig.json` `paths` (no `baseUrl`, no `@` prefix):
  - `components/*` → `./src/components/*`
  - `hooks/*` → `./src/hooks/*`
  - `lib/*` → `./src/lib/*`
  - `styles/*` → `./src/styles/*` (used for `import 'styles/globals.css'` / `import 'styles/variables.css'` in `layout.tsx`)
- No utility class frameworks — Module CSS only

## Proxy (replaces Middleware in Next.js v16)

Next.js v16 renamed `middleware.ts` → `proxy.ts`. The exported function is `proxy`, not `middleware`. **With a `src/` layout the file MUST live at `src/proxy.ts`** — at the app root Next silently never loads it (verified via the build manifest: no error, no session refresh, auth gating just doesn't run).

```ts
// apps/web/src/proxy.ts
import { updateSession } from 'auth/middleware';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
```

## Directory layout

```
src/
  app/          — Next.js App Router pages, layouts, and server actions
  components/   — app-specific components (not shared with other apps)
  hooks/        — app-specific hooks
  lib/          — app-specific utilities
  styles/       — globals.css, variables.css
```

Before building a component here, check `packages/ui` first. If a component is reused in 2+ apps, it belongs in `packages/ui`, not here.

## Using core

Business logic lives in `packages/core`. Import controllers directly — never import repositories or entities from an app except for type-only imports.

```ts
// Server Component — fetch data directly
import { UserController } from 'core/controllers/User';

export default async function ProfilePage({ params }: { params: { id: string } }) {
  const user = await UserController.getUser({ id: params.id });
  return <Profile user={user} />;
}

// Server action — handle mutations
import { UserController } from 'core/controllers/User';
import { ConflictError, NotFoundError } from 'core/entities/Error';

export async function createUserAction(input: CreateUser) {
  try {
    return await UserController.createUser(input);
  } catch (error) {
    if (error instanceof ConflictError) return { error: 'Email already in use' };
    if (error instanceof NotFoundError) return { error: 'Not found' };
    throw error; // unexpected — let Next.js handle it
  }
}
```

**App boundaries (server actions and route handlers) are the only place that should `try/catch` domain errors.** Server Components can let errors propagate to the nearest `error.tsx`.

## Adding pages

Pages live in `src/app/`. Each route segment is a folder with a `page.tsx`:

```
src/app/
  page.tsx              — /
  about/
    page.tsx            — /about
  dashboard/
    layout.tsx          — shared layout for dashboard routes
    page.tsx            — /dashboard
    [id]/
      page.tsx          — /dashboard/:id
```

- Layouts (`layout.tsx`) handle shared UI — nav, sidebars, auth wrappers.
- Pages (`page.tsx`) are async Server Components by default — fetch data directly using core controllers.
- Add `'use client'` only when you need browser APIs, event handlers, or React state.

## Server vs. Client Components

See the canonical rule in [root AGENTS.md](../../AGENTS.md#server-vs-client-components--the-most-important-nextjs-app-router-rule). All of it applies here verbatim — not duplicated to avoid drift.

App-specific notes:

- `src/app/**/page.tsx` and `layout.tsx` are Server Components by default. Don't put `'use client'` on them; extract the interactive leaf into a sibling file.
- Forms in this app combine a Server Component page + a `'use client'` form component that calls `useActionState` — see the Forms section below for the canonical pattern.

## Server actions

Place actions in `src/app/actions/` or co-locate them in the relevant route folder as `actions.ts`.

```ts
'use server';

import { UserController } from 'core/controllers/User';

export async function createUser(input: CreateUser) {
  return UserController.createUser(input);
}
```

## Forms

This app uses **native `<form>` + React 19 `useActionState` + server actions**. There is no `Form` wrapper component in the DS, and we do not use a client-side form library (no react-hook-form, no Radix Form). The whole pattern is server-action-first: validation happens on the server, errors come back as state, and per-field errors are threaded into each `Input`'s `error` prop.

### The canonical pattern

**Action** — returns `{ values?, errors? }` for the form to re-render with:

```ts
// src/app/(public)/register/_actions/register.ts
'use server';

import { UserController } from 'core/controllers/User';

interface RegisterState {
  errors?: { email?: string; password?: string; _form?: string };
  values?: { email?: string };
}

export async function registerAction(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const errors: NonNullable<RegisterState['errors']> = {};
  if (!email.includes('@')) errors.email = 'Enter a valid email address.';
  if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
  if (Object.keys(errors).length) return { errors, values: { email } };

  try {
    await UserController.createUser({ email, password });
    // …redirect on success
  } catch (error) {
    return { errors: { _form: 'Something went wrong. Try again.' }, values: { email } };
  }
  return {};
}
```

**Form component** — client component that wires `useActionState` into the DS Inputs:

```tsx
// src/app/(public)/register/RegisterForm.tsx
'use client';

import { useActionState } from 'react';
import { Input } from 'ui/components/Input';
import { Button } from 'ui/components/Button';
import { VStack } from 'ui/components/VStack';
import { registerAction } from './_actions/register';

export function RegisterForm() {
  const [state, action, isPending] = useActionState(registerAction, {});

  return (
    <form>
      <VStack gap="04">
        <Input defaultValue={state.values?.email} error={state.errors?.email} label="Email" name="email" required type="email" />
        <Input error={state.errors?.password} label="Password" name="password" required type="password" />
        {state.errors?._form && <p role="alert">{state.errors._form}</p>}
        <Button formAction={action} type="submit" disabled={isPending}>
          {isPending ? 'Submitting…' : 'Register'}
        </Button>
      </VStack>
    </form>
  );
}
```

### Rules

1. **Action returns `{ values?, errors? }`** — `values` lets the form re-render with the user's input preserved; `errors` is keyed by field name so each Input picks its own error from `state.errors?.<name>`.
2. **`<form>` is the native element.** No DS Form wrapper. The form's layout (gap between fields, button placement) is the consuming component's responsibility — use VStack or a CSS module for it.
3. **Use `<Button formAction={action}>`** to bind the action to a specific submit button. This also works for multi-action forms (Save vs. Save & Continue).
4. **Disable the submit while pending.** `isPending` from `useActionState`. Don't disable Inputs — users may want to fix something while the submit is in flight.
5. **Form-level errors** (e.g. "server error") go in a `role="alert"` paragraph, separate from per-field errors.
6. **Validation on the server is the source of truth.** Native `required` / `type="email"` / `pattern` are progressive enhancement — they catch trivial mistakes before the round-trip, but the server still validates.
7. **Don't reach for `react-hook-form`, `zod-form-data`, or Radix Form** unless you have a real need the canonical pattern can't meet. The canonical pattern handles 90% of forms with zero extra dependencies.

### Where validation logic lives

- **Server actions** validate input and shape the error response (above).
- **Heavy validation rules** (regex, business rules) live in `packages/core/controllers/*` so they're reusable. The action calls the controller, the controller throws a domain error, the action catches and maps to `errors`.
- **Native HTML attributes** (`required`, `type`, `pattern`, `minLength`) are a free first line of defense — use them.

## Styles

This app imports tokens in this order (defined in `src/app/layout.tsx`):

1. `ui/styles/colors` — palette primitives
2. `ui/styles/variables` — semantic tokens
3. `ui/styles/base` — shared CSS reset (do not duplicate its rules in `globals.css`)
4. `ui/styles/classnames` — shared utility classes
5. `styles/globals.css` — app-specific global styles only
6. `styles/variables.css` — app-level token overrides (must be last)

`src/styles/variables.css` is where all branding and token overrides go. To change the accent color, remap `--color-brand-01`–`--color-brand-12` to any palette scale. Never reference palette tokens (`--color-gray-*`, `--color-blue-*`, etc.) directly.

`src/styles/globals.css` is for app-specific styles only — the shared reset already lives in `ui/styles/base`.

## Environment variables

- Server-only vars: no `NEXT_PUBLIC_` prefix.
- Client-exposed vars: `NEXT_PUBLIC_` prefix — treat as public, never put secrets here.
- Declare expected env vars in `turbo.json` under `globalEnv` or task `env` so Turborepo can cache correctly.

## Testing

This app currently has no tests because there's no real app code to test yet (the starter is intentionally bare-bones). When you add features, follow these patterns:

- **Server actions** — test like controllers in `packages/core`: mock the controller dependency, assert on the input → output / error contract. Vitest with `vi.mock()`.
- **Client Components with state or effects** — test like UI components in `packages/ui`: vitest + `@testing-library/react`, query by role, no snapshots.
- **Static Server Components** (pure markup with no logic) — don't test. Visual regression belongs in Playwright / Storybook if you add them later, not in unit tests.

When you add the first server action or interactive component, also add the matching `vitest` config + scripts to `apps/web/package.json` (mirror `packages/core/package.json` for server-side, `packages/ui/package.json` for component tests).
