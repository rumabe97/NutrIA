# Legal review — Project 004: A dietitian runs their practice on it

> **Purpose**: every string a client or a professional reads about the link between
> them, assembled for the lawyer's hour PRD Decision 2 asks for before the `professional`
> flag goes on in production — the controller/processor question, and whether the
> consent text below says enough. This file does not decide anything; it collects what
> already exists so the reading has one place to start.
> **Audience**: the owner, and whoever they ask to read it — a lawyer, primarily; agents
> secondarily, as a map of where each string lives. **Committed**: yes — this is a
> **public** repository, so nothing below names a person, an email address or a private
> note; every string is product copy already shown on screen or sent by mail to whoever
> accepts an invitation. **Maintained by**: agents draft, the owner and the lawyer
> approve. Update it in the same change as any wording it quotes.

## How to read this

Every string is quoted **exactly as the dictionaries hold it** — Spanish first (the
source of truth, `apps/web/src/i18n/dictionaries/es-ES.ts`), English beside it
(`en-GB.ts`, typed to the same shape so a missing key is a build error, not a blank
screen, per `docs/ARCHITECTURE.md` § Invariants). `{placeholder}` markers are filled at
render time — `{professional}` and `{name}` with the other side's display name,
`{date}`/`{since}` with a formatted date, `{count}`/`{kind}`/`{range}` with numbers and
other dictionary strings — never with anything the reader did not already have. None are
reproduced with real values here.

Every key is cited as `namespace.key` (or `namespace.group.key`), resolvable in either
dictionary file, or as the email template's file and field. Component files are named
where the *order* or *conditions* the strings appear under matter — a lawyer reading
copy in isolation can otherwise miss that a line only ever appears after another one, or
that a whole block is conditional.

Nothing here is drawn from `docs/local/` (gitignored, never committed) or from any real
account.

## A. What a client reads before, and while, sharing

### A1. The invitation

**The mail** (`apps/api/src/modules/email/templates/CareInvitation.ts`) is the first
thing a prospective client sees, and it is written to read the same whether or not the
address already has an account (`0059`) — it names no health word on purpose, since an
inbox is scanned and a lock screen is public.

| Field | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `{name} te ha invitado a NutrIA` | `{name} has invited you to NutrIA` |
| `intro` | `{name} te ha invitado a llevar tu plan de comidas juntos en NutrIA, como tu dietista.` | `{name} has invited you to follow your meal plan together on NutrIA, as your dietitian.` |
| `meaning` | `Si aceptas, verá tu plan y cómo lo llevas, y podrá ajustarlo contigo.` | `If you accept, they will see your plan and how it is going, and can adjust it with you.` |
| `button` | `Ver la invitación` | `See the invitation` |
| `choose` | `Antes de compartir nada verás exactamente qué podrá ver, y podrás decir que sí o que no. Cualquiera de los dos puede terminarlo cuando quiera. Si todavía no tienes cuenta en NutrIA, créala con esta dirección.` | `Before anything is shared you will see exactly what they will be able to see, and you can say yes or no. Either of you can end it at any time. If you do not have a NutrIA account yet, create one with this address.` |
| `expires` | `La invitación funciona durante 14 días.` | `The invitation works for 14 days.` |
| `ignore` | `Si no sabes quién es, ignora este mensaje: no se comparte nada si no aceptas.` | `If you do not know who this is, ignore this message: nothing is shared unless you accept.` |
| `linkFallback` | `Si el botón no funciona, copia esta dirección en tu navegador:` | `If the button does not work, copy this address into your browser:` |

**The page** (`/invitacion/[token]`, component `apps/web/src/components/CareInvitation`,
dictionary namespace `care`) is where accepting actually happens — nothing above commits
to anything. Read top to bottom, as the component renders it:

| Order | Key | es-ES | en-GB |
| --- | --- | --- | --- |
| 1 | `care.invitationTitle` | `Invitación de {professional}` | `Invitation from {professional}` |
| 2 | `care.invitationIntro` | `{professional} te invita a compartir tu seguimiento con NutrIA para acompañarte.` | `{professional} invites you to share your tracking with NutrIA, to support you.` |
| 3 | `care.invitationShareIntro`, then the consent list (§ A2) | `Si aceptas, {professional} podrá ver:` | `If you accept, {professional} will be able to see:` |
| 4 | `care.healthQuestion` (a checkbox, unticked by default) | `Compartir también tu historial de salud` | `Also share your health record` |
| 5 | `care.healthShareNote` | `Solo si lo marcas. Puedes dejarlo sin marcar y decidirlo más adelante desde tu perfil.` | `Only if you tick it. You can leave it unticked and decide later from your profile.` |
| 6 | `care.healthShareIntro`, then the health list (§ A3) — **only shown once the box is ticked** | `Aparte de lo anterior, puedes compartir también:` | `Besides the above, you can also share:` |
| 7 | `care.invitationAccept` (primary action) | `Aceptar la invitación` | `Accept the invitation` |
| 8 | `care.declineCta` (secondary action) | `No, gracias` | `No, thanks` |

