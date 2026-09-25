# 0001 — Generación de dietas: menos LLM, más código (informe sobre una propuesta externa)

> **Purpose**: veredicto del agente `architect` sobre una propuesta recibida por el owner
> el 2026-09-25 para rediseñar la generación de dietas (menos llamadas al LLM, menos
> tokens, menos tiempo, Oracle como apoyo). Contrasta cada premisa con el código y las
> mediciones y propone el camino y las fases.
> **Audience**: el owner y los agentes. **Committed**: sí. **Maintained by**: el agente
> `architect`; no se edita después — una revisión posterior es un informe nuevo.
>
> Base: `main` en `5be3245` más los docs sin commitear de la fase 6 del proyecto 005.
> Cada número lleva etiqueta: **medido** (dónde), **estimado** (con la hipótesis) o
> **desconocido**. Durante el informe no se hizo ninguna llamada a modelo ni a gateway;
> la base de datos de desarrollo (`Nutria-E2E`) solo se leyó, en transacciones `READ ONLY`.

## 1. Veredicto

**No a la arquitectura tal como está propuesta; sí al objetivo, por otro camino que es
más corto.**

- **No** a poner el LLM a *elegir* entre unos ~40 candidatos y devolver el JSON de la
  quincena (pasos 5–7 y 10 de la propuesta). Ese trabajo ya lo hace código en NutrIA, y
  lo hace mejor de lo que puede hacerlo un modelo: el scheduler monta los 14 días desde
  la biblioteca, prueba exhaustivamente las raciones y deja **153 de 154 días dentro
  del 5 % en los cuatro macros sin ninguna llamada al modelo** (medido hoy, abajo). Un LLM
  selector sería un paso más lento puesto delante de un paso determinista que después
  tendría que rehacer lo mismo — es exactamente la alternativa que `0005` ya rechazó
  («el modelo devuelve el plan y el código lo repara»).
- **Sí** a reducir drásticamente llamadas, tokens y tiempo. La palanca no es pasar de 4
  llamadas a 1: es pasar a **0 llamadas en la ruta del usuario** cuando la biblioteca
  cubre a la persona, y mover la escritura de platos nuevos (lo único que el LLM aporta
  de verdad) a un **proceso de fondo** que hace crecer la biblioteca sin que nadie espere.
  Tiempo esperado de una generación: de ~100–184 s a **~10–40 s** (estimado).

Condiciones para el "sí":

1. **El owner decide enmendar `0013`** («un tercio de cada plan se escribe nuevo»). Hoy
   el modelo se llama en **todas** las generaciones *a propósito*, no porque falte
   biblioteca; mientras `0013` siga así, ninguna optimización de prompt baja de 1 llamada
   por comida. La frescura pasaría a venir del crecimiento de la biblioteca en segundo
   plano y de la rotación, con una métrica de parecido entre planes que la vigile.
2. **Se mide antes de cambiar**: coste de lectura de Neon por generación, cobertura de
   la biblioteca por perfil y parecido entre planes de personas parecidas (fase 1).
3. **Se aclara qué significa «4–6 dietas por minuto».** Si es sostenido (≈ 6.000–8.600
   al día), no cabe en ningún plan gratuito **aunque el LLM desaparezca por completo**:
   lo agotan antes la CPU activa de Vercel Hobby y la transferencia de Neon (§ 9). Es
   una decisión de dinero del owner, no de arquitectura.
4. Oracle **no** ejecuta inferencia en la ruta del usuario (§ 8).

## 2. Premisas revisadas

| # | Premisa de la propuesta | Estado | Evidencia |
| --- | --- | --- | --- |
| P1 | «Hay aproximadamente 40 platos disponibles en la biblioteca» | **incorrecta** | Dev tiene **942 platos en español** (500 `seed` + 458 `ai`) y 44 en inglés (medido, `recipes` en `Nutria-E2E`). Los ~40 que se ven son otra cosa: los platos de biblioteca que la rotación ya metió en el pool (28–35 en los jobs reales de dev, `generation_metadata.reused`), que el prompt lista como «DO NOT REPEAT THESE ALREADY-PROPOSED DISHES» (`apps/api/src/modules/ai/prompts/PoolPrompt.ts:700`). La biblioteca de **producción** es **desconocida** para mí: depende de si el owner cargó `docs/local/nutria-seed-500.sql`. |
| P2 | «El LLM construye la dieta a partir de la biblioteca» | **incorrecta** | El LLM no ve la dieta ni elige días. Escribe platos **nuevos** (slugs del catálogo + gramos + pasos) para un pool; el reparto de 14 días, las raciones y los macros son código (`0005`; `packages/core/src/domain/Scheduler/Scheduler.ts:270`). |
| P3 | «Se generan 7 platos por comida» | **confirmada, y es deliberado** | `FRESH_DISHES_PER_SLOT = ceil(19 × 1/3) = 7` (`packages/core/src/domain/Variety/Rotation.ts:48-51`). La rotación entrega a la biblioteca como mucho 12 por comida (`:61`) para que el modelo *siempre* tenga que escribir 7 (`0013`). No es escasez de biblioteca. La fase 7 del proyecto 005 (decidida, sin construir) baja a 3 platos por petición. |
| P4 | «4 llamadas, una por tipo de comida» | **confirmada** para la forma de 4 comidas | Una petición por comida en paralelo (`0016`; `PoolBuilder.service.ts:229-243`). Con 3, 5 o 6 comidas son 3, 5 o 6. Hasta 3 rondas (`:21`), pero tras la primera cubre la biblioteca antes de volver a preguntar (`:177-191`). |
| P5 | «~9.200–9.300 tokens de entrada por llamada» | **confirmada para prompts ≤ 4.0.0; incorrecta para el prompt actual 4.1.0** | Las cuatro cifras son casi iguales (9.228–9.320): eso solo pasa cuando cada comida ve el catálogo entero (930 filas), como hasta 4.0.0. En dev, los dos únicos jobs con modelo real (3.2.1, 2026-09-12) llevan 8.857–9.660 de entrada (medido, `plan_generation_jobs.ai_calls`). Con 4.1.0 cada comida ve su catálogo: desayuno 14.640 caracteres, merienda 16.085, comida 12.467, cena 11.998 (medido hoy, `catalogue-by-meal.mjs --month 9`), es decir ≈ 5.000 / 5.500 / 4.300 / 4.100 tokens (estimado a ~2,9 caracteres por token, la razón medida en 3.4.0: 23.185 caracteres ≈ 8.000 tokens). Total ≈ **19k de entrada**, no 37k. |
| P6 | «12–18k tokens de razonamiento por llamada, 114–180 s» | **confirmada** (en orden de magnitud) para los modelos de razonamiento gratuitos | Dev, 3.2.1: razonamiento/salida 13.365/16.108, 13.806/17.102, 23.319/26.146, 12.183/17.335, 12.472/16.508 tokens; 64–103 s por llamada; el razonamiento es el **71–89 %** de la salida (medido, `ai_calls`). Hoy (4.1.0, `nemotron-3-ultra:free`): 6.149 de salida de los que 2.734 razonamiento, ~143 s (medido, `docs/reference/ai-gateway.md` § 7). |
| P7 | «~70.000 tokens de razonamiento/salida por generación» | **incorrecta tal como está sumada** | En las cuatro filas de la propuesta el razonamiento supera a (total − entrada): desayuno 18.324 > 12.997; comida 13.195 > 8.346; merienda 12.294 > 5.221; cena 12.790 > 7.949. Los 71.571 «totales» *incluyen* los ~37k de entrada; el razonamiento suma 56.601. O el panel de donde salen cuenta el razonamiento fuera del total, o las cifras vienen de fuentes distintas. **Hipótesis**; se comprueba leyendo en `/admin` el `ai_calls` de ese job (nuestro `outputTokens` sí incluye el razonamiento: en dev siempre razonamiento < salida). |
| P8 | «La generación completa tarda ~184 s» | **confirmada** como forma | Las llamadas van en paralelo, así que el job dura lo que la más lenta (179,7 s) más ~5–30 s de carga, scheduling y guardado. En dev, jobs de 3 llamadas: 103 y 107 s (medido). |
| P9 | «Gran parte de la información nutricional y de los platos ya existe en la biblioteca» | **confirmada** | Los macros **nunca** salen del modelo: el esquema no tiene campo para ellos (`pool.schema.ts`, `generatedDishSchema`) y se calculan desde el catálogo por 100 g (`0004`, `0045`). |
| P10 | «El LLM hace trabajo que debería hacer código determinista» | **confirmada, pero no donde la propuesta lo busca** | El filtrado, la selección, las raciones, la variedad y la validación ya son código (§ 3). Lo que el LLM hace de más está *dentro* del plato: se le pide que aterrice cinco cifras por ración en 7 platos con reglas de reparto (`PoolPrompt.ts:461-476, 612-624, 412-430`) — aritmética que el código rehace después. Eso es lo que quema razonamiento (§ 3.3). |
| P11 | «Una llamada de 4.000–6.000 tokens de contexto y 2.000–4.000 de salida» | **hipótesis, y la recomendación la supera** | Para escribir 3 platos nuevos de una comida, 4.1–5.5k de entrada y ~2–3,5k de salida visible es realista (estimado: ~500–650 tokens visibles por plato con pasos, medido en dev: 17.102 − 13.806 = 3.296 para 5 platos). Pero el número útil para el usuario es **0 llamadas** (medido: la biblioteca sola cumple, § 3.4). |
| P12 | «Oracle A1 2 OCPU / 12 GB puede ayudar como servidor de inferencia» | **incorrecta para la ruta del usuario**; hipótesis débil para trabajo de fondo | § 8: un 7–8B Q4 en 2 OCPU escribe ~2,5–4 tokens/s (estimado a partir de cifras publicadas); 3 platos serían 8–12 minutos por llamada. |
| P13 | «4–6 generaciones por minuto» | **desconocido** si es pico o sostenido | § 9: el límite gratuito del LLM actual es ~12–17 generaciones **al día**; sin LLM, el límite pasa a ser Vercel Hobby y Neon. |

