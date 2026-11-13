# A lighter copy of the landing's three dish pictures, without the C2PA manifest

> **I am not a lawyer.** An agent wrote this, not a lawyer. Each conclusion cites the article,
> guideline, code measure or document line it rests on, so that the owner, or the lawyer he
> shows it to, can check it. A conclusion that depends on an interpretation is labelled
> **provisional** and marked **[lawyer]**; § 7 lists them.
>
> **Purpose**: answer the lead's question of 2026-11-13. On the public landing (`/` and `/en`),
> may a **re-encoded, lighter copy** of each of the three dish pictures (smaller dimensions,
> ~40–60 KB JPEG instead of 180–226 KB) be served where the screen is narrow, the wide layout
> keeping the original files? The copy would be made once and committed under
> `apps/web/public/`. A re-encode drops Google's signed C2PA manifest.
> **Audience**: the owner, the lead, `frontend`, `seo`. **Committed**: yes; nobody is named.
> **Maintained by**: the `legal` agent.
>
> **Cut-off date**: 2026-11-13. **Read**: [`dish-pictures.md`](./dish-pictures.md) §§ 0–2.5,
> 4.2 b, 5 and 7; [`2026-11-11-redesign.md`](./2026-11-11-redesign.md) §§ 0, 2 and 3–5;
> decision [`0066`](../decisions/0066-photograph-like-dish-pictures-drawn-on-first-view.md)
> § Decision ("Storage"); the published `privacy` and `terms` namespaces. Code read on `main`
> at `0fd1199a`: `apps/web/src/lib/landingPictures.ts`,
> `apps/web/src/components/LandingPictures/LandingPictures.tsx`,
> `apps/web/src/components/DishPicture/DishPicture.tsx`, `apps/web/src/lib/picture.ts`,
> `apps/web/src/app/_shared/metadata.ts:90-97`,
> `apps/api/src/shared/decorators/AiGenerated.decorator.ts:14`. **The lighter copies do not
> exist yet**: what this document says about them is a condition, not a description.

## 0. The answer

**Acceptable under the AI Act, with conditions (§ 4).** Provisional, **[lawyer]**, by mail
only, two minutes (§ 7). Each point below cites its source.

1. **Art. 50(4)–(5), the visible notice: nothing changes** if the copy is drawn by the same
   `DishPicture` with the same «IA» mark, hidden label and caption. The notice is in the
   markup, not in the file (§ 2.2).
2. **Art. 50(2), the machine-readable mark: met, provisionally,** if the copy carries **two
   layers**. One is the IPTC `trainedAlgorithmicMedia` field written into the copy. The other
   is the SynthID watermark, which lives in the pixels. The article and the Commission's
   guidelines ask for a mark that is machine-readable and detectable, and effective,
   interoperable, robust and reliable as far as feasible. They do not require a signed
   manifest or a provenance chain (guidelines, points 72–73). The signed original stays public
   and is still served on the wide layout. **That SynthID survives the downscale is asserted
   by Google and not measured on these files.** Measuring it is a must-have (§ 4, M4).
3. **The Code of Practice: the copy falls one step below it, deliberately.** Measure 1.1 asks
   for two layers, one of them *digitally signed* metadata (1.1.1). The copy's metadata layer
   is unsigned. NutrIA has not signed the Code. It shows compliance by gap analysis
   ([`dish-pictures.md`](./dish-pictures.md) § 1.5), and this is a gap the analysis must now
   record: **P2**, a gap a regulator would ask about. That is literally what the guidelines
   expect of a non-signatory. Point 148 says non-signatories "are expected to explain how the
   measures they implement ensure compliance". It warns they "may also be subject to a larger
   number of requests for information". It sets no rule that they match every measure.
   Re-signing the copy with a C2PA manifest of NutrIA's own, with the original as its
   ingredient, would close the gap. That is advisable (§ 5, A1), not required.
   **The adverse reading, stated plainly.** Signing is technically feasible, and point 81 says
   feasibility does not depend on a provider's resources. So "as far as this is technically
   feasible" in art. 50(2) could itself be read to require a signed layer wherever one can be
   applied. On that reading A1 becomes a condition. I do not follow it, because points 72–73
   allow any combination that meets the four qualities and require no provenance chain. It is
   the question for the lawyer (§ 7 d).
