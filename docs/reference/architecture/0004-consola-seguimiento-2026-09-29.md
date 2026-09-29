# 0004 — La consola, segunda vuelta: calidad, gasto, auditoría, retención y avisos

> **Purpose**: respuesta del agente `architect` a la petición del owner del 2026-09-29,
> tras cerrar el proyecto 007 (la consola de administración): añadir a la consola nueve
> cosas —calidad del catálogo, calidad de los planes, tope mensual del gasto en IA de
> texto, registro de acciones del admin, el barrido nocturno de pasos, cohortes de
> retención, avisos al owner, estadísticas de notificaciones y consentimientos— «y lo que
> se le ocurra al arquitecto». Dice, punto por punto, si se puede, qué cuesta de verdad,
> qué rompe, dónde está la línea de privacidad de `0028`, qué hay que empezar a grabar ya,
> y en qué orden hacerlo como proyecto 008.
> **Audience**: el owner y los agentes. **Committed**: sí. **Maintained by**: el agente
> `architect`; una vez fusionado no se edita — una revisión posterior es un informe nuevo.
>
> Base: `main` en `dcf10bc` (#154). Cada número lleva etiqueta: **medido** (dónde),
> **estimado** (con la hipótesis) o **desconocido**. Las mediciones son agregados de solo
> lectura sobre la base de desarrollo (Nutria-E2E), en una transacción `READ ONLY`, con el
> guard de `local-probe` comprobando antes que no era producción. **Producción no se ha
> leído.** Durante el informe **no se hizo ninguna llamada a modelo, no se gastó nada y no
> se escribió en ninguna base de datos.**

---

## 1. Veredicto

**Sí, con condiciones.** Siete de los nueve puntos se pueden hacer sin gastar un euro y sin
romper `0028`. Uno se hace solo a medias: los consentimientos de los textos legales no se
pueden contar porque nadie los graba. El otro, el tope de gasto, debe mostrarse y avisar,
pero no parar la generación, salvo que el owner lo decida sabiendo lo que pierde. Hay dos
condiciones que lo ordenan todo:

1. **Lo que hay que empezar a grabar va primero.** Seis de los puntos necesitan datos que
   hoy no se guardan. Su valor empieza el día que se despliega la escritura, no el día que
   se dibuja la página. Una fase pequeña de «empezar a grabar» abre el proyecto.
2. **«Actividad» hoy no mide actividad.** `session_started` se escribe al *iniciar sesión*
   (`apps/api/src/modules/auth/auth.config.ts:103`). La sesión dura 30 días y se renueva
   cada día de uso (`auth.config.ts:33-34`, `:194`). Quien abre la app todos los días sin
   volver a iniciar sesión no deja rastro. Esto ya afecta a lo entregado en 007: la
   tarjeta «Personas activas» de Resumen (`packages/core/src/repositories/Admin/AdminSeriesRepository.ts:75-97`)
   y la columna «Última actividad» de Cuentas (`packages/core/src/repositories/User/UserRepository.ts:60`)
   cuentan inicios de sesión, no uso. Hay que arreglar la señal antes de hacer cohortes.

### Por punto

| # | Punto | Veredicto | Esfuerzo | Qué hay que empezar a grabar | Útil desde |
| --- | --- | --- | --- | --- | --- |
| 1 | Calidad del catálogo | **Sí, con cambios**: solo lo que nace en ejecución (recetas del modelo, fotos fallidas). Los ingredientes ya se comprueban en CI | S–M | Nada | El primer día |
| 2 | Calidad de los planes | **Sí, con cambios**: un resumen de recuentos en `generation_metadata`, solo agregado por periodo, nunca en la fila de Registro | M | `quality` por plan, al generarlo | ~2–4 semanas después (depende del volumen, **desconocido** en producción) |
| 3 | Tope mensual de IA de texto | **Sí, con cambios**: indicador + aviso + parada del barrido. Parar la generación es **decisión del owner** | S (M si se para la generación) | La etiqueta `feature` en `ai_call` | El primer día; el reparto por función, desde que se despliega |
| 4 | Registro de acciones del admin | **Sí**, en `audit_logs` (ya existe y está vacía), con una migración pequeña | S–M | Una fila por acción, en la misma transacción que la acción | Desde que se despliega; lo anterior no se recupera |
| 5 | Barrido nocturno de pasos | **Sí**: el estado sale de `steps_version`; lo que hace cada noche necesita un evento | S | `cron_run` por ejecución y `feature` en `ai_call` | Estado: el primer día. Histórico: desde que se despliega |
| 6 | Cohortes de retención | **Sí, con cambios**: primero arreglar «activo»; con pocas personas, cohortes mensuales y en números, no en porcentajes | M (+S de la señal) | Un evento de uso, como mucho uno al día por persona | ~5 semanas después de la señal. Una versión aproximada con filas ya guardadas sale el primer día |
| 7 | Avisos al owner | **Sí, con cambios**: sin cron nuevo. Un resumen diario en el cron de las 08:00 y dos avisos al momento con deduplicación. Solo recuentos y un enlace | M | `owner_alerted` (para no repetir) | Desde que se despliega |
| 8 | Estadísticas de notificaciones | **Sí, con cambios**: suscripciones y envíos, sí. «Abiertos», no; en su lugar, check-in hecho tras el recordatorio | S | El canal real de cada envío (hoy se pierde uno) | Envíos: el primer día |
| 9 | Consentimientos | **Sí** para los cuatro versionados. **No** para los textos legales: no hay registro de aceptación, y crearlo es cosa de `legal` | S | Nada (textos legales: decisión de `legal`) | El primer día |

### Lo que añado

| # | Añadido | Veredicto | Esfuerzo | Qué hay que grabar |
| --- | --- | --- | --- | --- |
| A1 | **Señal de actividad real** (arregla 007 y es requisito del 6) | Sí, lo primero | S | `app_used`, como mucho uno al día por persona |
| A2 | **«Deberían ser cero»**: comprobaciones que fallan en silencio (recetas por encima del límite, macros sin calcular, raciones de comida fuera de 0,5–4, platos que no caben en ninguna comida) | Sí, dentro del punto 1 | S | Nada |
| A3 | **Latido de los crons**: cuándo corrió cada uno y qué hizo | Sí, junto con el 5 y el 8 | S | `cron_run` |
| A4 | **Correo que no sale**: envíos fallidos por plantilla | Sí | S | `mail_sent` con `{kind, ok}` |
| A5 | **Ajustes › Sistema**: versiones en vigor (commit, prompt, pasos, consentimientos) y qué integraciones están configuradas, solo sí o no | Sí | S | Nada |

**No recomiendo** leer las cuotas de Neon o Vercel desde la consola. Pondría otra clave con
permisos de cuenta dentro de la API, y el owner ya tiene esos paneles. Tampoco la
exportación a CSV, ni la salud de OmniRoute, ni Stripe: siguen fuera, como en 007.

---

## 2. Premisas revisadas

### Las que atraviesan todo

| Premisa | Estado | Evidencia |
| --- | --- | --- |
| «Crons en el plan gratuito de Vercel» | **incorrecta** | Vercel es Pro desde el 2026-09-26 (lo dijo el owner ese día). `docs/reference/deployment.md:177` todavía dice «A daily run is what the Hobby plan allows»: **documento desfasado**, se lo paso al lead. El límite que de verdad aprieta es **Neon**, que sigue gratis: 100 CU-h y 5 GB de transferencia al mes por proyecto, compartidos entre producción y desarrollo (`docs/reference/preview-environment.md:44-50`) |
| «`ai_call` ya lleva `costUsd`» | **confirmada, con un agujero** | `apps/api/src/modules/ai/clients/StructuredAiClient.ts:91-101` y `:141-153`. En dev, **278 de 840** `ai_call` de los últimos 30 días no llevan coste (**medido**, dev). Allí hubo rutas distintas de OpenRouter, así que la proporción de producción es **desconocida**. Además, una llamada cortada por tiempo no devuelve cuerpo, y OpenRouter puede cobrarla igual |
| «`session_started` sirve para medir actividad» | **incorrecta** | Ver § 1, condición 2. Dev: 12 eventos, 4 personas (**medido**; no representativo) |
| «Hoy no se registra ninguna acción del admin» | **confirmada** | `audit_logs` existe (`packages/database/src/schemas/platform.schema.ts:75-88`) y nada escribe en ella: 0 filas en dev (**medido**). `grep` no encuentra ningún escritor |

### Punto 1 — Calidad del catálogo

| Premisa | Estado | Evidencia |
| --- | --- | --- |
| Hay recetas cuyas macros no se pueden calcular (null) | **incorrecta como problema, correcta como vigilancia** | `perServing` devuelve null solo si `servings ≤ 0` o si un ingrediente no está en el catálogo (`packages/core/src/controllers/Admin/AdminCatalogueController.ts:75-99`). `recipe_ingredients.ingredient_id` es FK `restrict` y `servings` vale 1 por defecto (`recipe.schema.ts:42`). En dev: 0 recetas sin ingredientes, 0 con `servings ≤ 0`, 0 sin kcal (**medido**). Sirve como comprobación que debe dar cero, no como página |
| Raciones fuera de rango | **confirmada** | Hay dos rangos: `recipes.servings` (1–8, el esquema del pool) y `meals.servings` (`SERVING_BOUNDS` 0,5–4, `packages/core/src/domain/Scheduler/Scheduler.ts:19`). Tras la migración `0047` de `0070`, en dev no queda ninguna receta por encima de 1.350 kcal por ración (**medido**) y quedan 74 por encima de 900 (64 del modelo y 10 de la semilla; **medido** sin distinguir comida, así que es una cota superior) |
| Rechazos `oversized` a lo largo del tiempo | **confirmada; casi hecha** | `AdminGenerationsRepository.rejectionsByReason` ya suma los rechazos por motivo del periodo (`packages/core/src/repositories/Admin/AdminGenerationsRepository.ts:168-184`) y Registro los dibuja. Por día es el mismo SQL con `group by` día. Laguna: los cambios de plato (`MealSwap.service.ts:153`) llaman al modelo y no guardan sus llamadas en ningún sitio, así que sus rechazos no se ven |
| Recetas sin foto como problema de datos | **incorrecta** | `0066` dibuja la foto la primera vez que alguien abre el plato y no hace relleno previo. «Sin foto» es lo normal para un plato que nadie ha abierto. La señal es `failed` por motivos del plato, que Imágenes ya cuenta |
| Ingredientes sin alérgenos o sin países | **incorrecta** | `countries` vacío significa «en todas partes» (`packages/database/src/schemas/food.schema.ts:41-49`). 494 de 930 ingredientes no tienen ningún alérgeno enlazado, y es correcto: el arroz no tiene (**medido**, dev). Lo que sí es un error, que el nombre diga «queso» y falte `milk`, ya lo comprueba un test de la semilla (`packages/database/src/seed/seed.test.ts:150-175`), igual que la coherencia kcal–macros (`:70-91`) y las traducciones (`:176-208`). Los ingredientes solo entran por la semilla (`packages/database/src/seed/index.ts:69`, `:143`), así que su sitio es CI, que es mejor sitio que la consola (`0028`: el catálogo se edita en git) |

### Punto 2 — Calidad de los planes

| Premisa | Estado | Evidencia |
| --- | --- | --- |
| Se puede puntuar cada plan contra el listón del owner al generarlo | **confirmada** | En `PlanGeneration.service.ts:277-371` están en memoria las `violations` de `validatePlan`, `loads.dayTargets` (días de evento) y `minimumKcal` (`:237`), y hoy solo se guardan como frases (`advisorySummary`, `:371`, en `generationMetadata`, `:565`). Las clases están cerradas (`packages/core/src/domain/PlanValidation/PlanValidation.ts:51-64`) |
| Se puede calcular a posteriori con lo guardado | **incorrecta como sustituto** | Los cambios de plato reescriben `meals` en su sitio (`plan.schema.ts`, `meal_swaps`). Solo 199 de 350 `plan_days` de dev llevan `targets` (**medido**). Un cálculo retroactivo mide el plan «como está hoy», no «como se generó», y lee contenido de planes. No lo recomiendo; como mucho, una etiqueta «aproximado» |
| «Cuántos planes tocaron el suelo de energía» | **hipótesis que hay que definir** | El suelo actúa en dos sitios: al calcular el objetivo, que se recorta a `MINIMUM_DAILY_KCAL` (queda en la derivación de `nutritionTargets`), y en el planificador (`Scheduler.ts:1191-1228`), que no deja un día por debajo aunque salga de banda. Propongo contar los días cuyo mínimo de banda (objetivo × 0,95) cae bajo el suelo. `plan-evaluator` debe confirmar que así se ve el caso 12/14 conocido |
| Los avisos del validador se pueden enseñar | **solo como recuentos por clase** | Las frases de `advisories` incluyen el nombre que la persona dio a su evento («la carga para «…» no se aplicó», `PlanGeneration.service.ts:489`) y cifras de su plan. Son texto libre personal |

### Punto 3 — Tope de IA de texto

| Premisa | Estado | Evidencia |
| --- | --- | --- |
| Se puede copiar el tope de las fotos | **confirmada para mostrarlo** | Las fotos: `AI_IMAGE_MONTHLY_CAP_USD` (`apps/api/src/config/Env.validation.ts:232`), suma del mes en `recipe_image_calls`, corte en `DishPicture.service.ts:138`, precio de reserva cuando OpenRouter no lo dice (`:19`). Mes UTC (`RecipeController.ts:80`) |
| Hace falta un corte dentro de la app | **incorrecta como necesidad** | La clave de OpenRouter de producción ya lleva un tope mensual (`0064`, punto 3: «the key's guardrail: … a monthly cap»). Esa pared cuenta exactamente lo facturado. La suma de la app no, por el agujero de arriba |
| El texto gasta mucho | **incorrecta** | 0,007–0,0095 $ por plan con Gemma (**medido**, dev, 2026-09-26, informe `0003` § 1). 0,10–0,15 $ por quincena con DeepSeek (**estimado**, `0064`). Las fotos, en cambio, ~0,70–1,10 $ por plan (**estimado**, `0003`). Gasto real de producción: **desconocido** desde aquí; la consola ya lo muestra en IA y modelos |

### Punto 4 — Registro de acciones

| Premisa | Estado | Evidencia |
| --- | --- | --- |
| Hace falta una tabla nueva | **incorrecta** | `audit_logs` (`platform.schema.ts:75-88`): `action`, `actorId` (FK con `set null`), `entity`, `entityId` (texto, sin FK), `metadata`, `ipHash`, marcas de tiempo, índices por actor y por acción |
| Se puede registrar «quién» | **confirmada, con matiz** | Solo hay un admin. «Quién» casi siempre es el owner, o nadie: la activación automática, o el enlace del correo `GET /admin/activate`, que va con token y sin sesión (`AdminAccounts.controller.ts:85-87`). Lo útil es qué y cuándo |
| Acciones que mutan (inventario) | **medido en el código** | activar (`AdminAccounts.controller.ts:61`), activar por enlace (`:85`), cambiar plan (`:68`), conceder profesional (`AdminProfessionals.controller.ts:44`), revocar (`:55`), marcar o reabrir mensaje (`AdminFeedback.controller.ts:43`), interruptor (`AdminSettings.controller.ts:26`), push de prueba (`AdminPushTest.controller.ts:20`). Fuera de la consola, la activación automática al confirmar el correo |

### Punto 5 — Barrido de pasos

| Premisa | Estado | Evidencia |
| --- | --- | --- |
| Pendiente, reescrita o rechazada se puede saber | **confirmada, sin grabar nada** | El estado vive en `recipes.steps_version`: `2.8.0` si está al día, `2.8.0+n` si lleva n rechazos, y a los 3 se deja (`packages/core/src/domain/Method/RewriteStamp.ts:21`, `:62`). La condición «pendiente» ya existe en SQL (`packages/core/src/repositories/Recipe/RecipeRepository.ts:852-877`). Dev: 1.559 al día, 101 sin versión, 47 de versión vieja, 8 con algún rechazo y 6 en el límite (**medido**) |
| Cuántas reescribe cada noche | **no se puede con lo que hay** | `recipes` no tiene marcas de tiempo (`recipe.schema.ts:19-62`). El resultado de cada barrido (`RewriteRun`, `RecipeRewriter.service.ts:57`) se devuelve al cron y solo queda en el log (`Cron.controller.ts:53-56`) |
| `ai_call` no dice quién llamó | **confirmada** | `AiRequest` no tiene campo de función (`apps/api/src/modules/ai/clients/AiClient.ts:18-34`). Hay tres llamadores de texto: plan (`PlanGeneration.service.ts:178`), cambio de plato (`MealSwap.service.ts:153`) y barrido (`RecipeRewriter.service.ts:178`). Etiquetarlos no nombra a nadie |
| El barrido está encendido en producción | **desconocido** | `AI_REWRITE_STEPS` vale `false` por defecto (`Env.validation.ts:308`). El owner dijo que el 2026-09-26 producción quedó al día. Si no hay nada pendiente, esta página enseñará ceros hasta el próximo cambio de `STEPS_VERSION` |

### Punto 6 — Retención

| Premisa | Estado | Evidencia |
| --- | --- | --- |
| Sale de `session_started` | **incorrecta** | Ver § 1. Arreglo: `databaseHooks.session.update.after` existe en la versión instalada de Better Auth (1.7.5, `init-options.d.mts`, bloque `session.update`), y `SessionGuard` renueva la sesión en cada lectura (`apps/api/src/shared/guards/Session.guard.ts:38`). **Hipótesis**: el gancho salta una vez al día por sesión usada; se prueba con un test de integración |
| Sale de datos existentes | **en parte** | Las filas con fecha de lo que alguien *hace* (`meal_completions`, `meal_swaps`, `check_ins`, `progress_entries`) permiten una retención de «hizo algo» hacia atrás, contando personas distintas por semana, sin leer contenido (`0033`: contar las filas que ya existen) |
| Tiene sentido estadístico | **hipótesis** | Beta de amigos. Dev tiene 10 cuentas (**medido**); producción, **desconocido**. Con cohortes semanales de 1–3 personas, un porcentaje es una persona |

### Punto 7 — Avisos

| Premisa | Estado | Evidencia |
| --- | --- | --- |
| Hay correo al owner | **confirmada** | `notifyOwnerOfWaitingAccount` (`apps/api/src/modules/auth/services/AccountWaitingMail.ts`), `OWNER_EMAIL` (`Env.validation.ts:397`), Gmail SMTP |
| Hace falta un cron nuevo | **incorrecta** | El de las 08:00 ya existe (`apps/api/vercel.json`, `Cron.controller.ts:46-51`). Los fallos de generación ya van a Sentry (`PlanJobRunner.service.ts:118`), que tiene reglas de alerta propias. Un cron cada hora despertaría Neon 24 veces al día: ~0,5 CU-h diarias con 5 minutos de reposo a 0,25 CU (**estimado**), frente a 19 CU-h en 15 días medidos (`preview-environment.md:48`). A ese ritmo (~38 CU-h al mes, las dos ramas juntas) pasaría del ~38 % al ~53 % de las 100 CU-h (**estimado**) |
| Push al owner | **posible, no recomendada ahora** | `PushService` existe, pero exige que el owner esté suscrito desde la PWA del iPhone. El correo ya funciona |

### Punto 8 — Notificaciones

| Premisa | Estado | Evidencia |
| --- | --- | --- |
| Hay suscripciones y envíos | **confirmada** | `push_subscriptions` (`platform.schema.ts`) y `notifications` escrita tras cada envío (`NotificationRepository.ts:176-187`). En dev las dos están vacías (**medido**) |
| El canal queda bien registrado | **incorrecta** | Se guarda `mailed ? 'email' : 'push'` (`CheckInReminder.service.ts:100`): si salen los dos, el push se pierde. `pushed` se devuelve y no se guarda |
| Se puede saber si se abrió | **incorrecta** | Nadie escribe `read_at`. El `notificationclick` de `apps/web/public/sw.js:76` solo abre la URL. Medirlo exige una baliza nueva, y en el correo un píxel de seguimiento, que no recomiendo (ePrivacy, y Gmail lo intercepta) |

### Punto 9 — Consentimientos

| Premisa | Estado | Evidencia |
| --- | --- | --- |
| Consentimiento de perfil | **confirmada** | `profile_data_consents.version` (`profile.schema.ts:215`), `PROFILE_CONSENT_VERSION = '1.0.0'` (`packages/core/src/entities/Profile/Profile.ts:85`) |
| Datos de salud | **confirmada** | `health_data_consents.version` (`profile.schema.ts:200`), `1.1.0` (`Health.ts:47`). Contarlo es contar cuántas personas tienen datos de salud: un recuento, permitido por `0028` |
| Vínculo con profesional | **confirmada** | `care_links.consent_version` (`care.schema.ts:79-80`), `2.0.0` (`Care.ts:18`). Acuerdo del profesional en `professionals.agreement_version` (`professional.schema.ts:26-27`) |
| Textos legales (privacidad, condiciones) | **incorrecta** | No hay tabla, columna ni evento de aceptación. `/privacidad` y `/condiciones` se publican sin aceptación versionada. Contarlos exige grabar la aceptación en el alta y pedirla de nuevo al cambiar el texto: una decisión de producto y legal, no de consola |

---

## 3. Qué hay hoy

- **Eventos**: una lista cerrada de tres nombres, `ai_call`, `session_started` y
  `swap_requested` (`packages/core/src/entities/Analytics/Analytics.ts:14-33`). Regla de
  `0033`: nada que la base ya sepa, nada sobre el contenido. Se escriben sin lanzar
  errores (`AnalyticsRepository.record`). En dev hay 854 filas en 688 KB (**medido**).
- **Registro de generaciones**: `AdminGenerationsRepository` selecciona
  `generation_metadata` **entera** (`:52`) y `planOf` se queda solo con siete claves
  permitidas (`AdminController.ts:95-111`). Las frases de `advisories`, que llevan nombres
  de eventos y cifras, no salen en la respuesta, pero sí viajan de Neon a la función.
  **Hallazgo P3** para quien lleve el núcleo del admin: pedir en SQL solo las claves
  permitidas. Cumple mejor la letra de `0028` («the repository behind it selects no column
  that carries content») y ahorra transferencia.
- **IA y modelos** suma `costUsd` por día, modelo y proveedor (`AdminAiRepository.ts`). No
  distingue quién llamó.
- **Catálogo**: Recetas compone todas las recetas en memoria para ordenar por kcal
  (`AdminCatalogueController.ts:83`), así que ya existe el camino para calcular la calidad
  en el acto.
- **Crons**: `/cron/rewrite-steps` a las 03:30 UTC y `/cron/reminders` a las 08:00 UTC, con
  `CronSecretGuard`, `@Public` y 404 a quien no lleve el token (`Cron.controller.ts:30-58`).
- **Correo**: si un envío falla, solo queda en el log (`Email.service.ts:92-104`).
- **Planes**: `meal_plans.generation_metadata` ya guarda `advisories` como frases,
  `fallback` y el modelo (`PlanGeneration.service.ts:565-574`).

---

## 4. Propuesta

### 4.0 La forma común: tres cosas que se graban y una regla

Casi todo lo que hay que empezar a grabar cabe en tres sitios que ya existen. No hace
falta ninguna tabla nueva.

1. **`analytics_events`, con la lista cerrada ampliada en cuatro nombres, todos sin
   persona** salvo `app_used`:

   | Evento | Quién lo escribe | `userId` | Propiedades |
   | --- | --- | --- | --- |
   | `app_used` | gancho `session.update.after` | sí, como `session_started` | ninguna |
   | `cron_run` | `CronController`, al terminar cada barrido | null | `{job: 'rewrite' \| 'reminders', …recuentos de RewriteRun o ReminderRun}` |
   | `mail_sent` | `EmailService.send` | null | `{kind, ok}` (`kind` es la plantilla, nunca el destinatario) |
   | `owner_alerted` | el aviso al owner | null | `{kind}` |

   Además, `ai_call` gana `feature: 'plan' | 'swap' | 'rewrite'`, que llega por un campo
   nuevo de `AiRequest`. Cada uno cumple la regla de `0033`: registra algo que no deja
   otra huella. Es una ampliación de una decisión cerrada, así que lleva **decisión nueva**
   (lead).

   **Lo que rompería sin más:** la gráfica «eventos por día» de Embudo dibuja *todos* los
   eventos menos `ai_call` (`CHARTED_EVENTS`,
   `packages/core/src/controllers/Admin/AdminSeriesController.ts:166`). `cron_run`,
   `mail_sent` y `owner_alerted` aparecerían ahí como líneas de «producto», con la clave
   en crudo si falta su etiqueta. La lista cerrada tiene que partirse en eventos de
   producto (`session_started`, `app_used`, `swap_requested`) y de sistema (`ai_call` y
   los tres nuevos), y Embudo tiene que leer solo los de producto. Cada nombre nuevo lleva
   su etiqueta en los dos diccionarios.
2. **`meal_plans.generation_metadata.quality`**, con recuentos y ninguna cifra (§ 4.2).
3. **`audit_logs`**, con una columna nueva (§ 4.4).

**La regla**: nada nuevo aparece en una fila con dirección (una cuenta, Registro) salvo
el registro de acciones del admin, que trata de lo que hizo el owner. La calidad de los
planes, la retención y el uso se enseñan solo agregados por periodo.

### 4.1 Punto 1 — Catálogo › Calidad

Una página con dos bloques. Todo se calcula en el acto con las funciones que ya existen
(`composePerServing`, `isOversized`, `servingCap`, `MealFit`), nunca con una fórmula
nueva:

- **«Debería ser cero»** (A2). Cada fila es un recuento que enlaza a Recetas con el filtro
  puesto:
  - recetas por encima del límite (`isOversized`). Después de `0070` debe dar 0; si no da
    0, algo se saltó el `PoolBuilder`;
  - recetas sin macros calculables;
  - comidas con `servings` fuera de `SERVING_BOUNDS`. Es un recuento sobre `meals` que no
    devuelve ninguna fila; lo revisa `invariant-reviewer`;
  - platos cuyas comidas no casan con las de sus ingredientes (`MealFit`), que nunca se
    sirven;
  - recetas en el límite de rechazos del barrido.
- **«Para mirar»**:
  - recetas por encima del tope de su comida pero dentro del límite (900, 700 o 400 kcal
    por ración), por origen, porque la semilla también tiene;
  - rechazos `oversized` por día (el SQL de `:168` agrupado por día);
  - fotos `failed` por motivos del plato.

Lo que **no** va: ingredientes sin alérgenos o sin países. Ya lo cubren los tests de la
semilla (§ 2). Si el owner quiere una comprobación más, que sea un test de
`seed.test.ts`, que salta antes de que el dato llegue a producción.

**Alternativa descartada**: un barrido nocturno que guarde una foto fija de la calidad.
Solo aporta si el cálculo en el acto cuesta. Leer todo el catálogo son 9.990 filas de
`recipe_ingredients` en dev (**medido**), unos 0,5–1 MB por visita (**estimado**). A 2
visitas al día son 30–60 MB al mes, un ~1 % de los 5 GB.

### 4.2 Punto 2 — Planes › Calidad

- **Al generar**, una función pura nueva en `core/domain/PlanValidation`,
  `planQuality(violations, dayTargets, minimumKcal, targets)`, con test, devuelve:
  `{ days, daysInBand, missesByMacro: {kcal, protein, carbs, fat}, eventDays,
  eventDaysInBand, advisoriesByKind, daysUnderFloorBand, loadsRefused, fallback }`.
  Solo recuentos: ni objetivos, ni kcal, ni nombres de eventos. Se escribe en
  `generationMetadata.quality` (`PlanGeneration.service.ts:565`).
- **En la consola**, en el periodo y sobre todos los planes: porcentaje de días en banda
  (los cuatro macros a la vez), por macro, días de evento en su banda, avisos por clase,
  planes con `fallback`, y días que el suelo condicionó.
  - La consulta pide solo `generation_metadata -> 'quality'` y `created_at`.
  - **Sin serie por día** para el suelo: con pocos planes al día, un día con 1 plan es una
    persona. El periodo de 30 días lo diluye.
- **Nunca** en `planOf` ni en Registro. Lo verifica un test e2e que falla si la respuesta
  de `/admin/generations` contiene `quality`.
- **Sin cálculo retroactivo** (§ 2). La página dice desde qué fecha hay datos.

**Alternativas descartadas**:

| Alternativa | Por qué pierde |
| --- | --- |
| Un evento `plan_scored` sin persona | Duplicaría lo que el plan ya sabe de sí mismo, contra `0033` |
| Calcularlo al leer, desde `meals` | Mide el plan después de los cambios y lee contenido |

### 4.3 Punto 3 — Tope de IA de texto

- **Mostrar**: `AI_TEXT_MONTHLY_CAP_USD` (opcional; sin valor, no hay indicador), un
  `Gauge` en IA y modelos y una tarjeta en Resumen.
  - Mes **UTC**, como las fotos (`RecipeController.ts:80`) y (**hipótesis**) como el
    reinicio del tope de la clave de OpenRouter. No mes de Madrid, aunque los periodos de
    la consola lo sean: el indicador tiene que coincidir con la pared real.
  - Junto al gasto, «llamadas sin coste registrado» del mes. Si son muchas, la cifra es un
    mínimo, y la página lo dice.
- **Avisar**: al 80 % y al 100 %, un `owner_alerted` por umbral y mes (§ 4.7).
- **Parar el barrido**: con el 80 % gastado, `RecipeRewriter.rewriteOutdated` no empieza.
  El barrido es lo único que gasta sin que nadie lo espere.
- **Parar la generación: decisión del owner.** Las dos opciones acaban igual:

  | Opción | Qué pasa al llegar al tope | Coste |
  | --- | --- | --- |
  | **A (recomendada): la pared es la clave de OpenRouter** | La clave devuelve 402. `PoolBuilder` lo trata como fallo del proveedor y el plan sale de la biblioteca (`fallback: full_library`) o, si la biblioteca no llega, `GENERATION_AI_UNAVAILABLE` | Una llamada rápida fallida por petición; nada que construir |
  | B: corte dentro de la app | Con el gasto ≥ tope, `isAvailable` responde false y el plan sale de la biblioteca sin llamar | Rompe el tercio nuevo de `0013` igual que A; se fía de una suma que puede quedarse corta; M de trabajo |

  Recomiendo A más el aviso: el aviso llega antes que la pared, y la pared cuenta lo que
  de verdad se facturó. B solo compensa si el owner quiere un tope *por debajo* del de la
  clave sin tocar OpenRouter. Condición para cualquiera de las dos: el tope de la app nunca
  por encima del de la clave (en `deployment.md`).
- **El gasto por función** sale de la etiqueta `feature` (§ 4.0): una columna más en IA y
  modelos, «planes / cambios / barrido».

### 4.4 Punto 4 — Registro de acciones

- **Migración**: `audit_logs.subject_user_id text references user(id) on delete set null`,
  más un índice por `created_at`. Así la traza «se activó una cuenta el día X» sobrevive a
  la baja sin guardar a quién. Hoy `entity_id` es texto sin FK, y guardar ahí el id de
  una persona dejaría ids de cuentas borradas, contra el invariante «Account deletion
  actually deletes». `entity_id` queda para lo que no es una persona: la clave del
  interruptor o el id del mensaje del buzón, que ya cae en cascada con su autor.
  Revisa `migration-reviewer`.
- **Escritura en la misma transacción que la acción**, como hace `careAccessLog` con el
  vínculo profesional (`0059`): una acción no puede ocurrir sin quedar registrada.
- **Qué se graba**, con acciones cerradas:
  - `account.activated`, con `metadata.via: 'console' | 'mail_link' | 'automatic'`;
  - `account.tier_changed`, con `{from, to}`;
  - `professional.granted` y `professional.revoked`;
  - `feedback.handled` y `feedback.reopened`;
  - `setting.changed`, con `{key, enabled}`;
  - `push.test_sent`.

  `actorId` es la sesión, o null en el enlace y en la activación automática. **Nunca** el
  cuerpo de la petición (lo dice el propio esquema, `platform.schema.ts:70-73`), y
  `ipHash` se queda vacío.
- **Página** Ajustes › Registro de acciones: una tabla con fecha, acción, cuenta afectada
  (su correo: las cuentas ya son filas con dirección) y detalle, con filtro por acción.
  Amplía `0068`, así que lleva una línea de decisión.
- **Fuera**: el cambio de plan que hace el webhook de Stripe (pagos aplazados). Cuando
  vuelva, es `via: 'stripe'`.

### 4.5 Punto 5 — Barrido de pasos

- **Estado** (sin grabar nada): tarjetas «al día / pendientes / con rechazos / dejadas»
  desde `steps_version`, con la condición SQL que ya existe, más una tabla de las recetas
  dejadas. Son datos del catálogo, sin persona. Va en Catálogo › Calidad o en su propia
  sección de Generación.
- **Histórico**: `cron_run {job: 'rewrite', pending, rewritten, skipped, unreached}` por
  noche, más el gasto y las llamadas de `feature: 'rewrite'`, en una línea por día.
- **Encendido o apagado**: `AI_REWRITE_STEPS` en Sistema (A5), como sí o no.

### 4.6 Punto 6 — Retención

1. **La señal primero (A1)**: `app_used` desde `session.update.after`, como mucho uno por
   sesión y día, más los `session_started` que ya existen.
   - «Activo» pasa a ser «inició sesión o usó una sesión ese día».
   - Resumen, Embudo y la columna de Cuentas pasan a leer los dos eventos. **Esto corrige
     007.**
   - **Alternativa descartada**: una escritura con deduplicación en `/users/me`. Sirve
     igual, pero pone una escritura en la ruta más caliente, y el gancho no añade ninguna
     petición.
   - Si el test demuestra que el gancho no salta en la renovación, esa alternativa pasa a
     ser el plan.
2. **Cohortes**: filas por semana (o por mes) de alta y columnas «activo en la semana 1, 2
   y 4», contando personas distintas.
   - Hasta que una cohorte tenga ~20 personas, **números y no porcentajes**, y agrupación
     mensual por defecto.
   - Sin enlace de una celda a las cuentas.
3. **Desde el primer día, una versión aproximada** con lo que ya hay: «hizo algo»
   (`meal_completions`, `meal_swaps`, `check_ins`, `progress_entries`) por semana. Se
   etiqueta como tal. Estas tablas son contenido, pero la consulta solo devuelve
   `count(distinct user_id)` por semana.

### 4.7 Punto 7 — Avisos

- **Resumen diario** (correo, uno al día como mucho y **solo si hay algo**). Va en
  `/cron/reminders`, **antes** de mirar el interruptor de recordatorios, porque son cosas
  distintas.
  - Contenido:
    - cuentas esperando;
    - mensajes nuevos del buzón (el número, nunca el texto);
    - generaciones fallidas en 24 h, por código;
    - gasto de texto y de fotos frente a sus topes;
    - lo que haya en «debería ser cero»;
    - correos fallidos (A4);
    - si algún cron no corrió (A3).
  - Todo con un enlace a la página de la consola. **Sin direcciones de nadie y sin texto
    de nadie.** El correo sale por Gmail y es menos seguro que la consola.
- **Al momento**, con deduplicación (`owner_alerted {kind}`, no se repite en 6 h):
  - **3 generaciones fallidas seguidas**. Se comprueba donde falla el trabajo
    (`PlanJobRunner.service.ts:118`) con una consulta de los 3 últimos trabajos.
  - **Gasto en el 80 % y el 100 %** de un tope, una vez por umbral y mes.
- **Alternativa para la racha de fallos: Sentry.** Los fallos ya llegan con la etiqueta
  `plan-generation:<código>`. Una regla de alerta en Sentry cuesta cero código y cinco
  minutos del owner. Si el owner la configura, la racha sale de este proyecto y solo
  queda el resumen.
- **Cuentas nuevas**: ya se avisa al momento cuando la puerta está cerrada (`0029`). No
  se duplica.
- **Sin cron nuevo.** El resumen se envía a las 08:00 UTC (las 10:00 en Madrid en verano).
  Si el owner lo quiere a otra hora, se cambia la hora del cron; lo que no hay que hacer
  es añadir uno cada hora (§ 2, Neon).

### 4.8 Punto 8 — Notificaciones

- Tarjetas: suscripciones push y personas con al menos una.
- Recordatorios enviados por semana y por canal.
  - **Arreglo**: guardar los dos canales cuando salen los dos, con una fila por canal o
    un canal `both`. Lo segundo es un cambio de enum, con migración, así que prefiero lo
    primero.
- **«Abiertos»**: en su lugar, «check-in hecho en los 3 días siguientes al recordatorio».
  Sale de `notifications.sent_at` y `check_ins.created_at`, contando personas distintas.
  Una baliza de apertura queda para cuando el volumen lo justifique.

### 4.9 Punto 9 — Consentimientos

- Una tabla por consentimiento: versión vigente, cuántas cuentas la tienen, cuántas tienen
  una anterior (a esas se les volverá a pedir) y, en el de perfil, frente a las cuentas
  con la bienvenida terminada.
- Datos de salud y vínculos con `shares_health`: solo el número.
- Acuerdo del profesional: por versión.
- **Textos legales: no.** Se lo paso al `legal`: ¿debe el alta grabar la aceptación
  versionada de `/condiciones` y `/privacidad`? La lista de activación
  (`docs/legal/checklist-activacion.md:43`) resuelve los cambios avisando por correo, no
  pidiendo aceptación de nuevo. Si `legal` decide grabarla, la consola la cuenta con el
  mismo patrón, en una fase posterior.

### 4.10 Añadidos A3–A5

- **A3, latido de los crons**: «último `cron_run` de cada trabajo» en Sistema. Si pasan
  más de 26 h sin uno, sale en el resumen. Detecta un `CRON_SECRET` perdido, porque
  entonces la ruta responde 404 y solo queda en el log (`deployment.md:82`).
- **A4, correo**: enviados y fallidos por plantilla y día. Con la contraseña de aplicación
  de Gmail revocada, nadie podría confirmar su dirección y hoy solo lo diría el log.
- **A5, Ajustes › Sistema**:
  - commit en producción (`VERCEL_GIT_COMMIT_SHA`);
  - `PROMPT_VERSION`, `STEPS_VERSION` y las versiones de consentimiento;
  - los topes;
  - y **solo sí o no** para `SMTP_HOST`, `OWNER_EMAIL`, `VAPID_*`, `CRON_SECRET`,
    `SENTRY_DSN`, la clave de fotos y `AI_REWRITE_STEPS`.

  Habría detectado a la primera el `SENTRY_DNS` mal escrito del 2026-09-21. Nunca un
  valor: un test verifica que la respuesta solo contiene booleanos y versiones.

---

## 5. Requisitos

| Tipo | Qué |
| --- | --- |
| **Código** | `core`: `planQuality`, repositorios de calidad, consentimientos, notificaciones, cohortes y auditoría. `api`: `feature` en `AiRequest` y sus tres llamadores, `cron_run`, `mail_sent`, gancho de sesión, escritura de auditoría en 8 rutas más la activación automática, aviso y resumen, rutas nuevas bajo `@Roles('admin')`. `web`: 5–6 páginas o secciones nuevas con los componentes de 007 (`StatTile`, `Gauge`, `DataTable`, gráficas) |
| **Datos** | **Una migración**: `audit_logs.subject_user_id` más el índice. El resto es JSON dentro de columnas que ya existen, más cuatro nombres de evento |
| **Infraestructura** | Ningún cron nuevo, ninguna tabla nueva, ningún servicio nuevo. Variable opcional `AI_TEXT_MONTHLY_CAP_USD` |
| **Dinero** | **0 €.** El correo por Gmail: un resumen al día más avisos raros |
| **Tiempo del owner** | Decidir D1–D5 (abajo). Poner `AI_TEXT_MONTHLY_CAP_USD` en Vercel. Opcionalmente, una regla de alerta en Sentry. Correr la migración en dev tras fusionar, como siempre. Probarlo en el iPhone |
| **Decisiones que toma el owner** | **D1** tope de texto: solo mostrar y avisar (recomendado) o también cortar dentro de la app. **D2** el valor del tope, que se decide mirando el gasto de 30 días que la consola ya muestra. **D3** auditoría: al borrar una cuenta, quitar el vínculo (`set null`, recomendado) o borrar la fila. **D4** avisos: correo (recomendado) o push, la hora del resumen, y si la racha de fallos va por Sentry. **D5** remitir a `legal` la aceptación de los textos legales |
| **Decisiones que registra el lead** | Una decisión que amplía `0033` (cuatro eventos y `feature`), una línea que amplía `0068` (registro de acciones y páginas nuevas) y, si D1 = B, una para el corte |
| **Revisores** | `invariant-reviewer` en cada fase de API (en especial la 1 y la calidad de planes), `migration-reviewer` en la migración, `legal` en el contenido del correo del resumen y en D5, `plan-evaluator` en la definición del suelo |

---

## 6. Riesgos

Primero los de seguridad, privacidad y cuota.

| Riesgo | A quién | Probabilidad | Cómo se vería | Cómo se deshace |
| --- | --- | --- | --- | --- |
| **La calidad de un plan acaba en una fila con dirección** (Registro), o se enseña por día con N = 1 | Cada persona con plan | media si nadie la vigila | Test e2e que busca `quality` en `/admin/generations`; revisión de `invariant-reviewer` | Quitar la clave del listado permitido; los datos no hay que tocarlos |
| **Las frases de `advisories` se cuelan** en una respuesta (llevan nombres de eventos) | Quien nombró un evento | baja (hoy hay lista blanca) | El mismo test; el P3 de § 3 lo cierra en SQL | Pedir en SQL solo las claves permitidas |
| **El correo del resumen saca datos del sistema** | Las personas del buzón y de Cuentas | baja con la regla «solo números y enlaces» | Revisión de `legal`; un test de la plantilla que falla si contiene `@` | Plantilla solo de números |
| **La auditoría conserva ids de cuentas borradas** | Quien se da de baja | alta si se usa `entity_id` | Revisión de la migración | FK con `set null` (D3) |
| **El tope de la app no coincide con la factura** (llamadas sin coste, cortes por tiempo) | El bolsillo del owner | media | «llamadas sin coste» junto al indicador | La pared real es la clave de OpenRouter (D1 = A) |
| **Transferencia de Neon** por las páginas nuevas | Producción entera (suspensión al pasar 5 GB) | baja | El panel de Neon | Todo son agregados de pocas filas; Calidad del catálogo lee ~0,5–1 MB por visita (**estimado**) |
| **Cómputo de Neon** si alguien añade un cron por hora | Producción entera | baja con este plan | +~15 CU-h al mes (**estimado**) | No hay cron nuevo |
| Los eventos de sistema nuevos aparecen en la gráfica de eventos de Embudo | La lectura del owner | segura si no se parte la lista | Líneas «cron_run», «mail_sent» en Producto | `CHARTED_EVENTS` pasa a ser la lista de eventos de producto (§ 4.0) |
| `app_used` escribe en cada renovación | Rendimiento del inicio de sesión | baja: una fila al día por persona, sin esperar al resultado (`AnalyticsRepository.record` nunca lanza) | Latencia de `/users/me` | Quitar el gancho |
| El gancho de Better Auth no salta al renovar | La corrección de «activo» | **hipótesis** | El test de integración de la fase 1 | Pasar a la escritura con deduplicación (§ 4.6) |
| Resumen diario cuando no hay nada | El buzón del owner | baja | — | Se envía solo si hay algo |
| Cohortes leídas como porcentajes con N pequeño | Las decisiones del owner | alta con la beta actual | — | Números con N, y agrupación mensual |
| Cambiar la definición de «activo» cambia las cifras que el owner ya ha visto | La confianza en el panel | segura | Un salto en la serie el día del despliegue | «Cómo se cuenta» con la fecha del cambio |

---

## 7. Coste y esfuerzo

En tamaños de fase de 007 (S ≈ una fase corta de un agente, M ≈ una fase normal, L ≈ una
pareja backend + web de 007). **Estimado**, a partir de lo que costaron las fases de 007
en su LOG.

| Bloque | Esfuerzo | Lo que lo mueve |
| --- | --- | --- |
| Empezar a grabar: eventos, `feature`, calidad, auditoría con migración | M–L | Cuántas rutas mutan (8 más la activación automática); la definición del suelo |
| Calidad del catálogo + Sistema + consentimientos + notificaciones | M | Reutilizar la composición de Recetas; que `MealFit` exista como función |
| Gasto: indicador, aviso, parada del barrido, reparto por función | S (M si D1 = B) | D1 |
| Calidad de planes + registro de acciones + retención | M–L | El volumen (con poco, las cohortes son tablas cortas) |
| Avisos | M | Sentry sí o no; revisión de `legal` |

**Dinero: 0 €** en todos los escenarios. Lo que sí consume:

- **Transferencia de Neon**: < 100 MB al mes (**estimado**: 2 visitas diarias a Calidad
  más los agregados).
- **Almacenamiento**: < 1 MB al mes con 50 personas (**estimado**: `app_used` ≈ 1.500
  filas al mes a ~100 B más índice, `cron_run` 60 filas, auditoría decenas).
- **Vercel**: ninguna invocación nueva.

---

## 8. Plan (para `/plan-project`, proyecto 008)

Principio: **primero lo que empieza a contar; después lo que lee lo que ya existe;
después lo que necesita que lo nuevo se acumule; al final lo que sale del sistema.**

### Fase 1 — Empezar a grabar (API + core, sin páginas)

- **Qué**:
  - `app_used` desde el gancho de sesión, con test de integración;
  - `feature` en `ai_call` desde los tres llamadores;
  - `cron_run` en los dos crons;
  - `mail_sent` en `EmailService`;
  - `planQuality` y su escritura en `generation_metadata`;
  - el canal doble de los recordatorios.

  Una decisión que amplía `0033`.
- **Métrica de éxito**: en dev, tras un día de pruebas, cada evento aparece con las
  propiedades esperadas. Un plan generado lleva `quality` y su `days` = 14.
  `/admin/generations` no contiene `quality` (test e2e).
- **Señal para parar**: si `planQuality` no puede decir qué es «el suelo condicionó el
  día» sin que `plan-evaluator` lo valide sobre la biblioteca real, se graba sin ese campo
  y se añade después.

### Fase 2 — Registro de acciones (la única migración)

- **Qué**: `subject_user_id` con `set null` más el índice, la escritura en transacción en
  cada acción, y la página Ajustes › Registro de acciones. Revisan `migration-reviewer` e
  `invariant-reviewer`.
- **Métrica**: cada una de las 8 rutas y la activación automática dejan exactamente una
  fila (e2e). Al borrar una cuenta, su fila queda con el sujeto a null.
- **Parar si**: la escritura en transacción obliga a tocar el repositorio de usuarios más
  allá de pasarle el `tx`. Entonces se hace la escritura inmediatamente después y se
  documenta la ventana.

### Fase 3 — Corregir «activo» y leer lo que ya existe (web + API)

- **Qué**:
  - Resumen, Embudo y Cuentas leen `session_started ∪ app_used`, con «Cómo se cuenta»
    fechado;
  - Catálogo › Calidad (con «debería ser cero» y `oversized` por día);
  - Personas › Consentimientos;
  - Ajustes › Sistema;
  - la sección de notificaciones.
- **Métrica**: los «debería ser cero» dan 0 en dev, salvo lo que se sabe que no. Sistema
  no devuelve ningún valor que no sea booleano o versión (test).
- **Parar si**: Calidad lee más de ~2 MB por visita en dev. Entonces, foto fija nocturna
  dentro del cron de las 03:30.

### Fase 4 — Gasto

- **Qué**: `AI_TEXT_MONTHLY_CAP_USD`, `Gauge`, «llamadas sin coste», gasto por función,
  parada del barrido al 80 % y, si D1 = B, el corte de generación.
- **Métrica**: el indicador de un mes cuadra con el panel de OpenRouter con menos de un
  10 % de diferencia (el owner lo compara una vez).
- **Parar si**: la diferencia es mayor. Entonces se busca de dónde sale antes de avisar
  con esa cifra.

### Fase 5 — Lo que necesita datos acumulados

- **Qué**: Planes › Calidad, Retención (la aproximada desde el primer día y la de
  `app_used` cuando haya 5 semanas) y el histórico del barrido.
- **Cuándo**: no antes de 2–4 semanas después de la fase 1, o la página enseñará casi
  nada.
- **Métrica**: el porcentaje de días en banda del periodo cuadra con lo que
  `evaluate-plans.mjs` mide sobre la misma biblioteca. Esto último es **hipótesis**:
  personas reales frente a perfiles fijos; si no cuadra, es información, no un fallo.
- **Parar si**: no hay al menos ~10 planes en el periodo. La página dice «pocos datos» en
  vez de un porcentaje.

### Fase 6 — Avisos

- **Qué**: el resumen diario en `/cron/reminders`, la racha de fallos (o la regla de
  Sentry, D4), los umbrales de gasto y `owner_alerted`.
- **Métrica**: en una semana de dev con fallos provocados, un correo de racha y un
  resumen al día, nunca dos del mismo tipo en 6 h.
- **Parar si**: `legal` pide cambiar el contenido del correo. Se ajusta la plantilla; el
  mecanismo no cambia.

Se pueden emparejar como en 007 (backend y luego web en una `/team`): 1 + 3 y 4 + 5. La 2
y la 6 van solas.

---

## 9. Qué no sé

- **El volumen de producción**: cuentas, planes a la semana, personas activas. Decide
  cuándo tienen sentido la calidad de planes y las cohortes. Lo puede leer el owner en la
  consola hoy.
- **La proporción de `ai_call` sin coste en producción.** En dev es el 33 %, con otras
  rutas. Decide si el indicador de gasto es fiable o un mínimo. Se mide en la fase 4.
- **Si el gancho `session.update.after` salta en la renovación** con la configuración
  actual. Se sabe con un test en la fase 1.
- **Cuándo reinicia OpenRouter el tope mensual de una clave** (mes UTC u otra cosa).
  Decide si el indicador y la pared coinciden. Se puede leer en su documentación antes de
  la fase 4.
- **Si `AI_REWRITE_STEPS` está encendido en producción.** Sistema (A5) lo dirá.
- **Si el owner tiene reglas de alerta en Sentry** y si su plan gratuito le basta para
  una regla por etiqueta.
- **Cómo se define exactamente «el suelo condicionó el día»** para que el caso 12/14
  conocido salga como tal. Lo resuelve `plan-evaluator`.
- **Si `legal` quiere que se grabe la aceptación de los textos legales.** Sin eso, el
  punto 9 queda a medias.

---

## Hallazgos sobre lo ya entregado

Van al lead, que los reparte:

- **P2 — «Personas activas» y «Última actividad» miden inicios de sesión, no uso.**
  - Dónde: `AdminSeriesRepository.ts:75-97`, `UserRepository.ts:60`; la causa, en
    `auth.config.ts:33-34`, `:103`.
  - Arreglo: la fase 1 y la fase 3 de este plan. Mientras tanto, «Cómo se cuenta» de esas
    dos cifras debería decirlo.
- **P3 — Registro selecciona `generation_metadata` entera.**
  - Dónde: `AdminGenerationsRepository.ts:52`. Las frases de `advisories`, con nombres de
    eventos, viajan hasta la función aunque no salgan en la respuesta.
  - Arreglo: pedir en SQL solo las claves de `planOf`.
- **P3 — Documento desfasado.** `docs/reference/deployment.md:177` habla del plan Hobby
  de Vercel, y el proyecto está en Pro desde el 2026-09-26.