## 3. Qué hay hoy

### 3.1 El camino de una generación

```
POST /meal-plans → PlanJobRunner (en proceso, waitUntil; falla a los 280 s: PlanJobRunner.service.ts:38)
  PlanGeneration.generate (apps/api/src/modules/meal-plans/services/PlanGeneration.service.ts)
   :99-132   perfil, contexto (catálogo + SafetyProfile + preferencias), historial, veredictos, check-in; onboarding y consentimiento
   :136-147  objetivos YA calculados (Mifflin-St Jeor, overrides, límites) · forma de comidas · días con evento
   :156-165  rotación: sin lo de la quincena pasada ni lo que no le gusta; semilla usuario+versión
   :166-172  3 lecturas de la biblioteca en paralelo (pool rotado, biblioteca entera, uso por comida)
   :178-205  PoolBuilder.build  ← AQUÍ Y SOLO AQUÍ entra el LLM
   :234      schedulePlan (14 días × comidas, variedad, raciones, 4 macros)
   :237-257  rescate full_library si el pool no llena (sin segunda llamada al modelo)
   :299-320  reintento con toda la biblioteca si la validación bloquea
   :339-354  wider_rotation si algún día sale del 5 % (0046)
   :379      assertPlanIsSafe — alergias otra vez sobre el plan montado
   :383-389  slugs resueltos · lista de la compra
   :399      persistencia atómica
```

`PoolBuilder.build` (`apps/api/src/modules/ai/services/PoolBuilder.service.ts`):

- `:146-148` el catálogo que ve el modelo es solo lo **seguro y querido** para esta persona
  (el modelo no puede elegir lo que no se le ofrece);
- `:155-168` cada comida ve solo su catálogo (`0062`) y comida/cena el recorte de `0063`;
- `:171-341` hasta 3 rondas; una petición por comida con déficit, en paralelo, bajo un
  presupuesto de 170 s (`:27`); tras la ronda 1 cubre la biblioteca retenida (`backfill`);
- `:403-522` cada plato devuelto pasa: esquema → slugs → **puerta de alergias** →
  exclusiones de preferencia → reglas de plato → alergia no resuelta nombrada en el
  texto → tiempo → alimentos del método que no están en el plato → comidas a las que
  pertenece. Solo entonces entra en el pool.

### 3.2 Lo que ya es determinista (la mitad de la propuesta ya existe)

| Pieza pedida en la propuesta | Dónde está hoy |
| --- | --- |
| Calorías y macros objetivo | `core/domain/Nutrition` (`nutritionTargets`, `targetViolations`, `resolveTargets`), leído en `PlanGeneration.service.ts:441-447` |
| Alergias, intolerancias, prohibidos | `core/domain/Safety` (`findSafetyViolations` por id de alérgeno, `madeOf`, `bestEffortExclusions`), `SafetyController.getSafetyProfile` |
| Preferencias y patrones | `core/domain/Preference` (`breaksDishRule`, `withinTime`), `PATTERN_*` en código desde 4.0.0 |
| Nº de comidas y reparto | `core/domain/MealShape` (`weightsFor`, `0036`) |
| Qué alimento va en qué comida, temporada | `core/domain/MealFit` (`0062`, `0063`) |
| Filtrado previo de platos | `RecipeController.reusablePool` (seguridad, preferencias, `fitSlots`, rotación) |
| Selección y scoring | `Scheduler.ts`: `fitCost` (`:548`), `pickBest`, `improveDay` (24 finalistas por hueco), búsqueda exhaustiva de raciones (`:46`, hasta 59.049 combinaciones por día), `spreadAcrossDays` |
| Variedad y repetición | `core/domain/Variety` (`VARIETY_RULES`: máx. 2 veces por quincena, 2 días entre repeticiones, 4 en la misma comida; `Variety.ts:26`), tope de proteína repetida |
| Validación posterior | `core/domain/PlanValidation` (`PLAN_TOLERANCE` 5 %, suelo calórico y techo de proteína que bloquean) |
| Corrección automática | `full_library` y `wider_rotation` en `PlanGeneration` — sin segunda llamada al modelo |
| JSON estructurado | `generateObject` con esquema (`StructuredAiClient.ts:62-65`), revalidado con Zod |
| Modelo intercambiable | `AiClient` + `resolveModel` (`ai.config.ts`): Anthropic, Google, Ollama, OmniRoute, stub (`0006`, `0050`) |

