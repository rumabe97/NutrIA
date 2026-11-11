# Inventory: what every signed-in screen shares

Phase 0 of project 024, acceptance criterion 1. Written from the code. Scope: `RootShell` and its islands, the signed-in layout, `AppNav`, `LocaleSwitcher`, the offline provider and notice, `Tour`, the toaster, error / not-found / loading screens, `ArrivalSync`.

Conventions:

- "Words" is a key path in `apps/web/src/i18n/dictionaries/es-ES.ts`; `en-GB.ts` has the same shape. `—` = not from the dictionary.
- The signed-in tree (`apps/web/src/app/(app)/`) keeps Spanish addresses in both languages; its language comes from the locale cookie (`activeLocale()`), not the URL. The public trees take it from the URL. `RootShell` serves all four roots (Spanish, English, signed-in app, admin console).
- Routes under `(app)`: `/inicio`, `/plan/**`, `/compra/**`, `/progreso`, `/perfil`, `/asistente/**`, `/consulta/**`, `/check-in`, `/consentimiento`, `/invitacion`, `/onboarding/**`. Their own contents are inventoried elsewhere; this file is only what wraps them.

## 1. RootShell (apps/web/src/app/_shared/RootShell.tsx)
Rendered by `app/(es)/layout.tsx`, `app/en/layout.tsx`, `app/(app)/layout.tsx` and the admin layout. Imports the global stylesheets in a fixed order (cascade: motion, colors, variables, base, classnames, then `styles/globals.css`, `styles/variables.css`) and the font variable on `<body>`.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1.1 | `<html lang>` set to `es-ES` or `en-GB` | text (document language) | `app/_shared/RootShell.tsx` | — | always |
| 1.2 | Skip link "Saltar al contenido", the first focusable node, visually hidden until focused, goes to `#contenido` | link | `app/_shared/SkipLink.tsx` | `a11y.skipToContent` | always |
| 1.3 | Route announcer: after a client-side navigation (not the first render) moves focus to the new page's `<h1>` inside `#contenido`, or to `#contenido` itself when there is no `<h1>`, setting `tabindex=-1` and not scrolling. Renders nothing | status (focus behaviour) | `app/_shared/RouteAnnouncer.tsx` | — | on every pathname change |
| 1.4 | Service worker registration for offline copies (production only, scope the whole site); renders nothing | status (invisible) | `app/_shared/ServiceWorker.tsx`, `lib/offline.ts` | — | always |
| 1.5 | Locale provider: puts the dictionary and locale on a context for every client island | status (invisible) | `i18n/LocaleProvider.tsx` | — | always |
| 1.6 | Main landmark id `contenido` (`MAIN_ID`), the single target of 1.2 and 1.3 | text (landmark) | `app/_shared/mainId.ts` | — | always |

## 2. Signed-in layout (apps/web/src/app/(app)/layout.tsx, layout.module.css)
Every route under `(app)`. Per request. Before rendering, `redirectUnlessReady()` (`lib/access.ts`) reads `/users/me`: if the account is not activated or its email is unverified it redirects to `/pendiente`; then if a password change is required it redirects to `/cambiar-contrasena`. A `null` read (API unreachable) redirects nowhere. Without a session cookie the proxy (`apps/web/src/proxy.ts`) has already redirected to `/acceder?siguiente=<path>`. Metadata from `rootMetadata(await activeLocale())`.

