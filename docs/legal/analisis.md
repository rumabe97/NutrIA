# Análisis jurídico — NutrIA (producto completo y proyecto 004)

> **Propósito**: el análisis jurídico del producto entero y del proyecto 004. **Audiencia**: el propietario, el abogado, el lead. **Committed**: sí. **Mantenido por**: el agente `legal`.
>
> **No soy abogado.** Esto es el análisis que haría uno, con cada conclusión atada al
> artículo en que se apoya y a lo que el código hace de verdad (con `ruta:línea`). Lo
> que depende de una interpretación está marcado **[abogado]** y reunido en el § 10.
> Fecha de corte: 2026-09-25. Commit leído: `ce12c0d`.
>
> **Revisión 2026-09-26 — el proveedor de IA** ([`0064`](../decisions/0064-generation-runs-on-paid-no-training-models-through-openrouter.md)),
> commit leído `31c3f99`: §§ 0 (punto 6), 1.3, 3, 4.2, 4.3, 7, 9 (P0-3, P1-10, P1-11 a
> P1-13, P2-11, P2-12, P3) y 10. Actualizada el mismo día con las decisiones del
> propietario: Gemma 4 31B sustituye a MiniMax M3 de reserva, lista cerrada DeepInfra y
> CoreWeave hecha, categorización aceptada con aviso. Lo demás no se ha vuelto a leer contra el código: los
> estados de P0-1, P0-2, P1-1 a P1-4 que dan este documento y la EIPD son los del
> 2026-09-25 y el `decisions/LOG.md` de ese día dice que se construyeron.
>
> **Revisión 2026-10-03 — el alta no revela nada** (proyecto 011, fases 7 y 8; PR #217,
> rama `feat/011-p8-signup`, commit leído `4f36ec5`): §§ 3, 4.1, 4.1 ter (nuevo), 9 (P2-14,
> P2-15, P3) y 10 (punto 13).
>
> **Revisión 2026-10-09 — el navegador que ya entró** (proyecto 011, fase 7b, `0089`;
> PR #242, rama `feat/011-p7b-device-cookie`, commit leído `3243cc7` y los cambios de la
> revisión de invariantes del mismo día): §§ 4.1, 4.1 quater (nuevo) y 10 (punto 14).
>
> **Revisión 2026-10-09 (tarde) — el barrido de la cuenta que nadie confirmó** (proyecto
> 011, seguimiento «the 30-day sweep of unconfirmed accounts»,
> [`0092`](../decisions/0092-sweep-an-account-whose-address-nobody-ever-confirmed.md);
> PR #250, commit leído `fbab7b1b`, ya en `main`): §§ 4.1, 4.1 quinquies (nuevo), 9 (P2-15
> cerrada, dos P3) y 10 (punto 15).

## 0. Resumen en diez líneas

1. **Roles.** NutrIA (su propietario) es **responsable** de todo lo que el producto trata.
   Cuando un cliente acepta un enlace, NutrIA **comunica** datos a su dietista a petición y
   con el consentimiento del cliente; el dietista es **responsable independiente** de lo
   que ve y hace con ello en su práctica sanitaria. NutrIA **no es encargado** del
   dietista: los datos viven en la cuenta del cliente y NutrIA decide cuánto duran. No hay
   corresponsabilidad, pero el acuerdo del profesional incluye, por si un tribunal la
   apreciara, el reparto que exige el art. 26 (§ 2).
2. **Hay tres P0 hoy**, dos de ellos **ya en producción** y ajenos al flag: alergias,
   intolerancias y datos corporales se tratan sin excepción del art. 9; y el texto libre
   de alergias, la «forma de comer» (halal/kósher) y los comentarios del check-in viajan a
   modelos gratuitos cuyos términos permiten entrenar con ellos. El tercero es del 004:
   la invitación promete un control que no existe (§ 9).
3. **EIPD: obligatoria** (cuatro criterios de la lista de la AEPD). Escrita en [`eipd.md`](./eipd.md).
   **DPD: no obligatorio hoy** (no hay «gran escala»); revisar al crecer (§ 5).
4. **Falta construir**: la pantalla de aceptación del profesional (con tabla y versión),
   el consentimiento explícito de salud en el registro, el control para retirar solo la
   línea de salud del enlace, la puerta de edad y el aviso legal (§ 9, § 11).
5. **El propietario como persona física**: vender Premium o planes de consulta es
   actividad económica: alta censal en Hacienda y, muy probablemente, en el RETA; el aviso
   legal debe llevar domicilio y NIF (§ 6).
6. **IA (2026-09-26).** Producción no llama a ningún modelo desde el 2026-09-26
   (`AI_PROVIDER=stub`). El cambio a OpenRouter con modelos de pago, retención cero y sin
   entrenamiento (`0064`) cumple la regla del propietario **si** antes: se tiene el texto
   del acuerdo de tratamiento de OpenRouter y la confirmación de que aplica a su cuenta
   (P1-11, **pendiente**). La lista cerrada de empresas que pueden ejecutar el modelo
   (P1-12) está hecha: DeepInfra y CoreWeave, en la cuenta (propietario, 2026-09-26) y en
   el código (`AI_PROVIDER_ONLY`). MiniMax M3 sale; Gemma 4 31B es el principal y DeepSeek
   V4.1 Flash la reserva; Gemma tiene licencia Apache 2.0 y sin deberes que bloqueen (P1-13, cerrado). La política cambia en dos pasos (§ 4.3, [`textos/02`](./textos/02-politica-privacidad.md)).
   P1-10 (Gemini en `/consulta`) se cierra con el cambio.

> **Revisión 2026-09-28 — recorte del onboarding** (decisión `0067`, **sin fusionar**:
> rama `feat/onboarding-cleanup`, base `4b70ff7`): §§ 1.3, 3, 4.1, 9 (nuevo P2-13). El
> onboarding deja de pedir diez campos — hora de despertar y de dormir, días y hora de
> entrenar, notas del horario laboral, presupuesto, frecuencia de cocina, estilo de
> desayuno, preferencia de ración y el objetivo personalizado en texto libre — y el
> prompt (`4.3.0` → `4.4.0`) deja de recibir la forma y horas del día y el
> presupuesto/frecuencia de cocina; sigue recibiendo el tiempo máximo de cocina, la forma
> de las comidas, los objetivos, el tipo de objetivo, vegetariano/vegano, cocinas y
> gustos por nombre de catálogo. **Lo que sigue aquí es verdad una vez fusionada esa
> rama**; hasta entonces, lo cierto es lo que describe la revisión del 2026-09-26.
>
> **Revisión 2026-09-28 (segunda pasada, mismo día y misma rama, commit leído
> `28449c1`) — cierra P2-13**: la migración `0043` (backend, hoy sin fusionar en
> `agent/onboarding-cleanup/backend`; `packages/database/src/migrations/0043_onboarding_answers_nothing_reads_are_cleared.sql`)
> pone a `NULL` las nueve columnas de `user_preferences` y `goals.customGoal` para
> **todas las cuentas**, no solo las nuevas, y mueve todo `goals.type = 'custom'` a
> `'maintenance'`. §§ 1.3, 4.1 y 9 (P2-13, cerrado) se actualizan. Las columnas y el
> valor `'custom'` del enum siguen existiendo en Postgres — la baja de esquema es de
> la siguiente entrega, igual que decidió `0067` — pero ya no hay ninguna fila con un
> valor que la política no describa: la política puede dejar de nombrar «horarios»
> hoy, no cuando llegue esa segunda migración. **Verdad una vez fusionada** esta
> rama, como el resto de esta revisión.

---

## 1. Qué hace el producto (lo que he leído, no lo que dicen los documentos)

### 1.1 Datos, dónde viven y cómo se borran

Todas las tablas de usuario cuelgan de `user.id` con `ON DELETE CASCADE`
(`packages/database/src/schemas/_utils.ts:42,75`), con estas excepciones deliberadas:

