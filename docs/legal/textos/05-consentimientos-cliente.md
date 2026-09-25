# Consentimientos del cliente

> **No soy abogado.** Borrador para el producto.
>
> **Propósito**: los textos que el usuario lee al dar un consentimiento — el de salud del
> perfil (nuevo), el de compartir con su dietista (revisado) — y el fin del enlace.
> **Audiencia**: `frontend` (diccionarios), `backend` (almacenamiento y versión), el
> abogado. **Committed**: sí. **Mantenido por**: el agente `legal`.
>
> **Versiones que hay que subir**:
> - `CARE_CONSENT_VERSION` (`packages/core/src/entities/Care/Care.ts:12`) de `1.0.0` a
>   **`2.0.0`**: cambian la lista, la frase de la salud y lo que el profesional puede
>   hacer. Un enlace aceptado con `1.0.0` **sigue siendo válido** para lo que ya decía
>   (ver), pero no cubría que el profesional *escriba* ni *retenga* planes. Por eso
>   **antes de encender el flag** no debe haber enlaces reales con `1.0.0`; si los hubiera
>   (pruebas del propietario), se terminan y se vuelve a invitar.
> - `HEALTH_CONSENT_VERSION` (`packages/core/src/entities/Health/Health.ts:43`) de `1.0.0` a
>   **`1.1.0`**, solo por la precisión de `health.consentNote` (§ C). El mecanismo existente
>   (`health.consentStale`) vuelve a pedirlo.
> - **Nueva**: el consentimiento explícito del perfil (§ A), con su propia constante, p. ej.
>   `PROFILE_HEALTH_CONSENT_VERSION = '1.0.0'` junto a `HEALTH_CONSENT_VERSION`.

---

## A. Consentimiento explícito del perfil (nuevo — P0-2)

**Dónde**: onboarding, en el paso de alergias (el primero que recoge un dato de salud), y
una sola vez a las cuentas ya existentes en su próximo acceso (pantalla intermedia antes de
`/inicio`). Namespace nuevo `profileConsent`.

**Comportamiento**: casilla sin marcar; sin ella no se guardan alergias, intolerancias,
peso, altura, objetivo ni forma de comer, y no se genera ningún plan (el mismo 409 que un
perfil incompleto, con su propio código). Se guarda versión y fecha. Retirarla desde el
perfil borra esos datos, en una transacción, como ya hace `health.withdraw`, y el producto
vuelve al paso del onboarding.

| Clave | es-ES | en-GB |
| --- | --- | --- |
| `profileConsent.title` | `Antes de seguir: tus datos de salud` | `Before you go on: your health data` |
| `profileConsent.body` | `Para hacerte un plan seguro necesitamos datos que dicen algo de tu salud: tus alergias e intolerancias, tu peso, tu altura y tu objetivo, y tu forma de comer, que a veces revela una intolerancia o una creencia. Los usamos solo para calcular tus objetivos y elegir tus platos.` | `To build you a safe plan we need data that says something about your health: your allergies and intolerances, your weight, height and goal, and how you eat, which sometimes reveals an intolerance or a belief. We use them only to work out your targets and choose your dishes.` |
| `profileConsent.ai` | `Un modelo de inteligencia artificial diseña los platos. Recibe tus objetivos, tu forma de comer y lo que no te gusta, sin tu nombre ni tu correo; nunca tus enfermedades ni tu medicación. Nuestro código comprueba cada plato contra tus alergias antes de que te llegue.` | `An artificial-intelligence model designs the dishes. It receives your targets, how you eat and what you dislike, without your name or email; never your conditions or medication. Our code checks every dish against your allergies before it reaches you.` |
| `profileConsent.label` (la casilla) | `Consiento que NutrIA use estos datos de salud para hacer mis planes` | `I consent to NutrIA using this health data to make my plans` |
| `profileConsent.note` | `Sin este consentimiento no podemos hacerte un plan. Puedes retirarlo cuando quieras desde tu perfil: se borran esos datos. Más en la {privacy}.` | `Without this consent we cannot make you a plan. You can withdraw it at any time from your profile: that data is then deleted. More in the {privacy}.` |
| `profileConsent.continue` | `Continuar` | `Continue` |
| `profile.profileConsentWithdraw` | `Retirar el consentimiento y borrar estos datos` | `Withdraw consent and delete this data` |

