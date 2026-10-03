# 0010 — Planes equilibrados por objetivo: una tabla de frecuencias, mínimos que se cumplen y lo que cambia con cada objetivo

> **Purpose**: informe del agente `architect` sobre la petición del owner del 2026-10-03:
> que los planes de 14 días sean "súper equilibrados" y sirvan de verdad al objetivo de
> cada persona, con un mínimo de legumbres, un mínimo y un máximo de pescado (el mínimo
> solo si la persona no ha dicho que no le gusta), variedad, y platos nuevos del generador
> cuando la biblioteca no los tenga. Contiene la tabla de frecuencias por grupo de
> alimentos, cómo se reconoce cada grupo en el catálogo, las reglas por objetivo, cómo se
> hacen cumplir en el scheduler, la medición de hoy sobre la biblioteca de referencia y un
> plan por fases listo para un PRD.
> **Audience**: el owner, el lead y los agentes que ejecuten el proyecto. **Committed**: sí.
> **Maintained by**: el agente `architect`. Una vez fusionado no se edita; una revisión
> posterior es un informe nuevo.
>
> **Base**: `origin/main` en `4b59d2c9` (#210: `0082` y 011 fase 5).
>
> **Números**: cada uno lleva su etiqueta: **medido** (dónde), **estimado** (con la
> hipótesis) o **desconocido**.
>
> **Medición**: Postgres local (`pnpm db:local reset --reference`, `NUTRIA_LOCAL_PG=1`),
> biblioteca de referencia de `0080`: 871 recetas (500 seed, 371 de producción `ai`, export
> del 2026-10-02). Una transacción `READ ONLY` por ejecución, detrás de `guard.mjs`.
> Ninguna llamada a un modelo, ninguna lectura de Neon. Los scripts son una copia de
> trabajo de `apps/api/scripts/evaluate-plans.mjs` (mismos perfiles, mismo `contextFor`,
> mismo `schedulePlan` y `validatePlan`) más el reconocimiento de grupos que propone este
> informe (§ 1.2); no están en el repositorio. Fuentes públicas leídas el 2026-10-03,
> enlazadas al final.

## Veredicto

**Sí, con condiciones.** Se puede pedir a cada plan una tabla de frecuencias por grupo de
alimentos (legumbres, pescado, carne, procesados, almidones, verdura, fruta, integrales,
fibra) y hacerla cumplir en código, con el mismo mecanismo que ya sostiene `0081` y `0082`.
Pero tres premisas de la petición no son exactas, y cambian dónde está el trabajo:

1. **El problema no es la biblioteca, es el reparto.** Sobre la biblioteca entera de
   referencia el scheduler ya sirve entre 5 y 20 platos de legumbre de 28 comidas
   principales (medido), y hay 112 almuerzos de legumbre para un omnívoro. Lo que llega a
   producción es una **rotación aleatoria de 19 platos por comida** más 7 del modelo
   (`core/domain/Variety/Rotation.ts:193`): en 10 rotaciones medidas como las hace
   producción, un plan `traditional_spanish` salió con entre 2 y 8 legumbres según la
   semilla (mediana 5), y uno de tres comidas sin restricciones con entre 4 y 9. Un mínimo
   necesita primero que la rotación **garantice** platos de cada grupo, y después que el
   scheduler los **sirva**. Ninguna de las dos cosas existe hoy.
2. **AESAN pide más legumbre de la que dice la petición.** El informe AESAN 2022 dice
   "al menos 4 raciones/semana de legumbres hasta llegar a un consumo diario"; 2–4 era la
   cifra de 2020 y 3 la del índice MEDAS. Y AESAN también pone un **máximo de carne**
   (3 raciones/semana) y de huevos (4/semana) que hoy ningún plan respeta.
3. **La polenta sí es un grano para el código.** `polenta` y `polenta-cocida` están en el
   grupo `grains` (`core/domain/MealFit/Cuisine.ts:93-94`), y el único plato de polenta de la
   biblioteca de referencia se reconoce como tal (medido). Lo más probable es que el plato
   de v17 usara `harina-de-maiz`, que no está en ningún grupo; no lo puedo comprobar sin
   leer ese plato en producción.

Las condiciones:

- **El orden de siempre: seguridad, bandas, reglas retenidas, precios, ajuste.** Las
  alergias, la forma de comer y los "no me gusta" filtran el pool antes de todo, y un
  mínimo se calcula sobre lo que queda: si no queda pescado, el mínimo de pescado es cero
  sin leer ninguna preferencia. Las bandas de macros (±5 %, `0045`) siguen mandando sobre
  cualquier frecuencia, como decidió el owner en 017 ("las macros ganan").
- **Los mínimos son nuevos y no caben en `kindExcess`.** Una regla de exceso se juzga comida
  a comida; un mínimo solo se sabe al final de la quincena. Hace falta una reserva al
  construir (qué días llevan legumbre) y una pasada final que lo repare, no un precio más.
- **El generador es la última palanca, no la primera.** Lo que de verdad falta en la
  biblioteca son cenas ligeras de legumbre de cocina española (3 para un omnívoro), más
  tipos de legumbre (solo 4 de los 7 que distingue `LEGUME_RULES`) y platos integrales.
  Se piden **dentro de las peticiones que ya se hacen** (cero llamadas de más), no con una
  llamada nueva.
- **Fruta e integrales son el hueco más grande, y no se arreglan con el scheduler.** Hoy
  ningún perfil llega a 2 raciones de fruta al día (0,1–1,1 medido) y casi ninguno a la mitad
  de cereal integral (9–56 % en comida y cena). Eso es de acompañamientos y de datos.

## Premisas revisadas

| # | Premisa | Estado | Evidencia |
|---|---|---|---|
| 1 | v17 (2026-10-03) tenía legumbre en 2 de 28 platos principales | **hipótesis** (dato del owner) | No leo producción. Es compatible con lo medido: en rotaciones como las de producción (sin el tercio fresco), `traditional_spanish` sale con 2 en la peor semilla y 5 de mediana; `objetivo-bajo-3-comidas`, con 4 y 5. |
| 2 | AESAN aconseja 3–4 legumbres a la semana | **incorrecta** | AESAN 2022 (Resumen y § 2.4.1.1): "al menos 4 raciones/semana de legumbres hasta llegar a un consumo diario". 2–4 era AESAN 2020; ≥ 3 es MEDAS. El mínimo es **8 por quincena**. |
| 3 | Pescado en 13 de 28 | **hipótesis** (dato del owner) | Medido en referencia: entre 0 y 20 de 28 según perfil (biblioteca entera); hasta 19 en rotaciones. Nada lo limita hoy salvo `PROTEIN_RULES` (una proteína, p. ej. `merluza`, ≤ 3 por semana), y "pescado" son una docena de proteínas distintas. |
| 4 | Pasta 5 y arroz 5 pasaron el tope de 4 por el "las bandas lo necesitan" de `0081` | **confirmada como mecanismo; hipótesis para v17** | Medido: en rotaciones como las de producción el arroz pasa de 4 en 58 de 280 planes (hasta 9), y el tope de pasta, arroz y granos se cumple en el 78 % (100 % sobre la biblioteca entera): con 19 platos por comida, a veces solo el arroz deja el día en banda. Con acompañamientos, 93 principales llevaron además un arroz de guarnición. Una segunda vía que el código no cuenta: el **arroz blanco de acompañamiento** junto a un plato asiático (`0079` Tabla 3) no entra en `STARCH_RULES`, que solo lee el plato (`core/domain/Variety/Starch.ts:141`). |
| 5 | La polenta no se reconoce como cereal | **incorrecta tal cual** | `polenta` y `polenta-cocida` están en `FOOD_GROUP_SLUGS.grains` (`Cuisine.ts:93-94`, rendimiento 4 en `Yield.ts:32`). "Polenta cremosa con ragú de ternera" (seed) se lee `grains`, 117 g en seco por ración (medido). Lo que **no** está en ningún grupo es `harina-de-maiz` (sémola de maíz, que es lo que es la polenta). Cómo comprobarlo: leer los ingredientes del plato de v17. |
| 6 | Si la biblioteca no tiene los platos, hay que pedirlos al generador | **parcialmente** | La biblioteca entera tiene de sobra para casi todo (§ 4.3). Faltan celdas concretas: cenas españolas ligeras de legumbre (3), tipos de legumbre (4 de 7), integrales en cena (15 de 62 platos de cereal). |
| 7 | El mínimo de pescado solo cuando la persona no dice que le disgusta | **confirmada, y se cumple por construcción** | El owner lo decidió en 017 (LOG, enmienda del 2026-10-02). `dislikedLabels: ['pescado']` deja el pool sin ninguna fila de clase `fish` (medido en `tres-comidas-proteina-alta`). Pero **deja el marisco**: ese perfil comió "Gambas salteadas…" dos veces y "Alubias blancas con almejas". Por eso el mínimo cuenta solo `fish`, y el máximo cuenta pescado y marisco juntos. |
| 8 | ≥ 0,3–0,4 g/kg de proteína por comida principal en ganancia muscular | **confirmada, y hoy ya se cumple en comida y cena** | Medido (`objetivo-alto-5-comidas`, 98 kg, 5 comidas): comida 0,64 g/kg de media (mín. 0,49), cena 0,54 (0,47), desayuno 0,41 (0,26), tentempiés 0,15–0,17. El hueco son el desayuno y los tentempiés, no las principales. |

## Qué hay hoy

**Cómo se elige un plato para un día.**

- El pool de una persona es la biblioteca filtrada por seguridad, forma de comer y "no me
  gusta" (`RecipeController.reusablePool`), recortada por `rotatePool` a 19 platos por comida
  con una semilla `usuario:versión` (`Rotation.ts:193-230`; `PlanGeneration.service.ts:162-175`),
  más al menos 7 platos nuevos por comida del modelo (`FRESH_DISHES_PER_SLOT`,
  `Rotation.ts:58`; `PlanGeneration.service.ts:193`). La rotación baraja: **no mira grupos**.
- `schedulePlan` (`core/domain/Scheduler/Scheduler.ts:641`) construye día a día. En cada
  comida filtra por temporada, tamaño de plato y reglas retenidas (`underCap`,
  `Scheduler.ts:683-686`) y elige el que mejor ajusta las cuatro macros (`fitCost`,
  `Scheduler.ts:1144`), con precio por repetir proteína o tipo.
- Después: `improveDay` (`Scheduler.ts:2122`), `spreadAcrossDays` (`:2438`),
  `repairOutOfBand` (`:2669`) y `enforceDistinctDays` (`:2836`). Las bandas se juzgan primero y
  las reglas retenidas después, a `HELD_KIND_WEIGHT = 100` (`:499`).
- Si el plan falla una banda, `PlanGeneration` reprograma con toda la rotación y se queda con
  el mejor (`wider_rotation`, `PlanGeneration.service.ts:369-403`, `0046`).

**Qué reglas de grupo existen** (todas cuentan excesos, ninguna mínimos):

| Regla | Dónde | Cómo |
|---|---|---|
| Pasta, arroz y otros granos ≤ 4 cada uno, nunca en días seguidos | `STARCH_RULES`, `Starch.ts:108`; `0081`, `0082` | retenida |
| Una misma legumbre ≤ 3 | `LEGUME_RULES`, `Legume.ts:76`; `0082` | retenida (cap), con precio (días seguidos) |
| Una proteína ≤ 3 por semana de principales, ≤ 1 al día | `PROTEIN_RULES`, `Protein.ts:78` | con precio |
| Un mismo tentempié ≤ 3 | `SNACK_RULES`, `Snack.ts:58` | con precio |
| Un plato ≤ 2 por quincena | `VARIETY_RULES`, `Variety.ts:27` | prohibido (`canPlace`) |
| Arroz, pasta, granos, patata y legumbre guisada por comida y cocina | `FAMILY_FIT`, `Cuisine.ts:242`; `0079` Tabla 2 | filtro |

**Qué no existe:** ningún mínimo de ningún grupo; ninguna regla sobre pescado como grupo
(sí sobre cada pescado), carne, procesados, huevos, verdura, fruta, integrales; la fibra
está en los objetivos (`FIBER_G_PER_1000_KCAL = 14`, `Nutrition.ts:26`) y en el brief del
prompt, pero `fitCost` no la mira (`Scheduler.ts:1144-1168`) y `PlanValidation` no la valida.
No hay columna de azúcares en `ingredients` (`packages/database/src/schemas/food.schema.ts:32-79`).

**Qué hay en el prompt** (`apps/api/src/modules/ai/prompts/PoolPrompt.ts`, 4.6.0):
`GOAL_GUIDANCE` (`:511-522`) pide "legumes, fish, whole grains over refined, little processed
food" **solo** a `healthy_eating`; `spreadRules` (`:483-500`) limita cada proteína, legumbres
incluidas, a un cuarto del lote; la cena es "lighter… Not a stew" (`:566-567`). Nada pide un
grupo concreto en un número concreto.

**El evaluador mide otra cosa que producción.** `evaluate-plans.mjs` programa sobre
`reusablePool(slots, context)` sin rotación (`evaluate-plans.mjs:449`): la biblioteca entera.
Con eso, una legumbre aparece de sobra. Producción ve 19 + 7 platos por comida. Para
frecuencias, el evaluador necesita un modo con rotación (fase 1).

## 1. La tabla

### 1.1 Frecuencias por quincena

Para dos comidas principales al día (28 en la quincena). Con otra forma de comer se escala
como `kindCap` (`Kinds.ts:21`): `ceil(cifra × principales ÷ 28)`, al menos 1 en los mínimos
que apliquen. "Ración" según AESAN 2022 (consideraciones generales, pp. 52-54).

| Grupo | Mínimo | Máximo | No en días seguidos | Fuente | Tipo de regla |
|---|---|---|---|---|---|
| **Legumbres** (≥ 25 g en seco por plato, media ración) | **8** (4/sem) | — (cada tipo ≤ 3, ya `0082`) | el mismo tipo (ya, con precio) | AESAN 2022: "al menos 4 raciones/semana… hasta un consumo diario"; ración 50–60 g en seco | **nuevo mínimo**, retenido |
| **Pescado** (clase `fish`, ≥ 60 g) | **6** (3/sem) | — | — | AESAN 2022: "3 o más raciones/semana de pescado, priorizando el pescado azul"; ración 125–150 g | **nuevo mínimo**, retenido |
| — de él, **azul** | **2** (1/sem) | — | — | AESAN: "priorizando el pescado azul" (no da cifra; 1 de cada 3 es elección del informe) | **nuevo mínimo**, retenido |
| **Pescado y marisco** juntos | — | **8** (4/sem) | — | sin fuente oficial: elección de producto para dejar sitio a legumbre y carne (pedido del owner) | **nuevo máximo**, retenido |
| **Carne** sin procesar (≥ 50 g) | — | **6** (3/sem) | — | AESAN 2022: "un máximo de 3 raciones/semana de carne, priorizando… aves y conejo"; ración 100–125 g | nuevo máximo, con precio en fase 3, retenido después si la medición lo permite |
| — de ella, **roja** (vaca, ternera, cerdo, cordero, cabra, caza) | — | **4** (2/sem) | **sí** | AESAN cita la pirámide sostenible (Serra-Majem 2020): "carne roja… como máximo 2 raciones/semana"; OMS/IARC: grupo 2A | nuevo máximo, retenido |
| **Carne procesada** (≥ 10 g, en **cualquier** comida) | — | **2** (1/sem) | **sí** | OMS/IARC: grupo 1, +18 % de cáncer colorrectal por cada 50 g diarios, sin nivel seguro conocido; Serra-Majem: ≤ 1/sem; AESAN: "minimizando" | nuevo máximo, retenido — **cifra para el owner** (§ Qué no sé) |
| **Huevos** | — | (8 huevos, 4/sem) | — | AESAN 2022: "hasta 4 huevos/semana" | **solo se mide** (motivo abajo) |
| **Pasta** / **arroz** / **otros granos** | — | **4** cada uno | **sí** | `0081`, `0082` | ya existe, retenido |
| **Patata** | — | — | — | AESAN: "consumo moderado" sin cifra | solo se mide |
| **Verdura** (plato + guarnición) | **150 g en cada principal** (1 ración) | — | — | AESAN: "al menos 3 raciones/día de hortalizas", 150–200 g | con precio, vía acompañamientos |
| **Fruta** | **2 raciones/día** | — | — | AESAN: "2-3 raciones/día de frutas", 120–200 g | con precio, vía acompañamientos |
| **Lácteos** | — | 3 raciones/día | — | AESAN: "un consumo máximo de 3 raciones/día de lácteos" | solo se mide |
| **Cereal integral** | **la mitad** del cereal (en seco) | — | — | AESAN: "priorizando en todo caso los cereales de grano entero y productos integrales" | con precio + datos + prompt |
| **Fibra** | **25 g/día** (y nunca menos que el objetivo actual) | — | — | EFSA 2010: "25 g/día… adecuada para la función intestinal normal en adultos" | con precio (término de día) |

Tres notas que hacen la tabla coherente:

- **Las cifras de AESAN encajan en 14 principales a la semana**: 4 de legumbre, 3 de pescado,
  3 de carne y 4 de huevo suman 14. No es casualidad y es la razón de los máximos: sin máximo
  de pescado y carne, el mínimo de legumbre tiene que desalojar algo, y lo hace contra el
  ajuste de macros.
- **Un plato puede contar en dos grupos.** "Alubias con almejas" es legumbre y marisco;
  "lentejas con chorizo" es legumbre y procesado. Se cuentan raciones, no platos exclusivos,
  como cuenta AESAN.
- **Huevos: medir, no imponer todavía.** El tope de AESAN viene de sustituir carne y del
  impacto ambiental, no de un límite de seguridad (el informe sube la cifra anterior, "2 a 4
  veces", a "hasta 4 huevos"). Hoy se sirven 4–22 huevos por quincena en la biblioteca entera y hasta 31 en rotaciones
  (medido); `huevo` está en 111 recetas. Para un vegetariano el huevo es la proteína
  que sustituye a carne y pescado. Imponer 8 costaría desayunos y días en banda sin un motivo
  de salud claro. Recomiendo medirlo en la fase 1 y que el owner decida con el dato.

### 1.2 Cómo se reconoce cada grupo

Todo se lee del catálogo, nunca del nombre del plato ni de lo que diga el modelo (`0004`).
Gramos **tal como se sirven** (receta escalada a las raciones del día, más acompañamientos),
porque la frecuencia es de lo que la persona come. Los umbrales son media ración AESAN, para
que una guarnición no cuente.

| Grupo | Filas | Umbral | Reutiliza |
|---|---|---|---|
| Legumbre | las 23 de `FOOD_GROUP_SLUGS.pulses` (`Cuisine.ts:130`) **más** las formas ligeras: `hummus`, `hummus-de-remolacha`, `garbanzos-tostados`, `edamame-*`, `soja-texturizada`, `tofu-*`, `tempeh`, `altramuces`, `frijoles-refritos`, `pasta-de-lentejas`, `pasta-de-garbanzos` | ≥ 25 g en seco: cocidas ÷ 2,5, latas de guiso ÷ 4, hummus y tofu ÷ 4, tempeh ÷ 2 | `legumeKind` (`Legume.ts:50`) para el tipo. Las formas ligeras son cómo llega la legumbre a la cena española (`0062` § 2, `0079` Tabla 2) |
| Pescado | clase `fish` | ≥ 60 g (pescado + marisco) | `FoodClass` (`food.schema.ts:29`) |
| Pescado azul | lista nueva de slugs: `salmon*`, `atun-*`, `bonito`, `caballa*`, `sardina*`, `boquerones`, `anchoas-*`, `jurel`, `melva-*`, `ventresca-de-atun`, `trucha*`, `palometa`, `pez-espada`, `salmonete`, `mojama` | el azul pesa más que el blanco y que el marisco en el plato | nueva constante junto a `KIND_BY_CLASS` (`Protein.ts:49`) |
| Marisco | clase `shellfish` | cuenta en el máximo, no en el mínimo | `FoodClass` |
| Carne blanca | clase `meat`, sin `pork`, slug de `pollo`, `pavo`, `conejo`, `codorniz`, `perdiz`, `pato` | ≥ 50 g | AESAN: "carne blanca es la carne de aves y conejo" |
| Carne roja | el resto de `meat` (con `pork`) | ≥ 50 g | AESAN/OMS: "vaca, ternera, cerdo, cordero, caballo y cabra" |
| Carne procesada | lista nueva: `bacon`, `butifarra`, `chorizo`, `fiambre-de-*`, `fuet`, `jamon-*`, `lacon`, `lomo-embuchado`, `morcilla`, `mortadela`, `panceta`, `salchich*`, `sobrasada`, las latas `cocido-madrileno-`, `fabada-` y `lentejas-con-chorizo-en-lata`, `croquetas-de-jamon-congeladas`, `nuggets-de-pollo-congelados` | ≥ 10 g, en cualquier comida | OMS: "transformada mediante salazón, curado, fermentación, ahumado" |
| Huevo | `huevo`, `huevo-de-codorniz` (no `clara-de-huevo`) | 55 g = 1 huevo (AESAN: 53–63 g) | `KIND_BY_CLASS` lee `egg` |
| Pasta, arroz, granos, patata | `dishGroups` y `starchBase` tal cual (`Cuisine.ts:203`, `Starch.ts:74`) | 20 g en seco / 100 g | **más `harina-de-maiz` en `grains`** si la fase 1 confirma que fue la polenta de v17 — con cuidado: hoy está en dos desayunos (arepas, tortitas), y `FAMILY_FIT` les quitaría el desayuno |
| Integral | lista nueva: `arroz-integral-*`, `arroz-salvaje-*`, `pasta-integral-*`, `quinoa-*`, `bulgur-*`, `trigo-sarraceno*`, `mijo*`, `espelta-en-grano`, `espelta-cocida`, `freekeh`, `amaranto`, `copos-de-avena`, `harina-de-avena`, `pan-integral`, `pan-de-molde-integral`, `wrap-integral` | porcentaje de gramos en seco (`toDry`) sobre todo el cereal | `Yield.ts` |
| Verdura | categoría `produce` o `frozen` menos fruta fresca (`FRESH_FRUIT_SLUGS`), patata y fruta congelada; más tomate en conserva, pisto, pimientos asados | gramos por principal | `FRESH_FRUIT_SLUGS` (`MealFit.ts:162`) |
| Fruta | `FRESH_FRUIT_SLUGS` + `frutos-rojos-congelados` | 150 g = 1 ración | idem |
| Lácteos | categoría `dairy` sin mantequilla, nata ni ghee | leche 225 g, yogur 125 g, queso fresco 100 g, curado 50 g | — |
| Azúcar añadido (aproximado) | `azucar-*`, `miel`, `sirope-*`, `mermelada-*`, `dulce-de-membrillo` | gramos al día | no hay columna de azúcares: es un indicador, no la cifra |

Medido sobre las 436 recetas de comida o cena de la referencia: de 145 con legumbre, 139
tienen ≥ 25 g en seco por ración y 119 ≥ 40 g. El umbral no cambia casi nada: la legumbre de
la biblioteca es ración de verdad. Lo que falta es frecuencia.

## 2. Por objetivo

### 2.1 Cómo se modelan hoy

Cinco objetivos (`GOAL_TYPES`, `core/entities/Profile/Profile.ts:49`): `weight_loss`,
`maintenance`, `muscle_gain`, `performance`, `healthy_eating`. Más los días de evento
(`0043`, `dayTargets`). El objetivo cambia **tres** cosas en código:

- la energía (déficit o superávit acotados, `Nutrition.ts:296-330`);
- la proteína por kg (1,4–1,9 g/kg, sobre peso de referencia salvo los de entrenamiento,
  `Nutrition.ts:23`, `0076`);
- una línea del prompt (`GOAL_GUIDANCE`).

El reparto entre comidas es el mismo para todos: cada comida recibe su parte de **energía y
de proteína en la misma proporción** (`slotBudgets`, `Scheduler.ts:1002`). Nada más depende
del objetivo: ni la verdura, ni la fibra, ni la densidad de la cena, ni los procesados.

### 2.2 Medido hoy (biblioteca entera, acompañamientos activos)

| Perfil (objetivo) | Proteína g/kg: desayuno · comida · cena · tentempiés (mín.) | kcal/g comida · cena | Fibra g/día (objetivo actual) |
|---|---|---|---|
| objetivo-bajo-3-comidas (pérdida) | 0,42 (0,26) · 0,77 (0,66) · 0,64 (0,47) · — | 1,10 · 0,97 | 20 (17) |
| objetivo-alto-5-comidas (músculo) | 0,41 (0,26) · 0,64 (0,49) · 0,54 (0,47) · 0,15–0,17 (0,09) | 1,56 · 1,40 | 73 (58) |
| imc-alto-2-comidas (pérdida) | — · 0,65 (0,53) · 0,60 (0,51) · 0,11 | 1,37 · 1,33 | 41 (30) |
| tres-comidas-proteina-alta (pérdida) | — · 0,72 (0,55) · 0,62 (0,45) · 0,17 | 1,34 · 1,19 | 37 (32) |
| patron-sin-gluten (pérdida) | 0,42 (0,19) · 0,58 (0,41) · 0,64 (0,40) · 0,16 | 1,25 · 0,93 | 29 (22) |
| quincena-con-evento (rendimiento) | 0,43 (0,29) · 0,69 (0,55) · 0,49 (0,33) · 0,18 | 1,35 · 1,19 | 39 (30) |
| los 8 restantes (mantenimiento, comer sano, patrones) | 0,27–0,36 · 0,46–0,58 · 0,41–0,50 · 0,12–0,18 | 1,27–1,46 · 1,10–1,34 | 35–52 |

Lecturas:

- **La proteína en comida y cena ya pasa 0,4 g/kg en todos los perfiles**, de media; el
  mínimo, de 0,28 a 0,66. Es consecuencia del reparto proporcional. El hueco son los
  desayunos (mínimos de 0,17–0,29) y los tentempiés (0,07–0,18).
- **La cena ya es menos densa que la comida** en todos los perfiles (0,04–0,33 kcal/g menos),
  y todas las principales están entre 0,9 y 1,6 kcal/g, que es densidad baja. No es un hueco.
- **La fibra supera el objetivo actual en todos los perfiles**, pero el objetivo actual (14 g
  por 1.000 kcal) deja a quien come 1.200 kcal en 17 g. La persona de pérdida de peso con
  menos energía come 20 g al día (medido), por debajo de los 25 g de EFSA.

### 2.3 Qué cambia con cada objetivo

Además de energía y macros, y además de la tabla de § 1.1, que vale para todos:

| | Pérdida de grasa | Ganancia muscular | Rendimiento | Mantener / comer sano |
|---|---|---|---|---|
| **Proteína por toma** | ≥ 0,3 g/kg en comida y cena (ya se cumple; se retiene para que no se pierda) | ≥ 0,4 g/kg en al menos 3 tomas; ≥ 0,25 g/kg en cada toma si come 4 o más (ISSN: 0,25 g/kg o 20–40 g por toma, cada 3–4 h; Schoenfeld y Aragon: 0,4 g/kg en ≥ 4 tomas) | ≥ 0,3 g/kg en comida y cena; tras entrenar, carbohidrato y proteína juntos (ACSM: 0,3 g/kg cada 3–5 h) | ≥ 0,25 g/kg en desayuno, comida y cena |
| **Suelo de proteína del día** | 1,8 g/kg de peso de referencia (ya; ISSN posición 3 llega a 2,3–3,1 en déficit con entrenamiento de fuerza: no lo propongo sin saber si entrena) | 1,9 g/kg (ya; ISSN 1,4–2,0) | 1,8 g/kg (ya) | 1,4–1,6 (ya; EFSA PRI 0,83) |
| **Fibra** | ≥ 25 g aunque la energía sea baja | ≥ 25 g | ≥ 25 g, **menos** el día de evento y el anterior (digestión) | ≥ 25 g |
| **Volumen** | ≥ 150 g de verdura en **cada** principal | ≥ 150 g en el 80 % | igual | ≥ 150 g en el 80 % |
| **Densidad de la cena** | se mide; no se impone (ya es baja) | — | — | — |
| **Legumbre** | 8 | 8 | 8, sin contar el día de evento ni el anterior | 8 |
| **Procesados y azúcar** | igual para todos (tabla); el azúcar, solo prompt | igual | igual | igual |

**Qué puede hacer cumplir el scheduler y qué solo el prompt:**

- **Scheduler (código, comprobable):** todas las frecuencias de la tabla; la proteína por
  toma (con pesos de proteína por comida distintos de los de energía en `slotBudgets`, y la
  misma proporción en `briefFor` del prompt); la fibra como término del día; la verdura y la
  fruta eligiendo acompañamiento; la preferencia por integral; excluir legumbre en días de
  evento.
- **Solo prompt (no medible con el catálogo):** fritura frente a horno, salsas de nata
  (`0079` ya midió que no se reconocen por nombre), azúcar libre más allá de las filas de
  azúcar y miel, sal, digestibilidad cerca del entrenamiento, "cena ligera" como forma de
  cocinar.

## 3. Cómo se hace cumplir

### 3.1 Máximos: el mismo mecanismo que `0081`/`0082`

Pescado y marisco ≤ 8, carne roja ≤ 4 y nunca en días seguidos, procesados ≤ 2 y nunca en
días seguidos: cada uno es un `KindCheck` más en `KindRules.held` (`Scheduler.ts:1219-1226`),
con un índice por plato como `legumeIndex`. Se retienen en los mismos cuatro sitios (primera
elección, `improveDay`, `repairOutOfBand`, `pickReplacement`) y solo las bandas los superan.
No hace falta mecanismo nuevo. Dos detalles:

- **Procesados cuentan en todas las comidas**, no solo en las principales: el jamón está en
  desayunos y tentempiés (hoy 0–9 por quincena en la biblioteca entera, medido). El
  `KindCheck` sin `slots`.
- **Carne total ≤ 6, con precio primero.** Es la regla con más distancia a hoy (se cumple en
  el 25–38 % de los planes, medido) y la que más choca con objetivos de proteína alta.
  Primero con precio (`PROTEIN_SWAP_WEIGHT`) y medida; retenida solo si la medición no pierde
  días.

### 3.2 Mínimos: nuevos, y en dos sitios

Un mínimo no se puede juzgar comida a comida: el día 3 no sabe si la quincena acabará corta.
`kindExcess` y `kindCrowded` (`Kinds.ts:31`, `:80`) no sirven. Propongo:

1. **Garantía en el pool** (`rotatePool`). Antes de barajar el resto, la rotación reserva por
   grupo los platos que la tabla necesita, si la persona los tiene en su biblioteca filtrada:
   legumbre en comida (≥ 6 platos de ≥ 3 tipos), legumbre ligera en cena (≥ 2 si existen),
   pescado (≥ 6, ≥ 2 azul) e integral. Cero llamadas, determinista con la misma semilla.
   Sin esto, un mínimo es una lotería (§ 4.2).
2. **Reserva al construir.** Antes del bucle de días (`Scheduler.ts:659`), un calendario
   marca qué comidas deben llevar cada grupo: las 8 legumbres repartidas (sin tipos seguidos,
   en comida si la cocina no admite cena, `FAMILY_FIT`), los 6 pescados. En una comida
   marcada, `underCap` se estrecha a los platos del grupo que caben (`fitsPlate`) y no rompen
   una regla retenida; si no hay ninguno, la marca se ignora. `improveDay` cobra
   `HELD_KIND_WEIGHT` por cambiar un plato del grupo marcado por otro que no lo es.
3. **Una pasada final, `meetFloors`**, después de `repairOutOfBand` y antes de
   `enforceDistinctDays`: si un grupo queda por debajo de su mínimo efectivo, prueba a
   cambiar una principal que no es del grupo por una que sí, solo si el día queda igual o
   mejor en bandas y no rompe una regla retenida. Determinista, acotada (como mucho 8 × 28
   intentos por grupo con su lista corta). Es la garantía; el calendario hace que casi nunca
   trabaje.
4. **`pickReplacement`** (el cambio de plato que pide la persona): si quitar el plato actual
   deja la quincena bajo un mínimo, ordena primero los candidatos del mismo grupo, **después**
   de `pastCap` y **antes** del ajuste. Lo que pidió la persona (`axisFilter`) sigue mandando.
5. **La reconstrucción por evento** (`dayIndexes`, `0044`) cuenta las comidas ya colocadas
   (`placed`), como ya hace con las reglas retenidas.

**El mínimo efectivo** de cada grupo es

`min(cifra de la tabla × principales ÷ 28, lo que el pool de esta persona puede dar)`

donde "lo que puede dar" suma, por plato del grupo que cabe en alguna principal, hasta 2
apariciones (`VARIETY_RULES`), y por tipo de legumbre hasta 3 (`LEGUME_RULES`). Así los
mínimos y los topes nunca se contradicen: con 2 tipos de legumbre el mínimo es 6, no 8.

### 3.3 Conflictos, y quién gana

| Conflicto | Gana | Cómo |
|---|---|---|
| Alergia, intolerancia, forma de comer | **siempre la restricción** | filtran el pool antes; el mínimo efectivo es 0 si no queda nada del grupo. Sin leer la alergia en la regla |
| "No me gusta el pescado" | **la persona** (owner, 017) | igual: el pool no tiene clase `fish` → mínimo 0. Un "no me gusta el salmón" deja el mínimo con los otros pescados |
| Vegetariano, vegano | la forma de comer | pescado y carne no aplican; legumbre 8 (hoy ya 14–22, medido) |
| Pescetariano | la forma de comer | carne no aplica; el máximo de pescado sube a 12 (ocupa el sitio de la carne) |
| Sin pescado (por lo que sea) | — | el máximo de carne sube de 6 a 12 (blanca primero; roja sigue ≤ 4), o la proteína alta no se alcanza (`tres-comidas-proteina-alta`: 7 rojas + 9 blancas hoy) |
| `traditional_spanish` | la forma de comer | la legumbre española no cena (`0079`); las 8 van a 14 comidas. Es la semana española de verdad (4 de 7 comidas). No choca con pasta ni arroz, que son máximos: quedan 6 comidas para todo lo demás. El coste es variedad en la comida, y el hueco real son las cenas (0 de legumbre, § 4.3) |
| Las bandas (±5 %) | **las bandas** (owner, 017) | igual que `0081`: si un día solo entra en banda rompiendo un mínimo o un máximo, lo rompe. El evaluador lo cuenta |
| Mínimo frente a tope del mismo grupo | ninguno: no pueden chocar | el mínimo efectivo se calcula con los topes |
| Mínimo de legumbre frente a tope de almidones | — | la legumbre es su propia base (`StarchBase 'legume'`), no consume tope de pasta ni arroz |
| Días de evento | el evento | el día cargado y el anterior no cuentan para el mínimo de legumbre y la legumbre tiene precio esos días |

## 4. Medición

### 4.1 La puntuación de equilibrio

Para el evaluador (`evaluate-plans.mjs`), por perfil y por objetivo: cada regla de la tabla
que **aplica** a esa persona se cumple o no; la puntuación es la fracción cumplida. No se
pondera: una regla más fácil no esconde una difícil. Las doce reglas que medí: legumbre ≥ 8;
pescado ≥ 6; azul ≥ 2; pescado y marisco ≤ 8; carne ≤ 6 (12 sin pescado); roja ≤ 4 y sin días
seguidos; procesados ≤ 2 y sin días seguidos; pasta, arroz y granos ≤ 4; ≥ 150 g de verdura en
el 80 % de las principales; fruta ≥ 2 raciones al día; integral ≥ 50 %; fibra ≥ 25 g. Huevos,
patata, lácteos, azúcar aproximado, proteína por toma y densidad se informan sin puntuar.

El reconocimiento y los umbrales son exactamente los de § 1.2, para que la fase 1 reproduzca
estos números.

### 4.2 Hoy, sobre la biblioteca de referencia

**Biblioteca entera** (lo que mide hoy el evaluador), 14 perfiles, 196/196 días en banda en
las dos ejecuciones (medido):

| Regla | Off | On (acompañamientos) |
|---|---|---|
| Legumbre ≥ 8 | 12/14 | 12/14 |
| Pescado ≥ 6 (12 aplican) | 10/12 | 10/12 |
| Azul ≥ 2 | 11/12 | 11/12 |
| Pescado y marisco ≤ 8 | 7/14 | 9/14 |
| Carne ≤ 6 (13 aplican) | 5/13 | 4/13 |
| Roja ≤ 4, sin seguidos | 5/13 | 5/13 |
| Procesados ≤ 2, sin seguidos | 4/13 | 1/13 |
| Pasta, arroz, granos ≤ 4 | 14/14 | 14/14 |
| Verdura ≥ 150 g en el 80 % | 0/14 | 2/14 |
| Fruta ≥ 2/día | 0/14 | 0/14 |
| Integral ≥ 50 % | 1/14 | 1/14 |
| Fibra ≥ 25 g | 13/14 | 13/14 |

Rangos por perfil (off; on muy parecido): legumbre 6–20 de 28, pescado 0–18, azul 0–5,
roja 0–6, blanca 0–10, procesados 0–9 en toda la quincena, huevos 4,6–21,7, patata 0–14,
verdura 129–250 g por principal de media, fruta 0,1–0,7 raciones al día (0,2–1,1 con
acompañamientos), integral 9–56 % en principales, fibra 21–75 g.

**Rotación como la de producción** (medido): `rotatePool` a 19 platos por comida con 10
semillas por perfil, y el reintento `wider_rotation` de `PlanGeneration.service.ts:369-403`
cuando falla una banda; sin el tercio fresco del modelo, que no se puede medir sin llamarlo.
14 perfiles × 10 semillas × off/on = 280 planes.

- **Días en banda:** 1.959/1.960 off y 1.960/1.960 on. Pero el reintento hizo falta en 111 de
  140 planes off y en 42 de 140 on: sin platos nuevos, la rotación de 19 sola falla una banda
  la mayoría de las veces. Toda regla que se añada empuja más planes a ese reintento.
- **Reglas cumplidas, de los 280:**

| Regla | Cumplida | | Regla | Cumplida |
|---|---|---|---|---|
| Legumbre ≥ 8 | 206/280 (74 %) | | Procesados ≤ 2 | 72/260 (28 %) |
| Pescado ≥ 6 | 200/240 (83 %) | | Pasta, arroz, granos ≤ 4 | 217/280 (78 %) |
| Azul ≥ 2 | 202/240 (84 %) | | Verdura ≥ 150 g en el 80 % | 52/280 (19 %) |
| Pescado y marisco ≤ 8 | 151/280 (54 %) | | Fruta ≥ 2/día | 1/280 (0 %) |
| Carne ≤ 6 | 66/260 (25 %) | | Integral ≥ 50 % | 20/280 (7 %) |
| Roja ≤ 4, sin seguidos | 109/260 (42 %) | | Fibra ≥ 25 g | 260/280 (93 %) |

- **Por perfil, acompañamientos activos** (mínimo / mediana / máximo de las 10 semillas):

| Perfil (objetivo) | Legumbre | Pescado | Procesados | Puntuación (mediana) |
|---|---|---|---|---|
| objetivo-bajo-3-comidas (pérdida) | 4 / 5 / 9 | 14 / 17 / 19 | 2 / 4 / 7 | 42 % |
| objetivo-alto-5-comidas (músculo) | 12 / 13 / 14 | 4 / 5 / 5 | 5 / 7 / 8 | 50 % |
| alergia-lacteos (mantener) | 6 / 8 / 13 | 7 / 9 / 19 | 4 / 5 / 11 | 42 % |
| patron-vegetariano (comer sano) | 14 / 16 / 22 | — | — | 57 % |
| quincena-con-evento (rendimiento) | 4 / 8 / 11 | 3 / 8 / 13 | 1 / 4 / 7 | 42 % |
| alergia-personalizada (mantener) | 3 / 7 / 15 | 7 / 9 / 14 | 0 / 2 / 4 | 50 % |
| alergia-personalizada-no-resuelta | 4 / 9 / 12 | 6 / 10 / 14 | 3 / 4 / 6 | 50 % |
| patron-halal (comer sano) | 7 / 8 / 14 | 3 / 7 / 11 | 0 / 2 / 5 | 58 % |
| patron-kosher (comer sano) | 8 / 11 / 12 | 4 / 5 / 11 | 0 / 2 / 3 | 58 % |
| patron-sin-gluten (pérdida) | 5 / 7 / 14 | 6 / 19 / 21 | 1 / 3 / 5 | 50 % |
| patron-sin-lactosa (mantener) | 6 / 7 / 11 | 2 / 9 / 12 | 2 / 4 / 7 | 42 % |
| imc-alto-2-comidas (pérdida) | 6 / 8 / 11 | 4 / 10 / 18 | 0 / 2 / 5 | 50 % |
| patron-tradicional-espanola (mantener) | **2 / 5 / 8** | 5 / 9 / 16 | 2 / 5 / 10 | 42 % |
| tres-comidas-proteina-alta (pérdida, sin pescado) | 8 / 10 / 16 | 0 / 2 / 3 (marisco) | 0 / 3 / 7 | 40 % |

- **Por objetivo** (media de las medianas, on): pérdida 45 %, músculo 50 %, mantener 45 %,
  comer sano 58 %, rendimiento 42 %. Off, igual salvo músculo (58 %, un solo perfil). Ningún objetivo se diferencia hoy del
  resto: el plan no sabe para qué come la persona más allá de sus números.
- **La oferta de la rotación** (comidas con legumbre en el pool de 19, off): entre 3 y 16
  platos según perfil y semilla, de **1 a 4 tipos**. En 35 de las 140 rotaciones solo había 2
  tipos o menos, y con el tope de 3 por tipo eso da 6 legumbres como mucho: el mínimo de 8 es
  imposible antes de que el scheduler elija nada. Esa es la razón de la fase 2.

Lecturas:

- **El pescado sobra, no falta**, en los perfiles de pérdida de peso: 17 y 19 de 28 de
  mediana (`objetivo-bajo-3-comidas`, `patron-sin-gluten`). El pescado blanco es la proteína
  magra que mejor ajusta un objetivo bajo en grasa. El máximo de 8 les costará ajuste: es
  donde la fase 3 puede perder días.
- **Lo que menos se cumple no son las legumbres**: fruta (0 %), integral (7 %), verdura
  (19 %), carne (25 %) y procesados (28 %).
- **Huevos:** de 0,2 a 31 huevos por quincena según perfil y semilla; medianas de 3,6 a 24
  (el vegetariano, 24). La mediana pasa el tope de AESAN (8) en 6 de 14 perfiles.

### 4.3 Dónde la biblioteca es escasa

Oferta por persona, biblioteca entera, platos que cumplen el umbral (medido):

| | Omnívoro | `traditional_spanish` | Vegetariano | Sin gluten | No le gusta el pescado |
|---|---|---|---|---|---|
| Comidas con legumbre (tipos) | 112 (4) | 56 (4) | 52 (4) | 87 (4) | 84 (4) |
| Cenas con legumbre | 37: española **3**, asiática 19, latina 15 | **0** | 47 | 27: española 3 | 35: española 3 |
| Comidas / cenas con pescado | 107 / 64 | 85 / 49 | — | 93 / 57 | 16 / 10 (marisco) |
| — azul | 37 / 24 | 28 / 17 | — | 30 / 21 | 0 |
| Platos de cereal integral, comida / cena | 79 de 173 / 15 de 62 | 34 de 81 / **1 de 10** | 15 de 35 / 9 de 23 | 41 de 93 / 9 de 36 | 63 de 134 / 15 de 55 |

Las celdas escasas, de más a menos importante:

1. **Cena española ligera de legumbre: 3 platos.** Sin ellos las 8 legumbres caen todas en
   comida, y la cena de legumbre la ponen platos asiáticos o latinos que una persona de cocina
   española no espera. Para `traditional_spanish` no hay ninguna (y `0077` le quita el hummus).
2. **Tipos de legumbre: 4 de 7.** Garbanzos, lentejas, alubias blancas y otras alubias. No hay
   habas, guisantes secos ni soja en grano en ningún plato de comida. Con el tope de 3 por tipo,
   4 tipos dan 12 como mucho: suficiente para 8, justo si la rotación saca solo 2 o 3.
3. **Cereal integral en cena:** 15 de 62 para un omnívoro, 1 de 10 para `traditional_spanish`.
4. **Fruta:** no es un problema de platos. La fruta entra como postre (acompañamiento) o en
   desayunos y tentempiés; con acompañamientos activos sube de 0,1–0,7 a 0,2–1,1 raciones al
   día y sigue lejos de 2. Es de `0079` Tabla 3 y del scheduler de acompañamientos.

### 4.4 ¿Hay que pedir platos al generador?

**Sí, pero poco y dentro de lo que ya se pide.** El generador ya recibe peticiones de 3, 3 y 1
platos por comida en paralelo (`DISHES_PER_REQUEST`, `PoolBuilder.service.ts:45`; `0064`), y el
`PoolBuilder` conoce el pool rotado (`reusable`) antes de pedir. Puede contar la oferta de
cada grupo y añadir a la petición de esa comida una línea como:

> "De estos 3 platos, 1 lleva legumbre como base, a media ración o más (25 g en seco o
> 60 g cocida por ración), de un tipo que no sea: garbanzos, lentejas."

Para la cena española: "1 cena ligera de legumbre: ensalada templada, crema o puré, nunca
guiso" (la misma forma que ya se pide a vegetarianos, `PLANT_BASED_DINNER`, `PoolPrompt.ts:569`).
Para integral: "el cereal, integral".

- **Coste en llamadas: cero.** Son las mismas 3 + 3 + 1 peticiones. **Estimado**: a ~0,012 $
  por petición (`0064`, medido el 2026-09-26) una llamada aparte para "rellenar huecos" sería
  +0,012 $ por plan, un +10 % sobre 0,10–0,15 $; no hace falta.
- **Coste en prompt:** una o dos líneas por comida, unos 40–80 tokens (**estimado**, 6 por
  fila como `catalogue-by-meal.mjs`), frente al presupuesto del 55 % de PRD 005. Hay que
  medirlo con `catalogue-by-meal.mjs` en la fase; hoy no sé el margen exacto (**desconocido**).
- **Riesgo:** la línea choca con `spreadRules`, que limita cada proteína a un cuarto del lote
  (`PoolPrompt.ts:488`): con 7 platos, 2 de legumbre. Es compatible.
- **Efecto acumulado:** cada plato nuevo entra en la biblioteca (`0013`). Pedir 1–2 platos de
  legumbre o de cena ligera por plan hace crecer justo las celdas escasas.

Lo que **no** se pide al generador: fruta (acompañamientos), verdura (acompañamientos y
`COMPOSITION_RULES`), mínimos (los decide el scheduler, nunca el modelo, `0004`).

## 5. Plan

Cada fase se entrega sola, con su métrica y su señal de parada. Todas: 196/196 días en banda
off y on en la biblioteca de referencia, 0 alérgenos, tiempo de `schedulePlan` dentro de +10 %
del de 017 fase 4.

**Fase 1 — Medir (sin cambiar ningún plan).**
- El evaluador gana: el reconocimiento de § 1.2 en `core` (funciones puras con sus tests:
  `isProcessedMeat`, `isOilyFish`, `legumeDryGrams`, `isWholeGrain`…), la puntuación de § 4.1
  por perfil y por objetivo, la proteína por toma, la densidad por comida, y un modo
  `--rotate <semillas>` que programa como producción (rotación de 19 y reintento `wider_rotation`).
- El lead lee el plato de polenta de v17 (una consulta de solo lectura a producción, con el sí
  del owner) para decidir `harina-de-maiz`.
- Métrica: los números de § 4.2 reproducidos con el script del repositorio. Parada: si la
  puntuación del repositorio difiere de la de este informe en más de una regla por perfil, se
  revisa el reconocimiento antes de seguir.

**Fase 2 — La rotación garantiza los grupos (cero llamadas).**
- `rotatePool` reserva platos por grupo (§ 3.2, punto 1) cuando la biblioteca filtrada los
  tiene. El resto, barajado como hoy.
- Métrica: en `--rotate 10`, la oferta mínima de comidas con legumbre ≥ 6 de ≥ 3 tipos y de
  pescado ≥ 6 en todo perfil que lo tenga en su biblioteca. Parada: si se pierde algún día en
  banda en `--rotate` frente a la fase 1.

**Fase 3 — Los máximos (mismo mecanismo que `0081`/`0082`).**
- Pescado y marisco ≤ 8, roja ≤ 4 sin días seguidos, procesados ≤ 2 sin días seguidos:
  retenidos. Carne total ≤ 6 (12 sin pescado): con precio.
- Métrica: perfiles por encima de cada máximo en `--rotate 10`, a cero salvo donde las bandas
  lo pidan. Parada: un día perdido en la biblioteca entera.

**Fase 4 — Los mínimos.**
- Mínimo efectivo, calendario de reserva, `meetFloors`, `pickReplacement` (§ 3.2). Legumbre 8,
  pescado 6, azul 2.
- Métrica: legumbre ≥ mínimo efectivo en el 100 % de las ejecuciones de `--rotate 10`, igual
  pescado. Parada: tiempo > +10 %, o un día perdido.
- Decisión: un registro nuevo (`0084`) que extiende `0082` con los mínimos.

**Fase 5 — Verdura, fruta, fibra e integral (acompañamientos).**
- Con acompañamientos activos: precio por principal con < 150 g de verdura sin guarnición de
  verdura; postre de fruta preferido hasta 2 raciones al día; fibra ≥ 25 g como término del
  día; pan integral preferido al blanco en la guarnición. Objetivo de fibra = máx.(14 g por
  1.000 kcal, 25 g).
- Métrica: reglas de verdura, fruta y fibra de § 4.1. Parada: un día perdido; o si la fruta
  solo sube rompiendo los carbohidratos, se deja en lo que dé y se dice.

**Fase 6 — Proteína por toma según el objetivo.**
- Pesos de proteína por comida, distintos de los de energía, para `muscle_gain` (y el mínimo de
  0,25 g/kg por toma para los demás); `briefFor` los usa también, en la misma versión de
  prompt.
- Métrica: tomas ≥ 0,4 g/kg en `objetivo-alto-5-comidas`. Parada: si los tentempiés dejan de
  existir en la biblioteca con esa proteína (se pide al generador en la fase 7).

**Fase 7 — El generador rellena huecos (cero llamadas de más).**
- Líneas por grupo en las peticiones existentes, solo cuando la oferta de esa persona está por
  debajo de lo que el calendario necesita (§ 4.4). `GOAL_GUIDANCE`: legumbre, pescado azul e
  integral para todos los objetivos, no solo `healthy_eating`. `PROMPT_VERSION` 4.7.0.
- Métrica: `catalogue-by-meal.mjs` ≤ 55 %; en una muestra pagada (número y coste fijados por
  el lead y aprobados por el owner), ≥ 1 plato del grupo pedido por plan. Parada: si el prompt
  pasa del 55 %.

## Requisitos

- **Código:** `core/domain/Variety` (reconocimiento, reglas retenidas nuevas, mínimos),
  `core/domain/Scheduler` (calendario, `meetFloors`, pesos de proteína), `Rotation`, el
  evaluador, `PoolBuilder` y `PoolPrompt` (fase 7).
- **Datos:** ninguna migración. Dos listas nuevas en código (procesados, pescado azul,
  integral). Si la fase 1 lo confirma, `harina-de-maiz` en `grains`.
- **Infraestructura y dinero:** cero, salvo la muestra pagada de la fase 7 (**estimado**:
  10–20 peticiones a ~0,012 $ = 0,12–0,24 $), que decide el owner.
- **Tiempo del owner:** las tres decisiones de abajo, y revisar el registro de la fase 4.
- **Decisiones del owner:**
  1. Procesados: ≤ 2 por quincena (OMS y la pirámide que cita AESAN) o ≤ 4 (más tolerante con
     el jamón del desayuno).
  2. Carne ≤ 6 por quincena (AESAN): ¿retenida o solo con precio? Es la regla más lejos de hoy.
  3. Huevos: ¿solo medir, o tope de 8 a la quincena salvo vegetarianos?

## Riesgos

1. **Menos días en banda (seguridad nutricional, todos).** Cada regla retenida quita opciones al
   ajuste. Probable con pools pequeños: en rotaciones sin el tercio fresco los días en banda ya
   bajan (§ 4.2). Se ve en el evaluador; se deshace bajando la regla de retenida a precio.
   Mitigación: las bandas mandan, como en `0081`.
2. **Mínimos que obligan a comer lo que no se quiere (confianza).** Si el mínimo leyera la
   preferencia en vez del pool, un error serviría pescado a quien no quiere. Por eso se calcula
   sobre el pool filtrado: imposible por construcción. Test: un perfil sin pescado nunca tiene
   mínimo de pescado.
3. **El marisco no lo quita "no me gusta el pescado" (expectativa).** Medido: sí sirve gambas. Es
   correcto por idioma ("pescado" no es "marisco"), pero la persona puede esperarlo. Se ve en
   feedback; lo decide el owner (podría ser una sugerencia en el formulario de preferencias).
4. **Tiempo de generación.** `meetFloors` añade una pasada. Probable +3–10 % (**estimado**, por
   analogía con `repairOutOfBand`). Se ve en el `ms` del evaluador; se acota la lista corta.
5. **Legumbre en días de evento (rendimiento).** Mitigado por la exclusión de § 3.3.
6. **Cuota de Neon: ninguno.** Todo se mide en local; la única lectura de producción es la del
   plato de v17, una consulta.

## Coste y esfuerzo

- Fase 1: 1–2 días de agente (**estimado**; el evaluador ya tiene casi todo).
- Fases 2–4: 3–6 días (el calendario y `meetFloors` son lo grande; depende de cuántas pasadas
  necesiten tocarse para no deshacer un mínimo).
- Fases 5–6: 2–4 días.
- Fase 7: 1–2 días y la muestra pagada.
- Dinero: 0 € en las fases 1–6; ~0,1–0,3 $ en la 7 (**estimado**).

## Qué no sé

- **Cuántas legumbres y pescados trae el tercio fresco del modelo.** No se puede medir sin
  llamar al modelo. Mis rotaciones no lo incluyen, y por eso infraestiman la oferta real
  (**desconocido**).
- **El plato de polenta de v17**: si es `harina-de-maiz` o `polenta-cocida` por debajo de 80 g.
- **Si los acompañamientos están activos en producción** (`SettingsController.accompaniments`).
  Cambia la fruta y la verdura medidas.
- **El margen exacto del prompt frente al 55 %** con las líneas nuevas: `catalogue-by-meal.mjs`.
- **Si la persona entrena fuerza**: la ISSN pide 2,3–3,1 g/kg en déficit con entrenamiento de
  fuerza; NutrIA no lo pregunta. No lo propongo sin esa respuesta.
- **Las tres cifras del owner** (procesados, carne, huevos).

## Fuentes

Leídas el 2026-10-03.

- **AESAN**, Comité Científico (2022). *Informe… sobre recomendaciones dietéticas sostenibles y
  recomendaciones de actividad física para la población española*. Resumen: hortalizas
  ≥ 3/día, frutas 2–3/día, patata "consumo moderado", cereales 3–6/día "priorizando en todo
  caso los cereales de grano entero", legumbres "al menos 4 raciones/semana… hasta llegar a un
  consumo diario", pescado "3 o más raciones/semana… priorizando el pescado azul", "hasta 4
  huevos/semana", lácteos "un consumo máximo de 3 raciones/día", carne "un máximo de 3
  raciones/semana… priorizando… aves y conejo y minimizando… carne procesada". Definiciones de
  carne roja, blanca y procesada (§ 2.4.2.4). Raciones (consideraciones generales): hortalizas
  150–200 g, fruta 120–200 g, patata 150–200 g, pan 40–60 g, pasta o arroz 60–80 g en seco,
  legumbres 50–60 g en seco, pescado 125–150 g, huevo 53–63 g, carne 100–125 g, leche 200–250 ml,
  yogur 125 g, queso fresco 85–125 g, curado 40–60 g. Cita la pirámide de dieta mediterránea
  sostenible (Serra-Majem et al., 2020): carne roja ≤ 2/semana, procesada ≤ 1/semana.
  https://riojasalud.es/files/content/ciudadanos/escuela-salud/cuida-tu-salud/alimentacion/profesionales/2022_AESAN_INFORME_recomend_dieteticas_sostenibles_AF.pdf
- **EFSA**, NDA Panel (2010), DRV de carbohidratos y fibra: "A daily intake of 25 grams of
  dietary fibre is adequate for normal bowel function in adults"; carbohidratos 45–60 % de la
  energía. https://www.efsa.europa.eu/en/press/news/nda100326
- **ISSN**, Jäger R. et al. (2017), *Position stand: protein and exercise*, JISSN 14:20.
  Posición 2: 1,4–2,0 g/kg/día; posición 3: 2,3–3,1 g/kg/día en hipocalórico con
  entrenamiento de fuerza; posición 5: 0,25 g/kg o 20–40 g por toma; posición 7: "every
  3–4 h". https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/
- **Schoenfeld B. J., Aragon A. A.** (2018), *How much protein can the body use in a single meal
  for muscle-building?*, JISSN 15:10: 0,4 g/kg por toma en ≥ 4 tomas para 1,6 g/kg/día; hasta
  0,55 g/kg para 2,2. https://pmc.ncbi.nlm.nih.gov/articles/PMC5828430/
- **ACSM, Academy of Nutrition and Dietetics, Dietitians of Canada** (2016), *Nutrition and
  Athletic Performance*: proteína 1,2–2,0 g/kg/día; "0.3 g/kg BW after key exercise sessions
  and every 3 to 5 hours over multiple meals".
  https://www.dietitians.ca/DietitiansOfCanada/media/Documents/Resources/noap-position-paper.pdf
- **OMS / IARC** (26 de octubre de 2015), comunicado 240: carne procesada grupo 1, carne roja
  grupo 2A; "each 50 gram portion of processed meat eaten daily increases the risk of
  colorectal cancer by 18%". https://www.iarc.who.int/wp-content/uploads/2018/07/pr240_E.pdf ·
  Preguntas y respuestas de la OMS: definiciones, y "the data available for evaluation did not
  permit a conclusion… about whether a safe level exists".
  https://www.who.int/news-room/questions-and-answers/item/cancer-carcinogenicity-of-the-consumption-of-red-meat-and-processed-meat