4. **The project's own choice is what changes most.** `0066` says "It is never re-encoded",
   and the redesign opinion's B1 and B3 ask the landing to serve "the same bytes". Those were
   the project's choices, made to meet the Code in full at no cost. They were not the bare
   legal minimum. [`dish-pictures.md`](./dish-pictures.md) § 2.3.4 had already foreseen a
   smaller derived size carrying the IPTC field. The redesign opinion § 4 asked for exactly
   this return to `legal`. This document amends B1 and B3 for the copies only (§ 6).
5. **No published text has to change.** `/privacidad` says "los ficheros llevan además una
   marca invisible y legible por máquina que dice que están generados por IA" (`es-ES.ts:3047`;
   `en-GB.ts:2901`). It promises *a* mark, not a signature, and stays true for a copy that
   carries the IPTC field (M2). It would become doubtful for a copy that relied on SynthID
   alone. `/condiciones` ("las marcamos como tales") stays true while the «IA» mark is drawn.
   This supersedes the 2026-11-11 reading that the sentence "stops being fully true for a
   re-encoded file" (redesign § 2.5). That reading assumed the default re-encode, which
   discards all metadata (`sharp`; [`dish-pictures.md`](./dish-pictures.md) § 2.2). With M2
   it no longer holds.
6. **No provider term found that forbids it.** I searched the full text of Google Cloud's
   Service Specific Terms and OpenRouter's Terms for watermark, SynthID, provenance, C2PA,
   Content Credentials and tamper, and neither has a clause on them. Google's Prohibited Use
   Policy forbids claiming generated content "was created solely by a human, in order to
   deceive", and the copy claims nothing of the kind (§ 3).

---

## 1. Three layers, kept apart

| Layer | What it asks of a copy | Binding? |
| --- | --- | --- |
| **The law**: AI Act art. 50(2), (4), (5) | A machine-readable mark, with detection available, that is "effective, interoperable, robust and reliable as far as this is technically feasible". A visible disclosure for a deepfake, clear, at first exposure, accessible | Yes |
| **The Code of Practice** (final, 10/6/2026), Section 1 | At least two layers: signed and time-stamped metadata (1.1.1) and an imperceptible watermark (1.1.2). Best efforts not to remove markings (1.2). Robustness to recompression and downscaling of the layers **together** (3.3) | No: NutrIA has not signed it. It is the yardstick the guidelines suggest for a gap analysis (point 148, as quoted in [`dish-pictures.md`](./dish-pictures.md) § 1.5) |
| **The project's choice**: `0066` "Storage"; redesign § 2.8 B1–B3 | The original bytes, everywhere, never re-encoded | Only as the project's own rule. The owner may change it. The record must then say so, because code comments and the decision would otherwise describe something the product no longer does |

---

## 2. The AI Act

### 2.1 Art. 50(2): the machine-readable mark

- **The rule.** Providers "shall ensure that the outputs of the AI system are marked in a
  machine-readable format and detectable as artificially generated or manipulated". The
  technical solutions must be "effective, interoperable, robust and reliable as far as this is
  technically feasible, taking into account […] the costs of implementation and the generally
  acknowledged state of the art". The text is quoted from the Code, p. 8, which reproduces the
  article. It is the same as the BOE text quoted in the redesign opinion § 2.2.
- **Roles.** NutrIA is provider and deployer ([`dish-pictures.md`](./dish-pictures.md) § 1.2).
  It cannot treat itself as a mere distributor (guidelines, point 16): the duty for these
  outputs is its own.
- **What the law asks, per the guidelines** (C(2026) 5054 final, 20/7/2026, read today in the
  PDF):
  - Point 72: providers "may rely on a single marking technique or a combination of
    techniques, so long as their overall technical solution is machine-readable and meets the
    requirements for effectiveness, interoperability, robustness and reliability".
  - Point 73: "providers are not required to record or keep a full provenance chain".
  - Point 75: the means of detection must be available to the persons exposed.
  - Point 81: technical feasibility "is an objective notion that is not dependent on the
    specific resources and capabilities of individual providers".
