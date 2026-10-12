# Legal — NutrIA

> **This is not legal advice.** It was written by an agent, not by a lawyer. Every claim
> cites the article and the consolidated version it rests on so that the owner — or the
> lawyer he shows it to — can check it. Where a question depends on an interpretation, the
> text says so and takes it to the
> ["confirm with a lawyer"](./analysis.md#10-confirm-with-a-lawyer) list.
>
> **Purpose**: to supervise NutrIA against Spanish and EU law in force at 2026-09-25 and to
> leave the texts the product needs drafted.
> **Audience**: the owner, a lawyer, and the `frontend`/`backend` agents, who paste the texts
> and build what is missing. **Committed**: yes — the repository is **public**: there are no
> names, email addresses, tax numbers or postal addresses here; the identity lives only in
> `apps/web/src/i18n/legalIdentity.ts` and the texts use its placeholders (`{name}`,
> `{email}` and the new ones proposed by
> [`textos/07-aviso-legal.md`](./textos/07-aviso-legal.md)).
> **Maintained by**: the `legal` agent; approved by the owner and the lawyer.
>
> **A note on language.** Everything in this folder is in English, like the rest of the
> repository, with the Spanish legal term in brackets the first time each appears — those
> terms have an exact meaning in Spanish law and a translation would blur it. The one
> exception is [`textos/`](./textos/): those are the words a person is shown at `/privacidad`
> and `/condiciones`, Spanish law requires them in Spanish, and that folder is the source of
> what is served. Its files keep their Spanish names because that is what they are.

## The map

| Document | What it is |
| --- | --- |
| [`analysis.md`](./analysis.md) | The analysis: roles per flow, legal bases, art. 9, retention, transfers, the DPIA and the DPO, the owner as an individual, the AI Act, accessibility, the ranked risk list and the list for the lawyer. **Start here.** |
| [`dpia.md`](./dpia.md) | The data protection impact assessment (art. 35 GDPR), with the structure of the AEPD's template. It is mandatory. |
| [`record-of-processing.md`](./record-of-processing.md) | The record of processing activities (*registro de actividades de tratamiento*, art. 30 GDPR). Mandatory: art. 30.5's exception does not apply to anybody processing health data. |
| [`breach-procedure.md`](./breach-procedure.md) | What to do about a personal data breach: contain it, keep the evidence, decide within 72 hours, notify the AEPD, tell the people affected and record it (arts. 33 and 34 GDPR). |
| [`removing-a-second-factor.md`](./removing-a-second-factor.md) | What the owner does when somebody loses their second factor: check the request comes from the account's address, what he answers at each step (es/en), what he never asks for, what he does about "it wasn't me" and what records are left (project 011, phase 4). The owner approves it before the phase. |
| [`dish-pictures.md`](./dish-pictures.md) | The dish pictures (project 006): AI Act art. 50 (dates, roles, deepfakes, a machine-readable mark), consumer law, privacy, the labels in both languages and what is missing before the flag. Since project 009: the picture the judge rejected and that waits for the owner (§ 1.6, § 4.3) and the one the owner accepts by hand and can withdraw (§ 1.7, § 4.4), with the `/privacidad` sentence that changes (§ 4.2 b). |
| [`2026-09-29-accepting-the-legal-texts.md`](./2026-09-29-accepting-the-legal-texts.md) | Decision D5 (project 008): the privacy policy is given, not recorded; acceptance of the terms is stored (`TERMS_VERSION`, two columns on `user`), with the notice visible beside every button that creates an account. The spec for phase 7. |
| [`2026-09-29-mail-to-the-owner.md`](./2026-09-29-mail-to-the-owner.md) | The mail to the owner (project 008, `0071`): the daily digest and the failure and spend alerts. Verdict: no user data; the policy does not change; two P3 wording changes. Addendum: the waiting-account alert no longer carries the address (resolved) and there is a silent-task alert. Addendum of 2026-09-30: two dish-picture alerts (project 009, `0072`), the same verdict. |
| [`go-live-checklist.md`](./go-live-checklist.md) | What has to be true before the `professional` flag is switched on, and before Stripe's *live* keys go in. |
| [`textos/01-acuerdo-profesional.md`](./textos/01-acuerdo-profesional.md) | What the dietitian-nutritionist accepts before `/consulta` opens: confidentiality, roles, security, what happens to the data, forbidden uses. With its storage and its version. |
| [`textos/02-politica-privacidad.md`](./textos/02-politica-privacidad.md) | The full privacy policy, replacing the current one, with project 004 inside it. |
| [`textos/03-condiciones-uso.md`](./textos/03-condiciones-uso.md) | Changes to the terms of use (Premium, withdrawal, the form, age). |
| [`textos/04-condiciones-consulta.md`](./textos/04-condiciones-consulta.md) | The practice plan's terms (B2B): price, trial, renewal, cancellation, pause. |
| [`textos/05-consentimientos-cliente.md`](./textos/05-consentimientos-cliente.md) | The health consent at sign-up (new), the invitation and its page, and the end of the link. It raises `CARE_CONSENT_VERSION` and `HEALTH_CONSENT_VERSION`. |
| [`textos/06-correos.md`](./textos/06-correos.md) | Mail with legal effect: the invitation, the professional's sign-up, the withdrawal acknowledgement, the annual renewal notice, the notice of a change to the terms and the one about a change of AI provider; and, as they stand, the mails to the owner (H–N: the digest, the failure, spend and silent-task alerts, the waiting account, failed dish pictures and an image provider refusing requests), the "somebody tried to create an account with your email" notice (O) and the address confirmation mail (P), which since `0092`'s sweep carries a retention promise. |
| [`textos/07-aviso-legal.md`](./textos/07-aviso-legal.md) | The legal notice art. 10 LSSI requires and the details art. 97 TRLGDCU asks for before selling. |

## How the texts are read

Each text says **where it goes** (dictionary key, screen or mail template), is in Spanish
(the source of truth) and in English where the product shows English, and each clause is
followed by an HTML comment `<!-- Fuente: … -->` the page does not show. When a text somebody
has already accepted changes, the document says which version constant has to be raised.

The texts are **drafts for the product**: `frontend` pastes them into the dictionaries,
`backend` stores the acceptances, the lead publishes. None of them is in production by virtue
of being here.

## Primary sources used (the version consulted)

- GDPR — Regulation (EU) 2016/679, the OJEU text in the BOE (`DOUE-L-2016-80807`).
- LOPDGDD — LO 3/2018, BOE-A-2018-16673, consolidated to 27/12/2025.
- LSSI-CE — Law 34/2002, BOE-A-2002-13758, consolidated to 23/01/2025.
- TRLGDCU — RDLeg. 1/2007, BOE-A-2007-20555, consolidated to 28/02/2026.
- Law 10/2025, on customer service, BOE-A-2025-26698 (it amends art. 97.1.p TRLGDCU).
- Directive (EU) 2023/2673 (the withdrawal function, art. 11 bis of Directive 2011/83),
  `DOUE-L-2023-81696`.
- Law 41/2002 (patient autonomy), BOE-A-2002-22188, consolidated to 01/03/2023.
- Law 44/2003 (the health professions), BOE-A-2003-21340, consolidated to 05/06/2021.
- Regulation (EU) 2024/1689 (the AI Act), `DOUE-L-2024-81079`, and its amendment by
  Regulation (EU) 2026/1744 (the "digital AI omnibus"), `DOUE-L-2026-81147`.
- Law 11/2023 (accessibility of products and services), BOE-A-2023-11022.
- AEPD — the lists of processing that requires (art. 35.4) and that does not require
  (art. 35.5) a DPIA.
- EDPB — Guidelines 07/2020 on controller and processor, version 2.0 (in Spanish).
- CJEU — C-184/20 *OT* (1/8/2022) and C-21/23 *Lindenapotheke* (4/10/2024), on the reach of
  "health data".
- The Code of Conduct of the Dietitian-Nutritionist profession, CGCODN, adopted 22/12/2021.
- Providers' terms: Gemini API Additional Terms (in force 23/03/2026), OpenCode Zen (the
  privacy of its free models), Stripe Managed Payments (documentation consulted 25/09/2026).
