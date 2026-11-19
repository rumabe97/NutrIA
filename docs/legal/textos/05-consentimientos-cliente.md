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
>   `PROFILE_HEALTH_CONSENT_VERSION = '1.0.0'` junto a `HEALTH_CONSENT_VERSION`. **Construida**
>   como `PROFILE_CONSENT_VERSION` (`packages/core/src/entities/Profile/Profile.ts:86`), hoy
>   `1.0.0` en producción.
> - `PROFILE_CONSENT_VERSION` de `1.0.0` a **`1.1.0`**, **solo si se enciende la petición de
>   plato** (§ A bis, 2026-10-13): hay un dato nuevo escrito por la persona que sale a un
>   tercero, y el texto que lo dice está encima de la casilla del art. 9. Nada construido.

---

## A. Consentimiento explícito del perfil (nuevo — P0-2)

**Dónde**: onboarding, **antes del paso del objetivo** (peso objetivo), que es el primero que recoge un dato de salud: el orden es sobre ti → objetivo → cuerpo y actividad (peso, altura) → … → alergias. El servidor lo exige antes de guardar el objetivo (backend, `099f31d`). Además, una sola vez a las cuentas ya existentes en su próximo acceso (pantalla intermedia antes de
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
| `profileConsent.ai` | `Un modelo de inteligencia artificial diseña los platos. Recibe tus objetivos diarios, tus horarios de comida, si eres vegetariano o vegano, y los alimentos y platos que te gustan o no, siempre con los nombres de nuestras listas. Nunca recibe tu nombre, tu correo, tu edad, tu peso ni tu altura, nada que escribas a mano, tus alergias ni intolerancias, ninguna otra forma de comer, ni tus enfermedades o tu medicación: lo que no puedes o no quieres comer lo quitamos antes, en nuestro código, y el mismo código comprueba cada plato antes de que te llegue.` | `An artificial-intelligence model designs the dishes. It receives your daily targets, your meal times, whether you are vegetarian or vegan, and the foods and dishes you like or dislike, always by the names on our lists. It never receives your name, email, age, weight or height, anything you type yourself, your allergies or intolerances, any other way of eating, or your conditions or medication: what you cannot or will not eat we remove first, in our code, and the same code checks every dish before it reaches you.` |
| `profileConsent.label` (la casilla) | `Consiento que NutrIA use estos datos de salud para hacer mis planes` | `I consent to NutrIA using this health data to make my plans` |
| `profileConsent.note` | `Sin este consentimiento no podemos hacerte un plan. Puedes retirarlo cuando quieras desde tu perfil: se borran esos datos. Más en la {privacy}.` | `Without this consent we cannot make you a plan. You can withdraw it at any time from your profile: that data is then deleted. More in the {privacy}.` |
| `profileConsent.continue` | `Continuar` | `Continue` |
| `profile.profileConsentWithdraw` | `Retirar el consentimiento y borrar estos datos` | `Withdraw consent and delete this data` |

<!-- Fuente: RGPD art. 9.2.a (explícito, «con uno o más de los fines especificados»), 7.1 (demostrar), 7.2 (separado de otros asuntos), 7.3 (retirar; informar antes de consentir), 7.4 y CEPD 05/2020 apdos. 26-36 (condicionar solo lo necesario); 13.1.c y e.
profileConsent.ai describe PROMPT_VERSION 4.0.0 en `agent/legal-a/backend` a `e28f0e5` (verificado en PoolPrompt.ts: NAMEABLE_PATTERNS = vegetarian, vegan; NAMEABLE_CUISINES lista cerrada; likedFoods por nombre de catálogo; nombres de platos queridos, rechazados y servidos; respuestas cerradas del check-in; eje de cambio cerrado; objetivos, meta, forma y horarios del día, frecuencia, tiempo y presupuesto). Toda otra forma de comer —halal, kósher, sin gluten, sin lactosa, omnívora, pescetariana, flexitariana— y todas las alergias e intolerancias se aplican quitando alimentos del catálogo. Halal y kósher excluyen cerdo, alcohol y gelatina (kósher además marisco, pescado sin escamas y carne con lácteos en un plato); el sacrificio ritual certificado no se modela, así que ningún texto puede presentar la opción como certificación. Solo es verdad una vez fusionada esa rama.
Revisado el 2026-09-26 (`0064`, OpenRouter): sigue siendo verdad con PROMPT_VERSION 4.1.0 y con cualquier proveedor, porque no nombra ninguno; quién recibe la petición lo dice la política (textos/02, estado 1 o 2). No cambia, así que PROFILE_CONSENT_VERSION no se sube.
Revisado el 2026-09-28 (`0067`, **sin fusionar**: rama `feat/onboarding-cleanup` — verdad
una vez fusionada). El prompt sube a 4.4.0 y deja de recibir «tu presupuesto»
(`GenerationShared.ts:118`, `budget`) y, aunque este texto nunca lo nombraba, también deja
de recibir la forma y horas del día y la frecuencia de cocina (`GenerationShared.ts:121,124`).
Se quita «, tu presupuesto» de `profileConsent.ai`; «tus horarios de comida» sigue
siendo cierto porque nombra la forma de las comidas (`mealShape`), que el modelo sigue
recibiendo. **Versión: no sube.** `PROFILE_CONSENT_VERSION` (`packages/core/src/entities/Profile/Profile.ts:87`,
hoy `1.0.0`, ya en producción — no `PROFILE_HEALTH_CONSENT_VERSION`, que es como la
proponía la nota de arriba antes de construirse) cubre el consentimiento a usar los datos
de salud del perfil «para hacer tus planes»; el cambio **reduce** lo que se pide y lo que
se envía, no lo amplía, así que lo aceptado con la versión vigente sigue cubriendo lo que
de verdad ocurre (RGPD art. 5.1.b, finalidad compatible; el art. 7.2 exige distinguirlo
cuando se *añade* un fin o un dato, no cuando se *quita* uno). Volver a pedir el
consentimiento por una reducción sería fricción sin base en el art. 7.4. **[abogado]**:
confirmar que un recorte de lo tratado nunca obliga a repetir el consentimiento, aunque el
texto que lo describe cambie.
Revisado el 2026-09-28 (segunda pasada, misma rama): la migración `0043` pone a `NULL`,
para todas las cuentas, los nueve campos de `user_preferences` y `goals.customGoal` que
`0067` dejó sin lector, y mueve todo `goals.type = 'custom'` a `'maintenance'`. Ninguno de
los dos cambia `profileConsent.ai`: los nueve campos nunca llegaban al modelo (ninguno era
`mealShape`) y el texto no nombra el tipo de objetivo por su valor. Tampoco cambia
`HEALTH_CONSENT_VERSION` ni `CARE_CONSENT_VERSION` — la migración no toca las tablas de
salud ni lo que ve el profesional, solo borra un dato sin uso y corrige una etiqueta cuyo
cálculo ya era idéntico (`core/domain/Nutrition/Nutrition.ts:21-28,279-283`: un objetivo
`'custom'` siempre calculó como `'maintenance'`). **`PROFILE_CONSENT_VERSION` sigue sin
subir**, por la misma razón que arriba: un recorte de lo tratado, no una ampliación. -->

### A bis. Si se enciende la petición de plato (2026-10-13, informe `0011` § 4 a — nada construido)

**Nada construido**: esta fila no se publica hasta que exista el campo donde una persona
escribe el nombre de un plato, y se publica **en el mismo cambio que lo enciende**. Solo es
verdad si se cumplen las cinco condiciones de [`analysis.md`](../analysis.md) P0-3 al
2026-10-13.

**Dónde**: la misma clave `profileConsent.ai`, en los dos diccionarios
(`apps/web/src/i18n/dictionaries/es-ES.ts`, `en-GB.ts`), que se muestra en
`ProfileConsentFields` justo encima de la casilla del art. 9 — en el paso «sobre ti» del
onboarding y en la pantalla `/consentimiento`.

| Clave | es-ES | en-GB |
| --- | --- | --- |
| `profileConsent.ai` | `Un modelo de inteligencia artificial diseña los platos. Recibe tus objetivos diarios, tus horarios de comida, si eres vegetariano o vegano, y los alimentos y platos que te gustan o no, siempre con los nombres de nuestras listas. Nunca recibe tu nombre, tu correo, tu edad, tu peso ni tu altura, tus alergias ni intolerancias, ninguna otra forma de comer, ni tus enfermedades o tu medicación: lo que no puedes o no quieres comer lo quitamos antes, en nuestro código, y el mismo código comprueba cada plato antes de que te llegue. Lo único escrito por ti que puede llegarle es el nombre de un plato, si algún día le pides uno: no guardamos ese texto, y el plato que salga se queda en nuestra biblioteca, la misma para todo el mundo, con el nombre que escriba el modelo.` | `An artificial-intelligence model designs the dishes. It receives your daily targets, your meal times, whether you are vegetarian or vegan, and the foods and dishes you like or dislike, always by the names on our lists. It never receives your name, email, age, weight or height, your allergies or intolerances, any other way of eating, or your conditions or medication: what you cannot or will not eat we remove first, in our code, and the same code checks every dish before it reaches you. The only thing written by you that can ever reach it is the name of a dish, if you ever ask it for one: we do not keep that text, and the dish that comes out stays in our library, the same one for everybody, under the name the model writes.` |

**Versión: `PROFILE_CONSENT_VERSION` de `1.0.0` a `1.1.0`**
(`packages/core/src/entities/Profile/Profile.ts:86`).

**Publicado el 2026-10-13** (`42424c97`), con otra redacción y **la fila de arriba queda como
constancia del borrador, no de lo servido**. Lo servido pone la excepción *dentro* del «nunca»,
como en [`02`](./02-politica-privacidad.md), en lugar de añadir una frase al final:

> es-ES: `… tu peso ni tu altura, nada que escribas a mano —salvo el nombre de un plato, si tú se lo pides—, tus alergias ni intolerancias …`
> en-GB: `… your weight or height, anything you type yourself — except the name of a dish, if you ask it for one —, your allergies or intolerances …`

**Lo acepto, y la razón importa**: lo que había que arreglar era un «nunca» sin excepción, y la
excepción está donde está el «nunca», que es donde una persona la lee. Lo que mi borrador añadía
y esto no —que el texto escrito no se guarda y que el plato queda en una biblioteca compartida—
vive en la política, a un enlace de distancia en `profileConsent.note` («Más en la {privacy}»), y
esta pantalla es un resumen del uso de los datos de salud, no la política. `PROFILE_CONSENT_VERSION`
sube igual: lo que la dispara es que el tratamiento se amplía, no la longitud de la frase.

<!-- Fuente y porqué (2026-10-13):
- **Por qué sube la versión, aunque la frase se estreche.** La nota del 2026-09-28 de arriba fijó el criterio de este documento: un cambio que **reduce** lo que se trata no obliga a volver a pedir el consentimiento, porque el art. 7.2 exige distinguirlo «cuando se añade un fin o un dato, no cuando se quita uno» (y art. 5.1.b, fin compatible). Aquí el criterio se aplica al revés: la **frase** se estrecha («nunca nada escrito a mano» pasa a «nunca, salvo el nombre de un plato que tú pidas»), pero **el tratamiento se amplía** — hay un dato nuevo que sale a un tercero, escrito por la persona. La versión se engancha a lo que ocurre, no a cómo se redacta. Por eso sube, y por la razón que el propio código documenta en `Profile.ts:82-85`: «Bumped whenever the wording of the profile consent changes… A stored version that differs is consent to a different notice, so it is asked again».
- **Y por eso no hace falta correo de aviso.** La política promete avisar por correo «si cambiamos algo importante… antes de que se aplique». La subida de la versión cumple más que eso: `OnboardingController.presentOnboarding` pone `profileConsentRequired: true` para toda cuenta cuya versión guardada no sea la vigente (`packages/core/src/controllers/Onboarding/OnboardingController.ts:51`, `ProfileConsentController.hasCurrent`), `redirectIfProfileConsentMissing` la manda a `/consentimiento` antes de `/inicio` (`apps/web/src/lib/onboarding.ts:40-48`) y `PlanGeneration.service.ts:164` devuelve 409 hasta que vuelva a marcar la casilla. Lo que se puede afirmar con precisión no es que todo el mundo lea el texto nuevo nada más entrar —quien va directo a `/plan` o `/perfil` no ve la pantalla intermedia—, sino lo único que importa aquí: **nadie genera nada ni envía nada a un modelo bajo el aviso viejo**. Por eso, en el sentido de la propia política, el cambio **no es «importante»**: no llega a aplicarse a nadie que no haya leído y aceptado el texto nuevo, así que la cláusula del correo no se dispara — la pantalla no sustituye al correo, es la razón de que no haga falta. **[abogado]**: confirmar esta lectura; un lector literal diría «prometiste correo y no lo mandaste». Si el propietario decide **no** subir la versión, entonces **sí hace falta el correo** ([`06`](./06-correos.md)), porque no quedaría ningún aviso previo a nadie.
- **Hueco a tapar en el mismo cambio**: `redirectIfProfileConsentMissing` solo se llama desde `/inicio` (`apps/web/src/app/(app)/inicio/page.tsx`), así que una persona que entre directa a otra pantalla no ve la pantalla intermedia hasta que genere. Por eso la ruta de la petición de plato **tiene que exigir ella misma el consentimiento vigente** (el mismo 409, `profileConsentRequired`): nadie debe poder enviar texto escrito al modelo bajo un aviso caducado. Hoy no es un defecto —el servidor exige el consentimiento antes de guardar el objetivo y antes de generar, así que ningún dato de salud entra sin él—, solo lo sería el día que la subida de versión se use como aviso: casilla en [`go-live-checklist.md`](../go-live-checklist.md) § 0 octies, nada que enviar a `backend` mientras no haya campo.
- RGPD arts. 4.11 y 7.1-7.2 (informado, demostrable, distinguible), 9.2.a, 5.1.a y 5.1.b, 13.1.c y e. -->

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

<!-- Fuente: RGPD art. 13.1.a, c, e; 26.2 (aspectos esenciales del reparto, por si hubiera corresponsabilidad); analysis.md § 2. -->

---

## C. Consentimiento de salud existente — una precisión

**Clave**: `health.consentNote` (`es-ES.ts`, namespace `health`). Sube
`HEALTH_CONSENT_VERSION` a `1.1.0`.

| Hoy | es-ES nuevo | en-GB nuevo |
| --- | --- | --- |
| `Se guardan en tu cuenta, no se envían a ningún modelo de IA, no aparecen en los registros del servidor y se borran con tu cuenta. Puedes borrarlos por separado con el botón de abajo.` | `Se guardan en tu cuenta, no aparecen en los registros del servidor y se borran con tu cuenta. Nunca se envían a ningún modelo de IA: solo llega su efecto, como los ingredientes que quitamos por una celiaquía. Si trabajas con un dietista, solo los ve si se lo permites aparte. Puedes borrarlos por separado con el botón de abajo.` | `They are kept in your account, never appear in server logs and are deleted with your account. They are never sent to any AI model: only their effect is, such as the ingredients we remove for coeliac disease. If you work with a dietitian, they only see them if you allow it separately. You can delete them separately with the button below.` |

<!-- Fuente: 0008 (celiaquía → gluten), 0052 (proteína en polvo solo con suplemento proteico); RGPD art. 5.1.a (transparencia) y 13.1.e. -->

### C bis. La regla de la enfermedad (proyecto 025, borrador del 2026-11-18)

**Clave**: `health.consentNote`. **Versión**: `HEALTH_CONSENT_VERSION` de `1.1.0` a **`1.2.0`**.
**El plan del proyecto 025 no lo prevé**: lo he enviado al lead (hallazgo F1 de
[`../2026-11-18-anyone-can-open-a-practice.md`](../2026-11-18-anyone-can-open-a-practice.md)). Se
publica en el mismo cambio que trae la regla (fase 5), o antes. Nunca después.

| Hoy (1.1.0) | es-ES nuevo | en-GB nuevo |
| --- | --- | --- |
| `… Si trabajas con un dietista, solo los ve si se lo permites aparte. Puedes borrarlos por separado con el botón de abajo.` | `Se guardan en tu cuenta, no aparecen en los registros del servidor y se borran con tu cuenta. Nunca se envían a ningún modelo de IA: solo llega su efecto, como los ingredientes que quitamos por una celiaquía. Un profesional solo los ve si tiene la insignia de dietista-nutricionista verificado por NutrIA y tú se lo permites aparte. Mientras tengas anotada alguna condición o medicación, solo podrás vincularte con un profesional con esa insignia; si estás vinculado con uno sin ella, el enlace terminará al guardarla. Puedes borrarlos por separado con el botón de abajo.` | `They are kept in your account, never appear in server logs and are deleted with your account. They are never sent to any AI model: only their effect is, such as the ingredients we remove for coeliac disease. A professional only sees them if they hold NutrIA's verified dietitian-nutritionist badge and you allow it separately. While you have any condition or medication on record, you can only link with a professional who holds that badge; if you are linked with one who does not, the link will end when you save it. You can delete them separately with the button below.` |

<!-- Fuente: RGPD art. 9.2.a («para uno o más de los fines especificados») y 7.2: la regla usa lo declarado para algo nuevo — negar o terminar un enlace (0111 § 8) —, que el texto 1.1.0 no dice; 13.3 (informar antes del uso nuevo); 22.1-22.4 por si la regla fuera una decisión del art. 22 (M14) — por eso la política añade la revisión por una persona (../2026-11-18-anyone-can-open-a-practice.md § 4, P-3 ¶ 6). «Alguna condición»: HEALTH_CONDITIONS incluye embarazo y lactancia (packages/core/src/entities/Health/Health.ts:27-28), y la regla los alcanza; los suplementos no (PRD 025 scope 10). El mecanismo health.consentStale vuelve a pedirlo. -->

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

**Proyecto 025**: si esta clave se construye, dice `{name} puede revisar tu plan…` y «háblalo
con {name} o con tu médico», sin «tu dietista» (decisión C3 de
[`../2026-11-18-anyone-can-open-a-practice.md`](../2026-11-18-anyone-can-open-a-practice.md)).

---

## F. La invitación por nivel — `CARE_CONSENT_VERSION` 3.0.0 (proyecto 025, borrador del 2026-11-18)

**Dónde**: `/invitacion/[token]`, componente `apps/web/src/components/CareInvitation`,
namespace `care`. `presentInvitationDetail` y `presentLink` eligen la lista según la insignia del
profesional **en ese momento** (PLAN 025 fase 5, paso 1). Aceptar guarda `consent_scope`, `full`
o `plan`, y la versión `3.0.0` (paso 2).

**Versión**: `CARE_CONSENT_VERSION` de `2.0.0` a **`3.0.0`**, en la fase 8, con estas palabras.
Qué hacer con los enlaces aceptados con la `2.0.0`: ver el § 1 del documento del proyecto.

**Lo que no cambia de B**: el orden de lectura; `care.shares.*`, `care.canDo.*`,
`care.healthQuestion`, `care.healthShareNote`, `care.healthShareIntro`,
`care.invitationTrail` y `care.invitationNotShared` para la lista con insignia.

### F.1 La cabecera, por nivel

| Clave | es-ES | en-GB |
| --- | --- | --- |
| `care.invitationIntro` (con insignia; sustituye a la de B1) | `{professional} te invita a llevar tu plan con su ayuda en NutrIA.` | `{professional} invites you to follow your plan with their help on NutrIA.` |
| `care.invitationBadge` (con insignia, bajo el nombre) | `Dietista-nutricionista colegiada/o, con el número {collegiateNumber} · Comprobado por NutrIA el {checkedOn}` | `Registered dietitian-nutritionist, number {collegiateNumber} · Checked by NutrIA on {checkedOn}` |
| `care.invitationIntroPlan` (sin insignia) | `{professional} te invita a que te haga el plan de comidas en NutrIA.` | `{professional} invites you to let them make your meal plan on NutrIA.` |
| `care.invitationNotice` (sin insignia, bajo el nombre, fijo) | `No es un profesional sanitario verificado por NutrIA` | `Not a health professional verified by NutrIA` |

<!-- Fuente: PRD 025 scope 10 (la página muestra la lista del nivel, el aviso fijo para quien no tiene insignia y ningún número sin comprobar) y criterio 5; legal § 3.a (la regla del número; el aviso fijo); 0111 § 2. El número y la fecha salen de la comprobación «pass», nunca del texto (PLAN fase 3, paso 6). -->

### F.2 Con insignia: lo que se añade a la lista de B

Dos frases nuevas, después de `care.invitationNotShared`:

| Clave nueva | es-ES | en-GB |
| --- | --- | --- |
| `care.inferenceAllergy` | `NutrIA no le enseña tus alergias ni tus intolerancias. Si un plato no se te puede ofrecer, le dice solo que no encaja contigo, pero de eso puede deducir alguna.` | `NutrIA does not show them your allergies or intolerances. If a dish cannot be offered to you, it only tells them it does not suit you, but from that they may work one out.` |
| `care.inferenceBadgeLoss` | `Si tienes anotada una condición de salud o una medicación y pierde la verificación de NutrIA, el enlace terminará. Solo le diremos que ha terminado, pero puede deducir el motivo.` | `If you have a health condition or a medication on record and they lose NutrIA's verification, the link will end. We will only tell them it has ended, but they may work out why.` |

`care.invitationPrivacy` (con insignia; sustituye a la de B3):

| es-ES | en-GB |
| --- | --- |
| `NutrIA te comunica estos datos a {professional} porque tú lo pides. Es dietista-nutricionista: los usa para atenderte, bajo su secreto profesional, y responde de lo que haga con ellos. Puedes terminar el enlace cuando quieras. Más en la {privacy}.` | `NutrIA discloses this data to {professional} because you ask it to. They are a dietitian-nutritionist: they use it to care for you, under professional secrecy, and are responsible for what they do with it. You can end the link at any time. More in the {privacy}.` |

`care.invitationAccept` sigue siendo `Aceptar la invitación` / `Accept the invitation`.

<!-- Fuente: legal § 3.g (la inferencia del alérgeno se dice en el consentimiento: art. 5.1.a y 13); F4 del documento del proyecto (el barrido de 0111 § 8 deja deducir quién tiene algo anotado); Ley 44/2003 art. 5.1.c; RGPD arts. 9.2.a, 9.2.h, 13.1.e, 26.2. «en su consulta» sale de la frase: es una palabra clínica de la tabla (§ 6 del documento del proyecto) y aquí no hace falta. `{privacy}` → /privacidad#tu-profesional. -->

### F.3 Sin insignia: la lista entera

| Clave nueva | es-ES | en-GB |
| --- | --- | --- |
| `care.invitationShareIntroPlan` | `Si aceptas, {professional} verá solo:` | `If you accept, {professional} will see only:` |
| `care.sharesPlan.profile` | `tu nombre` | `your name` |
| `care.sharesPlan.plans` | `los planes que te haga a través de este enlace —los que genere, revise o publique—, con sus platos, cantidades y totales de cada día` | `the plans they make for you through this link — the ones they generate, review or publish — with their dishes, amounts and each day's totals` |
| `care.sharesPlan.status` | `en qué punto estáis: desde cuándo estáis vinculados, si has terminado tu perfil, si tienes un plan en marcha o por revisar, y si te quedan generaciones de plan en la quincena` | `where things stand: since when you have been linked, whether you have finished your profile, whether you have a plan under way or waiting for review, and whether you have plan generations left this fortnight` |
| `care.invitationCanDoIntro` | `Y podrá:` (sin cambios) | `And they will be able to:` |
| (`care.canDo.plans`, `care.canDo.review`; **no** `care.canDo.targets`) | sin cambios | unchanged |
| `care.invitationNotSharedPlan` | `No verá tu peso, tus objetivos, cuánto sigues el plan, tus check-ins, tus condiciones de salud, tu medicación, tus suplementos, tus alergias, tus intolerancias, tu correo ni tus planes de antes del enlace.` | `They will not see your weight, your targets, how much of the plan you follow, your check-ins, your health conditions, medication or supplements, your allergies or intolerances, your email address or your plans from before the link.` |
| `care.inferencePlan` | `Lo que puede deducir: de los totales de cada día, más o menos cuánta energía necesitas; y, si un plato no se te puede ofrecer, NutrIA le dice solo que no encaja contigo, pero de eso puede deducir alguna alergia o intolerancia.` | `What they may work out: from each day's totals, roughly how much energy you need; and, if a dish cannot be offered to you, NutrIA only tells them it does not suit you, but from that they may work out an allergy or an intolerance.` |
| `care.illnessRulePlan` | `Si tienes anotada una condición de salud o una medicación, no puedes aceptar esta invitación, y si la anotas después, el enlace terminará. A {professional} solo le constará que el enlace ha terminado.` | `If you have a health condition or a medication on record, you cannot accept this invitation, and if you record one later, the link will end. {professional} will only see that the link has ended.` |
| `care.invitationTrail` | sin cambios | unchanged |
| `care.invitationPrivacyPlan` | `{professional} no está obligado por ley al secreto profesional: se compromete con NutrIA, por contrato, a guardar la confidencialidad. Al aceptar consientes dos cosas: que NutrIA le comunique estos datos y que {professional} los use para hacerte el plan. NutrIA responde de tus datos en NutrIA; {professional}, de lo que haga con lo que vea. Retiras el consentimiento terminando el enlace, cuando quieras. Más en la {privacy}.` | `{professional} is not bound by professional secrecy by law: they promise NutrIA, by contract, to keep it confidential. By accepting you consent to two things: that NutrIA discloses this data to them, and that {professional} uses it to make your plan. NutrIA is responsible for your data on NutrIA; {professional}, for what they do with what they see. You withdraw your consent by ending the link, whenever you like. More in the {privacy}.` |
| `care.invitationAcceptPlan` | `Acepto y consiento` | `I accept and consent` |

No hay línea de salud: `setSharesHealth(true)` se rechaza fuera de `full` (PLAN fase 5, paso 3), y
la pantalla no la ofrece.

<!-- Fuente:
- 0110 decisión 3; 0111 §§ 4-5; PRD 025 scope 7 y 9, criterios 9-11 (solo los planes hechos a través del enlace; nada de antes; sin línea de salud).
- `care.sharesPlan.status` describe lo que la lista de clientes y los avisos de generación siguen mostrando en el alcance `plan`: `CareClientLinkView.since` y los estados de `stageOf` salvo `check_in_due`, que la fase 4 pliega (`onboarding`, `awaiting_plan`, `plan_awaiting_review`, `plan_under_way`: `packages/core/src/controllers/Care/CareController.ts:154-160` y `:306-319`), y `practice.generateIncomplete` / `practice.generateQuota`. No son datos de salud, pero los ve, así que la lista los nombra: «verá solo» tiene que ser verdad.
- La inferencia de energía es nueva (PRD 025 scope 9: «the second inference is new, for legal to word»); la del alérgeno, legal § 3.g.
- La regla de la enfermedad: 0111 § 8; PRD scope 10 («to them it reads as an unanswered invitation or an ended link»).
- Dos responsables nombrados, a falta de M12 (legal § 3.e): RGPD arts. 9.2.a («consentimiento explícito… para uno o más de los fines especificados»), 7.2 (lenguaje claro y distinguible), 7.3 (retirada tan fácil como darlo: terminar el enlace es un botón), 13.1.a, c y e.
- «No está obligado por ley»: Ley 44/2003 art. 5.1.c obliga a los profesionales sanitarios; RGPD art. 9.3.
- El chat no se nombra: no existe en el proyecto 025 (C1). Cuando llegue, `care.sharesPlan` gana `lo que le escribas en el chat` y la versión vuelve a subir.
- `Acepto y consiento`: C4 — el botón es la declaración explícita (CEPD Directrices 05/2020, § 4, «consentimiento explícito»: una declaración expresa del interesado; los apartados no se han vuelto a leer para esta nota). -->

### F.3 bis. Ya vinculado: el mensaje con y sin nombre (2026-11-19)

**Dónde**: la página de la invitación, cuando la persona ya tiene un enlace y el servidor responde
409 `CareLinkExistsError`, que lleva `professionalName`, `since` y `status`
(`packages/core/src/entities/Error/Error.ts:315`; lo pinta
`apps/web/src/components/CareInvitation/CareInvitation.tsx:136` con `care.invitationLinkExistsBody`).
**Sí hay una frase con el nombre**: la de hoy, «Ya tienes un dietista vinculado: {professional}, desde
el {since}.», que el § 7 del documento del proyecto ya sustituye por una neutra (aprobado el
2026-11-18). La clave `errors.careLinkExists` (`apps/web/src/lib/api.ts:75`) no lleva nombre, y su
sustitución ya aprobada tampoco: «Ya estás vinculado con un profesional.».

| Clave | es-ES | en-GB | Estado |
| --- | --- | --- | --- |
| `care.invitationLinkExistsBody` | `Ya estás vinculado con {professional}, desde el {since}.` | `You are already linked with {professional}, since {since}.` | aprobado el 2026-11-18 (§ 7) |
| `care.invitationLinkExistsBodyNoName` (nueva) | `Ya estás vinculado con tu profesional desde el {since}.` | `You are already linked with your professional since {since}.` | **aprobado por el propietario el 2026-11-19** («Aprobadas») |

Se usa la variante sin nombre cuando el nombre de la cuenta del profesional de **ese enlace ya
existente** no se puede mostrar (`nameShown`, `CareController.ts:631`, con la insignia de ese
profesional). **Para `backend`**: hoy el error lleva el nombre tal cual (`CareController.ts:691-695`).
La decisión de ocultarlo tiene que tomarla el servidor, con un `professionalName` nulo, y no la
pantalla, para que el nombre no viaje en la respuesta.

<!-- Fuente: las mismas que 06 § Y, «Sin el nombre». El título y el botón («Ya tienes un enlace activo», «Ver mi perfil») no llevan nombre y no cambian. -->

### F.4 La insignia llega con el enlace ya abierto: volver a consentir

**Dónde**: la tarjeta del enlace en el perfil del cliente (`CareLinkCard`), solo mientras el
enlace es `plan` y la insignia del profesional sigue en pie. Una ruta del cliente pasa el enlace a
`full` con la versión vigente (PLAN fase 5, paso 2).

| Clave nueva | es-ES | en-GB |
| --- | --- | --- |
| `care.reconsentTitle` | `{professional} ahora tiene la verificación de NutrIA` | `{professional} is now verified by NutrIA` |
| `care.reconsentBody` | `Hemos comprobado que es dietista-nutricionista colegiada/o. Mientras no digas que sí, sigue viendo solo los planes que te hace. Si aceptas, verá también:` | `We have checked that they are a registered dietitian-nutritionist. Until you say yes, they keep seeing only the plans they make for you. If you accept, they will also see:` |
| (la lista, en dos bloques como en B1) | 1) bajo `care.reconsentBody` («…verá también:»): `care.shares.targets`, `care.shares.mealPlans`, `care.shares.progress`, `care.shares.checkIns`; 2) `care.invitationCanDoIntro` («Y podrá:») y debajo `care.canDo.targets`; después, la línea de salud aparte, sin marcar, como en B2; `care.inferenceAllergy` y `care.inferenceBadgeLoss`; `care.invitationPrivacy` con insignia | the same keys, the same two blocks |