Nothing is written to the database — no link, no consent row — until action 7 is
pressed; action 8 or leaving the page unanswered shares nothing (PRD criterion 3).

If the signed-in account already has an active link, the page instead shows, and offers
no way to accept a second one:

| Key | es-ES | en-GB |
| --- | --- | --- |
| `care.invitationLinkExistsTitle` | `Ya tienes un enlace activo` | `You already have an active link` |
| `care.invitationLinkExistsBody` | `Ya tienes un dietista vinculado: {professional}, desde el {since}.` | `You already have a dietitian linked: {professional}, since {since}.` |
| `care.invitationLinkExistsCta` | `Ver mi perfil` | `See my profile` |

### A2. The consent list — what is shared

What every accepted link shares, unconditionally, in the exact order the client reads it
(`packages/core/src/entities/Care/Care.ts`, `CARE_SHARED`; dictionary `care.shares`):

| Order | Key | es-ES | en-GB |
| --- | --- | --- | --- |
| 1 | `care.shares.profile` | `tu perfil` | `your profile` |
| 2 | `care.shares.targets` | `tus objetivos` | `your targets` |
| 3 | `care.shares.mealPlans` | `tus planes de comida` | `your meal plans` |
| 4 | `care.shares.progress` | `tu progreso` | `your progress` |
| 5 | `care.shares.checkIns` | `tus check-ins` | `your check-ins` |

This same list, joined into one line, is how the client's own profile screen later
recalls what a link shares (`care.whatIsShared`: `Comparte: {list}` / `Shares: {list}`),
next to the linked professional's name.

### A3. The health line — a separate consent

Conditions, medications and supplements are **never** part of § A2's list; they are
their own question, off by default, and the client's answer to it is stored on the link
alongside the accepted consent version (`sharesHealth`, `0059` criterion 12). The three
things it covers, in order (`CARE_HEALTH_SHARED`; dictionary `care.healthShares`):

| Order | Key | es-ES | en-GB |
| --- | --- | --- | --- |
| 1 | `care.healthShares.conditions` | `tus condiciones de salud` | `your health conditions` |
| 2 | `care.healthShares.medications` | `tus medicamentos` | `your medications` |
| 3 | `care.healthShares.supplements` | `tus suplementos` | `your supplements` |

The question and its note are quoted in § A1 (rows 4–6). `apps/api/src/modules/ai` is
asserted by test to import nothing that could reach this line or its data, whatever it
answers (`docs/ARCHITECTURE.md` § Invariants, "The boundary is mechanical").

### A4. The access trail's wording

The client's own record of who read or changed what (`GET /care/access-log`, component
`CareAccessLog`, dictionary `care`), reachable from `/perfil` whether or not a link is
currently active — what was once read about somebody stays theirs to see. Each row
names a kind of data, from `care.accessKinds`:

| Key | es-ES | en-GB |
| --- | --- | --- |
| `care.accessKinds.health` | `tu historial de salud` | `your health record` |
| `care.accessKinds.list` | `tu perfil` | `your profile` |
| `care.accessKinds.overview` | `tu perfil` | `your profile` |
| `care.accessKinds.plan` | `tu plan` | `your plan` |
| `care.accessKinds.progress` | `tu progreso` | `your progress` |
| `care.accessKinds.review` | `la revisión de tu plan` | `your plan review` |
| `care.accessKinds.targets` | `tus objetivos` | `your targets` |

Composed into one line per entry, or per group of repeated entries (grouping is
display-only — `apps/web/src/lib/careAccessGroups.ts` — every underlying row still
exists and is still returned by the API):