- **What the copy would carry.**
  - **SynthID**, Google's pixel watermark, declared in the original's own manifest
    ([`dish-pictures.md`](./dish-pictures.md) § 2.1). The Code's measure 3.3 expects a
    watermark to survive "(re)compression" and "up/downscaling", and Google presents SynthID
    as robust. Neither is a measurement on these files (M4). Detection is Google's, and it is
    free.
  - **IPTC `DigitalSourceType = trainedAlgorithmicMedia`** in XMP. This is an open standard,
    readable by any metadata tool, and the same field Google already writes into the original.
  - Together they cover what the law tests. IPTC gives interoperability. SynthID gives
    robustness. They are "machine-readable" (point 71). The original stays public with the
    signed layer as well.
- **What the copy loses.** Tamper-evidence: an unsigned field can be forged or removed, and the
  Code's adversarial robustness (3.3, second paragraph) relies on signed integrity. SynthID
  still covers removal: stripping the metadata leaves the watermark.
- **Do not lean on these to justify the copy**:
  - **Points 85–88 (cost carve-outs).** They cover closed physical products, strictly
    technical B2B outputs and ephemeral real-time content. A public consumer page fits none of
    them.
  - **Points 90–92 (standard editing, "format conversions, technical compression").** They
    say when an AI system that edits need not add a mark. They do not let a provider take one
    off.
  - **[`dish-pictures.md`](./dish-pictures.md) § 2.3.3's "defensible as technically
    feasible"**, which was written for a C2PA that never arrives. Here it arrives and is
    dropped by choice, and under point 81 re-signing is feasible. The conclusion in § 0.2
    therefore rests on points 72–73, that the law needs no signed chain, and not on any claim
    that signing is infeasible.
- **Provisional: met** while M2–M4 hold. **[lawyer]** (§ 7).

### 2.2 Art. 50(4)–(5): the visible notice

- The notice lives in the markup and does not depend on the file. `DishPicture` draws the «IA»
  mark whenever `path` is set (`DishPicture.tsx:89-92`). The tile is decorative and carries
  the hidden "Imagen generada por IA" (`:91`). The caption sits in the same `<figure>`, which
  carries `data-ai-generated="true"` (`LandingPictures.tsx:34`, `:50`).
- A `<picture>`/`srcset` choice changes the bytes, not the element. The redesign's N1–N6 still
  apply word for word, at 320, 390 and 1280 px (redesign § 2.8).
- One failure mode: a `<source>` file that fails to load. The frame shows the plate and hides
  the mark (`DishPicture.module.css:169`, `.picture:has([data-failed]) .mark`). That is correct: nothing
  synthetic is on screen.

### 2.3 The Code of Practice, Section 1 (read today, the 10/6/2026 final, pp. 8–10 and 17)

| Measure | What it says | The lighter copy |
| --- | --- | --- |
| 1.1 | "at least two layers", "in particular for content that can be disseminated online" | Two layers: SynthID and IPTC. **But** 1.1.1 requires the metadata to be "digitally signed and time-stamped in a secure and tamper-evident manner". IPTC written by NutrIA is not. **Gap, P2** |
| 1.2 (a) | Best efforts to "retain, and abstain from intentionally altering or removing, existing metadata markings" where content is transformed. It does not affect "good faith, legitimate processing where the modification, transformation or replacement of existing metadata is necessary to maintain accurate and functional information following downstream processing" | Written for inputs that an AI system transforms. By analogy only: a resize breaks the manifest's hash binding, so keeping the old manifest would be **inaccurate**, and replacing it with a true IPTC field is the closest fit to the carve-out. **Provisional [lawyer]** |
| 1.2, last paragraph | Signatories that "disseminate content to the public, are encouraged to ensure" metadata markings are preserved | "Encouraged", not "will". The signed original stays public and is served on the wide layout |
| 1.3 | Encouraged: the system's name, the provider, a timestamp | Advisable for the copy (A3) |
| 3.3 | Robustness of the marking and detection "together" to "(re)compression" and "up/downscaling" | The Code expects the watermark to carry the mark through exactly this processing, but that is a design claim. **Measure it** (M4) |

---

## 3. The providers' terms (read 2026-11-13)

- **Google Cloud Service Specific Terms** (last modified 11/11/2026), § 20, Generative AI
  Services: no clause about removing or altering watermarks, SynthID, content credentials,
  provenance or signatures. A full-text search of the whole page for "watermark", "SynthID",
  "provenance", "C2PA", "Content Credential" and "tamper" finds nothing. The nearest clause is
  § 20(j), on safety filters.
