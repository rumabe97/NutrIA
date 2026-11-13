# Inventory: the signed-in app (`apps/web/src/app/(app)/`)

Scope: every `page.tsx` under `(app)`, with the components each renders. The shared shell (AppNav, header, offline banner `OfflineCopy`, tour, toasts, footer) belongs to another inventory and is only named where it appears.

Conventions

- "Words" are keys in `apps/web/src/i18n/dictionaries/es-ES.ts` (the English dictionary has the same keys by construction). `dictionary.x.y` is written `x.y`. "not dictionary" means the text is data, a number, a name from the API or an icon.
- `common.*` and `errors.*` messages come from `messageFor(error, dictionary)` in `lib/api` whenever a request fails; where a row says "API error message" it is one of `errors.*` (e.g. `errors.network`, `errors.internal`, `errors.quotaExceeded`, `errors.invalidInput`, `errors.notFound`) chosen by the API error code.
- Every page in the group is `force-dynamic`, rendered per request with the session; the layout (`(app)/layout.tsx`) redirects through `redirectUnlessReady()` (not signed in, email not confirmed, password change required, etc. are handled in `lib/access`) before any page renders.
- "OB-guard" = `redirectIfOnboardingIncomplete()` (`lib/onboarding`): somebody who has not finished onboarding is sent to the onboarding flow.

## (app) group-wide states  (`apps/web/src/app/(app)/layout.tsx`, `error.tsx`, `loading.tsx`)

Wraps every route below. The shell parts are listed only so they are not lost; they are inventoried elsewhere.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Navigation bar (AppNav; assistant entry only when the assistant switch is on, professional entry only for a professional) | menu | `apps/web/src/components/AppNav/AppNav.tsx` | shell inventory | always |
| 2 | `<main>` landmark with the offline banner (`OfflineCopy`) above the page | notice | `apps/web/src/components/OfflineCopy/OfflineCopy.tsx` | shell inventory | when offline / stored copy |
| 3 | `ArrivalSync` (invisible: finishes the after-sign-in step for somebody back from Google/Apple) | status | `apps/web/src/components/ArrivalSync/ArrivalSync.tsx` | not dictionary | always, no visible output |
| 4 | Loading skeleton: title bar, subtitle bar, a card with a heading bar, four stat blocks and four three-line rows | status | `apps/web/src/app/(app)/loading.tsx` | not dictionary (no text) | while any route in the group resolves |
| 5 | Error boundary title | heading | `apps/web/src/app/(app)/error.tsx` | `errors.boundaryTitle` | a server render of any route throws |
| 6 | Error boundary body | text | same | `errors.boundaryBody` | same |
| 7 | Retry button (re-runs the segment) | button | same | `common.retry` | same |
| 8 | "Ir al inicio" link to `/inicio` | link | same (CtaLink, secondary) | `errors.boundaryHome` | same |

## /asistente  (`apps/web/src/app/(app)/asistente/page.tsx`, frame in `asistente/layout.tsx`)

Browser-tab title: `pages['/asistente'].title` in the dictionary (set by `appMetadata`).
Reached from the nav when the assistant switch is on. The layout calls `GET /assistant/standing`; when it is 404 (switch off) the layout calls `notFound()` and so does every `/asistente/*` page (404 page). A new, empty conversation. Page title metadata from `appMetadata('/asistente')`.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Hidden page heading "Asistente" (visually hidden h1) | heading | `app/(app)/asistente/page.tsx` | `assistant.title` | always |
| 2 | Professional-supervision note (role="note") | notice | `app/(app)/asistente/page.tsx` | `profile.supervision` | `health.supervisionRecommended` is true |
| 3 | History side column (`aside`, labelled by its heading), wide screens | list | `components/AssistantHistory/AssistantHistory.tsx` | see rows 4-9 | always (CSS shows it wide; the bar below shows narrow) |
| 4 | "Nueva conversación" link to `/asistente` (secondary, sm) | link | `AssistantHistory.tsx` | `assistant.newConversation` | always, side column |
| 5 | "Tus conversaciones" heading (h2) | heading | `AssistantHistory.tsx` | `assistant.conversationsTitle` | side column |
| 6 | Conversation list: one link per conversation to `/asistente/{id}`, title (falls back to `assistant.newConversation` when empty) and short date (day + short month); open one carries `aria-current="page"` | list | `components/AssistantHistory/ConversationLinks.tsx` | `assistant.newConversation` (fallback title); date not dictionary | at least one conversation |
| 7 | Empty history message | text | `ConversationLinks.tsx` | `assistant.conversationsEmptyBody` | no conversations |
| 8 | "Descargar mis conversaciones" button (tertiary, loading state while building) | button | `components/AssistantHistory/ConversationExport.tsx` | `assistant.export.label` | at least one conversation |
| 9 | Download status line (role="status"): "Descargando {file}." with file `nutria-conversaciones-{date}.json`, or the API error message | status | `ConversationExport.tsx` | `assistant.export.downloading`, `assistant.export.fileName`, API error | after pressing download / on failure |
| 10 | Narrow-screen bar: "Tus conversaciones" tertiary button that opens a bottom Drawer | button | `AssistantHistory.tsx` | `assistant.conversationsTitle` | narrow screens |
| 11 | Drawer (title "Tus conversaciones"; contains the same list or empty text, and the export button + status when there are conversations; picking a conversation closes it; Escape / overlay / drag dismiss) | dialog | `AssistantHistory.tsx` + `packages/ui/src/components/Drawer/Drawer.tsx` | `assistant.conversationsTitle` + rows 6-9 | after pressing row 10 |
| 12 | Narrow-screen "+ Nueva" link to `/asistente` with a plus icon | link | `AssistantHistory.tsx` | `assistant.newShort` | narrow screens |
| 13 | The warning, shown as the first item of the thread in every conversation: label "Aviso" and the long AI-and-privacy text with an inline link "política de privacidad" to `/privacidad#asistente` (locale-prefixed) | notice | `components/AssistantChat/AssistantChat.tsx` | `assistant.warningLabel`, `assistant.warning`, `assistant.warningPrivacy` | always (cannot be omitted) |
| 14 | Conversation thread (`ol`, labelled) | list | `AssistantChat.tsx` | `assistant.threadLabel` | always |
| 15 | Each turn carries a hidden speaker label "Tú" (person) or "Respuesta del asistente" | text | `AssistantChat.tsx` | `assistant.you`, `assistant.answerLabel` | per turn |
| 16 | Person's message bubble | text | `AssistantChat.tsx` | not dictionary (user text) | per person turn with content |
| 17 | Withdrawn-question bubble "Pregunta no guardada: era sobre salud." | status | `AssistantChat.tsx` | `assistant.withdrawn` | a person turn judged clinical (content empty) |
| 18 | Assistant answer rendered from Markdown (paragraphs, bold-line headings, bullet/numbered lists, strong, em, code), marked `data-ai-generated="true"` | text | `components/AssistantMarkdown/AssistantMarkdown.tsx` | not dictionary (model text) | per assistant turn with content, and while streaming |
| 19 | Decline text under an answer, one of five reasons | text | `AssistantChat.tsx` | `assistant.declines.acting`, `.allergen`, `.clinical`, `.invented_figure`, `.off_topic` | assistant turn with a decline code |
| 20 | Per-message delete icon button (trash), labelled "Borrar tu pregunta" (person turn) or "Borrar esta respuesta" (assistant turn) | button | `AssistantChat.tsx` | `assistant.deleteQuestionLabel`, `assistant.deleteAnswerLabel` | turn already stored (has an id) and no confirmation open |
| 21 | Delete-message confirmation group (label "Borrar este mensaje"): text, destructive "Borrar" button, tertiary "Cancelar" | dialog | `AssistantChat.tsx` | `assistant.deleteMessageLabel`, `assistant.deleteMessageBody`, `assistant.deleteMessage`, `assistant.cancel` | after pressing row 20 |
| 22 | "Writing" state: animated three dots with hidden "Escribiendo…" | status | `AssistantChat.tsx` | `assistant.sending` | question sent, no text received yet |
| 23 | Streaming answer text | text | `AssistantChat.tsx` | not dictionary | while the answer arrives |
| 24 | Problem message shown as an assistant message: quota used up (date or rolling variant), unavailable (budget / provider / no model), network lost, conversation gone, cut off mid-answer, or the generic API message | notice | `AssistantChat.tsx` | `assistant.overAllowance`, `assistant.overAllowanceRolling`, `assistant.unavailableBudget`, `assistant.unavailableProvider`, `assistant.unavailableNoModel`, `assistant.unavailableNetwork`, `assistant.gone`, `assistant.cutOff`, `errors.*` | after a failed or cut-off send |
| 25 | Polite status region (hidden): "Escribiendo…", "Respuesta terminada.", the decline text, "Mensaje borrado.", or the problem | status | `AssistantChat.tsx` | `assistant.sending`, `assistant.done`, `assistant.declines.*`, `assistant.deleted` | during and after sends / deletes |
| 26 | Composer form: hidden label "Tu pregunta" + auto-growing textarea (placeholder "Escribe tu pregunta", max 1000 characters, Enter sends, Shift+Enter newline, read-only when the allowance is spent) | field | `AssistantChat.tsx` | `assistant.field`, `assistant.placeholder`, `assistant.enterHint` | always |
| 27 | Send button (arrow-up icon, aria-label "Enviar" or "Escribiendo…" while busy; aria-disabled when busy, spent or empty) | button | `AssistantChat.tsx` | `assistant.send`, `assistant.sending` | always |
| 28 | Allowance line: "Te quedan {remaining} de {limit} mensajes esta quincena." / "...en los últimos 14 días." / when spent "Has usado tus {limit} mensajes... Vuelven el {date}." or rolling variant; followed by the Enter hint | text | `AssistantChat.tsx` | `assistant.left`, `assistant.leftRolling`, `assistant.overAllowance`, `assistant.overAllowanceRolling`, `assistant.enterHint` | always |
| 29 | Behaviour: after the first answer of a new conversation the address is replaced by `/asistente/{id}`, history refreshes, focus returns to the box | status | `AssistantChat.tsx` | not dictionary | first answer ended |
| 30 | Unused in this route but defined for the screen: `assistant.intro`, `assistant.fieldHint`, `assistant.back`, `assistant.updated`, `assistant.conversationsEmptyTitle` | text | not rendered by any file read | `assistant.intro`, `assistant.fieldHint`, `assistant.back`, `assistant.updated`, `assistant.conversationsEmptyTitle` | not shown (see Not sure) |

## /asistente/[id]  (`apps/web/src/app/(app)/asistente/[id]/page.tsx`)

Browser-tab title: `pages['/asistente'].title` in the dictionary (set by `appMetadata`).
Reached from a history link. 404 when the switch is off (layout), the conversation does not exist or is somebody else's (API 404). Same frame (history column / narrow bar), warning and composer as `/asistente`; only the differences are listed, plus the rows above apply unchanged (rows 3-14 and 26-29).

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Conversation title as h1 (falls back to "Asistente" when the title is empty) | heading | `app/(app)/asistente/[id]/page.tsx` | `assistant.title` (fallback), title is data | always |
| 2 | "Borrar conversación" tertiary button | button | `components/ConversationDelete/ConversationDelete.tsx` | `assistant.deleteConversation` | always (before confirming) |
| 3 | Delete-conversation confirmation (group labelled "Borrar conversación"): consequence text, destructive "Borrar para siempre" button (loading), tertiary "Cancelar" (disabled while deleting); focus moves to the confirm button, back to the opener on cancel | dialog | `ConversationDelete.tsx` | `assistant.deleteConversation`, `assistant.deleteConversationBody`, `assistant.deleteConversationConfirm`, `assistant.cancel` | after pressing row 2 |
| 4 | Delete failure message (role="alert") | notice | `ConversationDelete.tsx` | API error message | the DELETE fails |
| 5 | After a successful delete: navigation to `/asistente` and refresh | status | `ConversationDelete.tsx` | not dictionary | delete succeeded |
| 6 | Professional-supervision note | notice | `asistente/[id]/page.tsx` | `profile.supervision` | `health.supervisionRecommended` |
| 7 | Stored turns: person bubbles, assistant Markdown answers, decline texts, withdrawn-question bubble, per-message delete controls (same as `/asistente` rows 15-21), answers arrive already re-screened against current allergies | list | `AssistantChat.tsx` | see `/asistente` | the conversation has turns |

## /check-in  (`apps/web/src/app/(app)/check-in/page.tsx`)

Browser-tab title: `pages['/check-in'].title` in the dictionary (set by `appMetadata`).
OB-guard. No active plan (`status.plan` null) redirects to `/inicio`. Three states: already done, not yet due, due (the form).

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Empty state card "Ya has cerrado esta quincena" with body | notice | `components/EmptyState/EmptyState.tsx` via page | `checkIn.alreadyTitle`, `checkIn.alreadyBody` | `status.done` |
| 2 | Empty state card "Todavía no toca" with body | notice | same | `checkIn.notYetTitle`, `checkIn.notYetBody` | not done and not yet due |
| 3 | "Volver al inicio" large link to `/inicio` (inside rows 1 and 2) | link | `components/CtaLink/CtaLink.tsx` | `checkIn.backHome` | rows 1 or 2 |
| 4 | Page heading "Check-in de la quincena" | heading | `app/(app)/check-in/page.tsx` | `checkIn.title` | due |
| 5 | Intro paragraph | text | same | `checkIn.intro` | due |
| 6 | Adherence line: "Has marcado como hechas {completed} de {marked} comidas ({percent} %)." or "No has marcado comidas ... no pasa nada." | text | same | `checkIn.adherence`, `checkIn.adherenceNone` | due; none variant when adherence is null |
| 7 | Form error banner (role="alert") | notice | `components/CheckInForm/CheckInForm.tsx` | API error message | submit failed |
| 8 | Weight number field "Peso de hoy (kg)" (step 0.1, pre-filled with latest weight, optional, hint, per-field API error under it; comma accepted) | field | `CheckInForm.tsx` | `checkIn.weight`, `checkIn.weightHint` | due |
| 9 | Radio cards, legend "¿Cómo has ido de cantidades?": "Me quedaba con hambre" / "Bien" (default) / "Era demasiado" | field | `CheckInForm.tsx` + `components/OptionCards/OptionCards.tsx` | `checkIn.hunger`, `checkIn.hungerHungry`, `checkIn.hungerRight`, `checkIn.hungerTooMuch` | due |
| 10 | Radio cards, legend "¿Cómo ha sido seguir el plan?": "Fácil" / "Llevadero" (default) / "Difícil" | field | same | `checkIn.difficulty`, `checkIn.difficultyEasy`, `checkIn.difficultyOk`, `checkIn.difficultyHard` | due |
| 11 | Radio cards, legend "¿Qué nota le pones a la quincena?": 1 to 5 (default 4) | field | same | `checkIn.satisfaction` (values are numerals, not dictionary) | due |
| 12 | Comments textarea "¿Qué cambiarías?" (4 rows, max 500) with hint | field | `CheckInForm.tsx` | `checkIn.comments`, `checkIn.commentsHint` | due |
| 13 | Submit button "Cerrar la quincena" (large; loading + disabled, label "Guardando…" while pending) | button | `CheckInForm.tsx` | `checkIn.submit`, `checkIn.submitting` | due, form not yet sent |
| 14 | Confirmation section after sending, focusable heading "Quincena cerrada" (focus moves to it) and body "Gracias. Esto es lo que cambia:" | heading | `CheckInForm.tsx` | `checkIn.doneTitle`, `checkIn.doneBody` | after a successful submit |
| 15 | Effects list: "Peso registrado: ..." line | list | `CheckInForm.tsx` | `checkIn.doneWeight` | weight was logged |
| 16 | Effects list: "Objetivo de calorías: de {from} a {to} kcal al día." or "Objetivos sin cambios." | list | `CheckInForm.tsx` | `checkIn.doneTargets`, `checkIn.doneNoTargets` | always after submit (targets present or not) |
| 17 | "Crear mi próximo plan" large primary link to `/plan/generando` | link | `CheckInForm.tsx` | `checkIn.nextPlan` | plan end date is before today |
| 18 | "Volver al inicio" large link to `/inicio` (primary if the plan has not ended, secondary otherwise) | link | `CheckInForm.tsx` | `checkIn.backHome` | after submit |

## /compra  (`apps/web/src/app/(app)/compra/page.tsx`)

