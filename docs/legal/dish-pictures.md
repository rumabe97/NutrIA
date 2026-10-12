# The dish pictures (project 006): the AI Act, consumer law, privacy and texts

> **I am not a lawyer.** This is the analysis one would do, with every conclusion tied to
> the article or official document it rests on, so that the owner — or the lawyer he shows
> it to — can check it. What depends on an interpretation is marked **[lawyer]** and
> collected in § 7.
>
> **Purpose**: decide what label the dish pictures carry, what machine-readable mark is
> needed and what changes in the policy, the record and the DPIA, and leave the texts ready
> to paste. **Audience**: the owner, the lead, `frontend` and `backend`.
> **Committed**: yes. **Maintained by**: the `legal` agent.
>
> **Cut-off date**: 2026-09-27. **Read**: the draft PRD
> `docs/projects/006-realistic-dish-pictures/PRD.md` (the lead's branch, unmerged), report
> [`0003`](../reference/architecture/0003-dish-pictures-2026-09-26.md), the code of `main`
> at `7b28c5d` and that of the lead's branch at `4d48a1a`
> (`apps/web/src/app/(app)/plan/comida/[id]/page.tsx:124-136`,
> `apps/web/src/components/NextMeal/NextMeal.tsx:56-62`,
> `apps/web/src/components/DishPicture/DishPicture.tsx`), and the 2026-09-27 pilot's
> script, which lives outside the repository (`docs/local/`, in `.gitignore`).
>
> **Revision 2026-09-27 (afternoon)**, with two facts from the lead: (1) **measured**: the
> 8 Gemini pictures received through OpenRouter carry the C2PA manifest signed by Google
> and the XMP IPTC `trainedAlgorithmicMedia`, and they are stored and served untouched;
> (2) **decided by the owner**: MAI-Image-2.6 is out, Gemini on Vertex only. §§ 0, 1.2,
> 1.5, 2, 4, 5 and 7 change; what is written about MAI stays as the reason for the
> decision.
>
> **Revision 2026-09-30 (project 009, phase 2)**: a picture the judge rejected is no longer
> always thrown away; the last one of a failed drawing is kept privately for the owner to
> look at ([`0072`](../decisions/0072-a-rejected-picture-waits-for-the-owner.md), which
> amends `0066`). § 4.1 changes (one row and one bullet), § 5 (IMG-10 and IMG-11), § 7 (d)
> and the sources, and §§ 1.6 and 4.3 are new. This revision **has** been read against the
> code: the working tree of `main` over `abc0a90`, uncommitted; what it says is true once
> merged as it stands. Phase 2 only: accepting a picture against the judge and withdrawing
> it are the next revision.
>
> **Revision 2026-09-30 (project 009, phase 3)**: the owner can **publish by hand** a
> picture the judge rejected, and **withdraw** one it accepted that way (`0072`, the two
> doors). § 0 changes (point 8), § 1.6 (the fact and the closing), § 4.1 (the "Store"
> row), § 4.2 b (**`/privacidad`'s sentence about the judge changes**), § 4.3 (the quote,
> two rows and two bullets), § 5 (IMG-2 and IMG-10, and new IMG-12 to IMG-16), § 7 (e, f)
> and the sources; §§ 1.7 and 4.4 are new. **Read against the code**: the working tree of
> `main` over `fce954d`, uncommitted (core and API), and `frontend`'s tree in
> `.claude/worktrees/frontend-009-3`, also uncommitted (the web app and the dictionaries).
> This revision's line numbers are from those two trees; what it says is true once they are
> merged as they stand.
>
> **Revision 2026-09-30 (project 010, phase 3)**: each dish's row keeps what the judge
> answered on every attempt, with the recipe as it was judged. § 4.1 changes (the judge's
> row), § 4.3 (two rows), § 4.4 (one sentence) and the sources; § 4.5 is new. **Read
> against the code**: the tree `.claude/worktrees/backend-010-3` over `f81e834`,
> uncommitted; this revision's line numbers are from that tree.
>
> **Revision 2026-09-30 (project 010, phase 4)**: "Withdraw" works for **any published
> picture**, whether the judge or the owner accepted it by hand (PRD 010, criterion 9;
> `0073`; the owner's answer to question 4 of report `0006`). IMG-16 closes. § 4.2 b
> changes (the sources comment only, not the published text), § 4.4 (the entry, one row of
> the files that can be left, the trail and the console's texts), § 5 (IMG-2, IMG-14 and
> IMG-16) and the sources. **Read against the code**: the tree
> `.claude/worktrees/phase4-010` over `8e9ca114`, uncommitted, which carries phase 4 and
> **not** 010's phase 2 (the judge's rule): nothing said here depends on that rule. The
> line numbers marked "phase 4" are from that tree. **Merged in `28854ac` (#178)** and
> deployed, per the lead (I have not checked the deployment myself). Checked on 2026-09-30
> that the central lines match in `main`: `RecipeRepository.ts:1041` (`status = 'ready'`),
> `RecipeController.ts:795-800`, `Audit.ts:72-74` and `DishPicture.ts:102-104`.
>
> **Revision 2026-09-30 (project 010, phase 2)**: the rule by which the judge accepts a
> picture changes: the form the dish already has, or that its name says, stops counting as
> an extra food
> ([`0073`](../decisions/0073-a-dishs-own-form-is-not-an-extra-food.md)). § 4.2 b changes
> (a dated reading of the judge's sentence in `/privacidad`: **it still stands, with a new
> exception the sentence does not state; P2, the owner's decision**), § 4.3 (the notes'
> row), § 5 (IMG-2, a third path), § 7 (g) and the sources; § 4.6 is new. **Read against
> the code**: the working tree of `main` over `28854ac` (phase 4 already in), uncommitted
> (`packages/core/src/domain/DishPicture/judge.ts`, the new `forms.ts` and their tests);
> this revision's line numbers are from that tree. **Re-read on 2026-09-30 after the rule
> was tightened** as the first invariant review asked (the form word is excused only if
> everything else in the name belongs to the dish; a catalogue product with a name of its
> own is not excused; a negated or ambiguous title does not name the form): the description
> and the figures of § 4.6 and of IMG-2 change; **the reading of `/privacidad`'s sentence
> does not**. The 1,158 tests of `packages/core/src/domain/DishPicture` pass in that tree
> (run by `legal`).
>
> **§§ 0 to 4.2 were written before the feature existed.** What they say about the product
> comes from the PRD, the report and the pilot, and checking it against the built code is
> still pending in § 6's list, except where that list names its source.

## 0. Summary

1. **Dates: there is no grace period.** Art. 50 of the AI Act applies from **2/8/2026**.
   The Omnibus's four months (to 2/12/2026) only cover systems placed on the market
   **before** that date. The pictures are put into service when the flag is switched on, so
   the whole of art. 50 applies to them from day one (§ 1.1).
2. **NutrIA is the provider and the deployer** of the system that draws the dishes. Google
   is the model's provider. The machine-readable marking (art. 50.2) is NutrIA's
   obligation, though it may rely on the one the models already apply (§ 1.2).
3. **A realistic photo of a dish is, in all likelihood, a "deepfake"** per the Commission's
   guidelines of July 2026 **[lawyer]**. That is why every picture must carry a visible
   notice **everywhere** anybody sees it, the console's card included (§ 1.3). The texts
   are in § 3.
4. **Gemini brings both layers of mark**: the C2PA manifest signed by Google and the
   SynthID watermark. **Measured on 2026-09-27**: they arrive through OpenRouter (8 of 8).
   MAI-Image-2.6 brought none documented and **the owner has removed it**: Gemini only
   (§ 2).
5. **Re-encoding to WebP with `sharp` would strip the C2PA.** That is why the files are
   stored and served exactly as they arrive (§ 2.3). All that is left is validating the
   signature once with a C2PA tool (P3).
6. **Privacy**: the model that draws receives no personal data at all. Google is therefore
   not a recipient in the sense of art. 13 GDPR. Even so it has to be named, because the
   policy promises that no provider trains on what we send it. A sentence in force that
   today says "never Google's services" also has to be narrowed, and Vercel's line widened,
   since it now serves the pictures too (§ 4).
7. **Consumer law**: the picture is not the plate the person is going to cook. The label
   says so ("indicative"), and the terms of use gain a sentence (§ 3.3).
8. **Two doors** (009 phase 3): a picture reaches a person either because the judge
   accepted it or because the owner accepted it by hand, against the judge, having seen the
   flagged allergens. For the AI Act nothing changes: the same file with its C2PA, the same
   "IA" mark and the same caption (§ 1.7). Risk IMG-2 changes, from depending on a model to
   depending on a recorded decision (§ 5), and **a published sentence of `/privacidad`
   changes** (§ 4.2 b), which is the owner's decision.
9. **The dish's own form** (010 phase 2, `0073`): the judge's rule stops counting as an
   extra food the form the dish already has or that its name says. It is a third path to
   IMG-2, measured and bounded: it deliberately accepts a second food of that form (a glass
   of milk beside a curry made with coconut milk). `/privacidad`'s sentence about the judge
   **still stands, but it does not describe that class**: P2, and the owner decides whether
   to take a one-line clause (§ 4.6). There are no new personal data and nothing changes
   for the AI Act.

---

## 1. The AI Act (Regulation (EU) 2024/1689, amended by 2026/1744)

### 1.1 From when

- **Art. 113**: the Regulation "shall apply from 2 August 2026", with exceptions that do not
  affect art. 50.
- **Art. 111.3**, added by Regulation (EU) 2026/1744 (OJ L of 24/7/2026, in force
  27/7/2026): "Providers of generative AI systems subject to Article 50(2) that have already
  placed their systems on the market before 2 August 2026 shall have four months from that
  date to adapt their practices". Recital 38 calls it a "four-month transitional period". It
  covers **art. 50.2** only, and only systems already placed on the market before 2/8/2026.
- **The Commission's guidelines on art. 50** (C(2026) 5054 final, 20/7/2026), point 153: "a
  targeted grandfathering rule only with regard to the marking and detection obligations
  under Article 50(2) AI Act for generative AI systems placed on the market or put into
  service before 2 August 2026". And point 154: what was generated before 2/8/2026 is not
  marked retroactively.

**Applied here.** `0010`'s illustrator was never switched on in production: it only worked
with `AI_PROVIDER=google` and `AI_ILLUSTRATIONS=true` (see
[`analysis.md` § 1.3](./analysis.md#1-what-the-product-does-what-i-read-not-what-the-documents-say)).
006's system, with other models, another client and another store, is put into service when
the owner switches the flag on, after 2/8/2026. **Arts. 50.2, 50.4 and 50.5 apply the very
day it is switched on.** That answers the question in report `0003` § 9 ("whether v2 counts
as a new system": yes; and even if it did not, v1 was not placed on the market before
2/8/2026 either).

### 1.2 Who is who

| Actor | Role | Why |
| --- | --- | --- |
| NutrIA (its owner) | **Provider** of the AI system that generates the pictures | Art. 3.3: "develops an AI system […] and places it on the market or puts the AI system into service under its own name or trademark". NutrIA builds the system (prompt, client, judge, retries, store) and puts it into service under its own brand. The guidelines, point 11: the example of the company offering "a generative […] AI application (e.g. […] image generator […]) on the Union market under its own name" |
| NutrIA | **Deployer** | Art. 3.4: "using an AI system under its authority". It decides to publish the pictures and how to show them. The guidelines, point 12 |
| Google (Gemini 3.1 Flash Lite Image, on Vertex). Microsoft (MAI-Image-2.6) left on 2026-09-27 | Provider of the general-purpose **model** (chapter V) | Art. 50 does not apply to them for the models (the guidelines, point 27), but their mark "at model level" helps the downstream provider comply (recital 133; the guidelines, point 74) |
| OpenRouter | A technical intermediary routing the request | It neither develops the system nor puts it into service under its brand. No art. 50 obligations for this output |
| The person who sees the dish | An exposed person | The addressee of the notice (art. 50.5; the guidelines, point 141) |

The guidelines, point 74: the provider may rely on the mark applied by the model's provider
"without prejudice to the responsibility of the provider of the AI system to demonstrate
compliance with Article 50(2) AI Act". **The responsibility stays NutrIA's.**

### 1.3 Is it a "deepfake"? Yes, in all likelihood **[lawyer]**

Art. 3.60: "AI-generated or manipulated image […] content that resembles existing persons,
objects, places, entities or events and would falsely appear to a person to be authentic or
truthful". The guidelines (points 113-116) break it into four cumulative criteria:

| Criterion | The guidelines | A realistic photo of "lentils with vegetables" |
| --- | --- | --- |
| Resemblance | "a high level of similarity" | It is sought on purpose: photorealistic, "not a 3D render, not glossy or plastic" (the pilot's prompt) |
| Existing | it is enough that something "exists, can plausibly exist or could have plausibly existed" | A plate of lentils exists and could have existed just like that |
| Object | "realistic, inanimate material items, including […] consumer goods" | Food on a plate |
| Appears authentic | assessed with the context and the foreseeable audience; "a high degree of photorealism renders it more likely"; older people and people with low digital literacy have to be taken into account (point 115) | In a planning app, a realistic photo of today's dish can be taken for a real photo of that plate. The audience includes older people |

Among the **examples of deepfakes**, the guidelines include: "An AI-generated image of a
product in advertisement or packaging that can affect the audience's perception and mislead
as to the actual product appearance". Among those that are **not** are impossible scenes (a
sphinx on the Eiffel Tower) and the backgrounds of a real product. A photo of invented but
plausible food is much closer to the first.

**Conclusion**: design as if art. 50.4 applied. If a lawyer ruled it out, art. 50.2 (the
machine-readable mark) would be enough. Even then I would keep the label: consumer law
asks for it (§ 3.3), as does the product principle "Never fake it" (`docs/PRODUCT.md`),
which `0010` applied to the illustrations.

### 1.4 What it requires, specifically

- **Art. 50.2 (provider)**: that the pictures be "marked in a machine-readable format" and
  that it be "detectable" that they are artificial, with solutions that are "effective,
  interoperable, robust and reliable as far as this is technically feasible". Both things:
  the mark **and** a means of detection (the guidelines, point 70). The "standard editing
  assistance" exception does not apply: the image is generated from scratch. → § 2.
- **Art. 50.4 (deployer)**: "shall disclose that the content has been artificially
  generated or manipulated". It is not an artistic or creative work, so the softened notice
  is not available.
- **Art. 50.5**: "in a clear and distinguishable manner at the latest at the time of the
  first interaction or exposure", and fitted to "the applicable accessibility requirements".
  - The guidelines, point 143: the obligation "applies to each output of an AI system with
    respect to any natural person exposed to the content". **Every place the picture is seen
    needs its own notice.** The console's card is usually the first exposure, so it **does
    need its own mark**. That answers `0003` § 9's question.
  - The guidelines, point 142: what "can be easily overlooked […] (e.g. only included […] in
    terms of use)" is not clear. The policy and the terms inform, but they do **not replace**
    the label.
  - The guidelines, point 144: art. 50 adds no accessibility requirements of its own, but the
    notice must meet those that already apply. NutrIA, as a microenterprise, is exempt from
    Act 11/2023's (art. 3.3; see [`analysis.md` § 8](./analysis.md#8-accessibility)). Even so
    I set the accessible name as a product requirement: without it, somebody using a screen
    reader does not get the notice.
- **Penalty** (art. 99.4): up to €15M or 3%; for an SME, "whichever is lower" (the
  guidelines, point 152).

### 1.5 The code of practice, and why this document is its gap analysis

The *Code of Practice on Transparency of AI-Generated Content* is the final version of
10/6/2026, which the Commission and the AI Board assessed as adequate. **NutrIA has not
signed it.** Whoever does not sign must demonstrate compliance "through other adequate
means", for example with "a gap analysis that compares the measures they have implemented
with the measures set out by a code of practice" (the guidelines, point 148). This table is
that analysis:

| The code's measure | What it asks | What NutrIA does (with what is recommended here) |
| --- | --- | --- |
| S1, 1.1 | At least two layers: **signed** metadata (1.1.1) and an imperceptible watermark (1.1.2) | Gemini: C2PA signed by Google + SynthID, in the original file served untouched (measured, § 2.3). MAI: out |
| S1, 1.2 | Do not remove existing marks | The original is served without re-encoding ✔. If another size is ever derived, add the IPTC metadata (§ 2.4) |
| S1, 2.1 | Detection available and free | Google's (SynthID and Content Credentials; any C2PA viewer). NutrIA needs none of its own while it only uses Google's marks |
| S1, 3.4 | Metadata in an open standard | C2PA (Google's) and IPTC `DigitalSourceType` |
| S2, 1.1 | An icon or label whose main element is the acronym "AI", or the national language's if the law requires it | "IA" in Spanish and "AI" in English. **A deliberate divergence**: the code asks for "AI" in English unless that is incompatible with national language law. I choose "IA" for the Spanish audience because point 142 requires that it be understood, and in Spain the common acronym is "IA" **[lawyer]** |
| S2, 1.1 (accessibility) | High contrast, screen-reader compatible, detectable by assistive technology | An accessible name of its own (§ 3.2); contrast over any photo |
| S2, 1.2.1 | Visible with no interaction; on top of or over the content; distinguishable over any background; at the first exposure | A mark overlaid on the top right corner of the card **and** of the large picture; on the large one, the caption with "indicative" as well |
| S2, 1.2.2 a | "in the top right corner of an image" | The top right corner |

### 1.6 The rejected picture only the owner sees (009, phase 2): is it an "exposure"?

**The fact.** The picture the judge rejected is seen in one place only: the console's
`/admin/catalogo/<id>/imagen` page, with an admin session
(`AdminCatalogue.controller.ts:49` and `:116-123`). It is no dish's picture, it has no
public address and, while it waits, nothing publishes it (§ 4.3). Since phase 3 it may stop
waiting: if the owner accepts it, it becomes the dish's picture and leaves this section for
§ 1.7.

**The question.** Art. 50.4 obliges the deployer to "disclose" that the image is artificial,
and 50.5 to tell "the natural persons concerned […] at the latest at the time of the first
interaction or exposure". Is the owner, looking at his own console, one of those persons?

| Reading | What it says | What it rests on |
| --- | --- | --- |
| Literal | Yes: he is a natural person who sees the content | The guidelines, point 141: the persons concerned are the "active or passive users and other persons exposed to the AI-generated or manipulated synthetic content"; point 143: "any natural person exposed to the content". Neither excludes whoever deploys |
| By purpose (**the one I follow**) | No: the duty is owed by whoever deploys **to their audience**, and here the only one looking is whoever deploys | Art. 3.60: a deepfake is what "would falsely appear to a person to be authentic"; somebody who commissioned the picture and reviews it knowing the judge rejected it cannot be led into that error. Recital 134: the duty is to "disclose […] by labelling the output". The guidelines, point 115: deception is measured against "the reasonably foreseeable audience", per "the intended distribution channels", and here there is neither channel nor audience. Point 87 (written for 50.2 and for "strictly technical" outputs, which a photo of food is not: it counts as a sign of the logic, not as a rule): it treats separately the "production steps and workflows before the output is finalised and made available to other external persons or the public", seen only by people inside the organisation and with access controls |

**The guidelines do not settle the case in these words**: no point addresses the internal
review of a deepfake before publishing it. That is why it is an interpretation, and it goes
on § 7's list **[lawyer]**.

**Why it does not need the hour with the lawyer.** The result is the same under both
readings, because the product meets the stricter one:

- **A visible notice (50.4 and 50.5)**: the page says, under the picture, "Imagen generada
  por IA. El revisor la rechazó y no está publicada: solo se ve en esta página."
  (`adminPictureReview.pictureCaption`, `es-ES.ts:532`; `page.tsx:89`); the `alt` says
  "Imagen de {dish} generada por IA, pendiente de revisión" (`es-ES.ts:531`; `page.tsx:84`);
  and the picture is drawn by the same component as the published ones, which puts the "IA"
  mark in its top right corner (`DishPicture.tsx:75-80`).
- **A machine-readable mark (50.2)**: only a file carrying its C2PA manifest is stored,
  checked twice over the bytes (`DishPicture.service.ts:276` and `:369`), and it is stored
  and served without a byte being touched (`:378`; `AdminCatalogue.controller.ts:120-122`).

**When it would be worth coming back here**: if that picture left the console — in a mail, in
an export, on a screen somebody sees who does not act under the owner's authority. Then there
is an audience and the notice goes with the picture, as in § 3. That a file with no C2PA is
never stored is, by the same token, a compliance rule and not a technical preference (report
`0005` § 10.5): it is what holds up the last sentence of the policy's § 4.2 b.

**Phase 3 is that case, and it is already resolved**: the picture accepted by hand leaves the
console by the only path that exists, the one every published picture takes, with its notice
(§ 1.7).

### 1.7 The picture accepted by hand (009, phase 3): does a person publishing it change anything?

**The fact.** `POST /admin/catalogue/recipes/:id/picture/candidate/accept`, admin only
(`AdminCatalogue.controller.ts:52` and `:157-158`). It reads the file from the private store,
looks at its marks again over those bytes (`RecipeController.ts:398`: no JPEG and no C2PA
manifest, 409), puts **those same bytes** in the public store (`:405`;
`PictureCandidates.service.ts:181-182`) and, in a transaction, leaves the row `ready` with
`acceptedBy: 'owner'` and writes `picture.accepted` (`:429`; `RecipeRepository.ts:107`). From
then on a person's app reads the same as for any picture: `ready` and an address. The same
component draws it (`DishPicture.tsx`), with the "IA" mark and, on the meal's page, the
`meal.pictureCaption` caption (`es-ES.ts:1668`).

| Question | Answer | What it rests on |
| --- | --- | --- |
| **Art. 50.2** (machine-readable mark): is the file still marked? | **Yes, just as through the judge's door.** It is the same Gemini JPEG, not re-encoded, and the manifest's presence is checked again over the bytes that get published | `RecipeController.ts:393-402`; `RecipeAcceptance.test.ts:425-462` (step 3) and `:186` (the same bytes); `picture-doors.spec.ts` (only two services write to the public store). The guidelines, point 74 (relying on the model provider's mark) |
| Is the manifest's **signature** verified? | **No, through neither door.** `pictureMarks` looks for the manifest's segment; it does not validate its signature. That is neither new nor made worse by phase 3: it is § 2.3.1's pending P3 (validate once with `c2patool` a file exactly as Blob serves it). It is worth doing **once with a file accepted by hand** too, which has been through two stores | `apps/api/AGENTS.md:289-296`; § 2.3.1 |
| **Arts. 50.4 and 50.5** (a visible notice): does it carry the notice? | **Yes, the same one.** No code distinguishes, when drawing, a picture accepted by hand from any other: the "IA" mark on the card and on the large picture, the caption and the `alt` on the meal's page | `DishPicture.tsx:75-80`; §§ 3.1 and 3.2 |
| Does the **human review** bring art. 50.4's second-paragraph exception ("human review or editorial control")? | **No, neither for nor against.** That exception is in the second paragraph, which deals with **text** "published with the purpose of informing the public on matters of public interest". Images that are deepfakes are in the first paragraph, whose only carve-outs are law enforcement and the softened notice for creative works. A person reviewing the picture **does not remove** the duty to disclose, and it adds none either | Art. 50.4, the OJEU text (first and second paragraphs); the guidelines, points 130 and 133 ("Article 50(4), second subparagraph […] the AI generated or manipulated **text** must have undergone human review or editorial control"). Even if it applied, point 134 requires a substantive examination with "fact-checking", and 135 rules out "cursory editorial approval" |
| Does it stop being "AI-generated" because a person chose it? | **No.** The owner chooses between publishing and not publishing; he touches no pixel. The content is still the system's output in full | Art. 3.60; art. 50.2 (the carve-out is for systems that "do not substantially alter the input data", not for human selection of outputs) |
| Do § 1.2's **roles** change? | **No.** NutrIA is still the provider and the deployer. The acceptance is an act of the deployer: he decides to publish | Art. 3.4 |
| Anything new for the owner as an operator? | **Art. 4** (AI literacy): whoever handles the system must understand what it does and what it does not. Here the operator is one person, and what he needs to know for this act is in the two-step notice (§ 4.4) and in this document: the judge only looks at what is in excess, it is wrong in both directions, and the allergy guarantee is not it | Art. 4, the OJEU text |

**Conclusion.** §§ 1.4, 1.5 and 2 do not change: the gap-analysis table (§ 1.5) holds just
the same for a picture accepted by hand. What holds that conclusion up is a code rule and not
a habit: **there is no third door** and **with no manifest nothing is accepted** (`0072`;
`apps/api/AGENTS.md:289-303`). If one day a file uploaded by the owner, or a re-encoded one,
could be accepted, § 2 would have to be redone for it.

---

## 2. The machine-readable mark (art. 50.2)

### 2.1 What each model brings

| Model | Signed metadata (C2PA) | Watermark | Source |
| --- | --- | --- | --- |
| `google/gemini-3.1-flash-lite-image` on Vertex | **Yes**. Google signs it: "All images or videos created or modified using the listed models are automatically digitally signed by Google LLC", and `gemini-3.1-flash-lite-image` is on the list | **SynthID**: "All generated images include a SynthID watermark". It is a mark of the model, so it is expected on Vertex too **(to be confirmed)** | Vertex AI, *Content Credentials* (upd. 2026-09-25); Gemini API, *Image generation* (upd. 2026-09-23) |
| `microsoft/mai-image-2.6` on Azure | **Not documented** | **Not documented** | Microsoft Learn, *Content provenance* (upd. 2026-09-17/23). The table names only MAI-Image-2.5, 2.5-Flash, 2e and 2.5-Pro. **2.6 does not appear** |

**What the pilot says about the files**: Gemini returned JPEG (20 of 20, 1200 × 896, a median
of 182 KB and a maximum of 227 KB). MAI returned PNG (18, 1024 × 768, a median of 1.3 MB).
The pilot only kept re-encoded WebP, so there was no way to know whether Google's C2PA
arrived through OpenRouter.

**Measured on 2026-09-27** (the lead and backend, 8 raw Gemini JPEGs, received through
OpenRouter before any processing): all 8 carry a C2PA manifest signed by Google
(`claim_generator` "Google C2PA Core Generator Library"; the actions `c2pa.created`, "Created
by Google Generative AI", and "Applied imperceptible SynthID watermark"; `c2pa.hash.data`)
and an XMP IPTC `DigitalSourceType = trainedAlgorithmicMedia`. **The signature has not been
cryptographically validated** (`c2patool` was not used). The manifest itself declares the
SynthID mark, so the table's "to be confirmed" is answered by Google, not by any detection of
ours.

### 2.2 What re-encoding breaks

- `sharp` discards metadata by default. Even if the C2PA block were kept, recompressing
  changes the bytes and the manifest stops validating: its "hard binding" is a hash of the
  content. Google puts it like this: "Any modification to a C2PA-compliant media file using a
  non-C2PA tool is considered tampering". And Microsoft: provenance can be lost through
  "Format conversion, transcoding, or compression".
- SynthID lives in the pixels and is built to survive compression and rescaling (the code,
  measure 3.3). It survives, but it is only one layer.
- The IPTC field `DigitalSourceType = trainedAlgorithmicMedia` written with `withXmp`, which
  `0003` § 7.2 proposes, is standard and cheap, but it is **not signed**. It does not meet
  sub-measure 1.1.1 ("digitally signed and time-stamped"): it is one more clue, not the
  metadata layer.

### 2.3 What I recommend

1. ~~**Measure before building**~~ — **done on 2026-09-27**: the C2PA arrives (§ 2.1). What
   is left is validating the signature once with a C2PA tool (`c2patool` or the Content
   Credentials verifier, free) over a file **exactly as Blob serves it**: it checks at once
   that Google signed and that neither OpenRouter, nor the backend, nor Blob touched a byte
   (P3).
2. **The C2PA arrives, so** (what has been built): store in Blob and **serve Gemini's JPEG
   exactly as it arrives**, with no re-encoding and no added metadata (touching a byte
   invalidates the manifest). Use the same file for the large picture (4:3) and for the card
   (16:9, cropped with CSS). Google's two layers reach whoever sees the picture intact, and
   any C2PA viewer or Google's verification detects it. It costs ~70 KB more per picture than
   the pilot's WebP (a median of 108 KB). It is the cheapest route that meets the code.
3. *(No longer applicable; it stays in case the C2PA ever stops arriving.)* **If the C2PA does
   not arrive**: SynthID is left, plus the IPTC metadata field (§ 2.4) in the file that gets
   served. That is one solid layer and one that is not signed: below the code, but defensible
   as "technically feasible" and proportionate to the cost (art. 50.2; the guidelines, points
   81 and 85) **[lawyer]**. The complete alternative is for NutrIA to sign its own C2PA
   manifest after re-encoding (the open `c2pa-node`/`c2pa-rs` library, with Google's manifest
   as an ingredient if it exists). It needs a signing certificate. I leave it as a P2 with a
   date: at the code's next review, or if a lawyer asks.
4. **If a smaller size is needed** for the card, derive it with `sharp` and write the IPTC
   field into it (§ 2.4). The large picture is still the original.
5. **Decided on 2026-09-27: the owner removed MAI-Image-2.6.** The reasoning that led to
   recommending it: out of production until (a) Microsoft includes it in its provenance table,
   or (b) step 1's measurement shows C2PA and a watermark in its responses. Until then, a MAI
   picture would carry neither a signed mark nor a watermark, and NutrIA would have to supply
   both, a watermark of its own included: disproportionate work for a fallback model. The PRD
   already accepts that a dish may end up with no picture, and in the pilot Gemini failed none
   of 20. **It is a product decision of the owner's**: if he wants MAI, the cost is a
   watermark of his own. If MAI or another model ever comes back, this § 2 is redone for it
   before switching it on, and the policy names it first (§ 4.2 b).

### 2.4 The IPTC field, for any file NutrIA writes or re-encodes

XMP with `Iptc4xmpExt:DigitalSourceType` =
`http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia`. Optionally, and
recommended by the code (measure 1.3), the system's name ("NutrIA") and the generation date.
**Never** a user or account identifier (the code, 1.1.1: "without including privacy-sensitive
[…] information").

### 2.5 The detection

With § 2.3.2's route, the detection is Google's (Content Credentials in any C2PA viewer;
SynthID in Google's verification), which is free and public. That meets art. 50.2's second
half (the guidelines, points 74-76). The policy will say, in one sentence, that the pictures
carry those marks (§ 4.2). That also meets art. 50.5 for this information: whoever wants to
check knows they can.

---

## 3. The texts the person sees

They are shown in Spanish and in English, like the rest of the product. None of them is
accepted, so **no version constant has to be raised**. The keys are a proposal: `frontend`
may rename them, but the text is this.

### 3.1 The large picture (the meal's page, 4:3)

| Key | Where | es-ES | en-GB |
| --- | --- | --- | --- |
| `meal.pictureCaption` (replaces `meal.illustration`, `es-ES.ts:741`) | A visible `<figcaption>`, right under the picture (`plan/comida/[id]/page.tsx:136`) | `Imagen generada por IA. Es orientativa: manda la lista de ingredientes.` | `AI-generated image. For illustration only: the ingredient list is what counts.` |
| `meal.pictureOf` (replaces `meal.illustrationOf`, `es-ES.ts:742`) | The picture's `alt` (`page.tsx:131`) | `Imagen de {name} generada por IA` | `AI-generated image of {name}` |

<!-- Source: AI Act arts. 50.4 and 50.5 (a clear, distinguishable notice, at the first exposure, accessible); Guidelines C(2026) 5054, points 142-144. "Imagen", not "Ilustración": an illustration suggests a drawing and these are photorealistic (0003 § 1); not "foto", which suggests a camera. "Es orientativa: manda la lista de ingredientes": Act 3/1991 on Unfair Competition (consolidated to 27/12/2025), arts. 5.1.b (deception as to "the main characteristics of the good or service, such as […] its composition") and 7.1 (information that is "unclear […] ambiguous"), and TRLGDCU art. 60.1 (information that is "truthful and sufficient on the main characteristics"). A low risk: art. 5.1 requires that the information be able to "alter their economic behaviour", and NutrIA does not sell the food; the label costs one sentence; it is the same turn of phrase the product already uses in `nutrition.note` ("la etiqueta manda"). The alt repeats "generada por IA" on purpose: somebody navigating by images with a screen reader hears the alt and not the caption. -->

**The large picture also carries the same corner mark as the card** (§ 3.2: `IA`, with its
accessible name). The code asks that the label be "directly embedded into the content" or on a
layer that "appears to be on the content" (section 2, measure 1.2.1 c), in the top right
corner (1.2.2 a). A caption *below* the picture is neither of those. `DishPicture` draws both
variants, so the mark lives in a single component. The caption stays for the consumer message
("orientativa").

### 3.2 The corner mark (the console's card, 16:9, and the large picture, 4:3)

| Key | Where | es-ES | en-GB |
| --- | --- | --- | --- |
| `picture.aiMark` | The mark's visible text, overlaid on the picture's top right corner, on the card (`NextMeal.tsx:58-62`) and on the large picture (`page.tsx:128-136`) | `IA` | `AI` |
| `picture.aiMarkLabel` | The mark's accessible name | `Imagen generada por IA` | `AI-generated image` |

<!-- Source: arts. 50.4 and 50.5; the guidelines, point 143 (each output, each exposed person: the card is often the first exposure) and point 142; the code of practice, section 2, measures 1.1 (the acronym as the main element; contrast; detectable by assistive technology) and 1.2.1-1.2.2 (visible with no interaction, overlaid, top right corner, distinguishable over any background). "IA" and not "AI" in Spanish: see § 1.5. -->

The mark's requirements, which `frontend` and `accessibility` may resolve however they like:

- It is seen without touching anything, over the picture and in the top right corner, with a
  background of its own (an opaque or translucent pill) that contrasts over **any** photo:
  WCAG 1.4.3, 4.5:1, counting the worst possible background.
- It covers nothing that matters, and it cannot be closed or hidden.
- **It reaches assistive technology.** The card's picture has `alt=""` today. The text read out
  must be "Imagen generada por IA", not "IA". For example, with "IA" visible and `aria-hidden`
  plus a text for readers only. The card is a link (`Card as={Link}`), so that text becomes
  part of its name, and that is right.
- It appears only when a picture is seen. The fallback plate (the glyph) or a picture that does
  not load carry **no** mark: there is nothing synthetic to disclose (the PRD, criterion 8).

### 3.3 The terms of use: one new sentence

**Where**: the `terms` namespace, the "Contenido generado con inteligencia artificial" section
(`es-ES.ts:1694-1697`; `en-GB.ts:1688`). It is added as a second paragraph. `terms.updated`
has to be updated.

| es-ES | en-GB |
| --- | --- |
| `Las imágenes de los platos también las genera una inteligencia artificial, a partir de la receta, y las marcamos como tales. Son orientativas: no son una foto del plato que vas a cocinar y pueden no mostrar todos sus ingredientes ni su cantidad real. Lo que lleva cada plato lo dice su lista de ingredientes, y es la que tiene en cuenta tus alergias.` | `The pictures of the dishes are also generated by artificial intelligence, from the recipe, and we mark them as such. They are for illustration only: they are not a photo of the dish you will cook and may not show all of its ingredients or its real quantities. What each dish contains is what its ingredient list says, and that list is the one that takes your allergies into account.` |

<!-- Source: TRLGDCU art. 60.1 (information that is "truthful and sufficient on the main characteristics"); Act 3/1991, arts. 5.1.b and 7.1; Act 7/1998, art. 5.5 (general conditions must be transparent, clear, specific and simple). The last sentence says what the code does: the allergen gate runs against the ingredient list in the database (`0004`), not against the picture; the vision judge lowers the risk, but it is not the guarantee (0003 § 6.2). It only informs; it changes no rights or obligations: it is not an "important change" under the "Cambios en estas condiciones" section and it requires no advance mail. If the owner would rather give notice anyway, a line in the next mail is enough. -->

---

## 4. Privacy

### 4.1 What data go in and who sees them

| Flow | Personal data | Who |
| --- | --- | --- |
| Asking for the picture (the meal's page calls the API) | The session of whoever opens the page, as in any other request | Vercel (already a processor) |
| Drawing the picture | **None.** The prompt is built from the recipe alone: the name, the ingredients ordered by weight with their share in words ("most of the plate"…), and the fixed style (the pilot, `buildPrompt`; the PRD, criterion 4). Nothing from the user, the profile, allergies or health. Not who asked for it or when, either | OpenRouter → Google (Vertex, `google-vertex/global`), with ZDR and no fallback |
| The vision judge | **None**: the picture and the recipe's list. Since 010 phase 3, what it answers (the foods it sees, their cross-check against the ingredients and the verdict) **is stored** on the dish's row and shown to nobody (§ 4.5) | OpenRouter → DeepInfra (already named); the answer, in `recipe_images` in Neon |
| Storing the picture that gets published: the one the judge accepted or, since 009 phase 3, the one the owner accepted by hand against the judge (§ 4.4) | None: the picture and its technical metadata (model, prompt version, size). On the one accepted by hand, also `acceptedBy: 'owner'` — the fixed word, not an account id — and the allergen keys the judge had flagged (`RecipeController.ts:417-425`). Who accepted it is only in the action log (§ 4.4) | Vercel Blob (the public store); `recipe_images` in Neon |
| Storing, for the owner to look at, the last picture the judge rejected (project 009 phase 2, `0072`; § 4.3) | **None.** At most one file per dish: the JPEG exactly as the model returned it, with its C2PA, built from the recipe alone. On the dish's row (`recipe_images.provenance.candidate`): the file's path, the model, the prompt version and what the judge flagged, as allergen keys and slugs from NutrIA's catalogue. For a file with no C2PA the file is not stored, only what it was (type, size and three yes/no marks). It adds no datum about who opened the dish: the failure's time follows a visit, as it already did before this phase, and it travels with no identifier ([`textos/06`](./textos/06-correos.md) § M) | Vercel Blob, in a **second, private store**, in `fra1` (Vercel is already a processor); the row, in Neon. It is seen by **an admin session only**, through the API; there is no public address and the path does not leave the API. **It can be looked at for 7 days** from the failure; the file is deleted afterwards, usually in the next night's clean-up, **with no guaranteed deadline** (§ 4.3) |
| Viewing the picture | The IP and browser of whoever loads it, which reach Vercel's network | Vercel (already a processor) |
| Telling the owner that a picture failed or that the provider is refusing the requests — the key cannot pay or has reached its usage limit — (project 009 phase 1, `0072`; [`textos/06`](./textos/06-correos.md) §§ M and N) | **None**: counts by reason from a closed list and a link to the console; neither the dish's name nor its id, nor what the provider or the reviewer wrote | The SMTP provider (already named), towards the owner's mailbox |

**Consequences**:

- Google receives no personal data. It is not NutrIA's processor (art. 28 GDPR) and not a
  "recipient" in the sense of art. 13.1.e, and the sending is not a chapter V transfer. It is
  **not added** to "Transferencias", because that would suggest personal data leave. It **is
  named** in "La inteligencia artificial", because the policy promises "solo usamos
  proveedores que borran la petición en cuanto responden y no la usan para entrenar" and the
  owner has decided the rule holds for everything NutrIA sends (the *no training providers*
  memory; `0003` § 5.3).
- P1-11 (OpenRouter's DPA) does not block the pictures: no personal datum goes through that
  key.
- **Vercel Blob**: the store's region is chosen when it is created and cannot be changed
  (Vercel Blob's documentation, upd. 2026-08-26). It must be created in **`fra1`** so that "in
  the European Union" stays true for what is stored. What is served goes through Vercel's
  regional nodes, as the web app already does.
- **The public store**: "blob URLs are accessible to anyone with the link". The path must carry
  nothing of anybody's: no user or plan id, only the recipe's and a hash
  (`recipes/<id>/<hash>…`, `0003` § 7.2). I check that when reviewing the code (§ 6).
- **The private store** (009 phase 2): it is another store, not a folder of the public one.
  Vercel: "Private Blob stores require authentication for all read and write operations" and a
  file's address "is not publicly accessible" (*Private Storage*, upd. 2026-09-15). Only the
  API has the token, and the API does not start if it is the same as the public store's
  (`Env.validation.ts:585-591`). Its region is also fixed when it is created: in `fra1`, "in
  the European Union" stays true for what is stored. The path carries the recipe's id, the
  prompt version and a random part (`DishPicture.service.ts:374`), nothing of anybody's.
- **The record and the DPIA**: there is no new activity with personal data. The record adds
  delivery by Vercel Blob to row 2, and the DPIA a note (done in this same change). On
  2026-09-30 both name the second store; there is still no new datum, purpose or recipient.

### 4.2 Changes to `/privacidad` (live) and to [`textos/02`](./textos/02-politica-privacidad.md)

They are published **before** the flag is switched on, or on the same day, and with a new
`privacy.updated`. No advance mail is needed: it changes neither what personal data are
processed nor with whom.

**a) "La inteligencia artificial", the "A quién va" paragraph** (`es-ES.ts:1362`;
`en-GB.ts:1349`). Only the ending changes, to narrow it to designing the dishes. The current
sentence ("nunca los servicios de Google ni de DeepSeek") will be misread by somebody who,
two paragraphs later, finds Google drawing pictures.

| | es-ES | en-GB |
| --- | --- | --- |
| Today | `…; son modelos abiertos que ejecutan esas empresas, nunca los servicios de Google ni de DeepSeek.` | `…; they are open models run by those companies, never by Google's or DeepSeek's own services.` |
| New | `…; son modelos abiertos que ejecutan esas empresas: lo que se envía para diseñar tus platos nunca pasa por los servicios de Google ni de DeepSeek.` | `…; they are open models run by those companies: what is sent to design your dishes never goes through Google's or DeepSeek's own services.` |

**b) The illustrations paragraph** (`es-ES.ts:1365`; `en-GB.ts:1352`). It is replaced:

| es-ES | en-GB |
| --- | --- |
| `Las imágenes de los platos las genera otro modelo, a partir solo de la receta: su nombre, sus ingredientes y en qué proporción. Nunca recibe nada tuyo, ni siquiera quién ha abierto el plato. La petición va a OpenRouter, que la pasa a Google (Vertex AI), y un modelo que ejecuta DeepInfra comprueba que la imagen no muestra alimentos que la receta no lleva. Ninguno guarda la petición ni la usa para entrenar. Las imágenes se guardan en Vercel, se muestran a todas las personas que ven ese plato y llevan la marca «IA»; los ficheros llevan además una marca invisible y legible por máquina que dice que están generados por IA.` | `The pictures of the dishes are generated by another model, from the recipe alone: its name, its ingredients and in what proportion. It never receives anything of yours, not even who opened the dish. The request goes to OpenRouter, which passes it to Google (Vertex AI), and a model run by DeepInfra checks that the picture shows no food the recipe does not contain. None of them keeps the request or trains on it. The pictures are stored on Vercel, shown to everyone who sees that dish, and carry the "AI" mark; the files also carry an invisible, machine-readable mark saying they were generated by AI.` |

No variants since 2026-09-27: MAI is out and the C2PA arrives in every file, which are served
untouched, so the last sentence is true. If another model comes back, it is named here before
being switched on.

**Since 009 phase 3, the judge's sentence changes.** It is the only published sentence this
phase touches, and the plan leaves it to the owner's decision (PLAN 009, phase 3, the stop
signal).

> **Decided by the owner on 2026-09-30: text A**, published in the same change as the accept
> button, with `privacy.updated` = 30 de septiembre de 2026 / 30 September 2026.
> `/condiciones` does not change (§ 4.4's optional sentence is not taken).
> **Checked on 2026-09-30 in the working tree of `main`**: text A is there, letter for letter,
> in `es-ES.ts:2288` and `en-GB.ts:2243`; the previous sentence no longer appears in any
> dictionary; `privacy.updated` says "Última actualización: 30 de septiembre de 2026" / "Last
> updated: 30 September 2026" (`es-ES.ts:2359`; `en-GB.ts:2314`), and `terms.updated` is still
> on the 29th.

> **Re-read on 2026-09-30 against 010 phase 2, and again after it was tightened** (the own-form
> rule, § 4.6; the second reading changes nothing in this box: the class narrows, but it still
> exists; what follows this box, up to the "New text" table, is 009 phase 3's review of the
> **previous** sentence, not of text A):
> text A **still stands in general and stops describing one specific class** of pictures, which
> the judge now accepts on purpose: a second food with the form of one the dish already has or
> that its name says (a glass of milk beside a curry made with coconut milk). In that class the
> model clearly sees a food that, per the catalogue, carries an allergen the recipe does not
> have, and the picture **is published**. **P2, not P1**: the following sentence ("la imagen
> puede mostrar algo que el plato no lleva") warns the reader of the consequence, and the dish
> is still safe. **It does not force a change to the text; I recommend one.** The full reading,
> the proposed clause and why, in § 4.6.

*Why it cannot stay.*

1. **What kind of sentence it is.** It is not art. 13-14 GDPR information: in this flow there
   are no personal data (§ 4.1), and both those articles and 5.1.a ("processed lawfully,
   fairly and in a transparent manner **in relation to the data subject**") only reach the
   processing of personal data (art. 2.1). Nor is it the AI Act's art. 50 notice: that article
   requires saying **that** the picture is artificial (50.4) and marking it (50.2), not
   describing what controls it passes; the sentence that does serve 50.5 is the paragraph's
   last one, about the marks. The judge's sentence is a **voluntary statement about how the
   service works**, made to consumers.
2. **Which rule measures it.** Consumer law. TRLGDCU art. 19.2: commercial practices are "any
   act, omission, conduct, statement or commercial communication" of the trader, and they are
   governed by that act and by the Unfair Competition Act. Act 3/1991, art. 5.1: conduct is
   misleading where it "contains false information or information that, **even being
   truthful**, by its content or presentation misleads or is liable to mislead its addressees,
   being liable to alter their economic behaviour", where it bears, among other things, on
   "**the results and essential characteristics of tests or checks carried out on the good or
   service**" (point b) or on "the risks it may run" (point h). TRLGDCU art. 8.1.d: the right
   to "correct information about the various goods or services"; art. 61.2: the content of
   what is advertised about the service is enforceable "even where it does not appear
   expressly in the contract concluded".
   **The bar, therefore, is not that the sentence be literally true: it is that an average
   reader not take a wrong idea from it**, and here the reader includes people with allergies.
3. **What whoever reads it understands.** "Un modelo […] comprueba que la imagen no muestra
   alimentos que la receta no lleva" reads as: the pictures I see have passed that check.
   After phase 3 it is still true that the model looks at every picture, but a published one
   may be exactly the one the model rejected. Truthful word for word, and misleading in what
   it gives to understand: art. 5.1's case.
4. **And it already said more than the code does.** I wrote it on 2026-09-27 from the PRD,
   before the judge existed. The judge that was built does **not** reject any food that is in
   excess: only one that is clearly seen — named, in more than a trace — and that carries an
   allergen no ingredient of the dish has (`judge.ts:16-18`, `:497` and `:512`, lines from
   phase 3's tree; in 010 phase 2's, `:710`). A picture with parsley or tomato the recipe does
   not have is published. That is true in production today, with or without phase 3.

*The risk of leaving it*, measured: low. Art. 5.1 requires the error to be able to "alter
their economic behaviour", and nobody buys or does not buy NutrIA because of this sentence;
every large picture's caption and the terms already say the list is what counts. But it is a
statement about allergens that the code does not support, and this directory's rule is that a
policy promising what the code does not do is worse than none. **P1** if phase 3 is switched
on without changing it (the same scale as IMG-5).

**New text** — it replaces, within the paragraph above, from "La petición va a OpenRouter" to
"para entrenar."; the rest of the paragraph does not change:

| | es-ES | en-GB |
| --- | --- | --- |
| Until 2026-09-30 (it was in `es-ES.ts:2285`; `en-GB.ts:2240`) | `La petición va a OpenRouter, que la pasa a Google (Vertex AI), y un modelo que ejecuta DeepInfra comprueba que la imagen no muestra alimentos que la receta no lleva. Ninguno guarda la petición ni la usa para entrenar.` | `The request goes to OpenRouter, which passes it to Google (Vertex AI), and a model run by DeepInfra checks that the picture shows no food the recipe does not contain. None of them keeps the request or trains on it.` |
| **New (A: the chosen one, 2026-09-30; in `main`: `es-ES.ts:2288`, `en-GB.ts:2243`)** | `La petición va a OpenRouter, que la pasa a Google (Vertex AI), y un modelo que ejecuta DeepInfra revisa cada imagen antes de que se publique. Ninguno guarda la petición ni la usa para entrenar. Si ese modelo ve con claridad en la imagen un alimento con un alérgeno que la receta no lleva, la imagen se rechaza, y solo se publica si después la revisamos a mano y decidimos publicarla. Esa revisión no es una garantía: la imagen puede mostrar algo que el plato no lleva, y lo que lleva lo dice su lista de ingredientes.` | `The request goes to OpenRouter, which passes it to Google (Vertex AI), and a model run by DeepInfra reviews every picture before it is published. None of them keeps the request or trains on it. If that model clearly sees in the picture a food carrying an allergen the recipe does not have, the picture is rejected, and it is published only if we then review it by hand and decide to publish it. That review is not a guarantee: the picture may show something the dish does not contain, and what the dish contains is what its ingredient list says.` |
| Alternative (B, the minimum change; **discarded**) | `La petición va a OpenRouter, que la pasa a Google (Vertex AI), y un modelo que ejecuta DeepInfra comprueba que la imagen no muestra alimentos que la receta no lleva; si la rechaza, solo se publica cuando la revisamos a mano y decidimos publicarla. Ninguno guarda la petición ni la usa para entrenar.` | `The request goes to OpenRouter, which passes it to Google (Vertex AI), and a model run by DeepInfra checks that the picture shows no food the recipe does not contain; if it rejects it, the picture is published only when we review it by hand and decide to publish it. None of them keeps the request or trains on it.` |

- **A** fixes both things: what phase 3 adds (point 3) and what the sentence already
  overstated (point 4). **B** fixes only the first and leaves "alimentos que la receta no
  lleva", which is still wider than the judge. I recommended A, and A is the chosen one.
- **There is no variant C**: I can find no wording that leaves the sentence as it is and is
  true once the first picture is accepted by hand. If the owner does not want to change the
  sentence, acceptance by hand is not switched on (or the judge's clause goes entirely, which
  is also changing the text).
- **`privacy.updated` changes with it** (`es-ES.ts:2359`; `en-GB.ts:2314`): 30 September 2026,
  by the owner's decision. If the change reached production on another day, the date is that
  day's. `terms.updated` does not.
- **No advance mail.** The policy promises to give notice by mail before an important change;
  this one changes neither what personal data are processed, nor why, nor with whom, and it
  takes nothing from anybody: it informs better.
- **Order.** The sentence only becomes misleading once the first picture accepted by hand
  exists, and only the owner can do that. The simplest thing is for the dictionary to change
  **in the same change** as the one that brings the button. If they are separated: the text
  first, and the owner accepts no picture until he sees it on `/privacidad`
  ([`go-live-checklist.md`](./go-live-checklist.md) § 0 ter).

<!-- Source for the new text. "revisa cada imagen antes de que se publique": not every drawn picture reaches the judge — one that arrives with no C2PA manifest is discarded first, `DishPicture.service.ts:279`, and the judge runs after, `:320` — but every picture that gets published went through `judgePicture` — through door (a) it accepted it; through (b) it rejected it and the owner accepted it; one the judge never saw is neither stored nor accepted (PRD 009, Out). "Si ese modelo ve con claridad […] un alimento con un alérgeno que la receta no lleva, la imagen se rechaza": `judge.ts:16-18` and `:497` (`specific`, not generic, `amount !== 'trace'`, `foreignAllergens.length > 0`); the allergens come from the catalogue, not from the model. "solo se publica si después la revisamos a mano y decidimos publicarla": `0072`'s two doors; `RecipeController.ts:359-466` (an admin session, the flagged allergens repeated in the request, `picture.accepted` in the same transaction); `picture-doors.spec.ts`. "no es una garantía […] puede mostrar algo que el plato no lleva": the judge lets through what is in excess with no foreign allergen, and traces, it may not see something, and the owner can accept against it; "lo que lleva lo dice su lista de ingredientes": `0004`, the allergen gate runs against the recipe (the same sentence as § 3.3). It does not promise "y podemos retirarla": until 010 phase 4 only the one accepted by hand could be withdrawn; since that phase any published picture can be (`RecipeRepository.ts:1041`, phase 4's tree: `status = 'ready'` and nothing else), but it is still not promised: a promise in the policy is enforceable (TRLGDCU art. 61.2), and withdrawing is a discretionary act of the owner's in his console, not a right of whoever reads; the published sentence is true with withdrawal and without it, and it does not change. Rules: Act 3/1991 (BOE-A-1991-628, consolidated to 27/12/2025), arts. 5.1.b, 5.1.h and 7.1; TRLGDCU (BOE-A-2007-20555, consolidated to 28/02/2026), arts. 8.1.d, 19.2, 60.1 and 61.2; GDPR arts. 2.1 and 5.1.a (they do not reach this sentence); AI Act arts. 50.4-50.5 (it does not require it). -->

<!-- Source: GDPR arts. 5.1.a and 13.1.e (with no personal data there is no recipient to inform of; it is named out of fairness and because of the promise in force); PRD 006, criteria 3-4; the pilot's prompt (`buildPrompt`: the name and the proportions, with no user data); `0003` §§ 5.3, 6.2, 7.1; OpenRouter `provider.only` = `google-vertex/global` / `deepinfra` (MAI and `azure` out since 2026-09-27), `allow_fallbacks: false`, ZDR (the pilot's metadata). The invisible mark: Vertex AI, Content Credentials (upd. 2026-09-25) and Gemini API, "All generated images include a SynthID watermark" (upd. 2026-09-23); measured on 2026-09-27 in 8 of 8 files received (Google's C2PA with the action "Applied imperceptible SynthID watermark" and XMP IPTC), served untouched. AI Act arts. 50.2 and 50.5 (whoever wants to check knows they can). "Se muestran a todas las personas que ven ese plato": the picture belongs to the recipe, which is shared (the PRD, Outcome); that way nobody believes their picture says something about them. -->

**c) "Con quién compartimos tus datos", Vercel's line** (`es-ES.ts:1373`; `en-GB.ts`, the
equivalent):

| es-ES | en-GB |
| --- | --- |
| `Vercel (alojamiento de la web, la API y las imágenes de los platos, en la Unión Europea) y Neon (base de datos, en la Unión Europea). Son empresas de Estados Unidos.` | `Vercel (hosting for the website, the API and the pictures of the dishes, in the European Union) and Neon (database, in the European Union). Both are US companies.` |

<!-- Source: GDPR art. 13.1.e; Vercel Blob (the region is chosen when the store is created, docs upd. 2026-08-26): the phrase "en la Unión Europea" is only true if the store is created in `fra1` (§ 6). -->

**d) "Transferencias"**: no changes (§ 4.1).

### 4.3 The rejected picture that waits for the owner (009, phase 2)

**What stops being true.** Until 2026-09-30 the code, `0066` and 006's PRD said a rejected
picture is "never stored". This document did not promise that in those words, but it took it
for granted: § 4.1's "Store" row only knew the accepted picture. Put precisely, for phase 2:

> A picture the judge rejected **is published by no automatic code**: no drawing, retry or job
> turns it into a dish's picture. **One is stored, privately**: the last of a drawing that
> ended in failure, if it carried its C2PA manifest, for the owner to look at for 7 days.
> **Only he can publish it** (phase 3): by hand, with an admin session, after seeing the
> allergens the judge flagged, and with a row in the action log written in the same
> transaction (§ 4.4). A file with no manifest is never stored, in any store, and cannot be
> accepted.

(Phase 2 said here "it is never published […] no route […] turns it into one". That stopped
being true with phase 3, and is corrected above.)

**What is stored and what is not** (`DishPicture.service.ts:173-246` and `:367-386`;
`PictureCandidate.ts:36-43` and `:52-58`):

| | Stored | Where |
| --- | --- | --- |
| The last picture with C2PA the judge rejected, **only if the drawing ends in failure** | The JPEG, byte for byte | The private store, `dish-picture-candidates/<recipe id>/<prompt version>-<random>.jpg` |
| Its pointer | The path, the model, the prompt version and, for each flagged food, allergen keys and catalogue slugs (`flaggedExtras`, `judge.ts:523-527`): **not** the word the vision model wrote | `recipe_images.provenance.candidate` (Neon) |
| A file with no C2PA | The file, **no**. A closed diagnostic: the content type, the size and three yes/no marks | `recipe_images.provenance.diagnostic` |
| The drawing's other rejected pictures; those of a drawing that ends accepted or returned; the one the judge never saw | Of the file, nothing. Since 010 phase 3, **what the judge answered** about every one it did judge *is* stored (§ 4.5) | `recipe_images.provenance.drawings` |
| The drawing's notes | As before this phase: `provenance.notes` keeps the judge's notes, which **do** include food names written by the vision model (`judge.ts:502-510`). They reach no screen and no mail: the console takes from that row only the reason from the closed list and what the pointer carries (`AdminCatalogueController.ts:213-226` and `:235-239`; no DTO in `modules/admin/dto/out` carries `notes` or `provenance`). Since 010 phase 3, the judge's whole answers as well, in `drawings` (§ 4.5). Since 010 phase 2, one more note, `own_form:<names>`, when the own-form rule removed an allergen (`judge.ts:654` and `:720`): they are names the vision model wrote, like those of `extra_food:`, and they go and stay where the other notes go (§ 4.6) | `recipe_images.provenance.notes` |

Without the private store's token nothing is stored and the drawing is the one from before
(`DishPicture.service.ts:369`; `VercelBlobPictureCandidateStore.ts:21-23`).

**Who sees it.** An admin session only, through two routes with `@Roles('admin')`
(`AdminCatalogue.controller.ts:49`): the one that answers the bytes
(`GET /admin/catalogue/recipes/:id/picture/candidate`, `:116-123`, with
`Cache-Control: private, no-store` and `nosniff`) and the one that answers the recipe with
what the judge flagged and when it expires, **with no path and no address** (`:86-89`). For
anybody else, a 404. Vercel, as the host, stores the file: it is already a processor and
already named.

**For how long: what is true, and what cannot be promised.**

| | Period | Source |
| --- | --- | --- |
| It can be looked at | While the row is still `failed` and **exactly 7 days** have not passed since the last attempt. After that instant it is neither shown nor served, even if the file is still there | `reviewableCandidate` and `candidateExpiry`, `RecipeController.ts:112-134`; `PICTURE_COOL_OFF_DAYS = 7`, `:60` |
| It is deleted earlier | When the owner discards it (first the file, then the pointer and the `picture.discarded` row, in a transaction) or retries the drawing (first the claim, which removes the pointer; then the file). And, since phase 3, when he **accepts** it: once the picture is published, the private file is deleted and then its pointer; if that deletion fails, the acceptance stands and the nightly clean-up, which also takes rows that are no longer `failed`, finishes the job | Discarding and retrying: `RecipeController.ts:565-568` (`discardCandidate`) and `:843-888` (`retryPicture`). Accepting: `RecipeController.ts:462-468`; `RecipeRepository.ts:1128-1139` |
| It is deleted on expiry | In the **03:30 UTC** clean-up (`apps/api/vercel.json`), inside `/cron/rewrite-steps`: up to 24 h after expiry. First the file, then the pointer | `Cron.controller.ts:103-109`; `RecipeController.ts:309-335`; `RecipeRepository.ts:968-979` |
| It may take longer | The clean-up has 8 s, it does not start a deletion in its last 4 s and it takes at most 100 rows a night, the oldest first. A deletion that fails leaves the pointer and is retried the next night, with no limit on nights. If the job does not run, nothing is deleted; the daily summary warns that the "nightly rewrite" has gone more than 26 h without running ([`textos/06`](./textos/06-correos.md) § H) | `Cron.controller.ts:26`; `PictureCandidates.service.ts:14` and `:46-50`; `RecipeController.ts:69` and `:318-331` |
| It may stay **with no period** | A file **with no pointer**, which no route can read and the clean-up cannot find, because it reads the database and never lists the store: (a) the deletion after a retry fails, and the failure is swallowed (`RecipeController.ts:625-627`); (b) the file was uploaded and the row was never written — the function died, or the claim was lost and the deletion afterwards failed — (`DishPicture.service.ts:236-243` and `:389-397`); (c) the token is removed with live pointers: the clean-up removes the pointers and deletes nothing (`PictureCandidates.service.ts:41-50`); (d) phase 3: on **withdrawing** a picture whose row still held the candidate's pointer, the private file's deletion fails and is swallowed (`RecipeController.ts:773-777`). Only the owner deletes it, by hand, from Vercel's dashboard | the ones cited |

That is why no text should say "at most 7 days". What can be stated is: **it can be looked at
for 7 days; afterwards it is deleted, usually in the next night's clean-up**. `0072` puts it
that way since 2026-09-30 ("can be reviewed for 7 days"; it used to say "kept for at most 7
days"), as does `apps/api/AGENTS.md:339-340`. Report `0005` § 5 keeps "at most 7 days": it is
a closed report and is not edited; `0072` governs.

On deletion, Vercel warns that "it may take up to one minute for them to be fully removed from
the Vercel CDN cache" (*Using the Blob SDK*, `del()`, upd. 2026-08-26). That copy is read only
with the token, and the API always asks for the original, not the copy
(`VercelBlobPictureCandidateStore.ts:32`, `useCache: false`). I have not found in Vercel's
documentation what happens to a deleted file in its backups: **I do not know**.

**Is there a legal period to meet?** No. Art. 5.1.e GDPR limits the retention of **personal
data**, and there are none here (below). The 7 days are a product decision: an orphan file
lasting longer breaches nothing towards anybody. What would be a problem is writing a period
the code does not support in a text somebody reads, and that is why the page was reviewed: the
period's note (`adminPictureReview.decideNote`), the notice after retrying (`retryDone`) and
"pasados al menos 7 días" in Imágenes were corrected on 2026-09-30. Two imprecisions stay,
known and noted in the project's LOG: between expiry and the clean-up, Recetas says of that
dish "Se reintenta sola en la siguiente visita" (`adminRecipes.retryNext`), and it does not
until the clean-up removes the pointer; and the page with no picture to review gives three
causes when the dish may never have had one (`nothingBody`).

**With phase 2, `/privacidad` does not change**, nor does `privacy.updated` (with phase 3 it
does: § 4.2 b):

- **There are no personal data** (GDPR art. 4.1: "any information relating to an identified or
  identifiable natural person"; art. 2.1: the Regulation applies to the processing "of
  personal data"; recital 26: it does not apply to "information which does not relate to an
  identified or identifiable natural person"). The file is a photo of food made from the
  recipe; the pointer carries a path with the recipe's id, a model, a version and words from
  the catalogue. An allergen key here describes a picture and a recipe, not anybody's allergy:
  it is not a health datum (art. 4.15).
- **There is no new recipient** (art. 13.1.e): Vercel is already named, with "las imágenes de
  los platos, en la Unión Europea" (`es-ES.ts:2229`; `en-GB.ts:2187`), and the second store is
  in `fra1`.
- **There is no new purpose and nothing a person sees differently** (arts. 13.1.c and 13.3):
  the policy is information given to data subjects about their data, and nobody has one more
  datum processed.
- **The sentence in force is still true** (art. 5.1.a): "Las imágenes se guardan en Vercel, se
  muestran a todas las personas que ven ese plato y llevan la marca «IA»" (`es-ES.ts:2221`)
  speaks of the dishes' pictures, and a rejected one is no dish's picture and is shown to
  nobody. "un modelo que ejecuta DeepInfra comprueba que la imagen no muestra alimentos que la
  receta no lleva" still describes the only door through which a picture reaches a person.
  **Phase 3 does force a return to that sentence**, and it has been returned to: it changes
  (§ 4.2 b).
- **The trail**: discarding writes a `picture.discarded` row with the owner's id as the author,
  as `picture.retried` has since 008 (and, since phase 3, `picture.accepted` and
  `picture.removed`: § 4.4). It is a datum of the controller's own in his own action log: there
  is no data subject to inform. If somebody else ever administers it, it will be a datum of
  theirs ([`analysis.md` § 1](./analysis.md), the table of what is left when an account is
  deleted, the `audit_logs.actorId` row).

`/condiciones` does not change either: § 3.3's sentence speaks of the pictures that are shown.

### 4.4 Accepting against the judge, and withdrawing (009, phase 3; withdrawing any, 010 phase 4)

**What happens, in data terms.** No personal datum goes in or out. Accepting moves a file — a
photo of food made from the recipe — from the private store to the public one and changes a
`recipe_images` row; withdrawing deletes the public file and returns the row to `failed` with
the closed reason `owner_removed` (`RecipeRepository.ts:957-986`) and, since 010 phase 3, with
what the judge answered about the dish (§ 4.5). There is no new recipient: Vercel already
stores and serves the pictures. The only thing that names anybody is the trail, and it names
the owner (below).

**Since 010 phase 4, "Withdraw" works for any published picture**, whether the judge or the
owner accepted it by hand: the only condition is that the row be `ready`
(`RecipeRepository.ts:1020-1056`, the condition at `:1041`, phase 4's tree); the `handAccepted`
clause IMG-16 cited no longer exists. A dish with no published picture answers 409 and nothing
is written (`RecipeController.ts:798-800`, phase 4). What it does is the same as above, for
both doors: the row first (from that instant no screen receives the address), then the public
file, with the same cache limits (the table below). The judge's answers are kept on the row
(`provenance.drawings`, § 4.5), which no API response shows; the rest of what the door left —
the mark of the acceptance by hand and the overridden allergens — is removed (`keepingDrawings`,
`RecipeRepository.ts:1036`, phase 4). **Withdrawing publishes nothing**: it writes no `ready`
row, so `0072`'s two doors are still the only ones through which a picture reaches a person.
And it changes neither what data are collected nor what reaches a model: it calls none.

**The files that may stay where they should not.**

| Case | What is left | Who can see it | How it is fixed |
| --- | --- | --- | --- |
| **A public orphan after an acceptance** | The acceptance writes the file to the public store **before** the transaction that publishes it (the other order would publish a row with no file). If the function dies between the two, if the transaction fails and the deletion afterwards does too, or if there is no way to know how the transaction ended, a picture the judge rejected is left in the **public** store, with no row pointing at it (`RecipeController.ts:405`, `:437-460`; `0072` § Consequences; `apps/api/AGENTS.md`, step 5) | Anybody **who has the address**, and nobody has it: it carries a random UUID (`PictureCandidates.service.ts:182`), it is returned in no response, stored in no row, and the code writes it to no log. That is obscurity, not privacy, and `0072` says so in those words. The file carries its C2PA; loose, it carries no visible notice | Nothing picks it up. The owner, by hand, in Vercel's dashboard: the `dish-pictures/<recipe id>/` folder, the file that is not the dish's current picture |
| **A withdrawal with the file not deleted** (`fileDeleted: false`) | The row first, the file after: if the deletion fails, the withdrawal stands and the file is still in the public store (`RecipeController.ts:781-789`; phase 4: `:812-818`). **Since 010 phase 4, a second cause**: if the address the row holds is in **another** recipe's folder, nothing is asked of the store — withdrawing one dish never deletes another's file — and the withdrawal stands all the same (`PictureCandidates.service.ts:210-215` and `DishPicture.ts:70-74`, phase 4). No code writes such a row today (the acceptance and the drawing upload to their own recipe's folder); it could only come from a data migration | Anybody with the address, and **this address was handed out**: the app of every person who opened the dish had it. No screen receives it from this dish again | The console says so (`removeLeftover`) and the owner deletes it by hand. **In the second case nothing has to be deleted**: that file is another dish's picture, and the console's text does not distinguish the two cases (P3, below) |
| **A withdrawal with the file deleted** (`fileDeleted: true`) | Copies outside the store. Vercel: "Since blobs are cached, it may take up to one minute for them to be fully removed from the Vercel CDN cache" (*Using the Blob SDK*, `del()`, upd. 2026-08-26). And the file was published with a year of cache (`VercelBlobPictureStore.ts:11` and `:70`; `cacheControlMaxAge` configures "the edge and browser cache"): a browser that already loaded it keeps its copy | Whoever already saw it, on their own device. The web app's service worker stores no pictures (`DishPicture.tsx`, the comment; `sw.js`), but it does store copies of up to two pages for offline use, which may keep naming the address until they are refreshed. **I have not measured** how long it takes to disappear from a phone | It is not fixed: that is the limit of "Withdraw", and the acceptance notice must say so (below) |

**Does it matter legally?** There is no period and no right of anybody's at stake: they are not
personal data (GDPR art. 4.1), so neither art. 5.1.e nor art. 17 applies. What there is is risk
IMG-2 with less mitigation: a rejected picture, reachable without its label by whoever has the
link (IMG-13 and IMG-14, § 5).

**The trail: `picture.accepted` and `picture.removed`.**

| Field | What it carries | A personal datum? |
| --- | --- | --- |
| `actorId` | The id of the admin account that accepted or withdrew (`RecipeController.ts:429` and `:766`; phase 4: `:449` and `:795`) | **Of the owner's, yes**: it is a datum of his. **Of a third party's, no** |
| `entity`, `entityId` | `recipe` and the recipe's id | No: a recipe belongs to nobody (`0028`) |
| `metadata` | In `picture.accepted`, `{ allergens }`: the allergen keys the judge flagged, **all** of them, a trace's included (`candidateFlags`, `PictureCandidate.ts:80-88`; `Audit.ts:66`). In `picture.removed`, empty until 010 phase 4 (`Audit.ts:68`); **since that phase, `{ acceptedBy }`**, a closed word, `judge` or `owner`: through which door the withdrawn picture had arrived, read from the locked row in the same transaction (`Audit.ts:72-74`, `DishPicture.ts:102-104`, `RecipeRepository.ts:1049`, phase 4). Rows written before stay with `{}` | No. An allergen key here describes a picture, not a person's allergy: it is not a health datum (art. 4.15). `acceptedBy` describes a picture: `owner` names nobody `actorId` did not already name, and `judge` names a model. No path, no address and no words from the model (`RecipeAcceptance.test.ts:226`; phase 4, `:707` and `:729`, which check the whole row) |
| `subjectUserId`, `ipHash` | Empty (`AuditRepository.ts:51`: "never an IP address") | — |

Confirmed, therefore: **no personal datum of a third party's**. For the owner it is a datum of
his own in his own log: he is at once the controller and the only data subject, there is nobody
to inform (arts. 13-14) and the record of processing gains neither a row nor a category
(art. 30.1.c: "categories of data subjects"; the owner is not a data subject of his own
processing in any useful sense). **The period**: the code never deletes an `audit_logs` row; on
deleting an account, `actorId` is set to `NULL` (`platform.schema.ts`, `onDelete: 'set null'`).
While a single person administers it, art. 5.1.e requires nothing. **If somebody else ever
administers it**, those rows are data of theirs: they will have to be informed, a period fixed
and it noted in the record ([`analysis.md` § 1](./analysis.md), the `audit_logs.actorId` row).

What the trail is also for: it is the owner's **evidence of diligence**. Whoever provides a
service answers for damages "unless they prove that they complied with […] the other care and
diligence the nature of the service requires" (TRLGDCU art. 147). The row says what he was
warned of and when he decided. It cuts both ways: it proves he was warned, and by that very
token it proves he published knowing it **[lawyer]**.

**The console's texts, sentence by sentence against the code** (`frontend`'s tree,
`adminPictureReview`, `es-ES.ts:508-593`; only the owner reads them, so they are measured not by
consumer law but by this directory's rule: no text the code does not support).

| Sentence | True? | Source |
| --- | --- | --- |
| "La imagen se publica para todas las personas que reciban este plato." | Yes: the picture belongs to the recipe, which is shared | `RecipeRepository.ts:107-150`; `PlanRepository.ts:336` |
| "Si muestra un alimento con un alérgeno que el plato no lleva, una persona con esa alergia puede desconfiar de un plato que es seguro para ella." | Yes: it is IMG-2, said without exaggerating it or playing it down | § 5 |
| "Los alérgenos del plato los decide la receta, no la imagen: aceptarla no cambia lo que el plato lleva ni a quién se le da." | **Yes.** The acceptance writes to `recipe_images` and to `audit_logs` and to nothing else. In `packages/core`, that table is read only by the recipe, plan and console repositories, and the plan one reads the status and the address to draw it (`PlanRepository.ts:336`, `:464-468`), not to choose dishes. The allergen gate runs against the ingredients (`0004`) | the ones cited; `picture-doors.spec.ts` |
| "Queda en el registro de acciones, con tu cuenta y los alérgenos que el revisor señaló." | **Yes**, and in the same transaction that publishes: with no audit row there is no published picture | `RecipeController.ts:429`; `RecipeAcceptance.test.ts:492` |
| "Se puede deshacer: «Retirar» deja el plato sin imagen otra vez." | **Half true (P3).** It leaves the dish with no picture, yes. It does not undo what has been seen: cached copies (the table above). And it does not bring the candidate back: the private file was deleted on accepting | `RecipeController.ts:462-468`; `VercelBlobPictureStore.ts:11` |
| Step 2: "He visto la imagen y la publico aunque el revisor vio en ella: {alérgenos}" | Yes. The request repeats those keys and **that** candidate's expiry; the server refuses anything else. That he really looked at it is something nobody can check | `RecipeController.ts:383-389`; `PictureAcceptAction.tsx:121-123` |
| "…se publica tal cual…" | Yes: the same bytes | `RecipeAcceptance.test.ts:186` |
| Withdrawing: "El plato vuelve a quedarse sin imagen para todas las personas que lo reciban, y el archivo publicado se borra." | **Half true (P3).** The first part, yes, from the instant the row changes. "Se borra": from the store, if the deletion does not fail; Vercel's network may serve it for up to a minute more and a browser keeps its copy | the table above |
| "Espera al menos 7 días antes de volver a dibujarse solo, salvo que lo reintentes a mano desde Recetas." | Yes: `lastAttemptAt = now`, a whole wait; the manual retry accepts any `failed` row | `RecipeRepository.ts:971`; `RecipeController.ts:864-872` |
| "Queda en el registro de acciones, con tu cuenta." | Yes, in the same transaction | `RecipeController.ts:766` |
| `removeLeftover` (`fileDeleted: false`): "La imagen está retirada: el plato ya no la muestra a nadie. Pero su archivo no se ha podido borrar del almacén público y sigue ahí hasta que lo borres a mano." | Yes. It is missing **where** (P3) | `RecipeController.ts:781-789` |
| `acceptedHelp`: "Retirar deja el plato sin imagen para todos y borra el archivo publicado. No cuesta nada." | Yes, with the same caveat about the cache; it need not be repeated here, the dialogue says it | — |
| `pictureNotAcceptable`: "…no es un JPEG con la firma C2PA…" | Imprecise and consistent: what is checked is that the **manifest** is there, not its signature (§ 1.7). The whole product has called it "firma C2PA" since phase 1; I am not asking for a single sentence to change | `apps/api/AGENTS.md:294-296` |

**Is the notice enough for the owner's decision to be an informed one?** No article sets what
whoever deploys must read before publishing an output: art. 50 governs what is said to the
public, and art. 4 asks that whoever handles the system understand it. Measured against what the
decision needs, **yes, it is enough**: he has the picture at full size, the dish's ingredients
with their grams, its allergens and traces, the allergens and the catalogue ingredients the
judge recognised, the consequence for a person with an allergy, that the allergy guarantee does
not move, that it is recorded and that it can be withdrawn; and the second step makes him repeat
the allergens. Two things are missing for it to be complete, both of wording (P3). **The table's
four wordings have been taken as they stand, in both languages (the lead, 2026-09-30)**, and
**checked that same day in the working tree of `main`** to be there letter for letter
(`es-ES.ts:524-531`, six bullets; `:577` and `:581`; and their pairs in `en-GB.ts`). The "True?"
column above therefore describes the **previous** texts in the three rows marked "Half true" or
"missing where": with the new wording all three are true.

One more string, which `frontend` added afterwards and I did not ask for (`publishedLoadFailed`,
`es-ES.ts:573`; `page.tsx:197`): "No se ha podido cargar la imagen publicada: puede que su
archivo ya no esté. Recarga la página; si sigue sin verse, retírala para que el plato vuelva a
dibujarse." It is true except at the end: withdrawing does **not** draw the dish; it leaves it
with no picture and waiting at least 7 days, or until it is retried by hand
(`RecipeRepository.ts:971`). P3; proposed wording: `…si sigue sin verse, retírala: el plato se
queda sin imagen y se vuelve a dibujar pasados al menos 7 días, o antes si lo reintentas desde
Recetas.` / `…if it still does not show, remove it: the dish is left without a picture and is
drawn again after at least 7 days, or sooner if you retry it from Recipes.`

The wordings taken:

| Key | es-ES | en-GB |
| --- | --- | --- |
| `adminPictureReview.acceptEffects[4]` (today: "Se puede deshacer: …") | `Se puede retirar después: «Retirar» deja el plato sin imagen otra vez. No borra las copias que un navegador ya haya guardado.` | `It can be taken back later: “Remove” leaves the dish without a picture again. It does not delete the copies a browser has already stored.` |
| `adminPictureReview.acceptEffects`, one more bullet, before the log's one (optional) | `El revisor solo mira lo que sobra en la imagen. Si falta un ingrediente que el plato sí lleva, nadie lo ha comprobado: compárala tú con la lista del plato.` | `The checker only looks at what is extra in the picture. If an ingredient the dish does contain is missing, nobody has checked that: compare it with the dish’s list yourself.` |
| `adminPictureReview.removeBody` (only the first sentence changes) | `El plato vuelve a quedarse sin imagen para todas las personas que lo reciban, y el archivo publicado se borra del almacén. La red de Vercel puede seguir sirviéndolo hasta un minuto, y un navegador que ya lo cargó conserva su copia. Espera al menos 7 días antes de volver a dibujarse solo, salvo que lo reintentes a mano desde Recetas. Queda en el registro de acciones, con tu cuenta.` | `The dish goes back to having no picture for everyone who gets it, and the published file is deleted from the store. Vercel’s network may go on serving it for up to a minute, and a browser that already loaded it keeps its copy. It waits at least 7 days before it is drawn again on its own, unless you retry it by hand from Recipes. It is recorded in the audit log, with your account.` |
| `adminPictureReview.removeLeftover` | `La imagen está retirada: el plato ya no la muestra a nadie. Pero su archivo no se ha podido borrar del almacén público y sigue ahí hasta que lo borres a mano, en el panel de Vercel: en el almacén de las imágenes, la carpeta dish-pictures y, dentro, la que lleva el id de este plato (está en la dirección de esta página).` | `The picture is removed: the dish no longer shows it to anyone. But its file could not be deleted from the public store, and it stays there until you delete it by hand, in the Vercel dashboard: in the pictures’ store, the dish-pictures folder and, inside it, the one named with this dish’s id (it is in this page’s address).` |

<!-- Source: Vercel, *Using the Blob SDK*, `del()` and `put()` → `cacheControlMaxAge` (upd. 2026-08-26); `VercelBlobPictureStore.ts:11` and `:70`; `RecipeController.ts:755-790`; `PictureCandidates.service.ts:182` (the public path is `dish-pictures/<recipe id>/<version>-<uuid>.jpg`); the page is `/admin/catalogo/<id>/imagen`. The second bullet: `judge.ts:16-18` (the judge only rejects what is extra; IMG-1). AI Act art. 4. -->

**The console texts 010 phase 4 brings**, sentence by sentence against the code (phase 4's
tree, `es-ES.ts` and their pairs in `en-GB.ts`). The same rule: only the owner reads them.

| Sentence | True? | Source |
| --- | --- | --- |
| `judgeAcceptedTitle` / `judgeAcceptedIntro`: "Imagen aceptada por el revisor" / "La imagen de este plato está publicada: la aceptó el revisor. La ven todas las personas que reciben el plato." | **Yes.** It is shown on a `ready` row that does not carry the mark of the acceptance by hand, and every such row was left by the judge's door: migration `0042` emptied the table of the earlier illustrations, and since then `ready` is written only by the drawing after the judge's acceptance and by the acceptance by hand, which leaves its mark | `es-ES.ts:564-568` (phase 4); `DishPicture.ts:102-104` (phase 4); migration `0042` (the final `DELETE`); § 4.2 b, the comment |
| `judgeAcceptedHelp`: "Si muestra algo que el plato no lleva, retírala: el plato se queda sin imagen para todos y se borra el archivo publicado. No cuesta nada." | Yes, with the cache caveat above, which the dialogue states. "No cuesta nada": withdrawing calls no model and does not count towards the cap | `RecipeController.ts:784-819` (phase 4); `apps/api/AGENTS.md`, "Remove" (phase 4) |
| `judgePublishedCaption`: "Imagen generada por IA. La aceptó el revisor y está publicada: es la que ven las personas que reciben este plato." | Yes. And the console labels it as AI, like the rejected one (§ 1.6) | the ones above |
| `removeBody`, the new sentence: "…se borra del almacén: esta imagen no se puede recuperar." | **Yes.** The row loses the address, the public file is deleted and, if a candidate's pointer was left, its private file too; nothing keeps a copy | `RecipeRepository.ts:1033-1040`; `RecipeController.ts:802-818` (phase 4) |
| `removeTitle`: "¿Retirar la imagen de {dish}?" | Yes | — |
| `pictureNotRemovable`: "Esa imagen no se puede retirar: el plato ya no tiene una imagen publicada." | Yes: it is the 409 of a row that is not `ready` | `RecipeController.ts:798-800` (phase 4) |
| Recipes' help (`es-ES.ts:887`, phase 4): "Toda imagen lista se puede retirar, la aceptara el revisor o tú a mano…" | Yes | `RecipeRepository.ts:1041` (phase 4) |
| The `owner_removed` reason and Pictures' help: "Retiraste una imagen publicada: la había aceptado el revisor o la aceptaste tú a mano…" | Yes | `RecipeRepository.ts:1036` (phase 4) |
| The action log: `picture.removed` "Imagen publicada de un plato, retirada", and `removedAcceptedBy`: "La había aceptado el revisor" / "La habías aceptado a mano, contra el revisor"; a row from before phase 4 says nothing | Yes: it reads `acceptedBy` and nothing else | `es-ES.ts:185` and `:206` (phase 4); `Audit.ts:72-74` (phase 4) |
| `removeLeftover` (unchanged): "…la carpeta dish-pictures y, dentro, la que lleva el id de este plato…" | **Half true (P3), in the new case only.** When the withdrawal refused to delete a file in **another** recipe's folder, the API answers the same, `fileDeleted: false`, and the text sends the owner to a folder where that file is not; the file the row named is another dish's picture and must not be deleted. Nobody is affected (there are no personal data and nothing is deleted by mistake: the text points at this dish's folder), and today no code writes such a row. The smallest change: have the response distinguish the case and the console say "there is nothing to delete". Passed to the lead (2026-09-30); it does not block. Proposed wording for that case: `La imagen está retirada: el plato ya no la muestra a nadie. Su archivo no se ha borrado porque está en la carpeta de otro plato: es la imagen de ese plato y no hay que borrarlo.` / `The picture is removed: the dish no longer shows it to anyone. Its file was not deleted because it is in another dish’s folder: it is that dish’s picture and must not be deleted.` | `PictureCandidates.service.ts:210-215`; `RecipeController.ts:812-818` (phase 4) |

<!-- Source: the tree `.claude/worktrees/phase4-010` over `8e9ca114`, uncommitted: `RecipeRepository.ts:1020-1056`, `RecipeController.ts:784-819`, `PictureCandidates.service.ts:210-227`, `DishPicture.ts:70-104`, `Audit.ts:72-74`, `es-ES.ts` and `en-GB.ts` (the `adminAudit`, `adminPictureReview`, `adminPictures`, `adminRecipes` and `errors` namespaces). Migration `0042_a_picture_is_a_url_with_its_drawing_state.sql`. PRD 010, criterion 9; `0073`; report `0006`, question 4. No new rule: texts only the controller reads, measured with this directory's rule (GDPR art. 5.1.a does not reach them: they inform no data subject). -->

**`/condiciones`**: § 3.3's sentence is still true ("Lo que lleva cada plato lo dice su lista
de ingredientes"). It says the pictures "pueden no mostrar todos sus ingredientes ni su
cantidad real", and stays silent on the opposite: that they may show something the dish does
not contain. That could already happen before this phase (the judge lets through what is extra
with no foreign allergen) and now it can happen with an allergen. **It is not a condition of
the phase**; if the owner changes `/privacidad`'s sentence, it is worth matching it in the same
change, with `terms.updated` (P3). **Not taken** (the owner, 2026-09-30): `/condiciones` stays
as it is. The text is kept in case it reopens:

| es-ES | en-GB |
| --- | --- |
| `…y pueden no mostrar todos sus ingredientes ni su cantidad real, o mostrar algo que el plato no lleva. Lo que lleva cada plato lo dice su lista de ingredientes, y es la que tiene en cuenta tus alergias.` | `…and may not show all of its ingredients or its real quantities, or may show something the dish does not contain. What each dish contains is what its ingredient list says, and that list is the one that takes your allergies into account.` |

<!-- Source: TRLGDCU art. 60.1; Act 3/1991, art. 7.1 (omission of necessary information); Act 7/1998, art. 5.5. It only informs: it is not an "important change" and requires no advance mail (§ 3.3). -->

### 4.5 What the judge said is stored (010, phase 3)

**What is stored.** In `recipe_images.provenance.drawings`, for each attempt that reached the
judge (both calls answered and the rule ran): the time of the judgement, the attempt's number,
what the vision model said it saw (each food's name, amount and whether it is specific; things
that are not food; sharpness, realism), the cross-check against the recipe's ingredients, the
verdict and its notes. Once per drawing, the recipe as it was judged: the name and the
ingredients with their grams. At most 3 drawings of 3 attempts per dish, with a cap on every
list and every string; what does not fit is cut, and an attempt that still exceeds 6 KB is not
stored (`PictureJudgement.ts:24-41`, `:74-97`, `:249-294`).

**Does it name or describe anybody?** No.

- The schema is closed (`strictObject`) and is filled only with the answers, the verdict, the
  time and the attempt's number (`DishPicture.service.ts:361`), and with the recipe
  `pictureRecipe` reads (the name and the ingredients, `RecipeRepository.ts:857-879`).
  **Nothing from the claim or the request**: no user id, no session, not who opened the dish.
- What the vision model describes is a picture generated from the recipe alone (§ 4.1). A word
  of its own ("hand", "tablecloth", a food) describes that picture, not a person: it is not
  information "relating to a natural person" (GDPR art. 4.1; recital 26).
- The recipe's name is written by the model that designs the dishes, or comes from the library:
  the only writer of `recipes` sets `source: 'ai'` and takes the name from the model's draft
  (`PlanRepository.ts:1246-1262`); no path stores a name a person wrote. It is the same input
  the drawing already receives.
- `recipes.createdBy` still ties a generated recipe to the account that generated it, as before
  ([`analysis.md` § 1.1](./analysis.md)); the recipe's copy does **not** copy it, and a recipe
  belongs to nobody (`0028`).
- Each judgement's time (`at`) follows a visit, as `lastAttemptAt` has since 006: it travels
  with no identifier (§ 4.1, the rejected picture's row).

**Is anything left false or incomplete in the record or the DPIA?** No. There is no new
category of personal data, purpose, data subject or recipient: the answers are produced by the
same providers that already produced them (§ 4.1), and they are stored in Neon, already named.
**The period**: as long as the dish's row lasts, which is deleted with the recipe
(`recipe.schema.ts:139`, `ON DELETE CASCADE`); recipes are not deleted when an account is.
Bounded **in size** (3 × 3), **not in time**. Art. 5.1.e only limits the retention of personal
data. Noted in the record and in the DPIA, with no new row.

**Does it leave the API?** No, per the code: the console reads `provenance - 'drawings'`
(`AdminCatalogueRepository.ts:172`; `AdminRepository.ts:103`, which feeds the counts and the
failure mail); the candidate's read takes only the pointer from the row
(`RecipeController.ts:146`); the acceptance by hand writes it back to the row, not to the
action log (`RecipeController.ts:439`); the service's `logger.warn` calls carry the recipe's id
and a reason, not the answers (`DishPicture.service.ts:266`, `:399`, `:430`, `:455`).

**Does storing a model's output without showing it require anything?**

- **The AI Act**: no. Art. 50.2 asks that the synthetic content the system generates be marked
  so it can be detected; these words are a technical output, inside an internal flow with
  access control, that reaches nobody: the case the guidelines treat separately (point 87,
  § 1.6). 50.4-50.5 is towards the public, and here there is no public. The logs of arts. 12
  and 26.6 are for high-risk systems only, and this is not one. Nothing in the Regulation
  forbids or requires storing the output.
- **Consumer law**: no. With no communication to the consumer there is no commercial practice
  (TRLGDCU art. 19.2), and these words reach none.
- **The providers' terms**, as this directory records them: nothing limits NutrIA storing what
  they answer. The "OpenRouter use of inputs/outputs" setting
  ([`go-live-checklist.md`](./go-live-checklist.md)) is about OpenRouter's use, not NutrIA's.
  **DeepInfra's terms on its outputs I have not read** (the same gap as IMG-9 for Google): P3.
- **The day a screen, an export or a mail shows these words to somebody**, it is back to § 1
  and § 4.2.

**`/privacidad` is still true.** "Ninguno guarda la petición ni la usa para entrenar" speaks of
the providers (OpenRouter, Google, DeepInfra), not of NutrIA; "Nunca recibe nada tuyo, ni
siquiera quién ha abierto el plato" does not change, because the calls do not change. The
plans' paragraph ("Nadie entrena con ello ni lo guarda") speaks of the dish-design request, not
of this one. No published sentence promises that NutrIA does not store what the judge answers
(`es-ES.ts:2280-2290`, in `main`). **No change of text and none to `privacy.updated`.**

<!-- Source: GDPR (the OJEU text in the BOE, PDF `L00001-00088`) arts. 2.1, 4.1, 5.1.e and 30.1, recital 26; Regulation (EU) 2024/1689 arts. 50.2, 50.4, 50.5 and Guidelines C(2026) 5054 final, point 87 (consulted on 2026-09-30 for § 1.6; not re-consulted in this revision); arts. 12 and 26.6 (logs, high-risk only): **not consulted for this revision**, a reading of their titles and their chapter (III, high risk) that a lawyer can check in a minute; TRLGDCU (BOE-A-2007-20555, consolidated to 28/02/2026) art. 19.2. The code: the tree `.claude/worktrees/backend-010-3` over `f81e834`. -->

### 4.6 A dish's own form is not an extra food (010, phase 2)

**What the rule does, read in the code.** The judge is unchanged: the two calls to the model,
what they are asked and the blind design do not change, and the allergens still come from the
catalogue, not from the model (`judge.ts:24-66`; `0073`). What changes is how the code reads a
name the vision model wrote:

- **The own form.** If the name contains a form word ("pancake", "bread", "roll", "meatball",
  "milk", "cream", "yogurt", "cheese"…) and the dish has its own version of that family, that
  word contributes no allergens; the rest of the name is read as before ("cheese pancakes" is
  still cheese; "wheat noodles", wheat). "Its own version" is decided in code, with closed
  tables (`forms.ts:51-291`), in two ways: an ingredient of the dish that **is** that form (a
  catalogue slug: `pan-sin-gluten`, `leche-de-coco`, `heura`…) or a word in the **dish's name**
  that names it ("tortitas", "albóndigas", "pizza", "bocadillo"…) (`judge.ts:337-365`).
- **Only while everything else in the name belongs to the dish** (tightened after the first
  invariant review). The form word is excused only if each of the other words in the name is a
  serving word ("glass", "bowl", "cup"…, `forms.ts:359`), is a word from the dish's own
  ingredients, or leads only to the dish's ingredients; and never if the whole name is a
  catalogue product with an allergen the dish does not have (`judge.ts:590-628`,
  `aProductOfItsOwn` and `stillTheDishes`). That is why "goat cheese" beside a vegan cheese,
  "cow's milk" beside a soy shake, "heavy cream" beside a curry made with coconut milk, or
  "spring roll" and "soda bread" beside a gluten-free toast **reject again**
  (`judge.forms.test.ts:232-239`, `:448`, `:495` and `:516`). A "glass of milk" is still
  excused: "glass" is a serving word.
- **Only where the dish's name really names it** (also tightened): a title word that is negated
  ("sin pan", "without bread", "sin el pan") or followed by "free" ("bread-free") does not
  count, and a negated one removes the whole family ("quiche sin masa" does not name pastry)
  (`forms.ts:327-336`; `judge.ts:350-358`); the ambiguous Spanish words "tostada(s)",
  "tosta(s)", "rebanada(s)", "taco(s)", "empanada(s)" and "pastel(es)" count only as the
  title's first word and not before "de" (`forms.ts:299-325`; `judge.ts:356`), so "tostadas de
  boniato", "tacos de lechuga" or "pastel de verduras" name neither bread, nor tortilla, nor
  sponge; and the English "cakes" and "pie" are no longer title words ("fish cakes", "cottage
  pie"; `forms.ts:126-155` and `:187-215`). All those cases reject, fixed in
  `judge.forms.test.ts:643-685`.
- **What else bounds it**: narrow families (bread does not excuse pancakes); batter and nuggets
  or croquettes, by the dish's name only; rice or corn cakes are neither sponge nor pancakes; a
  bare "burger" still rejects (its bun); a name of the same form beside another that says more
  ("milk" or "cow's milk" beside "soy milk") is still a second food (`judge.ts:546-580`).
- **The note.** When the exception removes an allergen, and only then, the verdict carries
  `own_form:<names>` (`judge.ts:650-661` and `:720`).
- **Three vocabulary fixes**: words that are not food ("base", "glass", "bowl"…) are not read
  on their own (`forms.ts:347-359`; `judge.ts:457`); "soy yogurt" or "coconut milk" are read as
  the plant, not as the dairy, and "plant milk" is read as nothing; outside that case, "plant"
  is food again ("plant protein" is still the catalogue's plant protein, and its soy)
  (`forms.ts:361-387`; `judge.ts:367-383`; `forms.test.ts:459-465`); and a sulphite a food only
  **may contain** never rejects a picture any more, while one it **does contain** (dried
  apricots, wine) does, including when another catalogue row with the same word may only
  contain it (`forms.ts:389-394`; `judge.ts:467-470` and `:586`; `forms.test.ts:495-515`;
  `judge.forms.test.ts:636-640`; the owner's decision, 2026-09-30).

**Personal data: none new.** What goes into the rule is the recipe exactly as the drawing has
received it since 006 (`PictureRecipe`: the name and the ingredients, `prompt.ts:18`) and the
vision model's answers about a photo made from it. The dish's name **already was** input to the
drawing (§ 4.1); what is new is that it now weighs on the verdict too. Today no path stores a
recipe name a person wrote (§ 4.5), although `recipe_source` allows `user`
([`textos/06`](./textos/06-correos.md) § M, the source note): **if one day a person could name
a recipe, that name would go into this rule** and it would be back to here. The `own_form:`
note carries words from the model, like `extra_food:`, and it stays where the other notes and
the judgements stay (`provenance.judge`, `provenance.drawings`), which do not leave the API
(§§ 4.3 and 4.5). Neither the record of processing, nor the DPIA, nor `/privacidad` as art. 13
GDPR information changes because of this: there is no new datum, purpose, recipient or period
(GDPR arts. 2.1 and 4.1; recital 26).

**What the rule lets through on purpose.** `0073` says it: it accepts what a picture cannot
distinguish, **a second food of the same form the dish already has**. The cases fixed in the
tests (`judge.reverse.test.ts`, `ADDED_IN_PHASE_2`): a glass of milk or cream beside a curry
made with coconut milk; meatballs or a bunless burger beside a Heura stir-fry; toast, a roll or
croutons beside a gluten-free toast; pancakes or waffles on a dish whose name says "tortitas".
In the 20 sample recipes, out of 1,260 pairs, 22 more pass through the own form and 1 through
the sulphite (unchanged after the tightening: `judge.reverse.test.ts`, 83 + 22 + 1 = 106). In
the 500-dish library, **195 of 26,394 pairs** that used to be rejected, and **none** that used
to be accepted and is now rejected (per the lead, "0 newly rejected", which I read as against
the rule before 010; measured offline with the tightened rule; before the tightening it was
211; `0073`'s forecast was 229; **I have not checked it** and 010's LOG does not yet record
either figure). And, per the code, a dish name that names a form still excuses it even if the
dish does not have it ("tortitas de avena" excuse "pancakes"; a "hamburguesa de lentejas", a
"burger patty" of anything), but only now when the title's word is unambiguous and not negated:
"tostadas de boniato" no longer excuse bread toast (`judge.forms.test.ts:672`, which now fixes
it by rejecting). `0073` accepts the first ("the picture then matches what the person reads in
the title").

**Is `/privacidad`'s sentence still true?** The sentence (text A, § 4.2 b; `es-ES.ts:2288`,
`en-GB.ts:2243`):

> "Si ese modelo ve con claridad en la imagen un alimento con un alérgeno que la receta no
> lleva, la imagen se rechaza, y solo se publica si después la revisamos a mano y decidimos
> publicarla. Esa revisión no es una garantía: la imagen puede mostrar algo que el plato no
> lleva, y lo que lleva lo dice su lista de ingredientes."

1. **For almost everything, yes.** What phase 2 stops rejecting is above all the **faithful**
   picture (the corn-flour pancakes that were read as wheat): the sentence never promised to
   reject that, and now the code is closer to what it says. The plant fix makes it truer ("soy
   yogurt" is no longer milk). The sulphite one does not touch it: "un alimento **con** un
   alérgeno" reads as "that has it", and "may contain" is less than that.
2. **For one class, no.** This sentence's source tied it to a condition in the code: a specific
   food, more than a trace, with a catalogue allergen the dish does not have
   (`foreignAllergens.length > 0`, § 4.2 b's source comment). That condition has moved. A glass
   of milk beside a curry made with coconut milk is **clearly seen** (specific, not a trace),
   the catalogue says milk carries the allergen "milk", the recipe does not have it, and the
   picture **is published**. The sentence says it is rejected. **Re-read after the tightening**:
   the class is narrower (195 pairs instead of 211, after a third review that made the rule a
   closed list; "cow's milk", "goat cheese" or "heavy cream" reject again, and a negated or
   ambiguous title excuses nothing), but **it does not disappear**: "milk" and "cream" beside
   the coconut-milk curry, a roll beside the gluten-free toast or meatballs beside the Heura
   stir-fry are still accepted (`judge.reverse.test.ts`, `ADDED_IN_PHASE_2`), and each clearly
   shows a food that, per the catalogue, carries an allergen the recipe does not have.
3. **A reading that would save it, and why I do not rest on it alone.** It can be argued that
   the model does not "see" an allergen in a form: a white glass may be cow's or coconut milk,
   and a picture does not show what it is made of; "a food with an allergen" would then be one
   that lets it be seen (nuts, prawns, egg, cheese). It is reasonable, but the average reader
   does not read "un alimento con un alérgeno" that way: they read "milk". And § 4.2 b discarded
   variant B precisely for being "wider than the judge"; accepting that same width now without
   saying so would be measuring with two yardsticks **[lawyer]**.
4. **Why it is not P1.** The sentence is measured by consumer law, not by the GDPR (there are no
   personal data here, § 4.2 b point 1). Act 3/1991, art. 5.1: information is misleading where
   "even being truthful, by its content or presentation it misleads or is liable to mislead",
   among other things as to "the results and essential characteristics of tests or checks
   carried out" (point b), and provided it is "liable to alter their economic behaviour". Read
   **in full**, the sentence already warns that "la imagen puede mostrar algo que el plato no
   lleva" and that the list is what counts, which is exactly what happens in this class; the
   dish is safe; and nobody buys or does not buy because of this sentence. What is more, the
   sentence was never exhaustive: the 19 names with an allergen that translate to none (`0073`
   § Context; `judge.holes.test.ts`) already passed. The difference is that that was a gap and
   this is a rule written on purpose. **P2**: the same scale as IMG-15 before phase 3 ("the
   sentence already says more than the judge does"), which did not block.

**My reading, the same before and after the tightening: it does not have to change; I recommend
changing it.** It is **the owner's decision**: (a) leave it, accepting a known P2 noted here; or
(b) add a clause at the end of that sentence, which makes it true for this class too (and, if it
errs, it errs towards promising less control than there is):

| | es-ES | en-GB |
| --- | --- | --- |
| Today | `Si ese modelo ve con claridad en la imagen un alimento con un alérgeno que la receta no lleva, la imagen se rechaza, y solo se publica si después la revisamos a mano y decidimos publicarla.` | `If that model clearly sees in the picture a food carrying an allergen the recipe does not have, the picture is rejected, and it is published only if we then review it by hand and decide to publish it.` |
| Proposal (b) | `Si ese modelo ve con claridad en la imagen un alimento con un alérgeno que la receta no lleva, la imagen se rechaza, y solo se publica si después la revisamos a mano y decidimos publicarla; no cuenta lo que tiene la forma de algo que el plato ya tiene o que su nombre dice, como su pan o su leche, porque una imagen no muestra de qué está hecho.` | `If that model clearly sees in the picture a food carrying an allergen the recipe does not have, the picture is rejected, and it is published only if we then review it by hand and decide to publish it; something shaped like what the dish already has or its name says, such as its bread or its milk, does not count, because a picture cannot show what it is made of.` |

<!-- Source for (b), re-read against the tightened rule (the working tree of `main` over `28854ac`, uncommitted): `judge.ts:337-365` (an ingredient or the dish's name: "que el plato ya tiene o que su nombre dice"), `:572-580` and `:650-655` (the form word only: the rest of the name still counts, so "su pan", not "anything with bread"; and only when it removes an allergen). Both examples are still true: "su pan" (toast, a roll or croutons beside the gluten-free toast) and "su leche" ("milk" beside the coconut-milk curry or the soy shake) are in `judge.reverse.test.ts`, `ADDED_IN_PHASE_2`. The clause describes an exception **wider** than the code's, which still counts: a name of the same form beside another that says more ("milk" beside "soy milk", `:546-570`); a name with a word that is neither the dish's nor a serving word, or that is a catalogue product with a foreign allergen ("goat cheese", "cow's milk", "heavy cream", "spring roll", "soda bread", `:590-628`); a negated title ("sin pan", "bread-free") or one with an ambiguous word away from the head or before "de" ("tostadas de boniato", "tacos de lechuga", "pastel de verduras"), `:344-358` and `forms.ts:299-336`. In all those cases the clause would say "does not count" and the code counts it and rejects: promising less control than there is does not mislead (Act 3/1991, art. 5.1, which requires that the information be liable to mislead and to alter economic behaviour; saying that less is reviewed leads nobody to trust more). It only informs: it is not an "important change" and requires no advance mail (the same test as § 4.2 b). -->

- **Where**: `privacy`, the pictures' same paragraph (`es-ES.ts:2288`; `en-GB.ts:2243`); the rest
  of the paragraph does not change. And the same sentence in
  [`textos/02`](./textos/02-politica-privacidad.md) (line 149), if it is taken.
- **If it is taken**: `privacy.updated` with the date of the day it reaches production
  (`es-ES.ts:2359`; `en-GB.ts:2314`). `terms.updated`, no. **No advance mail**: it changes
  neither what data are processed, nor why, nor with whom.
- **Order**: the rule has no flag; it reaches production with the deployment. If the owner takes
  (b), the simple thing is for the dictionary to change in the same deployment as the rule or
  afterwards; it does not have to go first, because leaving it is P2.

**How a picture of that class is found and undone, today.** `0073` says "The note and 'Retirar'
are how it is found and undone". **Undoing it, yes; finding it, not from the console**:

- **"Withdraw" reaches it.** Since 010 phase 4 (`28854ac`, #178, deployed per the lead),
  "Withdraw" works for any published picture, the one the judge accepted through the own form
  included: the condition is `status = 'ready'` and nothing else
  (`RecipeRepository.ts:1041`), with no migration, with the `picture.removed` row and
  `acceptedBy: judge` (§ 4.4). IMG-16 is closed and this rule does not reopen it; what is left
  is IMG-14 (cached copies), as for any withdrawal.
- **The `own_form:` note does not leave the API** (phase 3 fixes that with tests; § 4.5): no
  console screen shows it, so nothing points the owner at which of the published pictures went
  through this exception. He only finds it with a read query over `recipe_images.provenance` in
  Neon, or in phase 6's production re-read; or by looking at the picture from Recipes ("Revisar
  la imagen"), like any other.

**What does not change** and is still true: the console's label "El revisor vio un alérgeno que
el plato no tiene" (the closed reason still comes from `extra_allergen:`,
`PictureReason.ts:67-69`); the acceptance notice's bullet "El revisor solo mira lo que sobra en
la imagen" (§ 4.4); the caption "Es orientativa: manda la lista de ingredientes" and
`/condiciones`'s sentence (§ 3); and the whole of §§ 1 and 2: the rule does not touch the file,
its C2PA, the "IA" mark or the caption (AI Act arts. 50.2, 50.4 and 50.5).

<!-- Source: the code in the working tree of `main` over `28854ac`, uncommitted, with the rule already tightened: `packages/core/src/domain/DishPicture/judge.ts:24-66` (the header), `:337-365` (`ownFamilies`, with the negation and the title's head), `:367-383` (`plantQualified`), `:457` (`NOT_A_FOOD` out of step 4), `:467-470` (a sulphite some row contains counts as contained), `:546-570` (`besideAnother`), `:572-580` (`ownForm`), `:586` (sulphites that only "may contain"), `:590-628` (`theDishes`, `aProductOfItsOwn`, `stillTheDishes`), `:650-661` (the exception counts only if it removes an allergen; `own_form`), `:710` (`rejecting`), `:720` (the note); `forms.ts:51-291` (the families; "cakes" and "pie" out of the titles at `:126-155` and `:187-215`), `:297` (`TITLE_NOT_A_FORM`), `:299-325` (`TITLE_ONLY_AS_HEAD`), `:327-336` (negations), `:345` (`SEEN_NOT_A_FORM`), `:347-359` (`NOT_A_FOOD`), `:361-387` (plant and dairy), `:389-394` (sulphites); `prompt.ts:18` (`PictureRecipe`); `judge.reverse.test.ts` (`ADDED_IN_PHASE_2`: 83 + 22 + 1 = 106 of 1,260); `judge.forms.test.ts:232-239`, `:448`, `:495`, `:516`, `:636-640`, `:643-685`; `forms.test.ts:254-256` and `:261`, `:459-465`, `:495-515`; the 1,158 tests of `packages/core/src/domain/DishPicture` pass (run by `legal` on 2026-09-30). `RecipeRepository.ts:1041` in `main` (`28854ac`). `PictureReason.ts:67-69`. `0073` §§ Context, Decision and Consequences; PLAN 010, phase 2, steps 5 and 8 and the stop signal; PRD 010, `legal`'s criterion. 205 of 26,394 (211 before), 0 newly rejected: the lead's figure, **not checked by `legal`**. Rules: Act 3/1991 (BOE-A-1991-628, consolidated to 27/12/2025), art. 5.1, point b; GDPR arts. 2.1 and 4.1 and recital 26 — consulted on 2026-09-30 for 009 phase 3 and not re-consulted; the citations are § 4.2 b's. -->

---

## 5. Risks, ordered by what can happen to a person

| # | What can happen | Severity | What prevents it |
| --- | --- | --- | --- |
| IMG-1 | A person with an allergy sees a photo without the food that harms them, even though the dish contains it (a sauce, a sesame oil "cooked inside"), and trusts the photo | **P1** (harm to health, even with the list right) | The allergen gate is code against the list, not against the picture (`0004`). The caption says "manda la lista de ingredientes". The terms say it (§ 3.3). The judge only rejects what is **extra**, not what is missing: the caption is the measure |
| IMG-2 | The photo shows a food with an allergen the dish does not contain (nuts in a nut-free dish). **Reviewed 2026-09-30 (009 phase 3)**: before, it could only happen if the judge did not see it; now it can happen because the owner publishes, by hand, a picture in which the judge **did** see it. If the judge was right, that picture really does show the food, and it is seen by everybody given the dish, until it is withdrawn. **Reviewed 2026-09-30 (010 phase 2): a third path, the judge's own rule.** The form the dish already has, or that its name says, does not count as an extra food (`0073`; § 4.6). That is how the faithful pictures that used to be rejected are accepted, and also, on purpose, **a second food of that same form** which the picture cannot distinguish from the dish's own: a glass of milk beside a curry made with coconut milk, a roll beside a gluten-free toast, meatballs beside a Heura stir-fry. Per the lead, 195 of 26,394 library pairs that used to be rejected, with the rule already tightened after the first invariant review, and none that used to be accepted and is now rejected, read against the rule before 010 (measured offline, not checked by `legal`; before the tightening, 211; `0073`'s forecast: 229). Here neither a model failure nor a decision of the owner's is needed: the rule accepts it | **P2, and the highest of the P2s.** The severity does not rise: the dish is safe, the recipe and the shopping list do not carry that food, and for there to be exposure somebody would have to cook "per the photo" and add it themselves. What happens to a real person is that they distrust a safe dish, skip it, or stop trusting the app. The **probability** rises (a model failure is no longer needed: a decision is enough) and the **nature** changes: it stops being a model's error and becomes an act of the owner's, warned and recorded, for which he answers (TRLGDCU art. 147) **[lawyer]** | **Two doors** (`0072`): the judge, or the owner's review. The second carries: (1) a notice naming the allergens and the catalogue ingredients the judge recognised, with the dish beside it (§ 4.4); (2) two steps, the second repeated on the server: the request must bring those same allergens and that same candidate's expiry (`RecipeController.ts:383-389`); (3) the `picture.accepted` row, in the transaction that publishes; (4) **"Withdraw"**, which takes the picture off the dish at once, with § 4.4's limits (cached copies); (5) the "accepted by hand" count in Pictures and its filter in Recipes, to look at them again. **What still holds for any picture**: the caption "Es orientativa: manda la lista de ingredientes", which is **only on the meal's page** (`meal.pictureCaption`, `es-ES.ts:1668`) — the console's card carries the "IA" mark and nothing else — and the terms' sentence (§ 3.3). **Since 010 phase 4, "Withdraw" also reaches a picture the judge accepted by mistake**: the owner takes it off from the console, with no migration, and the dish goes back to having no picture for everybody, with § 4.4's same limits (IMG-14; IMG-16 closed). What nothing does is **find it**: no code points at a picture the judge accepted wrongly; somebody has to see it and withdraw it. **For the third path (010 phase 2)**: the severity does not change (the dish is still safe; what happens is the same distrust) and the probability rises little and measurably. What mitigates it: closed tables, narrow families, the more complete name winning ("milk" beside "soy milk" still rejects), the excuse holding only while everything else in the name belongs to the dish and the whole name is not another catalogue product ("goat cheese", "cow's milk", "heavy cream" reject), a negated or ambiguous title naming nothing ("sin pan", "tostadas de boniato"), a test per row, the pilot (65 accepted, 3 controls rejected) as a floor that does not move, and the `own_form:` note stored with the picture. **One gap, today**: the note reaches no screen (only a read query in Neon or phase 6's re-read find it). 010's phase 4, merged before this rule (`28854ac`, #178), allows withdrawing a picture the judge accepted, through the own form included (IMG-16 closed; this rule does not reopen it). `/privacidad`'s sentence about the judge does not describe this class: P2, **the owner's decision** (§ 4.6) |
| IMG-3 | ~~A MAI picture reaches somebody with no machine-readable mark~~ | closed | MAI out by the owner's decision (2026-09-27) |
| IMG-4 | The console's card shows the picture with no notice | **P1** (arts. 50.4-50.5) | `picture.aiMark` (§ 3.2), on the card and on the large picture |
| IMG-5 | The policy says Google is not used and Google draws | **P1** (a text that would read as false) | § 4.2 a |
| IMG-6 | The store is created outside the EU and the policy says "in the European Union" | P1 (a false text about visitors' IPs) | `fra1` (§ 6) |
| IMG-7 | A public Blob path carries a user id | P1 (a personal datum exposed to anybody with the link) | Only the recipe's id and a hash (§ 4.1) |
| IMG-8 | Re-encoding strips Google's C2PA | P3 (measured: it arrives and is served untouched) | Serve the original ✔; validate the signature once over a file served by Blob (§ 2.3.1) |
| IMG-9 | Not having read Google Cloud's generative AI terms for this model (Microsoft's are no longer needed) | P2 (a licence to use) | Read them before switching on (§ 6). **I have not read them**; P1-10's "clinical practice" clause belonged to the Gemini API, and there is no clinical use here: they are photos of recipes |
| IMG-10 | A picture the judge rejected — it may show a food with an allergen the dish does not contain — reaches somebody other than the owner (009 phase 2) | P2 (the same confusion as IMG-2, and with no visible notice if it leaves as a loose file; the C2PA travels inside) | A separate **private** store, with its own token the API does not confuse with the public one (`Env.validation.ts:585-591`); admin-only routes, a 404 for everybody else; the file's path is in no response, log or error (`VercelBlobPictureCandidateStore.ts:44-60`); no automatic code publishes a candidate: since phase 3, only the owner's acceptance by hand (§§ 4.3, 4.4), and that is already IMG-2. A file with no C2PA is never stored |
| IMG-11 | A text promises the rejected picture is deleted after 7 days and a file lasts longer (a delayed clean-up, or an orphan with no pointer) | P3 (nobody is affected: there are no personal data and no legal period; it would be an inaccurate text, and only the owner reads it) | Write "at most 7 days" in no text (§ 4.3); the review page says "hasta el {date}" and "Después la borra la limpieza nocturna, normalmente la noche siguiente"; empty the private store by hand if it ever matters |
| IMG-12 | The owner accepts by hand a file **with no C2PA manifest** (009 phase 3): an AI picture published with no machine-readable mark, and § 4.2 b's last sentence would be false | P1 if it happened (art. 50.2; a false text). A very low probability | A file with no C2PA is not stored as a candidate; and, even if the row said it carried one, the acceptance looks again at **the bytes it is about to publish** and rejects (409 `PICTURE_NOT_ACCEPTABLE`) anything that is not a JPEG with its manifest (`RecipeController.ts:393-402`; `RecipeAcceptance.test.ts:425-462`). Those same bytes are published, with no re-encoding. It is a compliance rule, not a technical preference. **The limit**: it is checked that the manifest is there, not its signature, as at the judge's door (§ 1.7; § 2.3.1's pending P3) |
| IMG-13 | A picture the judge rejected stays in the **public** store, at a random address, with no row pointing at it (009 phase 3): the function died between uploading and publishing, or the deletion afterwards failed (`0072` § Consequences; § 4.4) | P3. Nobody has the address: it is not returned, not stored and the code does not log it; whoever had it would see a photo of food with no visible label, with its C2PA inside. It is IMG-10's same confusion, protected by obscurity rather than by a private store: that is why it is not P2 only while the address does not get out | The order is deliberate (the other way round there would be a published picture with no file). Nothing picks it up: the owner can delete it by hand in Vercel's dashboard. **Checked by the lead on 2026-09-30: it could get out.** Vercel's message for a failed deletion from the public store could carry the address, and it was written to the log (`PictureCandidates.service.ts:213`, through `VercelBlobPictureStore.ts`, which also kept the original error as `cause`). **Fixed and checked on 2026-09-30 in the working tree of `main`**: `del` and `put` replace the address and its path with `[picture]` in the message and throw a new error **with no `cause`** (`VercelBlobPictureStore.ts:43-54`, `:76-80` and `:89-97`; `VercelBlobPictureStore.spec.ts:99-125`). With that, `0072`'s "never logged" is true again for this case. What the sanitising cannot remove is an address Vercel wrote some other way (encoded, say); the path carries only letters, digits, `.`, `_` and `-`, so there is nothing to encode |
| IMG-14 | A picture published and then withdrawn is still seen (009 phase 3, for those accepted by hand; since 010 phase 4, for any, whether the judge or the owner accepted it): Vercel's network serves it for up to a minute more, the browser of whoever already loaded it keeps its copy for up to a year, or the deletion failed and the file is still in the public store (§ 4.4) | P3. It is IMG-2 lasting a little longer for whoever already saw it; no new person receives the address | The row changes first: from that instant no screen receives the address (`RecipeRepository.ts:957-986`; phase 4: `:1020-1056`, with both doors). If the file could not be deleted, the console says so and the owner deletes it by hand. The notice's and the withdrawal's texts must state the limit (§ 4.4, the wording asked for) |
| IMG-15 | `/privacidad` says a model "comprueba que la imagen no muestra alimentos que la receta no lleva" and a published picture is exactly the one that check rejected (009 phase 3) | **P1** if a picture is accepted by hand without changing the sentence: truthful word for word, misleading in what it gives to understand, and about allergens (Act 3/1991, art. 5.1.b; § 4.2 b). Today, before phase 3, P2: the sentence already says more than the judge does | § 4.2 b's new text, with `privacy.updated`, in the same change as the accept button; and, until it is published, the owner accepts no picture (the checklist, § 0 ter). **The owner's decision** |
| IMG-16 | ~~A picture the judge **accepted** by mistake (it did not see the food with the allergen) cannot be withdrawn: "Withdraw" works only for those accepted by hand (`RecipeRepository.ts:972`, `handAccepted`; PRD 009, out of scope), and the manual retry does not accept a `ready` picture~~ | **Closed on 2026-09-30 (010 phase 4).** It was P2, and it existed since 006 | It was left out in 009 (question Q4 of report `0005`) and reopened in 010: the owner answered **yes** to question 4 of report `0006` ("Withdraw" for any published picture), and it is criterion 9 of PRD 010 and part of decision `0073` ("Any published picture can be removed by the owner"). In the code: the withdrawal's condition is `status = 'ready'` and nothing else (`RecipeRepository.ts:1041`, phase 4's tree); the `handAccepted` clause no longer exists. A bad acceptance by the judge is taken off from the console, with no migration, with the same transaction and the same `picture.removed` row, which now says through which door it arrived (`acceptedBy`, § 4.4). What is left is IMG-14 (cached copies), the same for both doors |

---

## 6. The picture flag's go-live list

It is copied in [`go-live-checklist.md` § 0 ter](./go-live-checklist.md).

## 7. For the lawyer

Additions to [`analysis.md` § 10](./analysis.md#10-to-confirm-with-a-lawyer), point 11:

- (a) Is a realistic photo of a dish, in a planning app, a "deepfake" (art. 3.60)? My reading,
  with the guidelines (points 113-116), is that it is.
- (b) "IA" instead of "AI" in the mark: the code asks for the English acronym unless national
  language law prevents it. NutrIA is not a signatory, but is there any risk?
- ~~(c) If the C2PA does not arrive through OpenRouter: are SynthID plus an unsigned IPTC
  enough?~~ No longer needed: measured on 2026-09-27, it arrives.
- (d) (2026-09-30, 009 phase 2) Is it an "exposure" under arts. 50.4-50.5 that the owner sees,
  in his console, a picture the judge rejected and that has not been published? My reading, by
  the rule's purpose, is that it is not (§ 1.6). **No need to spend the hour on this**: the page
  labels it all the same and the file carries its C2PA, so the product complies under either
  reading. It is noted in case the picture ever leaves the console.
- (e) (2026-09-30, 009 phase 3) Does art. 50.4's second-paragraph "human review or editorial
  control" exception reach an image a person reviews before publishing it? My reading, with the
  article's text and the guidelines (points 130 and 133-135), is that it does **not**: it is for
  text of public interest only. **No need to spend the hour**: the product does not rely on it;
  the picture accepted by hand carries the same mark and the same notice as the others (§ 1.7).
- (f) (2026-09-30, 009 phase 3) If a person suffered harm connected with a picture the owner
  published by hand against the judge, how does the `picture.accepted` record weigh: as evidence
  of diligence (there was a notice, two steps, the possibility of withdrawing) or of publishing
  knowingly? (TRLGDCU art. 147; Civil Code art. 1902, **which I have not consulted for this
  revision**). **This one does deserve five minutes of the hour**, together with (a): the two of
  them decide how much care publishing a realistic photo of food calls for.
- (g) (2026-09-30, 010 phase 2) Does `/privacidad`'s sentence "Si ese modelo ve con claridad en
  la imagen un alimento con un alérgeno que la receta no lleva, la imagen se rechaza" mislead
  (Act 3/1991, art. 5.1.b) now that the rule deliberately accepts a second food with the form of
  one the dish already has (a glass of milk beside a curry made with coconut milk), when the
  following sentence warns that "la imagen puede mostrar algo que el plato no lleva"? My reading:
  read in full, it does not reach misleading, but it does not describe that class (P2; § 4.6).
  The same after the rule was tightened: the class is narrower (195 library pairs instead of
  211), but it still exists. **If the owner takes § 4.6's clause (b), there is no need to spend
  the hour on this**; if he does not, five minutes.

## Sources (the version consulted on 2026-09-27; those at the end, on 2026-09-30)

- Regulation (EU) 2024/1689, the OJEU text in the BOE (`DOUE-L-2024-81079`): arts. 3.3, 3.4,
  3.60, 50, 99.4 and 113; recitals 133 and 134.
- Regulation (EU) 2026/1744 (the digital AI omnibus), OJ L of 24/7/2026: the new art. 111.3 and
  recital 38 (EUR-Lex, the English version).
- European Commission, *Guidelines on the implementation of the transparency obligations for
  certain AI systems under Article 50*, C(2026) 5054 final, the annex, 20/7/2026 (the page
  updated 6/8/2026): points 10-12, 27, 69-88, 113-117, 141-148, 152-154.
- *Code of Practice on Transparency of AI-Generated Content*, the final version, 10/6/2026:
  section 1 (measures 1.1-1.4, 2.1, 3.3, 3.4) and section 2 (measures 1.1 and 1.2).
- Google Cloud, Vertex AI, *Content Credentials* (upd. 2026-09-25). Google AI for Developers,
  Gemini API, *Image generation* (upd. 2026-09-23).
- Microsoft Learn, *Content provenance* (Foundry; `ms.date` 2026-09-17, upd. 2026-09-23).
- Vercel, the *Vercel Blob* documentation (upd. 2026-08-26).
- Act 3/1991 on Unfair Competition (BOE-A-1991-628, consolidated to 27/12/2025), arts. 5.1.b and
  7.1; TRLGDCU (BOE-A-2007-20555, consolidated to 28/02/2026), art. 60.1; Act 7/1998
  (BOE-A-1998-8789, consolidated to 16/03/2019), art. 5.5; Act 11/2023, art. 3.3; GDPR, arts. 5,
  13 and 28.
- **Consulted on 2026-09-30** (009 phase 2): Regulation (EU) 2024/1689, the OJEU text in the BOE
  (PDF `L00001-00144`), arts. 3.60 and 50.2, 50.4 and 50.5, and recital 134; Guidelines
  C(2026) 5054 final, points 87, 115, 117, 141 and 143; Regulation (EU) 2016/679, the OJEU text
  in the BOE (PDF `L00001-00088`), arts. 2.1, 4.1, 4.15, 5.1.a, 5.1.e and 13, and recital 26;
  Vercel, *Private Storage* (upd. 2026-09-15) and *Using the Blob SDK*, `del()` (upd.
  2026-08-26). The code: the working tree of `main` over `abc0a90`, uncommitted. That the second
  store is private and in `fra1` is stated by `docs/reference/deployment.md:96`; **I have not
  checked it in Vercel**.
- **Consulted on 2026-09-30** (009 phase 3): Regulation (EU) 2024/1689, the OJEU text in the BOE
  (PDF `L00001-00144`), arts. 3.60, 4, 50.2, 50.4 (both paragraphs) and 50.5, and recital 134;
  **I have not re-checked** whether Regulation (EU) 2026/1744 touches art. 50.4 (the 2026-09-27
  revision found only the new art. 111.3). Guidelines C(2026) 5054 final, section 2's table and
  points 74, 130, 133-138 and 141-143. Regulation (EU) 2016/679, the OJEU text in the BOE (PDF
  `L00001-00088`), arts. 2.1, 4.1, 5.1.a and 30.1. Act 3/1991 on Unfair Competition
  (BOE-A-1991-628, consolidated to 27/12/2025), arts. 5.1 and 7. TRLGDCU (BOE-A-2007-20555,
  consolidated to 28/02/2026), arts. 8.1.d, 19.2, 60.1, 61.2 and 147. Vercel, *Using the Blob
  SDK*, `del()` and `cacheControlMaxAge` (upd. 2026-08-26). The code: the working tree of `main`
  over `fce954d` and `frontend`'s tree (`.claude/worktrees/frontend-009-3`), both uncommitted.
  `0072`, 009's PRD and PLAN, report `0005` §§ 5 and 10.
- **2026-09-30** (010 phase 3, § 4.5): no new source consulted; it rests on those of the two
  entries above. The code: the tree `.claude/worktrees/backend-010-3` over `f81e834`,
  uncommitted (`PictureJudgement.ts`, `DishPicture.service.ts`, `RecipeRepository.ts`,
  `AdminCatalogueRepository.ts`, `AdminRepository.ts`, `RecipeController.ts`,
  `PlanRepository.ts`, `recipe.schema.ts`); PRD 010, criterion 10; `0073`.
- **2026-09-30** (010 phase 4, withdrawing any published picture; IMG-16 closed): no new rule
  consulted; what is cited (TRLGDCU art. 61.2, GDPR arts. 4.1, 4.15 and 5.1.a) is from the
  entries above. The code: the tree `.claude/worktrees/phase4-010` over `8e9ca114`,
  uncommitted, without 010's phase 2 (`RecipeRepository.ts`, `RecipeController.ts`,
  `PictureCandidates.service.ts`, `DishPicture.ts`, `Audit.ts`, `RecipeAcceptance.test.ts`,
  `apps/api/AGENTS.md` "Remove", and the `es-ES.ts` and `en-GB.ts` dictionaries); migration
  `0042`. PRD 010, criterion 9; `0073`; report `0006`, question 4. Merged into `main` as
  `28854ac` (#178); checked that `RecipeRepository.ts:1041`, `RecipeController.ts:795-800`,
  `Audit.ts:72-74` and `DishPicture.ts:102-104` match there. The deployment is the lead's
  assertion.
- **2026-09-30** (010 phase 2, § 4.6): no new source consulted; Act 3/1991, art. 5.1, and GDPR,
  arts. 2.1 and 4.1 and recital 26, as consulted for 009 phase 3 (the entry above). The code:
  the working tree of `main` over `28854ac` (phase 4 already in), uncommitted, with the rule
  tightened after the first invariant review (`packages/core/src/domain/DishPicture/judge.ts`,
  `forms.ts`, `forms.test.ts`, `judge.reverse.test.ts`, `judge.forms.test.ts`, `judge.test.ts`;
  `packages/core/src/entities/DishPicture/PictureReason.ts`); the 1,158 tests of that folder
  pass (run by `legal`); `apps/api/AGENTS.md` (the own-form note, uncommitted); `0073`; 010's
  PRD, PLAN and LOG. The figure 195 of 26,394 (211 before, and 205 in the second round), with 0
  pairs newly rejected, is the lead's and I have not checked it.