Las fases 2 a 7 del plan de migración de la propuesta están, en lo esencial, hechas.

### 3.3 Por qué se gastan tantos tokens de razonamiento

1. **Los modelos que responden son de razonamiento y no se les limita.** `StructuredAiClient`
   no envía ningún control de esfuerzo (`reasoning_effort`, `thinkingBudget`…): ni rastro
   en `apps/api/src/modules/ai` (medido con grep). Y razonan aunque la tarea sea trivial:
   reescribir los pasos de *un* plato con 637 tokens de entrada costó 7.810 de
   razonamiento (medido, `ai-gateway.md` § 6).
2. **El prompt pide aritmética de memoria.** Por cada plato: kcal, proteína, hidratos,
   grasa y fibra por ración; la mitad del conjunto por debajo y la mitad por encima de
   cada cifra (`PoolPrompt.ts:621`); topes por proteína, método y cocina (`:412-430`); ≤ 15
   ingredientes; pasos documentados con tiempo y señal. Es un problema de restricciones
   con tablas de composición que el modelo no tiene: un modelo de razonamiento itera
   sobre él.
3. **Ese trabajo se tira.** El código recalcula los macros desde el catálogo y el
   scheduler reescala las raciones. Aun con todo ese razonamiento, los platos aceptados
   se desvían de su objetivo una mediana de 19 % / 27 % / 23 % / 33 % (kcal / P / H / G;
   medido, `nemotron-3-ultra`, `ai-gateway.md` § 7). El razonamiento compra poca precisión.
4. **Se escriben pasos para platos que luego se rechazan.** 3 de 12 (`nemotron`), 12 de 14
   (`qwen3.8-27b` en Groq) (medido). Cada plato rechazado pagó su método entero.
5. **Se escriben 7 platos por comida siempre** (`0013`), aunque la biblioteca tenga 155–339
   servibles para esa comida (medido hoy, `catalogue-by-meal.mjs`, omnívoro).

### 3.4 Lo que la biblioteca sola consigue (medido hoy)

`apps/api/scripts/evaluate-plans.mjs` sobre dev, 11 perfiles fijos (objetivo bajo con 3
comidas, alto con 5, alergia a lácteos, vegetariano, quincena con evento, alergia libre
resuelta y no resuelta, halal, kosher, sin gluten, sin lactosa), **sin ninguna llamada al
modelo**, biblioteca entera sin rotación:

- **153 de 154 días** dentro del 5 % en los cuatro macros; el único fuera, 5,0 % en hidratos
  (objetivo bajo, día 11);
- 0 violaciones de variedad, 0 platos inseguros, salida 0;
- pools de 448 a 757 platos por perfil;
- 109 s de reloj para los 11 perfiles en este portátil, lecturas incluidas → **~10 s por
  quincena** (medido como cota superior; el script no separa carga y scheduling).

Y `0046` midió lo que ocurre con el pool rotado de 12 por comida sin la parte nueva:
6/14 y 4/14 días en hidratos y grasa; con la misma rotación sin tope, 14/14. Es decir:
**los platos nuevos del modelo no son los que hacen que los macros cuadren** — los hace
cuadrar tener pool suficiente. El modelo aporta novedad y crecimiento de la biblioteca,
que es lo que `0013` dice que compra.

### 3.5 Lo que la propuesta no ve y sí limita

- **Cuota del LLM gratuito.** OpenRouter gratis: 20 peticiones/minuto y 50 al día
  (medido en la fase 6, `docs/projects/005-…/LOG.md`); Gemini gratis: 20 al día y es el
  respaldo de producción. Con 4 llamadas por generación eso son **~12–17 generaciones al
  día** en total (estimado). Hoy el límite de NutrIA es este, no la latencia.
- **Transferencia de Neon.** Cada generación lee la biblioteca **dos veces** completa
  (`PlanGeneration.service.ts:166-168`, `RecipeRepository.findReusable` con `select()` de
  todas las columnas, pasos incluidos, `RecipeRepository.ts:211-232`) más el uso por
  comida (≈ 6.000 filas de `recipe_ingredients`) y el catálogo; una tercera en un rescate.
  En disco: `recipes` 0,86 MB, `recipe_ingredients` 0,67 MB, `ingredients` + nombres
  0,33 MB (medido, `pg_column_size`). **≈ 2–4 MB por generación** (estimado). Con 5 GB al
  mes compartidos entre producción y desarrollo, eso son ~1.300–2.500 generaciones al mes.
