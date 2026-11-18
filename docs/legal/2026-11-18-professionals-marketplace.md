# The professionals area as an open marketplace: a legal read before planning (2026-11-18)

> **I am not a lawyer.** An agent wrote this. It is the analysis a lawyer would do, with each
> conclusion tied to the article it rests on, so that the owner, and the lawyer he shows it to,
> can check every step. Where a conclusion depends on an interpretation it is marked
> **[lawyer]** and collected in § 7. Every verdict below is **my reading, not a verdict**.
>
> **Purpose**: to say, before anything is planned, what the law makes of the owner's decisions
> of 2026-11-18 about turning the dietitian workspace (project 004) into an open directory where
> anybody can publish a profile and be hired. **Audience**: the owner, the lawyer, the lead.
> **Committed**: yes. The repository is public, so no names, addresses or tax numbers appear here.
> **Maintained by**: the `legal` agent.
>
> **What I read.** `main` at `d0c59a24`. Also: project 004 (`docs/projects/004-dietitian-workspace/PRD.md`),
> decision [`0059`](../decisions/0059-a-professional-reaches-a-client-only-through-a-link.md),
> [`analysis.md`](./analysis.md) §§ 1.2, 1.4, 2, 5, 6 and 9,
> [`textos/01`](./textos/01-acuerdo-profesional.md), [`textos/04`](./textos/04-condiciones-consulta.md),
> [`textos/05`](./textos/05-consentimientos-cliente.md), [`record-of-processing.md`](./record-of-processing.md),
> [`go-live-checklist.md`](./go-live-checklist.md) § 1, the
> [lawyer's brief](./2026-11-11-lawyer-hour-brief.md), and the published strings in
> `apps/web/src/i18n/dictionaries/es-ES.ts`. The law was read from primary sources on
> 2026-11-18. The list, with consolidation dates, is at the end.
>
> **Nothing here is built.** The `professional` flag is off in production
> ([brief § 1](./2026-11-11-lawyer-hour-brief.md#1-the-facts-the-lawyer-needs-as-of-2026-11-11)).
> The one professional on record is the owner's own account, according to the comment under
> [`textos/01`](./textos/01-acuerdo-profesional.md) § 8 (project 011's LOG, phase 6). The
> production count of links accepted under an old consent has not been run
> ([`go-live-checklist.md`](./go-live-checklist.md) § 1, step 1, unticked). Whatever links
> exist can only be the owner's tests, so this is the cheapest moment to get the design right.

## 0. In ten lines

1. **Most of what the owner decided can be done lawfully.** Four of the eight questions come
   out *fine with conditions*. Four come out *not as stated*: (a) the regulated profession,
   (d) the chat, (e) roles, and (g) the hand-made plan. Each has a small change that makes it fine.
2. **Mitigation 2 does not go far enough.** It withholds only illnesses and medication from an
   unbadged person. Under this folder's own reading ([`analysis.md`](./analysis.md) § 1.2),
   weight, goal, targets and their derivation, adherence and check-ins are health data in
   NutrIA's context. Today's professional sees all of them. The chat carries anything at all.
   An unbadged person is not a health professional bound by secrecy, so art. 9.2.h and 9.3 GDPR
   are not available. Only the client's **explicit consent naming that person** (art. 9.2.a)
   can carry it (§ 3.a, § 3.e).
3. **A badge that rests on a number nobody checked is worse than no badge.** It is NutrIA's own
   statement about a qualification (LCD arts. 5.1.g and 21). The hosting exemption does not
   cover NutrIA's own statements. The minimum is a manual lookup in the college's public
   register (Ley 2/1974 art. 10.2.a), plus some proof that the account belongs to the person
   on the register.
4. **The protected words go only with the badge.** That means *dietista-nutricionista*,
   *dietista*, *nutricionista*, and the degree. Without the badge a profile may say *asesor/a
   de alimentación* or *coach nutricional*, under a fixed notice. That is my reading
   **[lawyer]**. The criminal exposure comes from the **act** of planning someone's diet,
   not from the label (CP art. 403).
5. **Being small helps less than one might think.** Under the DSA, a micro enterprise is exempt
   from the online-platform and marketplace sections (arts. 19 and 29, which include trader
   traceability, art. 30). A solo owner is a micro enterprise: the Recommendation 2003/361
   annex, art. 1, covers activity "a título individual". But notice-and-action (art. 16),
   statements of reasons (art. 17), the terms (art. 14) and contact points (arts. 11–12) apply
   at any size. So do the **P2B Regulation** (2019/1150) arts. 3–5 and consumer law: ranking
   (TRLGDCU art. 20.3), reviews (art. 20.4) and the marketplace information (art. 97 bis).
6. **Reviews have a new rule.** TRLGDCU art. 20.4 (as amended by Ley 10/2025) requires reviews
   to concern a service used **in the 30 days before the review**. It gives the professional a
   right to reply in the same channel. It lets them obtain removal only by proving
   "fehacientemente" that the review is fake. NutrIA must say exactly how reviews are checked.
   Here "hired" can only mean "had a request accepted in NutrIA".
7. **The "hire" button's legal nature decides the regime.** If it concludes the contract,
   NutrIA is a *mercado en línea* (TRLGDCU art. 59 bis.3). The button must then say "pedido con
   obligación de pago" or the consumer is not bound (art. 98.2), and arts. 97 bis and 97 apply.
   If it is a non-binding request, with the contract made directly between the two people,
   most of that falls away. The rest stays.
8. **Payment outside the app keeps NutrIA out of payment-services law** (RDL 19/2018 art. 1.2),
   provided it never collects, holds or routes a client's money.
9. **A hand-made plan by an unverified person is the largest new safety and liability
   exposure.** It must pass the same energy floor, target bounds and allergen gate as
   everything else. It must carry its author's name and say that NutrIA did not write it
   (DSA art. 6.3; TRLGDCU art. 86.2). The allergen gate also leaks something: a refused dish
   tells the author about an allergy they were not meant to see.
10. **Nine blocking findings, eleven owner decisions and thirteen questions for the lawyer** are in
    §§ 5–7.

---

## 1. What exists today, and what the owner's decisions turn false

### 1.1 Project 004, as built

- **A professional is granted by the owner, with a collegiate number.** The number is required
  by `grantProfessionalSchema` (`packages/core/src/entities/Professional/Professional.ts:16`)
  and checked by hand against the college's register before the grant
  ([`go-live-checklist.md`](./go-live-checklist.md) § 1, *Organisation*). Self-declaration was
  ruled out on purpose: PRD 004 says "never self-declared: the title is regulated, and a
  checkbox is not a credential". The PRD also lists "A directory or marketplace" among the
  things it explicitly does not do.
- **A client is reached only through an invitation by e-mail** and a link the client accepts
  (`0059`). What the professional sees is set out in [`analysis.md`](./analysis.md) § 1.4: the
  client's name, targets and how they were derived, plans, adherence, the weight series and
  check-in answers. Conditions, medication and supplements are shown only under a separate line.
  The professional never sees allergies, e-mail or free comments.
- **Roles** ([`analysis.md`](./analysis.md) § 2): NutrIA is the controller. It **communicates**
  the data to the professional at the client's request and with the client's consent (arts.
  6.1.a and 9.2.a). The professional is an **independent controller** for their own care
  (9.2.h, 9.3; LOPDGDD DA 17ª). NutrIA is not a processor, and the professional's agreement
  allocates duties in case joint controllership were ever found (art. 26). There is one stated
  trigger: NutrIA becomes a processor "the day the product stores something the professional
  writes *for their practice*" (§ 2.3), and the agreement promises an art. 28 contract first
  ([`textos/01`](./textos/01-acuerdo-profesional.md) § 4).

### 1.2 The owner's decisions of 2026-11-18, as I take them

| # | Decision | Shorthand below |
| --- | --- | --- |
| 1 | No collegiate number required. Anybody may publish a profile with studies, price and opening hours. | *open directory* |
| 2 | Studies are shown as "declared, not checked by NutrIA". «Dietista-nutricionista» is reserved for whoever gives a collegiate number, shown with a badge. Nobody without the badge receives illnesses or medication. | *the badge*, *badged* / *unbadged* |
| 3 | People search, see ratings and comments, and ask to hire. The professional may refuse. A limited chat before acceptance, a full chat after. | *request*, *chat* |
| 4 | Only somebody who hired may rate. The professional may reply. A comment can be reported. | *reviews* |
| 5 | One plan per person: the AI's or the professional's, never both. | *one plan* |
| 6 | Payment outside the app. NutrIA may charge the professional a subscription (deferred). | *off-app payment* |
| 7 | Opening hours are for display only. No booking. | *hours* |

### 1.3 Sentences in force that would become false the day decision 1 ships

These are published or accepted texts. Each would assert something the product no longer does.
A text that promises what the code does not do is P0 under this folder's scale. They are not
false **today**, because nothing is built. They must be rewritten in the same change that
opens the directory, not after.

| Where | What it says | Why it would become false |
| --- | --- | --- |
| `es-ES.ts:3037` (`/privacidad`, «Tu dietista en NutrIA») | «Solo un profesional al que hemos dado acceso tras comprobar su número de colegiado puede hacerlo.» | Anybody may publish (decision 1). |
| `es-ES.ts:1451` (`care.invitationIntro`) | «{professional}, dietista-nutricionista con número de colegiado {collegiateNumber}…» | It would print a number no one checked, or none at all (§ 3.a). |
| `es-ES.ts:1457` (`care.invitationPrivacy`) and `:3041` | «…bajo su secreto profesional…» | An unbadged person owes no **statutory** secrecy (Ley 44/2003 art. 5.1.c binds health professionals). |
| `es-ES.ts:3560-3561` (`/condiciones`, «Si trabajas con un dietista») | «Un dietista-nutricionista puede invitarte…» | The flow becomes a directory, and the person may not be one. |
| `es-ES.ts:2804` and [`textos/01`](./textos/01-acuerdo-profesional.md) § 1 | «Usas NutrIA como dietista-nutricionista titulado y… colegiado» | False for an unbadged profile. |
| The client's screens: `badgeProfessional` (`:3428`), `subtitleProfessional` (`:3457`), `pendingReviewTitle` (`:1584`, `:2659`), `linkTitle` (`:1462`) | «Tu dietista» | For an unbadged professional this is NutrIA itself attributing the protected title (§ 3.a). |
| More client strings that say *dietista*: `es-ES.ts:1438` (`endConfirmBody`), `:1444-1445` (health share hints), `:1452` (`invitationLinkExistsBody`), `:1629` (`careLinkExists`), `:1961` (the health section's note), `:3038-3042` (the rest of «Tu dietista en NutrIA»), `:3569` (the terms' liability paragraph), and the same keys in `en-GB.ts` | «tu dietista», «un dietista» | The same reason as the row above. |
| PRD 004, decision 1 and acceptance criterion 1; `0059` ("holds the collegiate number"); [`go-live-checklist.md`](./go-live-checklist.md) § 1 *Organisation* | A grant by the owner after a number | These are records, not published text. They need an amending decision (the lead's). |

The table is what I found. The complete list is whatever a search for
`dietista|nutricionista|colegiad|secreto profesional` over both dictionaries returns on the
day the change is made. The texts in [`docs/projects/004-dietitian-workspace/LEGAL-REVIEW.md`](../projects/004-dietitian-workspace/LEGAL-REVIEW.md)
(the invitation mail and page as they stood) carry the same premise.

---

## 2. The shape I assume, and the one fork it turns on

What follows assumes **two tiers**:

- **Badged**: NutrIA has itself checked the collegiate number (§ 3.a explains how).
- **Unbadged**: everybody else.

The phrase "the professional" covers both, and I say which tier wherever the law differs.

The single most consequential open choice is **what the "hire" button is** (§ 3.f):

- **(A) A request.** It opens a conversation and, if accepted, a data link. The service
  contract, price and payment are agreed directly between the two people, and the screen
  says so.
- **(B) A hire.** Acceptance in NutrIA concludes the contract at the price shown.

I recommend (A). Where the answer differs between (A) and (B), I give both.

---

## 3. The eight questions

### 3.a The regulated profession (Ley 44/2003, colleges, CP art. 403)

**Verdict: not as stated. It becomes fine with four conditions.**

**What the law says**

- *Dietistas-nutricionistas* are a **titled, regulated health profession** at diploma level.
  Ley 44/2003 art. 2.2.b names the title "en Nutrición Humana y Dietética". Practising "por
  cuenta propia o ajena, requerirá la posesión del correspondiente título oficial" (art. 4.2).
  Their functions are "actividades orientadas a la alimentación de la persona o de grupos de
  personas, adecuadas a las necesidades fisiológicas y, en su caso, patológicas de las mismas"
  (art. 7.2.g). The same paragraph opens "sin perjuicio de… las que puedan desarrollar otros
  profesionales", so the functions are described but **not stated to be exclusive**.
- **Collegiate membership** is compulsory "cuando así lo establezca una ley estatal" (Ley
  2/1974 art. 3.2; Ley 44/2003 art. 4.8.a). Ley 25/2009, DT 4ª, keeps "las obligaciones de
  colegiación vigentes" until a state law lists the professions concerned. Whether a
  dietitian's membership is compulsory, and where, depends on regional college laws read
  against that transitional rule **[lawyer]**. For NutrIA the point is narrow: the badge
  certifies *registered with a college*, which is a fact anyone can check, and nothing more.
- **Intrusismo** (CP art. 403, consolidated 09/04/2026, wording of LO 1/2015):
  - **403.1**: "El que ejerciere actos propios de una profesión sin poseer el correspondiente
    título académico… multa de doce a veinticuatro meses."
  - **403.2.a**: prison from six months to two years "si el culpable, además, se atribuyese
    públicamente la cualidad de profesional amparada por el título referido".
  - The Constitutional Court reads the offence strictly. Construing the former art. 321, it
    held that the offence protects relevant interests, not the title as such, and that
    "título" meant an academic title (STC 111/1993, Pleno, 25 March 1993, and the line of
    cases that followed). The 1995 Code then split that into the two sentences of art. 403.1. The open question for
    an unbadged adviser is therefore whether drawing up an individual diet for a healthy adult
    is an "acto propio" of the dietitian. Art. 7.2.g's "sin perjuicio" weakens that for
    *physiological* needs. A diet for a **pathology** is where the exposure is plainly highest,
    and it also touches medicine (art. 6.2.a). **[lawyer]**: I found a reference to an STS of
    14/06/2011 on a dietitian's scope but could not read it, so I rely on nothing from it.
- **Professional advertising** must be "objetiva, prudente y veraz, de modo que no levante
  falsas esperanzas" (Ley 44/2003 art. 44.1). A patient has the right to know "el nombre, la
  titulación y la especialidad" of whoever treats them (art. 5.1.e), and colleges keep public
  registers for that purpose (art. 5.2).

**NutrIA's exposure, by kind**

- **Criminal.** To answer as a participant, NutrIA would need to be a necessary cooperator
  (CP art. 28.b) or an accomplice (art. 29), and both require intent. Hosting what a
  professional writes about themselves is covered by the hosting exemption **while NutrIA has
  no actual knowledge** (LSSI arts. 13.1 and 16, which reach "responsabilidad civil, penal y
  administrativa"; DSA art. 6.1). The exemption ends after a notice that makes the illegality
  evident without detailed legal analysis (DSA art. 16.3). It **never covers NutrIA's own
  words**, which include:
  - the badge;
  - a search category called "Nutricionistas";
  - «tu dietista» on the client's screen;
  - featuring or ranking a profile as a recommendation.

  The realistic path to exposure is NutrIA keeping a profile up after being told it is an
  impostor, or NutrIA itself calling an unbadged person a *nutricionista*.
- **Unfair competition and consumer law.** Misleading claims about "sus cualificaciones…, su
  aprobación, su afiliación" (LCD art. 5.1.g). Asserting that a professional "ha sido aprobado,
  aceptado o autorizado" without it being true, or showing a quality mark without
  authorisation (LCD art. 21.1.c and 21.2). Both apply to the badge if it is not true.
- **Civil.** Liability as a service provider unless diligence is proved (TRLGDCU art. 147). See
  § 3.g.

**Is mitigation 2 enough?** Not as stated, for three reasons:

1. "Declared, not checked by NutrIA" is honest about the *studies*. That is the right fix for
   LCD art. 5.1.g. It does nothing about the *act*, and the act is where art. 403 bites.
2. The gate covers illnesses and medication only. Everything else the 004 professional sees is
   health data in this context ([`analysis.md`](./analysis.md) § 1.2). The chat carries
   anything, gated or not (§ 3.d, § 3.e).
3. A badge given for a **typed** number is NutrIA asserting a check it did not make (LCD
   arts. 5.1.g, 21).

**Words: what an unbadged profile may and may not say** (my reading **[lawyer]**)

| Use | May an unbadged profile use it? | Why |
| --- | --- | --- |
| *Dietista-nutricionista*, *dietista*, *nutricionista*, *D-N*, *graduado/a en Nutrición Humana y Dietética*, *diplomado/a en NHD* | **No.** Badge only, and the screen shows them only from the badge, never from free text. | A public attribution of the protected quality (CP 403.2.a). An average consumer reads *nutricionista* as the profession (LCD art. 5.1.g). |
| *Médico*, *endocrino*, *enfermero/a*, *farmacéutico/a*, *psicólogo/a sanitario/a* | **No.** Not in v1, with or without a badge. | The same reasoning, for other titled professions NutrIA does not check. |
| *Técnico/a superior en dietética* | Only if NutrIA checks the title (decision O10). | A health-area vocational title (Ley 44/2003 art. 3.2.a). It is a qualification claim like any other (LCD 5.1.g). |
| *Asesor/a de alimentación*, *coach nutricional*, *asesor/a nutricional* | **Yes**, with a fixed notice beside the name: «No es un profesional sanitario verificado por NutrIA». | Not protected titles. The notice stops the consumer reading them as one (LCD arts. 5, 7). |
| *Consulta*, *paciente*, *tratamiento*, *diagnóstico*, *clínico*, *terapéutico*, a disease as a service ("dieta para diabetes"), promised results ("−10 kg garantizados") | **No**, in an unbadged profile's labels, title and description. | Clinical vocabulary signals a health service (403.2.a; LCD 5.1.b). Promised results are "falsas esperanzas" (Ley 44/2003 art. 44.1 for the badged; LCD art. 5 for everyone). |
| Free "studies" text | **Yes**, under «Declarado por esta persona; NutrIA no lo ha comprobado». The protected titles above must be refused in this field too. | Otherwise the field becomes a way round the badge. |

**Is showing an unverified collegiate number worse than showing none?** Yes, on three grounds:

- Printing a number is NutrIA's own representation of a registered qualification (LCD arts.
  5.1.g, 21.1.c).
- It lets anyone **borrow a real dietitian's number**, which is impersonation of a real person
  using that person's personal data.
- It would make `care.invitationIntro` false (§ 1.3).

**Rule:** NutrIA never displays a collegiate number, or the word *colegiado*, that it has not
checked itself.

**The minimum check behind the badge**

1. **A lookup in the college's public register, by hand.** Colleges must keep "el acceso al
   Registro de colegiados, que estará permanentemente actualizado" with "nombre y apellidos…,
   número de colegiación, títulos oficiales…, domicilio profesional y situación de
   habilitación profesional" (Ley 2/1974 art. 10.2.a; Ley 44/2003 art. 5.2). The number, the
   name and **"habilitado"** must all match.
2. **Proof that the account belongs to that person.** A name match is not enough, because the
   register is public. Options are in decision O2.
3. **A dated record**: who checked, when, which register, and the result. Keep no copy of an
   identity document after the check (art. 5.1.c, e GDPR). Re-check **every twelve months** and
   on any report. Remove the badge at once if the register stops showing the person as
   *habilitado*, with a statement of reasons (§ 3.b).

The basis for the check is art. 6.1.b (the professional asks for the badge) together with
6.1.f (protecting consumers). Reading a public register for its own purpose is consistent with
art. 10.2.a's stated aim, "la mejor defensa de los derechos de los consumidores y usuarios".

**Can the register check be automated?** (added 2026-11-18, at the owner's question)

**Verdict: fine with conditions**, as an aid to step 1 only. It can never replace step 2.

The plan: manual first, with the console showing the name, the number and a link to the
register, and the owner confirming. Later, the server would query one of two public sources and
grant the badge on an exact match.

| | CGCODN «Consulta pública de Dietistas-Nutricionistas Colegiados» | The Ministry's REPS public search (`reps.sanidad.gob.es`) |
| --- | --- | --- |
| What it shows | A national census «con carácter público», with «dirección profesional, especialidad o habilitación» | Name, degrees, specialties, category and function, workplace. No collegiate number. Search by name, surname, province or centre |
| Its own warning | «dicho censo no está completo y/o actualizado en todas las Comunidades Autónomas» | «actualmente todavía no están incorporados todos los profesionales sanitarios en ejercicio en España» |
| Its terms | Aviso legal § 4.3: «Queda prohibido cualquier uso de los contenidos… incluida la modificación, copia, reproducción… sin la previa autorización por escrito». Nothing specific on automated access. Undated (© 2022) | The Ministry's aviso legal allows reuse «para fines comerciales y no comerciales» on three conditions: cite the source, give the date of last update, and no «desnaturalización del contenido». Nothing on automated access |

**Database right.** The maker of a database may prohibit extraction of the whole or of a
**substantial** part (LPI art. 133.1). It may also prohibit «repetidas o sistemáticas»
extraction of insubstantial parts that conflicts with normal exploitation (art. 133.2). A lawful
user may extract insubstantial parts whatever the purpose (art. 134.1). One query about one
named applicant, when that person asks for the badge and on each yearly re-check, is an
insubstantial, non-systematic extraction. It is the use the register exists for: Ley 2/1974
art. 10.2 lists it «para la mejor defensa de los derechos de los consumidores y usuarios». A
crawl, a bulk download or a local mirror of either register is not, and is ruled out.

**Contract.** The CGCODN notice's written-authorisation clause may bind a user even where no
database right applies **[lawyer]** (M13). The clean course is to **ask the Consejo for written
permission** before a server queries its census. A short request saying "one lookup per
applicant, with their consent, nothing stored but the result" is likely welcome, because it is
anti-intrusismo work. REPS is the Ministry's public-sector information, and its reuse
conditions are met by recording the source and date and never altering the result.

**Data protection of the person looked up.**

- The lookup is about the applicant, at their request, so the basis is art. 6.1.b (they ask for
  the badge), together with 6.1.f.
- Tell them on the application screen that NutrIA will check the named register and keep the
  result (art. 13).
- Store only: register, date, «habilitado» yes/no, and the number. Nothing else from the page
  (art. 5.1.c).
- Never query anybody who did not apply. A search by name that returns several people is read
  for the applicant's row only, and the rest is discarded.

**Incompleteness decides the logic.**

- **An exact match may grant step 1.**
- **A miss must never refuse or accuse.** It goes to the owner's manual check, because both
  registers say they are incomplete. Treating a miss as "not a dietitian" would be a false
  statement about a real person (LCD art. 5.1.g; GDPR art. 5.1.d, accuracy).
- **A match is not proof of identity.** The register is public, so anyone can type a real
  colegiado's name and number. Automation can confirm "this number belongs to a registered
  dietitian called X". It cannot confirm "this account is X". **Step 2 stays human or
  out-of-band** (O2), and auto-grant without it reintroduces exactly the borrowed-identity risk
  of R3.
- REPS shows no collegiate number, so it can corroborate the title, never the membership.

**Technical conditions.**

- Respect `robots.txt` and any rate limit.
- Never bypass a CAPTCHA or a login.
- Identify the client generically.
- Make one request per check.
- Fail closed to manual review.

**Smallest change that makes 3.a fine**

1. Badge only after the three-step check.
2. Protected words only from the badge, and refused in free text.
3. The fixed notice on every unbadged profile and on the client's screens. «Tu dietista»
   becomes «tu profesional» unless the professional is badged.
4. A notice-and-action route that a college or a person can use to report an impostor (§ 3.b).

### 3.b NutrIA's role: LSSI, the DSA and the P2B Regulation

**Verdict: fine with conditions.** NutrIA is an online platform. Being a micro enterprise
exempts it from the heavy sections, not from the baseline.

**Classification**

- **Hosting service** (DSA art. 3.g.iii) for everything a recipient stores: profiles, reviews,
  replies, chat messages, hand-made plans.
- **Online platform** (art. 3.i) for profiles, reviews and replies: they are stored *and
  disseminated to the public* at the recipient's request (art. 3.k). The directory is the
  feature, not "una característica menor y puramente auxiliar". The **chat** is hosting but not
  dissemination to the public, because its participants are finite.
- **Traders.** Every professional who charges for their services is a *comerciante*, "toda
  persona física… que actúe… con fines relacionados con su actividad comercial, negocio,
  oficio o profesión" (DSA art. 3.f; TRLGDCU art. 4). That holds whether or not they are
  registered anywhere.
- **Platform allowing distance contracts with traders?** Under fork (B), yes. Under fork (A),
  arguably not, but see § 3.f.
- **Micro enterprise.** An enterprise is "toda entidad, independientemente de su forma
  jurídica, que ejerza una actividad económica", including "actividades… a título individual"
  (Recommendation 2003/361, annex art. 1). A microenterprise "ocupa a menos de 10 personas y
  [su] volumen de negocios anual o [su] balance general anual no supera los 2 millones de
  euros" (annex art. 2.3). If the owner is an enterprise at all, he is micro. My reading is
  that he is one once he charges professionals, or runs the directory as part of a service he
  sells. Whether an unregistered individual who charges nothing yet is "an enterprise" for
  arts. 19 and 29 is open **[lawyer]** (M11). If he is not, the exemptions would not apply, so
  that answer matters.

**What size exempts** (verified in the BOE copy of the DSA):

- Section 3 (arts. 20–28: internal complaint system, out-of-court disputes, trusted flaggers,
  misuse, dark patterns, advertising, recommender systems, protection of minors), **except art.
  24.3**: art. 19.1.
- Section 4 (arts. 30–32: **trader traceability**, compliance by design, the right to
  information): art. 29.1.
- The annual transparency report: art. 15.2.

These exemptions last while NutrIA stays small, and for twelve months after it stops being so
(arts. 19.1 and 29.1, second paragraph).

**What applies at any size**

| Duty | Article | What it means here |
| --- | --- | --- |
| Hosting exemption, and its limits | DSA 6.1–6.3; LSSI 16 (in force: the RDL 9/2024 repeal was itself revoked) | No liability for hosted content without actual knowledge, and prompt action once known. **6.3**: no exemption under consumer law if the interface leads an average consumer to believe the service is NutrIA's. This bears directly on § 3.g. |
| No general monitoring; own-initiative checks allowed | DSA 7, 8 | NutrIA may review profiles without losing the exemption, and is not obliged to scan chats. |
| Contact point for authorities, and for users (not only automated) | DSA 11, 12 | `{email}` named on a page, with the languages. |
| Terms that state the moderation rules | DSA 14.1, 14.2, 14.4 | Policies, procedures, human or automated review, and the complaint route, in plain language, machine-readable, with significant changes notified and enforcement that is "diligente, objetiva y proporcionada". |
| Notice and action | DSA 16 | Anybody can report any profile, review, reply or message: electronically, with the reason, the location, a name and e-mail, and a good-faith statement. NutrIA acknowledges the report, decides, and tells the reporter the outcome and the redress available. |
| Statement of reasons | DSA 17 | For every removal, demotion, suspension or account closure: the facts, whether it followed a notice, the legal or contractual ground, and the redress. That includes **removing a badge** and **hiding a review**. |
| Reporting suspected crimes that threaten life or safety | DSA 18 | Rare, but possible in a chat. |
| Average monthly users to the coordinator, on request | DSA 24.3 | Keep the number available. |
| **P2B: terms towards professionals** | Reg. 2019/1150 art. 3.1–3.5 | Plain terms, available before contracting. They must state the grounds for suspension or termination and the effect on intellectual property, and keep the professional's identity "claramente visible" (3.5). **Changes need at least 15 days' notice on a durable medium**, with a right to terminate (3.2). Clauses that breach this are void (3.3). |
| **P2B: restriction, suspension and termination** | art. 4 | Reasons at the moment of a restriction or suspension. **30 days' notice before terminating** a professional, except for legal obligation or repeated breach (4.2, 4.4). |
| **P2B: ranking** | art. 5.1 | The main ranking parameters and their relative weight, in the terms. |
| **Consumer side: ranking and reviews** | TRLGDCU 20.3, 20.4; LCD 26.2, 27.7, 27.8 | The ranking parameters must be "fácil y directamente accesible" from the results, "independientemente de dónde se realicen las transacciones". For paid placement and reviews, see § 3.c. |

P2B applies because NutrIA "permite a los usuarios profesionales ofrecer… servicios a los
consumidores, con el objetivo de facilitar el inicio de transacciones directas… **con
independencia de dónde aquellas concluyan**", on the basis of a contract with the professional
(art. 2.2). Accepting the terms creates that contract even when the listing is free. The
small-enterprise carve-outs exist only for the internal complaint system and mediation (arts.
11.5 and 12.7). Where art. 4.3 refers to that complaint system, a reply by e-mail will do.

**Smallest change.** v1 needs:

1. A report button on every profile, review, reply and message, plus one form.
2. A statement-of-reasons template, sent by e-mail.
3. A terms section on **moderation**, one on **ranking**, and one on **suspension and
   termination** of professionals.
4. The contact point.
5. 15 days' notice to professionals of any change to their terms.

None of this needs Section 3 or 4 machinery.

### 3.c Reviews

**Verdict: fine with conditions.** Decision 4 is close to what the law requires. Five things
must be added.

**What the law requires**

TRLGDCU art. 20.4 (as amended by Ley 10/2025; consolidated 04/11/2026). A trader who gives
access to consumer reviews must:

- state "el hecho de que el empresario garantice o no" that reviews come from people who
  "han utilizado o adquirido realmente" the service;
- give "información clara… sobre la manera en que se procesan las reseñas".

Further:

- **Reviews "deberán referirse a productos o servicios adquiridos o utilizados en los treinta
  días naturales anteriores a la fecha de la reseña".**
- The reviewed trader "estará facultado para responder… a través del mismo canal".
- The reviewed trader may ask for removal of a fake or misleading review only by proving it
  "de forma fehaciente".
- Breach is a misleading practice (art. 20.6; LCD art. 7).
- The blacklist: claiming reviews are genuine "sin tomar medidas razonables y proporcionadas
  para comprobar" (LCD art. 27.7), and adding fake reviews or **distorting** real ones (art.
  27.8).

NutrIA is the trader that gives access here. It runs the commercial practice: a directory that
promotes the professionals, and NutrIA itself.

**What to add**

1. **Say exactly what "hired" means.** Payment and service happen outside NutrIA, so NutrIA can
   only know that **a request was accepted and a link existed**. Suggested text: «Solo puede
   opinar quien tuvo una solicitud aceptada por este profesional en NutrIA. NutrIA no comprueba
   si el servicio se prestó ni se pagó, ni lo que se acordó fuera de la aplicación.» Anything
   stronger, such as «opiniones verificadas», breaches art. 27.7.
2. **The 30-day window.** A review may be written while the link is active, or within 30 days
   after it ends. That is my reading of "utilizados en los treinta días anteriores"
   **[lawyer]**. One review per link, which its author may edit.
3. **Reasonable and proportionate steps against self-dealing** (art. 27.7). A professional
   could accept requests from accounts they control. Proposed steps, owner decision O7:
   - one review per account and professional;
   - the link must have lasted at least seven days and carried messages from both sides;
   - the account must be older than the link;
   - NutrIA reviews by hand any professional whose ratings cluster from new accounts.
4. **No distortion** (art. 27.8). The professional may **reply** once, editable, under the same
   moderation rules, but may never hide or delete a review. A review comes down only:
   - by its author;
   - on a notice that shows it is illegal (defamatory, discloses a third party's data);
   - when it breaks the published rules;
   - on the professional's request **with fehaciente proof** that it is not from a real client
     (art. 20.4).

   Each removal gets a statement of reasons to the reviewer (DSA art. 17). An average shows its
   count ("4,6 · 12 opiniones").
5. **Ranking.** If ratings order the results, say so (TRLGDCU art. 20.3; P2B art. 5). If a paid
   plan ranks higher, disclose it on the result itself (LCD art. 26.2). The simplest v1 does
   neither (decision O11).

**Defamation and reply.** The reviewer answers for what they write: civilly under LO 1/1982,
and criminally for *injurias* and *calumnias* **[lawyer]** (not re-read for this report).
NutrIA answers once it has actual knowledge and fails to act (LSSI art. 16; DSA arts. 6 and
16.3). The professional's "derecho de réplica" here is art. 20.4's reply. It is not the media
right of rectification.

**Data protection of the rated professional**

- A rating attached to a name is personal data. The basis for publishing it is art. 6.1.f GDPR:
  the consumer's interest in knowing whom they hire, which a professional who advertises
  publicly can expect.
- The professional may object (art. 21.1). That legitimate interest will usually prevail
  over a well-founded review.
- LOPDGDD art. 94.2 grants the deletion of data about a person "facilitados por terceros para
  su publicación" in social networks "y servicios… equivalentes" when they are "inadecuados,
  inexactos, no pertinentes, no actualizados o excesivos". Whether a review directory is
  "equivalent" is open **[lawyer]**. Prudence says: run a procedure for such requests, and set a
  retention period (for example, reviews older than three years are hidden).
- I did not find an AEPD resolution on rating named professionals in this pass. That point is
  unverified.

**Data protection of the reviewer.** A review by a named person saying that a nutrition
professional helped them reveals something about their health. CJEU C-184/20 *OT* and C-21/23
*Lindenapotheke* read "data concerning health" broadly, including what can be deduced. So:

- show a **pseudonym**, not the account's full name or photo (decision O8);
- warn above the box not to write health details;
- let the author delete the review at any time (LOPDGDD art. 94.1);
- moderate any third party's health data, such as "mi hija con anorexia", off the page.

### 3.d The chat

**Verdict: not as stated. It becomes fine with seven conditions.**

**What it is.** A hosting service (DSA art. 3.g.iii), not dissemination to the public. It is
**not** a telecommunications "servicio de comunicaciones interpersonales": Ley 11/2022, annex
II, definition 71, excludes services that allow interpersonal communication "como una mera
posibilidad secundaria que va intrínsecamente unida a otro servicio". That is my reading
**[lawyer]**, and on it the telecom confidentiality regime does not apply. The constitutional
secrecy of communications (CE art. 18.3) is another matter. My understanding is that it does
not bind the participants themselves, so a participant may disclose what they received, but
I did not re-read the case law for this report **[lawyer]**.

**Who is controller**

- **NutrIA** controls the chat as a service: it decides storage, retention, who reads, the
  "limited" rules and moderation (art. 4.7). This follows the same test as
  [`analysis.md`](./analysis.md) § 2.1.
- **Each participant** is an independent controller of what they do with what they receive:
  - **badged**: art. 9.2.h and 9.3 (LOPDGDD DA 17ª);
  - **unbadged**: only art. 9.2.a, the client's explicit consent to *that person*.
- It is not joint controllership, for the reason in § 2.4 of the analysis: the purposes are
  separable.

**The processor trigger.** The trigger in [`analysis.md`](./analysis.md) § 2.3 fires if the
chat becomes the professional's working record: an export for them, a per-client archive kept
after the client leaves, or notes beside the thread. NutrIA would then process on the
professional's behalf, and the agreement promises an art. 28 contract first. **The smallest
way to stay out of it:**

- the conversation belongs to both people while it exists;
- there is no export for the professional;
- the agreement tells the badged professional that their clinical record (Ley 44/2003 art.
  4.7.a; Ley 41/2002, as cited in [`textos/01`](./textos/01-acuerdo-profesional.md) § 5) is
  kept outside NutrIA.

**Art. 9 for NutrIA's own storage.** This is the same open question as H1 in the
[brief](./2026-11-11-lawyer-hour-brief.md): health data a person types into free text. The
chat is the stronger case, because the purpose is to talk about one's diet with someone.
Until the lawyer answers:

- an **explicit, separate consent before the first message** (art. 9.2.a; art. 7.2). Suggested
  text: «Lo que escribas aquí se guarda en NutrIA y lo lee {profesional}. Si cuentas algo de
  tu salud, consientes que NutrIA lo guarde para esta conversación.»;
- a note on unbadged threads: «{profesional} no es un profesional sanitario verificado: no
  está obligado por ley al secreto profesional».

**The seven conditions**

1. **Before acceptance, a structured request.** The requester's goal from a closed list, a
   short free note of at most 500 characters with a warning not to include health details,
   and one reply from the professional. The professional sees the display name, never the
   e-mail. If the request is refused or unanswered in 14 days it is **deleted**, as
   invitations are today. Decision O5.
2. **No message goes to any model, log line, error report or analytics property.** This
   extends the health boundary (`docs/ARCHITECTURE.md` § Invariants) to a new store of free
   text.
3. **Retention.** While the link lasts. After it ends, read-only for 30 days, then deleted.
   When **either** account is deleted, the whole conversation goes for both, and the
   professional is told in advance to copy anything they must keep. Decision O6.
4. **Access and portability.** The subject-access copy and the export (#356) include the
   person's own messages, and the other side's where that does not adversely affect them
   (arts. 15.3–15.4, 20).
5. **Moderation reads only what is reported.** Only the reported messages and the minimum
   context, read by the owner, with each reading logged. The terms say so (DSA art. 14.1). No
   scanning (DSA art. 8; GDPR art. 5.1.c). Basis: 6.1.c and 6.1.f. For any health datum inside
   a reported message, the art. 9.2 exception is open **[lawyer]**.
6. **Minors.** Both parties must be 18 or over. Today that is self-declared
   (`AGE_YEARS.min = 18`, `packages/core/src/entities/Profile/Profile.ts:79`, checked by
   `assertOldEnough`, `packages/core/src/controllers/Profile/ProfileController.ts:424`), and
   the professional's sign-up needs the same gate. The agreement forbids accepting a minor, and
   the report form has a reason for it. DSA art. 28 does not bind a micro platform. The risk
   of an adult stranger messaging a child does not care about size.
7. **No payment details or links before acceptance** (a scam vector). The terms forbid asking
   for prepayment through the chat (§ 3.f).

### 3.e Roles after the change, and what must be rewritten

**Verdict: not as stated. The 004 construction survives for badged professionals. For
unbadged ones it must be rebuilt on explicit consent alone.**

**What survives.** The communication model: the client asks, consents, and NutrIA communicates
(arts. 6.1.a and 9.2.a). It gets *stronger* in the directory flow, because the client
initiates. The art. 14 problems of an address typed by the professional disappear for this
path. For a **badged** professional, the 004 construction holds as written: independent
controller, 9.2.h and 9.3, statutory secrecy, no processor, art. 26 fallback.

**What does not survive, for the unbadged**

- Their own processing cannot rest on 9.2.h: they are not "un profesional sujeto a la
  obligación de secreto profesional" (art. 9.3). The only exception left is **explicit consent
  given to them, by name** (9.2.a). LOPDGDD art. 9.1 does not restrict consent for health data.
  NutrIA would collect that consent on its own screen, and it would serve two controllers:
  NutrIA's communication, and the unbadged person's own processing. Whether one tick can carry
  both, if the screen names both, is open **[lawyer]** (M12). Until it is answered, the screen
  names both purposes and both controllers.
- Secrecy must be **contractual**, written into their agreement, and the client must be told
  that it is only contractual.
- **What they see must shrink.** Mitigation 2 drops illnesses and medication. The 004 overview
  would still show the weight series, targets *with their derivation* (basal metabolism,
  activity factor: these reveal age, sex and weight), the goal, adherence and check-in answers
  (`CareClientOverviewView`, [`analysis.md`](./analysis.md) § 1.4). Owner decision O1 picks
  between:
  - nothing beyond the plan they write and what the client chooses to tell them in the chat;
    recommended, because the gate then holds by construction;
  - today's list without conditions and medication, under a separate consent listing every
    item.

**A conflict with the architecture report.** [`0013`](../reference/architecture/0013-a-marketplace-of-professionals-2026-11-18.md)
§ 2.2 reuses `withClient` and the overview "as is" for every professional, with the badge
checked only on the health branch (§ 6 there). Under B1 (§ 5) that is not enough: the
overview itself carries health data in context. If O1 is (a) or (b), `withClient`'s
non-health reads also need the badge, or a narrower view for the unbadged. That report's
questions to `legal` (its § 6) are answered here: the title on an unchecked number (§ 3.a),
the weight series and check-ins (§ 3.e; allergies are not in today's overview,
`CareClientOverviewView`, `packages/core/src/controllers/Care/CareController.ts:204-211`), the
chat (§ 3.d), reviews that reveal a care relationship (§ 3.c) and the intermediation duties
(§ 3.b).

**What must be rewritten** (listed here, not drafted)

| Text or record | What changes | Version constant |
| --- | --- | --- |
| The professional's agreement ([`textos/01`](./textos/01-acuerdo-profesional.md)) | Two tiers. § 1 (who you are), § 3 (statutory vs contractual secrecy), § 6 (invitation → request; who you may accept; never a minor; the "not a user" conditions). New: the public profile, the allowed words (§ 3.a), reviews and reply, the chat, price and information duties (§ 3.f), the P2B content (grounds for suspension, ranking, notice of changes), moderation. | `PROFESSIONAL_AGREEMENT_VERSION` → `2.0.0` |
| The practice terms ([`textos/04`](./textos/04-condiciones-consulta.md)) | The free listing tier, if there is one. P2B arts. 3–5. Still deferred with payments. | the same constant |
| The client's consent ([`textos/05`](./textos/05-consentimientos-cliente.md) § B) | Given **at acceptance**, not at the request. The list depends on the tier. Unbadged: the line that the person is not a verified health professional and owes no statutory secrecy. The allergen inference (§ 3.g). | `CARE_CONSENT_VERSION` → `3.0.0` |
| A new consent: the chat | Before the first message (§ 3.d). | a new constant, for example `CHAT_CONSENT_VERSION` |
| `/privacidad` | «Tu dietista en NutrIA» rewritten (§ 1.3), plus new paragraphs on the directory, public profiles, reviews, the chat, the badge check and moderation. New recipients ("the professional you choose, verified or not"). | `updated`; the policy's own "important change" clause promises a mail before it applies ([brief § 1](./2026-11-11-lawyer-hour-brief.md#1-the-facts-the-lawyer-needs-as-of-2026-11-11)) |
| `/condiciones` | «Si trabajas con un dietista» rewritten. New: the directory, the request, reviews (20.4 text), moderation (DSA 14), ranking (20.3), the marketplace information (97 bis, under fork B), one plan, liability (§ 3.g). | `TERMS_VERSION` → next minor |
| Client screens | «Tu dietista» only for the badged (§ 1.3). | none |
| Mail ([`textos/06`](./textos/06-correos.md)) | Request received, accepted, refused. Review published, replied to, reported. DSA 16.5 decision to a reporter. DSA 17 / P2B 4 statement of reasons. The professional's welcome. | none |
| [`record-of-processing.md`](./record-of-processing.md) | Row 1 (professionals sign up themselves). Row 5 rewritten. **New rows**: the directory and public profiles; reviews; the chat; requests; reports, moderation and statements of reasons; badge verification records. | none |
| [`dpia.md`](./dpia.md) | An addendum **before** any of it processes (art. 35.1 and 35.11): public profiles, evaluation and scoring of named people (ratings), free-text health data in the chat, and health data going to **unverified** recipients. The AEPD list criteria already counted (1, 4, 8, 10) all grow. | none |
| `0059` and PRD 004 | An amending decision (the lead's). The grant is no longer the only way in, the directory is no longer out of scope, and links no longer start with an invitation. | none |

### 3.f Payment outside the app, prices, and the "hire" button

**Verdict: fine with conditions.** The conditions depend on fork (A) or (B).

**Payment services.** RDL 19/2018 regulates the payment services it lists (art. 1.2):
deposits, withdrawals, executing payment transactions, and so on. A NutrIA that never
receives, holds or forwards a client's money provides none of them. **Condition:** no "pay
through NutrIA" button, no collection on a professional's behalf, no wallet. The professional's
own subscription is NutrIA selling its own service through Stripe, as in `0056`. If the owner
ever wants NutrIA to collect for professionals, that is a payment service and would go through
a licensed provider such as Stripe Connect. That is a different project.

**Price on the profile.** A profile with a price and a hire button is a commercial offer.
TRLGDCU art. 20.1 requires:

- the trader's name and address (20.1.a);
- "el precio final completo, incluidos los impuestos" (20.1.c), or the basis of calculation;
- in a marketplace, whether the third party is a trader by its own declaration (20.1.f).

The professional is responsible for the content. NutrIA builds the frame, so the frame must
ask for it:

- a **price field labelled "precio final, impuestos incluidos"**, with a unit (per
  consultation, per month, per plan);
- a field for the trader's identity and contact.

Whether a badged dietitian's service is VAT-exempt as health assistance, and so how the price
should read, is a question for the *gestor*.

**Pre-contract information and withdrawal**

- **LSSI art. 10.** Every ISS provider gives its name, address, e-mail and NIF. A **regulated
  profession** adds the college, the number, the title and the professional rules (10.1.d).
  Whether each professional owes this as an ISS provider by advertising on NutrIA is open
  **[lawyer]**. If so, NutrIA must make room: structured fields for the badged, filled from
  the check. Showing a domicile and NIF publicly is a cost to individuals working from home
  **[lawyer]**.
- **TRLGDCU art. 60** (all consumer contracts): clear pre-contract information on the main
  characteristics, the trader's identity and the total price.
- **LSSI art. 10.1.f**, wherever the service mentions prices: "información clara y exacta sobre
  el precio…, indicando si incluye o no los impuestos aplicables". The price field's label
  covers that for every profile.
- **Fork (B), a binding hire, for an unbadged (non-health) service.** It is a distance contract
  (art. 92.1), so these apply:
  - art. 97: identity, address, phone, e-mail, total price, payment and performance, withdrawal
    and the model form;
  - **art. 98.2**: the button must read «pedido con obligación de pago» or the like, "en caso
    contrario, el consumidor… no quedará obligado";
  - the right to withdraw "durante un periodo de catorce días naturales sin indicar el motivo"
    (art. 102.1), with the exception for a service fully performed with express consent and
    acknowledgment (art. 103.a). Penalising or waiving the right is void (art. 102.2);
  - **NutrIA's own duty under art. 97 bis**: ranking parameters, trader status, how
    obligations are split between NutrIA and the professional, guarantees, dispute methods.
- **Fork (B) for a badged dietitian.** All of Title III, including 97, 97 bis, 98 and
  withdrawal, **does not apply** to "contratos de servicios relacionados con la salud,
  prestados por un profesional sanitario a pacientes para evaluar, mantener o restablecer su
  estado de salud" (art. 93.b). Whether a remote dietetic service falls in that letter is my
  reading, yes **[lawyer]**. Art. 20 (Book I) still applies.
- **Fork (A), a non-binding request.** If nothing in NutrIA concludes the contract, NutrIA does
  not "permit consumers to conclude distance contracts" (art. 59 bis.3; DSA art. 3.l), so art.
  97 bis, art. 98.2 and DSA section 4 are not engaged. P2B, DSA 14–17, TRLGDCU 20.1, 20.3 and
  20.4 still apply, because each is drafted "independientemente de dónde se realicen las
  transacciones". **The label alone will not do it.** If acceptance in NutrIA, at the price
  shown, is in substance the agreement, a court may say so **[lawyer]**. Recommended screen:
  «Enviar solicitud. Todavía no contratas ni pagas nada: si acepta, el precio, el pago y las
  condiciones los acordáis directamente.» The price on the profile stays as a quoted price, and
  each professional confirms their terms to the client directly.

**Does a "hire" button create duties for NutrIA?** Under (B), yes: art. 97 bis, the art. 98.2
label, and possibly DSA section 4 once NutrIA is no longer micro. Under (A), only the art. 20
duties and the platform duties of § 3.b. Under both, DSA art. 6.3 applies if the interface
makes the service look like NutrIA's.

**A tax note for the *gestor*.** The DAC7 platform-reporting rules (Directive 2021/514;
Spain, Ley 13/2023) may reach a platform that facilitates "personal services". The exclusion
I recall for software that only lets users *advertise* could not be checked against the text
in this pass. Fork (A) is the safer side of that line **[gestor]**.

### 3.g One plan, and a plan written by hand

**Verdict: not as stated. It becomes fine with five conditions.**

**Who answers if a hand-made plan harms someone**

- **The author.** In contract (CC art. 1101) or in tort (art. 1902; the Civil Code was not
  re-read for this report). As a service provider
  unless they prove diligence (TRLGDCU art. 147). **Health services** fall under the stricter
  special regime (art. 148, "en todo caso… los servicios sanitarios"). Possibly in criminal law
  too (§ 3.a).
- **NutrIA, for the plan as hosted content.** Exempt until actual knowledge (DSA art. 6.1;
  LSSI art. 16). **Not exempt under consumer law if the interface makes the plan look like
  NutrIA's** (art. 6.3). And it will look like NutrIA's: it would appear in NutrIA's plan
  screen, with NutrIA's macro rings, shopping list, swaps and safety notices. That is the
  largest new liability in this remodel.
- **NutrIA, for its own acts.** Its own checks (the allergen gate, bounds, the energy floor)
  are its own service. A failure in them is NutrIA's failure under art. 147, as it already is
  today. A clause excluding liability for "la muerte o… las lesiones" caused by the trader's
  act or omission is unfair (TRLGDCU art. 86.2). The terms may **allocate**: the professional
  answers for their advice. They may not **exclude** NutrIA's own liability.

**What the allergen gate changes**

- It is the right safety measure, and it keeps a known allergen out of any plan whoever writes
  it. It requires the hand-made plan to be **structured** (catalogue foods). A gate cannot read
  free prose.
- **It leaks.** A dish refused "for this person" tells an author who never sees allergies (the
  004 rule, kept for both tiers) something about that person's health. Either the client's
  consent says so (§ 3.e), or the picker silently omits the dishes, which still allows
  inference. Saying it in the consent is the honest fix (art. 5.1.a; art. 13).
- It **does not cover the rest**. The 004 professional's targets pass `targetViolations`, and
  generated plans are held to the energy floor in the scheduler
  (`packages/core/src/domain/Scheduler/Scheduler.ts`). A hand-made plan
  must pass the **same bounds and floor**. Otherwise an unverified person can publish a
  900 kcal fortnight into a person's account under NutrIA's frame.
- **The "not a user" groups.** `PRODUCT.md` § Users ("Not a user (v1)") excludes diagnosed metabolic disease,
  pregnancy, eating-disorder recovery and paediatric feeding, and says the product "must
  recognise these and point to a professional". Under mitigation 2 an unbadged
  professional never learns that a client declared any of these, and plans blind. Decision O4:
  a person who declared a condition, medication or pregnancy may only send requests to badged
  professionals, or is warned before sending.

**One plan.**

- While a professional's plan is active, the AI plan is not shown. That is lawful and
  simplifies the AI Act picture: art. 50 marks AI output, and a hand-made plan must **not**
  carry the AI mark.
- If the professional generates with NutrIA's model and then edits, the art. 50.2 marking
  (#359) stays on what the model wrote.
- When the link ends, say what the person keeps: under 004, the last published plan.

**What the terms must say**

1. Who wrote the plan.
2. That NutrIA neither writes nor reviews a professional's plan, and that an unbadged author is
   not a verified health professional.
3. What NutrIA *does* check on every plan (allergens, bounds, floor) and what it does not.
4. That each answers for their own part: the professional for their advice, NutrIA for its
   tool. **Never** an exclusion of NutrIA's own liability for injury (art. 86.2).
5. The one-plan rule, and what happens to the AI plan and to the professional's plan when the
   link ends.

**The five conditions**

1. Attribution on every view of the plan: «Plan de {profesional}. No lo ha hecho NutrIA ni su
   IA.»
2. The same bounds, floor and allergen gate.
3. Structured plans only.
4. The allergen inference stated in the client's consent.
5. Decision O4 on the "not a user" groups.

### 3.h Public profile pages indexed by search engines

**Verdict: fine with conditions.**

**The professional's own data.**

- The basis is **art. 6.1.b**: the professional asks to be listed, and publishing is the
  service. It is not consent, and need not be.
- Being found by search engines is part of what they ask for, so indexing by default is
  consistent with the contract. An "ocultar a buscadores" switch (`noindex`) is cheap and
  supports art. 21 and the professional's own wishes (decision O9).
- They may unpublish or delete the profile at any time (art. 17; LOPDGDD art. 94.1, if a
  directory is a "servicio equivalente" **[lawyer]**).
- Show only what promotion needs: a name, a photo if they choose, studies (declared), the
  badge (checked), the price, the hours, and a **city, not a street address**. The LSSI art.
  10 question is in § 3.f.
- **Never** show their e-mail. Contact goes through a request.

**Delisting.**

- Removing a link from search results is the search engine's duty (art. 17 GDPR; LOPDGDD art.
  93, which applies to "los motores de búsqueda").
- NutrIA's part: when a profile is deleted, answer **410** or 404 at once, drop it from the
  sitemap, and never keep a cached public copy, so engines drop it on their next pass.
- A badge removed for cause disappears from the page at once, and the statement of reasons goes
  to the professional (DSA art. 17; P2B art. 4).

**Reviews on an indexed page.** They attach to the professional's name in search results, so
the art. 6.1.f balancing of § 3.c applies. The reviewer appears under a pseudonym (§ 3.c).

**For the `seo` agent, later.** Profile pages are a new public surface. The badge must be
rendered from data, never from free text, in structured data too: a `schema.org` professional
type with `hasCredential` only for the badged.

---

## 4. Risks, ranked by what could happen to a real person

| # | Severity | Risk | Where it comes from | Fix (§) |
| --- | --- | --- | --- | --- |
| R1 | **P0** | A person with an eating disorder, a metabolic disease or a pregnancy follows a restrictive hand-made plan from an unverified adviser who could not know. | Decisions 1, 2 and 5, with no bounds on hand-made plans | Same bounds and floor; O4; attribution (3.g) |
| R2 | **P0** | Weight, goal, targets and check-ins reach an unbadged person without a valid art. 9 basis. | Mitigation 2 covers only illnesses and medication | O1; consent naming the person (3.e) |
| R3 | **P0** | A badge on a borrowed or typed number tells people they are seeing a registered dietitian. | Decision 2 without a check | The three-step check (3.a) |
| R4 | **P0** | Published texts say "comprobado su número de colegiado", "secreto profesional", "tu dietista" about people none of that is true of. | § 1.3 | Rewrite with the change (3.e) |
| R5 | **P1** | Health details typed into a chat are stored with no explicit consent, or read by NutrIA, or kept forever. | Decision 3 | The seven conditions (3.d) |
| R6 | **P1** | A minor talks to an adult stranger through NutrIA. | Open requests and chat; age self-declared | 18+ gate for both sides, report reason (3.d) |
| R7 | **P1** | Fake or suppressed reviews mislead people choosing someone to manage their health. | Decision 4 without steps | 20.4 statement, window, steps, no suppression (3.c) |
| R8 | **P1** | A client cannot tell who answers for what, or is bound by a "hire" they did not see as paid. | Fork (B) without 98.2 | Fork (A), or the full (B) regime (3.f) |
| R9 | **P1** | A professional is removed or demoted with no reasons and no notice, which is void and actionable under P2B. | No moderation process | DSA 17, P2B 3–5 (3.b) |
| R10 | **P2** | A reviewer's full name is published next to health details. | Decision 4 | Pseudonym, warning, deletion (3.c) |
| R11 | **P2** | NutrIA becomes the professional's processor without an art. 28 contract. | Chat export, archives | No professional export (3.d) |
| R12 | **P2** | A prepayment scam through the pre-acceptance chat. | Decisions 3 and 6 | No payment links before acceptance (3.d) |
| R13 | **P3** | Wording: «opiniones verificadas», «nuestros nutricionistas». | Copy | The word table (3.a); 27.7 wording (3.c) |

---

## 5. Blocking findings: what must be settled before anything is built

1. **B1 (P0). What an unbadged professional sees.** Mitigation 2 leaves weight, goal, targets
   and their derivation, adherence and check-ins flowing to people who cannot rely on art.
   9.2.h. Decide O1, and design the consent naming the person before any screen (§ 3.e).
2. **B2 (P0). The badge rests on NutrIA's own check, never on a typed number.** Register lookup,
   identity binding, a dated record, a yearly re-check. The protected words are rendered only
   from the badge and refused in free text (§ 3.a).
3. **B3 (P0). The texts in § 1.3 are rewritten in the same change** that opens the directory,
   along with an amending decision to `0059` and PRD 004.
4. **B4. Fork (A) or (B) for the hire button.** It decides arts. 97 bis and 98.2, withdrawal,
   DAC7, and the screens themselves (§ 3.f).
5. **B5. Hand-made plans pass the same energy floor, target bounds and allergen gate, are
   structured, and say who wrote them** (§ 3.g). Without this, decision 5 puts an unbounded
   plan in NutrIA's frame.
6. **B6. The DSA and P2B baseline is in v1, not later.** Report button and form, statements of
   reasons, terms on moderation, ranking and suspension, contact points, 15 days' notice of
   changes to professionals (§ 3.b).
7. **B7. Reviews are built to TRLGDCU art. 20.4 and LCD 27.7–27.8.** That means the exact "how
   we check" sentence, the 30-day window, steps against self-dealing, a reply, and no
   suppression (§ 3.c).
8. **B8. The chat's seven conditions**, including consent before the first message and the
   promise that no message reaches a model or a log (§ 3.d).
9. **B9. The DPIA addendum and the record of processing are written before the first profile
   is published** (art. 35.1; art. 30), not after.

Not blocking the build, but blocking a launch where professionals pay: the owner's own
registration (form 036, RETA, the NIF and address in the legal notice; [`analysis.md`](./analysis.md)
§ 6). P2B and DSA make NutrIA's identity part of the contract with every professional. A
civil-liability policy that covers platform activity is worth pricing before the directory
opens.

---

## 6. The owner's decisions, as options

### 6.0 The owner's answers (2026-11-18)

The owner answered by tapped options on 2026-11-18. The answers are recorded in
[`0110`](../decisions/0110-anyone-may-offer-their-services-and-a-checked-badge-is-what-opens-health-data.md),
and this note keeps the two documents in agreement. Where 0110 and this note differ, 0110 is
the record.

| | Answer | Legal consequence |
| --- | --- | --- |
| O1 | (a) An unbadged professional sees **only the plan they write and the chat**. | B1 is settled by construction. The consent for an unbadged link names that person and the chat, and lists no overview data (§ 3.e). |
| O2 | (a) **Register lookup plus a code sent to the professional contact the register lists.** A yearly re-check. Manual first. | § 3.a's three steps, and the automated-lookup conditions. A contact the applicant supplies is never acceptable (§ 6.0.1). |
| O3 | (a) **A request, not a contract.** | Fork (A) of § 3.f. The screen must say that nothing is contracted or paid through NutrIA. Arts. 97 bis and 98.2 are not engaged, unless the lawyer answers M4 the other way. |
| O4 | (a) A person who declared an **illness or medication** may ask **badged professionals only**. | Closes R1 for those people. Pregnancy is not in the health section's list. If pregnancy is ever recorded, it should follow the same rule (my recommendation). |
| O5 | **Three messages each within seven days, no payment links.** The owner chose this over my one request and one reply. | Lawful with the same conditions: a warning against health details above the box, no health fields, payment links refused, and the thread deleted if the request is refused or left unanswered. The exposure (R5, R12) is somewhat larger than under my option, and nothing more is required for it. |
| O6 | (a) Read-only for **30 days** after the end, then deleted. | § 3.d, condition 3. |
| New | **The owner gives every new profile a first look before it appears.** | Reviewing on one's own initiative does not lose the hosting exemption (DSA art. 7). What the owner sees, though, he then knows (DSA art. 6.1). So the first look must apply the word list and the badge rule of § 3.a, and approving a profile is not an endorsement. A refusal or hold gets a statement of reasons (DSA art. 17; P2B art. 4.1). |
| O7–O11 | Left for the project that needs them. | Reviews (O7, O8), indexing (O9), a second checked mark (O10) and ranking (O11) stay open. B6 and B7 still apply when reviews and search are built. |

#### 6.0.1 If the register shows only a postal address

O2 relies on a contact the register itself shows. In order of preference, I would accept:

1. **A code by post to the professional address in the register.** It is slow, but it is the
   contact the register publishes, and only someone at that address receives it.
2. **A code to an e-mail address the college issues only to its members** (the college's own
   domain), where such addresses exist. They are as good as the register.
3. **A call to a phone number the register lists** (not one the applicant gives), to read
   them the code.

Not acceptable: any e-mail, phone or address that only the applicant supplies, or a document
upload alone. Each of those lets someone who knows a real dietitian's name and number take the
badge, which is R3.

The recommended option comes first in each list. Where an option is legally untenable, I have
left it out and say so.

- **O1. What an unbadged professional sees of a client**
  - (a) Only the plan they write and what the client chooses to tell them in the chat
    *(recommended: the gate then holds by construction)*
  - (b) Today's list without illnesses and medication, under a separate consent naming each
    item
  - (c) The client picks item by item
- **O2. How the badge is checked** (a typed number alone is not an option, § 3.a)
  - (a) Register lookup, plus a code sent to the contact the college or the professional's own
    website publishes *(recommended)*
  - (b) Register lookup, plus an identity document shown on a short video call, nothing kept
  - (c) Register lookup, plus an identity document uploaded and deleted after the check
- **O3. The "hire" button**
  - (a) A request: the contract and payment are agreed directly, and the screen says so
    *(recommended)*
  - (b) A binding hire labelled «pedido con obligación de pago», with the marketplace
    information
- **O4. Who a person with a declared condition, medication or pregnancy can ask**
  - (a) Only badged professionals *(recommended)*
  - (b) Anybody, after a warning they must read
  - (c) Anybody, no warning
- **O5. Before acceptance**
  - (a) One structured request and one reply *(recommended)*
  - (b) Up to five short messages each way
  - (c) No message at all, only the request
- **O6. The chat after the link ends**
  - (a) Read-only for 30 days, then deleted *(recommended)*
  - (b) Deleted at once
  - (c) Kept six months, like the assistant
- **O7. Steps against self-dealing in reviews**
  - (a) Link of at least 7 days with messages both ways, the account older than the link, one
    review per pair *(recommended)*
  - (b) Only one review per pair
- **O8. How a reviewer appears**
  - (a) First name and initial *(recommended)*
  - (b) An alias they choose
  - (c) «Cliente» with no name
- **O9. Profiles in search engines**
  - (a) Indexed by default, with a switch to hide *(recommended)*
  - (b) Hidden by default, with a switch to show
  - (c) Never indexed
- **O10. A second checked mark for *Técnico/a superior en dietética***
  - (a) Not in v1 *(recommended)*
  - (b) Yes, checked like the badge
- **O11. How results are ordered**
  - (a) Badged first, then by distance or availability; not by rating or by paid plan
    *(recommended: the simplest disclosure)*
  - (b) Weighted by rating, disclosed
  - (c) A paid boost, labelled on each result (LCD art. 26.2)

---

## 7. For the lawyer's hour

These are new items, each answerable yes/no. I suggest adding them to the
[brief](./2026-11-11-lawyer-hour-brief.md) as a block of their own. None is live today, so by
the brief's ranking they come after H1–H9. Together they need about 30 minutes, or one more
hour.

| # | Question | Why it matters | Min |
| --- | --- | --- | --- |
| M1 | Is drawing up an individual diet for a healthy adult, by somebody without the title, an "acto propio" of the dietitian-nutritionist (CP art. 403.1)? Does NutrIA risk participation (CP arts. 28.b, 29) if it keeps such a profile after a notice? | Decides whether unbadged plan-writing can exist at all (§ 3.a) | 5 |
| M2 | Is «nutricionista», alone, a public attribution of the protected quality (403.2.a)? May an unbadged profile use «coach nutricional» or «asesor nutricional» under a fixed notice? | The word table (§ 3.a) | 3 |
| M3 | Is collegiate membership compulsory for dietitians-nutritionists today (Ley 25/2009 DT 4ª with the regional laws)? Should the badge go to a graduate who is not registered? | The badge's meaning (§ 3.a) | 2 |
| M4 | If the screen says nothing is contracted, does an in-app request accepted at a displayed price still conclude a distance contract through NutrIA (TRLGDCU art. 59 bis.3; DSA art. 3.l)? | Fork (A) vs (B) (§ 3.f) | 3 |
| M5 | Is a remote dietetic service by a registered dietitian within TRLGDCU art. 93.b (outside Title III)? | Withdrawal and art. 97 for the badged (§ 3.f) | 2 |
| M6 | Does "utilizados en los treinta días naturales anteriores" (art. 20.4) allow a review while the link is active and up to 30 days after it ends? | The review window (§ 3.c) | 2 |
| M7 | Which art. 9.2 exception covers NutrIA storing health data typed into the chat (with H1), and NutrIA reading a reported message that contains health data? Does CE art. 18.3 restrict reading what a participant reports? Is the chat outside the telecom "servicio de comunicaciones interpersonales" (Ley 11/2022, annex II, def. 71) as an ancillary feature? | The chat (§ 3.d) | 4 |
| M8 | Is a directory of professionals with reviews a "servicio equivalente" to a social network for LOPDGDD art. 94? | Deletion on request (§ 3.c, § 3.h) | 1 |
| M9 | Must each professional's public profile show a domicile and NIF (LSSI art. 10) when they advertise through NutrIA? | Privacy of individuals working from home (§ 3.f) | 2 |
| M10 | May NutrIA's terms make the professional answer to the client for the advice, while NutrIA answers for its tool, without breaching TRLGDCU art. 86.2? | The liability clause (§ 3.g) | 1 |
| M11 | Is an unregistered individual who runs the directory, and charges nothing yet, an "enterprise" (Rec. 2003/361, annex art. 1), so that the DSA micro exemptions (arts. 19, 29) apply? | Whether DSA sections 3 and 4 apply (§ 3.b) | 1 |
| M12 | Can one explicit consent, collected on NutrIA's screen and naming both controllers, be both NutrIA's art. 9.2.a basis to communicate and the unbadged person's own basis to process? | The unbadged tier (§ 3.e) | 2 |
| M13 | Does the CGCODN aviso legal's ban on copying «sin la previa autorización por escrito» bind a server that makes one lookup per applicant, even though that is an insubstantial extraction under LPI arts. 133–134? Or is written permission needed in any case? | Automating the badge check (§ 3.a) | 2 |

**For the *gestor*:** whether a dietitian's service is VAT-exempt as health assistance, and so
how "impuestos incluidos" should read on a price; whether DAC7 reporting reaches NutrIA under
fork (A) or (B); and the owner's registration, already listed in the brief § 4.

---

## Sources (read 2026-11-18)

- **Código Penal** (LO 10/1995), BOE-A-1995-25444, consolidated to 09/04/2026: arts. 28, 29,
  403 (as worded by LO 1/2015).
- **Ley 44/2003** (health professions), BOE-A-2003-21340, consolidated to 05/06/2021: arts.
  2.2.b, 3.2.a, 4.2, 4.7.a, 4.8, 5.1.c, 5.1.e, 5.2, 6.2.a, 7.2.g, 44.
- **Ley 2/1974** (professional colleges), BOE-A-1974-289, consolidated to 02/08/2024: arts.
  3.2, 10.2.a.
- **Ley 25/2009**, BOE-A-2009-20725: DT 4ª.
- **TRLGDCU** (RDLeg. 1/2007), BOE-A-2007-20555, consolidated to **04/11/2026** (newer than the
  28/02/2026 version this folder's README lists; art. 20.1.c was last amended by RDL 32/2026):
  arts. 3, 4, 20 (incl. 20.3 and 20.4 as amended by Ley 10/2025), 59 bis.3, 60, 86, 92, 93,
  97, 97 bis, 98, 103, 147, 148.
- **Ley 3/1991** (unfair competition), BOE-A-1991-628, consolidated to 27/12/2025: arts. 5, 7,
  21, 26, 27.
- **LSSI-CE** (Ley 34/2002), BOE-A-2002-13758, consolidated to 23/01/2025: arts. 10, 13, 16.
- **LOPDGDD** (LO 3/2018), BOE-A-2018-16673, consolidated to 27/12/2025: arts. 7, 9, 93, 94.
- **RDL 19/2018** (payment services), BOE-A-2018-16036: arts. 1, 4.
- **Ley 11/2022** (telecommunications), BOE-A-2022-10757: annex II, definition 71.
- **Regulation (EU) 2022/2065** (DSA), Spanish text, DOUE-L-2022-81573: arts. 3, 6–8, 11, 12,
  14–19, 24, 29, 30.
- **Regulation (EU) 2019/1150** (P2B), DOUE L 186, 11/07/2019, pp. 57–79: arts. 1–5, 11.5,
  12.7.
- **Commission Recommendation 2003/361/EC**, DOUE L 124, 20/05/2003, pp. 36–41: annex arts. 1–2.
- **Constitutional Court**: STC 111/1993 (Pleno, 25/03/1993), on the reach of "título" in
  intrusismo. Read through secondary summaries, not the judgment's full text.
- **GDPR** arts. 4.7, 5, 6, 7, 9, 13, 15, 17, 20, 21, 26, 28, 30, 35; EDPB Guidelines 07/2020;
  CJEU C-184/20 and C-21/23. As cited and dated in [`README.md`](./README.md), not re-fetched.
- **Not available.** The dietitians' Code of Ethics (CGCODN). Its page was password-protected
  on 2026-11-18. The articles cited in [`textos/01`](./textos/01-acuerdo-profesional.md) (21,
  22, 29) are from the earlier reading and were not re-checked. Whether it restricts members
  advertising on a platform that also lists unregistered advisers is **unverified**. A
  registered dietitian can say.
- **TRLPI** (RDLeg. 1/1996), BOE-A-1996-8930, consolidated to 30/03/2022: arts. 133, 134.
- The registers, read 2026-11-18:
  - CGCODN, «Consulta pública de Dietistas-Nutricionistas Colegiados» and its *aviso legal* §§ 4.1–4.3 (undated, © 2022);
  - Ministerio de Sanidad, the REPS information page («Profesionales: REPS»), the public search at `reps.sanidad.gob.es`, and the ministry's *aviso legal* (reuse conditions, undated).
- **Not found.** An AEPD resolution on ratings of named professionals. The text of STS
  14/06/2011 on a dietitian's scope. The DAC7 "advertising only" exclusion. All three are marked
  where used.
