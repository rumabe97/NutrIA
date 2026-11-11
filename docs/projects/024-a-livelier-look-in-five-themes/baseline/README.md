# Baseline — the controls of each screen, by machine

208 files written by `.claude/skills/local-probe/scripts/baseline.mjs` on 2026-11-11 against a
production build of the web app and the local API, before any screen changed. Each holds every
heading and every interactive element of one route, by role and accessible name, sorted, with
digits replaced by `#`:

`<route>.<state>.<locale>.<view>.txt` — states `public`, `noplan`, `plan`, `admin`; locales
`es-ES`, `en-GB`; views `phone` (390 px) and `desktop` (1280 px).

**How to use it.** Run the script again with the same arguments into a scratch folder and diff
the two. A line that is gone is a control somebody lost, or a rename to explain in `../LOG.md`.
Run twice in a row on the same build, the output is identical.

**What it cannot see.**

- Lines carrying a dish's name differ from one generated plan to the next. Compare those by
  shape, not by text.
- It reads the accessibility tree: text, pictures and structure are the inventory's.
- Not captured: the professional's screens (the probe's `link` step failed and has to be fixed
  before phase 6), onboarding's steps, a dish page reached from history, the dialogs and menus
  that only exist once opened, and offline. Those rest on `../inventory/` alone until then.

**To reproduce.** Local Postgres, `RATE_LIMIT_MAX=100000` exported before `servers.sh start` (on
localhost every account shares one rate-limit bucket, and a 429 on `/users/me` reads as a 404),
the `assistant` switch on, probe accounts made by `account.mjs` (one plain, one with a generated
plan, one admin with a second factor), then `baseline.mjs --out … --state … --paths …` per state.
