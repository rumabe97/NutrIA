# 0053 — The shopping list survives the supermarket

**Status**: accepted · **Date**: 2026-09-12 · **Deciders**: owner, agent

## Context

The first step of the apps in the stores (`ROADMAP.md` § 8) is the web app made
installable. The manifest and the icons were already there, so NutrIA could already be
added to a home screen and opened without browser chrome. What it could not do was open
without a network, and the supermarket, where the shopping list is read, is where the
signal drops.

Nothing signed-in survived a lost connection, by design. Every signed-in screen is rendered
on the server per request (`force-dynamic`) from reads of the API, and every authenticated
response is `no-store`, so that no shared cache keeps somebody's health data
(`ARCHITECTURE.md` § Security invariants).

## Decision

- **A service worker written by hand**, `apps/web/public/sw.js`: one file of plain
  JavaScript, with no build step, that keeps a copy of **two screens**, today (`/inicio`)
  and the shopping list (`/compra`). It stores the HTML as the server rendered it and the
  `/_next/static` files that HTML names. The network always comes first; the copy is used
  only when the network cannot be reached. Opened offline at `/` or `/en`, where the
  installed app starts, it goes to today's copy.
- **Only those two screens.** `/perfil` and `/progreso` hold health data and weight
  history; `/plan` holds fourteen days of everything. None of them is needed in a shop.
  Today's screen does show the weight trend. That is accepted, because it is the screen the
  app opens on.
- **The copies are kept fresh.** They are stored on every full load of either screen, and
  the page asks for them again on every change of signed-in screen (at most once a minute)
  and as the app is put away (at most every five seconds). The page has to ask, because a
  client-side navigation never loads a document the worker could store.
- **A copy lasts as long as the session that made it.** It is dropped when either page
  answers with a redirect (the proxy sending a signed-out visitor to sign in). The page
  also drops it at sign-in, sign-up, sign-out and account deletion. A counter in the worker
  stops a refresh still in flight under the old session from storing anything afterwards.
- **The screen says when it is a copy.** A render that arrives more than two minutes old
  is a copy, and the screen says what time or day it is from and that nothing ticked is
  saved. It says the same whenever the browser reports no connection. When the connection
  comes back, the live screen loads once.
- **This is the one deliberate exception to `no-store`.** That invariant is about shared
  caches. Cache Storage belongs to this origin on this device, and is emptied along with
  the session. The API is never stored: the worker does not answer any request to `/api`.
- Registered in production builds only.

## Alternatives considered

- **A PWA plugin (Serwist, next-pwa).** It adds a dependency and a build step to generate
  what one file here does by hand. Its default is to precache the whole build, which is the
  opposite of keeping two screens.
- **Storing the API's JSON and rendering offline in the browser.** That means a second
  renderer for the same two screens, one that only ever runs without a connection, which is
  exactly when nobody is watching it.
- **Ticking offline and sending the ticks once the connection is back.** This is what
  people will ask for next. It needs either background sync, which Safari does not have, or
  a queue in the page, plus a rule for a list ticked on two devices. It is left for when
  someone asks.

## Consequences

- A copy is only as recent as the last time the app was open with a connection. A copy
  from yesterday shows yesterday as "today"; the notice says which day it is from.
- Meal illustrations come from the API and are not stored, so offline a meal shows without
  its picture.
- A browser may clear a site's storage under pressure. The copy is a convenience, never the
  only record of anything.
- Web push for the check-in, the rest of step 8.1, is not part of this change.
- Tested by loading the worker file itself into a sandbox with a fake cache, network and
  clock (`src/lib/offline.test.ts`). The tests check that:
  - the copy and its files are stored, and served when the network is gone;
  - every other screen, the API, and anything not a GET or from another origin are left
    alone;
  - every copy is dropped on a redirect, and a server failure keeps the last good one;
  - the app opens on today's copy offline;
  - refreshes are throttled;
  - a refresh in flight when the session ends stores nothing.

- Also checked in headless Chrome, against a production build and a throwaway development
  account that was deleted afterwards:
  - both copies were stored after a sign-in that reached today's screen by client-side
    navigation;
  - with the web server stopped, the shopping list opened from its copy and hydrated;
  - a client-side navigation fell back to the copy;
  - the app opened on today;
  - `/perfil` was left to fail;
  - a copy read ten minutes later carried its notice;
  - signing out emptied the copies.

  Not yet checked on a phone.

## Amended 2026-09-13 — the plan, today's recipes, and a menu that knows

Once the first version worked on the iPhone, the owner asked for more: "¿podríamos
ponerlo para todas las pantallas? O al menos modificar el menú para que solo aparezcan
las opciones sin conexión".

- **`/plan` is kept too.** It is fourteen days of meals, and holds no health data.
- **Meals' own pages are kept.** A meal's page (`/plan/comida/<id>`) holds its recipe
  and method, which is what gets read in a kitchen.
  - Every meal page read online is kept.
  - Each refresh fetches the pages of today's meals, once each.
  - A refresh drops the page of any meal the plan no longer has.

  Fetching all fourteen days' recipes on every refresh would cost some fifty renders for
  pages most people never open.
- **Offline, or when reading a copy, only what opens is drawn.** This follows the rule
  that a control that cannot be used is not drawn disabled; it is not drawn.
  - The menu shows only the screens with a copy on this device.
  - It hides the language switch and signing out, since both need the server.
  - A meal whose page has no copy is shown without its link.

  `components/OfflineProvider` answers "is this live, and what opens" for the notice, the
  menu and each meal.
- **Still not kept: `/perfil`, `/progreso`, `/check-in`.** They hold health data, and
  they are forms that cannot save without a connection. Drawing them offline would
  promise what they cannot do.