| Key | es-ES | en-GB |
| --- | --- | --- |
| `care.accessLogTitle` | `Quién ha accedido` | `Who has accessed` |
| `care.accessLogEmpty` | `Todavía no hay nada que mostrar aquí.` | `There is nothing to show here yet.` |
| `care.accessLogRead` | `{professional} vio {kind}` | `{professional} viewed {kind}` |
| `care.accessLogWrite` | `{professional} cambió {kind}` | `{professional} changed {kind}` |
| `care.accessLogReadGroup` | `{professional} vio {kind} {count} veces · {range}` | `{professional} viewed {kind} {count} times · {range}` |
| `care.accessLogWriteGroup` | `{professional} cambió {kind} {count} veces · {range}` | `{professional} changed {kind} {count} times · {range}` |
| `care.accessLogLoadMore` | `Ver más` | `Show more` |
| `care.accessLogLoaded` | `{count} accesos más cargados.` | `{count} more entries loaded.` |
| `care.accessLogNoMore` | `No hay más accesos que mostrar.` | `No more entries to show.` |

### A5. Ending a link

Shown on the client's own profile card for the link (component `CareLinkCard`,
dictionary `care`), and worded to be reachable in one action, whatever the
`professional` flag says — consent is revocable (`0059`):

| Key | es-ES | en-GB |
| --- | --- | --- |
| `care.linkTitle` | `Tu dietista` | `Your dietitian` |
| `care.linkSince` | `Desde el {date}` | `Since {date}` |
| `care.end` (the button that opens the confirm step) | `Terminar el enlace` | `End the link` |
| `care.endConfirmTitle` | `¿Terminar el enlace con {professional}?` | `End the link with {professional}?` |
| `care.endConfirmBody` | `Tu dietista dejará de ver tu perfil, tu plan y tu progreso. Puedes volver a aceptar una invitación suya más adelante.` | `Your dietitian will stop seeing your profile, your plan and your progress. You can accept another invitation from them later.` |
| `care.endConfirmCta` | `Sí, terminar` | `Yes, end it` |
| `common.cancel` (the way out of the confirm step) | `Cancelar` | `Cancel` |

### A6. Elsewhere the client is told about the link

Not part of the invitation-to-ending flow above, but read by a linked client in the
course of using the product — included because a lawyer reading "every string a client
reads while sharing" would otherwise not see them:

| Where | Key | es-ES | en-GB |
| --- | --- | --- | --- |
| `/perfil`, the section heading above the link card and the trail | `profile.sectionCare` | `Tu dietista` | `Your dietitian` |
| `/perfil`, the targets panel, when the professional set the current targets | `targets.badgeProfessional` | `Tu dietista` | `Your dietitian` |
| same panel, the subtitle naming who | `targets.subtitleProfessional` | `Los ha ajustado {name}, tu dietista` | `Set by {name}, your dietitian` |
| `/inicio`, while a plan the professional is reviewing has not been published yet (component `PlanPendingNotice`, dictionary `dashboard`) | `dashboard.pendingReviewTitle` | `Tu plan nuevo está con tu dietista` | `Your new plan is with your dietitian` |
| | `dashboard.pendingReviewBody` | `Tu dietista lo está revisando antes de publicarlo. Mientras tanto, sigue con el plan que ya tenías.` | `Your dietitian is reviewing it before publishing. In the meantime, carry on with the plan you already had.` |
| `/plan`, the same notice (dictionary `plan`) | `plan.pendingReviewTitle` | `Tu plan nuevo está con tu dietista` | `Your new plan is with your dietitian` |
| | `plan.pendingReviewBody` | `Tu dietista lo está revisando antes de publicarlo. Aquí sigue tu plan anterior, tal como estaba.` | `Your dietitian is reviewing it before publishing. Here is your previous plan, just as it was.` |

The general health-data supervision notice (`profile.supervision`, shown to anyone with
a recorded condition, medication or supplement, linked or not) does not currently change
its wording for a linked client — the PRD proposed that it should (Decisions 11); that
is unbuilt and worth the lawyer's eye alongside everything above, not something this
file should claim is already true.

## B. The professional's side

**There is currently no dedicated "I agree" screen for a professional** — no
in-product text a professional ticks or signs when the owner grants them the role. This
is exactly the gap PRD Decision 2 names as unresolved: "who is the controller of a
patient's health data and who the processor, what agreement the professional signs" —
answered by a lawyer's hour before launch, changing copy and a consent version, not the
architecture. What follows is everything that currently exists on this side, so the
lawyer knows what to write into, and where it would need to be added if a signed
agreement is required.

### B1. The grant

