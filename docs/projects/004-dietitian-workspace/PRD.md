# PRD — Project 004: A dietitian runs their practice on it

> **Purpose**: what this project delivers and why — the product half of the contract.
> The plan must cover everything in here; the intent gate checks it.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: an agent via
> `/plan-project` — to be approved by the owner before the plan is written.
> Write repo-relative: no absolute paths, no references to other private repos.

- **Status**: draft — open questions answered by the owner 2026-09-23; awaiting approval
- **Roadmap item**: [`ROADMAP.md`](../../ROADMAP.md) § 9, *"A professional can run their
  practice on it"*.

## Problem

The product tells everybody with a recorded condition the same thing: *show this plan to a
professional*. That sentence has no second half. The professional it points to — a
dietitian-nutritionist with a consultation and thirty patients — has nowhere to stand in
the product, so the plan is shown to them as a screenshot on a phone, if at all.

Their side of the desk has its own problem, and it is the one this product already solves
for an individual:

- **Writing a fortnight of meals for one patient by hand takes most of an hour**, and it
  is redone at every visit. The arithmetic — targets, portions, a shopping list, keeping
  an allergen out of fourteen days — is exactly what `packages/core` does in seconds.
- **The plan leaves the consultation as a document.** A document cannot be swapped when
  the patient hates Tuesday's dinner, cannot be ticked off, and cannot say in three weeks
  whether it was followed.
- **Between visits the professional is blind.** Adherence, weight and how the fortnight
  felt arrive as the patient's memory of them, on the day of the next appointment.

Everything a patient needs is built: onboarding, the 14-day meal plan, swaps, the shopping
list, offline use, the check-in, progress. What is missing is the professional's seat: a
way to be *responsible for somebody else's plan* — set its targets, see it before the
patient does, and watch how it goes — without the product pretending to be the clinician.

There is also a plain reason to build it now: it is the first thing on the roadmap whose
customer pays for a working tool rather than for a convenience, and an individual's
premium (`0042`, `0056`) has yet to find its first subscriber.

## Outcome

When this ships:

- A professional has **their own workspace**: a list of their clients, each with where
  they are — invited, filling in the profile, plan awaiting review, plan under way,
  check-in due.
- A professional **invites a client by email**. The client accepts from their own
  account, reads exactly what the professional will be able to see, and agrees to it —
  or does not. Either side can end the link at any time, and access ends with it, at
  once.
- A professional **sets a client's daily targets** inside the same bounds the calculator
  obeys, and the client sees them marked as set by their dietitian, not by an estimate.
- A client's meal plan can be **generated and reviewed by the professional before the
  client sees it**: they can swap dishes and regenerate, and only then publish. A client
  with no professional keeps today's behaviour exactly.
- A professional **sees how it is going** without asking: meals eaten and skipped, the
  weight line, and every check-in, per client — and is told when a check-in arrives.
- The professional **pays a subscription**, per professional; their linked clients need
  pay nothing and get the paid allowances while the link lasts.
- Nothing about safety moved: allergies are still enforced in code, a medication still
  produces nothing, and **no health data and no professional's note ever reaches a model**.

## Scope

**In:**

- A **professional account type**, granted by the owner (as activation is today), never
  self-declared: the title is regulated, and a checkbox is not a credential.
- The **link between a professional and a client**: invitation, the client's explicit and
  versioned consent naming what is shared, revocation by either side, and what each side
  sees afterwards.
- **Delegated access with its own guard.** Today ownership is a `WHERE user_id = session`
  and nothing else. This project adds exactly one other way in — an active, consented link
  — as a named, audited path, and every denial stays a 404.
- **An audit trail** of what a professional read and changed in a client's data, visible
  to the client.
- **Supervised targets**: a professional's override, in the same `targetViolations`
  bounds, marked as theirs.
- **Review before publishing**: a meal plan state that the client does not see, with the
  professional's swaps and regenerations, and the act of publishing it.
- **The client overview**: adherence, weight, check-ins, the active meal plan and its
  history, read-only except for the two things above.
- **Notice of a check-in** to the professional, by the channels that already exist (mail,
  push).
- **Billing for professionals** on the Stripe integration that exists (`0056`): its own
  price, the owner trying it first in test mode, the same all-or-none rules.
- What the link grants the client: the paid allowances, for as long as it lasts.
- Spanish and English, the `/admin` view of professionals and links, the runbook, and the
  amendments to `PRODUCT.md` and `ARCHITECTURE.md` that a second kind of user requires.

**Out — explicit non-goals for this project:**

- A directory or marketplace where people find a professional.
- Messaging, video, appointments, an agenda, or invoicing the professional's own clients.
- Clinics: several professionals sharing clients, roles inside a practice.
- White-label, custom branding, custom domains.
- Dishes or recipes authored by the professional, and editing a dish's ingredients or
  grams by hand. v1 gives them targets, swaps, regeneration and the axes a swap already has.
- Condition-specific diets. The product still derives no dietary rule from a condition
  beyond `0008`, with or without a professional; what changes is who is looking.
- Clients without an account of their own (a record the professional keeps and prints).
  The loop — tick, swap, check in — is the value, and it needs the client in the product.
- Native apps, and anything sold through an app store.

## Acceptance criteria

1. An account becomes a professional only by the owner's act on `/admin`; no request body,
   sign-up field or client-side state can set it, and a test proves each.
2. A professional can invite by email; an invitation is single-use, expires, and reveals
   nothing about whether the address already has an account.
3. A client sees the list of what will be shared before accepting, and the accepted
   version is stored. Declining, or never answering, shares nothing.
4. Either side ends the link in one action. From that request onward every professional
   route for that client answers 404, proven by an end-to-end test that revokes mid-session.