Structure, in order inside `RootShell`: `ArrivalSync` (renders nothing), `OfflineProvider`, then a flex column containing `AppNav` and `<main id="contenido">` which holds `OfflineCopy` and then the page. Content is centred to `--content-max`; bottom padding clears the fixed bottom bar below 48rem.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 2.1 | AppNav (header, desktop nav, bottom bar) | menu | `components/AppNav/AppNav.tsx` | see section 3 | always |
| 2.2 | `<main id="contenido">` wrapping the page | text (landmark) | `app/(app)/layout.tsx` | — | always |
| 2.3 | OfflineCopy notice as the first child of main | notice | `components/OfflineCopy/OfflineCopy.tsx` | see section 5 | when offline or on a stored copy |
| 2.4 | Redirect to `/pendiente` while a lock is closed (email unconfirmed or account not opened) | status (navigation) | `lib/access.ts` | — | on the user's state |
| 2.5 | Redirect to `/cambiar-contrasena` while a password change is required | status (navigation) | `lib/access.ts` | — | on the user's state |
| 2.6 | Inputs for display only: `assistant` flag from `GET /settings` (shows the Assistant destination) and `professional` flag from `GET /users/me` (shows the Consulta destination); a failed read counts as false | status (invisible) | `app/(app)/layout.tsx` | — | on the reads |

## 3. AppNav (apps/web/src/components/AppNav/AppNav.tsx, AppNav.module.css)
Client component with three parts: the sticky header, a desktop navigation inside it, and a fixed bottom tab bar. One list of destinations drives both navs, so they cannot disagree. A destination link carries `aria-current="page"` when `pathname.startsWith(href)`.

