# Roadmap

> **Purpose**: where the product is going, at milestone level. Projects are born here:
> each milestone becomes one or more projects under `docs/projects/`.
> **Audience**: humans and agents. **Committed**: yes. **Maintained by**: owner and
> agents together — agents propose reordering when reality diverges, the owner decides.

## Now

**Milestone: a user receives a real 14-day plan.**

The milestone is met, and has been in production since 2026-09-07.

*Delivered:*

- [`001-workspace-kickoff`](./projects/001-workspace-kickoff/) — landing page,
  authentication, the ten-step onboarding, the profile, computed daily targets, the
  allergy validator, the full schema, and the NestJS foundation.
- [`002-plan-generation`](./projects/002-plan-generation/) — confirmed working end to
  end by the owner against a live database and a real AI provider. Its first
  end-to-end run found a real safety gap in free-text allergies, fixed in `0004`'s
  amendment.
- [`003-trust-depth-and-polish`](./projects/003-trust-depth-and-polish/) — all eight
  phases, logged 2026-09-07: overridable targets, onboarding that resumes and is
  enforced server-side, a deeper profile (free-text allergens, conditions, medications,
  supplements), English throughout, and a design pass.

The end-to-end suites stand at 14 suites and 88 tests, run against a throwaway database
with a scripted model (`apps/api/test/README.md`), and on every pull request against a
Postgres container that dies with the job.

Nothing here is blocked on the owner any more. The environment this section used to
list as missing — a Neon project, a session secret, the migration, the seed, an AI
key — has been in place since 2026-09-07, and `docs/reference/deployment.md` is where
that setup lives now rather than here.

## Next

1. **A user can live inside the plan.** Day navigation, meal detail with recipe and macros
   (done), favourite / dislike (done, `0014`), meal replacement (done, `0015`: library first,
   five a plan, list rebuilt), complete / skip (done, `0016`), the quicker / no cooking /
   more protein and vegetarian axes on a swap (done, `0022`). Cheaper waits for a price per
   ingredient.
2. **A user can shop from it.** Done: consolidated list per plan, grouped by aisle, editable,
   rebuilt on every swap, always matching the active plan.
3. **The loop closes.** Weight tracking (done), eaten / skipped on each meal (done, `0016`),
   the fortnightly check-in feeding the next plan (done, `0018`), a progress screen over
   the data already kept (done, `0020`), plan history, read-only (done, `0021`).
4. **Settings and notifications.** Preference editing outside onboarding (done, from the
   profile), password-reset mail (done, `0019`), the check-in reminder and its switch
   (done, `0027`), the owner told when an account is waiting (done, `0029`). Remaining:
   verification mail (done, `0030`) and any further reminder that can argue for itself.
   Opening access to everyone is now one switch: with automatic activation on, confirming
   the address opens the account (`0031`, amended); off, an admin turns the key.

## Next, in this order

Seven things the owner asked for on 2026-09-10, analysed against the code and
reordered by what each unblocks. The order is a recommendation; the owner decides.

Four are delivered. Of the two that remain, one is recommended against, which leaves
**premium** — and its own entry says what it waits on: something worth paying for and
something that says what people miss. Both now exist, so what it really waits on is
somebody using the second. The feedback box shipped on 2026-09-10, and what it has
gathered since is the input this decision wants: choosing what to charge for is the
most expensive guess on this page to undo, and `/admin` is where to look before
making it.

### 1. A meal may be marked only once it could have been eaten — done

**A bug, and it puts wrong data where the next plan reads from.**
`PlanRepository.setMealStatus` checks that the plan is active and nothing else, so
tomorrow's dinner can be marked eaten today. Adherence is built from those marks,
and the check-in feeds them to the next fortnight.

The rule that is actually wanted: a meal may be marked up to and including today,
never in the future. Marking yesterday's lunch this morning is somebody catching
up, which is legitimate and common.

Small: one clause in the statement, one refusal, one end-to-end test.

### 2. Which meals somebody eats, and how big each one is — done (`0036`)

**Two of the owner's items, and they are the same change.** People who do not eat
breakfast cannot describe themselves today: `slotsFor(mealsPerDay, includesSnacks)`
takes the *first* N of breakfast, lunch, dinner — so "two meals" always means
dropping dinner, never breakfast. And `slotBudgets` splits the day by a **global**
`SLOT_WEIGHT` per slot, so "I eat lightly at breakfast" has nowhere to live.

Both are answered by replacing "how many meals" with **a set of slots and a weight
each** — the shape of somebody's day rather than a count of it. The scheduler needs
no change at all: `slotBudgets` already normalises over whatever weights it is
handed, so a lighter breakfast redistributes to the rest for free. What changes is
onboarding, the profile, and one column.

The onboarding question stops being "how many meals a day" and becomes "which of
these do you eat, and how big is each" — which is also a better question.

### 3. A box for what people think — done (`0037`)

Cheap, and it starts collecting signal the day it ships. A table, a form, a section
on `/admin` next to the funnel. It is listed third rather than last because
everything after it is a guess until somebody writes in.

