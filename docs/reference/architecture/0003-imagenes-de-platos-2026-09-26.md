# 0003 — Imágenes realistas de cada plato: impacto, modelos, coste y viabilidad

> **Purpose**: respuesta del agente `architect` a la pregunta del owner del 2026-09-26:
> «El próximo proyecto que quiero hacer es la generación de imágenes para cada plato. Haz
> primero un análisis del impacto de esto, de los mejores modelos y más baratos de
> OpenRouter, para generar imágenes súper realistas, que parezcan de verdad y se ciñan
> 100% a la receta, sin que salgan ingredientes que no estén en la receta, ni que los
> platos parezcan plástico o esté difuminado o algo. Haz primero un análisis y la
> viabilidad de esto.» Parte de lo que ya existe (la función está construida y apagada),
> compara los modelos de imagen que cumplen la regla de no entrenamiento, cuenta lo que
> costaría y propone un piloto pagado antes de construir nada.
> **Audience**: el owner y los agentes. **Committed**: sí. **Maintained by**: el agente
> `architect`; una vez fusionado no se edita — una revisión posterior es un informe nuevo.
>
> Base: rama `rewrite-missing-cues` en `e036082` (sobre `main` en `cd7e277`, #121).
> Cada número lleva etiqueta: **medido** (dónde), **estimado** (con la hipótesis) o
> **desconocido**. Los precios y listas leídos de una API o página pública cuentan como
> **medidos** en esa fuente y a esa hora. Durante el informe **no se hizo ninguna llamada
> a modelo, no se gastó nada y no se escribió en ninguna base de datos**: se leyó la API
> pública de OpenRouter (`/api/v1/models?output_modalities=image`, `/api/v1/models`,
> `/api/v1/models/{id}/endpoints`, `/api/v1/images/models`,
> `/api/v1/images/models/{id}/endpoints`, `/api/v1/endpoints/zdr`) el 2026-09-26 entre
> las ~17:20 y las ~17:45 UTC, las páginas fechadas en [Fuentes](#fuentes), y la base de
> datos de **desarrollo** (`Nutria-E2E`) en solo lectura, con los hosts comparados contra
> producción por `.claude/skills/local-probe/scripts/guard.mjs` (ninguna URL impresa).
> Producción no se tocó: lo que se dice de ella viene de `docs/` y de la memoria del
> proyecto. Precios en dólares, como los publican; 1 $ ≈ 0,85–0,95 € (**estimado**).

## 1. Veredicto

**Sí, con condiciones. Es viable técnica y legalmente, y la mitad está construida; lo que
decide es el dinero y la política de cuándo se dibuja, no la tecnología.**

Las condiciones:

1. Solo modelos con endpoint ZDR, por una **clave de OpenRouter aparte** con tope mensual,
   y `provider.only` limitado a esos endpoints en cada petición (§ 5.3).
2. Las imágenes **fuera de Postgres**, en Vercel Blob (§ 7.1).
3. Un **juez de visión y reglas en código** que rechazan; tres intentos y, si no pasa,
   sin imagen (§ 6).
4. El **rótulo** de imagen generada, con la marca legible por máquina que diga `legal`
   (§ 9).
5. El owner elige **política y tope de gasto** (§ 5.4), sabiendo lo que cuesta por plan.
6. Un **piloto de ≤ 5 $** que confirme modelo, tasa de acierto y juez antes de construir
   (§ 13, fase 1).

- **Ya existe, apagado.** La decisión [`0010`](../../decisions/0010-illustrate-recipes-not-photograph-them.md)
  (2026-09-08) construyó un ilustrador por receta (`RecipeIllustrator`), una tabla
  `recipe_images`, una ruta pública `/recipes/:id/image` y las miniaturas en la web. Está
  apagado (`AI_ILLUSTRATIONS=false`) y solo sabe llamar a Gemini directo, que la regla de
  no entrenamiento dejó fuera. El proyecto es una **v2** de eso, y necesita una decisión
  nueva que sustituya a `0010` en tres puntos: **dónde se guarda** (fuera de Postgres),
  **quién dibuja** (OpenRouter solo con endpoints ZDR) y **qué se promete** (foto realista
  etiquetada como generada, no «ilustración»).
- **Lo que tiene que decidir el owner es el coste por plan.** Hoy un plan nuevo mete
  **16–18 platos nuevos** en la biblioteca (**medido**, dev, las dos generaciones reales
  del 2026-09-26) y el texto de esa generación cuesta **0,007–0,0095 $** (**medido**, mismo
  sitio, Gemma 4 31B). Dibujar esos platos cuesta **~0,70–1,10 $ por plan** con el modelo
  recomendado (**estimado**, § 12): **unas cien veces el texto del plan en la ruta de
  hoy**, y para siempre, porque
  [`0013`](../../decisions/0013-a-third-of-every-plan-is-fresh.md) obliga a que un tercio
  de cada plan sea nuevo. (Contra la estimación de `0064`, 0,10–0,15 $ por plan con
  DeepSeek, serían unas diez veces; los 0,007–0,0095 $ medidos son de Gemma 4 31B, la ruta
  actual.) A 50 planes al mes son **~38–55 $/mes**; a 20, **~15–22 $/mes**.
  Hay tres palancas (§ 5.4): dibujar todo lo nuevo, dibujar al abrir el detalle, o dibujar
  solo lo que se reutiliza. Es decisión suya.
- **Modelo principal (hipótesis hasta el piloto): `microsoft/mai-image-2.6`**, servido por
  Azure en un endpoint ZDR, **0,039 $ por imagen** de ~1 MP (**medido**, OpenRouter +
  Artificial Analysis). Es el modelo **mejor puntuado en fotorrealismo que cumple la
  regla**: 4.º en la categoría «Photorealistic & Cinematic» de LMArena (1331 ± 9, 6.713
  votos, 2026-09-24). **Respaldo: `google/gemini-3.1-flash-lite-image`** (Nano Banana 2
  Lite) por Google Vertex, ZDR, **0,034 $**: otra empresa, 13.º en la misma tabla, marca de
  agua SynthID, y de la familia que mejor sigue instrucciones. Coste efectivo con
  reintentos y juez: **~0,05–0,07 $ por imagen aceptada** (**estimado**).
- **Los tres mejores del mercado quedan fuera por la regla**: `gpt-image-2`/`2.5` de
  OpenAI, `grok-imagine-image-2.0` de xAI y `muse-image` de Meta (7.º en foto por 0,01 $)
  **no tienen ningún endpoint ZDR** en OpenRouter (**medido**). Tampoco FLUX.2 ni Qwen
  Image 3. La regla del owner se mantiene; su precio está en § 5.2.
- **«100 % ceñido a la receta» no lo puede garantizar nadie.** Lo que sí se puede
  construir: un prompt hecho en código desde la receta, un **juez de visión** (también ZDR)
  que dice qué ve, y **código que decide**: una imagen con un alimento que la receta no
  tiene, o sin su ingrediente principal, o con aspecto de plástico o desenfocada, se
  rechaza; tres intentos y, si no pasa, **ninguna imagen** antes que una equivocada. El
  resultado es una tasa de acierto **medida**, no una promesa.
- **Las imágenes no pueden vivir en Postgres.** Neon gratis tiene **0,5 GB de
  almacenamiento por proyecto y al pasarse bloquea las escrituras** (**medido**, página de
  precios de Neon): con ~1.500 fotos a 100–180 KB (150–270 MB) y ~2 MB más por plan, en
  pocos meses **los planes dejarían de guardarse**. Van a **Vercel Blob** (el owner ya
  está en Vercel Pro desde el 2026-09-26): mismo proveedor que ya aloja la app, coste
  **~0 $** a este volumen (**estimado**, dentro del crédito del Pro).
- **Antes de construir: un piloto de ≤ 5 $.** 20 platos variados × 3 modelos (MAI 2.6,
  Seedream 5.0 Pro, Nano Banana 2 Lite), con el juez, en un script que se niega a tocar
  producción y se para al llegar al tope. El owner puntúa las 60 fotos en su iPhone
  (~1–2 h). El piloto decide el modelo, mide la tasa de acierto real y si el juez acierta
  lo mismo que él. **No se gasta nada sin su sí.**

## 2. Premisas revisadas

| # | Premisa | Estado | Evidencia |
| --- | --- | --- | --- |
| P1 | «Es un proyecto nuevo: generar una imagen por plato» | **incorrecta** | Existe desde `0010`: `RecipeIllustrator` (`apps/api/src/modules/ai/services/RecipeIllustrator.service.ts:48`), `recipe_images` (`packages/database/src/schemas/recipe.schema.ts:119`), `GET /recipes/:id/image` (`apps/api/src/modules/recipes/controllers/Recipes.controller.ts:28-43`), `GET /cron/illustrate` (`Cron.controller.ts:46`), y la web ya pinta `illustrationPath` en `MealRow`, `NextMeal` y `plan/comida/[id]`. Apagado por `AI_ILLUSTRATIONS=false` (`apps/api/src/config/Env.validation.ts:226`). El proyecto es una v2. |
| P2 | «Hay modelos buenos y baratos en OpenRouter para esto» | **confirmada, con recorte** | 57 modelos con salida de imagen (**medido**). Solo 20 tienen algún endpoint ZDR, y de los útiles para foto quedan: MAI (Azure), Gemini imagen (solo por Vertex), Seedream (Seed) y Krea 2 (Krea). § 5.1. |
| P3 | «Se puede conseguir que se ciña 100 % a la receta» | **incorrecta como garantía** | Ningún modelo de imagen publica una tasa de fidelidad a listas de ingredientes; los rankings públicos miden preferencia de votantes, no fidelidad (§ 5.1). Con prompt + juez + reintentos se obtiene una tasa **medible**; el piloto la mide. § 6. |
| P4 | «Que no parezcan plástico ni estén difuminados» | **confirmada como objetivo, con una causa propia** | El prompt de hoy **pide** el desenfoque: «shallow depth of field» (`RecipeIllustrator.service.ts:111`). Y las guarda a 960 px de ancho (`:28`), menos que los 1.170 px físicos de un iPhone a pantalla completa (390 pt × 3). Las dos cosas se corrigen en código. El aspecto «plástico» depende del modelo: es lo que el ranking de fotorrealismo sí mide. |
| P5 | (del encargo del lead) «Vercel hobby» | **incorrecta** | Vercel **Pro** desde el 2026-09-26 (memoria del proyecto, `vercel-neon-access-rules`). Cambia dos cosas: los crons pueden correr más de una vez al día y Blob se paga del crédito del Pro. |
| P6 | (del encargo) «nunca guardar imágenes en Postgres» | **confirmada, con la razón correcta** | `0010` eligió guardarlas en Postgres «para unos pocos megabytes». La razón para sacarlas no es la transferencia (que a este volumen es pequeña, § 7.1) sino el **almacenamiento**: 0,5 GB por proyecto, y pasarse **bloquea escrituras** (Neon, 2026-09-26). La base de dev pesa hoy **23 MB** (**medido**, `pg_database_size`). |
| P7 | (del encargo) «producción ≈ 500 platos del seed» | **incorrecta / desconocida** | Producción tenía **778 recetas** con método el 2026-09-12 (**medido** por otro agente, `docs/decisions/LOG.md:91`). Si el seed de 500 se cargó después es **desconocido** (`docs/reference/architecture/0001` § 9 ya lo dejó abierto). Rango de trabajo: **800–1.500** (**estimado**). |
| P8 | (del encargo) «haría falta un job/sweep nuevo» | **incorrecta** | Existe `GET /cron/illustrate` (6 imágenes por llamada, `Cron.controller.ts:13`) y un dibujo tras cada plan (8, `PlanJobRunner.service.ts:29,115-117`). Pero el cron **no está programado**: `apps/api/vercel.json:26-35` solo tiene `rewrite-steps` y `reminders`, mientras `apps/api/AGENTS.md:244-245` dice que corre «cada diez minutos». Es una desviación del doc. |
| P9 | «Las recetas son compartidas: una imagen por receta sirve a todos» | **confirmada** | `recipes` es compartida (`recipe.schema.ts:11-16`); `recipe_images` tiene `recipe_id` como clave primaria (`:125-127`). El coste escala con platos distintos, no con usuarios. Las recetas están atadas a un idioma (`locale`), así que un plato en inglés es otra receta y otra imagen. |
| P10 | «El prompt es una receta, no datos personales» | **confirmada** | El ilustrador lee nombre, idioma e ingredientes (`packages/core/src/repositories/Recipe/RecipeRepository.ts:330-362`), nunca `createdBy`. Vive en `modules/ai`, que el test de frontera de salud escanea (`apps/api/src/modules/ai/health-boundary.spec.ts`; `docs/ARCHITECTURE.md` «The boundary is mechanical»). La regla del owner sigue aplicando (§ 5.3). |
| P11 | «Las imágenes, en WebP/AVIF, con `next/image`» | **incorrecta en la segunda mitad** | La web usa `<img>` a propósito: «next/image would add an optimiser hop and per-image billing for nothing» (`apps/web/src/components/MealRow/MealRow.tsx:75`). Lo correcto es generar las variantes al escribir (§ 7.2), no al servir. |
| P12 | «Se puede exigir la regla de no entrenamiento en cada petición, como en el texto» | **incorrecta en la ruta de imágenes** | La API dedicada `/api/v1/images` acepta en `provider` solo `allow_fallbacks`, `ignore`, `only`, `options`, `order` y `sort` (**medido**, su esquema OpenAPI): **no** `zdr`, `data_collection` ni `require_parameters`. La tercera capa de `0064` (`NO_TRAINING_PROVIDER`, `apps/api/src/modules/ai/ai.config.ts:200`) no se puede mandar ahí. Sustituto en § 5.3. |
| P13 | «Se escribe igual que el texto: `generateImage` del SDK» | **hipótesis a comprobar** | El proveedor OpenAI-compatible del SDK instalado publica en `/images/generations` (`@ai-sdk/openai-compatible@3.0.52`, `dist/index.js:1781`); OpenRouter documenta `/api/v1/images`. Si OpenRouter acepta el alias es **desconocido**. Recomendación: un cliente propio con `fetch` detrás de la abstracción `ImageClient` que ya existe. |

## 3. Qué hay hoy

### 3.1 El ilustrador de `0010`

- **Quién dibuja.** `resolveImageModel` (`apps/api/src/modules/ai/ai.config.ts:356-362`)
  devuelve `gemini-2.5-flash-image` por la API de Google **solo** si
  `AI_PROVIDER=google` y `AI_ILLUSTRATIONS=true`; con `openrouter` (producción desde
  `0064`) devuelve `null` y el barrido no hace nada. Esa rama de Google es la ruta que la
  regla del owner cerró (`0064`, alternativas): debe desaparecer, no reactivarse.
- **Qué pide.** `illustrationPrompt` (`RecipeIllustrator.service.ts:105-117`): una foto
  cenital de «home cooking» con el nombre del plato, «Visible ingredients: » y los
  primeros 8 nombres, mesa de madera o lino, luz natural, **«shallow depth of field»**, sin
  texto, personas ni manos. Versión `1.0.0` (`:25`).
- **Cuatro defectos para lo que pide el owner**, todos de código:
  1. Los nombres de ingredientes salen **sin orden** (`RecipeRepository.ts:347-356`, no hay
     `ORDER BY`) y se cortan a 8 (`slice(0, 8)`, `:106`). Las recetas tienen mediana 7,
     p90 11 y máximo 15 ingredientes (**medido**, dev): en las grandes, el corte puede
     dejar fuera el pollo y dejar la sal.
  2. Pone como **visibles** el aceite, la sal, las especias y el caldo: es la receta para
     que el modelo pinte una aceitera, un salero o un ramillete que el plato no lleva.
  3. Pide **desenfoque** («shallow depth of field»), justo lo que el owner no quiere.
  4. Mezcla idiomas: el prompt es inglés y los nombres van en el idioma de la receta. El
     catálogo tiene nombre inglés para **930 de 930** ingredientes (**medido**, dev,
     `ingredient_names` con `locale='en-GB'`), así que el prompt puede ir entero en inglés.
- **Cómo se guarda.** `sharp` a WebP de 960 px de ancho, calidad 78
  (`RecipeIllustrator.service.ts:28-29, 87`), en `recipe_images.bytes` (`bytea`)
  (`recipe.schema.ts:119-130`), una fila por receta, con `model` y `prompt_version`.
  `recipes.image_url` (`recipe.schema.ts:26`) existe y **nadie la usa** (grep en `apps` y
  `packages/*/src`).
- **Cuándo.** Tras cada plan, 8 imágenes en segundo plano con `waitUntil`
  (`PlanJobRunner.service.ts:113-117`), dentro de la **misma** invocación de 300 s que ya
  gastó hasta ~170 s generando (`AI_BUDGET_SECONDS`, `Env.validation.ts:213`); y 6 por
  llamada a `/cron/illustrate`, que no está programada (P8).
- **Cómo se sirve.** `GET /recipes/:id/image`, pública, `Cache-Control: public,
  max-age=31536000, s-maxage=31536000, immutable` (`Recipes.controller.ts:13, 40`). La web
  la pide a través de su propio rewrite `/api/v1/*` (`apps/web/next.config.js:14-25`), y
  la API la lee de Neon. La caché del CDN de Vercel lleva en su clave **la URL única del
  despliegue** (Vercel, «Purging Vercel CDN Cache», 2026-09-03): cada despliegue de la
  API o de la web empieza con la caché vacía. La del iPhone sí dura (es `immutable`).
- **Qué hay en dev.** 3 filas en `recipe_images`, 960×720, **37,9 KB** de media, modelo
  `aihorde/Juggernaut XL`, versión de prompt `2.2.1` (**medido**): no las produjo el
  código actual (que escribe `1.0.0`) y ningún fichero del repositorio nombra ese modelo.
  Son un artefacto de dev a borrar antes de migrar. En producción, cuántas hay es
  **desconocido** (el panel `/admin` lo muestra como «{count} sin ilustrar»,
  `packages/core/src/repositories/Admin/AdminRepository.ts:79-98`).

### 3.2 La web

- Detalle de comida: `<figure>` con `<img alt={meal.name}>` a todo el ancho, 4:3, y el
  pie «Ilustración generada por IA» (`apps/web/src/app/(app)/plan/comida/[id]/page.tsx:124-134`;
  `apps/web/src/i18n/dictionaries/es-ES.ts:741`).
- Fila de comida: miniatura 4:3 de **3,5 rem** (56 px CSS, 168 px físicos en iPhone),
  `alt=""`, `loading="lazy"`, **sin etiqueta** (`MealRow.tsx:74-76`; `MealRow.module.css:90-96`).
- Próxima comida: imagen a todo el ancho recortada a **16:7**, `alt=""`, **sin etiqueta**
  (`apps/web/src/components/NextMeal/NextMeal.tsx:57-58`; `NextMeal.module.css:52-58`).
- Las tres pantallas reciben **el mismo fichero** de 960×720: la miniatura de 56 px
  descarga lo mismo que la imagen grande.
- `0010` prometía que «a screen that shows the image without it does not compile»: las
  dos miniaturas la muestran sin el rótulo. Con fotos realistas esto importa más (§ 9).
- La maquetación la está llevando el agente `frontend` en paralelo; este informe solo le
  ha enviado qué tamaños y proporciones esperar (§ 7.3).

### 3.3 Volumen

| Qué | Valor | Etiqueta |
| --- | --- | --- |
| Recetas en dev | 1.321 (500 `seed` + 777 `ai` es-ES + 44 `ai` en-GB) | medido, dev |
| Recetas de dev servidas en algún plan | 637 (167 seed + 470 ai) | medido, dev |
| … en un solo plan / en ≥ 2 planes | 235 / 402 | medido, dev (con muchos planes de test: orientativo) |
| Recetas en producción | ≥ 778 el 2026-09-12; hoy 800–1.500 | medido (`LOG.md:91`) / estimado |
| Platos nuevos que deja un plan real | 16–18 aceptados por el modelo; se guardan solo los usados (`PlanGeneration.service.ts:578`) | medido, dev, 2 planes del 2026-09-26 |
| Coste del texto de ese plan | 0,0072–0,0095 $ (8–9 llamadas, Gemma 4 31B por DeepInfra/CoreWeave) | medido, dev |
| Recetas distintas por plan | mediana 35, p90 42, máx. 54 | medido, dev |
| Planes al mes en producción | — | desconocido (escenarios de 20, 50 y 500) |
| Qué parte de las comidas se abre en detalle | — | desconocido: no hay evento que lo registre (`packages/core/src/entities/Analytics/Analytics.ts:14-29` solo tiene `ai_call`, `session_started`, `swap_requested`) |

Algunas recetas de dev tienen nombres de test («Avena con yogur hc93.1.1»): el piloto
debe elegir platos reales, no esos.

## 4. Propuesta

**Una v2 del ilustrador de `0010`, no un sistema nuevo.** Se conserva lo que está bien
(una imagen por receta, compartida; después del plan y nunca antes; apagable con una
variable; el rótulo) y se cambian cuatro piezas:

- **Quién dibuja**: OpenRouter, solo endpoints ZDR, clave propia con tope; principal
  MAI-Image-2.6, respaldo NB2 Lite, a confirmar por el piloto (§ 5).
- **Qué se le pide**: un prompt construido en código desde la receta, en inglés, con lo
  visible ordenado por gramos y sin desenfoque (§ 6.1).
- **Quién decide si vale**: un juez de visión ZDR describe; reglas en código aceptan o
  rechazan; tres intentos o nada (§ 6.2).
- **Dónde vive**: Vercel Blob, dos tamaños hechos al escribir, servidos sin función ni
  Neon (§ 7).
- **Cuándo**: solo por cron con límite de tiempo, no dentro de la invocación del plan
  (§ 8).

Alternativas descartadas, con la razón que las tumbó:

| Alternativa | Por qué no |
| --- | --- |
| Reactivar Gemini directo (lo que ya está escrito) | La regla y las condiciones de la API de Google cerraron esa ruta (`0064`); AI Studio no es ZDR |
| `muse-image`, `gpt-image-2`/`2.5`, `grok-imagine`, FLUX.2, Qwen Image 3 | Ningún endpoint ZDR en OpenRouter (§ 5.1) |
| NB2 (Gemini 3.1 Flash Image) como principal | El doble que NB2 Lite por 7 puntos de ranking; queda como opción si el piloto muestra que su fidelidad lo paga |
| Seguir en `bytea` en Neon | 0,5 GB por proyecto y pasarse bloquea las escrituras (§ 7.1) |
| Cloudflare R2 | Otra cuenta y otro proveedor que ve IP de usuarios, para ahorrar céntimos que Blob no cobra a este volumen |
| `next/image` | Optimiza al servir y factura por transformación; las variantes hechas al escribir cuestan cero por vista |
| Dibujar tras cada plan en la misma invocación | Con juez y reintentos no cabe en los 300 s que el plan ya usa en parte |
| Brief visual con el modelo de texto desde el primer día | Coste y una pieza más antes de ver si hacen falta; se añade si el piloto muestra errores de forma |
| Revisión manual de cada foto por el owner | No escala más allá del piloto; queda para las rechazadas |

## 5. Los modelos

### 5.1 Candidatos con salida de imagen en OpenRouter

**Cómo se pasa del precio publicado a «$ por imagen».** OpenRouter publica tres unidades
(`/api/v1/images/models/{id}/endpoints`, campo `pricing`, **medido**):

- **Por imagen** (Seedream, Qwen): el precio es el de la imagen. En `/api/v1/models`
  aparece dividido entre 4.175 «tokens»: su propia documentación da el ejemplo de
  `completion_tokens: 4175` → `cost: 0.04`. Así, 0,0000095808 × 4.175 = 0,04 $.
- **Por megapíxel** (FLUX.2): 0,03 $/MP en `flux.2-pro`, que en `/api/v1/models` es
  0,00000732421875 × 4.096 tokens/MP.
- **Por token de salida** (Gemini, MAI, OpenAI): precio × tokens que ocupa una imagen.
  Gemini: 1K = **1.120 tokens**, 512 px = 747, 2K = 1.680 (`gemini-3.1-flash-image`);
  1K/2K = 1.120 (`gemini-3-pro-image`); 1.290 (`gemini-2.5-flash-image`) — tabla de
  precios de Google. MAI: Microsoft no lo publica en lo leído; **~1.024 tokens** sale de
  dividir el precio por imagen de Artificial Analysis (38,9 $/1.000 imágenes) entre el de
  OpenRouter (0,000038 $/token). La conversión se comprobó en las dos direcciones: NB2
  Lite da 0,00003 × 1.120 = 0,0336 $ y Artificial Analysis lista 33,6 $/1.000.

Todo a ~1 MP (1K), que es lo que hace falta: la foto grande del detalle ocupa 1.170 px
físicos en un iPhone.

**Calidad.** No existe un ranking público de «comida» ni de «fidelidad a una lista de
ingredientes». Lo más cercano: la categoría **«Photorealistic & Cinematic Imagery»** de
LMArena (votos humanos a ciegas, actualizada el 2026-09-24) y el ranking general de
Artificial Analysis (ELO de votos). Miden **preferencia**, no fidelidad: por eso el
piloto mide la fidelidad. Las cifras de ranking se leyeron con un resumidor web; las del
top 20 vienen con votos, las de puestos 20–60 están marcadas «no verificado».

| Modelo | ¿Endpoint ZDR? | $/imagen ~1 MP | LMArena foto (puesto, puntos, votos) | AA ELO | Nota |
| --- | --- | --- | --- | --- | --- |
| `microsoft/mai-image-2.6` | **sí** (Azure) | **0,039** | **#4**, 1331 ± 9, 6.713 | 1148 | El mejor en foto que cumple la regla |
| `microsoft/mai-image-2.6-flash` | **sí** (Azure) | **0,0195** | fuera del top 20 | 1102 | El barato serio |
| `microsoft/mai-image-2.5` | sí (Azure) | 0,048 | #14, 1252 ± 6, 23.780 | 1102 | Superado por 2.6 |
| `microsoft/mai-image-2.5-pro` | sí (Azure) | 0,109 | — | 1100 | Caro sin ventaja |
| `bytedance-seed/seedream-5-0-pro` | **sí** (Seed) | **0,045** (1K); 0,09 alta resolución | **#8**, 1280 ± 6, 33.043 | 1078 | Otra empresa, buena foto |
| `bytedance-seed/seedream-5-0-lite` | sí (Seed) | 0,035, solo 2K/4K | ~#30, 1157 (no verificado) | — | |
| `bytedance-seed/seedream-4.5` | sí (Seed) | 0,040 | — | 1021 | |
| `google/gemini-3.1-flash-image` (Nano Banana 2) | **solo por Vertex** | **0,067** (1K) | #10, 1267 ± 6, 21.007 | 1123 | Sigue instrucciones; SynthID; edita imágenes |
| `google/gemini-3.1-flash-lite-image` (NB2 Lite) | **solo por Vertex** | **0,034** (solo 1K) | #13, 1260 ± 8, 7.464 | 1093 | Casi NB2 a mitad de precio; SynthID |
| `google/gemini-3-pro-image` | solo por Vertex | 0,134 | #12, 1261 ± 4, 71.487 | 1101 | Caro sin ventaja en foto |
| `google/gemini-2.5-flash-image` | solo por Vertex | 0,039 | ~#29, 1157 (no verificado) | — | El de `0010`; superado |
| `krea/krea-2-large` / `-medium` / `-medium-turbo` | sí (Krea) | 0,06 / 0,03 / 0,015 (derivado; la API de imágenes no da precio) | ~#42–47 (no verificado) | 1025 / — / 1018 | Por detrás en foto |
| `openai/gpt-image-2`, `gpt-image-2.5-*` | **no** | ~0,21 en alta (AA) | #1–#3 | 1171–1196 | Fuera por la regla |
| `x-ai/grok-imagine-image-2.0` | **no** | ~0,04–0,06 | #5 | 1157 | Fuera |
| `meta/muse-image` | **no** | **0,010** | #7, 1286 ± 7 | 1111 | Fuera — el que más duele |
| `black-forest-labs/flux.2-pro/-max/-flex/-klein-4b` | **no** | 0,03 / 0,07 / 0,06 / 0,014 por MP | ~#32–38 (no verificado) | 1021–1026 | Fuera |
| `qwen/qwen-image-3-pro`, `qwen-image-3` | **no** | 0,04 / 0,03 | #11 | 1088 / 1074 | Fuera |
| Recraft, Riverflow, Ming | no / diseño | — | — | — | Diseño o vector, no foto |

Gemini por **AI Studio** no es ZDR; por **Vertex** (`google-vertex/global`) sí
(**medido**, `/api/v1/endpoints/zdr`): la petición tiene que fijar Vertex.

**Opinión (etiquetada como tal).** Para comida realista y fiel, los modelos «de familia
LLM» (Gemini, y por lo publicado los MAI) siguen instrucciones negativas («nada más en el
plato») mejor que los de difusión clásica, que tienden a añadir perejil, limón o semillas
de adorno y a veces pintan justo lo que se les prohíbe. No hay dato público que lo
demuestre para comida; es lo primero que el piloto tiene que confirmar o tumbar.

### 5.2 El precio de la regla

Sin la regla, la mejor relación sería `meta/muse-image`: 7.º en foto por **0,010 $**,
un cuarto de MAI 2.6. Y la mejor calidad absoluta, `gpt-image-2`, a ~0,21 $ en alta.
Con la regla, el suelo realista es **~0,034–0,039 $** por imagen: **~3–4× muse-image**.
En 1.000 imágenes, ~25–30 $ de diferencia. La regla se mantiene; esto solo dice lo que
cuesta.

### 5.3 Cómo se cumple la regla en la ruta de imágenes

- **El contenido no es personal**: nombre del plato, ingredientes, gramos, método. Nada de
  la persona entra (P10). Eso hace que el RGPD apenas toque a esta llamada, pero la regla
  del owner es más ancha («ningún proveedor entrena con lo que NutrIA envía») y la
  política de privacidad la promete. **Se aplica igual.**
- **Tercera capa de `0064`, sustituida.** Como `/api/v1/images` no acepta `zdr` ni
  `data_collection` (P12), cada petición lleva `provider: { only: [<slugs ZDR del
  modelo>], allow_fallbacks: false }`: `azure` para MAI, `google-vertex/global` para
  Gemini, `seed` para Seedream. Para esos modelos, esos son **los únicos** endpoints ZDR
  (**medido**). El esquema dice que `only` «se fusiona» con la lista de la cuenta: si es
  unión o intersección es **ambiguo** → **hipótesis**; la primera llamada del piloto lo
  resuelve mirando qué proveedor respondió.
- **Primera capa**: la cuenta de OpenRouter ya tiene entrenamiento apagado y ZDR
  obligatorio (`0064` § 3). Si esa obligación se aplica también a `/images` es
  **hipótesis**; la tercera capa sustituta cubre el caso de que no.
- **Segunda capa: una clave aparte para imágenes**, con su guardarraíl: solo el modelo
  principal, el de respaldo y el juez, ZDR, y un **tope mensual** propio (p. ej. 10–30 $).
  Así un error en el barrido de imágenes no puede gastarse el presupuesto de los planes, y
  la lista de proveedores de texto (`AI_PROVIDER_ONLY` = DeepInfra, CoreWeave) no se toca.
- **Cliente propio.** El SDK publica en `/images/generations` (P13); un
  `OpenRouterImageClient` con `fetch` detrás de `ImageClient`
  (`apps/api/src/modules/ai/clients/ImageClient.ts:10`) controla el cuerpo entero, como
  `openRouterRequest` hace con el texto, y registra `usage.cost` de la respuesta
  (la facturación de imágenes es «todo o nada»: una fallida no se cobra, documentación de
  OpenRouter).

### 5.4 Cuándo dibujar: la decisión de coste

Cada plan guarda los platos nuevos que usa, y todos se sirven al menos una vez. Tres
políticas:

| Política | Imágenes al mes | Ventaja | Pega |
| --- | --- | --- | --- |
| **A. Todo plato nuevo, al crearse** | ~15 × planes | Todas las comidas con foto en ~10–30 min | La más cara: ~100× el texto del plan |
| **B. Al abrir el detalle por primera vez** | fracción **desconocida** | Solo se paga lo que se mira | La primera vez se ve sin foto; las miniaturas del plan quedan vacías hasta entonces |
| **C. Solo lo que se reutiliza (≥ 2 planes)** | en dev, 63 % de las servidas (orientativo) | La biblioteca sale con foto; lo de un solo uso no se paga | Los platos frescos de cada plan salen sin foto |

Mi recomendación para la beta de amigos: **A con tope mensual** en la clave (el gasto
nunca pasa de lo que el owner fije; al llegar, las fotos esperan al mes siguiente), y
medir antes de crecer. Si el volumen sube, pasar a **C**, que convierte las fotos en un
atributo de la biblioteca y no de cada plan. También es una palanca de producto que el
owner puede usar más adelante (fotos como parte de Premium), pero eso es suyo.

## 6. Fidelidad a la receta

### 6.1 El prompt, construido en código

**El modelo propone, el código dispone**, como en todo NutrIA (`0004`):

1. **Qué se ve y qué no, decidido en código** desde la receta: los ingredientes
   ordenados por gramos, con su **nombre inglés** del catálogo. Los que no se ven en un
   plato terminado (aceite, sal, pimienta, especias, caldo, agua, vinagre, levadura…) van
   a una lista de «invisibles» y **no** se nombran como visibles. Los que están
   triturados o disueltos (cremas, batidos, salsas) se describen como tales («a smooth
   orange cream»), no como piezas.
2. **Proporciones aproximadas**: los gramos se traducen a parte del plato («the salmon
   takes about half the plate»). Los modelos no entienden gramos; la cantidad exacta
   **no** se puede garantizar, y la etiqueta lo dice («orientativa»).
3. **Forma y método**: del nombre y de los pasos (plancha, horno, guiso, crudo). Si el
   código no lo puede deducir con fiabilidad, un paso previo con el modelo de texto que ya
   se usa (Gemma 4 31B por DeepInfra, ~0,001 $) redacta un «brief» visual en JSON, y el
   código lo **lee de vuelta** contra la receta, igual que `methodMentions` hace con los
   métodos (`LOG.md:91`): un brief que nombra un alimento ajeno se rechaza. Recomiendo
   empezar sin este paso y añadirlo solo si el piloto muestra errores de forma.
4. **Texto**: «Only these foods are on the plate: …. Nothing else on the plate or on the
   table.» Una sola ración, un plato, encuadre centrado con margen (para que el recorte
   16:7 de `NextMeal` funcione), ángulo de 45° o cenital, luz de ventana, **todo enfocado**
   («sharp focus across the whole dish, no bokeh»), textura real de comida casera, sin
   texto, manos, personas ni logos. Sin «shallow depth of field».
5. **Negativos**: ningún endpoint de los candidatos expone `negative_prompt` (sus
   `supported_parameters`, **medido**). Van en el texto, formulados como «solo esto», no
   como lista de prohibidos: nombrarle «limón» a un modelo de difusión puede traer el
   limón. El piloto compara.
6. `ILLUSTRATION_PROMPT_VERSION` sube (a `2.0.0`) y se guarda con cada imagen, como ya se
   hace, para poder redibujar solo lo de un prompt viejo.

### 6.2 El juez automático

- **Modelo**: uno de visión servido **solo** por un endpoint ZDR. Tres opciones medidas en
  `/api/v1/endpoints/zdr`: `qwen/qwen3-vl-235b-a22b-instruct` por **DeepInfra**
  (0,20 / 0,88 $ por millón), `google/gemma-4-31b-it` por **DeepInfra** (0,09 / 0,34 $;
  el mismo modelo y proveedor que ya genera los platos) o `google/gemini-3.5-flash-lite`
  por Vertex (0,15 / 1,25 $). Por comprobación: **≤ 0,002 $** (**estimado**: ~1.300 tokens
  de imagen + 400 de texto, 300 de salida). Recomiendo Qwen3-VL 235B (más fuerte en
  reconocer cosas pequeñas) con Gemma 4 como alternativa barata; el piloto decide. Los
  dos por DeepInfra, que la política de privacidad ya nombra.
- **Qué contesta** (JSON con esquema): por cada ingrediente visible esperado, «se ve / no
  se ve / dudoso»; la lista de **alimentos que ve y no están en la lista**; objetos que no
  son comida (texto, manos, cubiertos de más, otros platos); fotorrealismo 1–5; nitidez
  1–5; «parece 3D/plástico» sí/no.
- **Qué decide el código** (umbrales en código, con tests):
  - **Rechazo duro** si aparece cualquier alimento que la receta no tiene y que es un
    portador de alérgeno (frutos secos, semillas, marisco, pescado, huevo, lácteo, pan o
    cereal con gluten, sésamo, apio, mostaza, soja…): una persona alérgica no debe ver
    nueces en la foto de un plato sin nueces, aunque la lista y la puerta de alérgenos
    sigan mandando.
  - Rechazo si aparece cualquier otro alimento extra, si falta el ingrediente principal
    (la proteína o el almidón de más peso) o falta más de uno de los visibles, si hay
    texto o manos, si fotorrealismo o nitidez < 4, o si «parece plástico».
- **Reintentos**: hasta **3 intentos por receta**. El 2.º lleva la corrección del juez
  («sin el limón», «que se vea el arroz»); el 3.º, otra semilla o el modelo de respaldo.
  Con Gemini existe una opción más barata para el 2.º: **editar** la imagen para quitar lo
  que sobra en vez de repetirla (acepta imagen de referencia, **medido** en sus
  `supported_parameters`); el piloto puede probarla.
- **Si no pasa**: **ninguna imagen**. La receta queda como «rechazada» con el motivo, sin
  guardar la foto mala, visible en `/admin`, y se puede reencolar. El plato se ve
  completo sin foto (lo que ya hace hoy).
- **Cuánto se puede fiar uno del juez**: los modelos de visión fallan con cosas pequeñas
  (menos del ~5 % de la imagen) y confunden parecidos (quinoa y cuscús, pavo y pollo). El
  piloto compara sus veredictos con los del owner en las 60 fotos. Umbral para darlo por
  bueno: **≥ 90 % de acuerdo** y **≤ 5 % de «el juez acepta, el owner rechaza»**. Si no
  llega, el juez sube de modelo o el owner revisa a mano la primera tanda.
- **Seguridad**: la foto **nunca** es la fuente de verdad de lo que hay en el plato. La
  lista de ingredientes y la puerta de alérgenos son código contra la base de datos
  (`0004`) y no dependen ni del dibujante ni del juez. Si el juez se equivoca, el daño es
  una foto engañosa con su etiqueta, no un alérgeno servido.

### 6.3 Qué fidelidad esperar

**Hipótesis** (la mide el piloto): 50–80 % de aciertos al primer intento, 85–95 % tras
tres, y un 5–15 % de recetas sin foto. Más difíciles: platos de muchos ingredientes, los
triturados y los que no tienen una forma reconocible. Más fáciles: una proteína, un
acompañamiento y una verdura.

## 7. Almacenamiento y entrega

### 7.1 Dónde

| Opción | Almacenamiento | Tráfico | Cuenta nueva | Riesgo | Veredicto |
| --- | --- | --- | --- | --- | --- |
| **Seguir en Neon (`bytea`)** | 0,5 GB **por proyecto**, al pasarse **bloquea escrituras** | 5 GB/mes compartidos con dev; cada fallo de caché es una lectura | no | Los **planes dejan de guardarse** | **No** |
| **Vercel Blob (público)** | Pro: de pago por uso, 0,023 $/GB-mes; Hobby: 1 GB gratis | Hobby 10 GB gratis; Pro de pago por uso con crédito | no (mismo Vercel) | Bajo | **Sí** |
| Cloudflare R2 | 10 GB gratis | Salida gratis | **sí**; si pide tarjeta, **desconocido** | Otro proveedor más que ve las IP de quien carga las fotos | Alternativa si Blob dejara de valer |

Números del caso Neon: 1.500 recetas × 100–180 KB (dos tamaños) = **150–270 MB**
(**estimado**; hoy las 3 de dev pesan 38 KB, pero son 960 px de otro modelo), el 30–54 %
del límite, más **1,5–2,7 MB por plan**. Con 50 planes al mes se llega al límite en
**4–8 meses**. La transferencia, en cambio, es pequeña hoy: 20 personas × ~35 fotos ×
2 quincenas × 100 KB ≈ **140 MB/mes** (**estimado**), ~3 % de 5 GB; con 500 personas
serían ~3,5 GB y rozaría el tope que suspende producción.

En Blob: 270 MB a 0,023 $/GB son **~0,01 $/mes**; operaciones y tráfico a este volumen,
**~0 $** dentro del crédito del Pro (**estimado**: el ejemplo de la página de precios
supone 5 GB, 100.000 operaciones simples y 100 GB de tráfico incluidos; la tabla dice
«usage-based» y no lo concreta). Crear el almacén (una operación) y poner la variable
`BLOB_READ_WRITE_TOKEN` en el proyecto de la API son **acciones del owner**.

### 7.2 Formato y tamaños

- **Generar a 1K, 4:3** (~1.184×864 en Gemini según la tabla de Google, no verificado
  aquí; los demás, parecido). Guardar dos
  variantes hechas con `sharp` al escribir: **~1.200 px de ancho** para el detalle
  (90–160 KB en WebP calidad ~80, **estimado**) y **~360 px** para miniaturas (12–20 KB,
  **estimado**). WebP basta: Safari lo lee desde iOS 14. AVIF ahorraría un 20–30 % más
  (**estimado**) a costa de otra variante; no hace falta para empezar.
- **Rutas inmutables por contenido** (`recipes/<id>/<hash>-1200.webp`), servidas
  directamente desde Blob: sin función y sin Neon. Que su caché no se vacíe con cada
  despliegue es **hipótesis** (el host de Blob no es una URL de despliegue, pero la página
  de precios no lo dice).
- **Marca legible por máquina**: al recodificar, `sharp` tira los metadatos (C2PA, EXIF).
  La marca de agua SynthID de Google va en los píxeles y sobrevive; lo que MAI lleve, no.
  `sharp` 0.35.4 tiene `withXmp` (`node_modules/.../sharp/lib/index.d.ts:747`): escribir
  en cada fichero el campo IPTC `DigitalSourceType = trainedAlgorithmicMedia` es la forma
  estándar de decir «generada por IA». Si eso basta para el art. 50.2 lo dice `legal`
  (§ 9).
- **Rendimiento en iPhone**: la foto del detalle es la candidata a LCP; con ancho y alto
  fijados (el CSS ya pone `aspect-ratio: 4 / 3`), sin `lazy` y con prioridad alta, ~100 KB
  por 4G son del orden de 0,2–0,4 s (**estimado**). Las miniaturas con `lazy`. Un día del
  plan con 5–6 miniaturas pasa de 240–720 KB (el fichero grande en cada una) a ~100 KB.

### 7.3 Lo que se le ha pasado a `frontend`

Enviado por mensaje: proporción 4:3 nativa con el plato centrado, las dos variantes y sus
anchos, que `illustrationPath` pasará a ser una URL absoluta de Blob (hoy la web hace
`${API_URL}${illustrationPath}`, `MealRow.tsx:76`), la prioridad del LCP, y que el rótulo
en miniaturas está pendiente de `legal`. La maquetación es suya.

## 8. Impacto en el código

| Capa | Qué cambia |
| --- | --- |
| `packages/database` | `recipe_images` deja de guardar bytes: `status` (`pending`, `ready`, `rejected`), claves o URL de las dos variantes, ancho y alto, `model`, `prompt_version`, `attempts`, `judge` (jsonb, el último veredicto), `cost_usd`, `recipe_fingerprint` (huella de ingredientes y gramos: si la receta cambia, se redibuja), `claimed_until` (como `steps_claimed_until`, para que dos barridos no dibujen lo mismo). Dos migraciones: primero añadir (columnas nulas), después quitar `bytes`. Borrar antes las 3 filas de dev. El owner corre `migrate` en producción tras cada fusión con migración (memoria del proyecto). `recipes.image_url` sin uso: quitarla o dejarla, pero no usar las dos. |
| `packages/core` | `RecipeRepository.findWithoutImage` (`:330`) → lo pendiente con ingredientes **ordenados por gramos**, slug, nombre inglés y clase de alimento; prioridad a lo servido en planes activos. `PlanRepository` (`:328-333`, `:460`) y `PlanController` (`:42`, `:210`, `:797`, `:900`) devuelven URL absoluta (grande y miniatura) solo con `status='ready'`. El comentario huérfano de `RecipeRepository.ts:279-283` va con la función a la que describe. |
| `apps/api` `modules/ai` | `OpenRouterImageClient` (fetch a `/api/v1/images`, `provider.only` ZDR, `allow_fallbacks:false`, clave aparte, secretos redactados, coste registrado). `ImageJudge` (visión, esquema JSON) y una función pura `acceptImage(verdict, recipe)` con los umbrales. `RecipeIllustrator` 2.0: brief → imagen → juez → reintentos → variantes con XMP → Blob → fila. Todo dentro de `modules/ai`, que el test de frontera de salud ya cubre. Borrar la rama de Google de `resolveImageModel` (`ai.config.ts:356-362`). |
| `apps/api` barrido | Límites por tiempo como `RewriteLimits` (carriles, no empezar una receta con menos de ~120 s, cortar a 240 s). **Quitar el dibujo tras el plan** de `PlanJobRunner` (`:113-117`): con juez y reintentos, 8 recetas pueden pasar de 100 s en una invocación que ya gastó ~170 s. Programar `/cron/illustrate` en `apps/api/vercel.json` cada 10–15 min (el Pro lo permite) y corregir `apps/api/AGENTS.md:244`. |
| `/admin` | Recuento de listas, pendientes y rechazadas; gasto del mes en imágenes desde `cost_usd` (en la línea de [`0035`](../../decisions/0035-the-panel-counts-our-own-calls.md)); reencolar una rechazada. |
| Ruta pública | `GET /recipes/:id/image` sobra con Blob; mantenerla un tiempo como redirección o quitarla con el cambio de contrato (`0039`: la ruta dice lo que devuelve; el OpenAPI cambia). |
| Variables | `AI_ILLUSTRATIONS` (ya existe), `AI_IMAGE_MODEL`, `AI_IMAGE_FALLBACK_MODEL`, `AI_IMAGE_PROVIDER_ONLY`, `AI_IMAGE_JUDGE_MODEL`, `OPENROUTER_IMAGES_API_KEY`, `BLOB_READ_WRITE_TOKEN`; todas en `Env.validation.ts` y en `turbo.json`. |
| `apps/web` | URL absoluta, dos tamaños (`srcset`), rótulo nuevo, alt del detalle = nombre del plato (ya lo es), miniaturas decorativas con `alt=""` (ya lo son). Es del agente `frontend`. |
| i18n | «Ilustración generada por IA» → texto nuevo que decida el owner con `legal` (p. ej. «Imagen generada por IA · orientativa»); la frase de `/privacidad` (`es-ES.ts:1364`) sigue siendo verdad («a partir solo del nombre y los ingredientes de la receta, sin ningún dato tuyo»). |
| Tests | Constructor del prompt (ningún alimento ajeno, orden por gramos, invisibles fuera), `acceptImage` (cada motivo de rechazo), que el cuerpo de la petición lleva solo proveedores ZDR, y el test de frontera de salud sin tocar. |
| Invariantes | Ningún dato personal entra: el prompt y el juez solo leen la receta. Nada de salud: el código vive en `modules/ai`. La seguridad no depende de la imagen. `invariant-reviewer` revisa la fase del ilustrador. |

## 9. Legal y producto (para `legal`, que es dueño de `docs/legal/`)

- **AI Act, art. 50.2** (marca legible por máquina del contenido sintético):
  `docs/legal/analisis.md:613-618` ya lo recoge para las ilustraciones, contando con
  SynthID de Google, con plazo **2/12/2026** para sistemas anteriores al 2/8/2026. Con MAI
  no hay SynthID y `sharp` borra los metadatos: propongo la marca IPTC por XMP (§ 7.2).
  **Pregunta para `legal`**: si basta, y si la v2 cuenta como sistema nuevo a efectos del
  plazo.
- **AI Act, art. 50.4 y 50.5** (ultrasuplantación; aviso «a más tardar en la primera
  exposición»): una foto realista de un plato que nadie cocinó «se parece a objetos
  existentes» y puede parecer auténtica. El rótulo visible del detalle cumple; las
  **miniaturas de `MealRow` y `NextMeal` se ven antes, sin rótulo**. **Pregunta para
  `legal`**: si hace falta una marca en la miniatura o basta un aviso en la pantalla del
  plan.
- **Consumo**: NutrIA no vende comida, así que el riesgo de publicidad engañosa es bajo;
  aun así, «orientativa» en el rótulo alinea la expectativa (la ración real no será
  idéntica). Y el principio de producto «Never fake it» (`docs/PRODUCT.md`, principio 3)
  y la frase de `0010` («an invented picture of it would be the most convincing lie on the
  page») piden que el rótulo no se pueda quitar. Con fotos realistas, eso pesa más.
- **Política de privacidad**: el texto sobre ilustraciones sigue siendo cierto. Lo nuevo
  es **quién** recibe la receta (Microsoft/Azure, Google/Vertex o ByteDance/Seed) y que
  Vercel sirve las imágenes. La lista cerrada de empresas de la política («DeepInfra o
  CoreWeave», `docs/legal/textos/02-politica-privacidad.md:129`, P1-12) habla de datos de
  la persona: **pregunta para `legal`** si un proveedor que solo recibe recetas tiene que
  nombrarse, y si las condiciones de uso de ese proveedor tienen alguna cláusula que
  moleste (la de «práctica clínica» de Gemini era de la API de Google, no de Vertex).
- **`analisis.md:137-138`** dice que las ilustraciones solo existen con
  `AI_PROVIDER=google`: dejará de ser verdad con la v2.

## 10. Requisitos

**Del owner**

- Sí al piloto (≤ 5 $) y, después, a la construcción.
- Una clave de OpenRouter solo para imágenes: modelos permitidos (principal, respaldo,
  juez), ZDR, tope mensual (el que elija; p. ej. 10–30 $).
- Crear un almacén de Vercel Blob público en el proyecto de la API y su variable
  `BLOB_READ_WRITE_TOKEN`.
- Elegir la política (A, B o C, § 5.4) y aprobar el texto del rótulo con `legal`.
- Correr `migrate` en producción tras las dos fusiones con migración; activar
  `AI_ILLUSTRATIONS` cuando la fase 5 lo pida.
- Mirar en `/admin` cuántas recetas tiene producción (§ 14).

**De código** (detalle en § 8)

- `database`: `recipe_images` sin bytes, con estado, URL, juez, coste, huella y reserva.
- `core`: pendientes ordenados por gramos con nombre inglés; URL absoluta al leer planes.
- `api`: `OpenRouterImageClient`, `ImageJudge`, `acceptImage`, `RecipeIllustrator` 2.0,
  límites de tiempo, fuera del `PlanJobRunner`, recuentos y gasto en `/admin`, variables
  nuevas, sin la rama de Google.
- `web` (`frontend`): URL absoluta, dos tamaños, rótulo.
- `scripts`: `bench-images.mjs` para el piloto.

**De datos**

- Borrar las 3 filas de `recipe_images` de dev antes de migrar.
- Saber cuántas recetas hay en producción y cuántas están en planes activos.

**De infraestructura**

- Programar `/cron/illustrate` cada 10–15 min en `apps/api/vercel.json` (Pro).
- Blob dentro del crédito del Pro (§ 7.1).

**Decisiones a registrar** (las registra el lead en `docs/decisions/`)

- La que sustituye a `0010`: almacén, proveedor, fotos realistas etiquetadas.
- La política de cuándo se dibuja y el tope.

## 11. Riesgos

Primero los de seguridad, privacidad y cuotas.

| Riesgo | Para quién | Probabilidad | Cómo se vería | Cómo se deshace |
| --- | --- | --- | --- | --- |
| **Almacenar en Neon bloquea las escrituras** | Todos (sin planes) | Alta si se sigue con `bytea` | Errores al guardar planes | No usar `bytea` (§ 7.1) |
| Una foto muestra un alérgeno que el plato no lleva | Alérgicos (confusión, desconfianza) | Baja con el juez; no nula | Reporte de un usuario; revisión en `/admin` | Rechazo duro de portadores de alérgenos; borrar la imagen (una fila y un fichero); la lista manda |
| Una petición cae en un endpoint que retiene o entrena | Regla del owner, política | Baja | Proveedor distinto en `usage`/registro de la llamada | `provider.only` ZDR + clave aparte con guardarraíl + ZDR de cuenta; comprobarlo en la primera llamada del piloto |
| El gasto se dispara (muchos planes o bucle de reintentos) | El owner | Media sin tope | Panel de gasto, aviso de OpenRouter | Tope mensual en la clave; 3 intentos máximo por receta; `AI_ILLUSTRATIONS=false` apaga todo |
| El juez aprueba fotos malas | Usuarios | Media hasta medirlo | Owner revisando la primera tanda | Umbrales más duros, juez más fuerte, o revisión manual al principio |
| Transferencia de Neon (si las fotos siguieran ahí) | Todos (producción suspendida) | Baja hoy, alta con 500+ personas | Consola de Neon | Blob |
| El barrido pasa de los 300 s | Nadie ve el fallo; fotos que no llegan | Media si se dibuja tras el plan | Registro de la función | Solo por cron, con límites de tiempo (§ 8) |
| Latencia de los modelos de imagen | Tiempo del barrido | Desconocida | Piloto | Menos recetas por barrido |
| Un modelo cambia o desaparece de OpenRouter | Fotos nuevas | Media a un año | Errores del barrido | Respaldo de otra empresa; la variable cambia sin código |

## 12. Coste y esfuerzo

### 12.1 Por imagen aceptada

Con 1,3–1,8 intentos por imagen aceptada (**hipótesis**) y ≤ 0,002 $ de juez por intento:

| Modelo | $/imagen | $/imagen aceptada |
| --- | --- | --- |
| MAI-Image-2.6 | 0,039 | **0,05–0,07** |
| NB2 Lite | 0,034 | **0,045–0,065** |
| Seedream 5.0 Pro | 0,045 | 0,06–0,085 |
| NB2 (Gemini 3.1 Flash Image) | 0,067 | 0,09–0,125 |
| MAI-Image-2.6-Flash | 0,0195 | 0,03–0,04 |

### 12.2 Una sola vez: la biblioteca que ya existe

| Alcance | MAI 2.6 | NB2 Lite | NB2 |
| --- | --- | --- | --- |
| 800 recetas | 40–56 $ | 36–52 $ | 72–100 $ |
| 1.500 recetas | 75–105 $ | 68–98 $ | 135–188 $ |

(**estimado**; producción entre 800 y 1.500, P7). Hacerlo solo para las recetas de planes
activos y dejar el resto para cuando se sirvan lo reduce a una fracción **desconocida**.

### 12.3 Cada mes, política A (~15 platos nuevos por plan, rango 12–18)

| Planes al mes | Imágenes | MAI 2.6 | NB2 Lite | Texto de esos planes (medido: 0,007–0,0095 $/plan) |
| --- | --- | --- | --- | --- |
| 20 | ~300 | 15–22 $ | 13–20 $ | 0,15–0,20 $ |
| 50 | ~750 | 38–55 $ | 34–49 $ | 0,35–0,50 $ |
| 500 | ~7.500 | 375–550 $ | 340–490 $ | 3,5–5 $ |

Los cambios de plato añaden uno más cada vez que el cambio escribe una receta nueva.
Almacenamiento y entrega en Blob: **~0 $** a estas escalas (**estimado**).

### 12.4 Esfuerzo (agentes y owner)

| Fase | Trabajo de agentes | Tiempo del owner | Dinero |
| --- | --- | --- | --- |
| 0. Decidir | — | 15 min: presupuesto del piloto, política (A/B/C), tope | 0 |
| 1. Piloto | ~1 día: script + hoja de contactos | 5 min para la clave; 1–2 h puntuando en el iPhone | ≤ 5 $ |
| 2. Almacén | 1–2 días | Crear el almacén Blob y la variable | ~0 |
| 3. Ilustrador 2.0 | 2–4 días (+ revisión de invariantes) | Probar en dev | ~1–3 $ de pruebas en dev |
| 4. Web y textos | ~1 día (`frontend`, `legal`) | Aprobar el rótulo | 0 |
| 5. Despliegue | horas | Clave de producción con tope; `migrate`; activar | backfill + mensual (§ 12.2–12.3) |

## 13. Plan

Fases que se pueden entregar una a una, listas para `/plan-project`.

**Fase 0 — Decisiones del owner.** Sí o no al piloto (≤ 5 $); política A, B o C; tope
mensual. El lead registra en `docs/decisions/` la decisión que sustituye a `0010`
(almacén, proveedor, fotos realistas etiquetadas).

**Fase 1 — Piloto (≤ 5 $, sin tocar producción).**
- Script `apps/api/scripts/bench-images.mjs`, del estilo de `bench-models.mjs`: lee 20
  recetas **reales y servidas** de dev, variadas a propósito — desayuno de avena y yogur,
  tostada, ensalada, crema de verduras, arroz meloso, pasta, pescado con verdura, pollo al
  horno con patatas, lentejas, salteado de tofu, yogur con frutos secos, bocadillo,
  tortilla, bol vegano, requesón con miel, fideos asiáticos, plato mexicano, calamar,
  y dos de 12 o más ingredientes. Se niega a correr contra producción (el `guard.mjs` de
  siempre), exige `--count` y `--max-usd`, y se para al llegar.
- **3 modelos × 20 = 60 imágenes**: MAI-Image-2.6 (0,78 $), Seedream 5.0 Pro (0,90 $),
  NB2 Lite (0,67 $) = **2,35 $**; una ronda de reintentos con la corrección del juez
  **≤ 1,20 $**; el juez **≤ 0,15 $**. **Total ≤ 3,70 $, tope de la clave 5 $.** Opcional:
  MAI-2.6-Flash como cuarto (+0,40–0,60 $).
- Salida: carpeta ignorada por git con las fotos, un JSON con veredicto del juez, coste
  real (`usage.cost`), latencia y proveedor que respondió, y una hoja de contactos HTML
  que el owner abre en su iPhone (servida desde el portátil en la red de casa). Para cada
  foto marca: ¿parece real? ¿es este plato? ¿se ve nítida? ¿la enseñarías?
- **Éxito**: un modelo con ≥ 80 % de fotos que el owner enseñaría tras ≤ 3 intentos y
  ninguna con un alérgeno ajeno; el juez de acuerdo con él en ≥ 90 %; confirmado que
  todas las llamadas fueron a proveedores ZDR.
- **Señal de parar**: ningún modelo pasa del 60 % a juicio del owner, o el juez no llega
  al 80 % de acuerdo → se vuelve a pensar (brief con el modelo de texto, modelo más caro
  como NB2, o revisión manual), no se construye.

**Fase 2 — Almacén.** Blob, esquema nuevo de `recipe_images`, variantes y marca XMP,
URL absoluta en la API, borrado de las filas de dev. **Éxito**: una receta con foto en
dev se ve desde Blob sin pasar por la API. **Parar** si Blob exige algo que cueste dinero
fuera del crédito.

**Fase 3 — Ilustrador 2.0.** Cliente de OpenRouter, brief en código, juez, `acceptImage`,
reintentos, barrido por cron con límites de tiempo, recuentos y gasto en `/admin`, sin
dibujo tras el plan. **Éxito**: 50 recetas de dev con la tasa del piloto ± 10 puntos y
el coste por imagen aceptada dentro del rango de § 12.1. **Parar** si el coste medido
pasa de 1,5× el estimado.

**Fase 4 — Web y textos.** Lo de `frontend` y el rótulo; lo que diga `legal` sobre
miniaturas, marca y política. **Éxito**: sonda local en 320/390/1280 px, claro y oscuro,
sin saltos de maquetación y con la foto del detalle como LCP.

**Fase 5 — Producción.** Clave de imágenes con tope; `migrate`; `AI_ILLUSTRATIONS=true`;
primero las recetas de planes activos, después lo nuevo según la política elegida.
**Éxito**: gasto del mes dentro del tope y ninguna foto reportada por un alérgeno.
**Parar** (apagando la variable) ante la primera foto con un alérgeno ajeno que el juez
dejó pasar, hasta entender por qué.

## 14. Qué no sé

- **Cuántas recetas tiene producción** y si el seed de 500 está cargado (el owner lo ve
  en `/admin`, «recetas» y «sin ilustrar»).
- **Cuántos planes al mes** se generan en producción: decide si esto son 15 $ o 50 $ al
  mes.
- **Qué parte de las comidas se abre**: no hay evento que lo registre; si la política B
  interesa, habría que añadir uno (con el criterio de `Analytics.ts`: solo lo que no deja
  otra huella).
- **La tasa real de acierto y el número medio de intentos** por modelo: solo el piloto.
- **Si el juez acierta lo mismo que el owner**: solo el piloto.
- **Latencia** de cada modelo de imagen por OpenRouter: solo el piloto.
- **Si `provider.only` en `/images` es unión o intersección** con la lista de la cuenta, y
  si el ZDR de la cuenta se aplica a `/images`: la primera llamada del piloto.
- **Cuánto pesan de verdad** las fotos realistas a 1.200 px en WebP: el piloto.
- **Qué marca** exige el art. 50 y si las miniaturas necesitan rótulo: `legal`.
- **Si OpenRouter acepta `/images/generations`** como alias: irrelevante si se escribe el
  cliente propio.

## Fuentes

Leídas el 2026-09-26 entre las ~17:20 y las ~17:45 UTC salvo otra fecha.

- OpenRouter, API pública: `/api/v1/models?output_modalities=image` (57 modelos),
  `/api/v1/models`, `/api/v1/models/{id}/endpoints`, `/api/v1/images/models`,
  `/api/v1/images/models/{id}/endpoints`, `/api/v1/endpoints/zdr` (921 endpoints).
- OpenRouter, documentación: «Image Generation» (`/docs/guides/overview/multimodal/image-generation`),
  «Generate an image» (esquema OpenAPI de `/images`, incluido `ImageGenerationProviderPreferences`),
  «Image Generation» server tool (beta).
- LMArena (arena.ai), Text-to-Image, general y «Photorealistic & Cinematic Imagery»,
  actualizado el 2026-09-24.
- Artificial Analysis, Text-to-Image Arena leaderboard (sin fecha visible; cita
  lanzamientos de septiembre de 2026).
- Google, «Gemini Developer API pricing» (`ai.google.dev/gemini-api/docs/pricing`),
  tokens por imagen de Gemini 3.1 Flash Image y Gemini 3 Pro Image.
- Vercel, «Vercel Blob Pricing» (actualizada el 2026-09-23); «Vercel CDN Cache»
  (2026-09-14); «Purging Vercel CDN Cache» (2026-09-03).
- Neon, página de precios (plan Free: 0,5 GB por proyecto, 100 CU-h, 5 GB de
  transferencia; «Exceeding 0.5 GB storage blocks writes»).
- Cloudflare, «R2 pricing» (actualizada el 2026-08-07).
- Base de datos de desarrollo (`Nutria-E2E`), solo lectura: recuentos de `recipes`,
  `recipe_images`, `recipe_ingredients`, `ingredient_names`, `meals`, `meal_plans`
  (`generation_metadata.aiCalls`), tamaño de la base.
