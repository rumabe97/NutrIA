# Owner checks — 2026-10-09

> **Purpose**: every check left across projects 003, 010 and 004 that only the owner can
> make, gathered from each project's plan and log so nothing here is asked twice. Items
> already confirmed in a LOG are not repeated. **Audience**: the owner.
> **Written by**: an agent, documents only.

Three older projects are finished except for a handful of checks nobody but you can do.
This page puts them in one place, quickest first, so you can clear them in one sitting —
about 35–40 minutes of your own time, plus a one-line yes so an agent can read some data
for you.

## Do these four, in order

- [ ] **1. Confirm a bad picture can be taken back off a dish** — finishes part of
      *Project 010* ("the judge knows a dish's own form") — **2 minutes**
  - Sign in, open **Recetas** in the console (`/admin/catalogo`).
  - Find any row whose picture says **"Lista"** (not the ones marked "aceptada a mano")
    and click **"Revisar la imagen"**.
  - **Pass**: you see the dish's picture, its ingredients, and a **"Retirar"** button. You
    do not need to remove anything — the check is only that the way out exists. If a
    picture looks wrong while you are there, removing it is your call to make.

- [ ] **2. Say yes to an agent reading the picture-judge's production numbers** — unlocks
      the rest of *Project 010* — **1 minute of yours**
  - **Exactly what it would read**, and nothing else: which dishes ended up with no
    picture because the judge kept rejecting it; which individual attempts were rejected
    and why; which accepted pictures used the new "it's the dish's own bread, milk or
    pancakes" exemption (and the note that left); which pictures were accepted by you, by
    hand; and what each attempt's drawing recorded seeing. All of it already stored.
    Read-only: nothing is changed, written or deleted.
  - Why it needs your yes at all: it is production data, your customers' pictures and the
    judge's notes on them, even though reading it changes nothing.
  - The rule only allows this once "about 60 dishes have been drawn with the final rule,
    or 2026-10-15" is reached. As of the 2026-10-08 audit, about 62 had been drawn since
    the rule shipped (2026-10-01) — so it is very likely already met; nobody has
    re-checked since.
  - **Pass**: you reply "go ahead" for Project 010 phase 6. The read then happens on its
    own; check 4 below is what you do once it answers.

- [ ] **3. Walk the app in English** — closes *Project 003* ("trust, depth and polish") —
      **about 15 minutes**
  - Sign in. In the top bar, tap the two-letter language control and choose **EN**.
  - Walk through: **Home** (`/inicio`), **Plan** (`/plan`, then open one meal from it),
    **Shopping list** (`/compra`), **Profile** (`/perfil`), **Progress** (`/progreso`),
    **Check-in** (`/check-in`).
  - **Pass**: no Spanish text anywhere on those screens. Two things are correctly left in
    Spanish, not bugs — do not flag them: dish and cuisine names such as "Mediterránea"
    (they are data, not interface text), and one saved link on the landing page's address.
  - Ticking this also closes three other checks from the same project's plan that no
    longer apply, so nothing more is needed on them: the onboarding resume walk (those
    screens were rebuilt since), the visual design review (reworked twice since), and the
    automated end-to-end suite (it now runs on every change, in CI).

- [ ] **4. Decide what the picture judge's real numbers mean** — finishes *Project 010* —
      **about 20 minutes**, once check 2's answer is back
  - In **Recetas** (`/admin/catalogo`), open the handful of dishes the agent's answer
    names — the ones accepted through the new exemption. The console itself has no way to
    show you which pictures those are; that is why check 2 comes first.
  - For any dish the judge still blocks, retry its picture by hand from the same review
    screen (**"Reintentar"**) if you want a fresh attempt — it draws a new picture, which
    costs a little and counts toward the month's cap, and the judge may reject it again.
  - **Pass**: a short decision, written down, on each of four open questions — lactose,
    "may contain" labels, the tofu scramble, and dishes missing a main ingredient — change
    the rule, or leave it as it is.

## Not yet — Project 004, the dietitian workspace

Its own last check — invite a client, accept, review and publish a plan, set a target,
and end the link, done start to finish on a phone and a laptop — cannot actually be run
today. It needs a professional's practice to be open, and that only happens after a paid
subscription. Setting that up, even just in Stripe's test mode, is part of the payments
work you put off on 2026-09-25, alongside the go-live switch itself (the professional
flag, the live practice prices, the lawyer's sign-off). **Nothing to do here today — this
is a note, not a task.** When payments come back, the same check also covers the iPhone
walk from the phase before it, which was never recorded either: it is the fuller version
of the same path.

---

Total if you do all four today: **about 35–40 minutes**.