### 4. A tour of what is already here — done (`0038`)

The owner's own diagnosis: people do not know what the product does. Shown once to
everyone — existing accounts included — and replayable from the profile, which means
a `tour_seen_at` rather than browser storage: a tour that reappears on a second
device is worse than one nobody sees.

Five stops, and the choice of which five is the whole feature: the plan exists, a
dish can be changed and you can say how, the meals of a day can be shaped (`0036`,
which is why this came after it), a trip pauses the fortnight, and the check-in is
what makes the next one fit better. The shopping list and the progress chart are
out — they are in the navigation bar with their own names, and a tour that reads
out the menu is one nobody finishes.

### 5. Premium — the entitlement half is delivered (`0042`), switched off

The honest line is the one that costs money: **AI generations beyond a free
allowance**. That half is built and in production, off: `user.tier`, allowances
per tier, granted by the owner from `/admin`, behind a `premium` flag that
outranks the column so turning the tier off is one click. Recorded as
[`0042`](./decisions/0042-what-a-paid-account-may-spend.md).

What remains is taking money, and most of it is not code: a Stripe account, tax
registration, the legal pages a subscription needs. The order, and which steps an
agent can do, are in [`docs/reference/payments.md`](./reference/payments.md).
Stripe's test mode needs nothing but an email address, so the code can be built
and exercised before any of the business setup exists.

### 5b. A day that eats for something — done (`0043`)

A user's request, relayed by the owner: add the race, or the long session, and
let the days before it eat for it. An event is a name, a date, one to three days
before, and per macro *up / down / same* — never an amount; the size is one
constant in code. Applied at the next generation; the plan day remembers what it
was built to. In-place rescheduling of a live fortnight, the days after,
recurring events and per-type suggestions are deliberately later.

### 6. Advertising — recommended against

Two reasons, and the first is arithmetic. Display advertising in this niche pays
roughly one to five euros per thousand impressions. Covering even a small monthly
model bill needs six figures of impressions a month, which needs tens of thousands
of active people. At any scale this product will see in the next year, ads pay
cents.

The second is what it would cost. This is a health product: the pages that would
carry the ads are the ones showing somebody's allergies, their weight and their
conditions. An ad network's script in those pages hands a third party the context
to infer all of it, and health data is a special category under GDPR Article 9 —
consent for that is not a banner. Every deliberate decision in this codebase runs
the other way: the browser never holds a database connection, the admin screen
cannot read anybody's food, an analytics event carries no content.

Premium sells the thing that costs money to the people who value it. Advertising
sells the people.

## Later / someday

- Admin: generation monitoring and failure review are done (`0028`, `/admin`). Safety-flag
  triage has no flags to triage yet; catalogue management is a seed file in git, which is a
  better place to edit a catalogue than a form.
- English alongside Spanish: done — both dictionaries at parity, recipes bound to a locale
  with reuse scoped to it, catalogue names in both, mail in both, and an end-to-end suite
  proving an English account gets an English prompt, plan and shopping list.
- Country-aware ingredient availability: done (`0034`) — an ingredient may name where it is
  sold, a plan is built only from what the person can buy, and a country nobody stated
  filters nothing. What remains is catalogue work: a British shelf to offer *instead* of the
  thirty Spanish rows a British account no longer sees.
- Vacation mode: done (`0032`) — a trip pauses the plan and the days after it move with it,
  so nothing counts as skipped and the fortnight resumes on return. A generated plan *for*
  the trip is deliberately not built: it costs a model call per trip, and the question it
  answers is not the one people were asking.
- Analytics: done (`0033`) — a funnel counted from state, so it is right for the accounts
  that predate it, and exactly two events for what leaves no row: a session started and the
  axis a swap was asked for. Cohorts and anything needing a browser-side beacon are
  deliberately not built.
- CI: done. The gate and the end-to-end suites both run on every push and pull request
  (`.github/workflows/ci.yml`); the suites get a Postgres container that dies with the job,
  so they need no secret and no shared branch. A ruleset on `main` makes both required, so
  a red run blocks the merge. The gate also runs `format` and `deadcode`, which had each
  been failing unnoticed for months — an advisory check is how that happens.
- Error visibility: done (`0024`). Set `SENTRY_DSN` on the API project to turn it on; unset,
  nothing is sent.

## Last, and deliberately so

**The assistant.** Nutrition-scoped, context-efficient, with the medical boundaries in
`PRODUCT.md` enforced rather than requested.

It sits at the end of this file, not because it is the least valuable — it may be the most
— but because of what it costs. Every message a user sends is a model call, on the same
free-tier daily cap that plan generation needs, and unlike generation it has no ceiling: a
plan is one call a fortnight per person, a conversation is as many as they feel like. Until
there is billing, shipping it would mean choosing between answering a question and building
a plan.

Two things to settle before writing any of it, both of them harder than the plumbing: what
it refuses to answer and how that refusal is enforced in code rather than asked for in a
prompt (`0004`); and what it is allowed to read, given that everything it could usefully
know about someone is health data.
