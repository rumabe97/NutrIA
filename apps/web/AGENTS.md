# apps/web AGENTS.md

Main web application. Rules here are more specific than root `AGENTS.md` — both apply.

---

> **Status.** Built: the landing page, the five auth screens, the ten-step onboarding, the
> profile, and the dashboard's empty state. Not built: the 14-day plan, meal detail and
> replacement, the shopping list, progress, check-ins and the assistant — see
> [`docs/ROADMAP.md`](../../docs/ROADMAP.md).

## Stack

- Next.js 16 App Router, `src/` layout
- Absolute imports via `tsconfig.json` `paths` (no `baseUrl`, no `@` prefix):
  - `components/*` → `./src/components/*`
  - `hooks/*` → `./src/hooks/*`
  - `lib/*` → `./src/lib/*`
  - `styles/*` → `./src/styles/*` (used for `import 'styles/globals.css'` / `import 'styles/variables.css'` in `layout.tsx`)
- No utility class frameworks — Module CSS only

## Proxy (replaces Middleware in Next.js v16)

Next.js v16 renamed `middleware.ts` → `proxy.ts`, and the exported function is `proxy`, not
`middleware`. **With a `src/` layout the file MUST live at `src/proxy.ts`** — at the app
root Next silently never loads it: no error, no redirect, the gating just does not run.

**`src/proxy.ts` is a redirect for signed-out visitors, not an authorisation check.** It
only tests whether a session cookie is *present*, and a client can set a cookie to anything.
The real check is `SessionGuard` in `apps/api`, which validates the session on every
request. Keep that distinction explicit in comments and in review: a cookie-presence test
that reads like a security control is how an app ends up with none.

## Directory layout

```
src/
  app/          — App Router. Route groups: (auth) for signed-out screens, (app) for signed-in
  components/   — app-specific components (not shared with other apps)
  hooks/        — app-specific hooks
  lib/          — api.ts (the typed API client), auth-client.ts, server-api.ts, env.ts
  styles/       — globals.css, variables.css
```

Before building a component here, check `packages/ui` first. If a component is reused in 2+ apps, it belongs in `packages/ui`, not here.

## Adding pages

Route groups carry the layout, so put a page in the right one and it inherits the correct
chrome for free:

- `src/app/(auth)/…` — signed-out screens. Centred card, brand mark, no nav.
- `src/app/(app)/…` — signed-in screens. `AppNav` (desktop header + mobile bottom bar) and
  the content shell.
- `src/app/page.tsx` — the marketing landing page, its own header and footer.

Routes are **Spanish**: `/acceder`, `/registro`, `/recuperar`, `/restablecer`, `/inicio`,
`/perfil`, `/onboarding/[paso]`. Add any new signed-in route to `PROTECTED` in
`src/proxy.ts` so signed-out visitors are redirected instead of seeing a flash of empty
page.

Pages are Server Components by default and fetch through `serverApi`. A page that needs a
session-scoped fetch must set `export const dynamic = 'force-dynamic'` — otherwise Next
prerenders it at build time, where there is no cookie, and every visitor gets the
signed-out render.

`useSearchParams` opts a route out of static rendering, so put the component that uses it
behind its own `<Suspense>` boundary rather than making the whole page dynamic — see
`components/SignInForm`.

One component per file (`react/no-multi-comp` is enforced), and `<Fragment>` rather than
`<>` (`react/jsx-fragments: element`). Before building a component here, check
`packages/ui` first: anything reused across two apps belongs there.

## Talking to the API

**This app has no database access and no business logic.** Data comes from `apps/api` over
HTTPS. It imports from `packages/core` for **types and Zod schemas only** — the same schema
validates the form here and the request body there, so a rule like "height is 100–250 cm"
is written once.

Two clients, picked by where the code runs:

```ts
// Server Component — forwards the browser's session cookie, returns null on failure.
import { serverApi } from 'lib/server-api';

const profile = await serverApi<FullProfileView>('/profile');
```

```ts
// Client Component — credentials included, throws a typed ApiError.
import { api, messageFor } from 'lib/api';

await api('/onboarding', { body: { data, step: 'about-you' }, method: 'PATCH' });
```

`serverApi` returns `null` rather than throwing, deliberately: a server component that
throws replaces the whole page with an error boundary, and one section failing to load
should degrade to an empty state, not take the page down.

`ApiError` carries a **stable `code`** (`NOT_FOUND`, `INVALID_INPUT`, `UNSAFE_CONTENT`, …)
and per-field `fieldErrors`. Switch on the code and use `messageFor(error)` for copy — the
API is free to reword its `message`, so never render it directly or match on its text.

**Never send a user id.** Every endpoint takes the caller's identity from the session.

## Auth

`lib/auth-client.ts` wraps Better Auth's React client. The session lives in an httpOnly
cookie, so no token is ever readable from JavaScript, and nothing auth-related goes in
`localStorage`.

After `signIn` / `signOut`, call `router.refresh()` as well as `router.push()` — server
components cache per-request, and without the refresh the next page renders with the
previous session's data.

## Forms

Uncontrolled by default: `<form onSubmit>` + `new FormData(event.currentTarget)`, with
`defaultValue` seeded from server-fetched data. Reach for controlled state only when a
field's value drives something else on screen.

Validation happens twice, on purpose. The client copy is a courtesy that avoids a round
trip; **the API's copy is the boundary**. Both use the same schema from
`packages/core/entities`, so they cannot disagree.

Error display rules:

- One `role="alert"` region per form for the failure summary, so a screen reader hears it
  without focus moving and losing the user's place.
- Field-level errors go on the `Input`'s `error` prop, keyed off `ApiError.fieldErrors`.
- **Never distinguish "wrong password" from "no such account"** on sign-in, or confirm
  whether an address exists on password reset. Both turn the form into an
  account-enumeration oracle. Sign-*up* is the exception: an existing address is
  information the visitor already has, and hiding it produces a dead end.

## Copy

UI copy is **Spanish (`es-ES`)**. Code identifiers, comments and docs stay English. Copy is
inline for now; an i18n layer arrives with the English milestone, so keep strings in the
component that renders them rather than scattering ad-hoc constant files.

Tone follows [`docs/PRODUCT.md`](../../docs/PRODUCT.md) § Experience principles: concise,
concrete, no AI marketing. And never claim something works that does not — the dashboard's
empty state says plan generation is not built yet rather than showing a button that calls
nothing.

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

**This app has exactly one: `NEXT_PUBLIC_API_URL`.** That is the design, not an accident —
no database URL, no auth secret, no AI key exists in this app, because `apps/api` holds all
of them.

If you find yourself adding a server-only variable here, the feature that needs it belongs
in `apps/api`. Declare anything new in `turbo.json` `globalEnv` so Turborepo caches
correctly.

## Testing

This app has no test suite yet. The logic worth testing lives elsewhere: domain rules in
`packages/core` (vitest), HTTP behaviour and user isolation in `apps/api` (jest +
supertest), components in `packages/ui`.

When something here earns a test — a client component with real state, a non-trivial
transform in `lib/` — add a `vitest` config mirroring `packages/ui`'s, and:

- Query by role, never by class name. No snapshots.
- Mock `lib/api`, not `fetch`. The client's error mapping is part of the contract.
- Don't test static server components. Visual regression belongs in Playwright, not here.