<!-- Aclarado el 2026-11-19 (revisión de accesibilidad de la fase 8): «como en B1» quería decir la misma estructura que la invitación — lo que verá bajo «verá también:» y lo que podrá hacer bajo su propio «Y podrá:». Fijar objetivos es un acto, no un dato que se ve; ponerlo bajo «verá» describiría mal lo que se consiente (RGPD arts. 4.11 y 7.2: informado y en lenguaje claro). Sin palabras nuevas: `care.invitationCanDoIntro` ya está aprobado. -->
| `care.reconsentAccept` | `Sí, compartir esto también` | `Yes, share this too` |
| `care.reconsentLater` | `Ahora no` | `Not now` |
| `care.reconsentLaterHint` | `Puedes decidirlo más adelante aquí mismo. El enlace sigue como está.` | `You can decide later, right here. The link stays as it is.` |

<!-- Fuente: 0111 § 4 («a badge gained mid-link widens nothing until the client consents again»); PRD 025 scope 9 y criterio 12; RGPD arts. 7.1-7.2 y 9.2.a (una ampliación es un consentimiento nuevo, no se presume). La tarjeta desaparece si la insignia se pierde antes de aceptar (la ruta solo funciona «while the badge stands»). -->

---

## G. La regla de la enfermedad: lo que ve el cliente (proyecto 025, borrador del 2026-11-18)