<!-- Fuente: RGPD art. 9.2.a (explícito, «con uno o más de los fines especificados»), 7.1 (demostrar), 7.2 (separado de otros asuntos), 7.3 (retirar; informar antes de consentir), 7.4 y CEPD 05/2020 apdos. 26-36 (condicionar solo lo necesario); 13.1.c y e. La frase de la IA solo es exacta con P0-3 resuelto (sin texto libre de alergias; si se sigue enviando, añadir «y las alergias que escribas a mano y no reconozcamos»). -->

---

## B. La invitación y su página (revisados — P0-1, P1-3)

**Dónde**: `/invitacion/[token]`, componente `apps/web/src/components/CareInvitation`,
namespace `care`. Orden de lectura como hoy (LEGAL-REVIEW § A1), con estos cambios.

### B1. Cabecera y lista

| Clave | Hoy | es-ES nuevo | en-GB nuevo |
| --- | --- | --- | --- |
| `care.invitationIntro` | `{professional} te invita a compartir tu seguimiento con NutrIA para acompañarte.` | `{professional}, dietista-nutricionista con número de colegiado {collegiateNumber}, te invita a llevar tu plan con su ayuda en NutrIA.` | `{professional}, a registered dietitian-nutritionist (registration number {collegiateNumber}), invites you to follow your plan with their help on NutrIA.` |
| `care.invitationShareIntro` | `Si aceptas, {professional} podrá ver:` | `Si aceptas, {professional} verá:` | `If you accept, {professional} will see:` |
| `care.shares.profile` | `tu perfil` | `tu nombre` | `your name` |
| `care.shares.targets` | `tus objetivos` | `tus objetivos diarios y cómo se calcularon` | `your daily targets and how they were worked out` |
| `care.shares.mealPlans` | `tus planes de comida` | `tu plan de comidas y los anteriores` | `your meal plan and earlier ones` |
| `care.shares.progress` | `tu progreso` | `cuánto sigues cada quincena y tu peso a lo largo del tiempo` | `how much of each fortnight you follow and your weight over time` |
| `care.shares.checkIns` | `tus check-ins` | `tus respuestas a los check-ins (no tus comentarios escritos)` | `your check-in answers (not your written comments)` |
| `care.invitationCanDoIntro` (nueva) | — | `Y podrá:` | `And they will be able to:` |
| `care.canDo.targets` (nueva) | — | `fijar tus objetivos diarios, dentro de los mismos límites de seguridad` | `set your daily targets, within the same safety bounds` |
| `care.canDo.plans` (nueva) | — | `generar y cambiar tus planes` | `generate and change your plans` |
| `care.canDo.review` (nueva) | — | `revisar cada plan nuevo antes de que lo veas; mientras lo revisa, sigues con el que tenías` | `review each new plan before you see it; while they do, you carry on with the one you had` |
| `care.invitationNotShared` (nueva) | — | `No verá tus alergias, tus intolerancias ni tu correo.` | `They will not see your allergies, your intolerances or your email address.` |
| `care.invitationTrail` (nueva) | — | `Cada vez que mire o cambie algo, lo verás en tu perfil.` | `Every time they look at or change something, you will see it on your profile.` |

Mostrar el número de colegiado requiere que `CareInvitationDetailView`
(`CareController.ts:96-103`) lo devuelva; si `backend` prefiere no hacerlo, quitar
`, con número de colegiado {collegiateNumber},` y la cláusula inglesa equivalente.

<!-- Fuente: lo que devuelve CareClientOverviewView (CareController.ts:193-200) y lo que permiten las rutas de CareClients.controller.ts; 0060 (review on by default). RGPD art. 4.11 (informado, específico), 7.2 (lenguaje claro), 13.1.e (destinatario). «tu perfil» era impreciso: el profesional no ve el perfil, ve el nombre y la derivación de los objetivos. -->

### B2. La línea de salud

| Clave | Hoy | es-ES nuevo | en-GB nuevo |
| --- | --- | --- | --- |
| `care.healthQuestion` | `Compartir también tu historial de salud` | `Compartir también mis condiciones de salud, mi medicación y mis suplementos` | `Also share my health conditions, medications and supplements` |
| `care.healthShareNote` | `Solo si lo marcas. Puedes dejarlo sin marcar y decidirlo más adelante desde tu perfil.` **(falso)** | `Es opcional y aparte. Puedes activarlo o dejar de compartirlo cuando quieras desde tu perfil, sin terminar el enlace.` | `It is optional and separate. You can turn it on or stop sharing it at any time from your profile, without ending the link.` |
| `care.healthShareIntro` | `Aparte de lo anterior, puedes compartir también:` | sin cambios | sin cambios |