Destinations in order (the list is filtered by section 5's `available`):

| Order | href | Dictionary label | Words | Shown when |
|---|---|---|---|---|
| 1 | `/inicio` | Inicio | `appNav.home` | always |
| 2 | `/plan` | Plan | `appNav.plan` | always |
| 3 | `/compra` | Compra | `appNav.shopping` | always |
| 4 | `/progreso` | Progreso | `appNav.progress` | always |
| 5 | `/asistente` | Asistente | `appNav.assistant` | only when the `assistant` flag is on; inserted before Perfil |
| 6 | `/perfil` | Perfil | `appNav.profile` | always |
| 7 | `/consulta` | Consulta | `appNav.consulta` | only when `UserView.professional` is true; appended last |

Offline, only destinations with a stored copy on the device draw (see section 5): by default `/inicio`, `/plan`, `/compra` (the constant `OFFLINE_PATHS`), then whatever the device reports as stored.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 3.1 | Header, sticky to the top, glass background with blur, bottom hairline; row wraps (two lines) at large text sizes | menu (landmark region) | `components/AppNav/AppNav.tsx` | — | always |
| 3.2 | Brand link to `/inicio` with decorative mark and wordmark "NutrIA"; accessible name "NutrIA — inicio". Below 22.5rem width the wordmark is hidden and the mark alone carries the brand (the name stays) | link | same | `appNav.brandHome` (name); "NutrIA" literal | always |
| 3.3 | Desktop navigation landmark "Secciones": the destinations above as text links, current one emphasised | menu | same | `appNav.sectionsLabel`; labels per table | width >= 48rem only (`display: none` below) |
| 3.4 | Language switch, compact: group "Idioma" with "ES" / "EN" toggles (names "Español" / "English", `aria-pressed`). In the signed-in tree there is no second address: pressing writes the cookie, patches the profile locale (a failure shows only in the full form), then refreshes the router | toggle | `components/LocaleSwitcher/LocaleSwitcher.tsx` | group `profile.locale`; marks/names literal | not offline |
| 3.5 | Sign-out button "Cerrar sesión" in the header: forgets push on this device, ends the session, forgets offline copies, navigates to `/`, refreshes. Minimum height for touch on coarse pointers; at very large text (< 17rem) it wraps to its own line and the header stops being sticky | button | same | `appNav.signOut` | not offline; header at every width |
| 3.6 | Bottom tab bar landmark "Navegación principal", fixed to the bottom with glass blur, one equal column per destination | menu | same | `appNav.mainLabel` | width < 48rem only (hidden from 48rem) |
| 3.7 | Bottom tab: link with a decorative 20 px icon (path per destination) and the label, 56 px tall; the current one is tinted, bolder and has a heavier stroke | link | same | `appNav.home`, `.plan`, `.shopping`, `.progress`, `.assistant`, `.profile`, `.consulta` | one per destination, width < 48rem |
| 3.8 | At widths below 17rem (largest text size on a 320 px phone) the tab bar is icons only (28 px; labels remain as the accessible names; current tab on a ringed disc) | figure | same (CSS) | same labels | width < 17rem |
| 3.9 | While a text field, select or textarea has focus (keyboard open on a phone), the bottom bar is hidden (`visibility: hidden`) and returns about 300 ms after focus leaves | status (behaviour) | same (CSS) | — | on focus of an input-like control |
| 3.10 | Scroll padding so focus is never hidden under the sticky header (above) or the bottom bar (below 48rem) | status (behaviour) | same (CSS) | — | always |
| 3.11 | Offline: header hides the language switch and sign-out (both need the server) and the destinations are reduced to stored ones | status | same | — | when `useOffline().offline` |

## 4. LocaleSwitcher, full form (apps/web/src/components/LocaleSwitcher/LocaleSwitcher.tsx)
The compact form (3.4) is the header's. The full form is a card used on the profile screen (`app/(app)/perfil/page.tsx`), so a profile has two language controls on screen at once.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 4.1 | Card heading h3 "Idioma" | heading | `components/LocaleSwitcher/LocaleSwitcher.tsx` | `profile.locale` | full form (profile) |
| 4.2 | Hint "Cambia la interfaz al momento y se guarda en tu perfil." | text | same | `profile.localeHint` | full form |
| 4.3 | Group "Idioma" with two option buttons "Español" and "English" (each language named in itself), `aria-pressed` on the active one, `aria-busy` on the one being applied, all disabled while one is pending | toggle | same | `profile.locale`; names literal | full form |
| 4.4 | Error line (`role="alert"`) when saving the profile locale fails with anything but a 404, text from the API-error mapping (`lib/api.ts` `messageFor`) | notice | same | `errors.*` (see section 9) | after a failed `PATCH /profile` |
| 4.5 | Behaviour in all forms: the cookie is written first and always; the profile `PATCH` is attempted; a 404 (signed out) is swallowed; then on a localised public path it navigates to the twin URL keeping the query string, on a signed-in path it refreshes | status (behaviour) | same | — | on press |

## 5. Offline: OfflineProvider and OfflineCopy (apps/web/src/components/OfflineProvider/OfflineProvider.tsx, apps/web/src/components/OfflineCopy/OfflineCopy.tsx)
Signed-in tree only. `OfflineProvider` is given `renderedAt` (when the server made the screen). The screen is a stored copy when it reaches the browser more than 2 minutes after `renderedAt`; `copy` is `today` or `earlier` by calendar day. `offline` is true when `navigator.onLine` is false or the screen is a copy.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 5.1 | Notice (amber, `role="status"`, first thing in main): "Sin conexión: estás viendo la copia de las {time}. Lo que taches en la compra se guardará cuando vuelva la conexión; el resto de cambios la necesita." with the render time as hour and minutes | notice | `components/OfflineCopy/OfflineCopy.tsx` | `offline.copyToday` | offline and a copy made today |
| 5.2 | Notice "Sin conexión: estás viendo la copia del {date}. Lo que taches en la compra se guardará …" with the date as weekday, day and month | notice | same | `offline.copyEarlier` | offline and a copy from an earlier day |
| 5.3 | Notice "Sin conexión. Lo que taches en la compra se guardará cuando vuelva; el resto de cambios necesita conexión." | notice | same | `offline.offline` | offline with a live (not stored) render |
| 5.4 | Nothing drawn when online and live | status | same | — | otherwise |
| 5.5 | Behaviour: on each screen change refreshes the stored copies (the worker allows once a minute) and again when the app goes to the background; on opening a screen, on reconnecting and on returning to the tab, flushes shopping ticks made offline and refreshes the copies if any were sent; on the `online` event while reading a copy, refreshes the router to the live screen once | status (behaviour) | same, `lib/offline.ts`, `lib/pendingTicks.ts` | — | always |
| 5.6 | Context value exposes `available(path)`: online every path; offline only `OFFLINE_PATHS` (`/inicio`, `/plan`, `/compra`) until the device reports its stored pages. Also read by `ShoppingItem` and each meal's recipe link | status (behaviour) | `components/OfflineProvider/OfflineProvider.tsx` | — | offline |

## 6. Tour (apps/web/src/components/Tour/Tour.tsx)
Mounted in two places: the dashboard `app/(app)/inicio/page.tsx` as `<Tour seen={profile.tourSeen ?? true} />` (opens by itself, once, for an account that has not seen it; a missing profile counts as seen) and the profile `app/(app)/perfil/page.tsx` as `<Tour replay />` (a card with a replay button). A native `<dialog>` opened with `showModal` (focus trap, Escape, backdrop from the platform). Any close, Escape included, marks it seen through `PATCH /profile/tour` (fire and forget) and returns focus to the replay button, or to the page's `<h1>`. Focus lands on the stop's heading on open and on every step.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 6.1 | Replay card: heading h3 "Cómo funciona NutrIA" | heading | `components/Tour/Tour.tsx` | `tour.replayTitle` | profile (`replay`) |
| 6.2 | Replay card text "Un repaso de lo que hace NutrIA, por si te lo saltaste o quieres verlo otra vez." | text | same | `tour.replayBody` | profile |
| 6.3 | Secondary button "Ver el tutorial" (restarts at step 1 and opens the dialog) | button | same | `tour.replayCta` | profile |
| 6.4 | Dialog `aria-labelledby` the stop title and `aria-describedby` the body | dialog | same | — | when open |
| 6.5 | Progress "{step} de {of}" (for example "1 de 5") | text | same | `tour.progress` | when open |
| 6.6 | Stop title, h2, focusable programmatically | heading | same | `tour.stops.<key>.title` | when open |
| 6.7 | Stop body | text | same | `tour.stops.<key>.body` | when open |
| 6.8 | Stop link to the stop's own screen (closes the tour): stop 1 `plan` "Ver el plan" to `/plan`; stop 2 `swap` "Ver el plan" to `/plan`; stop 3 `shape` "Ajustar mis comidas" to `/onboarding/4?volver=perfil`; stop 4 `trip` "Marcar un viaje" to `/perfil`; stop 5 `checkIn` "Ir al check-in" to `/check-in` | link | same | `tour.stops.plan.cta`, `.swap.cta`, `.shape.cta`, `.trip.cta`, `.checkIn.cta` | when open |
| 6.9 | The five stops: `plan` "Tu quincena, ya planificada"; `swap` "¿No te apetece un plato? Cámbialo"; `shape` "Di qué comidas haces y de qué tamaño"; `trip` "Si te vas, el plan te espera"; `checkIn` "El check-in de cada quincena" (each with a body paragraph) | list | same | `tour.stops.*` | in that order |
| 6.10 | Closing line on the last stop "Puedes volver a ver esto cuando quieras desde tu perfil. Y si te falta algo, cuéntamelo ahí mismo." | text | same | `tour.closing` | last stop |
| 6.11 | Secondary small button "Saltar" (closes the tour) at the far end of the row | button | same | `tour.skip` | every stop except the last |
| 6.12 | Secondary small button "Atrás" | button | same | `tour.back` | step 2 onwards |
| 6.13 | Primary small button "Siguiente" | button | same | `tour.next` | every stop except the last |
| 6.14 | Primary small button "Ya está" (closes) | button | same | `tour.done` | last stop |
| 6.15 | Dashboard use draws nothing but the dialog (an empty section wrapper) | status | same | — | `inicio`, when not auto-open |

## 7. Toaster (packages/ui/src/components/Toaster/Toaster.tsx)
The UI package defines a `Toaster` (Sonner: bottom-right, 5 s, close button, rich colours, token-coloured). A search of `apps/web/src` found no import and no mount of it and no `toast(...)` call, so no toast is produced anywhere in the web app today.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 7.1 | Toast viewport and close button (library component) | notice | `packages/ui/src/components/Toaster/Toaster.tsx` | — | never: not mounted in `apps/web` (verify in Not sure) |

## 8. ArrivalSync (apps/web/src/components/ArrivalSync/ArrivalSync.tsx)
Renders nothing. A tab that left for a social provider writes a note in `sessionStorage` (`nutria:arriving`, `lib/arrival.ts`, set by `SocialSignIn`). On landing in the signed-in layout, if the note exists (read once, then removed), the browser's language is reconciled with the profile (`syncLocaleFromProfile`) and the router is refreshed so the screen renders in the account's language.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 8.1 | Post-sign-in language sync and refresh after a provider round trip | status (invisible) | `components/ArrivalSync/ArrivalSync.tsx` | — | once, on arrival from a provider |

## 9. Error boundary (apps/web/src/app/(app)/error.tsx)
Catches a failed render in any signed-in route (and `reset()` re-runs the segment). It renders inside the signed-in layout, so AppNav and OfflineCopy remain around it. The error is logged to the console and never shown (no digest).

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 9.1 | Heading h1 "No hemos podido cargar esta página" | heading | `app/(app)/error.tsx` | `errors.boundaryTitle` | on a render error |
| 9.2 | Body "Puede ser una conexión intermitente. Vuelve a intentarlo; si sigue fallando, tus datos están a salvo." | text | same | `errors.boundaryBody` | on a render error |
| 9.3 | Primary button "Reintentar" (calls `reset`) | button | same | `common.retry` | on a render error |
| 9.4 | Secondary link-button "Ir al inicio" to `/inicio` | link | same | `errors.boundaryHome` | on a render error |

## 10. Loading skeleton (apps/web/src/app/(app)/loading.tsx)
Shown while any `(app)` route resolves (every page is `force-dynamic`). Mirrors the dashboard and plan: not a spinner.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 10.1 | Header skeleton: a wave bar (2.25 rem, up to 14 rem wide) and a thin bar (up to 22 rem) | status | `app/(app)/loading.tsx` | — | while a signed-in route loads |
| 10.2 | Card skeleton: a short bar, a row of four 3 rem blocks, then four rows of three bars | status | same, `components/Card/Card.tsx`, `ui/components/Skeleton` | — | same |
| 10.3 | No text, no announced status | status | same | — | same |

Other loading files in the wider app that sit outside this slice: `app/(es)/(auth)/loading.tsx` and `app/en/(auth)/loading.tsx` (documented in `auth.md` S1.4). No other `loading.tsx` exists under `(app)` (checked).

## 11. Not-found screens
Only one `not-found.tsx` exists, and it belongs to the admin console.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 11.1 | Admin / console not-found: `<main id="contenido">` with h1 "No hemos encontrado lo que buscabas." | heading | `app/(admin)/not-found.tsx` | `errors.notFound` | any `/admin/...` address for a non-admin, an unknown `/admin/...` address, or a console page that cannot load its figures. Shows no console frame |
| 11.2 | Primary link-button "Ir al inicio" to `/inicio` | link | same | `errors.boundaryHome` | same |
| 11.3 | Tab title for that 404 "Página no encontrada" | text (tab title) | `app/(admin)/consoleMetadata.ts` | `errors.notFoundTitle` | same |
| 11.4 | Everywhere else a `notFound()` is thrown (for instance the whole `/asistente` tree while the assistant switch is off, `app/(app)/asistente/layout.tsx`; any other protected-route denial), there is no custom screen: Next's default 404 page renders, which is not in the dictionary | status | none | — | see Not sure |

## 12. Shared error wording used across the signed-in screens
`lib/api.ts` `messageFor(error, dictionary)` turns an API error code into one `errors.*` sentence; any unknown code gives `errors.request`, a non-API error gives `errors.internal`. Screens show these inside their own alerts and notices, so each one is perceivable somewhere. The full list of keys in `errors`: `accountNotActivated`, `assistantUnavailable`, `boundaryBody`, `boundaryHome`, `boundaryTitle`, `careLinkExists`, `conflict`, `emailNotVerified`, `fixedMealDayFull`, `fixedMealWarning`, `internal`, `invalidInput`, `mealInFuture`, `network`, `notFound`, `notFoundTitle`, `onboardingIncomplete`, `passwordChangeRequired`, `pictureAllergensMismatch`, `pictureCapReached`, `pictureDrawing`, `pictureFlagOff`, `pictureNoCandidate`, `pictureNotAcceptable`, `pictureNotRemovable`, `pictureNotRetryable`, `pictureUnavailable`, `planPaused`, `practiceFull`, `profileConsentRequired`, `quotaExceeded`, `reauthenticationRequired`, `request`, `twoFactorNotEnabled`, `twoFactorRemovalPending`, `underMinimumAge`, `unsafeContent`. A request that returns `PASSWORD_CHANGE_REQUIRED` from the browser also navigates to `/cambiar-contrasena` in the stored language.

Common shared button words in `common`: `add` Añadir, `back` Atrás, `cancel` Cancelar, `close` Cerrar, `continue` Continuar, `edit` Editar, `finish` Terminar, `none` Ninguna, `noneMasculine` Ninguno, `remove` Quitar, `retry` Reintentar, `save` Guardar, `saving` Guardando…; these are reused by screens and are not shell rows.

## Counts

Rows: 1) 6; 2) 6; 3) 11 plus the destination table (7); 4) 5; 5) 6; 6) 15; 7) 1; 8) 1; 9) 4; 10) 3; 11) 4. Total 62 rows plus the 7-destination table and the key lists in section 12.