**Lo que ve el profesional sin insignia**: nada distinto. Una aceptación rechazada no le llega:
para él la invitación sigue sin responder hasta que caduca. Un enlace terminado por la regla se le
muestra **igual** que uno que termina el cliente. No hay correo al profesional (hoy no existe
ningún correo de «enlace terminado», y uno que solo saliera por esta regla sería la revelación).
Ver [`06`](./06-correos.md) § Y.

### G.1 Antes de guardar (elección C7, recomendada)

**Dónde**: `/perfil`, sección de salud, al añadir la primera condición o medicación, **solo si**
la persona está vinculada con un profesional sin insignia. Un aviso encima del botón de guardar,
antes de que el servidor termine el enlace (PLAN fase 5, paso 4: `HealthController.replace`).

| Clave nueva | es-ES | en-GB |
| --- | --- | --- |
| `health.illnessLinkWarning` | `Si guardas una condición de salud o una medicación, terminará tu enlace con {professional}: en NutrIA, solo un dietista-nutricionista verificado puede acompañar a quien tiene alguna anotada. Tu plan, tus objetivos y tu historial se quedan contigo. A {professional} solo le constará que el enlace ha terminado.` | `If you save a health condition or a medication, your link with {professional} will end: on NutrIA, only a verified dietitian-nutritionist can work with someone who has one on record. Your plan, your targets and your history stay with you. {professional} will only see that the link has ended.` |