A professional never self-declares; the owner grants the role from `/admin` after
seeing a collegiate number (`0059`). This text is read by the **owner**, not the
professional — the professional receives no mail or screen when it happens — from
`apps/web/src/components/AccountList` and `ProfessionalList`, dictionary `admin`:

| Key | es-ES | en-GB |
| --- | --- | --- |
| `admin.professionalLabel` | `Consulta para dietistas` | `Practice for dietitians` |
| `admin.professionalCollegiate` | `Número de colegiado` | `Collegiate number` |
| `admin.professionalCollegiateHint` | `Letras, números, / o -, como aparece en su colegio. Compruébalo antes de conceder.` | `Letters, digits, / or -, as their college writes it. Check it before granting.` |
| `admin.professionalGrant` | `Conceder` | `Grant` |
| `admin.professionalChip` (marks a granted account in the owner's list) | `Profesional` | `Professional` |
| `admin.professionalGranted` | `Nº {number} · desde el {date}` | `No. {number} · since {date}` |
| `admin.professionalRevoke` | `Retirar` | `Revoke` |
| `admin.professionalRevokeTitle` | `¿Retirar a {email} como profesional?` | `Revoke {email} as a professional?` |
| `admin.professionalRevokeBody` | `Pierde el acceso a su consulta y sus invitaciones sin responder se anulan.` | `They lose access to their practice and their unanswered invitations are cancelled.` |
| `admin.professionalRevokeConfirm` | `Sí, retirar` | `Yes, revoke` |

The workspace-wide switch the owner throws once satisfied (also `/admin`, `admin`
namespace):

| Key | es-ES | en-GB |
| --- | --- | --- |
| `admin.professionalHint` | `Encendido: los profesionales que concedas pueden abrir su consulta y vincular pacientes.` | `On: the professionals you grant can open their practice and link clients.` |
| `admin.professionalOffHint` | `Apagado: nadie ve la consulta, tampoco quien ya tenga la concesión. Sus pacientes siguen como cuentas normales.` | `Off: nobody sees the practice, not even those already granted. Their clients carry on as ordinary accounts.` |

### B2. What a professional is told about a client's data

Not an agreement, but the closest the product currently comes to stating the
professional's obligations, read on the professional's own client page (`/consulta/[linkId]`,
dictionary `practice`):

| Key | es-ES | en-GB |
| --- | --- | --- |
| `practice.healthIntro` (above conditions, medications and supplements, shown only when the client ticked § A3) | `Tu paciente decidió compartir esto contigo. Nunca se envía a ningún modelo.` | `Your client chose to share this with you. It is never sent to any model.` |
| `practice.reviewLabel` (the review-before-publish switch, the professional's own to set per client) | `Revisar cada plan antes de que lo vea` | `Review each plan before they see it` |
| `practice.reviewOnHint` | `Cada plan nuevo te llega primero a ti, y tu paciente lo ve cuando lo publicas.` | `Each new plan comes to you first, and your client sees it when you publish it.` |
| `practice.reviewOffHint` | `Los planes nuevos llegan a tu paciente en cuanto están listos.` | `New plans reach your client as soon as they are ready.` |
| `practice.endConfirmBody` (ending the link from the professional's side) | `Dejarás de ver su perfil, sus planes y su progreso, y se libera una plaza de tu plan. Sus objetivos se quedan como están y pasan a ser suyos.` | `You will stop seeing their profile, plans and progress, and a place on your plan frees up. Their targets stay as they are and become their own.` |
| `practice.endHint` | `Tu paciente conserva su cuenta, su historial y su último plan publicado.` | `Your client keeps their account, their history and their last published plan.` |

### B3. What is not yet built

For the lawyer's hour specifically, not for the record of what shipped:

- No screen states, in words a professional reads and agrees to, that they are bound by
  professional secrecy for what a client shares, what happens to a client's data if the
  professional's own account is deleted (today: the link and the audit rows' identifying
  fields are cleared, `docs/ARCHITECTURE.md` § Invariants, "Account deletion actually
  deletes"), or which of the two is the controller and which the processor of a client's
  health data once a link exists.
- `CARE_CONSENT_VERSION` (`packages/core/src/entities/Care/Care.ts`, currently `1.0.0`)
  is the version stamped on every accepted link. If the lawyer's review changes any
  string in § A above, that constant is bumped in the same change — an older stored
  version is refused at the door, exactly as `HEALTH_CONSENT_VERSION` already works
  (`docs/ARCHITECTURE.md` § Invariants, "Health data is collected as health data").