- **Google Generative AI Prohibited Use Policy** (last modified 17/12/2024), § 4.5:
  "Misrepresenting the provenance of generated content by claiming it was created solely by a
  human, in order to deceive." The copy keeps the «IA» mark, the caption and the IPTC field,
  so it claims the opposite.
- **OpenRouter Terms** (last updated 31/8/2026 per a summarised read; the date was not
  re-found in the raw page), § 5.1, verbatim: "By accessing or using any Model through the
  Service, you agree […] to comply with the applicable terms for each Model ("Model Terms"), a
  list of which is provided here". § 5.2 passes the same obligation to the customer's own
  users.
  - **Provisional: a flow-down clause exists**, so Google's model terms probably reach NutrIA.
  - **Which Google terms are those "Model Terms"** for Gemini on Vertex, I have not read:
    OpenRouter's list was not opened. IMG-9 and redesign § 5 (c) stay open, and the owner's
    check is still his.
  - OpenRouter's own terms have no clause on marks or metadata (full-text search, as above).

**How these were read.** I downloaded both pages and searched their full text. Google's page
says "Last modified November 11, 2026". The word searches above found nothing in either page
beyond the flow-down sections. The Prohibited Use Policy was read through a summarising fetch
only.

---

## 4. Must-have conditions (each testable, and applying to **every file the landing can serve**, whichever screen gets it)

`srcset` and `media` selection does not map cleanly onto "phones". The conditions therefore
attach to the files, not to the device.

- [ ] **M1. The visible notice is unchanged.** Each tile is still drawn by `DishPicture` with
  the «IA» mark, the hidden label and the caption, whichever file loads. Redesign N1–N6 and
  W1–W4 hold.
  *Test, two parts*:
  - (a) Fetch the prerendered `/` and `/en` with no JavaScript. Every hero `<img>` and every
    `<source>` present sits inside a `[data-dish-picture]` element holding the mark and its
    hidden label, and the caption text is present.
  - (b) With JavaScript on, after load, at 320, 390 and 1280 px, every tile on screen has its
    mark visible.
  - Part (b) is needed because the working tree of 2026-11-13 draws tiles 2 and 3 inside
    `AfterLoad`, outside the prerender (uncommitted `LandingPictures.tsx`). For those tiles,
    the redesign's N1/N6 "in the prerendered HTML" cannot hold. What must hold instead is that
    the mark appears in the same element at the same instant as its picture. `DishPicture`
    already does this, and N3 then holds.
- [ ] **M2. Each lighter file carries the IPTC field in its own bytes, as served.** XMP
  `Iptc4xmpExt:DigitalSourceType` =
  `http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia`
  ([`dish-pictures.md`](./dish-pictures.md) § 2.4). The XMP holds no user, account or person
  identifier.
  *Test*: a unit test reads each committed file and finds the URI inside its XMP packet; once
  deployed, `exiftool -XMP-iptcExt:DigitalSourceType` on the file fetched from the live
  address.
  **Without M2**, `/privacidad`'s sentence would rest on SynthID alone, which is unmeasured:
  **P1, and P0 if SynthID also failed** (a false published text).
- [ ] **M3. No broken manifest.** A lighter file carries **no** leftover C2PA/JUMBF segment
  (JPEG APP11) from Google's original, because a manifest whose hash no longer matches reads
  as tampering. The only exception is a new manifest NutrIA signs (A1), validated.
  *Test*: the same unit test finds no APP11 marker and no `c2pa` label in the bytes, unless A1
  is taken. With A1, a C2PA validator passes on the committed file.
- [ ] **M4. SynthID is measured on the lighter files before they ship.** The owner checks
  **each of the three copies**, exactly as committed, with Google's own SynthID verification.
  - Per Google's help page "Verify AI-generated images, videos, and audio"
    (support.google.com/gemini/answer/16722517), seen today only through a search summary and
    not opened, the Gemini app answers "Was this created with Google AI?" by reading the
    watermark.
  - Upload under a neutral file name. A press test reported that the answer changed with the
    file name, so only a **positive** detection counts.
  - It is his act: it sends Google a picture Google generated, with no personal data.
  - **If SynthID is not detected, the copies do not ship.** Re-encode more gently (A4) and
    measure again, or keep the originals. A1 does **not** replace this: a signature of
    NutrIA's own would leave one strippable layer, not two. The result and the date go in
    project 024's `LOG.md`.
  - *Why it is a must*: SynthID would be the only robust layer left (§ 2.1), and nothing in the
    record measures it after a downscale of this size.