Browser-tab title: `pages['/compra'].title` in the dictionary (set by `appMetadata`).
OB-guard. No active shopping list shows an empty state. Works offline from a stored copy (shell). Also loads the scheduled (not-yet-started) plan to decide on the switch.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Empty-state card "Todavía no hay lista" + body | notice | `components/EmptyState/EmptyState.tsx` | `shopping.emptyTitle`, `shopping.emptyBody` | no active list |
| 2 | "Ver mi plan" large link to `/plan` | link | `app/(app)/compra/page.tsx` | `shopping.emptyCta` | no active list |
| 3 | Page heading "Lista de la compra" | heading | `components/ShoppingList/ShoppingList.tsx` | `shopping.title` | list exists |
| 4 | Plan switch: visible legend "Qué lista ver" and a nav with two links "Actual" (current, `/compra`) and "Próximo" (`/compra/proxima`), `aria-current` on the active | link | `components/PlanSwitch/PlanSwitch.tsx` | `shopping.switchLabel`, `shopping.switchCurrent`, `shopping.switchNext` | a scheduled plan exists |
| 5 | Hidden polite live region announcing the range ("Lista para {range}: {count} cosas que comprar.", or why it is empty, or a row notice) | status | `ShoppingList.tsx` | `shopping.rangeAnnounced`, `shopping.rangeEmpty`, `shopping.rangeNoDays`, row notices | list exists (announces after the reader picks a range) |
| 6 | Range chooser: fieldset legend "Para qué días es la lista"; radios "Todos", "Semana 1", "Semana 2" (only for plans with two weeks), "Elegir días" | field | `components/ShoppingRange/ShoppingRange.tsx` | `shopping.rangeLegend`, `shopping.rangeWhole`, `shopping.rangeWeek1`, `shopping.rangeWeek2`, `shopping.rangeDays` | the plan has more than one day; choice stored on the device |
| 7 | Day checkboxes (fieldset legend "Elige los días", one per plan day with weekday + date + short month) | field | `ShoppingRange.tsx` | `shopping.rangeDaysLegend` (labels are dates, not dictionary) | "Elegir días" selected |
| 8 | Subtitle: "Todo lo que necesitas para {range}, ya sumado." where range is "los {count} días" / "la primera semana" / "la segunda semana" / "los días que has elegido" | text | `ShoppingList.tsx` | `shopping.subtitle`, `shopping.rangeNameWhole`, `shopping.rangeNameWeek1`, `shopping.rangeNameWeek2`, `shopping.rangeNameDays` | list exists |
| 9 | Row-level notice (small text): "Ya hay {bought} comprados, más de lo que necesitan estos días..." or "{name}: guardado. Quedan {left}." / "{name}: completo, no queda nada." | notice | `ShoppingList.tsx` / `ShoppingItem.tsx` | `shopping.boughtBeyondRange`, `shopping.amountSaved`, `shopping.amountSavedAll` | after marking or saving an amount |
| 10 | Progress line "{done} de {total} ya en el carro" | status | `components/ShoppingProgress/ShoppingProgress.tsx` | `shopping.progress` | list exists |
| 11 | "Compartir lo que falta" secondary button (Web Share, else copy to clipboard) | button | `components/ShoppingActions/ShoppingActions.tsx` | `shopping.share`, `shopping.shareTitle` | always |
| 12 | "Supermercados cerca" link to a maps search, new tab, hidden suffix "(se abre en la app de mapas)" | link | `ShoppingActions.tsx` | `shopping.nearby`, `shopping.nearbyOpens`, `shopping.nearbyQuery` | online and a user agent is known (hidden offline) |
| 13 | Share status (role="status"): "Lista copiada: pégala donde quieras.", "Ya lo tienes todo en el carro: no queda nada que compartir.", or the generic internal error | status | `ShoppingActions.tsx` | `shopping.shareCopied`, `shopping.shareNothing`, `errors.internal` | after pressing share |
| 14 | Empty-range panel: text "No queda nada por comprar en estos días." / "No has elegido ningún día." and a "Ver todos los días" secondary button | notice | `ShoppingList.tsx` | `shopping.rangeEmpty`, `shopping.rangeNoDays`, `shopping.rangeShowWhole` | no rows and range is not "Todos" |
| 15 | Aisle group sections with heading: Frutas y verduras, Carne y pescado, Lácteos, Panadería, Congelados, Despensa, Bebidas, Otros (in this order, empty ones omitted) | heading | `ShoppingList.tsx` | `categories.produce`, `.protein`, `.dairy`, `.bakery`, `.frozen`, `.pantry`, `.beverages`, `.other` | group has rows in the chosen range |
| 16 | Item row: native checkbox (checked = all needed bought; indeterminate = partly bought), item name, quantity (with unit g/kg/ml/l/ud./reb.) or "{left} por comprar" when partly bought. Marking works offline (queued) | field | `components/ShoppingItem/ShoppingItem.tsx` | `shopping.leftToBuy`; units `units.gram`, `units.kilogram`, `units.litre`, `units.millilitre`, `units.unit`, `units.slice`; name is data | each row |
| 17 | Per-row edit (pencil) icon button, aria-label "Cambiar lo comprado: {name}", toggles the amount form | button | `ShoppingItem.tsx` | `shopping.amountEdit` | each row |
| 18 | Amount form: label "Cuánto has comprado, en {unit}" (unit name g / ud. / reb. / ml), number input (min 0, max total, Esc closes), "Guardar" button, hint "De {total} en total." | field | `ShoppingItem.tsx` | `shopping.amountLabel`, `shopping.amountSave`, `shopping.amountHint`, `units.gram`, `units.unit`, `units.slice`, `units.millilitre` | amount form open |

## /compra/proxima  (`apps/web/src/app/(app)/compra/proxima/page.tsx`)

Browser-tab title: `pages['/compra/proxima'].title` in the dictionary (set by `appMetadata`).
OB-guard. If the scheduled list or plan is missing (plan already began) it redirects to `/compra`. Same screen as `/compra` for the plan that has not started.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Everything in `/compra` rows 3, 5-18 (heading, range chooser, progress, share, nearby, empty-range, aisle groups, rows, amount form) | list | `components/ShoppingList/ShoppingList.tsx` | see `/compra` | list exists |
| 2 | Plan switch with "Próximo" marked current | link | `components/PlanSwitch/PlanSwitch.tsx` | `shopping.switchLabel`, `shopping.switchCurrent`, `shopping.switchNext` | always on this route |
| 3 | Subtitle "Todo lo que necesitas para {range} del plan que empieza el {date}, ya sumado." (date = day + long month) | text | `ShoppingList.tsx` | `shopping.nextSubtitle` | always on this route |

## /consentimiento  (`apps/web/src/app/(app)/consentimiento/page.tsx`)

Browser-tab title: `pages['/consentimiento'].title` in the dictionary (set by `appMetadata`).
OB-guard first (an unfinished onboarding is sent to the flow). If the API says `profileConsentRequired` is false the page redirects to `/inicio`; when the API cannot be asked the form is shown. One-time screen for accounts that finished onboarding before the health-data consent existed.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Heading "Antes de seguir: tus datos de salud" | heading | `components/ProfileConsentInterstitial/ProfileConsentInterstitial.tsx` | `profileConsent.title` | always |
| 2 | Error banner (role="alert"): the unchecked-box message (same text as the note) or an API error | notice | same | `profileConsent.note`, API error message | submit without the box, or request failed |
| 3 | Body paragraph: which health data is needed | text | `components/ProfileConsentFields/ProfileConsentFields.tsx` | `profileConsent.body` | always |
| 4 | AI paragraph: what the model receives | text | same | `profileConsent.ai` | always |
| 5 | Required checkbox "Consiento que NutrIA use estos datos de salud para hacer mis planes" (`profileConsentGiven`, unchecked by default here) | field | same | `profileConsent.label` | always |
| 6 | Note: "Sin este consentimiento no podemos hacerte un plan..." with an inline link to `/privacidad` (locale-prefixed) | text | same | `profileConsent.note`, `auth.legalPrivacy` (link text) | always |
| 7 | "Continuar" submit button (loading; label "Guardando…" while pending). On success goes to `/inicio` | button | `ProfileConsentInterstitial.tsx` | `profileConsent.continue`, `common.saving` | always |

## /consulta  (`apps/web/src/app/(app)/consulta/page.tsx`)

