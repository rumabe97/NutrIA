# 0008 — Una comida a la española: un plato normal y sus acompañamientos

> **Purpose**: respuesta del agente `architect` a la propuesta del owner del 2026-10-02 para
> el proyecto 016. Son cuatro piezas:
> - **A**: un plato a ración normal más pan, fruta, yogur o frutos secos al lado;
> - **B**: el prompt diseña platos para una persona;
> - **C**: el perfil sugiere añadir una comida;
> - **D**: un techo por alimento en cada plato.
>
> El informe dice si se puede, cómo, en qué orden y qué se arriesga. Es la base del PRD.
> **Audience**: el owner y los agentes. **Committed**: sí. **Maintained by**: el agente
> `architect`; una vez fusionado no se edita — una revisión posterior es un informe nuevo.
>
> **Base**: la rama `docs/014-a-plate-that-weighs-what-it-should` en `bd4d018b`. Es `main`
> con 012 y 013 fusionados (#186, #187), más el código de 014 sin fusionar.
>
> **Números**: cada uno lleva su etiqueta, **medido** (dónde), **estimado** (con la
> hipótesis) o **desconocido**.
>
> **Medición**: no se hizo ninguna llamada a un modelo. El evaluador no se pudo ejecutar. Su
> guarda contra producción lee el `.env` del propio worktree, que no lo tiene, y no la he
> rodeado.

## Veredicto

**Sí, con condiciones.** A es la pieza que importa. B, C y D se responden en un párrafo cada
una.

1. **Primero se despliega y se mide 014.** Los platos de 0,8–1,4 kg salen de producción,
   que aún no tiene 014. Con 014 ningún plato pasa de 750 g salvo por el suelo de energía.
2. **A se guarda en una tabla hija, `meal_accompaniments`**, no como filas extra en
   `meals`. El plato y sus acompañamientos siguen siendo una sola comida con un solo
   snapshot de macros.
3. **Los acompañamientos se eligen en código**, dentro de la búsqueda de raciones del día y
   bajo el techo de combinaciones que ya existe. Pasan por `dishSafety` como un ingrediente
   más del plato.
4. **No se estrecha `SERVING_BOUNDS` a 0,75–1,5 como límite duro.** Rompería a quien come
   mucho (`0070`). Entra como preferencia con coste. Hacerlo duro es decisión del owner.
5. **B va después de A, nunca antes.** Sin acompañamientos, un plato de 600 kcal se
   serviría a 1,5–2 raciones y el problema volvería.

## Premisas revisadas

- **«Hoy salen platos de 0,8–1,4 kg y 800–925 g de patata»: incorrecta por
  desactualizada.**
  - Son planes de producción, hechos con el código anterior a 014.
  - Con 014, `withinPlateLimit` exige gramos × raciones ≤ `PLATE_GRAMS_MAX`
    (`Scheduler.ts:668`).
  - Lo que queda es meter ~1.000 kcal en 750 g. Eso pide ≥1,33 kcal/g, y un guiso ronda
    0,9–1,3 (**estimado**).
  - Por eso el planificador tenderá a platos densos o a días fuera de banda. Ese hueco es
    el que cierra A.
- **«Comida y cena rondan 1.000 kcal»: confirmada.** Los pesos de `MealShape.ts` son
  0,045 / 0,33 / 0,30. A 2.150 kcal salen ≈1.050 la comida y ≈955 la cena (**estimado**,
  aritmética).
- **«Las raciones van de 0,5 a 4, acotadas por 012 y 014»: confirmada.**
  - `SERVING_BOUNDS` (`Scheduler.ts:19`);
  - `PLATE_LIMIT` (`:125`);
  - `PLATE_GRAMS_MAX` (`:139`).
- **«Estrechar a 0,75–1,5»: choca con `0070`.** Una comida de 1.400 kcal no cabe en 1,5 ×
  650 más acompañamientos.
- **«Los acompañamientos están en el catálogo»: confirmada** (**medido** en el seed).
  - `pan-blanco`: 290 kcal/100 g, rebanada de 30 g;
  - `pan-sin-gluten`;
  - `naranja`: 47 kcal, pieza de 130 g, solo de noviembre a mayo (`seasons.ts:56`);
  - `yogur-natural-desnatado`: 56;
  - `nueces`: 654;
  - `queso-de-burgos`: 132.
- **«Cabe en la búsqueda»: confirmada con la forma de abajo.**

## Qué hay hoy

- **Una sola comida por franja.** `unique('meals_slot_unique')` sobre
  `(planDayId, slot)` (`packages/database/src/schemas/plan.schema.ts:144`). Completar,
  cambiar, el feedback y las fotos van por comida. Meter los acompañamientos como filas
  extra es un **no**.
- **La comida guarda sus macros.** Están en `meals.kcal…`, y de ahí salen:
  - los totales del día;
  - `validatePlan`;
  - la adherencia;
  - la consola.
- **Los ingredientes de una comida no se guardan.** Se leen de la receta escalada
  (`PlanController.ts:204`).
- **El planificador** elige un plato por franja (`Scheduler.ts:392-407`). Después dimensiona
  el día probando todas las combinaciones (`balancedDay`, `:1039`), con dos límites:
  - `BALANCE_MAX_COMBOS` = 59.049 (`:46`);
  - el reparto de `windowsFor` (`:928`).
- **El control de alérgenos lee `meal.ingredients`.** Lo hacen:
  - `assertPlanIsSafe` (`PlanGeneration.service.ts:528`);
  - la reconstrucción (`PlanLoadRebuild.service.ts:172`);
  - `buildShoppingList` y `unresolvedSlugs`.
- **`breaksDishRule` mira un plato, no una comida** (`Preference.ts:727`, carne con lácteo
  para kosher).
- **Cambio de plato y reconstrucción.**
  - El cambio de plato usa como presupuesto la comida entera (`MealSwap.service.ts:127`).
  - Los dos actualizan la fila en el sitio (`PlanRepository.ts:1005` y `:785`).
- **El prompt ya pide pan al lado**: «a plate with bread, fruit or dairy beside it»
  (`PoolPrompt.ts:524`).

## Propuesta

### A — Plato más acompañamientos

**Datos: una tabla nueva, solo aditiva.**

```
meal_accompaniments(id, meal_id → meals ON DELETE CASCADE,
                    ingredient_id → ingredients ON DELETE RESTRICT,
                    grams, kcal, sort_order, unique(meal_id, ingredient_id))
```

- `meals.kcal` y los macros pasan a ser los de la comida completa. Los totales, la
  validación, el progreso y la consola no cambian.
- El `kcal` por fila mantiene el invariante del snapshot.
- El borrado de cuenta sigue en cascada.

**Alternativas descartadas:**
- **Filas extra en `meals`**: rompen el unique y todo lo que cuelga de una comida.
- **Recetas marcadas como acompañamiento**: entrarían en la reutilización, las fotos y el
  juez de imágenes.
- **Meterlos en la receta**: la receta es compartida y el acompañamiento es de la persona.

**Dominio.** Una tabla fija `ACCOMPANIMENTS`, como `Yield`, con raciones discretas:
- pan, blanco o integral: 30, 60 o 90 g;
- pan sin gluten, solo si `freeFromExclusions` lo deja;
- una pieza de fruta de temporada;
- yogur: 125 g;
- frutos secos: 15 o 30 g;
- queso de Burgos: 60 g.

El aceite queda fuera: es energía invisible y nadie lo come de acompañamiento.

**Un único filtro por persona**, por el que pasa cada acompañamiento:
- `dishSafety`;
- `excludedIngredientIds`, que ya incluye `traditional_spanish` y los alimentos que no le
  gustan;
- las etiquetas no resueltas;
- `MealFit`, por temporada y comida.

**Reglas a nivel de comida:**
- `breaksDishRule` se comprueba sobre plato y acompañamientos juntos.
- Nada del mismo grupo que ya lleve el plato.

**Integración.** `ScheduledMeal` gana `accompaniments`, y sus gramos entran también en
`meal.ingredients`. Así lo ven, sin un segundo bucle:
- la seguridad;
- `unresolvedSlugs`;
- la lista de la compra.

`ScheduledMeal.macros` también es el plato completo. Hoy es solo el plato
(`Scheduler.ts:434`), y de él salen:
- los totales del día (`:439`);
- `validatePlan`;
- el `MealDraft` (`PlanGeneration.service.ts:567`).

Si no los incluyera, se validaría un día que la persona no come y el snapshot sería falso.
Ahí está la costura del ±5 %.

**Coste de búsqueda.**

| Caso | Combinaciones por día |
|---|---|
| Hoy, 3 comidas (ventana ±4) | 9³ = **729** |
| Todos los juegos posibles (~70 por franja) | (9 × 70)² × 9 ≈ **3,6 millones**: no cabe |
| Juegos recortados (K = 6 por franja principal, «ninguno» incluido) | (9 × 6)² × 9 = **26.244** |

Cómo funciona la forma elegida:
- Los juegos se ordenan por lo bien que cierran el hueco de su franja y entran en la
  búsqueda del día como una variable más.
- Con 4 o más comidas, `windowsFor` estrecha primero las comidas ligeras.
- El techo de 59.049 no cambia, así que el peor caso de hoy (5–6 comidas) no sube. Los días
  de 3 comidas pueden tardar hasta ~36× más (**estimado**). El evaluador lo mide.
- Solo se activan cuando la franja principal pasa de ~700 kcal. Si no, K = 1, y quien come
  cinco veces con un objetivo normal no paga nada.
- Un objetivo alto con cinco comidas sí cruza el umbral, y entonces `windowsFor` estrecha las
  demás franjas. El perfil `objetivo-alto-5-comidas` es el que hay que vigilar en la fase 3.
- **Alternativa descartada**: elegirlos en una segunda etapa, con las raciones ya fijadas.
  Fija las raciones sin saber qué pan entra y pierde días dentro de banda. Es la lección del
  voraz de `0045`.

**Raciones.** Siguen en 0,5–4, con un coste suave fuera de 0,75–1,5. El límite duro sigue
siendo 014. El pan da 2,9 kcal/g y un guiso ~1,2, así que la búsqueda preferirá pan a media
ración más.

Ejemplo para 1.050 kcal (**estimado**):

| Parte | Peso | Energía |
|---|---|---|
| Plato de 650 kcal a 1,25 raciones | ~690 g | 812 kcal |
| Pan | 60 g | 174 kcal |
| Naranja | 130 g | 61 kcal |

El techo de 750 g se aplica al plato. Los acompañamientos tienen raciones fijas y no cuentan
en él.

**Cambio de plato.**
- El presupuesto sigue siendo la comida entera.
- `pickReplacement` elige el plato, y la misma función del planificador compone sus
  acompañamientos (9 × 6 combinaciones).
- `swapMeal` y `rebuildLoadedDays` borran y vuelven a insertar las filas en su transacción.
- `composition` las incluye, para que la lista de la compra rehecha las cuente.

**Revisión del profesional.** `pendingPlan` devuelve un `PlanView` y `swapPendingMeal` usa el
mismo servicio. Lo hereda; solo cambia la pantalla.

**Web.**
- En `MealRow` (inicio y `PlanBrowser`): «Lentejas estofadas + pan (60 g) + una naranja».
- En la ficha de la comida, una sección «Acompaña con».
- Claves en los dos diccionarios y repaso de `accessibility`.
- La copia offline lleva el campo nuevo.

**Interruptor.** Un flag global `accompaniments`. Apagado, K = 1 y el plan sale idéntico. Un
test lo fija.

### B — El prompt diseña un plato para una persona

**Sí, detrás de A.**
- Se quita la línea `PoolPrompt.ts:524` y el prompt dice que el plan añade el pan y la fruta.
- `SERVING_KCAL_CAP` de comida y cena baja de 900 a ~650, y con él el límite `oversized`
  (975, `0070`). Prompt 4.6.0.
- El método del plato entra como preferencia, nunca por encima del reparto de macros: una
  dieta alta en proteína no cabe en un cuarto de plato.
- Sin migración. La biblioteca de 700–900 kcal se sirve a 0,75 raciones.
- Solo cambia los platos nuevos, así que su efecto se mide semanas después.

### C — Sugerir una comida más

**Sí, barato.**
- `mealShareKcal(shape, targets.effective)` en core.
- Un aviso en el onboarding y en `/perfil` cuando una franja principal pasa de ~850 kcal.
  Dice cuánto lleva, se puede cerrar y nunca obliga (comida fuerte a propósito, `0036`).
- Sin modelo, sin datos, sin migración.

### D — Techo por alimento

**Sí, sin migración.** Una tabla de código:

| Alimento | Cómo se reconoce | Techo por plato |
|---|---|---|
| Carne | clases `meat` y `pork` | 250 g |
| Pescado y marisco | clases `fish` y `shellfish` | 300 g |
| Legumbre cocida | `isLegumeSlug` | 400 g |
| Cereal | rendimiento de `0078` | 160 g en seco |
| Patata y boniato | lista de slugs | 400 g |

- Se comprueba dentro de `withinPlateLimit`, con la excepción del suelo.
- Aun con 014 sigue cortando: un plato de 700 g puede llevar 550 g de patata.
- **Choca con `0070`**: dos raciones con 200 g de carne dejan de caber. Quien come mucho
  dependerá de A.

## Requisitos

- **Código.**
  - Core: tabla, filtro, `Scheduler`, `ScheduledMeal`, `MealDraft` y vistas.
  - API: generación, cambio de plato y reconstrucción.
  - Web: dos pantallas.
  - El evaluador.
- **Datos.** Una migración aditiva (`CREATE TABLE`), sin rellenar nada. Los planes viejos
  tienen cero filas.
- **Dinero.** Cero euros. Neon: ≤56 filas por plan (**estimado**). Medir B con
  `bench-models.mjs` cuesta llamadas, con el número que decida el owner.
- **Decisiones del owner.**
  - La lista: ¿queso sí, aceite no?
  - Los umbrales: ~700 para A y ~850 para C.
  - Raciones como preferencia (recomendado) o como límite duro.
  - Los techos de D.

## Riesgos

1. **Alergia.** Mitigación: los acompañamientos están dentro de `meal.ingredients`, y el
   mismo `dishSafety` los para antes de guardar.
   - Tests: leche, frutos de cáscara, gluten y trazas de sésamo en el pan de semillas.
   - Revisión de `invariant-reviewer`.
2. **Kosher por comida.** `breaksDishRule` sobre el conjunto, con su test.
3. **Privacidad.** A es solo código. B cambia el texto fijo del prompt, no lo que el prompt
   lleva de la persona. El consentimiento sigue siendo cierto.
4. **±5 %.** Más palancas deberían ayudar (**estimado**), pero:
   - las raciones son discretas (30 g de nueces son 196 kcal y 20 g de grasa);
   - la preferencia de raciones resta tamaños.

   Se para si un perfil pierde más de un día dentro de banda frente a la base (`--compare`).
5. **Tiempo de función.** Si una quincena pasa de ~60 s, se baja K.
6. **Despliegue.** La API vieja escribe comidas sin acompañamientos, y siguen siendo
   coherentes. Marcha atrás: apagar el flag.

## Coste y esfuerzo

Días de agente (**estimado**). Lo que más los mueve son las rondas del evaluador.

| Pieza | Esfuerzo |
|---|---|
| Fase 0 | 0,5 días, más 15 min del owner |
| C | 1 día |
| D | 1 día |
| A, dominio | 2–3 días |
| A, persistencia, API y web (`/team`) | 3–4 días |
| B | 0,5–1 día |

## Plan

| Fase | Entrega | Éxito | Parar si |
|---|---|---|---|
| 0 | Fusionar 014. El evaluador mide: raciones por franja (histograma); gramos del plato y de la comida; gramos por grupo; tiempo por perfil. Correr `simulate-pro.mjs` | Base medida de `imc-alto-2-comidas` | 014 ya da ≥13/14 días y raciones ≤1,5: A baja de prioridad |
| 1 | C | Aviso visto a 320, 390 y 1280 px | — |
| 2 | D | Ningún alimento pasa su techo | Se pierde más de un día |
| 3 | A en el dominio, con el flag apagado | Con el flag encendido en el evaluador: días ≥ base; ≥80 % de raciones principales en 0,75–1,5; plato ≤750 g; % de comidas con 0, 1 o 2 acompañamientos y su parte de kcal; cero alérgenos | Se pierde un día, o la quincena pasa de ~60 s |
| 4 | A completa, y se enciende el flag | El owner lo ve en su iPhone | Cualquier fallo de alergia o kosher |
| 5 | B | Platos nuevos de 500–650 kcal por ración | Suben los `oversized` o `unwanted` |

C y D salen solas. A solo da valor tras la fase 4.

## Qué no sé

- **014 en el perfil de dos comidas**: **desconocido**. Lo tienen el paso 5 de 014 y
  `simulate-pro.mjs`, en manos del lead.
- **Las kcal por ración en producción**: **desconocido**. En dev, el 95 % de las comidas
  están por debajo de ~870 (`0070`).
- **El tiempo con K = 6**: solo aritmética.
- **Si la persona quiere pan y fruta a diario** o prefiere «sin pan»: lo dirá el owner al
  usarlo.
