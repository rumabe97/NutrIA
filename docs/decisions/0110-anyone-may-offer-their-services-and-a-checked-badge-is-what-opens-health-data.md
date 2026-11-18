# 0110 — Anyone may offer their services, and a checked badge is what opens health data

> **Purpose**: one decision record (ADR). Captures the WHY that chat sessions lose.
> **Audience**: future agents and humans. **Committed**: yes. **Maintained by**: agents
> draft one immediately after any decision that constrains future work. ADRs are
> immutable: a changed decision is a NEW record that supersedes the old one.

- **Status**: accepted — supersedes
  [`0059`](./0059-a-professional-reaches-a-client-only-through-a-link.md) § 1 (a professional is a role the
  owner grants) once project 1 below ships; until then `0059` describes what runs
- **Date**: 2026-11-18
- **Deciders**: owner (every choice below: in his own words, by "lo apruebo todo" over the
  architect's recommendations, or by tapped options), agent
- **Project**: not yet planned — the six projects of
  [`0013`](../reference/architecture/0013-a-marketplace-of-professionals-2026-11-18.md) § 12

## Context

Project 004 built a workspace for a dietitian the owner grants by hand, who invites clients. The
owner, 2026-11-18: *«Quiero remodelar totalmente el apartado de profesionales. No quiero tener
que verificar su número, y no lo voy a pedir. Quiero que cualquier persona pueda promocionarse,
con los estudios que tiene, nota que le dan los usuarios, comentarios… Los usuarios van a poder
buscar profesionales… y contratarlo. El profesional tiene la opción de rechazarlo, y para ello lo
mejor creo que es un chat previo. Una vez contratado, pueden hablar entre ellos. Los
profesionales pueden tener horario. No se pueden tener dos planes, uno por la IA y otro
profesional… cada uno puede poner su propio precio.»*

Two reads were made before anything was planned, and both are the long form of this record: the
architect's `0013` (feasible on five conditions; nothing of 004 thrown away; six projects) and
the `legal` agent's [`2026-11-18-professionals-marketplace.md`](../legal/2026-11-18-professionals-marketplace.md)
(nine blocking findings, B1–B9; twelve questions for the lawyer's hour).

## Decision

**Who may offer, and what a badge is**

1. Anyone may open a practice and publish a profile: studies, price, opening hours. Studies are
   shown as declared by the person and not checked by NutrIA.
2. The title «dietista-nutricionista», and every other protected or clinical word, comes **only**
   from a badge. The badge is NutrIA's own check, never a typed number: the owner looks the number
   up in the college's public register, the app sends a code to the professional contact that
   register or the person's public practice shows, the check is recorded with its date, and it is
   repeated yearly. Manual first; a server-side lookup that grants only on an exact match is a
   later option, subject to the legal read of the registers' terms.
3. **An un-badged practitioner sees the plan they write for the client and the chat, and nothing
   else** — not weight, targets, adherence or check-ins, which are health data they have no basis
   to receive (legal B1). Illnesses and medication only ever reach a badged one, with consent.
4. Somebody who has declared an illness or a medication may send a request **only to a badged
   professional**.
5. The owner gives each new profile a first look before it appears. It is a look for spam and
   protected words, not a check of studies.

**Finding and choosing one**

6. The button is a **request**, not a contract. The contract and the payment are theirs, outside
   the app: each professional sets a price and charges by their own means. NutrIA moves no client
   money. A subscription charged to the professional stays as designed, and deferred.
7. The professional may refuse. Before acceptance each side may write **three messages within
   seven days**; no payment links. After acceptance, one chat between the two.
8. The directory is signed-in only and opens at ten published profiles. Public, indexed pages
   come last, after a custom domain.
9. Opening hours are shown. Nothing is booked.

**One plan**

10. A person has one plan: the AI's or the professional's. On acceptance the current plan stays
    until the professional publishes theirs (`0060` already replaces it); when the relationship
    ends, generation is the person's again.
11. A professional writes a plan with the generator and swaps, plus "put this dish here" from the
    library. **Never free text**: without ingredient ids there is no allergy gate. The same energy
    floor, bounds and gate as any plan.
12. The client may still swap; the professional sees it. The assistant stays on, explains the
    plan, and sends "why" and changes to the professional.
13. Being accepted by a professional does **not** make a client premium. Premium stays tied to a
    paid practice. A free practice holds ten active clients.

**The chat and the ratings**

14. The chat is checked only while it is open on screen, slowing and stopping when idle, with push
    and mail notices; no realtime service. No model reads it and nothing logs it. It can be
    reported, and NutrIA reads it only on a report. Both sides are adults.
15. When the relationship ends the chat is read-only for **30 days**, then deleted.
16. Only somebody accepted for fourteen days or more with one published plan may rate, within the
    window the law gives; the professional may reply; a comment can be reported, and is removed
    only on proof. The page says how reviews are checked. Ranking has a stated rule: badged first.

## Alternatives considered

- **A typed collegiate number, shown as unchecked.** Rejected on both reads: an unchecked number
  is worse than none.
- **An identity service, or an API of the colleges.** None found that checks a qualification;
  identity services check a face against a document, and cost money. The medical colleges have a
  lookup service; the dietitians' council has a public search page that says it is incomplete.
- **An un-badged practitioner seeing what a linked dietitian sees today, minus illnesses**, or
  the client choosing item by item. Offered; he chose the plan and the chat alone.
- **"Contratar" as a contract concluded in the app.** Offered; it brings pre-contract
  information, the withdrawal right and tax reporting to NutrIA, for money it never sees.
- **Stripe Connect.** Deferred with every other payment; and NutrIA may not move third parties'
  money itself.
- **Archiving the AI plan on acceptance** (the agent's first suggestion). Rejected by the
  architect: the client would have nothing to eat until the professional publishes.
- **One request and one reply before acceptance** (legal's preference), and **six months of chat
  after the end** (the architect's first figure). He chose three messages in seven days, and
  thirty days.

## Consequences

- `PRODUCT.md` excludes coach marketplaces from v1 and has to be amended before project 1.
- Texts that turn false the day a directory opens (legal B3): the sharing consent, «tu dietista»
  strings, the professional's agreement § 1, `0059` and PRD 004. They change in the project that
  makes them false, through the `legal` agent.
- The DPIA and the record of processing gain an addendum before the first profile (B9); DSA
  arts. 11, 12, 14, 16, 17 and P2B arts. 3–5 bind a micro platform and land with the directory.
- Project 1 reshapes `withClient`, the one audited path into a client's data. It is large for
  that reason and goes through the invariant reviewer.
- A forgotten polling tab is the way this takes production down: Neon suspends compute past its
  free hours. The chat's limits are a condition, not a tuning.
- Not decided here, and the owner's when their project is planned: how a reviewer is named, a
  second mark for a «Técnico Superior en Dietética», the anti-self-dealing rule for reviews,
  whether indexing is on by default.
- The lawyer's hour gains M1–M12 of the legal read (§ 7); VAT exemption and DAC7 go to a gestor.