Browser-tab title: `pages['/consulta'].title` in the dictionary (set by `appMetadata`).
The professional's workspace. 404 for anybody who is not a professional (`GET /care/practice` is 404). Four mutually exclusive top-level states, in this order: second factor required, agreement required, workspace (practice open or closed). Search param `?practica=gracias` is where Stripe checkout returns.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | State A: card with heading "Activa la verificación en dos pasos", two paragraphs for the practice, and a large link "Ir a Seguridad" to `/perfil#seguridad` | notice | `components/SecondFactorRequired/SecondFactorRequired.tsx` | `secondFactorRequired.title`, `secondFactorRequired.practice[0..1]`, `secondFactorRequired.action` | professional with a password and no second factor (`secondFactorRequired`); nothing else on the page shows |
| 2 | State B heading "h1" of the agreement | heading | `components/PracticeAgreement/PracticeAgreement.tsx` | `practiceAgreement.title` | `agreementRequired` (state A not applicable) |
| 3 | Agreement intro paragraphs (second one carries the controller's name and email from `LEGAL_IDENTITY`, not the dictionary) | text | same | `practiceAgreement.intro[0..1]`, `i18n/legalIdentity.ts` | state B |
| 4 | Agreement sections, each an h2 with paragraphs, bullet list, optional closing paragraph | list | `components/PracticeAgreementSection/PracticeAgreementSection.tsx` | `practiceAgreement.sections[].heading/.paragraphs/.list/.outro` | state B |
| 5 | Collapsible block "practice plan terms" (h2 whose trigger button toggles it, chevron) containing nested sections (h3) | menu | `PracticeAgreement.tsx` | `practiceAgreement.terms.title`, `practiceAgreement.terms.sections[]` | state B (collapsed by default) |
| 6 | Acceptance checkbox | field | same | `practiceAgreement.checkbox` | state B |
| 7 | Version line shown beside the checkbox (the version being accepted) | text | same | `practiceAgreement.version` | state B |
| 8 | Error banner (role="alert") | notice | same | API error message | accept failed |
| 9 | "Aceptar y abrir mi consulta" large button, disabled until the checkbox is ticked, loading while posting; on success the page refreshes | button | same | `practiceAgreement.accept` | state B |
| 10 | Page heading "Consulta" | heading | `app/(app)/consulta/page.tsx` | `practice.title` | workspace |
| 11 | Intro line | text | same | `practice.intro` | workspace |
| 12 | Plan card heading "Tu plan" | heading | `components/PracticePlanCard/PracticePlanCard.tsx` | `practice.planTitle` | workspace |
| 13 | Seats line "{active} de {included} pacientes" | figure | same | `practice.planSeats` | practice open |
| 14 | Pending-invitations seats line "Y {count} invitaciones sin responder, que también ocupan plaza." | text | same | `practice.planSeatsPending` | practice open and pending invitations > 0 |
| 15 | Billing standing line: past due / "Periodo de prueba: te quedan {days} días." / "Se renueva el {date}." / "Tu plan termina el {date}." (open); "Pago recibido. Tu consulta se abrirá en unos segundos." (just paid); "Tu plan no está al día..." (lapsed subscription) or "Elige un plan para invitar a pacientes..." (none) | status | same | `practice.planPastDue`, `practice.planTrialLeft`, `practice.planRenews`, `practice.planEnds`, `practice.planJustPaid`, `practice.planLapsed`, `practice.planClosed` | billing available |
| 16 | "Los planes de consulta todavía no están disponibles." | notice | same | `practice.planUnavailable` | billing not available |
| 17 | Trial offer line "Los primeros {days} días son gratis..." | text | same | `practice.planTrial` | choosing a plan and trial days exist |
| 18 | Plan-choice buttons, one per available plan ("{clients} pacientes · {price} al mes" or "{clients} pacientes" without price); the first is primary, others secondary; each starts Stripe checkout (leaves the site) | button | same | `practice.planChoose`, `practice.planChoosePlain` | billing available, practice closed, not paying, not just paid |
| 19 | Terms line "Contratas como profesional, no como consumidor." with inline link "Condiciones del plan de consulta" to `/condiciones#dietista` | text | same | `practice.planTerms`, `practice.planTermsLink` | billing available |
| 20 | "Gestionar el plan" secondary button (opens Stripe's portal, loading) | button | same | `practice.planManage` | a subscription exists |
| 21 | Test-mode note "Modo de prueba: nada de lo que pagues es dinero real." | notice | same | `practice.planTestMode` | billing available and in test mode |
| 22 | Plan card error (role="alert") | notice | same | API error message | checkout/portal request failed |
| 23 | Patients section heading "Pacientes" | heading | `app/(app)/consulta/page.tsx` | `practice.clientsTitle` | practice open (roster loaded) |
| 24 | Empty roster text "Aún no tienes pacientes. Invita al primero con su correo." | text | same | `practice.clientsEmpty` | open, no clients |
| 25 | Patient card per client: name; stage badge (Sin plan todavía / Check-in pendiente / Completando su perfil / Plan por revisar / Plan en marcha, or "En pausa"); "Comparte su salud" chip; "Paciente desde el {date}" | list | same | `practice.stages.awaiting_plan`, `.check_in_due`, `.onboarding`, `.plan_awaiting_review`, `.plan_under_way`, `practice.paused`, `practice.sharesHealth`, `practice.clientSince` | each client |
| 26 | Active client card is a link to `/consulta/{linkId}`; a paused one is not a link and adds "Tu consulta está cerrada: no puedes ver su ficha hasta que se renueve tu plan." | link | same | `practice.pausedHint` | active vs paused link |
| 27 | Invite card heading "Invitar a un paciente" | heading | `components/CareInviteForm/CareInviteForm.tsx` | `practice.inviteTitle` | practice open |
| 28 | Email field "Correo de tu paciente" (type email, required, autocomplete off) with hint, or the error "Escribe un correo válido, como nombre@ejemplo.com." | field | same | `practice.inviteEmail`, `practice.inviteHint`, `practice.inviteInvalid` | practice open |
| 29 | "Enviar la invitación" submit button ("Enviando…" while sending; disabled while the portal request runs) | button | same | `practice.inviteCta`, `practice.invitePending` | practice open |
| 30 | Sent confirmation (role="status") "Invitación enviada a {email}. Caduca el {date}." | status | same | `practice.inviteSent` | after sending |
| 31 | Practice-full alert: "Tu consulta ya tiene los {count} pacientes que incluye tu plan.", "También puedes terminar el vínculo...", and a "Pasar a un plan mayor" secondary button (Stripe portal, loading) | notice | same | `practice.inviteFull`, `practice.inviteFullEnd`, `practice.inviteFullUp` | the API answers PRACTICE_FULL |
| 32 | Generic invite failure (role="alert") | notice | same | API error message | other failure |
| 33 | "Invitaciones sin responder" heading and a list of email + "Caduca el {date}" | list | `consulta/page.tsx` | `practice.invitationsTitle`, `practice.invitationExpires` | open and at least one pending invitation |
| 34 | Agreement footnote "Aceptado el {date}, versión {version}." | text | same | `practiceAgreement.acceptedOn` | agreement accepted at some time |

## /consulta/[linkId]  (`apps/web/src/app/(app)/consulta/[linkId]/page.tsx`)

Browser-tab title: `pages['/consulta/[linkId]'].title` in the dictionary (set by `appMetadata`).
Professional only. 404 when the link is not the caller's, ended, paused, or not a link. Every read is written to the client's access trail (shell/other inventory). Health block exists only when the client shares health.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | "← Pacientes" back link to `/consulta` | link | `consulta/[linkId]/page.tsx` | `practice.back` | always |
| 2 | Client name as page heading | heading | same | client name is data | always |
| 3 | "Paciente desde el {date}" | text | same | `practice.clientSince` | always |
| 4 | "Comparte su salud" chip | status | same | `practice.sharesHealth` | client shares health |
| 5 | Pending-plan card: heading "Plan por revisar" (focus target), date range, intro "Tu paciente no lo verá hasta que lo publiques..." | heading | same | `practice.pendingTitle`, `plan.range`, `practice.pendingIntro` | a plan awaits review |
| 6 | Pending-plan days: ordered list of collapsible days (first open), summary "Día {index} · {date}" and "{kcal} kcal · {protein} g de proteína" | list | `components/CarePlanDays/CarePlanDays.tsx` | `practice.dayTitle`, `practice.dayTotals`, `units.kcal` | a plan awaits review |
| 7 | Each meal in a pending day: slot label, dish name, "{kcal} kcal · {protein} g P" (no link to the dish) | list | same | slot labels via `lib/generation.slotLabel` (`slots.*`), `units.kcal`, `units.proteinShort`; name is data | each meal |
| 8 | Change-this-dish control per pending meal (professional route): button "Cambiar plato" (disabled when spent; reads "Sin cambios" when spent), expanding panel with the legend "¿Qué buscas en el nuevo plato?" and a radio list of five options, each with a hint, confirm and cancel buttons, a footer line, alert on failure | menu | `components/MealSwap/MealSwap.tsx` | `meal.swap`, `meal.swapSpentShort`, `meal.swapAxisLabel`, `meal.swapAxisAny`, `.swapAxisQuicker`, `.swapAxisNoCooking`, `.swapAxisMoreProtein`, `.swapAxisVegetarian` and their `...Hint` keys, `meal.swapConfirm`, `meal.swapping`, `common.cancel`, `practice.swapHint`, `practice.swapSpent`, `meal.swapNoFit`, `meal.swapNoFitAxis` | each meal in the pending plan |
| 9 | "Publicar el plan" button (loading); error alert (gone message or API message) | button | `components/CarePublishButton/CarePublishButton.tsx` | `practice.publish`, `practice.gone` | a plan awaits review |
| 10 | "Generar otro" secondary button with hint "Sustituye este borrador por uno nuevo..." and its running/done/failed states (see row 17) | button | `components/CareGenerateButton/CareGenerateButton.tsx` | `practice.regenerate`, `practice.regenerateHint` | a plan awaits review |
| 11 | Current-plan card heading "Plan actual" (focus target) | heading | `consulta/[linkId]/page.tsx` | `practice.currentPlanTitle` | always |
| 12 | Current plan date range, or "Todavía no tiene ningún plan." | text | same | `plan.range`, `practice.currentPlanNone` | has plan / no plan |
| 13 | "Nueva quincena" button (primary, secondary when a plan awaits review), disabled with a reason line when a plan is pending or the fortnight is still running | button | `CareGenerateButton.tsx` | `practice.newFortnight`, hint: `practice.newFortnightPending`, `practice.newFortnightRunning`, `practice.newFortnightReview`, `practice.newFortnightDirect` | always |
| 14 | Generation progress status line (pipeline step text or "Generando el plan…") | status | `CareGenerateButton.tsx` | `generation.steps.*` (via `stepLabel`), `practice.generating` | while generating |
| 15 | Generation done status: "Plan listo. Lo tienes arriba, en «Plan por revisar»." or "Plan listo: ya lo tiene tu paciente." | status | same | `practice.generateDoneReview`, `practice.generateDoneDirect` | job succeeded |
| 16 | Generation failure alert: quota used with renewal date, rate-limited, busy, link gone, patient profile incomplete, generic failure, or API message | notice | same | `practice.generateQuota`, `generation.rateLimited`, `practice.generateBusy`, `practice.gone`, `practice.generateIncomplete`, `practice.generateFailed`, API message | request or job failed |
| 17 | Plans history: heading "Planes" and rows "Plan {version} · {from} – {to}" with status En curso / Archivado / Terminado / Sustituido | list | `consulta/[linkId]/page.tsx` | `practice.historyTitle`, `practice.historyItem`, `practice.historyStatus.active`, `.archived`, `.completed`, `.replaced` | at least one plan |
| 18 | Fortnights card heading "Quincenas y check-ins" | heading | same | `practice.fortnightsTitle` | always |
| 19 | Overall adherence: "{n} % · {eaten} comidas hechas de {marked} marcadas" or "Aún no ha marcado ninguna comida." | text | same | `practice.overallLine`, `practice.overallNone` | always |
| 20 | Fortnight list item: range heading, adherence percent or an em dash, a decorative bar, caption "de las comidas marcadas, hechas" or "Sin comidas marcadas" | list | `components/CareFortnightList/CareFortnightList.tsx` | `practice.fortnightRange`, `practice.adherenceLabel`, `practice.adherenceNone` | at least one fortnight |
| 21 | Check-in answers per fortnight: "Satisfacción {value} de 5", hunger, difficulty, "Pesaba {value} kg", or "Sin check-in" | list | same | `practice.checkInSatisfaction`, `practice.checkInHunger.hungry/right/too_much`, `practice.checkInDifficulty.easy/ok/hard`, `practice.checkInWeight`, `practice.checkInNone` | per fortnight |
| 22 | Suggested-kcal sentence "Con esta respuesta, su objetivo pasaría a {kcal} kcal. No se ha cambiado: decides tú." | notice | same | `practice.checkInSuggested` | check-in has a suggested value |
| 23 | No fortnights text | text | `consulta/[linkId]/page.tsx` | `practice.fortnightsEmpty` | no fortnights |
| 24 | Weight card heading "Peso" | heading | same | `practice.weightTitle` | always |
| 25 | Latest weight figure "{kg} kg" | figure | same | `units.kilogram` | weight exists |
| 26 | Weight line chart with y-axis max/min, x-axis first/last date, dashed target line, dots; hidden text summary of the trend; caption with the target; "not enough readings" text with fewer than two points | chart | `components/WeightChart/WeightChart.tsx` | `progress.chartSummary`, `progress.weightTarget`, `progress.chartEmpty` | weight exists |
| 27 | "Aún no ha anotado ningún peso." | text | `consulta/[linkId]/page.tsx` | `practice.weightNone` | no weight |
| 28 | Targets card: heading "Objetivos diarios", source ("Estimados a partir de su perfil" / "Fijados por {name}" / "Fijados por tu paciente") | heading | `components/CareTargetsForm/CareTargetsForm.tsx` | `practice.targetsTitle`, `practice.targetsEstimated`, `practice.targetsProfessional`, `practice.targetsSelf` | targets present |
| 29 | Four macro figures (kcal, protein, carbs, fat) | figure | `components/MacroSummary/MacroSummary.tsx` | `macros.kcal`, `macros.protein`, `macros.carbs`, `macros.fat`, `units.kcal`, `units.gram` | targets present |
| 30 | "Cambiar objetivos" secondary button | button | `CareTargetsForm.tsx` | `practice.targetsEdit` | not editing |
| 31 | Edit form: four numeric inputs (Calorías (kcal) with hint "Entre {min} y {max} kcal para este paciente."; Proteína (g) hint "Hasta {max} g"; Carbohidratos (g); Grasas (g)), per-field error "Este valor está fuera de lo que se puede fijar." | field | same | `targets.labelKcal`, `targets.labelProtein`, `targets.labelCarbs`, `targets.labelFat`, `practice.targetsBounds`, `targets.hintUpTo`, `practice.targetsFieldInvalid` | editing |
| 32 | Edit actions: "Guardar objetivos" ("Guardando…" while saving), "Cancelar", and "Volver a los estimados" (tertiary) | button | same | `practice.targetsSave`, `common.saving`, `common.cancel`, `practice.targetsReset` | editing; reset only when an override is in place |
| 33 | Targets error block (role="alert"): API sentences naming the bounds, the gone message, or the generic message | notice | same | API message, `practice.gone` | save failed |
| 34 | Review card heading "Revisión" with a switch "Revisar cada plan antes de que lo vea" and hint (on: "Cada plan nuevo te llega primero a ti..."; off: "Los planes nuevos llegan a tu paciente en cuanto están listos."), inline error | toggle | `components/CareReviewSwitch/CareReviewSwitch.tsx` + `components/SettingSwitch/SettingSwitch.tsx` | `practice.reviewTitle`, `practice.reviewLabel`, `practice.reviewOnHint`, `practice.reviewOffHint`, `practice.gone` | always |
| 35 | Health card (heading "Salud", intro "Tu paciente decidió compartir esto contigo. Nunca se envía a ningún modelo.") with a definition list Condiciones / Medicación / Suplementos, each a comma list or "Nada anotado" | list | `consulta/[linkId]/page.tsx` | `practice.healthTitle`, `practice.healthIntro`, `practice.healthConditions`, `practice.healthMedications`, `practice.healthSupplements`, `practice.healthNone` | client shares health |
| 36 | End-link card heading "Terminar vínculo" with hint "Tu paciente conserva su cuenta, su historial y su último plan publicado." | heading | `components/CareEndLink/CareEndLink.tsx` and page | `practice.end`, `practice.endHint` | always |
| 37 | "Terminar vínculo" secondary button; opens an inline confirmation: "¿Terminar el vínculo con {name}?" (focus target), consequence text, destructive "Sí, terminar" (loading) and "Cancelar"; on success goes to `/consulta` | dialog | `CareEndLink.tsx` | `practice.end`, `practice.endConfirmTitle`, `practice.endConfirmBody`, `practice.endConfirmCta`, `common.cancel` | always |
| 38 | End-link error alert | notice | same | API error message | end failed |

## /invitacion/[token]  (`apps/web/src/app/(app)/invitacion/[token]/page.tsx`)

Browser-tab title: `pages['/invitacion'].title` in the dictionary (set by `appMetadata`).
Reached from the link in an invitation mail by the invited, signed-in person. One 404 for every reason there is nothing to answer (expired, answered, other address, bad token).

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Heading "Invitación de {professional}" | heading | `components/CareInvitation/CareInvitation.tsx` | `care.invitationTitle` | invitation valid |
| 2 | Intro with professional name and collegiate number | text | same | `care.invitationIntro` | same |
| 3 | "Si aceptas, {professional} verá:" and a list of what is shared (name, targets, plans, progress, check-in answers; list comes from the invitation) | list | same | `care.invitationShareIntro`, `care.shares.profile`, `.targets`, `.mealPlans`, `.progress`, `.checkIns` | same |
| 4 | "Y podrá:" and fixed list (set targets, generate/change plans, review each new plan) | list | same | `care.invitationCanDoIntro`, `care.canDo.targets`, `.plans`, `.review` | same |
| 5 | "No verá tus alergias, tus intolerancias ni tu correo." and "Cada vez que mire o cambie algo, lo verás en tu perfil." | text | same | `care.invitationNotShared`, `care.invitationTrail` | same |
| 6 | Separate health-sharing checkbox "Compartir también mis condiciones de salud, mi medicación y mis suplementos" (unchecked) with note "Es opcional y aparte..." | field | same | `care.healthQuestion`, `care.healthShareNote` | same |
| 7 | When checked: intro "Aparte de lo anterior, puedes compartir también:" and list (conditions, medications, supplements, from the invitation) | list | same | `care.healthShareIntro`, `care.healthShares.conditions`, `.medications`, `.supplements` | health checkbox ticked |
| 8 | Privacy sentence with inline link to `/privacidad#tu-dietista` (text "política de privacidad" key) | text | same | `care.invitationPrivacy`, `auth.legalPrivacy` | same |
| 9 | Error alert | notice | same | API error message | accept/decline failed |
| 10 | "Aceptar la invitación" large button (loading); goes to `/perfil` | button | same | `care.invitationAccept` | same |
| 11 | "No, gracias" large secondary button (loading); goes to `/inicio` | button | same | `care.declineCta` | same |
| 12 | Replacement card when a link already exists (CARE_LINK_EXISTS): focusable h1 "Ya tienes un enlace activo", body with professional and since-date, large link "Ver mi perfil" to `/perfil` | notice | same | `care.invitationLinkExistsTitle`, `care.invitationLinkExistsBody`, `care.invitationLinkExistsCta` | accept returned CARE_LINK_EXISTS |

## /inicio  (`apps/web/src/app/(app)/inicio/page.tsx`)

Browser-tab title: `pages['/inicio'].title` in the dictionary (set by `appMetadata`).
The dashboard. Guards: unfinished onboarding goes to the onboarding flow; missing profile consent goes to `/consentimiento`. Loads user, profile, active plan, scheduled plan, shopping list, weight, check-in status and trips. The page has three mutually exclusive bodies: plan under way, a plan waiting for its day (nothing under way), no plan at all. The right-hand rail (`aside`) appears only when the profile has targets.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | First-visit product tour (shell inventory covers it; named here because it opens on this route) | dialog | `components/Tour/Tour.tsx` | shell inventory (`tour.*`) | profile says the tour was not seen |
| 2 | Greeting h1 "Buenos días / Buenas tardes / Buenas noches[, {name}.]" (by hour: before 6 evening, to 14 morning, to 21 afternoon, else evening; name = first word of display name or account name) | heading | `app/(app)/inicio/page.tsx` | `dashboard.goodMorning`, `dashboard.goodAfternoon`, `dashboard.goodEvening`, `dashboard.greetingNamed` | always |
| 3 | Pending-review notice (role="status", h2 + body): the new plan is with the dietitian, meanwhile keep the old one | notice | `components/PlanPendingNotice/PlanPendingNotice.tsx` | `dashboard.pendingReviewTitle`, `dashboard.pendingReviewBody` | a pending-review mark is stored on this device for the current plan |
| 4 | Away card "Estás de vacaciones" with "Tu plan te espera. Retoma el {until}, justo donde lo dejaste." | notice | `components/EmptyState/EmptyState.tsx` (inline) | `vacations.awayTitle`, `vacations.awayBody` | a trip is under way now |
| 5 | "Ver mi plan" large secondary link to `/plan` inside the away card | link | `inicio/page.tsx` | `vacations.seePlan` | away and a plan exists |
| 6 | Check-in due card (warning tone) "Tu check-in de la quincena" + body + "Hacer el check-in" large link to `/check-in` | notice | `EmptyState` + `CtaLink` | `dashboard.checkInDueTitle`, `dashboard.checkInDueBody`, `dashboard.checkInDueCta` | check-in is due |
| 7 | Plan status line: when away "Tu plan está en pausa · se reanuda el {date}"; otherwise "Día {current} de {total}" (or "Tu plan está activo" when today is outside the plan) followed by "· próxima revisión" + available now / today / tomorrow / in {count} days | text | `inicio/page.tsx` | `vacations.pausedUntil`, `dashboard.dayOf`, `dashboard.activePlan`, `dashboard.checkIn`, `dashboard.availableNow`, `dashboard.today`, `dashboard.tomorrow`, `dashboard.inDays` | a plan is active |
| 8 | Fortnight strip: label "Tu quincena", "Quedan {count} días" or "Último día", one cell per plan day (past, today, future; tooltip "Día {index}"), whole strip is a link to `/plan` with aria-label "Ver los 14 días →" | chart | `components/PlanProgress/PlanProgress.tsx` | `dashboard.fortnight`, `dashboard.daysLeft`, `dashboard.lastDay`, `dashboard.fortnightDay`, `dashboard.seeAllDays` | a plan is active |
| 9 | Next-meal card (link to `/plan/comida/{id}`): optional dish picture with the "IA" mark (hidden label "generada por IA"), eyebrow "Lo siguiente · {slot}", dish name, "{kcal} kcal · {protein} g P". The next meal is the first of today's meals whose typical hour is not past | link | `components/NextMeal/NextMeal.tsx` + `components/DishPicture/DishPicture.tsx` | `dashboard.nextMeal`, `slots.*`, `units.kcal`, `units.proteinShort`, `picture.aiMark`, `picture.aiMarkLabel` | today has a meal not yet past |
| 10 | "Ya no queda nada por hoy." | text | `NextMeal.tsx` | `dashboard.nextMealNone` | all of today's slots are past |
| 11 | Dish-picture fallback plate (two circles) when no picture or it fails | picture | `DishPicture.tsx` | not dictionary | meal has no picture / fails offline |
| 12 | Today card heading "Hoy" with small tertiary link "Ver los 14 días →" to `/plan` | heading | `inicio/page.tsx` | `dashboard.today`, `dashboard.seeAllDays` | today is inside the plan |
| 13 | Today's macro summary (Calorías, Proteína, Carbohidratos, Grasas figures) plus the note "Valores orientativos, calculados con tablas de composición (USDA/BEDCA)..." | figure | `components/MacroSummary/MacroSummary.tsx` | `macros.kcal`, `macros.protein`, `macros.carbs`, `macros.fat`, `macros.note`, `units.kcal`, `units.gram` | today is inside the plan |
| 14 | Meal rows for today: round tick button "Marcar como hecha" (one name since phase 9, the state in aria-pressed; was "Marcar como hecha" / "Quitar la marca de hecha") (aria-pressed, optimistic, reverts on failure), slot label, dish name, accompaniments "+ {phrase}" per side, badge "Hecha" or "Saltada", "{kcal} kcal · {protein} g P"; the head is a link to `/plan/comida/{id}` (a plain block when offline and the recipe has no stored copy) | list | `components/MealRow/MealRow.tsx` | `meal.markDone`, `meal.unmarkDone`, `slots.*`, `meal.accompanimentNames.*`, `meal.badgeDone`, `meal.badgeSkipped`, `units.kcal`, `units.proteinShort` | each of today's meals |
| 15 | Per-meal "Ingredientes" disclosure (`details`) listing ingredient and grams (g/kg by `formatQuantity`) | list | `MealRow.tsx` | `meal.ingredients`, `units.gram`, `units.kilogram` | meal has ingredients |
| 16 | Plan-ended card "Tu plan ha terminado" with body (adds "Check-in hecho. Cuando quieras, crea el siguiente plan." when the check-in is done) | notice | `EmptyState` | `dashboard.planEndedTitle`, `dashboard.planEndedBody`, `dashboard.checkInDoneNote` | plan active but today is outside it and nobody is away |
| 17 | "Crear mi próximo plan" large link to `/plan/generando`; "Ver el plan anterior" large secondary link to `/plan` | link | `inicio/page.tsx` | `dashboard.planEndedCta`, `dashboard.seePreviousPlan` | same |
| 18 | Scheduled-plan card (plan under way): h2 "Tu próximo plan empieza el {date}", body "Ya está preparado...", secondary links "Ver sus días" (`/plan/proximo`) and "Ver su lista de la compra" (`/compra/proxima`) | notice | `components/ScheduledPlanCard/ScheduledPlanCard.tsx` | `dashboard.nextPlanTitle`, `dashboard.nextPlanBody`, `dashboard.nextPlanDays`, `dashboard.nextPlanShopping` | a scheduled plan exists |
| 19 | Waiting variant (nothing under way): same card, larger, body "Todavía no es su primer día, así que aún no hay comidas que mostrar..." and "Ver sus días" as the primary link | notice | `ScheduledPlanCard.tsx` | `dashboard.nextPlanWaitingBody`, `dashboard.nextPlanDays`, `dashboard.nextPlanShopping` | no active plan and a scheduled plan |
| 20 | No-plan body: "Tu perfil está completo." plus card "Todavía no tienes plan" with explanation and "Crear mi plan" large link to `/plan/generando` | notice | `EmptyState` | `dashboard.profileComplete`, `dashboard.noPlanTitle`, `dashboard.noPlanBody`, `dashboard.noPlanCta` | no active, no scheduled plan |
| 21 | Rail card heading "Tus objetivos diarios · estimados / ajustados por ti" and tertiary link "Ajustar →" to `/perfil` | heading | `inicio/page.tsx` | `dashboard.targetsLabel`, `dashboard.targetsStatusEstimated`, `dashboard.targetsStatusOverridden`, `dashboard.targetsAdjust` | profile has targets |
| 22 | Targets macro summary (four figures, no note) | figure | `MacroSummary.tsx` | `macros.*` | profile has targets |
| 23 | Estimate note "Son una estimación a partir de tu perfil. Puedes ajustarlas." | text | `inicio/page.tsx` | `dashboard.targetsEstimate` | profile has targets |
| 24 | "Hoy, sobre tus objetivos": four rows (Calorías, Proteína, Carbohidratos, Grasas) "{value} de {target} {unit}" each with a bar capped at 100 % | chart | `components/TargetProgress/TargetProgress.tsx` | `dashboard.todayVsTarget`, `dashboard.ofTarget`, `macros.*`, `units.*` | targets and today's day exist |
| 25 | Shopping snapshot: "Tu lista de la compra", "{items} artículos en {aisles} pasillos", link "Ver la lista →" to `/compra` | link | `components/ShoppingSnapshot/ShoppingSnapshot.tsx` | `dashboard.shoppingTitle`, `dashboard.shoppingCount`, `dashboard.shoppingCta` | targets exist and the active list has items |
| 26 | Weight tracker panel: title "Tu peso", change line ("{change} kg desde tu primera anotación" / "Sin cambios desde tu primera anotación"), current weight "{kg} kg" or "Aún no has anotado ningún peso." | figure | `components/WeightTracker/WeightTracker.tsx` | `dashboard.weightTitle`, `dashboard.weightSince`, `dashboard.weightStable`, `dashboard.weightNone`, `units.kilogram` | targets exist and weight data loaded |
| 27 | Weight sparkline (last 14 readings; decorative) | chart | `WeightTracker.tsx` | not dictionary | more than one reading |
| 28 | Log-weight form: decimal field labelled "Hoy" (placeholder "kg"), "Anotar" small button (disabled when empty, loading); comma accepted | field | `WeightTracker.tsx` | `dashboard.weightToday`, `dashboard.weightPlaceholder`, `dashboard.weightLog` | same |
| 29 | Starting weight "Empezaste en {value} kg" and link "Ver tu evolución →" to `/progreso` | link | `WeightTracker.tsx` | `dashboard.weightStart`, `dashboard.weightMore` | same (start only if known) |
| 30 | Weight log error (role="alert") | notice | `WeightTracker.tsx` | API error message | logging failed |
| 31 | Floor-clamp notice "Hemos ajustado tu ritmo: pedía {requested} kcal y lo hemos subido a {floor}..." | notice | `inicio/page.tsx` | `dashboard.targetsClamped` | targets were clamped by the energy floor |

## /onboarding  (`apps/web/src/app/(app)/onboarding/page.tsx`)

No screen of its own. Reads `GET /onboarding` and redirects to `/onboarding/{resumeStep}` (step 1 when the state cannot be read). Every "carry on where I left off" link points here.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Redirect to `/onboarding/{resumeStep}` | status | `app/(app)/onboarding/page.tsx` | not dictionary | always (no visible content) |

## /onboarding/[paso]  (`apps/web/src/app/(app)/onboarding/[paso]/page.tsx`)

Browser-tab title: `pages['/onboarding'].title` in the dictionary (set by `appMetadata`).
Nine steps, one screen each, in the order of `FLOW` (`components/OnboardingFlow/steps.ts`): 1 about-you, 2 goal, 3 body-activity, 4 how-you-eat, 5 food-preferences, 6 allergies, 7 cooking, 8 kitchen (optional), 9 review. A `paso` that is not an integer from 1 to 9 is a 404. `?volver=perfil` (return to `/perfil`) or `?volver=generando` (return to `/plan/generando`) turns the step into a single-step edit: the primary button saves and returns, the secondary says Cancel, and the kitchen skip link is hidden. The allergies step also loads the allergen catalogue, the about-you step loads the consent state. Each step saves with one PATCH; the flow is resumable and server-rendered with saved answers.

Controls shown on every step (rows 1-8), then step-specific rows.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Progress text "Paso {current} de {total}" and "{value} %" | status | `components/OnboardingFlow/OnboardingFlow.tsx` | `onboarding.stepOf`, `onboarding.percent` | every step |
| 2 | Progress bar (role="progressbar", min 1, max 9, now = step, labelled) | status | same | `onboarding.progressLabel` | every step |
| 3 | Step heading (h1) and subtitle, per step | heading | same | `onboarding.steps.aboutYou.title/.subtitle`, `.goal`, `.bodyActivity`, `.howYouEat`, `.foodPreferences`, `.allergies`, `.cooking`, `.kitchen`, `.review` | every step |
| 4 | Form error banner (role="alert"): invalid-input sentence, the consent sentence, the "fourth preferred appliance" sentence, or an API error | notice | same | `errors.invalidInput`, `profileConsent.note`, `kitchen.preferredFull`, API error message | validation or save failure |
| 5 | Back button (disabled on step 1 unless editing; shows "Cancelar" and returns to the profile/generation page when editing) | button | same | `common.back`, `common.cancel` | every step |
| 6 | Primary button: "Continuar" (steps 1-8), "Terminar" (review), "Guardar" (single-step edit); label "Guardando…" and spinner while saving | button | same | `common.continue`, `common.finish`, `common.save`, `common.saving` | every step |
| 7 | Skip link "Omitir este paso" (tertiary; saves nothing, goes to the review) | button | same | `onboarding.skip` | step 8 and not editing from profile/generation |
| 8 | Save note "Cada paso se guarda al pulsar «Continuar»..." | text | same | `onboarding.saveNote` | every step except the review |
| 9 | Step transition: the form slides forward or back according to direction of travel | status | same | not dictionary | every step change |

### Step 1 about-you

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 10 | Text field "¿Cómo quieres que te llamemos?" (autocomplete nickname) with field error | field | `OnboardingFlow.tsx` | `onboarding.fields.displayName` | step 1 |
| 11 | Radio cards, legend "¿Dónde haces la compra?": España / Reino Unido, hint "Decide qué ingredientes entran en tu plan..." | field | same + `components/OptionCards/OptionCards.tsx` | `onboarding.fields.country`, `onboarding.options.countries.ES/GB`, `onboarding.fields.countryHint` | step 1 |
| 12 | Date field "Fecha de nacimiento" (autocomplete bday); error "NutrIA es para mayores de 18 años." when under 18 | field | same | `onboarding.fields.birthDate`, `errors.underMinimumAge` | step 1 |
| 13 | Radio cards, legend "Sexo": Mujer / Hombre / Otro / Prefiero no decirlo, hint "Lo usamos solo para la ecuación metabólica..." | field | same | `onboarding.fields.sex`, `onboarding.options.sex.*`, `onboarding.fields.sexHint` | step 1 |
| 14 | Consent fieldset, legend "Antes de seguir: tus datos de salud": body paragraph, AI paragraph, required checkbox "Consiento que NutrIA use estos datos de salud para hacer mis planes" (pre-ticked when the current consent version is already given), note with inline link to `/privacidad`. An unticked box blocks the step with `profileConsent.note` in the banner | field | `components/ProfileConsentFields/ProfileConsentFields.tsx` | `profileConsent.title`, `.body`, `.ai`, `.label`, `.note`, `auth.legalPrivacy` | step 1 |

### Step 2 goal

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 15 | Radio cards, legend "¿Qué quieres conseguir?": Perder peso / Mantenerme / Ganar músculo / Rendimiento / Comer sano, each with a hint | field | `OnboardingFlow.tsx` | `onboarding.fields.goalType`, `onboarding.options.goals.weight_loss/.maintenance/.muscle_gain/.performance/.healthy_eating` (label + hint) | step 2 |
| 16 | Number field "Peso objetivo (kg)" (step 0.1) | field | same | `onboarding.fields.targetWeightKg` | step 2 |
| 17 | Number field "Ritmo (kg por semana)" (0 to 1, step 0.05) with hint; local error "El ritmo tiene que estar entre 0 y 1 kg por semana." | field | same | `onboarding.fields.pace`, `onboarding.fields.paceHint`, `onboarding.fields.paceRange` | step 2 |

### Step 3 body-activity

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 18 | Number field "Altura (cm)" | field | `OnboardingFlow.tsx` | `onboarding.fields.heightCm` | step 3 |
| 19 | Number field "Peso actual (kg)" (step 0.1) | field | same | `onboarding.fields.weightKg` | step 3 |
| 20 | Radio cards, legend "Nivel de actividad": Sedentario / Ligero / Moderado / Alto / Deportista, each with a hint | field | same | `onboarding.fields.activityLevel`, `onboarding.options.activity.sedentary/.light/.moderate/.high/.athlete` | step 3 |

### Step 4 how-you-eat

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 21 | Fieldset legend "¿Qué comidas haces, y de qué tamaño?" with hint | field | `OnboardingFlow.tsx` | `onboarding.fields.mealShape`, `onboarding.fields.mealShapeHint` | step 4 |
| 22 | Six nested fieldsets (Desayuno, Media mañana, Comida, Merienda, Cena, Recena), each a radio set: No la hago / Ligera / Normal / Fuerte (defaults: breakfast, lunch, afternoon snack, dinner Normal; morning snack and supper off) | field | `components/MealShapePicker/MealShapePicker.tsx` | `onboarding.options.mealSlots.*`, `onboarding.options.mealSizes.off/.light/.normal/.large` | step 4 |

### Step 5 food-preferences

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 23 | Text field "Alimentos que te gustan" (comma separated) with hint | field | `OnboardingFlow.tsx` | `onboarding.fields.liked`, `onboarding.fields.likedHint` | step 5 |
| 24 | Text field "Alimentos que no quieres ver" with hint | field | same | `onboarding.fields.disliked`, `onboarding.fields.dislikedHint` | step 5 |
| 25 | Chip checkboxes, legend "Cocinas que te apetecen": Mediterránea, Española, Italiana, Mexicana, Japonesa, India, Griega, Árabe, Tailandesa, Peruana (labels hard-coded, same in both languages, stored as values) | field | same + `components/ChipGroup/ChipGroup.tsx` | `onboarding.fields.cuisines`; chip labels not dictionary | step 5 |

### Step 6 allergies

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 26 | Fieldset "Alergias" with hint «Marca «trazas»...» and one row per allergen from the catalogue: allergen checkbox (label from the catalogue, `labelEs`) and a small "trazas" checkbox with aria-label "Trazas de {allergen}" | field | `OnboardingFlow.tsx` | `onboarding.fields.allergies`, `onboarding.fields.traceHint`, `onboarding.fields.traceLabel`, `onboarding.fields.traceLabelFor`; allergen names are catalogue data | step 6 |
| 27 | Chip checkboxes, legend "Intolerancias", one per allergen | field | same + `ChipGroup.tsx` | `onboarding.fields.intolerances` | step 6 |
| 28 | Fieldset "Otras alergias": text field "Algo que no esté en la lista" (comma separated) with hint | field | same | `onboarding.fields.otherAllergies`, `onboarding.fields.customAllergens`, `onboarding.fields.customAllergensHint` | step 6 |
| 29 | Per custom allergen status line: "{label} — lo aplicamos: «{ingredient}» no aparecerá en ningún plato." or "— no lo tenemos en el catálogo... no podemos garantizarlo..." | status | same | `onboarding.customAllergen.enforced`, `onboarding.customAllergen.bestEffort` | a custom allergen is saved |
| 30 | Chip checkboxes, legend "Tipo de alimentación": Sin restricción, Vegetariana, Vegana, Pescetariana, Flexitariana, Sin gluten, Sin lactosa, Halal, Kosher, Tradicional española; hint (halal/kosher scope) | field | same | `onboarding.fields.dietaryPatterns`, `onboarding.options.dietaryPatterns.*`, `onboarding.fields.dietaryPatternsHint` | step 6 |

### Step 7 cooking

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 31 | Number field "Minutos que puedes dedicar a cocinar" (5 to 240, default 30) with hint "Por comida, entre 5 y 240." | field | `OnboardingFlow.tsx` | `onboarding.fields.cookingTime`, `onboarding.fields.cookingTimeHint` | step 7 |

### Step 8 kitchen

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 32 | Fieldset legend "¿Qué tienes en tu cocina?" | field | `OnboardingFlow.tsx` | `onboarding.fields.kitchen` | step 8, only when the profile could be read |
| 33 | Intro and preference hint texts | text | `components/KitchenPicker/KitchenPicker.tsx` | `kitchen.intro`, `kitchen.preferredHint` | step 8 |
| 34 | Live count (role="status"): "Prefieres {count} de {max}." or "Ya prefieres {max}. Quita una para poder elegir otra." | status | same | `kitchen.preferredCount`, `kitchen.preferredFull` | step 8 |
| 35 | Ten appliance rows (Fuego, Horno, Microondas, Batidora, Freidora de aire, Olla a presión, Arrocera, Olla de cocción lenta, Vaporera, Parrilla o barbacoa), each a legend with the assumed default "(por defecto, sí / no)" until answered, and a radio chip set Tengo / No tengo / Prefiero (aria-label "{appliance}: {stance}"). "Prefiero" is unavailable (aria-disabled) once the maximum is reached; "No tengo" is unavailable for the hob | field | same + `ChipGroup.tsx` | `kitchen.appliances.*`, `kitchen.stances.has/.missing/.prefers`, `kitchen.defaultHas`, `kitchen.defaultMissing` | step 8 |
| 36 | Hob note "Todos los planes dan por hecho un fuego..." | text | same | `kitchen.stovetopFixed` | step 8, on the stovetop row |

### Step 9 review

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 37 | Summary rows label/value (an em dash when empty): Nombre, Fecha de nacimiento, Altura (cm), Peso actual (kg), Objetivo, Actividad, Comidas del día (the meals that are not off), Alergias, Intolerancias, Cocinas ("Sin preferencia" when none), Tu cocina (appliances not missing, or "Nada dicho..." text) | list | `OnboardingFlow.tsx` + `components/SummaryRow/SummaryRow.tsx` | `onboarding.review.name/.birthDate/.height/.weight/.objective/.activity/.mealShape/.allergies/.intolerances/.cuisines/.kitchen`, `onboarding.review.noCuisinePreference`, `goals.*`, `activity.*`, `common.none`, `profile.kitchenNothingSaid`, `kitchen.appliances.*`, `units.kilogram` | step 9 |
| 38 | Targets box: "Tus objetivos diarios (estimados)" and the line "{kcal} kcal · {protein} g proteína · {carbs} g carbohidratos · {fat} g grasas" | figure | same | `onboarding.review.targets`, `onboarding.review.targetsLine` | step 9 and targets computed |
| 39 | Basis text "Calculado sobre {maintenance} kcal de mantenimiento" + ", menos {pace} kg/semana" (weight loss) or ", más {pace} kg/semana" (muscle gain) + ". Podrás ajustarlo desde tu perfil." | text | same | `onboarding.review.basis`, `.basisLoss`, `.basisGain`, `.basisTail` | step 9 and targets computed |
| 40 | Clamp notice "Hemos ajustado tu ritmo: pedía {requested} kcal, fuera del margen..." | notice | same | `onboarding.review.clamped` | step 9 and the pace was clamped |
| 41 | On finishing: `POST /onboarding/complete`, then `/inicio` | status | same | not dictionary | "Terminar" pressed |

## /perfil  (`apps/web/src/app/(app)/perfil/page.tsx`)

Browser-tab title: `pages['/perfil'].title` in the dictionary (set by `appMetadata`).
The profile and settings screen. Guards: unfinished onboarding goes to the flow; missing profile consent goes to `/consentimiento`. Search param `?premium=gracias` is where Stripe checkout returns. Sections in page order: Tu plan, Tu dietista (conditional), Tus datos, Seguridad (when the account loaded), Avisos e idioma, Ayuda, Zona peligrosa. Anchors in use: `#seguridad` (linked from the practice and console second-factor screens). "Edit" links on the data blocks go to the onboarding step that owns the fields with `?volver=perfil` (single-step edit, returns here).

### Header

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page heading "Tu perfil" and subtitle | heading | `app/(app)/perfil/page.tsx` | `profile.title`, `profile.subtitle` | always |
| 2 | Persistent supervision note (role="note", not dismissable) | notice | same | `profile.supervision` | `health.supervisionRecommended` |

### Section "Tu plan"

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 3 | Section heading "Tu plan" | heading | `perfil/page.tsx` | `profile.sectionPlan` | always |
| 4 | Targets card: h3 "Tus objetivos diarios", subtitle ("Estimados a partir de tu perfil" / "Los has ajustado tú" / "Los ha ajustado {name}, tu dietista") and badge ("Estimación" / "Tuyos" / "Tu dietista") | heading | `components/TargetsPanel/TargetsPanel.tsx` | `targets.title`, `targets.subtitleEstimated`, `targets.subtitleOwn`, `targets.subtitleProfessional`, `targets.badgeEstimate`, `targets.badgeYours`, `targets.badgeProfessional` | profile has targets |
| 5 | Four macro figures | figure | `components/MacroSummary/MacroSummary.tsx` | `macros.*`, `units.*` | targets card |
| 6 | Disclaimer "Son una estimación, no una prescripción..." | text | `TargetsPanel.tsx` | `targets.disclaimer` | targets card |
| 7 | "Cómo hemos calculado esto" disclosure (`details`) with a definition list: Ecuación (Mifflin-St Jeor), Metabolismo basal, Actividad (label x factor), Mantenimiento, Objetivo, Ritmo ("{value} kg / semana"), Resultado del cálculo, Margen permitido ("{floor} – {ceiling} kcal") | list | `TargetsPanel.tsx` | `targets.explain`, `targets.equation`, `targets.equationMifflin`, `targets.basalRate`, `targets.activity`, `targets.activityValue`, `targets.maintenance`, `targets.goal`, `targets.pace`, `targets.computed`, `targets.allowedRange`, `targets.kcalValue`, `targets.rangeValue`, `activity.*`, `goals.*`, `units.perWeek` | targets card |
| 8 | Clamp notice (energy floor raised, or ceiling lowered) | notice | `TargetsPanel.tsx` | `targets.clampedFloor`, `targets.clampedCeiling` | the targets were clamped |
| 9 | Stale-override notice | notice | same | `targets.stale` | a saved override no longer fits the limits |
| 10 | Errors block (role="alert"): the API's bound sentences or a generic message | notice | same | API message | save failed |
| 11 | "Ajustar mis objetivos" secondary button | button | same | `targets.edit` | not editing |
| 12 | Edit form: numeric fields "Calorías (kcal)" (hint "Entre {min} y {max}"), "Proteína (g)" (hint "Hasta {max} g"), "Carbohidratos (g)", "Grasas (g)" | field | same | `targets.labelKcal`, `targets.hintRange`, `targets.labelProtein`, `targets.hintUpTo`, `targets.labelCarbs`, `targets.labelFat` | editing |
| 13 | Edit actions: "Guardar mis objetivos" (loading, "Guardando…"), "Cancelar", and "Volver a los calculados" (only when an override or stale override exists) | button | same | `targets.saveTargets`, `common.saving`, `common.cancel`, `targets.reset` | editing |
| 14 | Meal-size note card (h3 "Tus comidas serán grandes", body with meal count and kcal, optional suggestion); actions: link to `/onboarding/4?volver=perfil` labelled by the suggestion (Añadir un desayuno / Añadir una merienda / Cambiar la {slot}) and "Entendido" (dismiss, remembered per answer on this device) | notice | `components/ProfileMealSizeNote/ProfileMealSizeNote.tsx`, `components/MealSizeNote/MealSizeNote.tsx` | `mealSize.title`, `mealSize.body`, `mealSize.suggestions.add_breakfast.action/.body`, `.add_afternoon_snack`, `.snack_to_normal`, `.none`, `mealSize.understood` | the largest main meal is large and not dismissed |
| 15 | Dismissal status (hidden, role="status") "Aviso ocultado" | status | `ProfileMealSizeNote.tsx` | `mealSize.dismissed` | after pressing "Entendido" |
| 16 | Health card heading "Salud" with button "Añadir" / "Editar" / "Cerrar" and intro "Opcional. Nada de esto es obligatorio..." | heading | `components/HealthPanel/HealthPanel.tsx` | `health.title`, `common.add`, `common.edit`, `common.close`, `health.intro` | health data loaded |
| 17 | Recorded summary: Condiciones, Medicación, Suplementos (name, kind, protein x servings) and "Proteína de suplementos: {grams} g al día, además de lo que aporta el plan." | list | `HealthPanel.tsx` | `health.conditions`, `health.medications`, `health.supplements`, `health.supplementKinds.protein/.creatine/.vitamins_minerals/.omega_3/.other`, `health.supplementProteinLabel`, `health.supplementProteinTotal`, `health.supplementProteinTotalEmphasis`, `health.supplementProteinTotalTail`, `common.none`, `common.noneMasculine` | at least one item recorded |
| 18 | Applied exclusions "Por tu {condition} excluimos {allergen} de todos tus planes..." | notice | `HealthPanel.tsx` | `health.applied` | a condition derived an exclusion |
| 19 | Suggested exclusions "Podemos excluir {allergen} por tu {condition}, pero no lo hacemos por nuestra cuenta..." with link "el paso de alergias" to `/onboarding/6` | notice | same | `health.suggestion`, `health.addSuggestionLink` | a condition suggests an exclusion |
| 20 | Stale-consent notice | notice | same | `health.consentStale` | records exist and the consent is not current |
| 21 | Edit panel: 14 condition checkboxes (Celiaquía, Intolerancia a la lactosa, Diabetes tipo 1, Diabetes tipo 2, Hipertensión, Colesterol alto, Síndrome de intestino irritable, Reflujo gastroesofágico, Hipotiroidismo, Síndrome de ovario poliquístico, Enfermedad renal crónica, Gota, Embarazo, Lactancia) plus a free text "Otras" with hint | field | same | `health.conditions`, `conditions.coeliac/.lactose_intolerance/.type_1_diabetes/.type_2_diabetes/.hypertension/.hypercholesterolemia/.ibs/.gerd/.hypothyroidism/.pcos/.chronic_kidney_disease/.gout/.pregnancy/.breastfeeding`, `health.conditionsOther`, `health.conditionsOtherHint` | panel open |
| 22 | Medication fieldset: text "Medicamentos" with hint, note about no interaction checking | field | same | `health.medications`, `health.medicationsLabel`, `health.medicationsHint`, `health.medicationsNote` | panel open |
| 23 | Supplements fieldset: hint, and per supplement row: "Nombre" text, "Tipo" select (Proteína en polvo, Creatina, Vitaminas y minerales, Omega-3, Otro), "Proteína por toma (g)" number (only for the protein kind), "Tomas al día" number (min 1), "Quitar" button; and "Añadir suplemento" button | field | same | `health.supplements`, `health.supplementsHint`, `health.supplementName`, `health.supplementKind`, `health.supplementKinds.*`, `health.supplementProtein`, `health.supplementServings`, `common.remove`, `health.supplementAdd` | panel open |
| 24 | Consent checkbox and note | field | same | `health.consentLabel` (value as in the dictionary), `health.consentNote` | panel open |
| 25 | Save error (role="alert") | notice | same | API error message | save/withdraw failed |
| 26 | "Guardar" button (disabled until the consent is ticked; "Guardando…") and, when something is recorded, "Borrar todos mis datos de salud" | button | same | `common.save`, `common.saving`, `health.withdraw` | panel open |
| 27 | Vacation card: h3 "Vacaciones" (focus target), intro | heading | `components/VacationPlanner/VacationPlanner.tsx` | `vacations.title`, `vacations.intro` | always |
| 28 | Trip rows: "Del {from} al {to}", "{count} días" or "ahora mismo, {count} días", and a small secondary button "Quitar" (or "He vuelto" for the trip under way) with an aria-label naming the trip | list | same | `vacations.range`, `vacations.days`, `vacations.awayNow`, `vacations.cancel`, `vacations.cancelFor`, `vacations.backEarly`, `vacations.backEarlyFor` | at least one trip |
| 29 | Add-trip form: date "Desde" (min today, required), date "Hasta" (required), "Pausar el plan" button (disabled until both are set) | field | same | `vacations.from`, `vacations.to`, `vacations.add` | always |
| 30 | Outcome status "Viaje añadido. Tu plan se pausa esos días." / "Viaje quitado." / "Ya estás de vuelta. Tu plan sigue desde hoy." | status | same | `vacations.added`, `vacations.removed`, `vacations.back` | after an action |
| 31 | Vacation error (role="alert") | notice | same | API error message | failed |
| 32 | Fixed meals card: h3 "Comidas fijas" (focus target), intro | heading | `components/FixedMealPlanner/FixedMealPlanner.tsx` | `fixedMeals.title`, `fixedMeals.intro` | fixed-meals data and preferences loaded |
| 33 | Status notices (role="status"): "Hay {count} comidas fijas que ya no podemos cumplir..." (or the single form) and "Hay {count} días que no van a llegar a sus macros..." (or single) | notice | same | `fixedMeals.unhonouredCount`, `.unhonouredCountOne`, `.outOfBandCount`, `.outOfBandCountOne` | the honourability check (lazy, when the list scrolls near) reports such rules/days |
| 34 | Fixed-meal rules list: "{day}, {meal}" and the dish name; marks "No se está cumpliendo" with the reason (allergen, clashes with another fixed meal, disliked, diet, missing appliance, too big/small, no recipe, unknown dish, wrong slot, too slow with minutes) and a fix link (Revisar lo que no quieres ver → `/onboarding/5?volver=perfil`, Revisar tu tipo de alimentación → `/onboarding/6?volver=perfil`, Revisar tu cocina → `/onboarding/8?volver=perfil`, Cambiar tus minutos para cocinar → `/onboarding/7?volver=perfil`); mark "Día fuera de macros" with the note on the first such rule of the day | list | same | `fixedMeals.rule`, `fixedMeals.weekdays`, `fixedMeals.slots`, `fixedMeals.unhonouredMark`, `fixedMeals.unhonouredReasons.*`, `fixedMeals.unhonouredTooSlowMinutes`, `fixedMeals.reasonFix.*`, `fixedMeals.outOfBandMark`, `fixedMeals.outOfBandNote` | at least one rule |
| 35 | Per-rule "Quitar" small secondary button, aria-label "Quitar la comida fija de los {day} ({meal})" | button | same | `fixedMeals.remove`, `fixedMeals.removeFor` | each rule |
| 36 | Allowance line: "Te quedan {remaining} de {limit}." / "Te queda 1 de {limit}." / "Ya tienes tus {limit} comidas fijas. Quita una para fijar otra." / "Ya tienes tu comida fija..." | text | same | `fixedMeals.left`, `.leftOne`, `.full`, `.fullOne` | always |
| 37 | Add form (only while the allowance allows and some day is free). "Qué día" select (Lunes to Domingo; a full day stays listed, disabled, as "{day} · ya tiene {limit}"), placeholder "Elige un día", note naming the full days | field | same | `fixedMeals.day`, `fixedMeals.dayPlaceholder`, `fixedMeals.weekdays`, `fixedMeals.dayFullOption`, `fixedMeals.dayFullHint`, `fixedMeals.weekdaysInSentence` | allowance remaining and a free day exists |
| 38 | "Qué comida" select (the free meal slots for that day, in `slots`), placeholder "Elige una comida" | field | same | `fixedMeals.meal`, `fixedMeals.mealPlaceholder`, `fixedMeals.slots.*` | same |
| 39 | No-fit text "Ningún plato de tu biblioteca encaja en esa comida ese día..." | text | same | `fixedMeals.noneFit` | day and meal chosen, zero dishes fit |
| 40 | Side note "Ese día ya tienes la {meal} fijada. Si el plato que elijas no cuadra con ella, te lo decimos antes de fijarlo." | notice | same | `fixedMeals.beside` | the day already holds a rule and no dish chosen yet |
| 41 | Dish search: search field "Qué plato" (placeholder "Busca por nombre: tortilla, lentejas, merluza…") with hint "{count} platos encajan en esa comida ese día." / "Un plato encaja..." | field | same | `fixedMeals.dish`, `fixedMeals.searchPlaceholder`, `fixedMeals.count`, `fixedMeals.countOne` | day, meal chosen and dishes exist, no dish chosen |
| 42 | Match count (role="status") "{count} coinciden" / "1 coincide" / "Ningún plato se llama «{query}»." | status | same | `fixedMeals.match`, `fixedMeals.matchOne`, `fixedMeals.noMatch` | same |
| 43 | Matching dishes as buttons (8 at a time) and "Ver {count} más" | list | same | `fixedMeals.more`; dish names are data | matches exist |
| 44 | Chosen dish line "Qué plato" + name + "Cambiar" small button | button | same | `fixedMeals.dish`, `fixedMeals.change` | a dish is chosen |
| 45 | Consequence line (role="status", busy while checking): "Comprobando cómo queda ese día…", "Aviso" + warning sentence (clash with another fixed meal), "No se puede fijar" + refusal sentence, stale notice "Ese día ha cambiado mientras elegías..." | status | same | `fixedMeals.checking`, `fixedMeals.warningMark`, `fixedMeals.warnings.clashes_with_fixed`, `fixedMeals.refusalMark`, `fixedMeals.reasons.*`, `fixedMeals.tooSlowMinutes`, `fixedMeals.warningStale`, `fixedMeals.checkFailed` | a dish is chosen |
| 46 | Why-not list: "Hay {count} platos con ese nombre que no podemos ofrecerte ahí:" with names grouped by reason sentence and the same fix links | list | same | `fixedMeals.whyCount`, `fixedMeals.whyCountOne`, `fixedMeals.reasons.*`, `fixedMeals.reasonFix.*` | a search of 3+ letters finds nothing offered |
| 47 | "¿No está tu plato?" ask block: intro, field "Cómo se llama el plato" (placeholder "Patatas a la riojana", Enter asks), standing notice (do not write personal data), secondary "Pídenoslo" button (loading), problem alert (nothing found, not a name, spent, day full, API), remaining-requests line "Te quedan {remaining} de {limit} este mes..." | field | same | `fixedMeals.askTitle`, `fixedMeals.askIntro`, `fixedMeals.askLabel`, `fixedMeals.askPlaceholder`, `fixedMeals.askNotice`, `fixedMeals.ask`, `fixedMeals.askNothing`, `fixedMeals.askNotAName`, `fixedMeals.askSpent`, `fixedMeals.dayFull`, `fixedMeals.askLeft`, `fixedMeals.askLeftOne` | a typed dish is not found, and the dish-request allowance is open |
| 48 | Ask gated text: "Pedirnos un plato que no está en la biblioteca es de premium." (free tier) or "Ya has pedido tus {limit} platos de este mes..." | notice | same | `fixedMeals.askPremium`, `fixedMeals.askSpent` | a typed dish is not found and requests are not allowed |
| 49 | Submit button "Fijar esta comida" (becomes "Fijarlo igualmente" when a warning is read); disabled while pending/checking, without day/meal/dish, or when refused | button | same | `fixedMeals.add`, `fixedMeals.addAnyway` | add form visible |
| 50 | Status after a request: "Ya lo tienes: {name}. Ahora puedes fijarlo." ; after add/remove: "Comida fijada. Entra en los planes que generes a partir de ahora." / "Quitada. Los planes que ya tienes no cambian." | status | same | `fixedMeals.asked`, `fixedMeals.added`, `fixedMeals.removed` | after the action |
| 51 | Fixed-meal error (role="alert") including "Ese día ya tiene sus {limit} comidas fijas. Elige otro día." | notice | same | `fixedMeals.dayFull`, `fixedMeals.reasons.*`, API message | failed |
| 52 | Premium card (payments open): h3 "Premium"; standing line (past due / ends on / trialing until / renews on / granted by NutrIA / pitch with allowances / just paid "Pago recibido. Premium se activa en unos segundos...") | heading | `components/PremiumCard/PremiumCard.tsx` | `profile.premiumTitle`, `profile.premiumPastDue`, `.premiumEnds`, `.premiumTrialing`, `.premiumRenews`, `.premiumGranted`, `.premiumPitch`, `.premiumJustPaid` | billing available |
| 53 | Trial offer "Los primeros {days} días son gratis..." | text | `PremiumCard.tsx` | `profile.premiumTrial` | free tier and trial days |
| 54 | Checkout buttons "Mensual · {price} al mes" (primary) and "Anual · {price} al año (ahorras un {saving} %)" or plain (secondary); each leaves for Stripe checkout | button | same | `profile.premiumMonthly`, `.premiumYearly`, `.premiumYearlyPlain` | free tier, price exists |
| 55 | "Sin permanencia: lo cancelas cuando quieras, desde aquí mismo." | text | same | `profile.premiumCancelAnytime` | free tier |
| 56 | Safety line "La seguridad alimentaria —alergias, intolerancias y nutrientes— es la misma con premium y sin él." | text | same | `profile.premiumSafety` | always on the card |
| 57 | Test-mode note with test card | notice | same | `profile.premiumTestMode` | billing in test mode |
| 58 | "Gestionar la suscripción" secondary button (Stripe portal) | button | same | `profile.premiumManage` | paying subscriber |
| 59 | Premium error | notice | same | API error message | request failed |
| 60 | Premium-not-yet-on-sale card (billing exists but unavailable): h3 "Premium", pitch, "Todavía no está en venta... escríbeme a {email}" (email from `LEGAL_IDENTITY`), safety line. No buttons | notice | `perfil/page.tsx` | `profile.premiumTitle`, `profile.premiumPitch`, `profile.premiumNotOnSale`, `profile.premiumSafety` | billing status present but not available |

### Section "Tu dietista" (only when linked or when the trail is not empty)

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 61 | Section heading "Tu dietista" | heading | `perfil/page.tsx` | `profile.sectionCare` | a link exists, or the access trail has entries |
| 62 | Link card: h3 "Tu dietista", professional name, "Desde el {date}", "Comparte: {list}" (profile name, targets, plans, progress, check-in answers, plus health items when shared) | heading | `components/CareLinkCard/CareLinkCard.tsx` | `care.linkTitle`, `care.linkSince`, `care.whatIsShared`, `care.shares.*`, `care.healthShares.*` | active or paused link |
| 63 | Health-sharing switch "Compartir mis condiciones de salud, mi medicación y mis suplementos" with hint ("Tu dietista puede verlas." / "Tu dietista deja de verlas en cuanto lo desactivas. El enlace sigue activo."), error text | toggle | `components/CareHealthSwitch/CareHealthSwitch.tsx` + `SettingSwitch.tsx` | `care.healthShareToggle`, `care.healthShareOnHint`, `care.healthShareOffHint` | link exists |
| 64 | "Terminar el enlace" secondary button; inline confirmation: "¿Terminar el enlace con {professional}?" (focus), consequence text, destructive "Sí, terminar" (loading), "Cancelar"; error alert | dialog | `CareLinkCard.tsx` | `care.end`, `care.endConfirmTitle`, `care.endConfirmBody`, `care.endConfirmCta`, `common.cancel` | link exists |
| 65 | Access trail card: h3 "Quién ha accedido", hidden live announcer; list rows "{professional} vio {kind}" / "cambió" / "Empezaste a compartir ... con" / "Dejaste de compartir ... con" with date-time; grouped runs "… {count} veces · {range}" as collapsible with the individual rows; kinds: tu perfil, tu plan, tu progreso, la revisión de tu plan, tus objetivos, tu historial de salud; empty text; "Ver más" button with announcements "{count} accesos más cargados." / "No hay más accesos que mostrar."; error alert | list | `components/CareAccessLog/CareAccessLog.tsx` | `care.accessLogTitle`, `care.accessLogRead`, `.accessLogWrite`, `.accessLogGranted`, `.accessLogWithdrawn`, `.accessLogReadGroup`, `.accessLogWriteGroup`, `.accessLogGrantedGroup`, `.accessLogWithdrawnGroup`, `care.accessKinds.*`, `care.accessLogEmpty`, `care.accessLogLoadMore`, `care.accessLogLoaded`, `care.accessLogNoMore` | the trail is loaded |

### Section "Tus datos"

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 66 | Section heading "Tus datos" | heading | `perfil/page.tsx` | `profile.sectionData` | always |
| 67 | Block "Cuenta" with "Editar" link to `/onboarding/1?volver=perfil`; rows Nombre, Correo, Correo verificado (Sí / Pendiente) | list | `components/ProfileSection/ProfileSection.tsx` | `profile.account`, `common.edit`, `profile.name`, `profile.email`, `profile.emailVerified`, `profile.emailVerifiedYes`, `profile.emailVerifiedNo` | always (values blank as em dash when the account could not be read) |
| 68 | Block "Datos personales" (edit to `/onboarding/1?volver=perfil`): Nombre para mostrar, Fecha de nacimiento, Altura, ¿Dónde haces la compra? (España / Reino Unido) | list | same | `profile.personalData`, `profile.displayName`, `onboarding.fields.birthDate`, `profile.height`, `onboarding.fields.country`, `onboarding.options.countries.*` | always |
| 69 | Block "Objetivo" (edit to `/onboarding/2?volver=perfil`): Objetivo, Peso actual, Peso objetivo, Ritmo | list | same | `profile.goal`, `profile.startingWeight`, `profile.targetWeight`, `profile.pace`, `goals.*`, `units.perWeek`, `units.kilogram` | always |
| 70 | Block "Restricciones" (edit to `/onboarding/6?volver=perfil`): Alergias, Intolerancias, Tipo de alimentación ("Ninguna" / "Sin restricción" when empty) | list | same | `profile.restrictions`, `profile.allergies`, `profile.intolerances`, `profile.dietaryPatterns`, `profile.none`, `profile.noRestriction`, `onboarding.options.dietaryPatterns.*` | always |
| 71 | Block "Cómo comes" (edit to `/onboarding/4?volver=perfil`): ¿Qué comidas haces, y de qué tamaño? (meals not off, with "(ligera)"/"(fuerte)" qualifiers), Actividad, Tiempo para cocinar ("{value} min") | list | same | `profile.howYouEat`, `onboarding.fields.mealShape`, `onboarding.options.mealSlots.*`, `onboarding.options.mealSizes.*`, `profile.activity`, `activity.*`, `profile.cookingTime`, `profile.minutes` | always |
| 72 | Block "Tu cocina" (edit to `/onboarding/8?volver=perfil`): nobody said anything: one row "Tienes" = "Lo normal: fuego, horno, microondas y batidora..."; described: rows Tienes, Prefieres usar, No tienes (appliance names or an em dash) | list | same | `profile.kitchenTitle`, `profile.kitchenYouHave`, `profile.kitchenYouPrefer`, `profile.kitchenYouLack`, `profile.kitchenNothingSaid`, `kitchen.appliances.*`, `profile.unset` | profile loaded |
| 73 | Block "Preferencias" (edit to `/onboarding/5?volver=perfil`): Te gusta, No quieres ver (enforced items "· fuera de tus recetas" and best-effort items "· se lo pedimos a la IA, pero no podemos garantizarlo", on separate lines), Cocinas | list | same | `profile.preferences`, `profile.youLike`, `profile.youAvoid`, `profile.youAvoidEnforced`, `profile.youAvoidBestEffort`, `profile.cuisines`, `profile.unset` | always |
| 74 | Health-data consent card: h3 "Consentimiento de datos de salud", body, secondary button "Retirar el consentimiento y borrar estos datos"; inline confirmation "¿Retirar tu consentimiento?" (focus), consequence text, destructive "Sí, retirar y borrar" (loading), "Cancelar"; on success goes to `/onboarding`; error alert | dialog | `components/ProfileConsentCard/ProfileConsentCard.tsx` | `profile.profileConsentTitle`, `profileConsent.body`, `profile.profileConsentWithdraw`, `profile.profileConsentWithdrawTitle`, `profile.profileConsentWithdrawBody`, `profile.profileConsentWithdrawConfirm`, `common.cancel` | always |

### Section "Seguridad" (`#seguridad`; only when the account could be read)

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 75 | Section heading "Seguridad" | heading | `perfil/page.tsx` | `security.sectionTitle` | account loaded |
| 76 | Password card heading "Contraseña" (focus target) | heading | `components/SecurityCard/SecurityCard.tsx` | `security.passwordTitle` | always in the section |
| 77 | Password body ("Al cambiarla se cierra la sesión en tus otros dispositivos y se quitan tus llaves de acceso...") | text | same | `security.passwordBody` | account has a password |
| 78 | Change-password form: fields "Contraseña actual", "Nueva contraseña" (min length, password rules), "Repite la contraseña"; hidden username field; per-field errors: "Escribe tu contraseña actual.", length errors, "Las contraseñas no coinciden.", "La contraseña actual no es correcta.", compromised, contains name/email; general error (too many attempts / internal) | field | `components/ChangePasswordForm/ChangePasswordForm.tsx` | `security.currentPassword`, `auth.newPassword`, `auth.confirmPassword`, `security.currentPasswordMissing`, `auth.passwordTooShort`, `auth.passwordTooLong`, `auth.passwordsDoNotMatch`, `security.wrongCurrentPassword`, `auth.passwordCompromised`, `auth.passwordHasContext`, `auth.tooManyAttempts`, `errors.internal` | account has a password |
| 79 | Password strength meter: bar, level text ("Longitud: corta / suficiente / buena / demasiado larga"), missing characters ("Faltan {count} caracteres." / "Falta 1 carácter."), hint "Mínimo {count} caracteres." and "Mejor una frase de varias palabras." | status | `components/PasswordMeter/PasswordMeter.tsx` | `auth.passwordMeterShort`, `.passwordMeterEnough`, `.passwordMeterLong`, `.passwordMeterTooLong`, `.passwordMeterMissing`, `.passwordMeterMissingOne`, `auth.passwordHint`, `auth.passwordStrengthHint` | same |
| 80 | "Cambiar contraseña" submit button ("Guardando…") and success status "Contraseña cambiada. Hemos cerrado la sesión en tus otros dispositivos." | button | `ChangePasswordForm.tsx` | `security.changePassword`, `common.saving`, `security.passwordChanged` | same |
| 81 | Google-only account text "Entras con Google, así que tu cuenta está tan protegida como tu cuenta de Google." and external link "Activa la verificación en dos pasos en tu cuenta de Google" | link | `SecurityCard.tsx` | `security.googleOnly`, `security.googleOnlyLink` | account has no password |
| 82 | Two-step card: h3 "Verificación en dos pasos" (focus), status badge "Activada" / "Desactivada", body (off: explains 6-digit code; on: code asked when signing in with the password), Google note, polite status line for results | heading | `components/TwoFactorCard/TwoFactorCard.tsx` | `twoFactor.title`, `twoFactor.statusOn`, `twoFactor.statusOff`, `twoFactor.bodyOff`, `twoFactor.bodyOn`, `twoFactor.googleNote` | account has a password |
| 83 | "Activar" secondary button (off) ; "Generar códigos nuevos" secondary and "Desactivar" destructive buttons (on) | button | same | `twoFactor.activate`, `twoFactor.regenerate`, `twoFactor.disable` | idle state |
| 84 | Password step (form, Escape cancels): title ("Paso 1 de 3: tu contraseña" / "¿Desactivar la verificación en dos pasos?" / "¿Generar códigos de respaldo nuevos?"), body, hidden username, field "Tu contraseña", errors ("Escribe tu contraseña.", "La contraseña no es correcta.", locked "Demasiados códigos incorrectos. Espera 15 minutos...", etc.), confirm button (Continuar / Desactivar la verificación / Generar códigos), "Cancelar" | dialog | `components/TwoFactorPasswordStep/TwoFactorPasswordStep.tsx` | `twoFactor.stepPassword`, `.passwordStep`, `.disableTitle`, `.disableBody`, `.disableConfirm`, `.regenerateTitle`, `.regenerateBody`, `.regenerateConfirm`, `twoFactor.password`, `.passwordMissing`, `.wrongPassword`, `.lockedSettings`, `common.continue`, `common.cancel` | an action was opened |
| 85 | Scan step "Paso 2 de 3: añade NutrIA a tu app": QR code (svg, labelled by its caption), caption, link button "Añadir a tu app" (otpauth link), setup key as groups with "Clave de configuración" label and "Copiar clave" button, copied/failed status, "Continuar", "Cancelar" | picture | `components/TwoFactorSetup/TwoFactorSetup.tsx`, `components/TwoFactorQr/TwoFactorQr.tsx` | `twoFactor.stepScan`, `.scanCaption`, `.addToApp`, `.secret`, `.copySecret`, `.secretCopied`, `.copyFailed`, `common.continue`, `common.cancel` | enabling, after the password |
| 86 | Confirm step "Paso 3 de 3: comprueba el código": field "Código de la app" (6 digits, one-time-code) with hint and errors ("El código tiene 6 cifras.", "No coincide...", wrong code), "Comprobar y activar", "Atrás", "Cancelar" | field | `TwoFactorSetup.tsx` | `twoFactor.stepConfirm`, `.confirmCode`, `.confirmHint`, `.codeMissing`, `.setupWrongCode`, `.wrongCode`, `.confirm`, `common.back`, `common.cancel` | enabling, after scanning |
| 87 | Backup codes step: heading "Verificación activada. Guarda tus códigos de respaldo" or "Códigos nuevos. Los anteriores ya no sirven"; body; ordered list of ten codes; "Copiar códigos", "Descargar (.txt)" (file `nutria-codigos-respaldo.txt` with title, date and note), status line; checkbox "Los he guardado" with required message "Marca la casilla cuando los hayas guardado..."; "Terminar" | list | `components/TwoFactorBackupCodes/TwoFactorBackupCodes.tsx` | `twoFactor.codesTitleEnabled`, `.codesTitleRegenerated`, `.codesBody`, `.copy`, `.codesCopied`, `.download`, `.downloading`, `.fileName`, `.fileTitle`, `.fileDate`, `.fileNote`, `.codesSaved`, `.codesSavedMissing`, `.done` | after enabling or regenerating |
| 88 | Result statuses: "Verificación en dos pasos activada. Hemos cerrado tus demás sesiones..." (or the variant when sessions could not be closed), "Verificación en dos pasos desactivada. Te lo confirmamos por correo.", "Tienes códigos de respaldo nuevos..." | status | `TwoFactorCard.tsx` | `twoFactor.enabled`, `.enabledSessionsOpen`, `.disabled`, `.regenerated` | after finishing a flow |
| 89 | Passkeys card (rendered only in a browser with WebAuthn): h3 "Llaves de acceso", body with the site host, reset note (password accounts) | heading | `components/PasskeyCard/PasskeyCard.tsx` | `passkeys.title`, `passkeys.body`, `passkeys.resetNote` | WebAuthn available |
| 90 | List states: "Cargando tus llaves de acceso…", failure text + "Reintentar", "not fresh" text + "Cerrar sesión y volver a entrar" button, "Todavía no tienes ninguna llave de acceso." | status | same + `components/SignInAgainButton/SignInAgainButton.tsx` | `passkeys.loading`, `.listFailed`, `common.retry`, `passkeys.listNotFresh`, `passkeys.stale`, `security.signInAgain`, `passkeys.none` | per list state |
| 91 | Passkey rows: label (device label or "Llave de acceso"), "Añadida el {date}" and a secondary "Quitar" button (aria-label "Quitar la llave {name}, añadida el {date}") | list | same | `passkeys.unnamed`, `passkeys.addedOn`, `passkeys.remove`, `passkeys.removeLabel` | at least one passkey |
| 92 | Remove confirmation: "¿Quitar la llave {name}?", "Ya no podrás entrar con ella. Tu dispositivo puede seguir ofreciéndola...", destructive "Sí, quitarla" (loading), "Cancelar"; Escape cancels | dialog | same | `passkeys.removeTitle`, `passkeys.removeBody`, `passkeys.removeConfirm`, `common.cancel` | a remove started |
| 93 | Add passkey: "Añadir una llave de acceso" secondary button; for password accounts first a password step "Confirma que eres tú" with "Escribe tu contraseña. Después tu dispositivo te pedirá Face ID..." | button | same + `TwoFactorPasswordStep.tsx` | `passkeys.add`, `passkeys.addTitle`, `passkeys.addBody` | list loaded and fresh |
| 94 | Passkey result/error: added "Llave de acceso añadida. Te lo confirmamos por correo.", removed "Hemos quitado la llave {name}.", "Esa llave ya no estaba en tu cuenta.", add failures, too many attempts | notice | same | `passkeys.added`, `passkeys.removed`, `passkeys.removeGone`, `passkeys.addFailed`, `passkeys.confirmAgain`, `passkeys.alreadyAdded`, `passkeys.emailUnconfirmed`, `auth.tooManyAttempts`, `errors.internal` | after an action |
| 95 | Sessions card: h3 "Dónde tienes la sesión abierta" (focus), body, "Cargando tus sesiones…", failure + "Reintentar", not-fresh text + "Cerrar sesión y volver a entrar" | heading | `components/SessionList/SessionList.tsx` | `security.sessionsTitle`, `.sessionsBody`, `.sessionsLoading`, `.sessionsFailed`, `common.retry`, `.sessionsNotFresh`, `.signInAgain` | always in the section |
| 96 | Session rows: device label ("{browser} en {platform}" or "Navegador"), "Entraste el {date}", "Última actividad: {date}", "Este dispositivo" tag for the current one, "Cerrar" button (aria-label "Cerrar la sesión de {device}, entraste el {date}") for the others | list | same | `security.deviceOn`, `.browserUnknown`, `.started`, `.lastActive`, `.thisDevice`, `.closeSession`, `.closeSessionLabel` | sessions loaded |
| 97 | "No tienes la sesión abierta en ningún otro dispositivo." | text | same | `security.noOtherSessions` | only the current session |
| 98 | "Cerrar todas las demás" secondary button; confirmation "¿Cerrar la sesión en todos tus otros dispositivos?" with consequence, "Sí, cerrarlas", "Cancelar"; result "Hemos cerrado la sesión en tus otros dispositivos." / "Hemos cerrado la sesión de {device}."; error alert | dialog | same | `security.closeOthers`, `.closeOthersTitle`, `.closeOthersBody`, `.closeOthersConfirm`, `common.cancel`, `security.othersClosed`, `security.sessionClosed`, `auth.tooManyAttempts`, `errors.internal` | other sessions exist (or list not fresh) |

### Section "Avisos e idioma"

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 99 | Section heading "Avisos e idioma" | heading | `perfil/page.tsx` | `profile.sectionNotices` | always |
| 100 | Reminders card h3 "Avisos" | heading | same | `profile.reminders` | always |
| 101 | Switch "Avísame por correo cuando acabe la quincena" with hint "Un correo cada catorce días..." (optimistic, reverts on failure, error text) | toggle | `components/ReminderToggle/ReminderToggle.tsx` | `profile.reminderCheckIn`, `profile.reminderCheckInHint` | always |
| 102 | Push switch "Avisarme también en este dispositivo" with hint; or a note instead: blocked in browser settings / install to the iPhone home screen first / browser cannot receive notices | toggle | `components/PushToggle/PushToggle.tsx` | `profile.pushLabel`, `profile.pushHint`, `profile.pushBlocked`, `profile.pushInstallFirst`, `profile.pushUnsupported` | push is configured on the API; nothing drawn until the browser state is read |
| 103 | Language card h3 "Idioma", hint "Cambia la interfaz al momento y se guarda en tu perfil.", a group of two buttons "Español" / "English" (aria-pressed, busy while saving), error alert (the header carries a compact variant "ES"/"EN" in the shell inventory) | button | `components/LocaleSwitcher/LocaleSwitcher.tsx` | `profile.locale`, `profile.localeHint`; language names not dictionary | always |

### Section "Ayuda"

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 104 | Section heading "Ayuda" | heading | `perfil/page.tsx` | `profile.sectionHelp` | always |
| 105 | Replay-the-tour button (the tour dialog itself belongs to the shell inventory) | button | `components/Tour/Tour.tsx` (replay mode) | shell inventory (`tour.*`) | always |
| 106 | Feedback card: h3 "¿Qué mejorarías?", intro, hidden legend "¿De qué se trata?" with radio pills "Una idea" (default) / "Algo falla" / "Otra cosa", label "Tu mensaje" with textarea (placeholder "Escribe aquí…", max 2000), "Enviar" button (disabled when empty), thanks status "Recibido. Gracias por tomarte el rato.", error alert | field | `components/FeedbackForm/FeedbackForm.tsx` | `feedback.title`, `.intro`, `.kindsLabel`, `.kinds.idea/.problem/.other`, `.messageLabel`, `.placeholder`, `.send`, `.thanks` | always |

### Section "Zona peligrosa"

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 107 | Section heading "Zona peligrosa" | heading | `perfil/page.tsx` | `profile.sectionDanger` | always |
| 108 | Card h3 "Borrar mi cuenta" with body "Se elimina todo: perfil, objetivos, restricciones, planes, progreso y conversaciones. No se puede deshacer." | heading | same | `profile.dangerTitle`, `profile.deleteAllBody` | always |
| 109 | "Borrar mi cuenta" secondary button (opens the confirmation) | button | `components/DeleteAccount/DeleteAccount.tsx` | `profile.dangerTitle` | not confirming |
| 110 | Confirmation: error alert, prompt "Escribe BORRAR para confirmar.", field "Escribe BORRAR" (autocomplete off), destructive "Borrar definitivamente" (disabled until the word matches; "Borrando…"), "Cancelar". On success the offline copies and push registration on the device are cleared and the person goes to `/` | dialog | same | `profile.deletePrompt`, `profile.deleteTypeLabel`, `profile.deleteWord`, `profile.deleteConfirm`, `profile.deletePending`, `common.cancel`, API message | confirming |
| 111 | Sign-in-again variant (session not fresh): alert "Por seguridad, para borrar tu cuenta tienes que haber iniciado sesión hoy...", button "Cerrar sesión y volver a entrar" (focus), "Cancelar" | notice | same | `profile.deleteSignInAgainBody`, `profile.deleteSignInAgain`, `common.cancel` | the delete is refused as not fresh |

## /plan  (`apps/web/src/app/(app)/plan/page.tsx`)

Browser-tab title: `pages['/plan'].title` in the dictionary (set by `appMetadata`).
OB-guard. Three bodies: an active plan (the browser), nothing active but a scheduled plan, nothing at all. A pending-review notice from the dietitian can sit above any of them (stored per device).

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Pending-review notice (role="status", bold title, not a heading here) "Tu plan nuevo está con tu dietista" + body "Tu dietista lo está revisando antes de publicarlo. Aquí sigue tu plan anterior..." | notice | `components/PlanPendingNotice/PlanPendingNotice.tsx` | `plan.pendingReviewTitle`, `plan.pendingReviewBody` | a pending-review mark is stored for the current plan |
| 2 | "Tu próximo plan empieza el {date} →" small tertiary link to `/plan/proximo` | link | `app/(app)/plan/page.tsx` | `plan.scheduledLink` | active plan and a scheduled plan exist |
| 3 | Pantry result sentence: "Aprovechamos lo que tenías en casa en {count} productos de tu lista de la compra, que ya vienen marcados como comprados." / "...en 1 producto..." / "Nada de lo que nos dijiste que tenías en casa cubrió un producto..." | text | `components/PantryResult/PantryResult.tsx` | `pantry.measured`, `pantry.measuredOne`, `pantry.measuredNone` | active plan carries a pantry result (nothing when the cupboard was not used) |
| 4 | Plan browser (rows 8 to 24 below) | list | `components/PlanBrowser/PlanBrowser.tsx` | see below | active plan exists |
| 5 | Scheduled-only card "Tu plan empieza el {date}" + body "Todavía no es su primer día..." + large link "Ver sus días" to `/plan/proximo` | notice | `components/EmptyState/EmptyState.tsx` | `plan.scheduledTitle`, `plan.scheduledBody`, `plan.scheduledCta` | no active plan, a scheduled plan exists |
| 6 | Empty card "Todavía no tienes plan" + body + large link "Crear mi plan" to `/plan/generando` | notice | `EmptyState` | `plan.emptyTitle`, `plan.emptyBody`, `plan.createCta` | no active and no scheduled plan |

### Plan browser (used by /plan, /plan/proximo and /plan/historial/[id])

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 7 | Back link "← Todos tus planes" to `/plan/historial` | link | `components/PlanBrowser/PlanBrowser.tsx` | `plan.historyBack` | history view (`/plan/historial/[id]`) |
| 8 | Back link "← Tu plan actual" to `/plan` | link | same | `plan.upcomingBack` | upcoming view (`/plan/proximo`) |
| 9 | Page heading h1: "Tu plan" / "Plan anterior" / "Tu próximo plan" | heading | same | `plan.title`, `plan.historyOne`, `plan.upcomingTitle` | always |
| 10 | Range line "14 días · del {start} al {end}" (+ " · Terminado" or " · Sustituido" in history) | text | same | `plan.range`, `plan.historyFinished`, `plan.historyReplaced` | always |
| 11 | "Planes anteriores →" link to `/plan/historial` | link | same | `plan.historyLink` | current view only (not history, not upcoming) |
| 12 | Redo block: large-ish link "Rehacer el plan" to `/plan/generando` with "Puedes rehacer este plan una vez esta quincena: recetas nuevas para los mismos días." ; or, when spent, "Ya has rehecho tu plan esta quincena. Podrás crear el siguiente el {date}." | link | same | `plan.redoCta`, `plan.redoAvailable`, `plan.redoSpent` | current view, redo standing of kind redo |
| 13 | Week toggle: two pressed-state buttons "Semana 1" / "Semana 2" | button | `components/PlanDayNav/PlanDayNav.tsx` | `plan.week` | always |
| 14 | Day group (label "Días del plan"): one button per day of the chosen week showing the day number, weekday and date; current selection `aria-current`; today highlighted | list | same | `plan.daysLabel` | always |
| 15 | Day card heading "Día {index}" with long date and " · hoy" | heading | `PlanBrowser.tsx` | `plan.day`, `plan.dayIsToday` | always |
| 16 | "Comiendo para: {name}" tag with direction arrows per changed macro (más/menos + Hidratos/Proteína/Grasa ↑ ↓) | status | `PlanBrowser.tsx` + `components/MacroShift/MacroShift.tsx` | `plan.loadedFor`, `events.more`, `events.less`, `events.carbs`, `events.protein`, `events.fat` | the day is an event-loaded day |
| 17 | Day macro summary (four figures + note "Valores orientativos...") | figure | `components/MacroSummary/MacroSummary.tsx` | `macros.*`, `units.*` | always |
| 18 | Meal rows of the day (same control set as `/inicio` rows 14-15: tick button "Marcar como hecha" (one name since phase 9, the state in aria-pressed; was "Marcar como hecha" / "Quitar la marca de hecha"), slot, name, "+ side" phrases, badges "Hecha"/"Saltada", kcal and protein, recipe link, "Ingredientes" disclosure). In history and upcoming views the tick is a static non-interactive mark; in the upcoming view no tick is drawn | list | `components/MealRow/MealRow.tsx` | `meal.markDone`, `meal.unmarkDone`, `slots.*`, `meal.accompanimentNames.*`, `meal.badgeDone`, `meal.badgeSkipped`, `meal.ingredients` | each meal of the day |
| 19 | Events card (premium, plan under way only): h2 "Eventos" (focus target) with the mid-plan intro "Una carrera que no estaba cuando se creó el plan..." | heading | `components/EventPlanner/EventPlanner.tsx` | `events.title`, `events.midPlanIntro` | premium tier with a mid-plan allowance, current view |
| 20 | Event list rows: "{name} · {date}", "El día previo" / "Los {count} días previos" plus per-macro arrows and "ya está comiendo para esto", small "Quitar" button (aria-label "Quitar {name} del {date}") | list | same | `events.daysBeforeOne`, `events.daysBeforeMany`, `events.loading`, `events.cancel`, `events.cancelFor` | at least one event |
| 21 | Capacity line ("Te quedan {remaining} de {limit} eventos..." / "Puedes añadir {remaining} eventos más con el plan en marcha." / full: "Este plan ya no admite más eventos en marcha...") ; when full the form is replaced by this status | status | same | `events.midPlanLeft`, `events.midPlanLeftOne`, `events.midPlanFull` | allowance known |
| 22 | Add-event form: text "Qué es" (placeholder "Media maratón, partido, Hyrox…", max 60), date "Cuándo" (min today), select "Días antes" (1, 2 or 3 days), group "Qué cambia en los días de antes" with three selects Hidratos / Proteína / Grasa each Igual / Subir / Bajar, note "Al menos uno tiene que subir o bajar." and the "Añadir" submit (disabled until name, date and a change are set) | field | same | `events.name`, `events.namePlaceholder`, `events.on`, `events.daysBefore`, `events.shapeLabel`, `events.carbs`, `events.protein`, `events.fat`, `events.same`, `events.up`, `events.down`, `events.nothingMoves`, `events.add` | not at capacity |
| 23 | Outcome status "Añadido. Los días de antes ya se han rehecho para comer para ello." / "Evento quitado." | status | same | `events.addedMidPlan`, `events.removed` | after an action |
| 24 | Event error (role="alert") | notice | same | API error message | failed |

## /plan/proximo  (`apps/web/src/app/(app)/plan/proximo/page.tsx`)

Browser-tab title: `pages['/plan/proximo'].title` in the dictionary (set by `appMetadata`).
OB-guard. With no scheduled plan it redirects to `/plan`. The plan browser in its upcoming mode.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Plan browser with `upcoming` set: rows 8-11, 13-18 of the browser table above (back link to `/plan`, heading "Tu próximo plan", range, week toggle, day navigation, day card, macros, meal rows without any tick, ingredients disclosures). No redo block, no events card, no "Planes anteriores" link | list | `components/PlanBrowser/PlanBrowser.tsx` | see browser table | always |

## /plan/historial  (`apps/web/src/app/(app)/plan/historial/page.tsx`)

Browser-tab title: `pages['/plan/historial'].title` in the dictionary (set by `appMetadata`).
OB-guard. Lists plans that were lived (statuses in `LIVED_PLAN_STATUSES`).

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Empty card "Tus planes" with body "Aquí irán quedando tus planes anteriores, tal como fueron." and large link "Tu plan" to `/plan` | notice | `components/EmptyState/EmptyState.tsx` | `plan.historyTitle`, `plan.historyEmpty`, `plan.title` | no lived plans |
| 2 | Page heading "Tus planes" and intro (normal text, or the locked variant "Tu plan de ahora es tuyo siempre. Las quincenas que ya terminaste se guardan enteras, y premium es lo que las abre.") | heading | `app/(app)/plan/historial/page.tsx` | `plan.historyTitle`, `plan.historyIntro`, `plan.historyLockedIntro` | lived plans exist; locked variant when any is locked |
| 3 | Ordered list of plan cards. An open card is a link (active plan goes to `/plan`, others to `/plan/historial/{id}`) showing "14 días · del {start} al {end}", "Plan {version}" and a chip "Actual" / "Sustituido" / "Terminado" | list | same | `plan.range`, `plan.historyPlan`, `plan.historyCurrent`, `plan.historyReplaced`, `plan.historyFinished` | unlocked plans |
| 4 | Locked card (not a link): range, "Plan {version}" and a lock chip "Premium" | list | same + `components/PremiumChip/PremiumChip.tsx` | `plan.historyLockedChip` | free tier plan that is locked |
| 5 | "Ver premium" link to `/perfil` | link | same | `plan.historyLockedCta` | any plan is locked |

## /plan/historial/[id]  (`apps/web/src/app/(app)/plan/historial/[id]/page.tsx`)

Browser-tab title: `pages['/plan/historial/[id]'].title` in the dictionary (set by `appMetadata`).
OB-guard. An unknown or not-owned plan is a 404; an active plan redirects to `/plan`; a locked plan (free tier, finished fortnight, `PREMIUM_ONLY`) shows an upsell instead.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Locked card "Esta quincena la abre premium" with body "Esta quincena ya terminó y se guarda completa..." | notice | `components/EmptyState/EmptyState.tsx` | `plan.lockedTitle`, `plan.lockedBody` | answer code PREMIUM_ONLY |
| 2 | Large links "Ver premium" (to `/perfil`) and "Tu plan" (to `/plan`, secondary) | link | same page | `plan.historyLockedCta`, `plan.title` | same |
| 3 | Plan browser with `history` set: back link "← Todos tus planes", heading "Plan anterior", range with " · Terminado/Sustituido", week toggle, day navigation, day card, macros, read-only meal rows (static ticks, badges Hecha/Saltada, ingredients disclosures). No redo block, no events card | list | `components/PlanBrowser/PlanBrowser.tsx` | see `/plan` browser table | plan available |

## /plan/generando  (`apps/web/src/app/(app)/plan/generando/page.tsx`)

Browser-tab title: `pages['/plan/generando'].title` in the dictionary (set by `appMetadata`).
OB-guard. One client component with four screens in sequence: ready, running, failed, could-not-start. It is where "Crear mi plan", "Rehacer el plan" and "Crear mi próximo plan" lead. Loads events, allowances (start-date options, event allowance, meal-size note), pantry (cupboard) and profile (meal shape).

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Ready: heading "Tu plan de dos semanas" and body "Lo creamos con lo que ya sabemos de ti. Antes de empezar, repasa los días que comerán distinto..." | heading | `components/GenerationProgress/GenerationProgress.tsx` | `generation.readyTitle`, `generation.readyBody` | before the job starts |
| 2 | Events card (generation variant): h2 "Días que comen distinto", intro "Una carrera, un partido, una sesión larga: si cae en estas dos semanas, añádelo ahora...", event list, capacity line, add form and statuses (same fields as `/plan` rows 20-24 but with the now copy and a secondary "Añadir" button); at capacity the form is replaced by "Has puesto los {limit} eventos que caben en un plan. Quita uno para añadir otro." | field | `components/EventPlanner/EventPlanner.tsx` | `events.nowTitle`, `events.nowIntro`, `events.left`, `events.leftOne`, `events.full`, `events.addedNow`, plus the `events.*` keys of `/plan` rows 20-24 | ready screen |
| 3 | Start-date chooser: fieldset "¿Cuándo empieza tu plan?" with chips for each option: "Hoy, {date}", "Mañana, {date}", then later dates; each chip carries "Gratis", "Usa un rehacer" or "Sin rehaceres" and is unavailable (aria-disabled) when not allowed | field | `components/StartDatePicker/StartDatePicker.tsx` + `components/ChipGroup/ChipGroup.tsx` | `generation.startDate.legend`, `.today`, `.tomorrow`, `.free`, `.usesRedo`, `.noRedo` | ready screen and options exist |
| 4 | Start-date live note "Tu plan empieza el {date}." (+ "Cuenta como un rehacer: los días de tu plan que coincidan con el nuevo se sustituyen.") and spent note "Ya has usado tu rehacer de este plan. Puedes elegir un día a partir del {date}." | status | same | `generation.startDate.chosen`, `.redoNote`, `.spentNote` | an option chosen / a redo is spent |
| 5 | Cupboard card (pantry picker): h2 "Lo que ya tienes en casa", intro, "keeps" sentence ("Esto no cambia lo que evitamos...") | heading | `components/PantryPicker/PantryPicker.tsx` | `pantry.title`, `pantry.intro`, `pantry.keeps` | cupboard data loaded |
| 6 | "En tu lista" subheading and rows: item label (+ grams), note "Todavía no cocinamos nada con esto", small "Quitar" button (aria-label "Quitar {name}") | list | same | `pantry.entries`, `pantry.notCooked`, `pantry.remove`, `pantry.removeFor`, `units.gram` | at least one item |
| 7 | Bound line "{count} de {max} en tu lista." / "Tu lista está llena, con {max} alimentos. Quita uno para poder añadir otro." | text | same | `pantry.bound`, `pantry.boundFull` | always on the card |
| 8 | Search field "Buscar en nuestra lista de alimentos" and amount field "Cantidad en gramos (opcional)" (hint, error "Escribe una cantidad mayor que cero, o déjala en blanco.") | field | same | `pantry.search`, `pantry.amount`, `pantry.amountHint`, `pantry.amountInvalid` | list not full |
| 9 | Search status "Buscando…" / "No encontramos ese alimento en nuestra lista." ; hidden live count "{count} alimentos de nuestra lista."; search error alert | status | same | `pantry.searching`, `pantry.noResults`, `pantry.resultsFound`, API message | list not full |
| 10 | Result list (label "Alimentos de nuestra lista"): food name with "Añadir" small button (aria-label "Añadir {name}") or the text "Añadido" when already in the list; "Ver {count} alimentos más" tertiary button after the first eight | list | same | `pantry.resultsList`, `pantry.add`, `pantry.addFor`, `pantry.added`, `pantry.showMore` | results exist |
| 11 | Announcer (hidden role="status") "{name} está en tu lista." / "{name} ya no está en tu lista." followed by the bound; pantry error alert | status | same | `pantry.addedStatus`, `pantry.removedStatus`, API message | after actions |
| 12 | Meal-size note (title "Tus comidas serán grandes", body with count and kcal and the suggestion text) | notice | `components/MealSizeNote/MealSizeNote.tsx` | `mealSize.title`, `mealSize.body`, `mealSize.suggestions.*.body` | largest main meal is large and the "keep" answer not yet remembered |
| 13 | Primary action when the size question is open: "Seguir así" (aria-label "Seguir así y generar mi plan"; remembers the answer and starts), and link to `/onboarding/4?volver=generando` labelled by the suggestion (Añadir un desayuno / Añadir una merienda / Cambiar la {slot}) | button | `GenerationProgress.tsx` | `mealSize.keep`, `mealSize.keepName`, `mealSize.suggestions.*.action` | meal-size note shown |
| 14 | Primary action otherwise: large "Generar mi plan" button | button | same | `generation.start` | no size question |
| 15 | Large link back to `/inicio` ("Volver"), tertiary when the size question is shown | link | same | `generation.back` | ready screen |
| 16 | Running: heading "Estamos creando tu plan", body "Tarda un par de minutos. Puedes dejar esta página abierta.", polite step line (Revisando tu perfil / Eligiendo recetas / Repartiendo las comidas de los 14 días / Comprobando que todo encaja / Guardando tu plan / Preparando tu lista de la compra, or "Empezando…"), indeterminate bar, safety note "Comprobamos tus alergias antes de guardar nada." | status | same | `generation.title`, `generation.wait`, `generation.steps.LOADING_PROFILE/.CHOOSING_RECIPES/.SCHEDULING_MEALS/.VALIDATING_PLAN/.SAVING_PLAN/.BUILDING_LIST`, `generation.starting`, `generation.safetyNote` | job started |
| 17 | Failed: heading and alert body by error code (interrupted, AI provider failed, could not create, invalid plan, profile unfinished, not enough recipes, consent missing, profile incomplete, took too long, blocked for safety), optional "Detalle del servidor:" line, "Reintentar" button or "Completar mi perfil" link to `/onboarding` (when retry is pointless), "Volver" link | notice | same | `generation.abandonedTitle/.abandonedBody`, `.aiUnavailableTitle/.aiUnavailableBody`, `.failedTitle/.failedBody`, `.invalidPlanTitle/.invalidPlanBody`, `.onboardingIncompleteTitle/.onboardingIncompleteBody`, `.poolTooSmallTitle/.poolTooSmallBody`, `.profileConsentRequiredTitle/.profileConsentRequiredBody`, `.profileIncompleteTitle/.profileIncompleteBody`, `.timedOutTitle/.timedOutBody`, `.unsafeTitle/.unsafeBody`, `.serverDetail`, `common.retry`, `generation.completeProfile`, `generation.back` | job failed |
| 18 | Could-not-start: heading "No hemos podido empezar", alert (quota: "Ya has rehecho tu plan esta quincena. Podrás crear el siguiente el {date}.", rate limited "Has pedido varios planes seguidos...", or API message), "Reintentar", "Volver" | notice | same | `generation.couldNotStart`, `generation.quotaExceeded`, `generation.rateLimited`, `common.retry`, `generation.back` | start request refused |
| 19 | On success: premium plans waiting for review go to `/inicio` with a stored mark; otherwise `/plan` | status | same | not dictionary | job succeeded |

## /plan/comida/[id]  (`apps/web/src/app/(app)/plan/comida/[id]/page.tsx`)

Browser-tab title: `pages['/plan/comida'].title` in the dictionary (set by `appMetadata`).
OB-guard. Unknown or not-owned meal is a 404. A locked (finished fortnight, free tier) meal shows an upsell instead. Editable only when the plan is active; a meal of an earlier plan is read-only.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Locked card "Esta quincena la abre premium" + body, large links "Ver premium" (`/perfil`) and "Tu plan" (`/plan`) | notice | `components/EmptyState/EmptyState.tsx` | `plan.lockedTitle`, `plan.lockedBody`, `plan.historyLockedCta`, `plan.title` | answer code PREMIUM_ONLY |
| 2 | Back link: "← Volver al plan" to `/plan` (active plan) or "← Volver al plan anterior" to `/plan/historial/{planId}` | link | `app/(app)/plan/comida/[id]/page.tsx` | `meal.back`, `meal.backToHistory` | always |
| 3 | Slot line "{slot} · Día {day}" | text | same | `meal.dayOf`, `slots.*` | always |
| 4 | Dish name as h1, marked `data-ai-generated` | heading | same | dish name is data | always |
| 5 | Facts: "{minutes} min en total" or "Sin cocinar", difficulty (Fácil / Media / Difícil), cuisine | text | same | `meal.totalMinutes`, `meal.noCooking`, `meal.difficulty.easy/.medium/.hard` | always (cuisine if set) |
| 6 | Equipment list: label "Se cocina con" and the appliances with icons (the hob excluded) | list | `components/MealEquipment/MealEquipment.tsx` + `components/ApplianceIcon/ApplianceIcon.tsx` | `meal.equipment`, `kitchen.appliances.*` | the dish needs an appliance other than the hob |
| 7 | While paused on a trip: "Tu plan está en pausa · se reanuda el {date}" in place of the controls | text | `plan/comida/[id]/page.tsx` | `vacations.pausedUntil` | editable plan and a trip under way |
| 8 | Future meal text "Podrás marcarla el {date}." | text | same | `meal.notYet` | editable, not away, meal date is after today |
| 9 | Status buttons "Hecha" and "Saltada" (aria-pressed toggles; pressing the active one goes back to planned) | button | `components/MealStatus/MealStatus.tsx` | `meal.done`, `meal.skipped` | editable, not away, date reached |
| 10 | Change-this-dish control: button "Cambiar plato" with the "{remaining} de {limit}" count (or "Cambios agotados" disabled), panel with legend "¿Qué buscas en el nuevo plato?", radios Lo que encaje / Más rápido ("Menos de {minutes} min en total...") / Sin cocinar / Más proteína / Sin carne ni pescado each with a hint, "Cambiar" ("Buscando otro plato…"), "Cancelar", footer line "Te quedan {remaining} de {limit} cambios en este plan; la lista de la compra se actualiza sola." / "Te queda 1 cambio..." / "Has usado los {limit} cambios de este plan.", alert for "no fit" or API errors | menu | `components/MealSwap/MealSwap.tsx` | `meal.swap`, `meal.swapCount`, `meal.swapSpentShort`, `meal.swapAxisLabel`, `meal.swapAxisAny`, `.swapAxisAnyHint`, `.swapAxisQuicker`, `.swapAxisQuickerHint`, `.swapAxisNoCooking`, `.swapAxisNoCookingHint`, `.swapAxisMoreProtein`, `.swapAxisMoreProteinHint`, `.swapAxisVegetarian`, `.swapAxisVegetarianHint`, `meal.swapConfirm`, `meal.swapping`, `common.cancel`, `meal.swapHint`, `meal.swapHintOne`, `meal.swapSpent`, `meal.swapNoFit`, `meal.swapNoFitAxis` | editable, not away, meal still planned, allowances loaded |
| 11 | Read-only note "Este plato es de un plan anterior y se muestra tal como fue." | text | `plan/comida/[id]/page.tsx` | `meal.readOnly` | plan is not active |
| 12 | Dish picture figure: hero image 4:3 with the "IA" mark (hidden label "Imagen generada por IA"), alt "Imagen de {name} generada por IA", caption "Imagen generada por IA. Es orientativa: manda la lista de ingredientes."; while being drawn the figure is hidden and the picture appears when ready (polled); plate fallback if it fails | picture | `components/MealPicture/MealPicture.tsx` + `components/DishPicture/DishPicture.tsx` | `meal.pictureOf`, `meal.pictureCaption`, `picture.aiMark`, `picture.aiMarkLabel` | picture status is not "none" |
| 13 | Spec list: Preparación ("{value} min"), Cocción ("{value} min" or "—"), Raciones, Dificultad | figure | `plan/comida/[id]/page.tsx` | `meal.prep`, `meal.cook`, `meal.minutes`, `meal.none`, `meal.servingsLabel`, `meal.difficultyLabel` | always |
| 14 | Meal macro summary with the orientation note | figure | `components/MacroSummary/MacroSummary.tsx` | `macros.*`, `macros.note` | always |
| 15 | Ingredients section: h2 "Ingredientes", serving note "Cantidades para {servings} ración/raciones.", list of name and quantity; dry grains as "{name}: {dry} en seco ({cooked} cocido)"; alternatives line "Si no lo encuentras: {name} ({quantity}) · ..." | list | `plan/comida/[id]/page.tsx` | `meal.ingredients`, `meal.servingNote`, `meal.servingUnitOne`, `meal.servingUnitOther`, `meal.dryLine`, `meal.cookedNote`, `meal.alternatives` | always (alternatives where they exist) |
| 16 | Accompaniments section: h2 "Acompaña con", share sentence "Entre todo, aportan {kcal} kcal: el {percent} % de esta comida.", one entry per side: heading (phrase such as "Pan (60 g)"), "+{kcal} kcal" (with weight when needed), ingredient rows (hidden for a single-food side), preparation text | list | `components/MealAccompaniments/MealAccompaniments.tsx` | `meal.accompanimentsTitle`, `meal.accompanimentsShare`, `meal.accompanimentAdds`, `meal.accompanimentNames.*`, `meal.dryLine`, `meal.cookedNote` | the meal has sides |
| 17 | Method section: h2 "Preparación" and ordered list of steps, each with optional cue and "{value} min", marked `data-ai-generated` | list | `plan/comida/[id]/page.tsx` | `meal.steps`, `meal.minutes` | the dish has steps |
| 18 | Verdict section: h2 "¿Qué te ha parecido?"; buttons "Me gusta" and "No me gusta" (aria-pressed toggles) and a hint ("Lo tendremos en cuenta en tus próximos planes." / "Anotado: podrá volver, y buscaremos platos en esta línea." / "Anotado: no volverá, ni nada muy parecido.") | button | `components/RecipeVerdict/RecipeVerdict.tsx` | `meal.verdictTitle`, `meal.like`, `meal.dislike`, `meal.verdictHint`, `meal.likedHint`, `meal.dislikedHint` | always; the buttons are omitted while away on a trip |

## /progreso  (`apps/web/src/app/(app)/progreso/page.tsx`)

Browser-tab title: `pages['/progreso'].title` in the dictionary (set by `appMetadata`).
OB-guard. Weight and fortnight history in one place.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Unavailable card (title "Tu progreso", body "No hemos podido cargar tu progreso. Prueba de nuevo en un momento.") + large link "Ir a inicio" | notice | `components/EmptyState/EmptyState.tsx` | `progress.title`, `progress.unavailable`, `progress.emptyCta` | the summary could not be read |
| 2 | Empty card "Todavía no hay nada que medir" + body + "Ir a inicio" | notice | same | `progress.emptyTitle`, `progress.emptyBody`, `progress.emptyCta` | no fortnights and no weights |
| 3 | Page heading "Tu progreso" and intro | heading | `progreso/page.tsx` | `progress.title`, `progress.intro` | data exists |
| 4 | Four tiles: "Último peso" ({kg} kg), "Desde el inicio" (signed change kg, "Sin cambios" or "—"), "Última quincena" (same), "Hasta el objetivo" ({kg} kg por perder / por ganar, "conseguido" or "—") | figure | same | `progress.weightLatest`, `.sinceStart`, `.lastFortnight`, `.toTarget`, `.noChange`, `.noData`, `.toLose`, `.toGain`, `.reached`, `units.kilogram` | data exists |
| 5 | Weight card: h2 "Tu peso", "Empezaste en {value} kg", link "Anotar el peso de hoy →" to `/inicio` | heading | same | `progress.weightTitle`, `progress.weightStart`, `progress.logLink` | data exists |
| 6 | Weight chart (y-axis max/min, x-axis first/last date, target dashed line, dots; hidden trend sentence "De {from} kg el {fromDate} a {to} kg el {toDate}."; "Objetivo {value} kg"; "Con dos pesos anotados aparece la línea." with fewer than two) | chart | `components/WeightChart/WeightChart.tsx` | `progress.chartSummary`, `progress.weightTarget`, `progress.chartEmpty` | a weight has been logged |
| 7 | "Aún no has anotado ningún peso." | text | `progreso/page.tsx` | `progress.weightNone` | no weight |
| 8 | Fortnights section: h2 "Tus quincenas", overall line "{eaten} comidas hechas de {marked} que marcaste" or "Marca las comidas como hechas o saltadas y aquí verás cuánto del plan sigues." and link "Todos tus planes →" to `/plan/historial` | heading | same | `progress.fortnightsTitle`, `progress.overallLine`, `progress.overallNone`, `progress.allPlans` | data exists |
| 9 | Fortnight cards (ordered list): range heading "{from} – {to}", "Plan {version}", status chip (En curso / Archivada / Terminada / Rehecha), adherence percent or "—" with caption "de las que marcaste, hechas" / "Sin comidas marcadas", bar, line "{eaten} hechas · {skipped} saltadas · {unmarked} sin marcar, de {soFar} hasta hoy" | list | `components/FortnightList/FortnightList.tsx` | `progress.fortnightRange`, `progress.planNumber`, `progress.statusActive`, `.statusArchived`, `.statusCompleted`, `.statusReplaced`, `progress.noData`, `progress.adherenceLabel`, `progress.adherenceNone`, `progress.mealsLine` | at least one fortnight |
| 10 | Check-in answers per fortnight: "Satisfacción {value} de 5", hunger (Te quedaste con hambre / Cantidades justas / Demasiada comida), difficulty (Fácil / Se pudo seguir / Difícil de seguir), "Pesabas {value} kg" | list | same | `progress.satisfaction`, `progress.hungerHungry/.hungerRight/.hungerTooMuch`, `progress.difficultyEasy/.difficultyOk/.difficultyHard`, `progress.checkInWeight` | fortnight has a check-in |
| 11 | Open link "Ver el plan →" (`/plan` for the active plan, otherwise `/plan/historial/{id}`) | link | same | `progress.openPlan` | fortnight not locked |
| 12 | Locked row: lock chip "El plan, con premium" and link "Qué es premium →" to `/perfil` | link | same + `PremiumChip.tsx` | `progress.openPlanLocked`, `progress.openPremium` | fortnight locked (free tier, finished) |
| 13 | No-fortnights text (when only weights exist) | text | `progreso/page.tsx` | `progress.emptyBody` | weights exist but no fortnights |

## Not sure

- `assistant.intro`, `assistant.fieldHint`, `assistant.back`, `assistant.updated`, `assistant.conversationsEmptyTitle` exist in the dictionary but no component read for `/asistente` renders them; they may be dead keys or used by a file outside this slice. The redesign need not reproduce them, but a check should confirm they are unused.
- `AppNav`, the header, `OfflineCopy`, `Tour` (dialog contents and the replay button's label), toasts and the footer were left to the shell inventory; only their placement is named here.
- Several rows say a control exists "when the API says so" (billing available, push configured, assistant switch on, professional flag, premium tier, locked plans). Which accounts and states reach each branch depends on server data and on switches in `app_settings`; the code was read, not run, so the exact trigger values (for example the `LIVED_PLAN_STATUSES` set, `Period` options) were not enumerated.
- `PlanPendingNotice` depends on a per-device mark (`lib/pendingReview`); the exact wording lifecycle (when the mark is cleared) was not traced.
- The offline behaviour of each screen (`OfflineProvider.available(path)`, stored copies) was only noted where a component reads it (MealRow, ShoppingActions); which routes are stored for offline use was not traced.
- The `health.consentLabel` string in the Spanish dictionary reads "Guardad estos datos de salud para personalizar mis planes" (a plural imperative, apparently a typo); it is listed as-is, not corrected.
- The `Select`, `Switch`, `Checkbox`, `Dialog` and `Collapsible` primitives in `packages/ui` add their own accessible parts (indicator glyphs, thumb, focus rules); only their visible words were recorded. `ChipGroup` and `OptionCards` render real radio and checkbox inputs, which a mechanical baseline will see, but their styling states (checked, aria-disabled) are not enumerated.
- `components/Reveal`, `components/DishPicture`'s IA mark and the `Skeleton` loading shell are described by what they draw; the motion rules (`motion-enter`, `motion-list`, `motion-forward/back`) are not user-facing controls and are not listed per route.
- Dictionary values for the long legal-adjacent blocks (`practiceAgreement.sections`, `practiceAgreement.terms.sections`, `assistant.warning`, `profileConsent.body/.ai`) are referenced by key path rather than reproduced; the redesign must keep every paragraph and list item of them.
- Accounts of kind admin reach `/admin` screens only, which are outside this slice; `/consulta` second-factor and agreement screens are professional-only and were inventoried from the code rather than from a probe account.