| Tabla | Qué guarda | Al borrar la cuenta |
| --- | --- | --- |
| `care_access_log` | rastro de accesos del profesional, del cliente | `professionalId` → `NULL`, **se conserva el nombre** del profesional en la cuenta del cliente (`care.schema.ts:122`) |
| `target_overrides.setByProfessionalId` | quién fijó los objetivos | `NULL` (`profile.schema.ts:122`) |
| `care_invitations` | correo tecleado por el profesional, hash del token | se borra por dirección en `beforeDelete` (`apps/api/src/modules/auth/auth.config.ts:227-230`); las caducadas solo se limpian cuando se escribe otra invitación (`care.schema.ts:14-24`) |
| `recipes.createdBy` | receta generada | `NULL`; la receta queda en la biblioteca (`recipe.schema.ts:22`) |
| `audit_logs.actorId` | acciones de administración de una lista cerrada (`AUDIT_ACTIONS`, `packages/core/src/entities/Audit/Audit.ts:12-23`, desde el 008) | `NULL` (`platform.schema.ts:86`). Corregido el 2026-09-30: decía que nada escribía en esta tabla. Las cuatro acciones sobre imágenes (`picture.retried`, `picture.discarded` y, desde el 009 fase 3, `picture.accepted` y `picture.removed`) llevan como autor al propietario y como entidad una receta; `picture.accepted` lleva además las claves de alérgeno que el juez señaló en la imagen, que describen una imagen y no a una persona, y `picture.removed`, desde el 010 fase 4, `acceptedBy` (`judge` u `owner`: por qué puerta había llegado la imagen retirada; las filas anteriores, `{}`): ningún dato de un tercero ([`imagenes-de-platos.md`](./imagenes-de-platos.md) § 4.4). Corregido el 2026-10-09: ya no es verdad que ninguna fila se borre nunca — las filas `auth.*` se purgan a los doce meses desde la fase 7 del 011 (`AuditController.forgetExpiredAuthRows`, #213; § 4.1 bis), y las demás (administración) siguen sin plazo, sin problema mientras el único administrador sea el responsable. Desde el barrido de cuentas sin confirmar (`0092`, #250) hay una acción más, `auth.unconfirmed_account_swept`, cuyo autor no es nadie y cuyo sujeto queda a `NULL` en la misma transacción que borra la cuenta (§ 4.1 quinquies). **Sin revisar**: qué queda en las filas cuya entidad es una cuenta (`account.*`, `professional.*`) cuando esa cuenta se borra |
| `analytics_events` | `session_started`, `swap_requested`, `ai_call` | cascada; **ligados a `userId`** (`platform.schema.ts:97`; escritores en `auth.config.ts:103` y `apps/api/src/modules/meal-plans/services/MealPlans.service.ts:69`) |

Antes de borrar, se cancelan las suscripciones de Stripe y, si Stripe falla, la cuenta no
se borra (`auth.config.ts:212-231`). La sesión dura 30 días y guarda IP y agente de
usuario (`auth.config.ts:31`, `auth.schema.ts:45-56`). ~~No hay tarea programada que purgue
nada: los dos cron son reescritura de recetas y recordatorios~~ — **corregido el
2026-10-09**: desde el 011 sí la hay, `/api/v1/cron/sweep-verifications` a las 08:05 UTC
(`apps/api/vercel.json`), que limpia las filas de verificación de Better Auth y, en
`AuthRetentionService.forget`, tres cosas más: las filas calladas del freno por dirección,
las filas `auth.*` del rastro de más de doce meses (§ 4.1 bis) y las cuentas sin confirmar
de más de treinta días (§ 4.1 quinquies).

**Copias de seguridad**: la restauración a un instante de Neon (ventana sin anotar) y una
exportación manual, **sin cifrar**, que se guarda en el equipo del propietario y no se
borra sola (`docs/reference/deployment.md` § 8).

### 1.2 Qué datos son de salud o de categoría especial

El art. 4.15 RGPD define «datos relativos a la salud» como los que «revelen información
sobre su estado de salud». El TJUE lo interpreta con amplitud: basta con que el dato
permita deducir el estado de salud «mediante un ejercicio intelectual de relación o
deducción» (C-184/20 *OT*, 1/8/2022; C-21/23 *Lindenapotheke*, 4/10/2024, donde los datos
de un pedido de medicamentos sin receta se consideraron de salud). Con ese criterio:

| Dato | ¿Art. 9? | Hoy se trata como |
| --- | --- | --- |
| Condiciones, medicación, suplementos | Salud, sin duda | Consentimiento explícito versionado (`HEALTH_CONSENT_VERSION = '1.0.0'`, `packages/core/src/entities/Health/Health.ts:43`) ✔ |
| Alergias, intolerancias, alergias en texto libre (`allergies`, `intolerances`, `custom_allergens`, con gravedad hasta `anaphylaxis`) | **Salud**: una alergia es un estado de salud | Solo contrato (art. 6.1.b) — `apps/web/src/i18n/dictionaries/es-ES.ts:1113,1125` ✘ |
| Peso, altura, fecha de nacimiento, sexo, objetivo (perder peso), serie de peso | **Salud, en este contexto** [abogado]: se usan para calcular metabolismo basal y seguir una pérdida de peso | Solo contrato ✘ |
| «Forma de comer»: `gluten_free`, `lactose_free` | Salud (revela celiaquía o intolerancia) | Solo contrato ✘ |
| «Forma de comer»: `halal`, `kosher` (`packages/database/src/schemas/_enums.ts:21-22`) | **Convicciones religiosas** | Solo contrato ✘ |
| Comentarios del check-in, notas de comidas | Pueden contener salud («me mareé») | Solo contrato |

Consecuencia: el producto trata categorías especiales **fuera** de las tres tablas de
salud, sin ninguna excepción del art. 9.2. Ver P0-2 en el § 9.

### 1.3 Lo que llega a la IA (revisado 2026-09-28, `0067` — verdad una vez fusionada)

**El prompt** (`apps/api/src/modules/ai/prompts/PoolPrompt.ts`, `PROMPT_VERSION`: `4.3.0`
hoy en `main`, `4.4.0` en `feat/onboarding-cleanup` — lo que quitó la 4.0.0, en `:98-107`,
lo que agrupó la 4.2.0 en `:121-124`; ninguna de las dos añade un dato de la persona):
objetivos diarios y su reparto por comida, el tipo de objetivo (p. ej. `weight_loss`), la
forma de las comidas y el tiempo máximo de cocina, «vegetariano» o «vegano» y ninguna otra
forma de comer (`NAMEABLE_PATTERNS`), cocinas de una lista cerrada, alimentos que gustan
por su nombre de catálogo, nombres de platos queridos, rechazados y servidos, las
respuestas cerradas del check-in, y los alimentos de esa comida **ya filtrados** por
alergias, intolerancias y formas de comer. **No** lleva nombre, correo, `userId`, edad,
sexo, peso, altura, nada escrito por la persona, alergias ni salud declarada:
`apps/api/src/modules/ai` no importa nada de salud y un test lo asegura
(`health-boundary.spec.ts`). **Matiz**: el efecto sí entra —la celiaquía quita el gluten
del catálogo y un suplemento proteico añade la proteína en polvo (`0052`)—; el dato no.

**Desde la 4.4.0** (`0067`) el prompt **también** deja de recibir la forma y las horas del
día —a qué hora se despierta, se duerme y entrena, `dayShapeOf` en
`apps/api/src/modules/meal-plans/services/GenerationShared.ts:50-70`— y el presupuesto y
la frecuencia de cocina (`GenerationShared.ts:118,121`, `PoolPrompt.ts` líneas `178`,
`184`, `189`, `714-715`, `730` en `4.3.0`). No es que se ocultaran del prompt como el texto libre
de la 4.0.0 (§ 1.3 antigua, P0-3): estos seis (las cuatro que componen `dayShapeOf` más
`budget` y `cookingFrequency`) eran datos **estructurados**, ya sin palabras de la
persona, que sí llegaban al modelo. Lo nuevo es que **el onboarding deja de
preguntarlos**: no hay dato que ocultar porque no se recoge. Se suman otros cuatro campos
que el onboarding tampoco pide ya y que nunca llegaron al modelo — el estilo de desayuno y
la preferencia de ración (excluidos desde la 4.0.0, `GenerationShared.ts:101-104`), las
notas del horario laboral (igual) y el objetivo personalizado en texto libre
(`goals.customGoal`, que ninguna ruta de `apps/api/src/modules/ai` lee). En total, diez
columnas de `packages/database/src/schemas/profile.schema.ts` (`user_preferences`:
`breakfastStyle`, `budget`, `cookingFrequency`, `portionPreference`, `sleepEnd`,
`sleepStart`, `trainingDaysPerWeek`, `trainingTime`, `workScheduleNotes`; `goals`:
`customGoal`) que el onboarding sigue guardando en la base de datos pero **ya no
rellena**: minimización de la recogida, no solo del envío a un tercero (art. 5.1.c RGPD).
Las columnas no se eliminan en este cambio, pero tampoco quedan con su valor antiguo: la
migración `0043`, en el mismo cambio, pone esas nueve columnas y `customGoal` a `NULL` para
**todas** las cuentas, no solo las que se creen después. También mueve todo
`goals.type = 'custom'` a `'maintenance'` — un «objetivo personalizado» siempre calculó
exactamente igual que «mantenimiento» (`PROTEIN_G_PER_KG` en `core/domain/Nutrition/Nutrition.ts:21-28`
guarda el mismo 1,6 g/kg para los dos; `nutritionTargets` en `Nutrition.ts:279-283` no marca
ninguno de los dos como `losing` ni `gaining`, así que el objetivo calculado es el de
mantenimiento en ambos casos), de modo que a nadie le cambian los objetivos del plan por
este cambio de etiqueta. La baja de las columnas y del valor `'custom'` del enum en
Postgres es de la siguiente entrega, igual que ya decía `0067`; ver § 4.1 y § 9 P2-13
(cerrado).

**Hasta el 2026-09-26** el prompt iba a la pasarela OmniRoute del propietario, que lo
enviaba a modelos gratuitos cuyos proveedores entrenan o registran (`opencode/*-free`;
Muse Spark *Contributor*: «tus prompts y respuestas para entrenar futuros modelos de
Meta»; NVIDIA Nemotron gratuito: «logged… to improve NVIDIA products and services»,
informe `docs/reference/architecture/0002` P10) y, de reserva, a la cuota gratuita de
Gemini. Antes de la 4.0.0 (2026-09-25) llevaba además alergias en texto libre, la forma
de comer (halal, kósher) y el comentario del check-in (P0-3).

**Corrección sobre Gemini** (premisa P12 del informe `0002`). Este análisis agrupaba la
cuota gratuita de Gemini con los modelos que entrenan. No es exacto para un propietario
en el EEE. Las *Gemini API Additional Terms* (última actualización 23/03/2026,
`ai.google.dev/gemini-api/terms`, leídas el 2026-09-26) dicen: «If you're in the
European Economic Area, Switzerland, or the United Kingdom, the terms under "How Google
uses Your Data" in "Paid Services" apply to all Services, including Google AI Studio and
unpaid quota in the Gemini API, even though they are offered free of charge» — es decir,
**no entrena**. El problema era otro, y más claro: «You may use only Paid Services when
making API Clients available to users in the European Economic Area, Switzerland, or the
United Kingdom». Servir a los usuarios de NutrIA con la cuota gratuita **incumplía las
condiciones de Google**, fuera o no el paso de reserva. Y «You may not use the Services
in clinical practice, to provide medical advice…» vale también de pago (P1-10).

**Desde el 2026-09-26** producción corre con `AI_PROVIDER=stub` (`0064`;
`apps/api/src/modules/ai/ai.config.ts`, `case 'stub': return null`): **no se llama a
ningún modelo** y los platos salen de la biblioteca. Tampoco se dibujan ilustraciones:
solo existen con `AI_PROVIDER=google` y `AI_ILLUSTRATIONS=true` (`resolveImageModel`).
El proyecto 006 (en plan, 2026-09-27) las sustituye por imágenes realistas con su propia
clave y su propio flag: [`imagenes-de-platos.md`](./imagenes-de-platos.md).

**Después del cambio** (`0064`; runbook `docs/reference/ai-gateway.md` § 0), con
`AI_PROVIDER=openrouter`:

- La API llama directamente a `https://openrouter.ai/api/v1`; cualquier otro host se
  rechaza al arrancar y otra vez al entregar la clave (`openRouterBaseUrl`).
- Pide `google/gemma-4-31b-it` (`AI_MODEL`) y, de reserva dentro de la misma petición,
  `deepseek/deepseek-v4.1-flash` (`AI_FALLBACK_MODELS`; `openRouterRequest`, campo
  `models`). Decisión del propietario del 2026-09-26: `0064` tenía DeepSeek de principal y
  MiniMax M3 de reserva; MiniMax salió, Gemma entró de reserva y luego pasó a principal.
  Gemma 4 es el modelo de pesos abiertos de Google que aquí ejecutan DeepInfra o
  CoreWeave: no es la API de Gemini ni pasa por Google.
- Cada petición lleva, escrito encima de cualquier otro valor,
  `provider: { zdr: true, data_collection: 'deny', require_parameters: true }`
  (`NO_TRAINING_PROVIDER`), y ninguna cabecera de sesión ni id nuestro
  (`resolveCallSettings`: `sessionHeader: null`).
- En la cuenta (owner): entrenamiento apagado para modelos de pago y gratuitos, ZDR para
  toda la cuenta, el uso de entradas y salidas por OpenRouter apagado; la clave, solo con
  esos dos modelos, ZDR y un tope mensual. **Qué empresas pueden ejecutar el modelo**
  (P1-12): DeepInfra y CoreWeave, fijado el 2026-09-26 en la cuenta (*Allowed providers*,
  propietario) y en cada petición (`provider.only` desde `AI_PROVIDER_ONLY`, obligatorio al
  arrancar con `AI_PROVIDER=openrouter`: `apps/api/src/config/Env.validation.ts:506-507`,
  `ai.config.ts`, `providerOnly`).

**Quién puede recibir la petición**, según la API pública de OpenRouter consultada el
2026-09-26 (`/api/v1/endpoints/zdr`, `/api/v1/providers`): para DeepSeek V4.1 Flash,
**23 endpoints ZDR de 22 empresas**, entre ellas DeepInfra, CoreWeave y Together (sede en
EE. UU.), NextBit (España), **DekaLLM (sede y centro de datos en Indonesia)**, SiliconFlow
(sede en Singapur, centro en EE. UU.) y Makora (sin sede ni condiciones publicadas); para
Gemma 4 31B, 13 endpoints ZDR (DeepInfra —tres—, CoreWeave, Crusoe, Reka, Io Net,
ModelRun, SambaNova, SiliconFlow, Venice, Parasail, Novita); para MiniMax M3, ya fuera,
eran 9. Ni DeepSeek (China) sirve hoy su modelo en un endpoint ZDR, ni Google sirve Gemma
en OpenRouter. Con la lista cerrada solo quedan DeepInfra y CoreWeave para los dos
modelos. En la medición de `0064` respondieron DeepInfra, Together, CoreWeave,
DekaLLM y Sail Research — con dos personas sintéticas construidas de un id aleatorio
(`apps/api/scripts/bench-models.mjs:46-47`), así que no salió ningún dato de nadie.

### 1.4 Proyecto 004: qué ve y qué hace el profesional

- **Acceso**: solo a través de un enlace activo, resuelto por `CareController.withClient`,
  que escribe una fila en el rastro del cliente antes de leer (`0059`;
  `packages/core/src/controllers/Care/CareController.ts:678-704`). La lista de clientes
  escribe una fila por cliente (`CareRepository.roster`).
- **Lee** (`CareClientOverviewView`, `CareController.ts:193-200`): el **nombre** del
  cliente, el plan activo y su historial (platos), el progreso (adherencia por quincena,
  serie de peso con fechas, peso inicial y objetivo, tipo de objetivo, respuestas del
  check-in —hambre, dificultad, satisfacción, peso—, **no** el comentario libre), los
  objetivos con su derivación (metabolismo basal, factor de actividad, ritmo) y, **solo si
  el cliente marcó la línea de salud**, condiciones, medicación y suplementos. **No** ve
  alergias, intolerancias, correo, fecha de nacimiento ni altura como campos, aunque el
  metabolismo basal y los platos permiten inferir parte.
- **Escribe**: objetivos diarios dentro de los mismos límites (`PATCH clients/:linkId/targets`),
  la revisión antes de publicar (activada por defecto, `care.schema.ts` `reviewBeforePublish`),
  generar y regenerar planes (cuentan contra la cuota del cliente, `0060`), cambiar platos
  del plan pendiente y publicarlo. No escribe notas ni texto libre.
- **Consentimiento**: se guarda en `care_links` la versión (`CARE_CONSENT_VERSION = '1.0.0'`,
  `packages/core/src/entities/Care/Care.ts:12`), la fecha y `sharesHealth`. Una versión
  antigua se rechaza (`acceptInvitationSchema`, `Care.ts:61`). `sharesHealth` **solo se
  escribe al aceptar** (`packages/core/src/repositories/Care/CareRepository.ts:165`); no
  hay ruta para cambiarlo después.
- **Fin**: cualquiera de los dos termina el enlace; la siguiente petición es 404. Si el
  profesional borra su cuenta, sus enlaces se borran en cascada y su nombre queda en el
  rastro de cada cliente. Si el cliente borra la suya, se va todo, rastro incluido.
- **Correos**: invitación sin palabras de salud (`apps/api/src/modules/email/templates/CareInvitation.ts:37-47`),
  aviso de check-in al profesional con el nombre del cliente (`CheckInSubmitted.ts:23-27,61`).
- **Alta**: el propietario concede el rol en `/admin` con el número de colegiado; el
  profesional no recibe correo ni pantalla, y **no acepta nada** antes de abrir `/consulta`
  (`apps/api/src/shared/guards/Professional.guard.ts`; `apps/web/src/app/(app)/consulta/page.tsx`).

---

## 2. Roles por flujo

### 2.1 El criterio

- **Responsable** es quien determina fines y medios (art. 4.7 RGPD). **Encargado** es
  quien trata «por cuenta del responsable» (art. 4.8); no persigue fines propios.
- **Corresponsables** son los que «determinen conjuntamente los objetivos y los medios»
  (art. 26.1). El CEPD admite la corresponsabilidad por **decisiones convergentes** cuando
  «el tratamiento no hubiera sido posible sin la participación de ambas partes en los
  fines y los medios, en el sentido de que los tratamientos por las distintas partes son
  inseparables» (Directrices 07/2020, v2.0, apdo. 55), pero la **excluye** cuando dos
  entes intercambian datos sin fines ni medios comunes —eso es una transferencia entre
  responsables independientes (apdo. 70)— o comparten una infraestructura común
  determinando cada uno sus fines (apdo. 71). Tener o no acceso a los datos no es
  decisivo (apdo. 56, *Jehovan todistajat*).

### 2.2 Flujo por flujo

| Flujo | NutrIA | Dietista | Por qué |
| --- | --- | --- | --- |
| Cuenta, perfil, planes, progreso, check-ins, salud de cualquier usuario | **Responsable** | — | NutrIA decide para qué (planificar comidas) y cómo (código, alojamiento, IA). |
| Cuenta del profesional: nombre, correo, número de colegiado, suscripción | **Responsable** | interesado | Contrato B2B (art. 6.1.b) y verificación del título (art. 6.1.f). |
| Invitación: el profesional teclea el correo de su paciente | **Responsable** de la invitación | **Responsable** de haber comunicado el correo | El profesional decide invitar; NutrIA decide cómo se guarda (hash, 14 días) y qué dice el correo. NutrIA recibe el dato de un tercero → art. 14. |
| Aceptar el enlace: NutrIA pone datos del cliente a la vista del profesional | **Responsable** que **comunica** | **Responsable** que **recibe** | Es una comunicación a un tercero a petición del interesado y con su consentimiento (art. 6.1.a y 9.2.a). NutrIA la hace para su propio fin (prestar el servicio de consulta que vende); el profesional la usa para el suyo (su asistencia dietética). |
| Lo que el profesional hace con lo que ve: valorar, decidir objetivos, anotar en su historia clínica | — | **Responsable independiente** | Asistencia sanitaria de un profesional sanitario con secreto (art. 9.2.h y 9.3 RGPD; Ley 44/2003 art. 2.2.g; DA 17ª.1 LOPDGDD, que ampara en el 9.2.h los tratamientos regulados en las Leyes 41/2002 y 44/2003). |
| Objetivos y planes que el profesional escribe en la cuenta del cliente | **Responsable** del resultado | autor de la decisión | Se guardan en la cuenta del cliente, NutrIA decide su conservación (la cuenta), y el cliente los conserva al terminar el enlace (`practice.endConfirmBody`). |

### 2.3 Por qué NutrIA no es encargado del dietista

Para ser encargado, NutrIA tendría que tratar los datos **por cuenta** del profesional y
según sus instrucciones. No es así:

1. **El cliente ya era usuario de NutrIA antes del enlace**, con su propio contrato; el
   producto no admite clientes sin cuenta (PRD 004, *Out*).
2. **NutrIA decide la conservación y el destino**: al terminar el enlace los datos se
   quedan en la cuenta del cliente y el profesional pierde el acceso; el profesional no
   puede ordenar que se borren ni llevárselos.
3. **NutrIA persigue fines propios** con los mismos datos (el servicio B2C al cliente).
4. **No hay nada que sea «del profesional»** en el sistema: ni notas, ni historia
   clínica, ni exportación.

Esto cambiaría —y NutrIA pasaría a ser **encargado** para esa parte, con contrato del
art. 28— el día que el producto guarde algo que el profesional escribe *para su
práctica* (notas clínicas, una ficha, documentos) o que le deje exportar la ficha del
paciente. Queda escrito como condición en el acuerdo del profesional y en la lista del
abogado.

### 2.4 Por qué no es corresponsabilidad (y el riesgo de que lo sea)

La lectura contraria existe: el profesional *provoca* la comunicación al invitar, y NutrIA
diseña cómo se hace; ambos se benefician (*Fashion ID*, C-40/17). Mi lectura es que no hay
corresponsabilidad porque **los fines no son comunes**: NutrIA comunica para prestar su
servicio; el profesional recibe para su asistencia; y el tratamiento de cada uno es
separable (apdos. 70-71 CEPD). Es exactamente el caso del intercambio entre responsables
independientes.

Como la calificación es discutible **[abogado]**, el acuerdo del profesional
([`textos/01-acuerdo-profesional.md`](./textos/01-acuerdo-profesional.md), cláusula 4)
reparte expresamente la información (arts. 13-14) y los derechos entre las partes y
designa a NutrIA como punto de contacto; eso cumple el art. 26.1-2 si un tribunal
apreciara la corresponsabilidad, y no estorba si no.

---

## 3. Bases jurídicas y excepción del art. 9

| Finalidad | Datos | Base art. 6 | Excepción art. 9.2 |
| --- | --- | --- | --- |
| Cuenta y acceso | nombre, correo, contraseña (hash), sesión (IP, agente) | 6.1.b contrato | — |
| Calcular objetivos y generar planes | perfil corporal, objetivo, preferencias, alergias, intolerancias, forma de comer | 6.1.b | **9.2.a consentimiento explícito** — hoy **no existe** para estos datos (P0-2) |
| Condiciones, medicación, suplementos | los tres | 6.1.a | 9.2.a ✔ (existe) |
| Seguimiento: peso, adherencia, check-ins | serie de peso, marcas, respuestas | 6.1.b | 9.2.a (cubierto por el nuevo consentimiento) |
| Enviar a la IA para generar | lo del § 1.3 (prompt 4.4.0 una vez fusionada `0067`: sin identificadores, salud, texto libre ni creencias, y desde esa versión sin la forma y horas del día ni el presupuesto/frecuencia de cocina) | 6.1.b | Con el prompt 4.4.0 no se envía ningún dato del art. 9, salvo que «perder peso» lo sea en la lectura amplia **[abogado]**; si lo es, 9.2.a, cubierto por el consentimiento del perfil, cuyo texto (`profileConsent.ai`) informa del envío. Y solo a un **encargado** con contrato, sin entrenamiento ni retención (§ 4.3) |
| Compartir con el dietista | lo del § 1.4 | 6.1.a | 9.2.a ✔ (existe, con defectos de información: P1) |
| Salud compartida con el dietista | condiciones, medicación, suplementos | 6.1.a | 9.2.a, línea aparte ✔ |
| Uso del dietista para su asistencia | lo que ve | (suya) 6.1.b/6.1.c | (suya) 9.2.h |
| Cobro de Premium o del plan de consulta | id de cliente y suscripción, estado | 6.1.b; 6.1.c para facturación | — |
| Métricas de uso (`analytics_events`) | evento + `userId` | 6.1.f interés legítimo | — (no contiene salud) |
| Registros técnicos y errores (Sentry) | error, pila, ruta; sin cuerpo, usuario ni cabeceras (`apps/api/src/shared/observability/ErrorReporter.ts:45-110`) | 6.1.f | — |
| Correos de servicio (verificación, reseteo, recordatorio, aviso de check-in al profesional) | correo, nombre | 6.1.b | — |
| Avisos de seguridad de la cuenta («tu contraseña ha cambiado», «alguien ha intentado crear una cuenta con tu correo»…) | correo de la cuenta; nada de quien lo provocó | 6.1.f (cons. 49) y 32.1; 6.1.b para la persona de la cuenta | — (§ 4.1 bis y § 4.1 ter) |
| Frenos contra el abuso: intentos fallidos por dirección, correos por dirección, peticiones por IP (011, fases 7 y 8) | huella HMAC de la dirección + recuento; IP + ruta + recuento | 6.1.f (cons. 49) y 32.1 | — (§ 4.1 ter) |
| Buzón de sugerencias | texto libre | 6.1.b / 6.1.f | — |

**Por qué el consentimiento explícito y no otra excepción.** Para un servicio de consumo,
el 9.2.h exige que el tratamiento lo haga un profesional sujeto a secreto o se base en
un contrato con un profesional sanitario (art. 9.3); NutrIA no lo es. Ninguna otra letra
encaja. Condicionar el servicio a ese consentimiento es lícito porque el tratamiento **es
necesario** para el servicio: el art. 7.4 prohíbe condicionar a datos *no* necesarios
(CEPD, Directrices 05/2020 sobre el consentimiento, apdos. 26-36). Debe ser explícito
(una casilla propia, no premarcada, con los fines nombrados), registrado con fecha y
versión (art. 7.1), y retirable, sabiendo el usuario que retirarlo impide generar planes.

**Religión (halal/kósher).** El art. 9.1 LOPDGDD dice que «el solo consentimiento del
afectado no bastará» cuando la **finalidad principal** sea identificar su religión o
creencias. Aquí la finalidad es planificar comidas, así que el consentimiento basta; aun
así, lo proporcionado es no preguntar la religión: ofrecer «sin cerdo», «sin alcohol» y
«carne de sacrificio ritual» como restricciones neutras en vez de «Halal»/«Kosher» (P2).

**Menores.** El art. 7 LOPDGDD fija en **14 años** la edad para consentir; el art. 8 RGPD
(16, rebajable por ley) se refiere al consentimiento en servicios de la sociedad de la
información. Las condiciones exigían 16 (`es-ES.ts:1415`; el propietario lo subió a **18** el 2026-09-25) pero **nada lo comprueba**: la
fecha de nacimiento se acepta sin mínimo (`packages/core/src/entities/Profile/Profile.ts:112`;
`apps/web/src/components/OnboardingFlow/OnboardingFlow.tsx:350-357`). Un menor de 14 años
que se registra da un consentimiento de salud inválido y recibe un plan de adelgazamiento
—y la alimentación pediátrica es «no usuario» según `PRODUCT.md`—. P1 (P0 si existe ya una
cuenta así: el propietario debe comprobarlo).

---

## 4. Conservación y transferencias

### 4.1 Conservación

| Dato | Plazo | Estado |
| --- | --- | --- |
| Todo lo de la cuenta | mientras exista la cuenta; borrado inmediato en cascada | ✔ código |
| Consentimientos (versión y fecha, `health_data_consents`, `care_links`) | mientras exista la cuenta; sirven para demostrar el consentimiento (art. 7.1) | ✔ |
| Enlaces terminados (`care_links` en `ended`) | mientras existan ambas cuentas | ✔ (prueba del consentimiento); decirlo en la política |
| Rastro de accesos | mientras exista la cuenta del cliente; conserva el nombre del profesional aunque este se borre | ✔; decirlo al profesional (acuerdo, cl. 7) |
| Invitaciones | hasta responder; si no, 14 días + barrido diario (≤ 15) | ✔ (backend `cf87d75`) |
| `analytics_events` | indefinido | P2: fijar 24 meses y purgar |
| `plan_generation_jobs` (errores, llamadas a la IA sin contenido) | indefinido | P2: fijar 12 meses |
| Sesiones (IP, agente) | 30 días | ✔ |
| `audit_logs`, filas `auth.*` (`auth.password_changed`, `auth.sessions_revoked`; 011 fase 2) | **12 meses**, y al borrar la cuenta la fila queda sin persona (`actorId` y `subjectUserId` a `NULL`). Las demás filas de `audit_logs` (administración) siguen sin plazo. Ver § 4.1 bis | ✔ código desde la fase 7 (`AuditController.forgetExpiredAuthRows`, #213, `6b260239`, 2026-10-03), en el mismo cron diario; **política**: la frase ⟦si purga-seguridad⟧ se puede publicar en cuanto el lead confirme que #213 está desplegado (§ 0 quater del checklist) |
| `sign_in_failure` (freno por dirección, 011 fase 7): huella HMAC de la dirección, recuento, ventana | se borra al entrar con la contraseña buena o al restablecerla; si no, el barrido diario la borra tras un día sin intentos (como mucho unos dos días desde el último). **No** se borra al borrar la cuenta (no tiene FK, a propósito). Ver § 4.1 ter | ✔ código; **política: P2-14** |
| Presupuesto de correos (011 fase 8): filas `mail-budget:<huella>` en `verification`, recuento | caduca a la hora; el barrido diario (08:05 UTC) la borra: como mucho unas 25 h. Tampoco se borra con la cuenta. Ver § 4.1 ter | ✔ código; **política: P2-14** |
| Navegador que ya entró (011 fase 7b, `0089`): cookie `sign_in_device` (256 bits al azar) en el navegador; en `verification`, `sign-in-device:<sha256 del código>` con el id de la cuenta; diez por cuenta como mucho | 90 días desde la última entrada con contraseña desde ese navegador; al momento al cambiar o restablecer la contraseña, al cerrar las demás sesiones o todas, y al borrar la cuenta; las caducadas, el barrido diario. Los fallos desde ese navegador van a `sign_in_failure` con clave propia (HMAC del código), con el plazo del freno. Ver § 4.1 quater | ✔ código; **política: ⟦navegador-conocido⟧** |
| `rate_limit` de Better Auth: `ip\|ruta`, recuento, última petición | deja de contar al acabar su ventana (10-60 s) y Better Auth la borra cuando llega la siguiente petición que abre ventana | ✔ código; **política: P2-14** |
| Cuenta cuya dirección nadie confirmó (`user.emailVerified = false`) | **30 días desde el alta** (`UNCONFIRMED_ACCOUNT_RETENTION_DAYS`), y solo si no tiene sesión, ni fila en `profiles`, ni en `meal_plans`, ni ninguna fila de `audit_logs` que la nombre como actor o sujeto. Se borra la fila de `user` y, en cascada, la de `account` (nombre, correo, hash de la contraseña). Queda una fila `auth.unconfirmed_account_swept` sin actor, sin sujeto, sin `entityId`, sin IP y con `metadata` vacío. Ver § 4.1 quinquies | ✔ código (PR #250, `fbab7b1b`); **política: ⟦barrido-sin-confirmar⟧**, sin publicar todavía |
| Pagos (Stripe) | lo que exija la ley a Stripe; con *Managed Payments*, a Link como vendedor | ✔ política |
| Copias: restauración de Neon | ventana del plan (sin anotar en `deployment.md` § 8) | P2: anotarla y citarla |
| Copias: exportación manual | **indefinido, sin cifrar**, en el equipo del propietario | **P1**: cifrar, plazo (30 días) y borrado |
| Diez columnas que el onboarding dejó de rellenar (`0067`; `user_preferences.breakfastStyle/budget/cookingFrequency/portionPreference/sleepEnd/sleepStart/trainingDaysPerWeek/trainingTime/workScheduleNotes`, `goals.customGoal`) | puestas a `NULL` por la migración `0043` para todas las cuentas, en este mismo cambio; las columnas y el valor `'custom'` del enum se eliminan en la entrega siguiente | **P2-13**: cerrado (§ 9) |

### 4.1 bis Filas de seguridad de la cuenta en `audit_logs` (proyecto 011, fase 2; decidido el 2026-10-01)

*No soy abogado; esto es análisis para que el propietario lo revise con uno.*

**Qué se guarda.** `auth.password_changed` (`via`: `change` o `reset`) y `auth.sessions_revoked` (`scope`: `one`, `others`, `all`), con la fecha y el id de la cuenta. Ni token, ni IP, ni agente. Es un dato personal (dice algo de una persona identificable: cuándo cambió su contraseña) pero no de categoría especial (art. 9): no dice nada de salud.

**Base y finalidad.** Art. 6.1.f (interés legítimo en la seguridad de la cuenta; considerando 49) y art. 32.1: poder reconstruir, tras un posible robo de la cuenta, cuándo cambió la contraseña y cuándo se cerraron sesiones, y que la propia persona lo vea. Test de ponderación: el dato es mínimo (acción, fecha, sin IP), lo genera la propia persona y a ella le sirve; la expectativa razonable es que un servicio con cuenta lo anote.

**Plazo: 12 meses** (art. 5.1.e). Razón: la utilidad es de investigación de un robo, que se descubre en semanas o pocos meses; un cambio de contraseña de hace años no ayuda a nadie y aumenta lo que un acceso indebido a la base revelaría (art. 5.1.c, 32). 12 meses cubre una reclamación o un descubrimiento tardío sin guardarlo sin fin. Es una elección de proporcionalidad, no un plazo fijado por una norma: **a confirmar con un abogado** (no he encontrado plazo legal específico y no lo he verificado en una guía de la AEPD; el art. 5.1.e exige solo que se justifique el que se elija).

**¿Difiere del plazo actual de `audit_logs`?** Sí. Hoy ninguna fila de `audit_logs` se borra (§ 1, fila `audit_logs.actorId`; no hay purga en `packages/core` ni en `apps/api`: comprobado el 2026-10-01 por búsqueda de borrados sobre `auditLogs`). Las filas de administración quedan como están: las escribe el propietario, sin datos de terceros. Las `auth.*` sí describen a la persona de la cuenta, y por eso llevan plazo.

**Lo que debe construir la fase posterior.**
1. Una purga diaria que borre de `audit_logs` las filas con `action LIKE 'auth.%'` y `createdAt` anterior a 12 meses. Solo `auth.*`: no toca `account.*`, `professional.*`, `picture.*`, etc. Cuelga del mismo barrido diario de invitaciones, o de una tarea propia, con prueba de que no borra una fila de administración.
2. La fase 3 y 4 añaden `auth.2fa_*` y `auth.passkey_added`: entran por el mismo prefijo, sin cambiar el plazo.
3. Hasta que exista la purga, `/privacidad` NO publica el número (ver textos/02, ⟦registro-seguridad⟧); y el checklist de activación lo recoge como condición de la fase que lo promete.

**Condición para el código (backend).** La persona va solo en `actorId` y `subjectUserId` (ambos `ON DELETE SET NULL`, `platform.schema.ts:86`). **`entityId` no puede llevar el id de la cuenta** (no tiene FK: sobreviviría a su borrado como identificador de alguien que ya no existe; sería pseudonimización, no anonimato) ni `metadata` nada más que `via` o `scope`. Con eso, al borrar la cuenta la fila restante (acción, fecha, `via`/`scope`) no identifica a nadie (considerando 26) y es cierto lo que dice la política: «al borrarla, todo lo que hay en ella se borra».

**Correo «tu contraseña ha cambiado».** Es un mensaje de servicio ligado a la seguridad (art. 6.1.b/f; no es comunicación comercial, LSSI art. 21 no aplica) y no se puede desactivar. Lleva la hora y el tipo de dispositivo, sin IP ni palabra de salud: el tipo de dispositivo sale del agente de la sesión que ya se guarda (la política ya dice que guardamos el navegador de la sesión) y no se guarda en ningún sitio nuevo. Si el correo no repite la hora exacta con zona, que diga cuándo en la zona de la persona.

**¿Cambia `/privacidad`?** Sí, dos frases (textos/02, ⟦registro-seguridad⟧): (a) en «Qué datos recogemos», la categoría nueva, porque art. 13.1 exige informar de las categorías y de la finalidad; (b) en «Con quién compartimos», el correo de aviso de seguridad, porque la línea actual del proveedor de correo dice «avisos que actives» y este no se activa. No es un cambio «importante» en el sentido de «Cambios en esta política» (no hay dato nuevo de salud ni destinatario nuevo): se actualiza `updated`, sin correo a la gente. No hay versión de consentimiento que subir: el consentimiento de salud no cambia.

### 4.1 ter El alta no revela nada: frenos por dirección, aviso a la cuenta existente y confirmación obligatoria (proyecto 011, fases 7 y 8; 2026-10-03)

*No soy abogado; esto es análisis para que el propietario lo revise con uno.*

**Qué hace el código** (rama `feat/011-p8-signup`, `4f36ec5`, sobre la fase 7 ya fusionada en `6b26023`, #213):

1. **El alta responde igual para todas las direcciones** y no abre sesión (`auth.config.ts`, `autoSignIn: false`, `customSyntheticUser`). Si la dirección ya tiene cuenta, Better Auth calcula el hash de la contraseña tecleada solo para igualar el tiempo, no guarda nada de lo que se tecleó (nombre, contraseña) y llama a `onExistingUserSignUp` (`better-auth/dist/api/routes/sign-up.mjs:200-202`, versión instalada 1.7.6).
2. **Correo «Alguien ha intentado crear una cuenta con tu correo»** a la dirección de la cuenta existente, en segundo plano (`ExistingAccountMail.ts`, plantilla `ExistingAccountSignUp.ts`). Lleva un botón para entrar, la frase para quien entró con Google, el enlace para poner una contraseña nueva y «si no has sido tú, no tienes que hacer nada». Ni nombre tecleado, ni hora, ni dispositivo, ni IP, ni palabra de salud. La traza (`console.info`) lleva el id de la cuenta, no la dirección; `mail_sent` en `analytics_events` lleva solo el tipo, sin usuario (`Email.service.ts:118-119`).
3. **Entrar con contraseña exige la dirección confirmada** (`requireEmailVerification: true`). La contraseña buena de una cuenta sin confirmar recibe el mismo 401 que una mala (`UnconfirmedSignIn.ts`), cuenta en el freno como un fallo, y la dirección recibe un enlace nuevo (`sendOnSignIn: true`), solo si no está confirmada.
4. **Presupuesto de correos por dirección**: tres por hora y por tipo (`verification`, `existing-account`, `reset`), `core/domain/MailBudget`. La fila está en la tabla `verification` de Better Auth: `identifier = 'mail-budget:' + HMAC-SHA256(BETTER_AUTH_SECRET, 'mail-budget:<tipo>:' + dirección en minúsculas)`, `value` = recuento, `expiresAt` = fin de la hora. Sin dirección ni id de cuenta. Si la base no responde, el correo sale igual (`mail_budget_unavailable`).
5. **Freno por dirección** (fase 7, ya en `main`): `sign_in_failure` con la huella `sign-in-brake:` de la dirección, recuento y ventana; sin dirección ni FK (`auth.schema.ts:215-229`). Se borra al acertar, al restablecer la contraseña o, tras un día sin intentos, en el barrido diario.
6. **Límite por IP de Better Auth** (anterior a 011, `auth.config.ts:446-453`, `storage: 'database'`): la tabla `rate_limit` guarda `ip|ruta` en claro (`@better-auth/core/dist/utils/ip.mjs:228-230`), un recuento y la hora de la última petición; las filas pasadas de ventana las borra el propio Better Auth al abrir otra ventana (`dist/api/rate-limiter/index.mjs:130, 171-180`).

**¿Son datos personales las huellas?** Sí, **para NutrIA**. Quien tiene la clave puede recalcular la huella de cualquier dirección que conozca y encontrar su fila: es seudonimización (art. 4.5), no anonimato, y el considerando 26 dice que los datos seudonimizados «que cabría atribuir a una persona física mediante la utilización de información adicional, deben considerarse información sobre una persona física identificable». La STJUE C-413/23 P (SEPD c. JUR) que usamos para HIBP mira al **receptor** sin medios; aquí no hay receptor. Así que se describen como «huella», nunca como «anónimo» (el mismo error que P1-5 corrigió en `analytics_events`). La IP de `rate_limit` es dato personal sin más (STJUE C-582/14, Breyer). Ninguno es de categoría especial (art. 9): un recuento de intentos no dice nada de salud.

**Interesados.** No solo usuarios: el freno, el presupuesto y el límite por IP alcanzan también a direcciones sin cuenta y a quien pulsa los botones. Ninguna de esas filas lleva lo que permita escribir a esa persona (no hay dirección), y nadie las consulta salvo el propio código; dar la información del art. 14 a una dirección sin cuenta es imposible sin guardarla, y el art. 11.1 dice que el responsable no está obligado a mantener datos adicionales para identificar al interesado con el único fin de cumplir el Reglamento. Basta con que `/privacidad` lo explique (art. 14.5.b, esfuerzo desproporcionado; y es la misma página que lee quien sí tiene cuenta).

**Base.** Art. 6.1.f, con el considerando 49 («Constituye un interés legítimo del responsable del tratamiento interesado el tratamiento de datos personales en la medida estrictamente necesaria y proporcionada para garantizar la seguridad de la red y de la información…»), y el deber de seguridad del art. 32.1. Ponderación:
- **Interés**: impedir que se adivinen contraseñas de cuentas con datos de salud (R8 de la EIPD), que un extraño llene un buzón ajeno con correos nuestros, y que el formulario diga quién tiene cuenta. En un producto de dietas, saber que una persona tiene cuenta ya insinúa algo de su salud o su peso: la enumeración es un daño real, no teórico (es la misma lógica que R10 y M15 para la invitación).
- **Necesidad**: los frenos por IP no bastan contra muchas IP; el freno y el presupuesto necesitan saber «la misma dirección» sin guardarla, y la huella es lo mínimo que lo permite (art. 5.1.c, art. 25.1).
- **Impacto**: un recuento, sin contenido, que vive horas o un par de días y no sale de la base. Expectativa razonable: cualquier servicio con contraseña limita los intentos.
- **Resultado**: prevalece el interés, con el aviso en `/privacidad` (P2-14). El derecho de oposición (art. 21.1) existe, pero aquí caben «motivos legítimos imperiosos» (seguridad de las demás cuentas); y en la práctica no hay fila que buscar más allá de dos días.

**El correo «alguien ha intentado…»** es un mensaje de seguridad de la cuenta, de la misma familia que «tu contraseña ha cambiado» (§ 4.1 bis): base 6.1.f (cons. 49) o, para la persona de la cuenta, 6.1.b (una cuenta segura es parte del servicio). **No es comunicación comercial**: la LSSI (BOE, consolidado a 23/01/2025, anexo, letra f) la define como la que está dirigida a la promoción de bienes, servicios o la imagen de una empresa; este correo no promociona nada («si has sido tú, no necesitas otra: entra con la que ya tienes»), así que el art. 21 (prohibición de publicidad no solicitada) no aplica y no necesita baja. **Minimización (art. 5.1.c)**: no dice nada de quien lo intentó, ni siquiera la hora, y está bien así: la persona no lo necesita para actuar (lo único que puede hacer es entrar o restablecer), y el nombre tecleado lo eligió un extraño (podría ser un insulto o un dato de salud). **Frecuencia**: tres por hora como mucho, y en segundo plano. **Art. 13**: la dirección ya la tenemos y el fin está dentro de «avisos de seguridad de tu cuenta… que no se pueden desactivar» de «Con quién compartimos» (proveedor de correo); el ejemplo no tiene que enumerar todos los avisos. No hace falta frase nueva para el correo en sí.

**Lo que es cierto del texto del correo.** «No se ha creado ninguna cuenta y no ha cambiado nada de la tuya»: cierto (punto 1; la única fila nueva es la del presupuesto, que no es de la cuenta y no la cambia). P3: si la cuenta existente la creó otra persona con esta dirección y nunca se confirmó, quien recibe el correo lee «ya tiene una» sin saber de qué cuenta se trata; la salida existe (poner una contraseña nueva con el enlace del correo, que cierra las sesiones del otro, y entrar con ella), pero el correo no lo dice. Propuesta en § 9, P3.

**Plazos (art. 5.1.e, 13.2.a).** Presupuesto: una hora de vida, borrado por el barrido diario (`apps/api/vercel.json`, `5 8 * * *`): como mucho unas 25 h. Freno: hasta un día sin intentos más lo que tarde el barrido: como mucho unos dos días desde el último intento mientras dure un ataque, que es justo cuando hace falta. `rate_limit`: segundos o minutos. **Ninguna se borra al borrar la cuenta**, y no debe: si el borrado borrara la fila del freno, borrar y volver a crear la cuenta lo saltaría, y la propia ausencia de FK es lo que impide distinguir una dirección con cuenta de una sin ella. No contradice «al borrarla, todo lo que hay en ella se borra»: estas filas no están «en la cuenta» (son de una dirección, exista o no la cuenta), pero la política debe decir que existen y que caducan solas (P2-14).

**Confirmar la dirección antes de entrar con contraseña.**
- *Protección de datos*: mejora. Hasta ahora quien creaba una cuenta con la dirección de otro entraba en ella y podía escribir datos (incluso de salud) a nombre de esa dirección; desde este cambio, sin el buzón no entra. Es una medida del art. 32.1.b y del art. 25.
- *Consumidores*: el contrato se sigue celebrando al pulsar «Crear mi plan» (condiciones, «Cómo se celebra este contrato»); confirmar el correo es un paso para **entrar**, posterior, no un trámite de la contratación del art. 27.1.a LSSI. Las condiciones no prometen entrar sin confirmar. No hay que cambiar `/condiciones` (y cambiarlas obliga a subir `TERMS_VERSION`, `0071`). Hoy no hay ningún consumidor de pago (Stripe en modo prueba, pagos aplazados), así que nadie que haya pagado se queda fuera. Las cuentas antiguas sin confirmar reciben el enlace al primer intento de entrar, y el mensaje de error lo dice; Google y las llaves de acceso no cambian. Recomendación (no exigencia): antes de encenderlo, escribir una vez a esas cuentas con un enlace (mensaje de servicio, 6.1.b), una vez el propietario haya visto cuántas son (el PLAN ya lo pide).
- *Accesibilidad*: § 8 ya lo resuelve: NutrIA, microempresa, está exenta de los requisitos de la Ley 11/2023 (art. 3.3). Aun así, abrir un enlace del correo no es una «prueba de función cognitiva» (WCAG 2.2, 3.3.8), así que tampoco choca con el estándar que el producto sigue por decisión propia.
- *LSSI art. 28 (acuse de la aceptación)*: ahora que el alta acaba siempre en «revisa tu correo», el correo de verificación es el sitio natural para la línea que propone [`2026-09-29-aceptacion-de-los-textos-legales.md`](./2026-09-29-aceptacion-de-los-textos-legales.md) § 4.3. Sigue siendo P2 **[abogado]**; nada de este cambio lo empeora (el primer correo de la hora nunca lo retiene el presupuesto).

**Dos frases de la web que pueden no ser verdad** (no son textos legales; P3, a `backend-011p8`): `auth.signUpSent` («Te hemos escrito a {email}») y `auth.invalidCredentials` («te acabamos de enviar el enlace de nuevo») son falsas cuando el presupuesto retiene el correo (cuarto de la hora). Propuesta en § 9, P3.

**¿EIPD?** No hay tratamiento nuevo de salud ni criterio nuevo de la lista de la AEPD; se actualiza M13 y se añade el riesgo de enumeración a R10 ([`eipd.md`](./eipd.md), versión 0.4).

### 4.1 quater El navegador que ya entró no se frena (proyecto 011, fase 7b, `0089`; 2026-10-09)

*No soy abogado; esto es análisis para que el propietario lo revise con uno.*

**Qué hace el código** (PR #242, `3243cc7`). Al terminar una entrada con contraseña (con el segundo factor, si la cuenta lo tiene y lo pide), el navegador recibe la cookie `sign_in_device`: propia, `HttpOnly`, `SameSite=Lax`, `Secure` y `__Secure-` en producción, con 256 bits al azar, sin dirección ni id, 90 días que se renuevan en cada entrada con contraseña desde ese navegador. El servidor guarda en `verification` la huella SHA-256 del código y el id de la cuenta, diez por cuenta como mucho. En la siguiente entrada con contraseña, si la cookie es de la cuenta dueña de la dirección tecleada, sus fallos no cuentan para el freno de la dirección (§ 4.1 ter), sino para un freno propio de ese navegador, con los mismos límites (clave HMAC del código en `sign_in_failure`, sin dirección ni id); acertar borra esa clave, nunca la de la dirección. El límite por IP, la contraseña y el segundo factor siguen. Cambiar o restablecer la contraseña, cerrar las demás sesiones o todas (también al activar el segundo factor) y borrar la cuenta borran todas las de la cuenta. Llaves de acceso y Google no la ponen.

**LSSI art. 22.2: exenta.** Es una cookie «de seguridad del usuario» (AEPD, Guía de cookies, mayo 2024, § 1, nota 13: «las cookies utilizadas para detectar intentos erróneos y reiterados de conexión»; GT29, WP194, § 3.3: «other similar mechanisms designed to protect the login system from abuses»). No es una cookie de sesión persistente del § 3.2 del WP194 (las que no están exentas sin casilla), porque no deja entrar a nadie: sin la contraseña y el segundo factor no hay sesión, una cookie mala recibe el mismo 429 que ninguna, y una robada no da más intentos (su navegador tiene su propio freno). Solo impide que la espera que otro ha provocado contra la dirección castigue a quien ya entró desde ese navegador: protege el servicio que la persona pidió (entrar a su cuenta), y a la persona, no al sitio. No tiene otro uso. Se informa de ella en `/privacidad` (la guía recomienda hacerlo «al menos con carácter genérico»), sin casilla ni banner. **[abogado]** (§ 10, punto 14 a).

**Plazo: 90 días, proporcionado.** El WP194 espera que las de seguridad duren más que la sesión (§ 3.3) y las exime «for a limited persistent duration» (§ 5); la guía pide el mínimo según la finalidad (§ 2.3.b). La cookie solo actúa cuando hay que volver a escribir la contraseña, es decir, cuando la sesión (30 días, renovada con el uso) ha caducado: con menos de 30 días no estaría nunca cuando hace falta; 90 son tres vidas de sesión, y al caducar quedan las salidas de siempre (esperar como mucho 15 minutos, una llave, Google, restablecer). **[abogado]** (§ 10, punto 14 b); si prefiere menos, 30 o 60 días es una constante (`SIGN_IN_DEVICE.maxAgeSeconds`) y dos frases de la política.

**RGPD.** La fila (huella + id de la cuenta) es dato seudonimizado para NutrIA (art. 4.5, cons. 26), no de categoría especial. Base: art. 6.1.f con el cons. 49 y art. 32.1, la misma que el freno del que es parte; la ponderación del § 4.1 ter vale y aquí pesa todavía más a favor, porque la medida beneficia a la propia persona. El párrafo publicado de interés legítimo («proteger las cuentas: … los frenos contra el abuso») ya la cubre; no hay finalidad nueva (art. 13.3 no entra). Oposición (art. 21.1): basta con borrar la cookie del navegador, y escribirnos sigue valiendo. Minimización (5.1.c): ni dirección, ni IP, ni agente; diez por cuenta.

**El borrado de la cuenta.** Pedido el 2026-10-09 (P2) y hecho en el mismo PR: `deleteUser.beforeDelete` llama a `UserController.forgetDevices`, que borra estas filas y las de «confiar en este dispositivo» (`trustedDevicesOf`), que tenían la misma forma. A diferencia de las del freno, no hay razón de seguridad para dejarlas: se borran por el id de la propia cuenta y no dicen nada de ninguna dirección; un id de cuenta que sobrevive a su borrado sería seudonimización, no anonimato (la línea del § 4.1 bis). Es «best effort» (`.catch`): si falla, la fila caduca a los 90 días con un id que ya no lleva a nadie; riesgo residual aceptable. Las filas del freno propio del navegador no llevan cuenta y caducan como las del freno.

**¿Cambia `/privacidad`?** Sí: un añadido a la viñeta de los frenos (qué se guarda, cuánto, cuándo se anula) y una frase en «Cookies», el mismo día que el PR llegue a producción, porque la persona no la pide y el art. 13.1 exige decirlo desde la recogida. **No es un cambio «importante»**: sin dato de salud, sin destinatario ni transferencia nuevos, sin finalidad nueva. Se actualiza `privacy.updated`, sin correo; no hay versión de consentimiento ni de condiciones que subir.

**¿EIPD?** No: nada de salud y ningún criterio nuevo de la lista de la AEPD. Es una medida más de M13 (frenos con huella); el riesgo que añade lo cerró la revisión de invariantes: un navegador robado con la cookie tiene su propio freno, con los mismos límites, y cerrar las demás sesiones lo anula.

### 4.1 quinquies La cuenta que nadie confirmó se borra a los treinta días (proyecto 011, seguimiento del barrido, `0092`; 2026-10-09)

*No soy abogado; esto es análisis para que el propietario lo revise con uno.*

**Qué hace el código** (PR #250, commit leído `fbab7b1b`, ya en `main`). Una vez al día, dentro del cron que ya existía (`/api/v1/cron/sweep-verifications`, `apps/api/vercel.json`, `5 8 * * *`), `AuthRetentionService.forget` añade un tercer paso (`apps/api/src/modules/auth/services/AuthRetention.service.ts:32`): `UserController.sweepUnconfirmedAccounts` (`packages/core/src/controllers/User/UserController.ts:432`) calcula el corte —`now` menos `UNCONFIRMED_ACCOUNT_RETENTION_DAYS = 30` (`packages/core/src/entities/Audit/Audit.ts:70`)— y `UserRepository.deleteStaleUnconfirmed` (`packages/core/src/repositories/User/UserRepository.ts:345`) ejecuta **un solo** `DELETE … WHERE … RETURNING` dentro de una transacción. El `WHERE` es `staleUnconfirmedWhere` (`:181`): `emailVerified = false`, `createdAt` anterior al corte y cuatro `NOT EXISTS` correlacionados contra la propia fila de `user` — ninguna sesión, ninguna fila en `profiles`, ninguna en `meal_plans` y **ninguna** fila de `audit_logs` que la nombre como `actorId` o como `subjectUserId`. Por cada id que devuelve el `RETURNING`, y en la misma transacción, se escribe una fila `auth.unconfirmed_account_swept` con `actorId: null`, `metadata: {}` y `subjectUserId` = ese id.

**Qué desaparece.** La fila de `user` (nombre, correo, `emailVerified`) y, por `onDelete: 'cascade'`, la de `account`, que es donde vive el hash de la contraseña y el proveedor del alta (`packages/database/src/schemas/auth.schema.ts:84-101`). El enlace de confirmación no es una fila: Better Auth 1.7.7 lo firma como JWT (`node_modules/better-auth/dist/api/routes/email-verification.mjs:14-20`), así que no queda ninguna fila con la dirección. **No** desaparecen —y ya están publicados— la huella del freno por dirección y la del presupuesto de correos, que caducan solas (viñeta ⟦frenos⟧ de `/privacidad`; § 4.1 ter), ni las copias de seguridad de Neon (§ 4.1).

**Qué queda, y por qué no identifica a nadie.** `audit_logs.actorId` y `audit_logs.subjectUserId` son `onDelete: 'set null'`, no `cascade` (`packages/database/src/schemas/platform.schema.ts:106,111`): la fila se escribe nombrando la cuenta y, en el instante en que el `DELETE` de la misma transacción corre, esa columna se lee `null`. `AuditRepository.record` escribe `entityId: null` cuando el llamador no lo da (`packages/core/src/repositories/Audit/AuditRepository.ts:122`) y nunca escribe `ipHash`. Lo que sobrevive es, literalmente, «el día X se borró una cuenta sin confirmar»: acción, fecha, `entity: 'user'` y `metadata` vacío. Eso es información anónima en el sentido del considerando 26, última frase («los principios de protección de datos no deben aplicarse a la información anónima, es decir información que no guarda relación con una persona física identificada o identificable»), así que la fila que queda no es ya dato personal y no necesita plazo. Es la misma línea que el § 4.1 bis exigía al código: el id de la cuenta no puede acabar en `entityId`, que no tiene clave ajena y sobreviviría como seudónimo de alguien que ya no existe.

**¿Va en la sección de plazos de la política? Sí.** El art. 13.2.a obliga a informar «el plazo durante el cual se conservarán los datos personales o, cuando no sea posible, los criterios utilizados para determinar este plazo» (texto del DOUE en BOE, `DOUE-L-2016-80807`). Hoy `/privacidad` dice de la cuenta solo «Mientras tu cuenta exista», y eso ha dejado de ser el plazo completo: para una cuenta sin confirmar el plazo es más corto y **condicionado**. Las cuatro condiciones son precisamente «los criterios», así que el párrafo las enumera en vez de publicar un número suelto ([`textos/02`](./textos/02-politica-privacidad.md), ⟦barrido-sin-confirmar⟧, en los dos idiomas). No cabe en la viñeta de los frenos (eso son filas de una dirección, no de una cuenta) ni en «Qué datos recogemos» (no se recoge ningún dato nuevo).

**Base jurídica: ninguna nueva.** Borrar es tratamiento (art. 4.2 incluye la supresión), pero no es un fin nuevo: es el final de la vida del mismo fin con el que se recogieron los datos (tener una cuenta), y lo que lo ordena es el art. 5.1.e —«mantenidos de forma que se permita la identificación de los interesados durante no más tiempo del necesario para los fines del tratamiento»— con el art. 5.1.c y, para el interesado, el art. 17.1.a («los datos personales ya no sean necesarios en relación con los fines para los que fueron recogidos»). Por tanto **el art. 13.3 no entra** (no hay fin ulterior del que informar) y no hay base del art. 6 que añadir a la política. La fila de auditoría, mientras nombra la cuenta —los milisegundos que dura la transacción—, se apoya en el art. 6.1.f con el art. 5.2 (poder demostrar que el barrido se hizo y cuántas veces), la misma base y la misma finalidad que el resto del rastro (`0071`); después deja de ser dato personal. Si un abogado prefiere que la política cite una base para la supresión, la que mejor encaja es el art. 6.1.c (obligación legal del responsable que nace del propio Reglamento) — pero no lo creo necesario y no lo publicaría: **[abogado]**, § 10 punto 15 a.

**El plazo: treinta días, y por qué es proporcionado.** No hay norma que fije un plazo para una cuenta sin confirmar; el art. 5.1.e solo exige justificar el que se elija (igual que los doce meses del § 4.1 bis). Treinta días es más que de sobra para que la persona que se dio de alta abra su correo (el enlace caduca en una hora, pero `sendOnSignIn` le manda uno nuevo en cada intento de entrar, `auth.config.ts:405`), y lo bastante corto para que una cuenta creada por un extraño con la dirección de otra persona no siga ahí meses con una contraseña que solo el extraño conoce (el residuo que `0092` cierra). Se cuenta desde `user.createdAt`, no desde el último correo enviado: quien pide un enlace nuevo el día 29 se borra igual el día 31 — es coherente con lo que dice el correo («a los treinta días del alta») y no le quita nada, porque volver a registrarse es gratis y no había nada dentro. **[abogado]** si se quiere discutir el número, § 10 punto 15 b: es una constante (`UNCONFIRMED_ACCOUNT_RETENTION_DAYS`) y dos frases de la política.

**El correo de confirmación ya lo promete, y por eso la política no puede callarlo.** `apps/api/src/modules/email/templates/VerifyEmail.ts` dice, en los dos idiomas: «Si no te has registrado, no confirmes nada: ignora este mensaje y, al mes, borramos el correo que nadie confirma junto con su registro.» / «…we delete an address nobody confirms, with its sign-up, after thirty days.» Es una promesa de conservación hecha a una persona concreta en el momento de la recogida; si la política solo dijera «mientras exista tu cuenta», el producto diría dos cosas distintas sobre lo mismo y la única versión escrita del plazo viviría en un correo que no se puede volver a consultar. Eso choca con el art. 5.1.a (lealtad y transparencia) y con la función del art. 13. **Los dos textos coinciden en el fondo**; discrepan en la forma: el inglés dice «after thirty days» y el español «al mes», que no es lo mismo (febrero son 28 días; el código son 30 exactos). Es P3 para `backend`: que el español diga «a los treinta días», como el inglés y como la política.

**El límite de la promesa, que hay que conocer.** La cuarta condición —ninguna fila de `audit_logs` que nombre la cuenta— hace que **una cuenta que el propietario haya abierto desde la consola no se barra nunca**, porque abrirla escribe `account.activated` con `subjectUserId` (`UserController.ts:208`). Eso es bueno para la persona real que espera su activación, y es exactamente lo que impide que el barrido se lleve una cuenta que alguien decidió abrir a mano. Pero tiene la otra cara: si el propietario abre una cuenta cuya dirección nadie ha confirmado —y hoy la consola no se lo impide—, esa cuenta queda fuera del barrido para siempre, y la promesa del correo deja de ser verdad para ella. Dos consecuencias, las dos recogidas donde toca: (a) en la operativa, **el propietario solo activa cuentas confirmadas** (el filtro `confirmed` de la consola lo dice), casilla nueva del [`checklist-activacion.md`](./checklist-activacion.md) § 0 septies; (b) en el código, el barrido debería mirar además `user.activatedAt`, para no depender de que la activación dejara rastro — las activaciones anteriores a `0071` (proyecto 008, finales de septiembre de 2026) no lo dejaron, así que hoy una cuenta abierta entonces, nunca confirmada, sin perfil, sin plan y con la sesión ya caducada **sí** entra en el barrido. Es un P2 enviado a `backend` (`UserRepository.ts:181`, añadir `isNull(user.activatedAt)`); no bloquea la publicación del texto, porque el texto describe lo que el código hace hoy.

**Antes de la primera ejecución.** El barrido no tiene flag: corre con el despliegue, a las 08:05 UTC. Su primera carrera borra de golpe **todas** las cuentas sin confirmar de más de treinta días que no tengan nada, incluidas las de personas reales que se dieron de alta antes de que el correo prometiera este plazo y antes de que la política lo dijera. No es un daño de protección de datos (borrar es la opción protectora, y no se pierde ningún dato suyo porque no había ninguno), pero sí es gente que pierde su sitio en la cola sin que nadie se lo haya dicho. Lo proporcionado, y lo que recomiendo: el propietario mira **en solo lectura** cuántas son antes de la primera carrera —la casilla § 0 quinquies del checklist ya le pedía ese recuento para la fase 8 y sigue sin marcar— y, si son más de unas pocas, les escribe una vez con un enlace de confirmación (mensaje de servicio, art. 6.1.b) antes de dejar que el cron corra. § 0 septies del checklist.

**LOPDGDD art. 32 (bloqueo): cuestión abierta, no bloqueante.** El art. 32.1 (LO 3/2018, BOE-A-2018-16673, consolidada a 27/12/2025) dice que «el responsable del tratamiento estará obligado a bloquear los datos cuando proceda a su rectificación o supresión», y el 32.2 define el bloqueo como identificarlos y reservarlos, impidiendo su tratamiento salvo para jueces, Ministerio Fiscal y administraciones competentes durante los plazos de prescripción, tras lo cual hay que destruirlos. Leído al pie de la letra, cualquier supresión —también una automática por plazo— pediría guardar una copia bloqueada. Mi lectura es que no procede aquí: el precepto está pensado para la supresión que nace del derecho del interesado o de una rectificación, su finalidad es conservar prueba frente a reclamaciones, y aquí no hay nada que pueda fundar una reclamación (ni pago, ni contenido, ni salud, ni consentimiento que demostrar), mientras que guardar bloqueada justo la fila que se borra por innecesaria choca con los arts. 5.1.c y 5.1.e; el propio art. 32.5 permite a la AEPD exceptuar el bloqueo cuando conservar los datos, incluso bloqueados, generara un riesgo elevado. La fila anónima de auditoría deja, además, constancia de que el barrido ocurrió. **[abogado]**, § 10 punto 15 c — y conviene saber que **la pregunta no es nueva**: el borrado de cuenta a petición de la persona («todo lo que hay en ella se borra al momento») tampoco bloquea nada, así que la respuesta vale para los dos y no es razón para parar este barrido.

**¿Cambia `/condiciones`? No.** El contrato se celebra al pulsar «Crear mi plan» (§ 4.1 ter), y lo que el barrido borra es una cuenta en la que el servicio nunca pudo empezar: sin confirmar no se puede entrar (`requireEmailVerification: true`, `auth.config.ts:336`), así que no hay prestación que interrumpir, ni pago, ni contenido que se pierda, ni plazo de desistimiento en juego (TRLGDCU, RDL 1/2007, consolidado a 28/02/2026). Las condiciones no prometen que una cuenta sin confirmar dure para siempre, y cambiarlas obligaría a subir `TERMS_VERSION` y a avisar a todo el mundo (`0071`) para añadir una frase que ya está, mejor dicha, en el correo y en la política. Recomiendo no tocarlas; si el propietario quiere cinturón y tirantes, la frase iría en «Tu cuenta» y entonces sí sube `TERMS_VERSION`.

**¿Es un cambio «importante» de la política? No.** El mismo test que en § 4.1 bis y § 4.1 quater: ningún dato nuevo, ningún destinatario nuevo, ninguna transferencia nueva, ningún fin nuevo — y el plazo se acorta, lo que favorece a la persona. Se publica el párrafo y se actualiza `privacy.updated` (hoy, 9 de octubre de 2026, ya es la fecha en vivo: si sale hoy no cambia; otro día, la fecha de ese día). **Sin correo de aviso a nadie**, y **ninguna versión que subir**: no `HEALTH_CONSENT_VERSION`, no `CARE_CONSENT_VERSION`, no `PROFESSIONAL_AGREEMENT_VERSION`, no `TERMS_VERSION`. Lo único que es urgente no es el aviso, sino el orden: el texto antes de la primera cuenta borrada.

**¿EIPD? No.** Ningún tratamiento nuevo de datos de salud y ningún criterio nuevo de la lista de la AEPD (art. 35.4). El barrido es una medida de minimización que **reduce** el riesgo R10 (suplantación por alta con la dirección de otro) y no añade ninguno: lo que borra no se puede recuperar para perjudicar a nadie, y lo que deja no identifica. No hace falta revisar [`eipd.md`](./eipd.md); se anotará en su próxima revisión ordinaria como medida del M13.

### 4.2 Transferencias internacionales (arts. 44-49)

| Destinatario | Rol | Dónde | Garantía que hay que comprobar |
| --- | --- | --- | --- |
| Vercel (alojamiento; funciones en `fra1`) | encargado | UE para el cómputo; empresa de EE. UU. | DPA de Vercel + EU-US Data Privacy Framework (DPF) o cláusulas tipo |
| Neon (base de datos, `eu-central-1`, `docs/reference/deployment.md:100-106`) | encargado | UE; empresa de EE. UU. | DPA + DPF: Neon, LLC es entidad cubierta de la certificación de Databricks, Inc. (lista del DPF, UE-EE. UU. activa, consulta 2026-09-26) |
| **OpenRouter, Inc.** (Nueva York), tras el cambio de `0064` | **encargado** (enruta y cobra; no guarda el contenido con el registro apagado); responsable solo de su categorización anónima (§ 4.3) | EE. UU. (Google Cloud, regiones de EE. UU., según el anexo 2 de su DPA Enterprise) | **No** está en el DPF (consulta 2026-09-26: 0 resultados). Cláusulas tipo del art. 46 (su política de privacidad, 31/08/2026; DPA Enterprise § 13.2, módulo 2), en el DPA que sus condiciones § 10.2 incorporan para uso comercial — **texto por obtener** (P1-11) |
| Empresa que ejecuta el modelo (propuesta: DeepInfra, CoreWeave) | según OpenRouter **no son subencargados** (DPA Enterprise § 11.10); funcionalmente tratan por cuenta de NutrIA (§ 4.3) | EE. UU. (sede y centros); hoy la cuenta admite también Indonesia y empresas sin sede publicada (P1-12) | Ninguna en el DPF (consulta 2026-09-26). Sus compromisos (retención cero, sin entrenamiento; CoreWeave con cláusulas tipo) van con OpenRouter, no con NutrIA. La petición no lleva nada que identifique (C-413/23 P) — P2-11 |
| Pasarela OmniRoute (servidor del propietario) | medio propio | donde esté alojada | **Fuera de producción** desde `0064`; solo experimentos |
| Proveedores de la pasarela hasta el 2026-09-26 (`opencode/*-free`, OpenRouter `:free`, Gemini gratuito) | terceros que entrenaban o cuyas condiciones prohibían este uso | EE. UU. | Ninguna. **Ya no reciben nada** (`stub` desde el 2026-09-26) |
| Google (correo SMTP) | encargado | UE/EE. UU. | Términos de Google Workspace/Gmail. **[abogado]**: una cuenta Gmail de consumo no ofrece DPA; mejor un proveedor transaccional con DPA |
| Stripe / Link | encargado para cobrar; **vendedor** con *Managed Payments* | UE (Stripe Technology Europe) y EE. UU. | DPA de Stripe; Stripe, LLC en el DPF (activa, 2026-09-26); con *Managed Payments*, Link es responsable de su venta |
| Sentry (si `SENTRY_DSN`) | encargado | EE. UU. o UE según la región elegida | DPA; Sentry.io en el DPF (activa, 2026-09-26); elegir región UE; no recibe datos personales por diseño |
| Servicios push del navegador (Google, Apple, Mozilla) | transmisión cifrada extremo a extremo (VAPID) | EE. UU. | el contenido va cifrado; basta con informar |

La política actual no dice nada de transferencias (art. 13.1.f) — P1.

### 4.3 La IA, en concreto

Para enviar datos de salud o de religión a un modelo hace falta, a la vez:

1. que el proveedor sea **encargado** (art. 28): contrato que prohíba usar los datos para
   fines propios, **sin entrenamiento ni revisión humana**, con retención cero o mínima;
2. una garantía de transferencia (DPF o cláusulas tipo);
3. que la política lo diga.

Un modelo «gratuito» que entrena con los prompts **no es encargado**: usa los datos para
sus propios fines, así que es un **tercero responsable** al que se *comunican* datos de
salud sin base. El CEPD y el TJUE (C-413/23 P, *CEPD c. JUR*, 4/9/2025) admiten que datos
seudonimizados pueden no ser personales **para el receptor** que no puede reidentificar;
aquí el texto libre de alergias («alergia al kiwi y al látex») y el comentario del
check-in pueden identificar a alguien combinados con otros datos, y no apostaría el
producto a esa lectura **[abogado]**.

La salida más barata y la más limpia son la misma: **no enviar texto libre del
interesado a ningún modelo que entrene** y enviar la forma de comer como restricción de
ingredientes, no como etiqueta religiosa. Ver P0-3.

### 4.4 OpenRouter y quien ejecuta el modelo (2026-09-26, para el cambio de `0064`)

Las tres condiciones del § 4.3, una por una, contra lo que dicen hoy los propios
proveedores (páginas leídas el 2026-09-26; fechas de cada una entre paréntesis).

**a) OpenRouter es encargado, con un contrato que falta tener en la mano.**

- **Qué hace**: recibe la petición del servidor de NutrIA, elige la empresa que ejecuta el
  modelo y cobra. «OpenRouter does not store your prompts or responses, *unless* you opt
  in» (documentación, *Data collection*); guarda metadatos: tokens, latencia, coste. Con
  el registro de prompts apagado no guarda el contenido. Para eso actúa por cuenta de
  NutrIA: **encargado** (art. 4.8).
- **El contrato**: sus condiciones (última actualización 31/08/2026), § 10.2: «If you are
  part of and represent an organization in entering into these Terms or use the Service
  for commercial, for-profit purposes, please read the OpenRouter Data Processing
  Agreement ("DPA")… The DPA is incorporated by reference into, and made a part of, these
  Terms». NutrIA es actividad económica (§ 6): le aplica. **Pero** el texto de ese DPA no
  es público (se pide en `trust.openrouter.ai`) y el centro de ayuda de OpenRouter dice
  que el DPA firmado es para clientes Enterprise y que el resto solo puede leerlo (no pude
  abrir el artículo, que está tras una protección anti-bots; lo cito por el resumen del
  buscador y por el informe `0002`, P14). El DPA de Enterprise sí es público (anexo A del
  *Enterprise Access Agreement*, 22/06/2026): cláusulas tipo, módulo 2 (§ 13.2); aviso de
  brechas «without undue delay, and in any case, within seventy-two (72) hours» (§ 7);
  30 días de preaviso y derecho de oposición a subencargados nuevos (§ 5.2-5.3); borrado
  en 30 días hábiles a petición (anexo 2).
- **Mi lectura**: las condiciones son el contrato y dicen que el DPA forma parte de él; un
  artículo de ayuda no lo deroga. Pero el art. 28.3 exige un contrato «por escrito» con un
  contenido mínimo, y el responsable tiene que poder demostrarlo (arts. 5.2 y 24): un DPA
  cuyo texto no tiene no le sirve. **→ P1-11, bloquea el cambio** hasta tener el texto y
  la confirmación de OpenRouter de que aplica a su cuenta **[abogado]**.
- **Transferencia**: OpenRouter, Inc. (169 Madison Avenue, Nueva York) **no está en el
  DPF** (lista oficial, 2026-09-26). Su política de privacidad (31/08/2026) se apoya en
  «standard contractual clauses approved by the European Commission under Article 46 of
  the GDPR» y dice que los datos van «to our servers in the US». El enrutamiento dentro de
  la UE solo existe para Enterprise.

**b) Quien ejecuta el modelo: no es subencargado según OpenRouter; hay que nombrarlo y
elegirlo.**

- DPA Enterprise § 11.10: «AI Model Providers, acting in their capacity as third party
  model providers, are not subcontractors of OpenRouter»; y § 2.2.3 deja al cliente
  apartarse de los que entrenan «or select "Zero Data Retention"». Las condiciones, § 5.1:
  el cliente acepta las condiciones de cada modelo y «You are solely responsible for
  reviewing the Model Terms».
- **Funcionalmente** esas empresas tratan la petición por cuenta de NutrIA y para su fin,
  sin fines propios (ZDR, sin entrenamiento): son lo que el CEPD llamaría subencargados
  (Directrices 07/2020, v2.0: la calificación es funcional, no la que ponga el contrato).
  El art. 28.4 pide que el subencargado quede obligado por contrato a lo mismo; OpenRouter
  no asume esa cadena. Sus compromisos van con OpenRouter, no con NutrIA:
  - **DeepInfra** (condiciones, 17/08/2026): «Provider will not use Customer Data to
    train, fine-tune, or otherwise improve any model… Provider will not retain, store, or
    log any Customer Data submitted to or generated by the Services beyond the period
    strictly necessary to process and return the applicable request»; política de
    privacidad (15/08/2026): «processed outside of your jurisdiction, specifically in the
    United States». Sirve los dos modelos en ZDR.
  - **CoreWeave** (política de privacidad, 24/02/2026): «Customers are controllers of
    Customer Data»; su DPA, incorporado a sus condiciones, con cláusulas tipo
    responsable-encargado y encargado-encargado. Centros en EE. UU. Sirve los dos modelos
    en ZDR (Gemma 4 31B en fp4).
  - **Together** (política, 17/12/2025): ZDR en ajustes y cláusulas tipo; **pero** sus
    condiciones § 4 prohíben «transmit or provide to the Company any financial or medical
    information of any nature or any sensitive personal data (e.g., … birth dates…)».
    NutrIA no envía nada de eso, pero un servicio con planes para pacientes de un
    dietista es mala compañía para esa cláusula (P3).
  - Ninguno está en el DPF (2026-09-26).
- **Por qué, aun así, el riesgo es bajo** **[abogado]**: la petición no lleva nada que
  identifique a una persona —ni id, ni su IP (la conexión es de OpenRouter), ni nombre,
  edad, peso o texto libre—. El TJUE (C-413/23 P, *CEPD c. JUR*, 4/9/2025) admite que un
  dato seudonimizado no sea personal para el receptor que no tiene medios razonables de
  reidentificar, aunque lo siga siendo para quien lo envía; y dice que la obligación de
  informar del destinatario se aprecia **desde el responsable y al recoger el dato**. Por
  eso la política tiene que **nombrar** a esas empresas y su país (art. 13.1.e-f) — P2-11
  para lo demás.
- **Lo que no se puede justificar es no saber quiénes son.** Con la cuenta como está, la
  petición puede ir a 22 empresas (§ 1.3), una con sede y centro en Indonesia —sin
  decisión de adecuación— y otra sin condiciones publicadas. La política no puede
  nombrarlas ni dar su garantía. **→ P1-12, bloquea el cambio**: lista cerrada de
  proveedores en la cuenta (ajustes de privacidad, *Allowed providers*, que es el techo de
  toda petición según la documentación de *provider routing*). Propuesta: `deepinfra` y
  `coreweave` — los dos sirven los dos modelos en ZDR con salida estructurada, tienen sede
  y centros en EE. UU. y los compromisos citados. **Hecho el 2026-09-26**: el propietario
  la fijó en la cuenta y el código la exige en cada petición (`AI_PROVIDER_ONLY`).

**c) El uso propio de OpenRouter: una muestra, sin cuenta, para sus estadísticas.**

- Condiciones § 6.5: «OpenRouter uses a hosted model for categorizing Inputs, which does
  not store or log any Inputs provided to it… you grant… license… to use… your Inputs in
  anonymized form, solely for tracking and sharing user metrics on the Site».
  Documentación: «samples a small number of prompts for categorization… If you are not
  opted in to OpenRouter use of inputs/outputs, any categorization of your prompts is
  stored completely anonymously and never associated with your account or user ID». El
  modelo que clasifica corre en Google Cloud (lista de subencargados, «NLP
  Categorization»). La documentación pública no ofrece apagarlo.
- No es entrenamiento ni retención del texto, pero sí un **uso propio** de una muestra: la
  frase del borrador «sin usarlos para entrenar ni para nada propio» (variante A de
  [`textos/02`](./textos/02-politica-privacidad.md)) **sería falsa**. Tratar un dato para
  anonimizarlo es tratarlo (GT29, Dictamen 05/2014 sobre anonimización); para eso
  OpenRouter decide el fin y es **responsable** (art. 28.10) **[abogado]**. → P2-12: la
  política lo dice; el propietario decide si cabe en su regla («no quiero entrenar ningún
  modelo»: no entrena). **Decidido el 2026-09-26**: el propietario la acepta con aviso en
  la política (estado 2) y pedirá por escrito a OpenRouter que excluya su cuenta. Si
  OpenRouter la excluye, el texto sigue siendo verdad («puede») y se puede quitar.

**d) Las licencias de los modelos** (condiciones de OpenRouter § 5.1: se aceptan).

- **DeepSeek V4.1 Flash**: licencia MIT (`huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash`,
  modificado 10/09/2026). Sin restricciones de uso.
- **Gemma 4 31B** (principal desde el 2026-09-26): **Apache 2.0**. La ficha del modelo
  (`huggingface.co/google/gemma-4-31B-it`, `license: apache-2.0`, modificada 20/07/2026)
  enlaza a `ai.google.dev/gemma/docs/gemma_4_license`, que es la Licencia Apache 2.0. Las
  *Gemma Terms of Use* (última modificación 01/04/2026) **excluyen expresamente Gemma 4**:
  «The terms below apply to Gemma models listed in the Appendix… For Gemma 4 terms, see
  the Gemma 4 license». Consecuencias:
  - **Uso comercial**: permitido, sin aviso ni autorización.
  - **Atribución / NOTICE**: Apache 2.0 (§ 4) solo obliga a quien **redistribuye** la obra
    o derivados (copia de la licencia, avisos de copyright, marca de los ficheros
    cambiados). NutrIA no distribuye los pesos: llama a una API que los ejecuta un
    tercero. No hay deber de atribución. Nombrar el modelo en la política es
    transparencia, no obligación.
  - **Trasladar restricciones a los usuarios**: la obligación de incluir las restricciones
    de uso en los acuerdos con terceros es de las *Gemma Terms of Use* (§ 3.1), que no se
    aplican a Gemma 4. No hay que trasladar nada.
  - **Uso sanitario**: la *Gemma Prohibited Use Policy* (última modificación 21/02/2024)
    solo se incorpora por las *Gemma Terms of Use* (§ 3.2), así que, en mi lectura, no
    obliga con Gemma 4 **[abogado]**. Aun si obligara, NutrIA no cae en ella: prohíbe «the
    unauthorized or unlicensed practice of any profession including… medical/health»,
    «misleading claims of expertise… in sensitive areas (e.g. health…)» y «making
    automated decisions in domains that affect material or individual rights or
    well-being (e.g.… healthcare…)». NutrIA no ejerce una profesión sanitaria, dice que no
    es un servicio médico (política y condiciones), y la IA no decide nada sobre la persona:
    los límites de calorías y proteína son reglas fijas (§ 7). En `/consulta` decide el
    dietista colegiado.
  - **Conclusión: la licencia de Gemma no bloquea nada.** P1-13 queda **cerrado** (MiniMax
    fuera).
- **Uso clínico**: ni la licencia MIT ni la Apache 2.0 lo prohíben; OpenRouter solo se
  exime de garantizar la idoneidad para usos médicos (§ 16), no los prohíbe; DeepInfra
  prohíbe el «High-Risk Use» (soporte vital u otros dispositivos médicos cuyo fallo cause
  la muerte), que NutrIA no es (§ 7). La cláusula clínica de P1-10 es de las condiciones de
  la **API de Gemini**, no de Gemma: Gemma 4 ejecutada por DeepInfra o CoreWeave no pasa
  por Google. **P1-10 se cierra con el cambio**, siempre que no vuelva la API de Gemini
  (`AI_PROVIDER=google` o un modelo `google/gemini-*` en la clave).

**e) Nada se usa para entrenar ni se guarda — hasta dónde llega la garantía.** Tres capas:
la cuenta (entrenamiento apagado, ZDR, uso de entradas/salidas apagado), la clave
(modelos permitidos, ZDR) y la petición (`zdr`, `data_collection: 'deny'`). ZDR y los
proveedores permitidos de la cuenta son el techo: una petición puede exigir más, nunca
menos. Dos matices que la documentación de ZDR admite: «in-memory caching of prompts is
*not* considered "retaining" data», y la clasificación ZDR de cada proveedor es de
OpenRouter, por lo que publica cada uno («If OpenRouter is not able to establish… a clear
policy… we take a conservative stance and assume that the endpoint both retains and
trains on data»). Con DeepInfra hay además cláusula contractual (con OpenRouter).

**Qué dice la política en cada estado** — ver [`textos/02`](./textos/02-politica-privacidad.md),
«La inteligencia artificial»: estado 1 (ahora, `stub`: ningún modelo) y estado 2
(OpenRouter, publicable cuando P1-11 y P1-12 estén hechos, y antes del cambio).

---

## 5. EIPD y DPD

### 5.1 EIPD — **obligatoria**

La AEPD exige EIPD «en la mayoría de los casos» en que se reúnan **dos o más** criterios de
su lista (art. 35.4). NutrIA reúne cuatro:

- **1** — perfilado o valoración de hábitos (hábitos alimentarios, adherencia, peso);
- **4** — categorías especiales del art. 9.1 (salud; religión);
- **8** — combinación de datos entre responsables distintos (el enlace con el dietista);
- **10** — nuevas tecnologías (IA generativa).

El art. 28.2.c LOPDGDD añade el tratamiento «no meramente incidental» de categorías
especiales como supuesto de mayor riesgo. La exención de la lista 35.5 para profesionales
sanitarios individuales (apdo. 4) protege al **dietista**, no a NutrIA. La EIPD está en
[`eipd.md`](./eipd.md) y debe existir **antes** de encender el flag `professional` (art. 35.1:
«antes del tratamiento»); para lo que ya está en producción, cuanto antes.

### 5.2 DPD — **no obligatorio hoy**

- Art. 37.1.c RGPD: solo si la actividad principal es el tratamiento **a gran escala** de
  categorías especiales. Con decenas de cuentas y un solo responsable persona física, no
  hay gran escala (criterios del GT29, WP243: número de interesados, volumen, duración,
  alcance geográfico).
- Art. 34.1 LOPDGDD: NutrIA no es un «centro sanitario legalmente obligado al
  mantenimiento de las historias clínicas» (letra l); tampoco elabora perfiles «a gran
  escala» (letra d). El dietista individual está exceptuado expresamente en la letra l.
- **Revisar** al superar unos pocos miles de cuentas con datos de salud o si NutrIA
  empieza a custodiar historias clínicas. Un DPD voluntario es posible (art. 34.2) y se
  comunica a la AEPD en diez días (art. 34.3).

---

## 6. El propietario como persona física

- **Es actividad económica.** Vender suscripciones (B2C) y planes de consulta (B2B) de
  forma habitual es ejercer una actividad económica. Obligaciones que **no están hechas**
  y que un gestor debe confirmar **[abogado/gestor]**:
  - **alta censal** en Hacienda (declaración censal, modelo 036) antes de la primera venta;
  - **RETA**: el alta es obligatoria si la actividad es habitual; el criterio de
    habitualidad y las bases por rendimientos reales (desde 2023) son del gestor;
  - **IRPF**: rendimientos de actividad económica, pagos fraccionados;
  - **IVA**: sin *Managed Payments*, IVA del país del consumidor con el régimen de
    ventanilla única (OSS) por encima de 10 000 € anuales de ventas intracomunitarias a
    consumidores, e IVA español por debajo; con *Managed Payments*, Link es el vendedor y
    liquida el IVA, y el propietario factura a Stripe (**[gestor]**: cómo se documenta).
- **LSSI art. 10.1**: el aviso legal debe dar «nombre…; su residencia o domicilio…;
  dirección de correo electrónico» y, letra e, «el número de identificación fiscal». Hoy
  hay nombre y correo (`es-ES.ts:1105,1394`), **ni domicilio ni NIF** — P1. El
  repositorio es público: el domicilio y el NIF irían a `legalIdentity.ts`, que se publica.
  Si el propietario no quiere publicar su casa, puede usar un domicilio profesional o de
  domiciliación **[abogado]**.
- **TRLGDCU art. 97.1.c** (antes de que el consumidor quede vinculado): «la dirección
  completa del establecimiento del empresario, número de teléfono y dirección de correo
  electrónico». Falta **teléfono** y dirección — P1 antes de las claves *live*.
- **Qué cambia al darse de alta**: el aviso legal, la política («persona física — no una
  empresa ni un autónomo registrado», `es-ES.ts:1105`, debe desaparecer: es innecesario y
  deja por escrito lo contrario de lo que habrá que hacer), la facturación y el IVA.
- **Responsabilidad**: como persona física responde con todo su patrimonio. Un seguro de
  responsabilidad civil que cubra ciberriesgos y datos es razonable antes del flag
  **[abogado]**.

---

## 7. Ley de IA (Reglamento 2024/1689, modificado por el 2026/1744)

- **Qué es NutrIA**: **proveedor** de un sistema de IA (lo pone en servicio con su nombre)
  que integra modelos de uso general de terceros. No es de alto riesgo: la planificación
  de comidas no está en el anexo III y el producto no es un producto sanitario (ver
  abajo).
- **Art. 4, alfabetización** (aplicable desde 2/2/2025; con el Ómnibus, «adoptarán
  medidas para apoyar la promoción de la alfabetización»): el propietario y quien opere
  el sistema en su nombre. Para el profesional, el acuerdo le explica qué hace la IA y
  qué no (cl. 5).
- **Modelos integrados** (tras el cambio de `0064`): Gemma 4 31B y, de reserva,
  DeepSeek V4.1 Flash, de pesos abiertos, por la API de OpenRouter. Las obligaciones de los modelos de uso general
  (capítulo V) son de sus proveedores; a NutrIA le toca informar (art. 50) y la
  alfabetización (art. 4). Cambiar de modelo no cambia esto, pero sí la política (§ 4.4).
- **Art. 50.1** (interacción directa con personas): no hay asistente conversacional en el
  código (las tablas `ai_conversations`/`ai_messages` existen, nada las usa). Si se
  construye, deberá decir que es una IA.
- **Art. 50.2** (contenido sintético marcado «en un formato legible por máquina»):
  recetas (texto) e ilustraciones (imagen, Gemini). Aplicable desde el 2/8/2026, pero el
  Reglamento 2026/1744 da a los sistemas introducidos **antes** del 2/8/2026 hasta el
  **2/12/2026**. Excepción: «función de apoyo a la edición estándar» — no es el caso.
  Acción: marcar en la respuesta de la API y en el HTML de las recetas (`source: 'ai'` ya
  existe en `recipes.source`; exponerlo como metadato legible por máquina) y confiar en
  la marca de agua del proveedor para las imágenes (SynthID en Google) **[abogado]** sobre
  si el metadato basta. P2 con fecha.
  **Revisión 2026-09-27 — imágenes de los platos (proyecto 006)**: el plazo del
  2/12/2026 (art. 111.3, añadido por el 2026/1744) **no** vale para las imágenes, que
  se ponen en servicio al encender su flag, después del 2/8/2026: art. 50.2, 50.4 y 50.5
  desde el primer día. Una foto realista de un plato es, con toda probabilidad, una
  ultrasuplantación (art. 3.60; Directrices C(2026) 5054, apdos. 113-116) **[abogado]**:
  aviso visible en cada sitio donde se vea, también en la tarjeta del panel. Gemini trae
  C2PA firmado por Google y SynthID (medido: llegan por OpenRouter y se sirven sin tocar);
  MAI-Image-2.6 no traía marca documentada y el propietario lo quitó. Todo en
  [`imagenes-de-platos.md`](./imagenes-de-platos.md).
- **Transparencia al usuario**: las condiciones ya lo dicen (§ «Contenido generado con
  inteligencia artificial»); la política debe decir qué datos ve el modelo y que no decide
  nada con efectos jurídicos (art. 22 RGPD: no hay decisiones automatizadas con efectos
  jurídicos o similares; los límites de calorías son reglas deterministas, no decisiones
  de la IA).
- **Producto sanitario** (Reglamento 2017/745): un software lo es si su **finalidad
  prevista** es diagnosticar, prevenir, tratar o aliviar una enfermedad. NutrIA declara
  que no (condiciones y pie), no deriva reglas de enfermedades salvo celiaquía → gluten
  (`0008`) y no dosifica. Mientras la publicidad y los textos no prometan tratar
  enfermedades, no es producto sanitario **[abogado]**, y la consulta no cambia eso: el
  profesional trata, la herramienta planifica.

---

## 8. Accesibilidad

- **Ley 11/2023** (transpone la Directiva 2019/882): los «servicios de comercio
  electrónico» a consumidores están en su ámbito, pero «las microempresas que presten
  servicios estarán exentas de cumplir los requisitos de accesibilidad» (art. 3.3).
  Microempresa: menos de 10 personas y volumen de negocio o balance ≤ 2 M€ (art. 2).
  NutrIA **está exenta** mientras lo sea.
- Sigue siendo exigible que la información precontractual se dé «con especial atención
  en caso de tratarse de personas consumidoras vulnerables… en formatos adecuados,
  accesibles y comprensibles» (art. 97.1 TRLGDCU). El producto ya se diseña a WCAG por
  decisión propia (`0041`, `0057`) — eso cubre de sobra lo exigible hoy.

---

## 9. Riesgos, ordenados por lo que le puede pasar a una persona real

Severidad según la definición del agente: **P0** salud sin base, compartir con alguien
no nombrado, texto falso; **P1** falta un aviso, derecho o cláusula exigido; **P2** lo que
preguntaría un regulador; **P3** redacción.

### P0

**P0-1 · La invitación promete un control que no existe** (proyecto 004, bloquea el flag).
`apps/web/src/i18n/dictionaries/es-ES.ts:251` y `en-GB.ts:247` (`care.healthShareNote`):
«Puedes dejarlo sin marcar y decidirlo más adelante desde tu perfil». `sharesHealth` solo
se escribe al aceptar (`CareRepository.ts:165`) y ningún endpoint lo cambia. Además, el
cliente que marcó la línea no puede **retirar solo esa** sin terminar el enlace entero:
el art. 7.3 RGPD exige que retirar sea «tan fácil como darlo». Un consentimiento dado
sobre una promesa falsa no es informado (art. 4.11). **Arreglo**: construir
`PATCH /care/links/me` con `{ sharesHealth }` (el cliente puede activarla y desactivarla;
cada cambio deja fila en el rastro, y desactivar cierra el acceso en la siguiente
petición) y un interruptor en `CareLinkCard`; y cambiar el texto
([`textos/05`](./textos/05-consentimientos-cliente.md) § B). Sube `CARE_CONSENT_VERSION`.

**P0-2 · Datos de salud y de religión tratados sin excepción del art. 9** (en producción).
Alergias, intolerancias, alergias en texto libre, peso/altura/objetivo, y la forma de
comer (`gluten_free`, `lactose_free`, `halal`, `kosher`) se recogen en el onboarding sin
consentimiento explícito y la política los apoya solo en el contrato
(`es-ES.ts:1113,1125`). **Arreglo**: una casilla de consentimiento explícito en el paso de
alergias del onboarding, versionada y guardada (propuesta: ampliar `health_data_consents`
con un segundo ámbito, o una constante nueva `PROFILE_HEALTH_CONSENT_VERSION = '1.0.0'`
en `packages/core/src/entities/Health`), pedida también a las cuentas existentes en su
próximo acceso, sin la cual no se genera plan (texto en [`textos/05`](./textos/05-consentimientos-cliente.md) § A).
Retirar = borrar esos datos y dejar de generar, igual que ya hace la salud.

**P0-3 · Datos de salud y de religión enviados a modelos que entrenan con ellos** (en
producción, si la combinación de `ai-gateway.md` § 1 sigue viva).
`apps/api/src/modules/ai/prompts/PoolPrompt.ts:622` (forma de comer, con halal/kósher),
`:628` (alergias en texto libre), `:268` (comentario del check-in) llegan a
`opencode/*-free` (EE. UU.; «los datos pueden usarse para mejorar el modelo»; Meta
«entrena futuros modelos») y a Gemini. La política dice que el proveedor «solo recibe tus
objetivos, tus preferencias y tus alergias» (`es-ES.ts:1131`), sin decir que puede
reutilizarlos ni que están en EE. UU. **Arreglo**, cualquiera de los dos, y mejor ambos:
(a) configurar la combinación solo con proveedores de pago o con DPA sin entrenamiento y
retención cero, con garantía de transferencia; (b) dejar de enviar texto libre del
interesado (alergias sin resolver → quitar los ingredientes candidatos o negarse a
generar, como ya se niega el plato con ingredientes sin resolver; comentario del check-in
→ usar solo las respuestas cerradas) y traducir la forma de comer a exclusiones de
ingredientes. Luego, la política (§ «Con quién compartimos»).

**Estado de P0-3 a 2026-09-26 — cerrado del todo en producción; condicionado para el cambio.** Desde el 2026-09-26 producción no llama a ningún modelo (`AI_PROVIDER=stub`), así que no sale nada. La salida (a) es `0064`: OpenRouter con modelos de pago, ZDR y sin entrenamiento. Queda cerrada cuando se cumplan P1-11 y P1-12 (§ 4.4); hasta entonces el cambio no debe hacerse. Corrección: Gemini gratuito, para un propietario en el EEE, no entrenaba; el problema era que sus condiciones prohíben servir con él a usuarios del EEE (§ 1.3).

**Estado de P0-3 a 2026-09-25 — cerrado en lo sustancial** con `agent/legal-a/backend` a `e28f0e5` (sin fusionar): el modelo ya no recibe texto escrito por la persona, alergias, intolerancias ni formas de comer salvo «vegetariano» y «vegano»; halal, kósher, sin gluten y sin lactosa se aplican quitando alimentos en código. Lo que sigue llegando a modelos gratuitos que pueden entrenar: objetivos diarios y tipo de meta (p. ej. perder peso), horarios, gustos por nombre de catálogo, nombres de platos y respuestas cerradas del check-in, sin identificadores. **Residual P2 [abogado]**: si esos datos, sin identificadores, son personales para el proveedor (C-413/23 P) y si la meta «perder peso» es dato de salud; y si el veganismo puede ser una convicción filosófica (art. 9.1). La salida (a) —proveedores con contrato y sin entrenamiento— sigue siendo la que cierra todo.

### P1

| # | Hallazgo | Dónde | Qué exige la ley | Arreglo mínimo |
| --- | --- | --- | --- | --- |
| P1-1 | Ningún profesional acepta nada antes de abrir `/consulta` (LEGAL-REVIEW § B3) | `apps/api/src/shared/guards/Professional.guard.ts:43-60`; `apps/web/src/app/(app)/consulta/page.tsx:48-60` | Arts. 24, 26 y 32 RGPD; secreto (Ley 44/2003 art. 5.1.c; Código Deontológico art. 22, 29) | Pantalla de aceptación con versión y almacenamiento (§ 11) |
| P1-2 | La invitación por correo no da la información del art. 14 a quien no es usuario | `apps/api/src/modules/email/templates/CareInvitation.ts:37-47` | Art. 14.1-2 y 14.3.b RGPD (al primer contacto) | Un párrafo de información básica ([`textos/06`](./textos/06-correos.md) § A) |
| P1-3 | La página de invitación no dice que el profesional **escribirá**: objetivos, generar y **retener** planes para revisarlos; «tu perfil» no dice qué es | `care.shares.*`, `care.invitationShareIntro` (`es-ES.ts:225-265`); `CareInvitation.tsx` | Art. 4.11 y 7 (informado, específico); art. 13.1.c-e | Texto nuevo, enlace a la política; **sube `CARE_CONSENT_VERSION` a `2.0.0`** |
| P1-4 | No hay puerta de edad | `Profile.ts:112`; `OnboardingFlow.tsx:350-357` | Art. 7 LOPDGDD; art. 8 RGPD; coherencia con las condiciones | Rechazar en `profileSchema` (servidor) menos de **18** años (decisión del propietario, 2026-09-25; antes se proponía 16), con un texto que no culpe |
| P1-5 | La política no cubre transferencias, plazos por categoría, portabilidad, limitación, la consulta del 004 ni la IA con precisión; dice «uso técnico anónimo» y está ligado a `userId`; promete que la copia «se elimina automáticamente» y la exportación manual no | `es-ES.ts:1096-1181` | Arts. 13.1.e-f, 13.2.a-b, 5.1.a | Política nueva ([`textos/02`](./textos/02-politica-privacidad.md)) |
| P1-6 | Exportación completa de la base de datos, **sin cifrar**, en el equipo del propietario, sin plazo | `docs/reference/deployment.md` § 8 | Art. 32.1.a (cifrado) y 5.1.e | Cifrarla (p. ej. `age`), guardarla en disco cifrado, borrar a los 30 días; anotarlo en el RAT |
| P1-7 | Aviso legal incompleto: sin domicilio, NIF ni teléfono; sin cauce de reclamaciones postal y telefónico | `es-ES.ts:1394`; no hay página de aviso legal | LSSI art. 10.1.a y e; TRLGDCU art. 97.1.c y 21.2-3 (vía postal, telefónica y electrónica, justificante, respuesta en 15 días) | [`textos/07`](./textos/07-aviso-legal.md) antes de claves *live* |
| P1-8 | Desistimiento: sin formulario modelo, sin función de desistimiento en línea | condiciones `es-ES.ts:1435`; `PremiumCard.tsx` | TRLGDCU art. 97.1.j (formulario); Directiva 2023/2673 art. 11 bis (aplicable desde 19/6/2026; España no lo ha transpuesto en el TRLGDCU consolidado a 28/02/2026) | Formulario en las condiciones y un botón «Desistir del contrato aquí» en el perfil durante los 14 días ([`textos/03`](./textos/03-condiciones-uso.md), [`textos/06`](./textos/06-correos.md) § C) |
| P1-9 | El plan de consulta no tiene condiciones; la prueba no dice que se cobra al terminar | `practice.planTrial` (`es-ES.ts`, namespace `practice`); `PracticePlanCard.tsx` | LSSI art. 27; Ley 7/1998 arts. 5 y 7 (incorporación de condiciones generales) | [`textos/04`](./textos/04-condiciones-consulta.md), aceptadas en la misma pantalla que el acuerdo |
| P1-10 | Gemini prohíbe su uso «en la práctica clínica»; la consulta genera planes para pacientes de un profesional con Gemini como reserva | `docs/reference/ai-gateway.md` § 1; Gemini API Additional Terms (23/03/2026) | Contrato con el proveedor (no ley, pero es la licencia de uso) | **Cerrado en producción** desde el 2026-09-26 (`stub`) y **cerrado con el cambio** (`0064`: sin Gemini; la clave solo admite Gemma 4 31B y DeepSeek V4.1 Flash, sin cláusula clínica, § 4.4 d; Gemma 4 es de pesos abiertos, Apache 2.0, ejecutado por DeepInfra o CoreWeave, no la API de Gemini). Se reabre si vuelve `AI_PROVIDER=google` o un modelo `google/gemini-*` a la clave de texto. **2026-09-27**: el proyecto 006 usa `google/gemini-3.1-flash-lite-image` por Vertex (no la API de Gemini) en una **clave aparte**, solo para dibujar recetas, sin datos de nadie ni uso clínico: no reabre este punto. Las condiciones de Google Cloud para IA generativa **no las he leído** (MAI, fuera desde el 2026-09-27): ver [`imagenes-de-platos.md`](./imagenes-de-platos.md) § 5, IMG-9 |
| P1-11 | El acuerdo de tratamiento (DPA) de OpenRouter: sus condiciones § 10.2 lo incorporan para uso comercial, pero su texto no es público y su centro de ayuda dice que solo se firma con Enterprise | `ai.config.ts` (`case 'openrouter'`); condiciones de OpenRouter (31/08/2026) | Art. 28.3 (contrato por escrito con el contenido mínimo), 5.2 y 24 (demostrarlo); art. 46.2.c (cláusulas tipo, que viven en ese DPA) | **Bloquea el cambio.** El propietario pide acceso en `trust.openrouter.ai`, descarga el DPA, pide a soporte confirmación escrita de que se aplica a su cuenta de pago y guarda ambos fuera del repositorio. Si OpenRouter dice que no: no hay encargado con contrato; la política no puede decir «con contrato» y el cambio no se hace **[abogado]** |
| P1-12 | La cuenta de OpenRouter no limita qué empresas ejecutan el modelo: la petición puede ir a 22 (una en Indonesia, otra sin condiciones publicadas) | `NO_TRAINING_PROVIDER` en `ai.config.ts` (sin `only`); runbook `ai-gateway.md` § 0 (sin lista de proveedores) | Art. 13.1.e-f (nombrar destinatarios y transferencias); arts. 44-46 (Indonesia sin adecuación ni garantía) | **Hecho el 2026-09-26.** En la cuenta, *Allowed providers* = DeepInfra y CoreWeave (propietario). En código, `provider.only` desde `AI_PROVIDER_ONLY`, obligatorio al arrancar con `openrouter` (`Env.validation.ts:506-507`). La política nombra exactamente esa lista; cambiarla pasa antes por la política |
| P1-13 | ~~La licencia de MiniMax M3 exige, en uso comercial, mostrar «Built with MiniMax M3» y un aviso único a MiniMax~~ | licencia en Hugging Face; condiciones de OpenRouter § 5.1 | Contrato (licencia aceptada vía OpenRouter § 5.1) | **Cerrado el 2026-09-26**: el propietario quitó MiniMax de reserva. La nueva reserva, Gemma 4 31B, es Apache 2.0: sin aviso, atribución ni restricciones que trasladar a los usuarios para quien usa el modelo por API (§ 4.4 d). Otro cambio de modelo reabre esta fila |
| P1-14 | Imágenes de los platos (006, flag apagado): la tarjeta del panel las mostraría sin aviso; ~~MAI-Image-2.6 sin marca documentada~~ (fuera, 2026-09-27); ~~`sharp` borra el C2PA de Google~~ (se sirve el original, medido); la política dice «nunca los servicios de Google» | [`imagenes-de-platos.md`](./imagenes-de-platos.md) § 5 (IMG-1 a IMG-9; desde el 009, IMG-10 a IMG-16: la imagen rechazada que espera, y la que el propietario acepta a mano contra el juez — **IMG-15, P1**: una frase de `/privacidad` cambia con esa función; **IMG-16 cerrado el 2026-09-30 por el 010 fase 4**: «Retirar» vale para cualquier imagen publicada, también la que el juez aceptó por error, sin cambio en `/privacidad` ni en `/condiciones`); `NextMeal.tsx:58-62` | Ley de IA arts. 50.2, 50.4, 50.5 (desde el 2/8/2026, sin el plazo del art. 111.3); RGPD art. 5.1.a | Antes del flag: [`checklist-activacion.md`](./checklist-activacion.md) § 0 ter |

### P2

| # | Hallazgo | Dónde | Arreglo |
| --- | --- | --- | --- |
| P2-1 | Opciones «Halal»/«Kosher» preguntan la religión | `es-ES.ts:834-835`; `_enums.ts:21-22` | Restricciones neutras («sin cerdo», «sin alcohol», «carne de sacrificio ritual»); mientras tanto, dentro del consentimiento explícito |
| P2-2 | «Al continuar aceptas… la política de privacidad»: la política se informa, no se acepta; y no se guarda qué versión de las condiciones se aceptó | `es-ES.ts:183` | Texto nuevo ([`textos/03`](./textos/03-condiciones-uso.md) § A, ya publicado); guardar `termsVersion` y fecha al registrarse — **decidido el 2026-09-29 (D5)**: se construye en la fase 7 del proyecto 008, con el aviso visible junto al botón de Google ([nota](./2026-09-29-aceptacion-de-los-textos-legales.md)) |
| P2-3 | Sin registro de actividades | — | [`registro-actividades.md`](./registro-actividades.md) (art. 30; la excepción del 30.5 no aplica) |
| P2-4 | Sin plazos ni purga: `analytics_events`, `plan_generation_jobs` | `platform.schema.ts:91-100`; `plan.schema.ts:240-260` | Cron diario que borre a 24 y 12 meses |
| P2-5 | La política dice que el responsable es «persona física — no una empresa ni un autónomo registrado» | `es-ES.ts:1105` | Quitarlo (texto nuevo) |
| P2-6 | Checkout sin enlace a condiciones ni recogida de NIF para B2B | `apps/api/src/modules/billing/services/StripeGateway.ts:175-188` | `consent_collection.terms_of_service: 'required'` con la URL configurada en Stripe; `tax_id_collection` para la consulta **[abogado/gestor]** |
| P2-7 | Plan anual: aviso 15 días antes de la renovación | TRLGDCU art. 97.1.p (redacción de la Ley 10/2025) | Con *Managed Payments* Stripe lo envía por defecto 15 días antes del aniversario; sin él, activar «Upcoming renewals» ([`textos/06`](./textos/06-correos.md) § D) |
| P2-8 | Art. 50.2 Ley de IA: marcar el contenido generado en formato legible por máquina | respuestas de recetas | Antes del 2/12/2026 (§ 7) |
| P2-9 | Sin exportación de datos para la portabilidad | — | `GET /users/me/export` en JSON; mientras, atender por correo en un mes (art. 12.3) |
| P2-10 | Correo del proveedor SMTP: una cuenta Gmail de consumo no ofrece DPA | memoria del propietario; `SMTP_*` | Proveedor transaccional con DPA **[abogado]** |
| P2-11 | Las empresas que ejecutan el modelo no son subencargados según OpenRouter (DPA Enterprise § 11.10) y no tienen contrato con NutrIA; ninguna está en el DPF | § 4.4 b | Nombrarlas en la política; lista cerrada (P1-12); apoyarse en que la petición no identifica a nadie (C-413/23 P) **[abogado]**. Si el abogado no lo compra: un proveedor con contrato directo (p. ej. Mistral en la UE, plan B del informe `0002`) |
| P2-12 | OpenRouter clasifica una muestra anónima de peticiones para sus estadísticas públicas; no se puede apagar | condiciones § 6.5; documentación *Data collection* | **Aceptado con aviso** (propietario, 2026-09-26): la política (estado 2) lo dice, y el propietario pedirá por escrito a OpenRouter que excluya su cuenta. Si lo excluye, se puede quitar la frase |
| P2-14 | `/privacidad` no nombra los frenos contra el abuso: la huella de la dirección con el recuento de intentos (`sign_in_failure`, fase 7, ya en `main`) y de correos (`mail-budget:*`, fase 8), ni la IP en `rate_limit` (anterior); ni que no se borran con la cuenta, sino que caducan solos | `auth.schema.ts:215-229`; `MailBudgetRepository.ts`; `auth.config.ts:446-453` | Arts. 13.1.c-d y 13.2.a; 14.5.b para quien no tiene cuenta. Una viñeta ⟦frenos⟧ en «Qué datos recogemos» ([`textos/02`](./textos/02-politica-privacidad.md)), en el mismo cambio que lleve el presupuesto a producción. § 4.1 ter |
| P2-15 | ~~Una cuenta creada con la dirección de otra persona y nunca confirmada se queda para siempre (nombre tecleado por un extraño, la dirección de un tercero). Desde la fase 8 no puede entrar nadie sin el buzón, así que es un dato sin uso~~ | `packages/core/src/repositories/User/UserRepository.ts:181,345`; `packages/core/src/controllers/User/UserController.ts:432`; `apps/api/src/modules/auth/services/AuthRetention.service.ts:32` | **Cerrada en el código el 2026-10-09** (PR #250, `fbab7b1b`, decisión `0092`): el cron diario borra la cuenta sin confirmar de más de 30 días que no tenga sesión, perfil, plan ni fila de auditoría, en un `DELETE … RETURNING` con una fila de rastro que sobrevive sin actor, sin sujeto y sin IP (arts. 5.1.c y 5.1.e; § 4.1 quinquies). **Queda abierto lo que depende del texto**: publicar ⟦barrido-sin-confirmar⟧ en `/privacidad` (art. 13.2.a) antes de la primera cuenta borrada, el recuento en solo lectura previo y las dos casillas del § 0 septies del checklist. Dos derivadas nuevas en P3 y un P2 enviado a `backend` (`isNull(user.activatedAt)`) |
| P2-13 | ~~Diez columnas quedan en la base de datos sin ningún lector desde `0067`: `sleepStart`, `sleepEnd`, `trainingDaysPerWeek`, `trainingTime`, `workScheduleNotes`, `breakfastStyle`, `portionPreference`, `budget`, `cookingFrequency` (`user_preferences`) y `customGoal` (`goals`, texto libre — puede llevar salud, «recuperarme de un trastorno alimentario»). El onboarding ya no las rellena, pero las cuentas que las tenían las conservan~~ | `packages/database/src/migrations/0043_onboarding_answers_nothing_reads_are_cleared.sql`; `packages/database/src/schemas/profile.schema.ts` | **Cerrado el 2026-09-28**: la migración `0043` pone esas diez columnas a `NULL` para todas las cuentas, en el mismo cambio que dejó de rellenarlas — no solo las nuevas, también las que ya las tenían (art. 5.1.c y 5.1.e). De paso mueve todo `goals.type = 'custom'` a `'maintenance'`, sin cambiar ningún objetivo calculado (ver § 1.3). Las columnas y el valor `'custom'` del enum siguen en Postgres hasta la migración de la siguiente entrega que los elimine — eso es higiene de esquema, no un dato retenido sin fin, así que no abre un hallazgo nuevo |

### P3

- El empuje al profesional lleva el nombre del cliente en la pantalla de bloqueo
  (`apps/api/src/modules/email/templates/CheckInSubmitted.ts:61`): usar «Un paciente ha
  hecho su check-in».
- La invitación no muestra el número de colegiado del profesional; mostrarlo deja al
  cliente comprobarlo en el registro de su colegio.
- «Usamos dos cookies» (`es-ES.ts:1168`): Better Auth puede poner cookies transitorias al
  entrar con Google o Apple, y hay claves en `localStorage`/`sessionStorage`
  (`apps/web/src/lib/pendingReview.ts:1`, `pendingTicks.ts:17`, `arrival.ts:1`). Todas son
  estrictamente necesarias (LSSI art. 22.2, excepción final): no hace falta banner, pero sí
  nombrarlas.
- `health.consentNote` dice que los datos de salud «no se envían a ningún modelo»: es
  cierto del dato, no de su efecto (celiaquía → el catálogo va sin gluten). Añadir «solo
  llega su efecto: los ingredientes que quitamos».
- Las condiciones de Together prohíben enviarle «medical information of any nature or any
  sensitive personal data»: NutrIA no lo hace, pero no conviene tenerlo en la lista de
  proveedores permitidos (P1-12) de un producto con planes para pacientes.
- Cada vez que cambien `AI_MODEL`, `AI_FALLBACK_MODELS` o la lista de proveedores
  permitidos, cambia la política (estado 2 nombra modelos y empresas): el runbook
  `ai-gateway.md` § 0 debería decirlo (a `main`).
- (2026-10-03, 011 fase 8) `auth.signUpSent` y `auth.invalidCredentials` dicen «te hemos escrito» / «te acabamos de enviar el enlace de nuevo» aunque el presupuesto haya retenido el correo (a partir del cuarto en una hora). Propuesta que es verdad en los dos casos: «Si {email} es correcta, te llegará un correo en unos minutos. Abre el enlace para entrar.» / «If {email} is right, an email will reach you in a few minutes. Open the link to sign in.»; y en el 401: «… confirma antes tu dirección: si la contraseña era la buena, te enviamos el enlace de nuevo (como mucho tres veces por hora; mira también en el correo no deseado).» / «… confirm your address first: if the password was right, we send you the link again (at most three times an hour; check your spam folder too).»
- (2026-10-03, 011 fase 8) Correo «alguien ha intentado crear una cuenta»: a quien no recuerda tener cuenta (porque la creó otra persona con su dirección) no le dice qué hacer. Añadir antes de `reset`: «Si no recuerdas haber creado una cuenta, puede que alguien la creara con tu dirección: pon una contraseña nueva en el enlace de abajo y entra con ella.» / «If you do not remember creating an account, somebody may have created one with your address: set a new password with the link below and sign in with it.» Es verdad tal cual **si restablecer confirma la dirección**, que es lo que `backend-011p8` tiene en su árbol de trabajo sin commit el 2026-10-03 (`onPasswordReset` → `UserController.confirmAddressByReset`). En `4f36ec5` no lo hace (Better Auth 1.7.6, `dist/api/routes/password.mjs`, no toca `emailVerified`): si se fusiona sin ese cambio, la frase sigue con «; te enviaremos un enlace para confirmar que la dirección es tuya.» / «; we will send you a link to confirm the address is yours.» ([`textos/06`](./textos/06-correos.md) § O).
- (2026-10-03, 011 fase 8) El alta acaba ahora en «revisa tu correo», pero la pantalla no lo anuncia antes de pulsar. No lo exige el art. 27.1.a LSSI (el contrato se celebra al pulsar), pero una frase en `auth.createAccountSubtitle` o junto al botón evita la sorpresa. **No** en `/condiciones`: obligaría a subir `TERMS_VERSION`.
- (2026-10-09, barrido de cuentas sin confirmar, `0092`) El correo de confirmación dice en español «al mes» y en inglés «after thirty days» (`apps/api/src/modules/email/templates/VerifyEmail.ts`, clave `ignore`). No es lo mismo —un mes son 28, 30 o 31 días; el código son 30 exactos (`UNCONFIRMED_ACCOUNT_RETENTION_DAYS`)— y la política va a decir «a los treinta días» en los dos idiomas. Propuesta para el español: «Si no te has registrado, no confirmes nada: ignora este mensaje y, a los treinta días, borramos el correo que nadie confirma junto con su registro.» El inglés se queda como está. Enviado a `backend`.
- (2026-10-09, barrido de cuentas sin confirmar, `0092`) La promesa del correo («borramos el correo que nadie confirma») **no es verdad para una cuenta que el propietario haya abierto desde la consola**: abrirla escribe una fila de auditoría y eso la saca del barrido para siempre (§ 4.1 quinquies). Hoy nada impide abrir una cuenta sin confirmar. Arreglo de operativa (el propietario solo activa cuentas confirmadas, filtro `confirmed`; casilla § 0 septies del checklist) y, si alguna vez se quiere en el código, que la consola no deje activar una cuenta con `emailVerified = false`. No es falso lo que dice la política, que publica las cuatro condiciones.
- ~~Invitaciones caducadas: purgarlas a diario~~ — hecho (barrido diario a las 08:00, backend `cf87d75`); los textos dicen «como muy tarde al día siguiente» de caducar.

---

## 10. Confirmar con un abogado

Una hora, en este orden:

1. **Roles del 004**: responsables independientes con cláusula de reparto por si acaso
   (§ 2). ¿Lo compra, o prefiere corresponsabilidad formal o un contrato de encargo?
2. **Peso, altura y objetivo como datos de salud** (§ 1.2): la lectura amplia del TJUE
   (C-21/23) me lleva a pedir consentimiento explícito; ¿lo confirma?
3. **IA** (reescrito 2026-09-26; las alergias en texto libre y Gemini ya no se envían):
   (a) ¿vale el DPA que las condiciones de OpenRouter § 10.2 incorporan «para uso
   comercial» en una cuenta de autoservicio, aunque su centro de ayuda diga que solo se
   firma con Enterprise? (b) Las empresas que ejecutan el modelo no son subencargados según
   OpenRouter y no están en el DPF: ¿basta con que la petición no identifique a nadie
   (C-413/23 P), una lista cerrada y nombrarlas en la política? (c) ¿Es «perder peso», sin
   nada más, un dato de salud? (d) La categorización anónima de OpenRouter: ¿base de
   NutrIA para esa comunicación (art. 6.4)?
4. **Stripe *Managed Payments***: con Link como vendedor, ¿quién debe el desistimiento,
   el formulario y la función de desistimiento, y qué deben decir las condiciones? ¿Y
   para la consulta (B2B)?
5. **Alta y fiscalidad**: 036, RETA, IVA con y sin *Managed Payments* (gestor).
6. **Domicilio en un repositorio público**: ¿domicilio profesional o de domiciliación
   para el aviso legal?
7. **Función de desistimiento** (art. 11 bis Directiva 2023/2673): España no ha
   transpuesto; ¿se implanta ya? (Recomiendo que sí: es barato.)
8. **Art. 50.2 Ley de IA**: ¿basta un metadato en la API/HTML para el texto de las recetas?
9. **Producto sanitario**: confirmar que la finalidad declarada lo deja fuera del
   Reglamento 2017/745.
10. **Correo transaccional**: ¿Gmail de consumo es aceptable como encargado?
11. **Imágenes de los platos** (2026-09-27): (a) ¿una foto realista de un plato es una
    ultrasuplantación (art. 3.60)? (b) ¿«IA» en lugar de «AI» en la marca? ~~(c) Si el
    C2PA de Google no llega por OpenRouter…~~ (llega, medido el 2026-09-27).
    (d) (2026-09-30) ¿es una «exposición» del art. 50.4-50.5 que el propietario vea en su
    consola una imagen rechazada y sin publicar? No cambia nada en el producto, que la
    rotula igualmente: no hace falta gastar la hora en ella.
    (e) (2026-09-30) ¿alcanza a una imagen la excepción de «revisión humana» del art. 50.4,
    párrafo segundo? Mi lectura: no, es solo para texto; el producto no se apoya en ella.
    (f) (2026-09-30) una imagen que el propietario publica a mano contra el juez, con aviso
    y registro: ¿cómo pesa ese registro si alguien reclama un daño? **Sí merece cinco
    minutos.**
    (g) (2026-09-30, 010 fase 2) la frase de `/privacidad` sobre el juez, ahora que la
    regla acepta a propósito un segundo alimento con la forma de uno que el plato ya
    tiene: ¿engañosa (Ley 3/1991, art. 5.1.b)? Mi lectura: no, leída entera; P2. La misma
    tras el endurecimiento de la regla, que estrecha la clase sin cerrarla. Una imagen de
    esa clase se puede retirar desde la consola (010 fase 4, `28854ac`). Cinco minutos
    solo si el propietario no toma la cláusula propuesta.
    Detalle en [`imagenes-de-platos.md`](./imagenes-de-platos.md) § 7.
12. **Aceptación de las condiciones** (2026-09-29, D5): el art. 59.4 TRLGDCU y la cuenta
    gratuita, la confirmación del art. 28 LSSI, «seguir usando = aceptar», la prueba tras
    el borrado y la base de guardar la versión. Detalle en
    [`2026-09-29-aceptacion-de-los-textos-legales.md`](./2026-09-29-aceptacion-de-los-textos-legales.md) § 7.
13. **Frenos por dirección** (2026-10-03, 011 fases 7 y 8): (a) ¿basta el interés
    legítimo (cons. 49) para contar intentos y correos de direcciones que no tienen cuenta,
    informando solo en `/privacidad` (art. 14.5.b, art. 11.1)? (b) ¿Es razonable no borrar
    esas filas con la cuenta, sino dejarlas caducar (como mucho unos dos días)? Mi lectura:
    sí a las dos (§ 4.1 ter). Cinco minutos.
14. **El navegador que ya entró** (2026-10-09, 011 fase 7b, `0089`): (a) ¿está exenta
    del art. 22.2 LSSI, sin casilla, una cookie de seguridad que la persona no marca, que no
    deja entrar a nadie y solo evita que el ataque de otro la frene a ella (WP194 § 3.3 frente
    a § 3.2)? (b) ¿Son 90 días, renovados en cada entrada con contraseña, una duración
    «limitada»? Mi lectura: sí a las dos (§ 4.1 quater). Cinco minutos.
15. **El barrido de la cuenta que nadie confirmó** (2026-10-09, 011 seguimiento, `0092`):
    (a) ¿hace falta nombrar una base del art. 6 para la supresión por plazo, o basta con
    que sea el cumplimiento de los arts. 5.1.e y 17.1.a, sin fin nuevo (art. 13.3)? Mi
    lectura: basta; si hubiera que citar una, el art. 6.1.c. (b) ¿Son treinta días desde
    el alta un plazo defendible, contados desde `createdAt` y no desde el último enlace
    enviado? Mi lectura: sí, y el art. 5.1.e solo pide justificarlo. (c) **La que sí
    merece cinco minutos**: el art. 32 LOPDGDD (bloqueo). ¿Alcanza a una supresión
    automática por plazo, o solo a la que nace de una rectificación o del derecho del
    interesado? Mi lectura: solo a la segunda, y aquí no hay nada que reservar como prueba
    (ni pago, ni contenido, ni consentimiento que demostrar), mientras que el art. 32.5
    permite exceptuar el bloqueo cuando conservar incluso bloqueado genera riesgo. La
    respuesta vale también para el borrado de cuenta a petición de la persona, que hoy
    tampoco bloquea nada. Detalle en § 4.1 quinquies.

---

## 11. Lo que hay que construir para el 004 (y quién)

1. **Aceptación del profesional** (backend + frontend):
   - `PROFESSIONAL_AGREEMENT_VERSION = '1.0.0'` en `packages/core/src/entities/Professional`.
   - Dos columnas en `professionals`: `agreementVersion text`, `agreementAcceptedAt
     timestamptz` (nulas hasta aceptar). No hace falta tabla aparte: la aceptación es del
     profesional y se va con su cuenta; si se prefiere histórico, `professional_agreements`
     (`userOwned`, versión, fecha) — cualquiera de las dos sirve para demostrarla (art. 24).
   - `ProfessionalGuard`: además de la concesión y el pago, exige
     `agreementVersion === PROFESSIONAL_AGREEMENT_VERSION` en todas las rutas **salvo**
     `GET /care/practice` y la nueva `POST /care/practice/agreement { version }`
     (validada con `z.literal`, como `acceptInvitationSchema`). La compra del plan
     (`@BeforePractice`) también exige la aceptación, porque las condiciones de consulta se
     aceptan en la misma pantalla.
   - `GET /care/practice` devuelve `agreement: { current, accepted }`; `/consulta` muestra
     el acuerdo y la casilla hasta que coincidan. Una versión nueva vuelve a pedirse, sin
     cerrar a los pacientes: el profesional ve el acuerdo en vez de la lista.
   - Correo al profesional cuando el propietario le concede el rol ([`textos/06`](./textos/06-correos.md) § B).
2. **Retirar la línea de salud sin terminar el enlace** (P0-1).
3. **Consentimiento explícito de salud en el onboarding** (P0-2).
4. **Texto de la invitación y su página** + `CARE_CONSENT_VERSION` a `2.0.0` (P1-2, P1-3).
5. **Puerta de edad** (P1-4).
6. **Política, condiciones, aviso legal** (P1-5, P1-7, P1-8, P1-9).