## Not sure

- The Toaster: found by grep that nothing in `apps/web/src` imports it. If a screen reached it through another path (a dynamic import, a different alias), I missed it; the later check should grep `Toaster` and `sonner` again against the new code.
- The default Next 404 page (11.4): there is no `app/not-found.tsx` and no `(app)/not-found.tsx`. With several root layouts, an unknown top-level URL renders Next's bare built-in 404 (English text, no site chrome, no dictionary), and `notFound()` inside `(app)` renders Next's default message inside the signed-in shell. I did not run the app to see either screen. This is perceivable and not in the dictionary; if the redesign adds branded not-found screens it adds, rather than replaces, anything.
- `global-error` does not exist (checked by `find`); an error in the root layouts themselves shows Next's own error page.
- Breakpoints: only what grep of `AppNav.module.css` showed (48rem nav swap, 22.5rem wordmark, 17rem icon-only bar and non-sticky header, coarse pointer target heights). Other rules in `AppNav.module.css`, `LocaleSwitcher.module.css`, `Tour.module.css` and `layout.module.css` were not read in full.
- The compact language switcher's accessible group label is `profile.locale` ("Idioma") although it sits outside the profile: both forms share that key.
- `OfflineProvider.available()` drives which destinations draw offline; the exact list of "stored pages" comes from the device cache (`storedPages()` in `lib/offline.ts`) at runtime and cannot be known from the source. The default is the three constants.
- `AppNav` is shown for all signed-in routes, including `/onboarding/**`, `/consentimiento` and `/invitacion`; I did not check whether those pages hide it by CSS or layout (a `layout.tsx` under `onboarding` was not found by the search, but I did not read each page).
- `app/(app)/asistente/layout.tsx` adds the assistant's own frame (history beside the conversation); it belongs to the assistant's inventory, not this file.
- The admin console has its own layouts and nav (`components/AdminNav`) and is out of this slice.
- The `ui/components/Skeleton` animation (`wave`) and the reduced-motion behaviour were not read.