- **Vercel Hobby.** 4 horas de CPU activa al mes, 360 GB-h de memoria provisionada, 300 s
  por función ([límites](https://vercel.com/docs/functions/limitations),
  [Hobby](https://vercel.com/docs/plans/hobby); la espera de E/S no cuenta como CPU
  activa). La función tiene 1.024 MB (`apps/api/vercel.json`). El scheduling es CPU pura:
  con ~5–30 s por quincena (0045: 4 s; 0049: 14 s con 5 comidas, 29–33 s con 6), Hobby
  aguanta **~500–2.900 generaciones al mes** (estimado).

## 4. Propuesta

### 4.1 La forma: dos caminos separados

```
                              RUTA DEL USUARIO (síncrona respecto al job, 0 llamadas LLM si la biblioteca cubre)
Usuario ─► web (Vercel) ─► API (Vercel, NestJS) ─► PlanJobRunner
                                                     │
      core/domain (puro, sin E/S)                    ▼
   ┌──────────────────────────────────────────────────────────────────────────────┐
   │ 1 perfil → objetivos (Nutrition) → SafetyProfile (Safety) → forma (MealShape)  │
   │ 2 biblioteca: UNA lectura, cacheada por versión de biblioteca (nuevo)          │
   │ 3 filtros duros: alergias · patrones · exclusiones · MealFit · dislikes        │
   │ 4 rotación por persona (semilla, sin quincena pasada, preferidos delante)      │
   │ 5 ¿cubre cada comida con ≥ 19 platos? ── sí ─────────────────────────────┐     │
   │                                     └─ no (déficit real) ─► PoolBuilder   │     │
   │                                         (LLM, ≤ 3 platos/petición,        │     │
   │                                          mismas puertas) ─────────────────┤     │
   │ 6 scheduler: variedad dura + scoring 4 macros + búsqueda de raciones  ◄───┘     │
   │ 7 validatePlan · wider_rotation / full_library si falla (sin LLM)              │
   │ 8 assertPlanIsSafe · slugs resueltos · lista de la compra                      │
   └──────────────────────────────────────────────────────────────────────────────┘
                                                     ▼
                                   PlanJobController.persist (Neon) ─► web pinta el plan

                              RUTA DE FONDO (asíncrona, nadie espera)
cron (Vercel diario, u Oracle más a menudo) ─► /cron/grow-library (API, CRON_SECRET)
   gaps = coverage(biblioteca, arquetipos)  ─► briefs de ARQUETIPO (sin datos de nadie)
   ─► AiClient (gateway: modelos gratuitos; nunca Gemini) ─► mismas puertas que hoy
   ─► recipes(source='ai') ─► (opcional) pasos en segunda llamada solo para los aceptados
```

La diferencia con la propuesta: el LLM **sale** de la ruta del usuario en lugar de
quedarse en ella con otra tarea. Lo que el modelo hace bien — escribir un plato cocinable,
con nombre y método, en español — se hace **fuera de la espera**, contra huecos medidos de
la biblioteca, y cada plato sirve después a todas las personas compatibles (`0006`).

### 4.2 División de responsabilidades

| Tarea | Código (`core/domain`) | Base de datos | LLM |
| --- | --- | --- | --- |
| Objetivos, límites, suelo calórico, techo de proteína | **sí** | guarda overrides | nunca |
| Alergias, intolerancias, prohibidos, patrones | **sí** (por id) | catálogo y enlaces de alérgeno = fuente de verdad | nunca (solo ve lo ya filtrado) |
| Nutrición de un plato | **sí**, suma por 100 g | `ingredients` por 100 g | nunca (el esquema no tiene dónde ponerla) |
| Qué alimento en qué comida, temporada | **sí** (`MealFit`) | `meal_slots`, `season_months` | nunca |
| Qué platos, qué días, qué ración | **sí** (scheduler) | biblioteca `recipes` | **no** (rechazo el paso 7 de la propuesta) |
| Variedad y repetición | **sí** (`Variety`) | historial de planes | nunca |
| Validación y corrección | **sí** | — | nunca («el modelo no se revisa a sí mismo», `0004`) |
| Escribir un plato **nuevo** (nombre, ingredientes por slug y gramos, pasos) | valida | lo guarda | **sí** — su único trabajo |
| Reescribir métodos antiguos | valida | — | sí (ya existe, `/cron/rewrite-steps`) |
| Sustituto cuando la biblioteca no tiene ninguno | elige primero de biblioteca | — | sí, solo como último recurso (ya así, `MealSwap.service.ts:145-175`) |

### 4.3 Qué deja de enviarse al LLM

En la ruta del usuario, todo: no hay llamada. En la ruta de fondo, el brief es un
**arquetipo** (comida, patrón nombrable, conjunto de alérgenos a excluir, reparto de
macros, rango de energía, tiempo máximo), no una persona: desaparecen los objetivos
personales, los gustos, los nombres de platos servidos, amados y rechazados
(`PoolPrompt.ts:684-700`, hasta 60 + 40 + 40 nombres) y la lista de slugs a no repetir
(≈ 30–40). Es mejor también para Legal A: el modelo no recibe nada derivado de alguien.

### 4.4 Alternativas consideradas

| Alternativa | Por qué pierde |
| --- | --- |
| **La propuesta: LLM elige entre candidatos y devuelve la quincena** | El scheduler ya elige con aritmética exacta y búsqueda exhaustiva; el LLM no puede calcular macros, así que su salida se revalidaría y se re-escalaría → es la alternativa «el modelo devuelve el plan y el código lo repara» de `0005`, con una llamada más. |
| **1 llamada para toda la quincena** | `0005`: la cola de una respuesta larga se degrada y un fallo tira 60 platos. Y seguiría dependiendo de la cuota diaria. |
| **2–3 llamadas (agrupar comidas)** | Menos peticiones contra el límite por minuto, misma cantidad de salida; la latencia la marca la salida (`0016`), así que sería *más lento*. Útil solo si el proveedor limita peticiones y no tokens — y la ruta de fondo ya lo resuelve sin nadie esperando. |
| **Mantener `0013` y solo afinar el prompt** | Sigue costando ≥ 1 llamada por comida y por plan; con cuotas gratuitas de ~50/día el techo sigue siendo ~12–17 planes al día. |
| **Inferencia local en Oracle en la ruta del usuario** | § 8: órdenes de magnitud demasiado lenta en 2 OCPU. |
| **Proveedor de pago rápido y sin razonamiento en la ruta del usuario** | Funciona y es barato por plan (§ 12), pero rompe «cero euros» y sigue siendo 30–90 s de espera que la biblioteca da en 10. Queda como opción de la ruta de fondo si el owner paga. |

### 4.5 Contrato JSON

Hay **dos** contratos, porque el LLM ya no devuelve la dieta.

**(a) Lo que devuelve el LLM — un plato, no un plan.** Es `generatedDishSchema` casi tal
cual (lo que más conviene de la propuesta ya está: slugs, gramos, sin nutrición). Cambios
recomendados, cada uno medible con `bench-models.mjs`:

```json
{
  "dishes": [
    {
      "name": "Merluza al horno con patata y pimiento",
      "slots": ["dinner"],
      "servings": 2,
      "prep": 10, "cook": 25, "difficulty": "easy", "cuisine": "espanola",
      "items": [ { "s": "merluza", "g": 300 }, { "s": "patata", "g": 350 },
                 { "s": "pimiento-rojo", "g": 150 }, { "s": "aceite-de-oliva-virgen-extra", "g": 15 } ]
    }
  ]
}
```

- **Sin pasos en la primera llamada** (etapa de composición). El código comprueba slugs,
  alergias, preferencias, comida y la distancia del plato al reparto; **solo los
  aceptados** van a una segunda llamada corta que escribe el método — ese prompt ya
  existe (`RewritePrompt.ts`, `STEPS_VERSION`). Ahorra el método de cada plato rechazado
  y deja la composición en ~80–120 tokens por plato (estimado).
- Claves cortas (`s`, `g`) solo si el proveedor cobra por salida; en gratuito no cambia
  nada. Hipótesis, bajo impacto.
- Sin campos de nutrición, como hoy: no hay dónde escribir una cifra inventada.

**(b) La dieta — la produce código, no el LLM.** Ya existe como `PlanDraft`
(`PlanGeneration.service.ts:512-585`) y es lo que la web transforma: días → comidas con
`recipeSlug`, `servings`, `slot`, `sortOrder` y los macros **calculados** y congelados en
la fila (`meals` guarda la instantánea). Forma compacta para la API/web si se quiere un
contrato público:

```json
{ "v": 1, "start": "2026-09-26",
  "targets": { "kcal": 2100, "p": 140, "c": 230, "f": 68, "fib": 30 },
  "days": [ { "d": 1, "loadedFor": null,
              "meals": [ { "slot": "breakfast", "recipe": "tostada-de-aguacate-y-huevo", "servings": 1.25,
                           "kcal": 480, "p": 24, "c": 52, "f": 19 } ] } ] }
```

### 4.6 Motor determinista: reglas duras y blandas

| Regla | Tipo | Dónde |
| --- | --- | --- |
| Alérgenos declarados, intolerancias, alergias libres resueltas y lo «hecho de» ellas | **dura** (bloquea; 422 y log de error si llega al final) | `Safety` |
| Patrones (vegano, vegetariano, halal, kosher, sin gluten, sin lactosa) y exclusiones de gusto | **dura** | `Preference`, `PATTERN_*` |
| Plato con un slug que no resuelve | **dura** | `dishSafety` → `unknown_ingredients` |
| Suelo calórico diario, techo de proteína 3 g/kg | **dura** | `PlanValidation` + `minimumKcal` en el scheduler |
| Alimento fuera de su comida (`meal_slots`, `['none']`) | **dura** | `MealFit` |
| Tiempo máximo por plato | **dura** (con margen) | `withinTime` |
| Máx. 2 veces por quincena, 2 días entre repeticiones, 4 en la misma comida | **dura** (se previene, no se detecta) | `canPlace` |
| Energía, hidratos, grasa ±5 %; proteína −5 % | **blanda con aviso** (se entrega y se registra) | `PLAN_TOLERANCE`, `0011`, `0045` |
| Orden de tamaño entre comidas (una cena ligera no supera a la comida) | casi dura (coste 1.000 sobre bandas) | `ORDER_OUTRANKS_BANDS` |
| Proteína principal repetida en el día / quincena | blanda | `PROTEIN_REPEAT_WEIGHT`, `proteinCap` |
| Cocinas preferidas, alimentos que gustan, platos amados | blanda (van delante, nunca filtran) | `isPreferredDish`, `0026` |
| Temporada | blanda (orden, nunca filtro) | `inSeason` |
| Fibra | **hoy sin banda** (solo se pide al modelo) | propuesta: aviso si < 80 % del objetivo el día; medir antes |

### 4.7 Selección y scoring

De las cinco opciones de la propuesta, la respuesta técnica no es de opinión: **C + D en
código, sin LLM** (y es lo que ya corre). A pierde porque el modelo no puede sumar macros
con fiabilidad (`0005`); B y E añaden una llamada cuyo resultado el código tendría que
revalidar y re-escalar igualmente.

La función actual, por plato y hueco, con el presupuesto `b` del hueco (reparto del día ×
peso de la comida) y la ración `s` cuantizada a ¼ entre 0,5 y 4:

```
coste(plato, s) = 1,5·|kcal−b.kcal|/b.kcal + |P−b.P|/b.P + 0,75·|H−b.H|/b.H + 0,75·|G−b.G|/b.G
                                                                        (Scheduler.ts:548-570)
coste(día)      = Σ bandMiss·10  + inversiones de orden·1000 + suelo·1.000.000
                + repetición de proteína·0,05 + desviación de reparto por comida (SHARE_BAND)
```

con variedad como restricción dura (`canPlace`), 24 finalistas por hueco repreciados con
búsqueda exhaustiva de raciones, y un pase de reparto entre días. Lo que añadiría, solo
como términos blandos y medidos con `evaluate-plans.mjs --compare`:

- `+ λ_nov · usado_recientemente_por_perfiles_parecidos(plato)` — novedad entre personas,
  para compensar que el pool ya no traiga 7 platos nuevos por comida (sustituye a `0013`);
- `+ λ_fib · max(0, 0,8·fibra_obj − fibra_día)/fibra_obj` si se decide banda de fibra.

### 4.8 ¿Hace falta razonamiento?

| Tarea | ¿Razonamiento? | Modelo adecuado |
| --- | --- | --- |
| Objetivos, filtros, selección, raciones, validación | ninguno — es código | ninguno |
| Componer un plato (ingredientes y gramos) cerca de un reparto | poco, si el código ajusta después | instruct grande, o razonamiento con esfuerzo bajo |
| Escribir el método de un plato ya aceptado | ninguno | instruct; un modelo pequeño *podría* (sin medir) |
| Elegir entre candidatos | no aplica (lo hace el scheduler) | — |

Medido: el razonamiento no compra precisión aquí (§ 3.3, punto 3); el único modelo rápido
medido (Groq `qwen3.8-27b`, ~5 s) escribe platos incoherentes (2 de 14 válidos). La
conclusión útil es **comparar el mismo modelo con esfuerzo de razonamiento bajo** — la
palanca no está cableada hoy — antes de cambiar de modelo. Un modelo pequeño local no
tiene hoy ninguna tarea en la ruta crítica.

### 4.9 Estrategia de validación

Ya existe y se mantiene íntegra: esquema Zod estricto tras un esquema de cable laxo;
slugs contra el catálogo; puerta de alergias por id **antes y después** de montar el plan
(`PoolBuilder.service.ts:422-436`, `PlanGeneration.service.ts:379`); exclusiones de patrón
y gusto; reglas de plato; alergia no resuelta nombrada en el texto; tiempo; alimentos del
método que no están en el plato (`methodMentions`); comida adecuada (`fitSlots`); bandas
de macros; suelo y techo; variedad; slugs resueltos antes de la lista de la compra.
Añadidos propuestos:

1. **`evaluate-plans.mjs` como puerta de cada cambio de generación** (ya lo usa
   `plan-evaluator`): ningún perfil peor, 0 alérgenos.
2. **Un plato de la ruta de fondo entra en biblioteca solo si**, además de las puertas de
   hoy, su reparto por ración queda dentro de un margen (p. ej. 25 % por macro; a medir)
   y el scheduler lo *puede* usar para algún arquetipo. Un plato que ningún pool elige es
   ruido en la biblioteca y transferencia en Neon.
3. **Plausibilidad de gramos por ración** (aceite, frutos secos, sal): comprobar si
   `pool.schema.ts` ya lo cubre antes de añadir nada (**desconocido**).
4. **Parecido entre planes** (Jaccard de platos entre personas de perfil parecido) como
   métrica vigilada: es lo que protegía `0013`.

### 4.10 Estrategia de fallback

| Falla | Qué pasa |
| --- | --- |
| La biblioteca no cubre una comida para esta persona (p. ej. la cena tardía vegana: 8 platos de 19, medido) | se llama al LLM **solo para ese déficit**, ≤ 3 platos por petición, con presupuesto de tiempo; si no responde, `full_library`; si aun así no llena, `GENERATION_POOL_TOO_SMALL` / `GENERATION_AI_UNAVAILABLE` (hoy) |
| Días fuera de banda | `wider_rotation`, luego se entrega con avisos (hoy) |
| El gateway u Oracle caídos | la ruta del usuario no se entera si la biblioteca cubre; la de fondo se pausa y sigue mañana |
| Modelo gratuito deja de existir o cambia límites | se cambia el combo en el gateway (configuración del owner); nada del código nutricional cambia |
| Rollback | `AI_PROVIDER=google` y redeploy (`ai-gateway.md` § 4); y el modo «solo déficit» detrás de una variable, para volver a `0013` sin redeploy de código |

## 5. Requisitos

- **Código** (todo en piezas existentes):
  - `core/domain/Variety`: que la parte nueva por plan sea configurable (0 en la ruta del
    usuario), y la cobertura por arquetipo como función pura;
  - `PlanGeneration`: una sola lectura de biblioteca (hoy dos, `:166-168`) y caché en
    proceso por versión (p. ej. `max(updated_at)` + recuento de `recipes`);
  - un servicio `LibraryGrower` y su ruta de cron, reutilizando `PoolBuilder.validate` y
    `buildPoolPrompt` con un contexto de arquetipo;
  - `StructuredAiClient`: opción de esfuerzo de razonamiento por proveedor (medir antes);
  - scripts de medición: cobertura por arquetipo y parecido entre planes (read-only).
- **Datos**: la biblioteca de producción debe existir. Si el seed de 500 no está cargado en
  producción, este plan no funciona allí hasta que lo esté (**desconocido**, § 13).
- **Infraestructura**: ninguna nueva para las fases 1–4. Oracle opcional desde la fase 6.
- **Dinero**: 0 € hasta el escenario de tráfico sostenido (§ 9, § 12).
- **Decisiones del owner**:
  1. enmendar `0013` (frescura fuera de la ruta del usuario) — la que desbloquea todo;
  2. qué significa «4–6 por minuto» (pico o sostenido) y cuánto pagaría si es sostenido;
  3. si el código puede ajustar gramos de un ingrediente para acercar un plato a su
     reparto (`0045` § «What this does not do» lo deja como decisión de producto);
  4. el presupuesto diario de llamadas gratuitas que puede gastar la ruta de fondo.
- **Tiempo del owner**: revisar dos métricas nuevas y decidir 1–4; generar una quincena
  en producción para verificar cada fase que la toque.

## 6. Riesgos

| Riesgo | Para quién | Probabilidad | Cómo se vería | Cómo se deshace |
| --- | --- | --- | --- | --- |
| **Seguridad**: un plato de la ruta de fondo sirve a alguien con una alergia | usuario | baja: el brief de arquetipo excluye y la puerta de alergias corre **por persona** al servir (`reusablePool`) y otra vez sobre el plan montado | `SafetyViolationError`, log de error, `evaluate-plans` salida 2 | ninguna ruta nueva se salta `dishSafety`; `invariant-reviewer` revisa la fase 4 |
| **Privacidad**: el brief de arquetipo filtra algo de una persona | usuario | baja si los arquetipos salen de combinaciones del catálogo, no de perfiles reales | revisión de `health-boundary.spec.ts` y del prompt | construir arquetipos solo de enumeraciones (comidas × patrones nombrables × alérgenos × repartos), nunca de filas de `profiles` |
| **Cuota Neon**: la caché falla y cada generación sigue leyendo 2–4 MB | owner (producción y dev comparten 5 GB) | media | panel de Neon | la fase 2 va *antes* que cualquier aumento de tráfico |
| Planes más parecidos entre personas al quitar la parte nueva por plan | usuario | **media** — es lo que `0013` corrigió | métrica de parecido de la fase 1 | variable de entorno para volver a 1/3 |
| La biblioteca deja de crecer si el grower no consigue platos válidos | producto | media (modelos gratuitos inestables, fase 6: 2 de 6 respuestas) | aceptados/día en `/admin` | la ruta del usuario sigue sirviendo; se sube el presupuesto o se paga un modelo para el grower |
| Transferencia de Neon por el grower (lee biblioteca para calcular huecos) | owner | baja | Neon | calcular cobertura con la misma caché |
| Un rescate `full_library` más frecuente al no llegar platos nuevos | usuario | baja: medido que la biblioteca sin tope da 14/14 | `fallback` en `generation_metadata` | — |

## 7. Coste y esfuerzo

| Fase | Esfuerzo (agente) | Variables |
| --- | --- | --- |
| 1 Medición | 0,5–1 día | acceso de solo lectura; el owner lee `/admin` de producción |
| 2 Una lectura + caché | 0,5–1,5 días | cómo se versiona la biblioteca; instancias de Vercel reutilizadas (Fluid) |
| 3 Modo «solo déficit» | 1–2 días | enmienda de `0013`; e2e que esperaban «siempre se llama al modelo» (el LOG de `0013` recuerda que la suite lo detecta) |
| 4 Grower de biblioteca | 3–5 días | definición de arquetipos; revisión de `invariant-reviewer` y `legal` |
| 5 Composición en dos etapas + esfuerzo de razonamiento | 2–3 días + medición | qué proveedores del combo aceptan el control de esfuerzo |
| 6 Oracle como disparador de cron / worker | 1–3 días + tiempo del owner en Oracle | si se despliega una segunda instancia de `apps/api` |
| 7 Experimento de modelo local | 1 día + horas de máquina | sin impacto en producción; solo si el owner lo quiere |

Coste en euros: **0** para las fases 1–7 con el tráfico actual.

## 8. Plan

Cada fase se entrega sola; la siguiente empieza solo con la señal de paso cumplida. Las
fases 2–7 de la propuesta ya están hechas en el código (§ 3.2) y no se repiten.

**Fase 1 — Medir lo que hay en producción y lo que falta.**
Objetivo: sustituir las cifras de la propuesta por las de 4.1.0. Cambios: script
read-only de cobertura por arquetipo (comida × patrón × alérgenos × reparto → platos
servibles) y de parecido entre planes; el owner exporta de `/admin` los `ai_calls` de las
últimas generaciones en producción. Riesgo: ninguno. Métrica: tabla de tokens/tiempo en
4.1.0 por comida; nº de platos de biblioteca en producción; cobertura mínima por
arquetipo; Jaccard medio entre planes parecidos hoy (línea base). Paso: tablas escritas en
este directorio o en el LOG del proyecto. Parar si la biblioteca de producción es mucho
menor que la de dev: primero se carga el seed.

**Fase 2 — Leer la biblioteca una vez, y cachearla.**
Objetivo: bytes de Neon por generación. Cambios: una lectura en `PlanGeneration` (hoy dos
más una en rescate), columnas mínimas (sin pasos ni imágenes para el scheduler; los pasos
solo se leen al pintar), caché por versión. Riesgo: servir una biblioteca vieja → la
versión se comprueba con una consulta barata. Métrica: MB por generación (antes/después)
y `evaluate-plans --compare` sin cambios. Paso: ≥ 3× menos transferencia, 0 perfiles peor.

**Fase 3 — La ruta del usuario sin LLM cuando la biblioteca cubre.**
Objetivo: 0 llamadas en la mayoría de generaciones. Cambios: tras la enmienda de `0013`,
`FRESH_SHARE` por configuración (0 en la ruta del usuario), rotación con tope
`DISHES_NEEDED_PER_SLOT`; el modelo solo para el déficit real. Riesgo: parecido entre
planes. Métrica: llamadas por generación (p50 = 0), p50 de duración < 30 s, días dentro
del 5 % iguales o mejores, Jaccard no peor que la línea base + margen que fije el owner.
Paso: una semana de producción con esos números. Parar si el parecido sube por encima del
margen: se vuelve a 1/3 con la variable.

**Fase 4 — El grower de biblioteca.**
Objetivo: que la novedad venga del crecimiento de la biblioteca, no de cada plan.
Cambios: `LibraryGrower` + `/cron/grow-library`; huecos por la cobertura de la fase 1;
briefs de arquetipo; presupuesto diario de llamadas gratuitas (nunca Gemini, regla del
owner 2026-09-25); ≤ 3 platos por petición (fase 7 del 005); mismas puertas. Riesgo:
seguridad y privacidad (revisión `invariant-reviewer`, `legal`). Métrica: platos
aceptados/día, % válidos, huecos cerrados. Paso: cobertura mínima por arquetipo ≥ 19 en
todas las comidas medidas (hoy la cena tardía vegana está en 8). Parar si % válidos
< 50 % durante una semana: cambiar de modelo o pagar el grower.

**Fase 5 — Menos razonamiento por plato.**
Objetivo: tokens y segundos por plato escrito. Cambios: control de esfuerzo en
`StructuredAiClient` por proveedor; composición y método en dos llamadas (la segunda solo
para aceptados); opcional, ajuste determinista de gramos si el owner lo decide. Riesgo:
peor calidad del plato. Métrica (`bench-models.mjs`, llamadas gratuitas declaradas antes):
salida por plato, % válidos, desviación mediana del reparto, `foreign_food`. Paso: −40 %
de salida por plato aceptado sin peor % de válidos. Parar si los válidos caen.

**Fase 6 — Oracle como infraestructura auxiliar.**
Objetivo: más frecuencia para los crons y sin el límite de 300 s para el trabajo de fondo.
Cambios: Oracle llama a `/cron/grow-library` y `/cron/rewrite-steps` cada hora con
`CRON_SECRET` (Hobby solo permite crons diarios, `ai-gateway.md` § 6); opcionalmente,
una **segunda instancia de `apps/api`** en Oracle que recoge jobs de fondo (el invariante
«solo `apps/api` abre conexión» se mantiene: es la misma app). Riesgo: dependencia →
nada crítico corre solo allí; si Oracle cae, el cron diario de Vercel sigue. Métrica:
platos/día del grower, cero impacto en la ruta del usuario. Paso: una semana estable.

**Fase 7 (opcional) — ¿Modelo local en Oracle?**
Solo como experimento: un 3B y un 7–8B Q4 con `llama.cpp`, midiendo con el mismo
`bench-models.mjs` (sin tocar producción). Señal de parar: < 50 % de platos válidos o
> 10 min por petición de 3 platos.

**Fase 8 (condicional) — Tráfico sostenido.** Solo si el owner confirma 1+ generación por
minuto sostenida: decidir Vercel Pro (o mover el scheduling a un worker propio), Neon de
pago y, si la biblioteca no crece al ritmo necesario, un modelo de pago para el grower.

## 9. Rendimiento por escenario de tráfico

Hipótesis: 4 comidas por día; ruta actual = 4.1.0 con la fase 7 (≤ 3 platos por
petición, ~4 llamadas por generación, ~19k tokens de entrada, 4–10k de salida por llamada
con razonamiento, 90–180 s); ruta propuesta = 0 llamadas en ~90 % de generaciones
(**estimado**, hay que medirlo en la fase 3) y 1–2 llamadas en el resto; scheduling 5–30 s
de CPU; lectura de Neon 2–4 MB sin caché, ≤ 0,2 MB con caché (estimado). «Por minuto
sostenido» × 1.440 = al día.

| Dietas/min | Hoy: llamadas/min · tokens in/min · out/min | Hoy: concurrencia (gen. en vuelo · peticiones LLM) | Propuesto: llamadas/min | Propuesto: concurrencia | Tiempo esperado (propuesto) | Qué hace falta |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 4 · ~76k · 16–40k | 2–3 · 6–12 | ~0,1–0,2 | ≤ 1 | 10–40 s | Hoy: imposible gratis (≈ 1.440/día frente a ~12–17/día de cuota). Propuesto: la cuota LLM sobra; **Vercel Hobby** se agota (~43k gen/mes frente a ~500–2.900) y **Neon** también (43k × 0,2 MB ≈ 9 GB) |
| 2 | 8 · ~150k · 32–80k | 3–6 · 12–24 | ~0,2–0,4 | ≤ 1–2 | 10–40 s | ídem ×2: Vercel Pro o worker propio; Neon de pago |
| 4 | 16 · ~300k · 64–160k | 6–12 · 24–48 | ~0,4–0,8 | 1–3 | 10–40 s | ídem; con 16 llamadas/min la ruta actual choca además con 20 peticiones/min de OpenRouter |
| 6 | 24 · ~460k · 96–240k | 9–18 · 36–72 | ~0,6–1,2 | 2–4 | 10–40 s | ídem; un worker ARM de 2 OCPU daría ~4–8 gen/min de scheduling (estimado: ~15–30 s de CPU por quincena en ARM, 2 núcleos) |
| 10 | 40 · ~760k · 160–400k | 15–30 · 60–120 | ~1–2 | 3–7 | 10–40 s (+cola si hay pico) | escalado horizontal del scheduling; la ruta LLM actual necesitaría un proveedor de pago con cientos de peticiones/min |

Lo importante de la tabla no es la precisión (no la tiene), es la forma: **con la
arquitectura actual el límite es la cuota del LLM (~12–17 generaciones al día); con la
propuesta, el LLM deja de ser el límite y pasan a serlo la CPU de Vercel y la
transferencia de Neon**. Ninguna de las dos cosas se arregla con prompts.

## 10. Oracle Cloud (A1, 2 OCPU, 12 GB, ARM64, sin GPU)

Cifras publicadas (**estimado**, no medido en la máquina del owner): en A1 con **4 OCPU**,
un 7B Q4_K_M genera ~5–8 tokens/s y un Qwen2.5-3B Q4_K_M ~10,6 tokens/s con llama.cpp;
la CPU se satura al 90–100 % durante la inferencia
([Tiffena Kou, benchmark en Ampere A1](https://tiffena.me/blog/ai-infrastructure/benchmark-cpu-only-llm-inference-oracle-ampere-a1-llama.cpp-ollama-docker/),
[Ampere/Oracle, Llama 3 en A1](https://amperecomputing.com/blogs/llama3-on-Ampere-based-OCI-A1),
[guía Oracle free tier](https://blog.easecloud.io/ai-cloud/launch-oracle-cloud-llms-in/)).
Con **2 OCPU** (la mitad; el rendimiento lo marcan núcleos y ancho de banda de memoria)
y OmniRoute compartiendo la máquina: 7–8B ≈ **2,5–4 tokens/s**, 3B ≈ **5–6 tokens/s**
(estimado, escalado lineal). La lectura del prompt en CPU también cuesta: 4–5k tokens son
minutos, no segundos (estimado, sin cifra publicada fiable para 2 OCPU).

| Uso | ¿Viable? | Por qué |
| --- | --- | --- |
| LLM en la ruta del usuario (cualquier tamaño) | **No** | 3 platos ≈ 1.500–2.000 tokens visibles → 8–12 min con 7–8B; el job muere a los 280 s |
| Ollama con 3B para escribir platos | No sin medir | el único modelo pequeño-mediano medido (27B en Groq) escribe 2 de 14 platos válidos; un 3B será peor (hipótesis) |
| 7–8B cuantizado para el grower de fondo | Hipótesis débil | sin plazo, ~5–20 platos/hora (estimado) si la calidad lo permitiera; se decide con la fase 7 |
| Gateway OmniRoute | **Sí, ya lo es** | es su papel actual y el mejor |
| Disparador de crons (cada hora en lugar de diario) | **Sí** | coste ~0; no crítico: Vercel mantiene su cron diario |
| Segunda instancia de `apps/api` para trabajo de fondo (grower, rewrite) | **Sí, con condiciones** | sin límite de 300 s ni de CPU activa; caché de biblioteca siempre caliente; su transferencia a Neon cuenta igual |
| Worker de scheduling para la ruta del usuario | Sí, **con fallback** en Vercel | si el worker no toma el job en N s, Vercel lo ejecuta en proceso como hoy; así Oracle nunca es crítico |
| Validación, scoring, caché | Solo como parte de `apps/api` | la validación y el scoring son `core`, corren donde corra la API; un servicio aparte duplicaría reglas |
| Cola | Innecesaria | `plan_generation_jobs` ya es la cola |

## 11. Costes (qué variables mandan)

| Arquitectura | Coste por generación | Variables que lo determinan |
| --- | --- | --- |
| Actual (4 llamadas, razonamiento) | 0 € en gratuito, pero **capado a ~12–17/día**; en pago, ~15–20k tokens de entrada + 16–40k de salida por generación (estimado) | nº de comidas; platos nuevos por plan (`0013`); tokens de razonamiento (modelo y esfuerzo); precio por token de salida; reintentos |
| Optimizada (0 llamadas si cubre) | ~0 € de LLM; CPU de scheduling + lecturas de Neon | tamaño del pool (CPU de la búsqueda de raciones, 6 comidas = 30 s); lecturas por generación y caché; % de generaciones con déficit |
| Con modelo local (Oracle) | 0 € en dinero, pero tiempo de máquina y calidad | tokens/s en 2 OCPU; % de platos válidos; que Oracle siga siendo gratuito y disponible |
| Híbrida (propuesta) | ruta usuario ~0 €; ruta de fondo: nº de platos nuevos al día × tokens por plato × precio (0 € con modelos gratuitos) | ritmo de crecimiento deseado de la biblioteca; esfuerzo de razonamiento; composición en dos etapas; batch de proveedor si algún día es de pago (hipótesis: ~50 % más barato, sin plazo) |
| Tráfico sostenido ≥ 1/min | ya no es el LLM: es **Vercel** (CPU activa) y **Neon** (transferencia) | decisión de dinero del owner |

## 12. Las 10 optimizaciones con más impacto, en orden

1. **Sacar el LLM de la ruta del usuario cuando la biblioteca cubre** (enmendar `0013`):
   4 llamadas → ~0; ~184 s → ~10–40 s; cuota del LLM deja de limitar.
2. **Grower de biblioteca en segundo plano** contra huecos medidos y con briefs de
   arquetipo: la novedad sin espera y sin datos de nadie en el prompt.
3. **Una sola lectura de biblioteca por generación, columnas mínimas y caché por versión**:
   la transferencia de Neon, que es el límite siguiente.
4. **Esfuerzo de razonamiento controlado** en `StructuredAiClient` (hoy no se envía nada).
5. **Composición y método en dos llamadas**: no escribir pasos para platos que se rechazan.
6. **≤ 3 platos por petición** (fase 7 del 005, ya decidida): la salida marca el tiempo.
7. **Quitar del prompt lo que el código ya garantiza**: la lista de slugs a no repetir
   (el duplicado ya se rechaza en `validate`, `PoolBuilder.service.ts:418-420`), las
   reglas de «straddle» si el scheduler/ajuste de gramos lo resuelven.
8. **Ajuste determinista de gramos** de un ingrediente para acercar un plato a su reparto
   (decisión de producto, `0045`): quita al modelo la aritmética que más razonamiento pide.
9. **Oracle como disparador de crons y worker de fondo** con fallback en Vercel.
10. **Prompt caching / batch**: hoy sin efecto (0 tokens cacheados medidos en los modelos
    gratuitos); solo relevante si algún día se paga un proveedor. Speculative decoding y
    function calling no aportan nada controlable desde aquí.

## 13. Qué no sé

- **Las cifras de producción en 4.1.0**: las de la propuesta encajan con ≤ 4.0.0. Solo
  `/admin` de producción lo dice (no la consulté: regla de no tocar producción).
- **El tamaño de la biblioteca de producción** y si el seed de 500 está cargado.
- **Por qué el razonamiento supera a (total − entrada)** en las cuatro filas de la propuesta.
- **Cuánto se parecen hoy los planes entre personas** y cuánto subiría al quitar la parte
  nueva por plan: es lo que decide si la fase 3 es aceptable.
- **CPU real del scheduling en Vercel y en ARM**: aquí solo tengo ~10 s por quincena en
  un portátil, lecturas incluidas.
- **Bytes reales por generación en el cable** (estimé 2–4 MB desde el tamaño en disco).
- **Si los modelos del combo aceptan un control de esfuerzo** a través de OmniRoute.
- **Qué quiere decir «4–6 por minuto»** y cuánto está dispuesto a pagar el owner si es
  sostenido.
- **Rendimiento real de un 7–8B en las 2 OCPU del owner** con OmniRoute al lado.
