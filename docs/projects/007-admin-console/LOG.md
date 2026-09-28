# LOG — Project 007: The admin console

> **Purpose**: append-only execution record. One entry per phase (plus one per
> deviation): what happened, evidence it works, what changed against the plan. This is
> the file future agents read to learn "what was decided in phase X and why".
> **Audience**: humans and agents. **Committed**: yes — one commit per phase, made by
> the owner at the phase boundary. **Written by**: the executing agent, appending only.
> Write repo-relative: no absolute paths, no references to other private repos.

<!-- Entry format — copy per phase:

## Phase N — Title (YYYY-MM-DD)

- **Executor**: model + effort actually used.
- **Result**: done | partial | blocked.
- **Evidence**: verification commands run and their outcomes (test counts, build
  results). Claims without evidence don't belong here.
- **Deviations from plan**: none, or what changed and why — with the plan amended in the
  same change.
- **Decisions**: links to any docs/decisions/ records created.
- **Notes for the next phase**: anything the next executor must know.
-->

## Phase 1 — The console shell, its navigation and Ajustes (2026-09-28)

- **Executor**: lead on opus (this session) for step 8 and the review fixes; steps 1–7 by
  the `frontend` agent (medium effort) on opus, in its own worktree, brought into the main
  checkout and the worktree removed. Reviews: `accessibility` (with `/local-probe`) and
  `invariant-reviewer`, both on opus.
- **Result**: done.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=web`: 14/14 tasks, 0 lint warnings; web 13
    files / 104 tests (4 new), ui 383, core 974, database 43.
  - `pnpm --filter web build`: green; `/admin`, `/admin/ajustes` and `/admin/anterior` are
    dynamic (`ƒ`), every public page still static.
  - `rg -n "AppNav" apps/web/src/app/(admin)`: no match.
  - `pnpm check:leaks`: no leak hit (it only warns about this project's uncommitted docs).
  - `/local-probe` (accessibility agent) with an `--admin` account, the option's first real
    run: `/admin`, `/admin?abierta=…`, `/admin/anterior` and `/admin/ajustes` at 320, 390
    and 1280 px, light and dark — 0 px sideways scroll on all 24. `/admin?abierta=a&abierta=b`
    answers 307 to `/admin/anterior?abierta=…&abierta=…` and the banner shows. With an
    ordinary account every one of those addresses answers 404 with the console's 404
    (`lang="es-ES"`, skip link, no console menu). Both probe accounts deleted, servers
    stopped.
  - `invariant-reviewer`: gate sound, no P0/P1. `accessibility`: no P0/P1.
- **Deviations from plan**:
  1. The 404 is `app/(admin)/not-found.tsx`, not `app/(admin)/admin/not-found.tsx`: a
     segment's `not-found` wraps that segment's pages but not its own layout, so the gate's
     `notFound()` would have skipped a file beside it and fallen to Next's bare page. Plan's
     Design summary and step 1 amended.
  2. `admin/page.tsx` repeats the role check before its `redirect()`: a layout and its page
     render concurrently, so without it a signed-in non-admin could get a 307 that confirms
     the address. Pinned by `app/(admin)/admin/page.test.ts` (added on the
     invariant-reviewer's P2; not in the plan's file list).
  3. `/admin/ajustes` also 404s when `/admin/settings` is null (same guarantee, page side).
  4. Only the switches left the transition page. The picture figures and the professionals
     list stay there until Imágenes and Profesionales exist (phases 6 and 8), so nothing is
     lost.
  5. The reminders switch is labelled with `remindersTitle`, since its old section heading
     is gone; the on/off hints are unchanged.
  6. Ajustes groups: Acceso = automatic activation + the dietitians' practice; Producto =
     premium + dish pictures (row `id="imagenes"` for phase 8's link); Notificaciones =
     check-in reminder + push test.
  7. No "Resumen" nav entry yet: `/admin` is only a redirect, and "only pages that exist
     appear". Phase 4 adds it. `sections.ts` already holds the six groups; empty ones draw
     nothing. Anterior is last, with no group heading.
  8. Outside the listed scope, comments only: `app/_shared/RootShell.tsx` now says four
     root layouts.
  9. `proxy.ts` and `_shared/pages.ts` unchanged (step 7): `PROTECTED` and `PRIVATE_PATHS`
     prefix-match `/admin`, confirmed by the invariant-reviewer.
- **Decisions**: none new. The 404 difference below is recorded in
  `app/(admin)/not-found.tsx`'s comment as accepted.
- **Notes for the next phase**:
  - **Phase 2 (packages/ui) should take the drawer focus race** (accessibility P2, read in
    code, not measured): following a link from the `Sidebar` drawer closes it, and vaul
    returns focus to "Menú" after its ~0.5 s animation, possibly after the route announcer
    has moved focus to the new `h1`. Fix: an `onCloseAutoFocus` prop on `Sidebar`, which
    `AdminNav` prevents when the close came from following a link.
  - Accepted, for the owner to overrule: a signed-in non-admin sees the console's Spanish
    404 at a real console address and Next's bare English 404 at a made-up one, so the two
    can be told apart. The addresses are public (repo, robots.txt) and the API guard
    protects the data. A root `app/not-found.tsx` (or `global-not-found`) would fix it
    site-wide, and give `/nada` a Spanish page with `lang` too. That is a separate change.
  - Open P3s: the transition page has three names (tab "Panel", h1 "Servicio", menu
    "Anterior") — left as the plan says "unchanged", and it goes in phase 8. The sidebar
    says "AJUSTES" then "Ajustes" while the group has one page. At 200% text on 320 px the
    sticky bar may wrap to two rows, and its scroll padding assumes one row. The drawer is
    vaul's `max-width: 280px; width: 80vw`; a `min(22rem, 100vw - 3rem)` would grow with
    the text.
  - Not measured in a browser, because the reviewer could not script it: the keyboard walk,
    the drawer open at 320/390, 200% text. The owner's iPhone check with VoiceOver covers
    the drawer.
  - No `proxy.ts` unit test exists. Consider one for `/admin/*` and `/en/admin/*` without
    a session when a phase touches the proxy.
  - Probe: `node $S/account.mjs create "$PROBE_DIR/admin.txt" --admin` works; see the
    local-probe skill's "An admin" section.
