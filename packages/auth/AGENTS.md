# packages/auth AGENTS.md

Supabase authentication helpers for Next.js. Rules here are more specific than root `AGENTS.md` — both apply.

---

## What lives here

```
src/
  client.ts     — Supabase browser client (use in Client Components)
  server.ts     — Supabase server client (use in Server Components, actions, route handlers)
  middleware.ts — Next.js middleware: refreshes session cookies on every request
```

## Exports

| Import path         | Use when                                                                    |
| ------------------- | --------------------------------------------------------------------------- |
| `'auth/client'`     | Client Component needs the Supabase client                                  |
| `'auth/server'`     | Server Component, server action, or route handler needs the Supabase client |
| `'auth/middleware'` | Wiring up Next.js middleware in an app                                      |

## Usage

```ts
// In a Server Component or server action:
import { createClient } from 'auth/server';

const { auth } = await createClient();
const {
  data: { user }
} = await auth.getUser();

// In a Client Component:
import { createClient } from 'auth/client';

const supabase = createClient();
```

## Proxy (Next.js v16+)

Next.js v16 renamed `middleware.ts` → `proxy.ts` and the exported function from `middleware` → `proxy`. Import `updateSession` from `'auth/middleware'` in your app's `proxy.ts`. With a `src/` layout the file must live at `src/proxy.ts` — at the app root Next silently never loads it:

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

This refreshes the session cookie on every request so Server Components always have a fresh session.

## Testing

Vitest with `vi.mock()` for the Supabase SDK. Reference: [`middleware.test.ts`](src/middleware.test.ts).

This package wraps `@supabase/ssr`. Tests should mock the SDK boundary (don't re-test Supabase itself) and verify three things:

1. **Argument forwarding** — we pass the env-var values into `createServerClient` correctly.
2. **Branching on SDK return values** — for `updateSession`, that means redirecting unauthenticated users to `/login` while letting authenticated users (and `/login` / `/register` / `/auth/*` / `/error` paths) through.
3. **Downstream contract** — the response shape we hand back to Next.js.

**Skipped:** `client.ts` and `server.ts` are 5-line wrappers around `createBrowserClient` / `createServerClient`. The middleware test exercises the env-loading + SDK-mocking pattern; the client/server wrappers don't add new logic worth a separate test.

When you add a new auth helper, copy the mock-the-SDK-boundary pattern from `middleware.test.ts`.

## What does NOT belong here

- Application-specific auth logic (route guards, role checks) — those live in `apps/*/src/middleware.ts` or server actions.
- Database queries — those live in `packages/database` and `packages/core`.
