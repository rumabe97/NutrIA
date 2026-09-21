---
name: local-probe
description: Look at a web change in a real Chrome before it ships - a production build of apps/web against the local API, at 320, 390 and 1280 px, light and dark, with a throwaway account for the signed-in screens. Use after changing any screen, component, stylesheet or dictionary in apps/web or packages/ui, when the owner asks how something looks, or to reproduce something seen on a phone.
argument-hint: "[paths to open, e.g. /acceder,/perfil]"
---

# Local probe

A production build of the web app and the local API, opened in a real browser, with
nothing leaving the machine: no mail, no model call, no production database. Paths to
open, if the caller gave any: `$ARGUMENTS`. Otherwise, the screens the change touches —
in both languages when a dictionary changed.

Everything below runs from the repository root. `PROBE_DIR` is your **scratchpad
directory**: logs, screenshots, the session cookie and the browser driver all live there,
and none of them belongs in the repository.

```bash
export PROBE_DIR="<your scratchpad directory>/probe"
S=.claude/skills/local-probe/scripts
```

## 1. Start

```bash
sh $S/servers.sh start            # builds both; about two minutes
sh $S/servers.sh start --no-build # only when nothing changed since the last build
```

It refuses if ports 3000 or 3001 are taken, or if `apps/api/.env` points at production.
It starts the API first and builds the web app against it, on purpose: the sign-in pages
ask the API which provider buttons to draw while they prerender.

To see something that needs configuration — the Google and Apple buttons, say — export
**placeholder** values before `start`; they reach the API. Never a real secret on a
command line. For Apple's key: `openssl ecparam -name prime256v1 -genkey -noout | openssl
pkcs8 -topk8 -nocrypt`, written to the scratchpad.

## 2. The browser driver, once per scratchpad

```bash
npm install --prefix "$PROBE_DIR" --no-save playwright-core
```

It drives the Chrome already on the machine (`CHROME_PATH` to name another), so nothing
is downloaded. `probe.mjs` says so itself when the driver is missing.

## 3. Look

```bash
node $S/probe.mjs --paths /acceder,/en/acceder                    # public pages
node $S/probe.mjs --paths /perfil --views phone --schemes light   # narrower, faster
```

Each line is one page in one viewport and scheme: the status, where it landed if it was
redirected, how far it scrolls sideways, and its `h1`. It exits 1 on a 4xx/5xx, on any
sideways scroll, or when the page throws.

`hint:` lines are for you to judge, not to obey. A control under 44 px on a touch viewport
may have its target elsewhere — a switch's row is what gets pressed — and the probe already
counts a wrapping `<label>` and a pseudo-element that grows the target (`0057`).

**Then open the screenshots** in `$PROBE_DIR/shots` with the Read tool. A green line says
the page fits; it does not say the page is right. Look at the narrow one and the dark one
first — that is where things break.

## 4. The signed-in screens

```bash
node $S/account.mjs create "$PROBE_DIR/cookie.txt"
node $S/probe.mjs --paths /inicio,/plan,/perfil --cookie-file "$PROBE_DIR/cookie.txt" --dismiss
```

The account is signed up through the API, opened and walked through onboarding the way
`apps/api/test/harness.ts` does it — when an onboarding step changes there, change it in
`account.mjs`. `--dismiss` presses Escape: a new account opens the welcome tour, which
sits over everything. The account has **no meal plan**; with `AI_PROVIDER=stub` generating
one yields nothing worth looking at, so a plan screen needs the owner's dev account, and
the owner's word.

## 5. Always finish

```bash
node $S/account.mjs delete "$PROBE_DIR/cookie.txt" && rm -f "$PROBE_DIR/cookie.txt"
sh $S/servers.sh stop
```

Both, even when the probe failed half-way — especially then. `stop` only kills what is
listening on 3000 and 3001 and looks like Node, and says so when it does not.

## What this cannot tell you

- **Offline.** Playwright's `setOffline` does not flip `navigator.onLine` here. Stop the web
  server to fake a lost network, and shift `Date.now` with an init script to fake time.
- **The first visit.** A flow that signs in and then navigates has warmed everything up.
  To test what a first visit stores, sign in in one context, copy its cookies into a fresh
  one, open the screen once and do not navigate. The offline worker passed the warm test
  and stored nothing on the owner's iPhone (`0053`).
- **A provider's round trip.** The button can be followed as far as Google's own page; the
  exchange needs real credentials. `apps/api/test/social-sign-in.e2e-spec.ts` covers what
  comes after it.
- **An iPhone.** Safe areas, the home-screen app and web push are only real on the device.
  Say so in the report when a change touches them; the owner tests on one.

## Report

What was opened and at which sizes; what the lines said; what the screenshots showed that
the lines could not; every hint you judged, and how. That the account is deleted and the
servers are stopped.