**Si el control no se construye** (se desaconseja: ver P0-1), la única frase verdadera es:
`Es opcional y aparte. Si lo marcas, para dejar de compartirlo tendrás que terminar el enlace.` —
y aun así incumple el art. 7.3 en espíritu.

<!-- Fuente: RGPD art. 9.2.a, 7.3 («tan fácil retirar el consentimiento como darlo»); CareRepository.ts:165 (hoy solo se escribe al aceptar). -->

### B3. Antes del botón (nueva)

| Clave | es-ES | en-GB |
| --- | --- | --- |
| `care.invitationPrivacy` | `NutrIA te comunica estos datos a {professional} porque tú lo pides. Tu dietista los usa para atenderte, bajo su secreto profesional, y responde de lo que haga con ellos en su consulta. Puedes terminar el enlace cuando quieras. Más en la {privacy}.` | `NutrIA discloses this data to {professional} because you ask it to. Your dietitian uses it to care for you, under professional secrecy, and is responsible for what they do with it in their practice. You can end the link at any time. More in the {privacy}.` |
| `care.invitationAccept` | `Aceptar la invitación` (sin cambios) | `Accept the invitation` |

`{privacy}` enlaza a `/privacidad#tu-dietista` (ancla a la sección nueva).

<!-- Fuente: RGPD art. 13.1.a, c, e; 26.2 (aspectos esenciales del reparto, por si hubiera corresponsabilidad); analisis.md § 2. -->

---

## C. Consentimiento de salud existente — una precisión

**Clave**: `health.consentNote` (`es-ES.ts`, namespace `health`). Sube
`HEALTH_CONSENT_VERSION` a `1.1.0`.

| Hoy | es-ES nuevo | en-GB nuevo |
| --- | --- | --- |
| `Se guardan en tu cuenta, no se envían a ningún modelo de IA, no aparecen en los registros del servidor y se borran con tu cuenta. Puedes borrarlos por separado con el botón de abajo.` | `Se guardan en tu cuenta, no aparecen en los registros del servidor y se borran con tu cuenta. Nunca se envían a ningún modelo de IA: solo llega su efecto, como los ingredientes que quitamos por una celiaquía. Si trabajas con un dietista, solo los ve si se lo permites aparte. Puedes borrarlos por separado con el botón de abajo.` | `They are kept in your account, never appear in server logs and are deleted with your account. They are never sent to any AI model: only their effect is, such as the ingredients we remove for coeliac disease. If you work with a dietitian, they only see them if you allow it separately. You can delete them separately with the button below.` |

<!-- Fuente: 0008 (celiaquía → gluten), 0052 (proteína en polvo solo con suplemento proteico); RGPD art. 5.1.a (transparencia) y 13.1.e. -->

---

## D. Terminar el enlace

**Clave**: `care.endConfirmBody` (componente `CareLinkCard`).

| Hoy | es-ES nuevo | en-GB nuevo |
| --- | --- | --- |
| `Tu dietista dejará de ver tu perfil, tu plan y tu progreso. Puedes volver a aceptar una invitación suya más adelante.` | `Tu dietista dejará de ver tus datos desde ahora. Tus objetivos, tu historial y tu último plan publicado se quedan contigo, y el registro de sus accesos sigue en tu perfil. Lo que tu dietista ya anotara en su propia historia clínica lo conserva según su normativa. Puedes aceptar otra invitación suya más adelante.` | `Your dietitian will stop seeing your data from now on. Your targets, your history and your last published plan stay with you, and the record of their access stays on your profile. Anything your dietitian already noted in their own clinical record they keep under their own rules. You can accept another invitation from them later.` |

<!-- Fuente: 0059 (fin inmediato), PRD 004 Decisión 8, care.schema.ts:109-122 (el rastro es del cliente); Ley 41/2002 arts. 17.1 y 17.5 (el profesional conserva su documentación clínica). No sube versión: no es un texto de consentimiento. -->

---

## E. Aviso de supervisión para un cliente vinculado (P3)

`LEGAL-REVIEW.md` § A6 recuerda que el PRD (Decisión 11) quería cambiar
`profile.supervision` cuando hay un dietista vinculado, y no está construido. Propuesta:

| Clave nueva | es-ES | en-GB |
| --- | --- | --- |
| `profile.supervisionLinked` | `Tu dietista, {name}, puede revisar tu plan. Si tienes una condición de salud o tomas medicación, háblalo con tu dietista o con tu médico: NutrIA no adapta el plan a enfermedades.` | `Your dietitian, {name}, can review your plan. If you have a health condition or take medication, talk it through with them or your doctor: NutrIA does not adapt the plan to illnesses.` |
