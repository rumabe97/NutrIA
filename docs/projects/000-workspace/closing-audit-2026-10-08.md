# Closing audit — 2026-10-08

> **Purpose**: which of the older projects are finished, at the owner's request of
> 2026-10-08. Each project's PRD, PLAN and LOG were read; every phase not marked done was
> checked against `main` (d372ffc9 and later), the merged pull requests and the code.
> **Audience**: the owner and agents. **Written by**: an agent, documents only.

Classes:

- **A**: done, closed by this audit.
- **B**: done except a check only the owner can make. Not closed.
- **C**: truly open. Not closed.

## Summary

| Project                                | Class | Reason                                                                                                                                  |
| -------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 002 plan generation                    | A     | Phase 7's only open step, the end-to-end run on a throwaway database, has run in CI on every push since `dc9e9a57` (2026-09-09).        |
| 003 trust, depth and polish            | B     | All code shipped. Never recorded: the owner's walk through every screen in English (phase 5). Phases 2, 7 and 8 are superseded (below). |
| 004 dietitian workspace                | B     | All ten phases shipped (#82–#102). Never recorded: phase 9's human-verify. Go-live is the owner's and deferred with payments.           |
| 005 meal and season catalogue          | A     | All seven phases shipped (#109–#117), verified by the owner on 2026-09-26 (#124).                                                       |
| 006 realistic dish pictures            | A     | Phases 1–6 shipped (#127–#132). Both open checks were done on 2026-10-08.                                                               |
| 009 owner reviews rejected pictures    | A     | All three phases shipped (#172–#174). Phase 3 was confirmed by the owner on 2026-09-30.                                                 |
| 010 the judge knows a dish's own form  | C     | Phase 6, a read-only production review, has not run. Its gate is very likely met now. Phase 4's human-verify was never recorded.        |
| 013 traditional Spanish                | A     | Items 1–8 shipped in #187. Item 9 (start date) is superseded by project 015.                                                            |
| 014 a plate that weighs what it should | A     | Shipped in #188. Criterion 3 was measured and missed, then superseded by 016 and 017.                                                   |
| 015 a plan waits for its day           | A     | Both phases shipped (#189, #191). Two doc gaps of criterion 7 are closed by this change.                                                |
| 018 more accompaniments                | A     | All three phases shipped (#206, #207). The cuisine gap it handed on is fixed by #209.                                                   |

## Per project

### 002 — plan generation: A

- Phases 1–6 are ticked. Phase 6's human-verify was confirmed by the owner on 2026-09-07.
- Phase 7 was "blocked at the `owner-gated` step", which needed a throwaway `DATABASE_URL`.
  - Since `dc9e9a57` (2026-09-09), CI runs `pnpm --filter api test:e2e` on every push against a `postgres:17` container that dies with the job (`.github/workflows/ci.yml`, job `e2e`).
  - `generation.e2e-spec.ts` and `allergy-safety.e2e-spec.ts` are in `apps/api/test/`.
  - The suites' first run found a real gap in free-text allergies, fixed in `0052156e` (`0004` amended).
  - `ROADMAP.md` already lists 002 as delivered.
- PRD criteria 1, 3, 11 and 13 depended on phase 7. They are proven by those suites on every pull request.

### 003 — trust, depth and polish: B

- Phases 1, 3, 4 and 6 are ticked.
- Phase 8 waited on the end-to-end suites. They came in with `f4725b2b` (2026-09-07) and run in CI since `dc9e9a57`, as for 002. **Superseded.**
- Phase 2 waited on the owner's own pass through onboarding. It was walked mechanically on 2026-09-08, and onboarding was rebuilt in #139 (`0067`, 2026-09-28). The screens that gate described no longer exist in that form. **Superseded.**
- Phase 7, the design pass, waited on the owner's judgement. The design has since been reworked by the `apple-web-design` audit (2026-09-13) and the screens of every later project. **Superseded.**
- Phase 5 waited on the owner switching to English and walking every screen for Spanish left behind. `0040` (2026-09-10) changed how English is addressed, not the words, so this check still means something. **Owner-only, still open.**
- **What is left:** the owner signs in with English, walks the signed-in screens and reports any Spanish text. About 15 minutes. If they accept the three superseded gates and this walk, 003 can be closed.

### 004 — dietitian workspace: B

- Phases 1–8 are ticked.
- Phase 9 (#99) and phase 10 (#102) are merged. Phase 10 is "done-locally" only because its end-to-end proof was CI's.
- **What is left, the owner's:**
  - Phase 9's human-verify: invite, accept, review and publish a plan, set a target and end the link, on a phone and a laptop.
  - Go-live, deferred by the owner on 2026-09-25 together with payments: the lawyer's hour on `LEGAL-REVIEW.md`, Gemini out of the practice's generation, the Stripe practice product and prices, `STRIPE_PRACTICE_PRICES`, a grant from `/admin`, and the `professional` flag last.
- No code is missing.

### 005 — meal and season catalogue: A

- Seven of seven phases are ticked: #109, #110, #111, #112, #113, #114 and #117.
- Phase 7's human-verify was confirmed by the owner on 2026-09-26. #124 recorded "Project 005 is done".
- Left open, and not this project's: the OpenRouter DPA before the real launch.

### 006 — realistic dish pictures: A

- Phases 1–5 are ticked (#127–#131).
- Phase 6 went live on 2026-09-28 (#132). Its two open checks were completed by the lead on 2026-10-08:
  - **Week-1 spend.** 3.78 $ over 328 calls; 88 pictures ready, 0 failed; about 0.043 $ per served picture; October tracking to 3–4 $ against the 10 $ cap.
  - **C2PA on a served file.** One APP11/JUMBF segment with a c2pa claim, signed by the Google C2PA Core Generator Library.
- The calibration watch-list of phase 6 step 5 (noodles, horchata with nuts, free-from pairs) was not itemised in that evidence. Project 010 phase 6 reads the judge's answers in production and covers it.

### 009 — owner reviews rejected pictures: A

- Three of three phases are ticked: #172, #173 and #174.
- Phase 3 was confirmed by the owner on 2026-09-30 ("ya funciona todo"), recorded in #175.
- Left over, not blocking: a VoiceOver pass on the accept and remove dialogs on the phone, and `legal`'s five-minute lawyer question on `picture.accepted`.

### 010 — the judge knows a dish's own form: C

- Phases 1, 2, 3 and 5 are ticked: #176, #180, #177 and #181.
- Phase 4 shipped as #178 (2026-09-30). Its human-verify was never recorded: the owner opens a dish whose picture the judge accepted, in `/admin/catalogo`, and sees the picture and "Retirar".
- Phase 6 is real remaining work: a read-only review of the judge in production, then the owner looks at the pictures accepted through the exemption, retries what is still blocked, and decides on lactose, "may contain", the tofu scramble and `missing_main`.
  - Its gate is "about 60 dishes drawn with the final rule, or 2026-10-15".
  - On 2026-10-01, 26 pictures were ready, all drawn before the final rule. On 2026-10-08, 88 are ready. About 62 have been drawn since, so the gate is very likely met now.
- **Size:** small. One lead session reading production (no code), plus about 20 minutes of the owner's time.

### 013 — traditional Spanish: A

- The plan has one phase. Items 1–8 shipped in #187 (2026-10-01) with the gate, the end-to-end suites, the evaluator and the reviews green (LOG).
- Item 9, the start date (PRD criterion 8), was replaced by project 015, which offers the date always (#189, #191). The LOG's "uncommitted worktree" notes are stale: that work landed through 015.
- #209 later closed a gap in the same rule: a dish whose cuisine family is foreign (Turca, Cubana…) is refused.
- This change marks criterion 8 as superseded in the PRD, which 015's criterion 7 asked for.

### 014 — a plate that weighs what it should: A

- The plan has one phase, shipped in #188 (2026-10-01). Criteria 1, 2, 4, 5 and 6 are met (LOG, `0078`).
- **Criterion 3 was measured and missed.** The owner ran the read-only production simulation on 2026-10-02 (project 016, phase 0). With the flat 750 g ceiling, it gave 11/14 days in band on the whole library, below the 12/14 asked.
- That miss is why project 016 was reordered. 016 brought it to 13/14 on the same simulation, and 017 to 196/196 on the reference library. Criterion 3 is superseded, not met.
- The real-page phone check of the dry line (`/plan/comida`, `/compra`) was never recorded on its own. The feature has been in production since 2026-10-02 and 016 built on it.

### 015 — a plan waits for its day: A

- Phase 1 (#189) and phase 2 (#191) are both ticked, with migrations 0053 and 0054 reviewed.
- Criterion 7 asked for two docs that were missing:
  - project 013's item 9 marked superseded;
  - `ARCHITECTURE.md` naming the scheduled state.
    This change adds both.
- Handed on, not 015's: the migrate step sets no `lock_timeout` (P2 from phase 1's review).

### 018 — more accompaniments: A

- Status "delivered (2026-10-03)" and all three phases ticked.
- Phase 1's report `0009` and phase 2 came in with #206. Phase 3 is #207.
- Phase 3 handed on one item: `FOREIGN_CUISINES` lacked cuisine values such as "turca" and "cubana". #209 fixed it on 2026-10-03.
- Not looked into, and older than 018: `objetivo-bajo-3-comidas`, `patron-kosher` and `patron-sin-gluten` take no side at lunch or dinner.

## Also noticed

- `docs/ROADMAP.md` § Now is behind: it lists 006 as in progress and 010 as "planned, not started", and it does not list 011–019. This audit leaves it as it is.