- [ ] **M5. Pixels changed only by scaling and compression.** No retouching, colour or content
  edit, and no crop beyond the existing CSS ones. Each copy is derived from one of the three
  originals listed in `landingPictures.ts`, which are published and judge-accepted (redesign
  P1–P3 still hold).
  *Test*: each lighter file is listed in `landingPictures.ts` **beside** its original `path`
  and `recipeId`. The original's SHA-256, the copy's SHA-256 and the encode settings are
  recorded in project 024's `LOG.md` (or a comment beside the entry).
- [ ] **M6. The originals stay as they are everywhere else.**
  - The wide layout requests the original Blob address untouched (redesign B3's hash check, for
    the original).
  - No in-app page, mail, console screen, `og:image`, `twitter:image`, manifest or JSON-LD
    references a lighter file (redesign O1).
  - *Test*: outside the tests themselves, the lighter files' paths are referenced only through
    `landingPictures.ts` (and the `LandingPictures` component that reads it), nowhere else
    under `apps/` or `packages/`.
- [ ] **M7. A withdrawal removes the lighter copy too.** The redesign's P6 now covers two
  files per picture. If the owner withdraws one of the three in the console, the same change
  deletes its entry and its lighter file from `apps/web/public/`.
- [ ] **M8. `noimageindex` stays on `/` and `/en`** while any lighter file is served
  (`metadata.ts:96-97`; `/en` reaches it too, because `app/en/page.tsx:6` calls
  `pageMetadata('en-GB', '/')`). The copy is a file with no overlay mark and no signed layer on NutrIA's
  own origin, so the redesign's "recommended" O2 becomes a condition for this change.
- [ ] **M9. The record says what the code does.**
  - `0066` "Storage" ("It is never re-encoded") gets a dated amendment, or a new decision,
    naming the landing's lighter copies as the one exception.
  - The comments that promise the landing file is "used untouched", so that "its C2PA record
    survives", are corrected in the same change: `landingPictures.ts:15-17`, `picture.ts:12-19`
    and `DishPicture.tsx` (the docblock: "never a resize").
  - `metadata.ts:90-93` says the files come "from another origin, so a header of ours cannot
    reach them", which stops being true for the copies.
  - This is not a legal rule, but a record that describes something the product does not do is
    how a later change breaks a legal one.

---

## 5. Advisable (not conditions)

- **A1 (P2, closes the gap with the Code).** Sign each lighter copy with a C2PA manifest:
  a resize/transcode action, with the original as its parent ingredient. The open-source
  `c2patool` is the usual tool. Its exact action names and options were **not read today**:
  `backend` reads the C2PA specification before building it.
  - The signer needs a certificate. A self-signed one validates the hash but shows an unknown
    signer. A certificate on the C2PA trust list has a cost **I have not priced**; price it
    before recommending it to the owner.
  - With A1, measure 1.1.1 is met again, and M3's exception applies.
- **A2 (P3).** Because the copies are on NutrIA's own origin, send `X-Robots-Tag: noindex` with
  them. Google's documentation on robots headers for non-HTML files was **not read today**:
  `seo` confirms it. Send `AI-Generated: true` as well, the convention
  of #359 (`AiGenerated.decorator.ts:14`), set as a static header rule in `next.config.js` for
  their path. Neither replaces M2.
- **A3 (P3).** The Code's measure 1.3: in the copy's XMP, add the system's name ("NutrIA"), the
  original's generation date and a pointer to the original. Use the Blob URL in
  `xmpMM:DerivedFrom`, which carries no personal data.
- **A4 (P3).** Make the encode no more aggressive than the LCP needs. SynthID's robustness has
  limits, and the lighter the copy, the more M4 matters.
- **A5 (P3), noted.** A file committed to a public repository stays in its history after M7
  removes it. It carries no personal data, and the withdrawal still takes it off the site.
  But the console's `removeBody` sentence "esta imagen no se puede recuperar" is then not
  literally true for a landing picture. The sentence is seen by the owner only. Accept this,
  or keep the copies in Blob beside the originals instead of in git.

**If the owner prefers not to take this route**, two alternatives keep the 2026-11-11 answer
unchanged:

