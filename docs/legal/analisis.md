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
| `audit_logs.actorId` | eventos de seguridad | `NULL` (`platform.schema.ts:80`); hoy **nada escribe** en esta tabla |
| `analytics_events` | `session_started`, `swap_requested`, `ai_call` | cascada; **ligados a `userId`** (`platform.schema.ts:97`; escritores en `auth.config.ts:103` y `apps/api/src/modules/meal-plans/services/MealPlans.service.ts:69`) |

Antes de borrar, se cancelan las suscripciones de Stripe y, si Stripe falla, la cuenta no
se borra (`auth.config.ts:212-231`). La sesión dura 30 días y guarda IP y agente de
usuario (`auth.config.ts:31`, `auth.schema.ts:45-56`). No hay tarea programada que purgue
nada: los dos cron son reescritura de recetas y recordatorios (`apps/api/vercel.json`).

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

### 1.3 Lo que llega a la IA (revisado 2026-09-26)

**El prompt** (`apps/api/src/modules/ai/prompts/PoolPrompt.ts`, `PROMPT_VERSION = '4.1.0'`
en `:123` a `31c3f99`; lo que quitó la 4.0.0, en `:98-107`. La 4.2.0, sin fusionar el
2026-09-26, solo agrupa la fruta y la verdura por temporada: no añade ningún dato de la
persona): objetivos diarios y su reparto por comida,
el tipo de objetivo (p. ej. `weight_loss`), la forma del día y sus horas, frecuencia,
tiempo y presupuesto de cocina, «vegetariano» o «vegano» y ninguna otra forma de comer
(`NAMEABLE_PATTERNS`), cocinas de una lista cerrada, alimentos que gustan por su nombre de
catálogo, nombres de platos queridos, rechazados y servidos, las respuestas cerradas del
check-in, y los alimentos de esa comida **ya filtrados** por alergias, intolerancias y
formas de comer. **No** lleva nombre, correo, `userId`, edad, sexo, peso, altura, nada
escrito por la persona, alergias ni salud declarada: `apps/api/src/modules/ai` no importa
nada de salud y un test lo asegura (`health-boundary.spec.ts`). **Matiz**: el efecto sí
entra —la celiaquía quita el gluten del catálogo y un suplemento proteico añade la
proteína en polvo (`0052`)—; el dato no.

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
| Enviar a la IA para generar | lo del § 1.3 (prompt 4.1.0: sin identificadores, salud, texto libre ni creencias) | 6.1.b | Con el prompt 4.1.0 no se envía ningún dato del art. 9, salvo que «perder peso» lo sea en la lectura amplia **[abogado]**; si lo es, 9.2.a, cubierto por el consentimiento del perfil, cuyo texto (`profileConsent.ai`) informa del envío. Y solo a un **encargado** con contrato, sin entrenamiento ni retención (§ 4.3) |
| Compartir con el dietista | lo del § 1.4 | 6.1.a | 9.2.a ✔ (existe, con defectos de información: P1) |
| Salud compartida con el dietista | condiciones, medicación, suplementos | 6.1.a | 9.2.a, línea aparte ✔ |
| Uso del dietista para su asistencia | lo que ve | (suya) 6.1.b/6.1.c | (suya) 9.2.h |
| Cobro de Premium o del plan de consulta | id de cliente y suscripción, estado | 6.1.b; 6.1.c para facturación | — |
| Métricas de uso (`analytics_events`) | evento + `userId` | 6.1.f interés legítimo | — (no contiene salud) |
| Registros técnicos y errores (Sentry) | error, pila, ruta; sin cuerpo, usuario ni cabeceras (`apps/api/src/shared/observability/ErrorReporter.ts:45-110`) | 6.1.f | — |
| Correos de servicio (verificación, reseteo, recordatorio, aviso de check-in al profesional) | correo, nombre | 6.1.b | — |
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
| Pagos (Stripe) | lo que exija la ley a Stripe; con *Managed Payments*, a Link como vendedor | ✔ política |
| Copias: restauración de Neon | ventana del plan (sin anotar en `deployment.md` § 8) | P2: anotarla y citarla |
| Copias: exportación manual | **indefinido, sin cifrar**, en el equipo del propietario | **P1**: cifrar, plazo (30 días) y borrado |

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
| P1-10 | Gemini prohíbe su uso «en la práctica clínica»; la consulta genera planes para pacientes de un profesional con Gemini como reserva | `docs/reference/ai-gateway.md` § 1; Gemini API Additional Terms (23/03/2026) | Contrato con el proveedor (no ley, pero es la licencia de uso) | **Cerrado en producción** desde el 2026-09-26 (`stub`) y **cerrado con el cambio** (`0064`: sin Gemini; la clave solo admite Gemma 4 31B y DeepSeek V4.1 Flash, sin cláusula clínica, § 4.4 d; Gemma 4 es de pesos abiertos, Apache 2.0, ejecutado por DeepInfra o CoreWeave, no la API de Gemini). Se reabre si vuelve `AI_PROVIDER=google` o un modelo `google/gemini-*` a la clave |
| P1-11 | El acuerdo de tratamiento (DPA) de OpenRouter: sus condiciones § 10.2 lo incorporan para uso comercial, pero su texto no es público y su centro de ayuda dice que solo se firma con Enterprise | `ai.config.ts` (`case 'openrouter'`); condiciones de OpenRouter (31/08/2026) | Art. 28.3 (contrato por escrito con el contenido mínimo), 5.2 y 24 (demostrarlo); art. 46.2.c (cláusulas tipo, que viven en ese DPA) | **Bloquea el cambio.** El propietario pide acceso en `trust.openrouter.ai`, descarga el DPA, pide a soporte confirmación escrita de que se aplica a su cuenta de pago y guarda ambos fuera del repositorio. Si OpenRouter dice que no: no hay encargado con contrato; la política no puede decir «con contrato» y el cambio no se hace **[abogado]** |
| P1-12 | La cuenta de OpenRouter no limita qué empresas ejecutan el modelo: la petición puede ir a 22 (una en Indonesia, otra sin condiciones publicadas) | `NO_TRAINING_PROVIDER` en `ai.config.ts` (sin `only`); runbook `ai-gateway.md` § 0 (sin lista de proveedores) | Art. 13.1.e-f (nombrar destinatarios y transferencias); arts. 44-46 (Indonesia sin adecuación ni garantía) | **Hecho el 2026-09-26.** En la cuenta, *Allowed providers* = DeepInfra y CoreWeave (propietario). En código, `provider.only` desde `AI_PROVIDER_ONLY`, obligatorio al arrancar con `openrouter` (`Env.validation.ts:506-507`). La política nombra exactamente esa lista; cambiarla pasa antes por la política |
| P1-13 | ~~La licencia de MiniMax M3 exige, en uso comercial, mostrar «Built with MiniMax M3» y un aviso único a MiniMax~~ | licencia en Hugging Face; condiciones de OpenRouter § 5.1 | Contrato (licencia aceptada vía OpenRouter § 5.1) | **Cerrado el 2026-09-26**: el propietario quitó MiniMax de reserva. La nueva reserva, Gemma 4 31B, es Apache 2.0: sin aviso, atribución ni restricciones que trasladar a los usuarios para quien usa el modelo por API (§ 4.4 d). Otro cambio de modelo reabre esta fila |

### P2

| # | Hallazgo | Dónde | Arreglo |
| --- | --- | --- | --- |
| P2-1 | Opciones «Halal»/«Kosher» preguntan la religión | `es-ES.ts:834-835`; `_enums.ts:21-22` | Restricciones neutras («sin cerdo», «sin alcohol», «carne de sacrificio ritual»); mientras tanto, dentro del consentimiento explícito |
| P2-2 | «Al continuar aceptas… la política de privacidad»: la política se informa, no se acepta; y no se guarda qué versión de las condiciones se aceptó | `es-ES.ts:183` | Texto nuevo ([`textos/03`](./textos/03-condiciones-uso.md) § A); guardar `termsVersion` y fecha al registrarse |
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