<!-- Fuente: RGPD art. 13.3 y 5.1.a (decirlo antes de usar el dato para eso); F1 y C7 del documento del proyecto. No disuade de anotar nada: no dice que borrar la condición devuelva el enlace. -->

### G.2 No se puede aceptar (en la página de la invitación)

| Clave nueva | es-ES | en-GB |
| --- | --- | --- |
| `care.illnessRefusedTitle` | `No puedes aceptar esta invitación` | `You cannot accept this invitation` |
| `care.illnessRefusedBody` | `Tienes anotada en tu perfil una condición de salud o una medicación, y en NutrIA solo un dietista-nutricionista verificado puede acompañar a quien tiene alguna. {professional} no lo es. No sabrá el motivo: para su lado, la invitación sigue sin respuesta hasta que caduque. Si crees que es un error, escríbenos a {email} y lo revisa una persona.` | `You have a health condition or a medication on record in your profile, and on NutrIA only a verified dietitian-nutritionist can work with someone who has one. {professional} is not one. They will not know why: on their side, the invitation stays unanswered until it expires. If you think this is a mistake, write to us at {email} and a person will look at it.` |

### G.3 El enlace ha terminado (en pantalla, en la tarjeta del enlace o al guardar)

| Clave nueva | es-ES | en-GB |
| --- | --- | --- |
| `care.illnessEndedTitle` | `Tu enlace con {professional} ha terminado` | `Your link with {professional} has ended` |
| `care.illnessEndedBody` (al anotar una condición o medicación) | `Has anotado una condición de salud o una medicación, y en NutrIA solo un dietista-nutricionista verificado puede acompañar a quien tiene alguna. Tu plan, tus objetivos y tu historial se quedan contigo, y el registro de sus accesos sigue en tu perfil. A {professional} solo le consta que el enlace ha terminado. Si crees que es un error, escríbenos a {email}.` | `You have recorded a health condition or a medication, and on NutrIA only a verified dietitian-nutritionist can work with someone who has one. Your plan, your targets and your history stay with you, and the record of their access stays on your profile. {professional} only sees that the link has ended. If you think this is a mistake, write to us at {email}.` |
| `care.illnessEndedBadgeBody` (cuando el profesional pierde la insignia) | `{professional} ya no tiene la verificación de NutrIA, y tú tienes anotada una condición de salud o una medicación: en NutrIA, solo un dietista-nutricionista verificado puede acompañar a quien tiene alguna. Tu plan, tus objetivos y tu historial se quedan contigo. A {professional} solo le consta que el enlace ha terminado. Si crees que es un error, escríbenos a {email}.` | `{professional} is no longer verified by NutrIA, and you have a health condition or a medication on record: on NutrIA, only a verified dietitian-nutritionist can work with someone who has one. Your plan, your targets and your history stay with you. {professional} only sees that the link has ended. If you think this is a mistake, write to us at {email}.` |

<!-- Fuente: 0111 § 8 (tres puntos: CareRepository.accept, HealthController.replace, el barrido diario); PRD 025 scope 10 y criterio 22 («the client is told plainly»); RGPD arts. 13.2.f y 22.3 (por si aplica el art. 22: intervención humana, expresar su punto de vista, impugnar — M14); «el registro de sus accesos sigue»: care_access_log es del cliente (0059). Estas frases nombran la categoría de salud **en la pantalla de la propia persona**; el correo de 06 § Y no, porque un buzón se escanea. -->