- **(a) Original bytes, one picture on narrow screens.** Serve the original bytes and show only
  the first tile there. This improves LCP less, and whether a hidden lazy tile is still
  fetched depends on the browser: `frontend` measures it.
- **(b) A1 from the start.** A signed derivative is the Code's own answer to "another size",
  and it needs no gap entry.

---

## 6. What this changes in the record

- [`2026-11-11-redesign.md`](./2026-11-11-redesign.md):
  - § 2.8 B1 and B3 are amended for the lighter copies only: they stand for every other file
    and for the originals.
  - § 2.2's "complies with art. 50.2 only by serving the same bytes" is narrowed to "complies
    with the Code in full only by…".
  - § 2.5's row on `/privacidad` reads as in § 0.5 above.
  - § 4's "a derived, lighter file is not one of them without coming back to `legal`" is
    answered by this document. A dated revision note at the top of that file says so.
- [`dish-pictures.md`](./dish-pictures.md):
  - The § 1.5 gap analysis gains, for the landing's lighter copies only: "S1 1.1.1, signed
    metadata, not met for three derived files; SynthID + unsigned IPTC; signed originals still
    public; P2, A1 closes it".
  - § 2.3.4 is the case this document applies. A dated revision note at the top of that file says so.
- **Risks** (to read with redesign § 3):

| # | What can happen | Severity | What prevents it |
| --- | --- | --- | --- |
| RD-10 | A lighter copy ships without the IPTC field (the default re-encode drops it), and `/privacidad`'s "los ficheros llevan … una marca … legible por máquina" rests on an unmeasured watermark | **P1** (P0 if SynthID is also gone: a false published text) | M2, M4 |
| RD-11 | A lighter copy keeps Google's manifest with a broken hash, and a C2PA viewer reports the picture as tampered | **P3** (no person is harmed; a misleading machine statement) | M3 |
| RD-12 | The three copies fall below the Code's signed-metadata layer | **P2** (a gap a regulator would ask about; the law itself is met, provisionally) | Recorded here and in `dish-pictures.md` § 1.5; A1 closes it |
| RD-13 | A withdrawn picture's lighter copy stays on the landing | **P2** (as RD-5) | M7 |

---

## 7. For the lawyer (by mail, with redesign § 5 (b); two minutes)

- **(d) A downscaled copy of one's own output.** NutrIA, as provider and deployer, serves a
  downscaled copy of its own generated image on a public page. The copy carries the SynthID
  watermark, an unsigned IPTC `trainedAlgorithmicMedia` field and the visible «IA» mark, but
  not the provider-signed C2PA manifest. The signed original stays public at its own address
  and is served on wide screens. Is art. 50(2) met?
  - Provisional view: **yes.** Points 72–73 of the guidelines require no signed chain, and two
    layers remain. What falls short is the Code's measure 1.1.1, which binds only signatories.
  - What changes with a "no": A1 becomes a condition, or the landing returns to the original
    bytes.

## Sources (read 2026-11-13 unless stated)

- **Code of Practice on Transparency of AI-Generated Content**, final, 10/6/2026, the AI
  Office's PDF (38 pp.): Section 1, measures 1.1, 1.1.1, 1.1.2, 1.2, 1.3 (pp. 8–10) and 3.3
  (pp. 17–18).
- **European Commission, Guidelines on the transparency obligations under Article 50 AI Act**,
  C(2026) 5054 final, 20/7/2026, the PDF (51 pp.): points 16, 71–77, 79–88, 90–92, 98 and 146–149.
- **Google, Gemini Apps Help, "Verify AI-generated images, videos, and audio"**
  (support.google.com/gemini/answer/16722517): seen only through a search summary, **not
  opened**.
- **AI Act, Regulation (EU) 2024/1689**: art. 50(2), as reproduced in the Code, p. 8. Arts.
  50(4)–(5) and 3.60, as quoted in [`2026-11-11-redesign.md`](./2026-11-11-redesign.md) § 2.3
  (BOE XML, read 2026-11-11, not re-read).
- **Google Cloud, Service Specific Terms**, § 20 (read up to § 40). **Google, Generative AI
  Prohibited Use Policy**, last modified 17/12/2024, § 4.
- **OpenRouter, Terms of Service**, last updated 31/8/2026, §§ 5.1–5.2.
- **The product**: `main` at `0fd1199a`, the files listed in the header.