- AI providers for `0064`'s change, read 26/09/2026: OpenRouter — terms (31/08/2026), privacy
  policy (31/08/2026), the *Enterprise Access Agreement* with its DPA (22/06/2026), the ZDR
  documentation, *Data collection* and *provider routing*, the sub-processor list
  (`trust.openrouter.ai`; mirror `sub-processors.com`, 20/03/2026) and its public API
  (`/api/v1/endpoints/zdr`, `/api/v1/providers`, `/api/v1/models/…/endpoints`); DeepInfra —
  terms (17/08/2026), privacy (15/08/2026), the privacy documentation; CoreWeave — privacy
  (24/02/2026), the DPA, the acceptable use policy; Together — terms and privacy
  (17/12/2025); the Hugging Face licences of DeepSeek V4.1 Flash (MIT) and MiniMax M3 (the
  *MiniMax Community License*, already out); Gemma 4 31B — the Hugging Face card (Apache 2.0,
  20/07/2026), `ai.google.dev/gemma/docs/gemma_4_license`, the *Gemma Terms of Use*
  (01/04/2026, which exclude Gemma 4) and the *Gemma Prohibited Use Policy* (21/02/2024); the
  Gemini API Additional Terms (23/03/2026) again, to correct § 1.3.
- The official EU-US Data Privacy Framework list (`dataprivacyframework.gov`, consulted
  through its API on 26/09/2026).
- CJEU — C-413/23 P *EDPS v SRB* (4/9/2025), on pseudonymised data and the duty to inform the
  recipient.
- For the dish pictures, read 27/09/2026: European Commission, *Guidelines on the
  implementation of the transparency obligations for certain AI systems under Article 50*,
  C(2026) 5054 final (20/7/2026); the *Code of Practice on Transparency of AI-Generated
  Content*, final version (10/6/2026); Regulation (EU) 2026/1744, the new art. 111.3; Google
  Cloud, Vertex AI *Content Credentials* (upd. 25/09/2026) and the Gemini API *Image
  generation* (upd. 23/09/2026); Microsoft Learn, *Content provenance* (upd. 23/09/2026);
  Vercel, *Vercel Blob* (upd. 26/08/2026); Law 3/1991 on Unfair Competition,
  BOE-A-1991-628, consolidated to 27/12/2025; Law 7/1998, BOE-A-1998-8789, consolidated to
  16/03/2019.