5. Professional A cannot read, list or infer the existence of professional B's clients, or
   of any account not linked to them — by id, by email, or by timing of the invitation
   route. End-to-end, as `User A cannot read User B` is today.
6. Every read and write a professional makes on a client's data leaves an audit row the
   client can see: who, what kind of data, when.
7. A professional's targets pass the same `targetViolations` as a computed or self-set
   target; an out-of-bounds value is refused with the same sentence, and the client's
   screens say whose target it is.
8. For a linked client with review on, a generated meal plan is invisible to the client —
   dashboard, plan, shopping list, offline copies — until published, and visible to the
   professional. For everybody else, generation behaves as it does today, byte for byte
   in the existing end-to-end suites.
9. The professional's overview shows, per client and from stored state only: adherence of
   the current fortnight, the weight series, each check-in, and the plan history.
10. A client's check-in notifies their professional once, by mail or push, with no health
    detail in the message.
11. `apps/api/src/modules/ai` still imports nothing from the health modules, imports
    nothing from the professional modules, and a test asserts both.
12. Conditions, medications and supplements are visible to a professional only under a
    separate, explicit line of the client's consent; without it those sections are absent
    from every professional response, not empty.
13. A professional subscription opens and closes access to the workspace through the
    signed webhook alone; when it lapses, links pause, clients keep their accounts and
    their history on the free allowances, and nothing is deleted.
14. Deleting a client account removes the link, the audit rows about them and everything
    else, by cascade; deleting a professional account ends every link and leaves each
    client's data intact.
15. Every new screen exists in Spanish and English, passes the design review of `0057`
    (one primary action, 44 px targets, nothing by colour alone), and works at 320 px.
16. `pnpm turbo lint ts:check test`, `pnpm format`, `pnpm -w run deadcode` and the
    end-to-end suites are green, and `PRODUCT.md`, `ARCHITECTURE.md`, the payments
    runbook and the roadmap say what is now true.
17. A professional with 30 active links cannot send another invitation until one ends, and
    the refusal says why; a 14-day trial opens the workspace exactly as a paid subscription
    does and ends through the same signed webhook.

## Decisions

Answered by the owner on 2026-09-23. Each takes the proposal below unless it says
otherwise.

1. **Who is a professional** — the owner grants it by hand on `/admin` after seeing a
   collegiate number, which is **required**, not a declaration.
2. **The legal shape** — still open, and not the owner's to answer alone: a lawyer's hour on
   controller/processor and the professional's agreement **before launch**. It changes copy
   and a consent version, not the architecture, so it does not block the plan; the plan
   carries it as an owner-gated step before release.
3. **Clients have their own account** — yes, as proposed.
4. **Conditions and medications** — visible only under a separate, explicit consent line
   (criterion 12); never to a model.
5. **Review before publishing** — on by default for each link, switchable per client by the
   professional.
6. **The price** — a flat monthly fee per professional with a ceiling of **30 active
   clients**, and a **14-day trial** through Stripe. The fee itself lives outside this file.
7. **A linked client pays nothing** and has the paid allowances while the link lasts.
8. **After a lapsed or ended link** the client keeps the account, the history and the last
   published meal plan, on the free allowances.
9. **Printable meal plan** — out of v1, the first thing after.
10. **The words** — the workspace is `/consulta` and the people in it are **pacientes** in
    Spanish (the vocabulary of a regulated health profession); `/practice` and **clients**
    in English. The client's side says *tu dietista* / *your dietitian*.
11. **"Not a user"** — the line in `PRODUCT.md` stays where it is for v1 (diagnosed
    metabolic disease, pregnancy, eating-disorder recovery, paediatric feeding); only the
    supervision notice changes its wording when a professional is linked.

## The questions as they were asked

1. **Who may be a professional, and how is it checked?** Proposed: the owner grants it by
   hand after seeing a collegiate number, as accounts were opened by hand at the start.
   Is that acceptable for the first ten, and is a collegiate number required or only a
   declaration?
2. **The legal shape of the data.** With a professional in the loop, who is the controller
   of a patient's health data and who the processor, what agreement the professional
   signs, and whether the current consent text covers sharing. This needs a lawyer's hour
   before launch; it changes copy and a consent version, not the architecture.
3. **Do clients need their own account?** Proposed yes (see Out). The cost: a professional
   whose patients will not install anything cannot use v1. Is that the right first
   customer to lose?
4. **May a professional see conditions and medications?** Proposed: only under a separate
   consent line (criterion 12). The alternative — never — is simpler and makes the
   professional's review less informed.
5. **Is review-before-publish mandatory, optional per client, or optional per
   professional?** Proposed: on by default per link, switchable by the professional.
6. **The price's shape** — one flat fee with a ceiling of clients, tiers, or per active
   client — and whether there is a trial. The numbers live outside this file.
7. **What a linked client pays.** Proposed nothing, with the paid allowances while linked.
   The alternative is that the professional's fee covers only the workspace.
8. **What a client with a lapsed or ended link keeps.** Proposed: the account, the history
   and the last published meal plan, on the free allowances.
9. **Whether a printable meal plan belongs in v1.** A print stylesheet is cheap and
   professionals hand paper across a desk; it also reopens "the plan leaves as a
   document". Proposed: out of v1, first thing after.
10. **The words.** The route and the name of the workspace in Spanish and in English
    (`/consulta`? `/profesional`?), and what a client is called on screen — *paciente* or
    *cliente* — which is a legal connotation as much as a tone.
11. **`PRODUCT.md`'s "not a user".** With a professional responsible for the plan, do
    people the product turns away today become users of a supervised account, or does
    the line stay where it is for v1? Proposed: it stays; only the supervision notice
    changes its wording when a professional is linked.
