# 0002 — Qué modelo para generar los platos, sin que nadie entrene con lo que enviamos

> **Purpose**: respuesta del agente `architect` a la pregunta del owner del 2026-09-25:
> «¿Cuál es mi mejor opción? Quiero generar las dietas como antes, tan precisas y
> variadas, y sin depender de mi biblioteca. Modelo local en Oracle, algún otro proveedor
> gratuito, o cuáles son los mejores y más baratos pagando, como Kimi, DeepSeek, etc.»,
> bajo la regla que el owner fijó el mismo día (abajo). Compara las rutas contra el código
> y las mediciones, recomienda una principal y una de respaldo, y propone la medición que
> va antes de gastar nada.
> **Audience**: el owner y los agentes. **Committed**: sí. **Maintained by**: el agente
> `architect`; una vez fusionado no se edita — una revisión posterior es un informe nuevo.
>
> Base: `main` en `ba1cefb` (con #114, fase 6 del 005, y #115, el informe
> [`0001`](./0001-generacion-determinista-2026-09-25.md), del que este parte y que no
> repite). Cada número lleva etiqueta: **medido** (dónde), **estimado** (con la hipótesis)
> o **desconocido**. Los precios leídos de una API o página pública cuentan como
> **medidos** en esa fuente y a esa hora. Durante el informe **no se hizo ninguna llamada
> a modelo ni a gateway**: se leyeron la API pública de modelos de OpenRouter
> (`/api/v1/models`, `/models/{id}/endpoints`, `/endpoints/zdr`) y la de Vercel AI Gateway
> (`/v1/models`) el 2026-09-25 a las ~21:30 UTC, las páginas de condiciones fechadas en
> [Fuentes](#fuentes-consultadas-el-2026-09-25), el código público de OmniRoute en la
> etiqueta `v3.8.50` (la versión del gateway del owner, `ai-gateway.md` § 7) y el SDK
> instalado en `node_modules`. Precios en dólares, como los publican; 1 $ ≈ 0,85–0,95 €
> (**estimado**, tipo no consultado).

## Revisión 2026-09-25: sin entrenamiento

**Qué cambió.** La primera versión de este informe (del mismo día, sin fusionar)
recomendaba `meta/muse-spark-1.3-contributor` como principal. El owner decidió después:
«No quiero entrenar ningún modelo, lo pone en la política de privacidad». Es una
restricción dura: **nada de lo que NutrIA envía puede usarlo ningún proveedor para
entrenar o mejorar modelos**. El tier *contributor* existe precisamente para eso (Meta
entrena con prompts y respuestas a cambio del descuento), así que queda fuera, y con él
todo lo gratuito que se usa hoy.

**Por qué la regla es la correcta.** El texto publicado de `/privacidad`
(`apps/web/src/i18n/dictionaries/es-ES.ts:1360`) dice hoy que algunos modelos gratuitos
«pueden usar lo que reciben para mejorar sus modelos» y que «estamos cambiando a
proveedores que no reutilicen los datos». El borrador de `legal`
(`docs/legal/textos/02-politica-privacidad.md:20-21, 97`, variante A, ⟦ia-encargado⟧)
promete proveedores «por encargo nuestro, con contrato, sin usarlos para entrenar ni para
nada propio», y la EIPD pone como medida M3 «sin entrenamiento, retención cero»
(`docs/legal/eipd.md:125`). Este informe se rehace para cumplir esa promesa.

**Qué más cambió al revisarlo.** Tres premisas del encargo resultaron incompletas (§ 2,
P12–P14): Gemini gratuito no queda fuera por entrenar, sino porque sus condiciones
prohíben servir con él a usuarios del EEE; la regla **no** resuelve por sí sola el P1-10
de `/consulta`, porque la cláusula clínica de Gemini vale también de pago; y OpenRouter
solo firma su DPA con clientes Enterprise según su centro de ayuda, cosa que `legal` debe
aclarar. Y producción, hoy, incumple la regla (§ 3.1).

## 1. Veredicto

**Sí, con condiciones: pagar muy poco por un modelo de pesos abiertos servido solo por
proveedores que no retienen nada (ZDR), a través de OpenRouter, con la privacidad
impuesta en la cuenta y no en el código. Y hasta medirlo, producción sin modelo.**

- **Principal: `deepseek/deepseek-v4-flash-0731`**, en OpenRouter, restringido a endpoints
  ZDR con salida estructurada (20 proveedores lo cumplen; el más barato, DeepInfra, a
  0,06 $ / 0,18 $ por millón de tokens, **medido** en la API de OpenRouter). «Como antes»
  —7 platos nuevos por comida— cuesta **~0,007–0,017 $ por generación**: **~0,3–0,9 $ al
  mes a 50 generaciones, ~3–9 $ a 500, ~33–87 $ a 5.000** (**estimado**, § 4.2). El
  razonamiento se puede apagar, que es lo que lo hace caber en 170 s.
- **Respaldo: `mistralai/mistral-small-2603` (Mistral Small 4)**, también ZDR en
  OpenRouter, servido por Mistral mismo, con un endpoint en la UE. Otra empresa, otros
  pesos, otra infraestructura: si cae el principal, no cae con él. ~0,02–0,06 $ por
  generación, y solo paga cuando el primero falla.
- **Nadie ha medido ninguno de los dos con este prompt.** La única calidad medida que
  había, muse-spark contributor, queda fuera por la regla. Por eso la recomendación es
  condicional: la fase 1 (§ 8) mide 5 candidatos sin entrenamiento con **36 llamadas por
  ≤ 0,43 $ en el peor caso** (~0,10 $ esperado), y el orden final lo dan los números.
- **Gemini, ni gratis ni de respaldo.** Gratis, sus condiciones solo permiten servicios de
  pago para usuarios del EEE; de pago no entrena, pero cuesta 3–20 veces más que DeepSeek
  y su cláusula de «práctica clínica» sigue cerrando `/consulta` (P1-10).
- **Oracle local: no** (sin cambios: 10–20 min por petición, **estimado**; un 27B dio 2
  platos válidos de 14, **medido**). **Gratis: no hay ruta que cumpla la regla y funcione**:
  la única gratuita sin retención que escribe texto útil es `qwen3.8-27b:free` (ModelRun),
  y ese modelo ya se midió inservible (§ 4.5).
- **«Sin depender de la biblioteca», literalmente, no** (sin cambios, § 4.4): el 7/7 de
  antes fue biblioteca + modelo. Lo recuperable es el «antes»: 7 platos nuevos por comida,
  de un modelo que responde.

Condiciones:

1. **Hoy mismo, producción sin modelo** (`AI_PROVIDER=stub`): es la única forma de cumplir
   la regla a 0 € mientras se mide (§ 3.1). Cuesta poco: con los gratuitos de hoy, la
   mayoría de planes ya salen solo de la biblioteca.
2. **La privacidad se impone en la cuenta de OpenRouter, no en el código**: entrenamiento
   apagado (de pago y gratuito), solo endpoints ZDR, y una *guardrail* en la clave con la
   lista de modelos permitidos y un tope de gasto mensual (§ 4.3). Una petición no puede
   aflojar esos ajustes; un error de código, como mucho, falla.
3. **El owner autoriza por escrito** las 36 (+12 opcionales) llamadas de pago y el
   presupuesto (§ 8, fase 2), tras comprar ~10 $ de crédito.
4. **La fase 7 del proyecto 005 se reescribe** (§ 4.6): combo sin gratuitos ni Gemini, 7
   platos nuevos por comida en peticiones paralelas de 3 + 3 + 1, esfuerzo de razonamiento
   por configuración.
5. **`legal` revisa antes de producción** el contrato con OpenRouter y sus proveedores,
   dónde se procesa y las transferencias (§ 5); después, `/privacidad` pasa a la variante A.

## 2. Premisas revisadas

| # | Premisa | Estado | Evidencia |
| --- | --- | --- | --- |
| P1 | «Antes las dietas eran tan precisas y variadas» | **confirmada**, pero con un modelo que ya no se puede usar | Benchmark del owner, 2026-09-12: muse-spark 1.2 contributor, 33 platos válidos de 30 pedidos, ~11 puntos de error medio, 7/7 días dentro del 5 % en los cuatro macros. Dev: 25 de 32 platos aceptados (**medido**, `plan_generation_jobs.ai_calls`). Ese modelo es el tier que entrena (P7). |
| P2 | «Antes no dependía de la biblioteca» | **incorrecta** | El 7/7 fue una semana mixta: cada comida pide 19 platos, hasta 12 de la biblioteca y 7 al modelo (`packages/core/src/domain/Variety/Rotation.ts:27, 48-61`); si el modelo falla, la biblioteca cubre el plan entero (`full_library`, `PlanGeneration.service.ts:244-256`). |
| P3 | «Un modelo local en Oracle puede hacerlo» | **incorrecta** | § 4.5. Cumpliría la regla (nada sale de la máquina), pero no el tiempo ni la calidad. |
| P4 | «Hay otro proveedor gratuito que sirva» | **incorrecta** | Todo lo gratuito medido o entrena o no escribe estos platos (§ 4.5). |
| P5 | «Kimi y DeepSeek son los mejores y más baratos pagando» | **mitad confirmada** | DeepSeek V4 Flash es de los más baratos también en endpoints ZDR (0,06 / 0,18 en DeepInfra). Kimi no: K2.5 en ZDR 0,45 / 2,25, 10–12 veces más (**medido**, OpenRouter `/endpoints`). Ninguno medido en esta tarea. |
| P6 | «muse-spark contributor está en OpenRouter a 0,10 / 0,20» | **confirmada**, y **descartada** por P7 | OpenRouter `/models` (2026-09-25): un único endpoint (Meta), no ZDR. |
| P7 | «Contributor significa que Meta entrena con los prompts» | **confirmada** | Meta: «Heavily discounted token pricing in exchange for permission to use your prompts and completions to train future Meta models». El estándar: «your prompts and completions are not used to train Meta models». |
| P8 | «El razonamiento se puede apagar o bajar» | **depende del modelo** | Vercel `/v1/models` (2026-09-25): DeepSeek V4 Flash `none`…`high`; GLM 5.3 Flash `low`/`high`/`max`; gpt-oss `low`/`medium`/`high`; Nemotron 3 Ultra `none`/`medium`/`high`. En OpenRouter el campo es `reasoning: { effort }` (su documentación; `none` apaga). En NutrIA hoy no se envía nada (`StructuredAiClient.ts:64-66`). Si bajarlo empeora los platos: **desconocido**. |
| P9 | «El presupuesto es 280 s» | **matiz** | 280 s es el job (`PlanJobRunner.service.ts:38`); el modelo tiene **170 s** (`Env.validation.ts:121`). |
| P10 | «nemotron free registra los prompts para mejorar productos de NVIDIA» | **confirmada** | OpenCode Zen (actualizada 2026-09-25) y la página del modelo en OpenRouter: «Your use is logged for security purposes and to improve NVIDIA products and services». Además, su endpoint gratuito no está en la lista ZDR de OpenRouter. |
| P11 | «OpenRouter `:free` exige consentir entrenamiento o registro» | **confirmada** para los que se usaban | FAQ de OpenRouter: a proveedores que registran datos o sin política confirmada no se enruta «unless the model training toggle is switched on». De los `:free` de texto, solo `qwen3.8-27b:free` (ModelRun) y dos `ling-3.0` (Novita) están en la lista ZDR (**medido**, `/endpoints/zdr`). |
| P12 | «Gemini gratuito entrena con lo que le mandamos» | **incorrecta para un owner en el EEE**; queda fuera por otra razón, más fuerte | *Gemini API Additional Terms* (vigentes desde 2026-03-23): «If you're in the European Economic Area, Switzerland, or the United Kingdom, the terms under "How Google uses Your Data" in "Paid Services" apply to all Services… even though they are offered free of charge» — es decir, no entrena. Pero, en *Use Restrictions*: «You may use only Paid Services when making API Clients available to users in the European Economic Area». **Servir a usuarios de NutrIA con la cuota gratuita incumple hoy esas condiciones**, sea paso de respaldo o no. |
| P13 | «El P1-10 de `/consulta` queda resuelto por la misma regla» | **incorrecta a medias** | La cláusula «You may not use the Services in clinical practice, to provide medical advice…» está en *Use Restrictions* y vale para todos los servicios, **de pago incluidos**. P1-10 se cierra solo si Gemini sale del combo, que es lo que recomiendo; con Gemini de pago como respaldo seguiría abierto para `/consulta`. |
| P14 | «Pagando a OpenRouter tenemos contrato de encargo» | **hipótesis a resolver por `legal`** | Sus condiciones (actualizadas 2026-08-31, § 10.2) incorporan un DPA para uso comercial; su centro de ayuda dice que el DPA firmado es para clientes Enterprise y que el resto solo puede leerlo. Una cosa u otra decide la variante A. |
| P15 | «La fase 7 (3 platos por petición) mantiene lo de antes» | **incorrecta** | Tras la ronda 1, `PoolBuilder` cubre lo que falta con la biblioteca **antes** de volver a preguntar (`PoolBuilder.service.ts:177-191`): lo nuevo por comida baja de 7 a 3. |

## 3. Qué hay hoy

### 3.1 Producción incumple la regla hoy

- **El combo documentado** (`docs/reference/ai-gateway.md` § 1) es
  `opencode/muse-spark-1.2-contributor-free` → `opencode/mimo-v2.5-free` →
  `gemini/gemini-3.6-flash`, y la fase 7 del 005 decidió pasar a
  `nemotron-3-ultra-550b-a55b:free` → Gemini (`docs/decisions/LOG.md` 2026-09-25;
  `docs/projects/005-meal-and-season-catalogue/PLAN.md` § Phase 7). Qué hay configurado
  exactamente en el gateway ahora no lo sé: es del owner. **Cada paso de los dos combos
  incumple**: contributor entrena Meta; MiMo gratuito, «collected data may be used to
  improve the model» (OpenCode Zen); nemotron gratuito, registrado para mejorar NVIDIA;
  Gemini gratuito, prohibido para usuarios del EEE (P12).
- **El texto publicado es honesto hoy**: la variante B avisa de la reutilización. Lo que se
  incumple es la regla del owner, no la política.
- **La forma de cumplir ya, a 0 €, existe**: `AI_PROVIDER=stub` hace que `resolveModel`
  devuelva `null` (`apps/api/src/modules/ai/ai.config.ts:56-90`) y el pool builder no
  llama a nadie (`PoolBuilder.service.ts:199-202`); el plan sale de la biblioteca, que
  cuadró 153 de 154 días dentro del 5 % (**medido** en `0001` § 3.4). Lo que se pierde es
  poco: en la fase 6 el mejor gratuito respondió 2 de 6 llamadas (**medido**,
  `ai-gateway.md` § 7). El riesgo: un perfil muy restrictivo sin platos suficientes recibe
  `GENERATION_POOL_TOO_SMALL` (`PlanGeneration.service.ts:258-267`) en lugar de un plan
  con platos nuevos; cuántos perfiles de producción: **desconocido**.
- **La regla alcanza a más que la generación**: la reescritura de pasos
  (`AI_REWRITE_MODEL`, `ai-gateway.md` § 6) usa el mismo gateway; y las ilustraciones van a
  Google solo con `AI_PROVIDER=google` y facturación activa
  (`ai.config.ts:158-164`; `Env.validation.ts:122-129`), que es servicio de pago y no
  entrena. Con `stub`, la reescritura se para.

### 3.2 Cómo viaja una petición y dónde se puede imponer la regla

- **Cambiar de modelo no toca código.** Con `AI_PROVIDER=omniroute`, el pool builder llama
  al gateway por nombre de modelo o de combo (`ai.config.ts:68-87`); el combo es
  configuración del owner.
- **El SDK deja pasar campos propios de OpenRouter.** `@ai-sdk/openai-compatible` 3.0.52
  copia al cuerpo cualquier clave de `providerOptions.omniroute` que no sea suya
  (`node_modules/.pnpm/@ai-sdk+openai-compatible@3.0.52…/dist/index.js:593-600`), y además
  NutrIA ya transforma cada cuerpo en un solo sitio (`transformRequestBody:
  nonStrictSchema`, `ai.config.ts:86, 110-118`). Ahí cabe un bloque `provider` fijo.
- **OmniRoute 3.8.50 reenvía el cuerpo tal cual de OpenAI a OpenAI**
  (`open-sse/translator/index.ts:405-413`, «same-format passthrough»), no tiene reglas que
  quiten campos para OpenRouter (`open-sse/translator/paramSupport.ts`), y **añade a cada
  petición el *preset* de OpenRouter configurado en la conexión**
  (`open-sse/executors/default.ts:854-861`; en el panel, «OpenRouter preset» al editar la
  conexión, CHANGELOG #3878/#3921). Sus claves guardan una lista de modelos permitidos
  (`allowed_models`, `src/lib/db/jsonMigration.ts:104`). Todo esto es **lectura de
  código**: que funcione así en el gateway del owner es **hipótesis** hasta la primera
  llamada de la fase 2.
- **OpenRouter, por su parte** (documentación leída el 2026-09-25):
  - *Settings › Privacy* de la cuenta: permitir o no proveedores que entrenan, por
    separado para modelos de pago y gratuitos; y ZDR para toda la cuenta. Los ajustes de
    cuenta y los de la petición se combinan en **OR** para ZDR: una petición puede exigir
    más, nunca menos.
  - *Guardrails* por clave (se crean en el panel): tope de gasto con reinicio
    diario/semanal/mensual, modelos permitidos, proveedores permitidos, ZDR; se suman a los
    ajustes de la cuenta por intersección.
  - Por petición: `provider: { zdr, data_collection: "deny", only, require_parameters,
    max_price, … }`. **Ojo**: un *preset* y la petición se mezclan en superficie — si la
    petición manda su propio `provider`, sustituye entero al del preset.
  - OpenRouter no guarda prompts ni respuestas salvo que se active el registro; «OpenRouter
    use of inputs/outputs» (1 % de descuento) está apagado por defecto. Sí muestrea «a small
    number of prompts for categorization», anónimamente (§ 9).
- **Salida estructurada, no estricta** (sin cambios): `json_schema` con `strict: false`
  (`0050`). Con `require_parameters: true`, OpenRouter solo enruta a endpoints que
  soportan el esquema; todos los candidatos de § 4.1 tienen alguno ZDR que lo soporta
  (**medido**, `/endpoints`).
- **Latencia y volumen** (sin cambios): una llamada por comida con déficit, en paralelo,
  hasta 3 rondas bajo 170 s (`PoolBuilder.service.ts:21, 171`); ~20k tokens de entrada
  por generación con 4.1.0 (**medido**, `ai-gateway.md` § 5); muse-spark escribía
  ~2.300–3.700 tokens por plato razonando, ~400–740 el plato visible, y
  `nemotron-3-ultra` ~1.025 (**medido**, dev 2026-09-12 y fase 6).
- **La medición existe y hoy solo admite gratuitos.** `apps/api/scripts/bench-models.mjs`
  rechaza todo id que no acabe en `:free` o empiece por `groq/` (`:264-275`) y lo que nombre
  Gemini; no envía control de razonamiento ni preferencias de proveedor (`:314-333`); ya
  acepta `--max-tokens` (`:169`). Bajo la regla nueva, **su filtro está al revés**: deja
  pasar justo lo que entrena.

## 4. Propuesta

### 4.1 Las opciones bajo la regla

Precios: el endpoint ZDR más barato con salida estructurada en OpenRouter (`/endpoints`,
2026-09-25). «ZDR» = en la lista `/api/v1/endpoints/zdr` de OpenRouter. Coste por
generación: § 4.2.

| # | Opción | ¿Cumple la regla? | Calidad en esta tarea | Endpoints ZDR con esquema | $/M entrada / salida (ZDR) | $/generación (B′) | Razonamiento | Nota |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **DeepSeek V4 Flash 0731** | sí, con ZDR | **desconocida** | 20 | 0,06 / 0,18 (DeepInfra fp8) | 0,007–0,017 | se apaga | recomendado principal |
| 2 | **Mistral Small 4 (2603)** | sí (ZDR; Mistral no entrena en la API de pago) | **desconocida** | 3 (Mistral: `zdr`, `eu`, `us`) | 0,15–0,165 / 0,60–0,66 | 0,019–0,061 | por defecto, sin fijar | recomendado respaldo; UE posible |
| 3 | **GLM 5.3 Flash** | sí, con ZDR | desconocida | 24 | 0,045 / 0,14 (InferenceNet fp4); 0,075 / 0,25 (DeepInfra fp4) | 0,005–0,024 | `low`…`max` | alternativa barata |
| 4 | **gpt-oss-120b** | sí, con ZDR | desconocida (en Groq, 400 ×6 por la validación de JSON de Groq) | 17 | 0,03–0,037 / 0,17 | 0,005–0,015 | `low`…`high` | alternativa barata |
| 5 | **Nemotron 3 Ultra de pago** | sí (DeepInfra, ZDR) | **medida en su versión gratuita**: 9 de 12 platos válidos, 19–33 % de desviación, 2 de 6 respuestas (fase 6) | 1 | 0,50 / 2,20 | 0,067–0,20 | `none`/`medium`/`high` | control: separa infraestructura de calidad |
| 6 | DeepSeek V4 Flash 0423 · V4.1 Flash | sí, con ZDR | desconocida | 7 · 16 | 0,09 / 0,18 · 0,14 / 0,42 | 0,008–0,019 · 0,015–0,041 | se apaga | la 0731 es igual de familia, más barata y con más proveedores |
| 7 | **Gemini 3.8 / 3.6 Flash de pago** (Vertex en OpenRouter, o clave de Google con facturación) | sí (de pago no entrena; Vertex es ZDR) | la del proveedor original de NutrIA, con prompts anteriores; sin medir en 4.1.0 | 3–4 | 0,375 / 1,875 (flex); 0,75 / 3,75 | 0,054–0,33 | `low`/`high` | cláusula clínica: nunca `/consulta` (P13) |
| 8 | MiniMax M3 · Kimi K2.5 · DeepSeek V4 Pro | sí, con ZDR | desconocida | 3 · 3 · 6 | 0,23 / 0,96 · 0,45 / 2,25 · 1,30 / 2,60 | 0,03–0,09 · 0,07–0,20 · 0,12–0,28 | varía | más caros sin razón medida |
| 9 | muse-spark 1.3 estándar · Qwen 3.8 Flash | no entrenan, pero **no son ZDR en OpenRouter** (Meta y Alibaba, un proveedor cada uno) | la de muse-spark, probablemente (mismos pesos: **hipótesis**) · desconocida | 0 | 1,25 / 4,25 · 0,15 / 0,47 | 0,15–0,40 · 0,02–0,05 | sí | solo por Vercel AI Gateway con ZDR, que exige plan Pro (§ 4.5) |
| 10 | Modelo local en Oracle A1 | sí | no la tendría (P3) | — | 0 € | 0 € | — | no cabe en el tiempo |

**Fuera por la regla**, con la fuente del propio proveedor:

| Ruta | Por qué no | Fuente (fecha) |
| --- | --- | --- |
| `meta/muse-spark-*-contributor` (OpenRouter, Vercel, OpenCode) | entrena los modelos de Meta con prompts y respuestas | Meta, página de precios; OpenCode Zen (2026-09-25) |
| OpenRouter `nvidia/nemotron-*:free` | «logged… to improve NVIDIA products and services»; no está en la lista ZDR | OpenCode Zen (2026-09-25); página del modelo en OpenRouter |
| OpenRouter `:free` en general | se enrutan a proveedores que registran o sin política confirmada solo con el entrenamiento permitido en la cuenta; los únicos ZDR (`qwen3.8-27b:free`, `ling-3.0-*:free`) no sirven o no están medidos | FAQ de OpenRouter; `/endpoints/zdr` (2026-09-25) |
| Gemini, cuota gratuita | no se puede ofrecer a usuarios del EEE; además, sin contrato de encargo | *Gemini API Additional Terms*, vigentes 2026-03-23 |
| OpenCode Zen gratuito | Big Pickle, MiMo, Ling: «collected data may be used to improve the model»; nemotron y muse-spark, como arriba. Space Bunny dice no retener ni entrenar, pero es un modelo sin nombre, «durante su periodo gratuito» y sin contrato | OpenCode Zen, actualizada 2026-09-25 |
| API propia de DeepSeek | entrena por defecto y trata los datos en China; además solo `json_object` | resumen de terceros (betterclaw.io, 2026-09-15); DeepSeek, modo JSON |
| Mistral gratuito (Experiment / Studio Free) | «we may use your data (input and output) to train» | centro de ayuda de Mistral |

**Permitido pero inservible**: Groq gratuito no entrena y ofrece ZDR (sus condiciones),
pero `gpt-oss-120b` dio 400 ×6 y `qwen3.8-27b` 2 platos válidos de 14 (**medido**, fase 6).

### 4.2 Coste por generación y por mes

Hipótesis (**estimadas** a partir de § 3.2): forma de 4 comidas; escenario **B′** («como
antes»): 7 platos nuevos por comida en peticiones de ≤ 3 → 12 llamadas, ~60k tokens de
entrada, 28 platos; salida **600 tokens por plato sin razonamiento** (el plato visible
medido) o **2.750 razonando** (la mediana medida de muse-spark, cota alta para los
demás). Sin caché. Al precio del endpoint ZDR con esquema más barato de cada modelo.

| Modelo | Endpoint ZDR | $/M entrada / salida | $/gen. sin razonar | $/gen. razonando | Mes a 50 / 500 / 5.000 |
| --- | --- | --- | --- | --- | --- |
| GLM 5.3 Flash | InferenceNet fp4 | 0,045 / 0,14 | 0,005 | 0,013 | 0,3–0,7 / 3–7 / 25–67 |
| gpt-oss-120b | AkashML / DeepInfra bf16 | 0,037 / 0,17 | 0,005 | 0,015 | 0,3–0,8 / 3–8 / 25–77 |
| **DeepSeek V4 Flash 0731** | **DeepInfra fp8** | **0,06 / 0,18** | **0,007** | **0,017** | **0,3–0,9 / 3–9 / 33–87** |
| DeepSeek V4 Flash 0423 | DeepInfra fp8 | 0,09 / 0,18 | 0,008 | 0,019 | 0,4–1,0 / 4–10 / 42–96 |
| GLM 5.3 Flash | DeepInfra fp4 | 0,075 / 0,25 | 0,009 | 0,024 | 0,4–1,2 / 4–12 / 44–119 |
| DeepSeek V4.1 Flash | DeepInfra fp8 | 0,14 / 0,42 | 0,015 | 0,041 | 0,8–2,0 / 8–20 / 77–204 |
| **Mistral Small 4** | **Mistral ZDR** (UE: 0,165 / 0,66) | **0,15 / 0,60** | **0,019** | **0,055** | **1,0–2,8 / 10–28 / 95–276** |
| MiniMax M3 | CoreWeave fp4 | 0,23 / 0,96 | 0,030 | 0,088 | 1,5–4,4 / 15–44 / 150–439 |
| Gemini 3.8 / 3.6 Flash | Vertex flex | 0,375 / 1,875 | 0,054 | 0,167 | 2,7–8,3 / 27–83 / 270–834 |
| Kimi K2.5 | SiliconFlow int4 | 0,45 / 2,25 | 0,065 | 0,200 | 3,2–10 / 32–100 / 324–1.001 |
| Nemotron 3 Ultra | DeepInfra fp4 | 0,50 / 2,20 | 0,067 | 0,199 | 3,3–10 / 33–100 / 335–997 |
| Gemini 3.8 / 3.6 Flash | Vertex estándar | 0,75 / 3,75 | 0,108 | 0,334 | 5,4–17 / 54–167 / 540–1.669 |
| DeepSeek V4 Pro | DeepInfra fp8 | 1,30 / 2,60 | 0,122 | 0,278 | 6,1–14 / 61–139 / 608–1.391 |

Cómo leerla:

- **El respaldo apenas cuenta en la factura**: solo se paga cuando el principal falla
  rápido (4xx, 5xx, 429); un *timeout* ya no deja sitio para otro paso dentro de 170 s
  (**medido**: un salto costó 65 s, `ai-gateway.md` § 5).
- **OpenRouter reparte entre los endpoints permitidos** con preferencia por el precio,
  pero no siempre al más barato: el peor endpoint ZDR de DeepSeek 0731 (NextBit, 0,352 /
  1,056) cuesta 0,039–0,10 $ por generación. Un `max_price` en el preset lo acota (§ 4.3).
- Con **pocos cientos de planes al mes, el modelo cuesta lo que un café**; a 5.000, antes
  se agotan la CPU de Vercel Hobby y la transferencia de Neon (`0001` § 3.5).
- Sin incluir la comisión de compra de crédito (5,5 %, mínimo 0,80 $, **medido** en la FAQ
  de OpenRouter), los cambios de plato (≤ 1 llamada de 3 platos cuando la biblioteca no
  tiene sustituto) ni reintentos.

### 4.3 Cómo se impone, para que un error de código no pueda llegar a quien entrena

Por capas, de la más fuerte a la más débil. **Las dos primeras son la garantía**: no
dependen de NutrIA ni de OmniRoute, y una petición no puede aflojarlas.

1. **Cuenta de OpenRouter, *Settings › Privacy*** (owner): entrenamiento **apagado** para
   modelos de pago **y** gratuitos; «OpenRouter use of inputs/outputs» apagado (lo está por
   defecto); registro de prompts apagado; **ZDR para toda la cuenta** encendido. Si la
   cuenta se usa también para otras cosas del owner y no quiere ZDR en todas, la capa 2
   hace lo mismo solo para NutrIA.
2. **Una *guardrail* en la clave de OpenRouter que usa OmniRoute** (owner, panel
   *Workspaces › Guardrails*): ZDR impuesto, **modelos permitidos** = solo los medidos
   (luego, solo los dos elegidos), y **tope de gasto mensual** (p. ej. 5 $). Con esto, aunque
   el combo o el código pidan otro modelo, OpenRouter lo rechaza, y el gasto de un mes
   nunca pasa del número que el owner escriba.
3. **En OmniRoute** (owner): un *preset* de OpenRouter (`@preset/nutria-zdr`, creado en
   OpenRouter) con `provider: { zdr: true, data_collection: "deny", require_parameters:
   true, max_price: { prompt: 0.20, completion: 0.70 } }`, puesto en el campo «OpenRouter
   preset» de la conexión; el combo de NutrIA **solo con pasos `openrouter/…`** (ni
   `opencode/…`, ni `gemini/…`, ni `groq/…`, ni `nvidia/…`); y la clave de NutrIA con los
   modelos permitidos reducidos a ese combo (hoy «Allowed Combos», `ai-gateway.md` § 1.3).
   Esto cubre lo que OpenRouter no ve: que el gateway mande la petición a **otra** clave
   suya (la gratuita de Gemini, OpenCode). El `max_price` deja entrar a Mistral (0,165 /
   0,66) y deja fuera los endpoints caros de DeepSeek.
4. **En NutrIA** (código, fase 7 enmendada): el mismo bloque `provider` en cada cuerpo,
   en `ai.config.ts` junto a `nonStrictSchema`, con un spec que lo fije. Es la tercera
   capa, no la garantía: si falta, las capas 1–3 siguen; y si la envía, **sustituye
   entera** a la del preset (mezcla superficial), así que debe ir completa.
5. **Vigilancia**: cada llamada ya guarda el modelo que respondió y el proveedor que dice
   el gateway (`StructuredAiClient.ts:78-89`, `x-omniroute-provider`), visibles en
   `/admin`. Un modelo fuera de la lista es la señal de parar.

**¿Reenvía OmniRoute un `provider` por petición?** Por su código, sí (§ 3.2), y además
tiene el preset por conexión, que no depende de la petición. Por eso la regla no descansa
en que lo reenvíe: la cuenta y la *guardrail* son la garantía; el preset y la petición, la
segunda línea. La primera llamada de la fase 2 lo confirma leyendo el proveedor que
respondió.

**`/consulta` y P1-10**: con este combo, sin Gemini y sin nada que entrene, P1-10 queda
cerrado por la salida que `legal` ya había escrito («sacar Gemini de la combinación»,
`docs/legal/analisis.md:479`). No hace falta un modelo aparte para `/consulta`
(desaparece la antigua fase 4 de este informe). Queda que `legal` revise los términos de
cada modelo (OpenRouter § 5.1, *Model Terms*) por si alguno tiene una cláusula clínica como
la de Gemini.

### 4.4 «Sin depender de la biblioteca»: la respuesta honesta

Sin cambios respecto a la primera versión, salvo el modelo:

- **La que sí: que el modelo vuelva a escribir su parte, siempre.** Un modelo de pago que
  responde devuelve los 7 platos nuevos por comida de `0013`, que es el «antes».
- **La que no: que el plan entero salga del modelo** (19 platos por comida). La precisión
  la da el scheduler con donde elegir (153/154 días con biblioteca sola, **medido** en
  `0001`; con 12 platos por comida bajaba a 6/14 y 4/14 días en hidratos y grasa, `0046`);
  sin biblioteca, un proveedor caído deja al usuario sin plan; cuesta ~3 veces más (28
  llamadas por generación) y el código solo puede pedir 9 por comida en 3 rondas. Y con
  modelos cuya calidad nadie ha medido, apostar el plan entero a ellos es peor idea que
  antes.

### 4.5 Alternativas consideradas y por qué perdieron

| Alternativa | La razón por la que pierde |
| --- | --- |
| **Vercel AI Gateway** (Vercel ya es encargado de NutrIA y está en el DPF) | En Hobby, «no entrenar» solo se impone por petición (`disallowPromptTraining`, gratis); ZDR y la lista de proveedores para todo el equipo exigen Pro. La garantía quedaría en el código, que es justo lo que el owner no quiere. Es la mejor opción **si** algún día se pasa a Pro (`0001` § 9 ya lo pone como el siguiente límite): ahí sí sirve muse-spark 1.3 estándar y Qwen 3.8 Flash con ZDR. Y comprar crédito anula su crédito mensual gratuito. |
| **API directa de Mistral** como respaldo | Contrato directo con una empresa de la UE y datos en la UE — lo más limpio para `legal` —, pero es otra cuenta, otra factura y otro tope, y ZDR allí se pide a soporte justificándolo. Si `legal` no da por buenos los contratos vía OpenRouter, es el plan B del respaldo. |
| **Gemini de pago como respaldo** | 3–20 veces el precio de DeepSeek por generación; P1-10 sigue abierto para `/consulta`; su única ventaja (otro gateway, si va con clave propia) la cubre ya la biblioteca: si OpenRouter cae, el plan sale igual (`full_library`). Tercer paso solo si Mistral, GLM y gpt-oss no pasan la medición, y nunca para `/consulta`. |
| **Mantener el combo gratuito hasta tener el de pago** | Unos días más incumpliendo una regla dura para ganar poco: el mejor gratuito respondió 2 de 6. |
| **Modelo local en Oracle A1** | 2 OCPU / 12 GB: un 7–9B a 2,5–4 tokens/s, 3–9 min solo en leer el prompt; una petición de 3 platos, 10–20 min (**estimado**, `0001` § 10); un 27B ya dio 2 válidos de 14. |
| **Kimi K3, DeepSeek V4 Pro, Claude Haiku** | 0,12–1,33 $ por generación sin prueba de que escriban mejores platos. |

### 4.6 Qué debería ser la fase 7 del proyecto 005

Para que el lead la enmiende con el owner. Tal como está, pide lo que la regla prohíbe
(`nemotron-3-ultra:free` → Gemini) y baja lo nuevo de 7 a 3 por comida (P15).

- **Título**: «Generation on paid models that do not train».
- **Objetivo**: cada llamada va a un endpoint sin entrenamiento y sin retención; cada
  comida recibe sus 7 platos nuevos (`0013`); un rechazo nunca cuesta el job.
- **Depende de**: la fase de medición (§ 8, fase 2) y la cuenta de OpenRouter configurada.
- **Pasos**:
  1. **7 platos nuevos por comida en peticiones paralelas de ≤ 3** (3 + 3 + 1) en la
     ronda 1, en lugar de una petición y la biblioteca detrás. La latencia es la de una
     petición de 3 (la salida marca el tiempo, `0016`); el coste, el de hoy más la entrada
     repetida (~40k tokens, ~0,002–0,004 $ con DeepSeek).
  2. **Los rechazos por tamaño o cuota caen a la siguiente ronda** sin romper el job (el
     paso 2 actual, sin cambios).
  3. **Esfuerzo de razonamiento por configuración**: `AI_REASONING_EFFORT` opcional, que
     `StructuredAiClient` pasa como `providerOptions.omniroute.reasoning = { effort }` (el
     campo nativo de OpenRouter; vacío, no se envía nada, como hoy). Con su sitio en
     `Env.validation.ts`, `turbo.json` `globalEnv`, `apps/api/.env.example` y
     `docs/reference/deployment.md`.
  4. **El bloque `provider` fijo** en cada cuerpo (§ 4.3, capa 4), con spec.
  5. Specs: ninguna petición pide más de 3 platos; una comida pide sus 7 en paralelo; un
     429 en una petición deja intactas las demás; el cuerpo lleva `provider` y, si está
     configurado, `reasoning`.
  6. `docs/reference/ai-gateway.md`: el combo recomendado (§ 4.7) con los números de la
     medición, los ajustes de cuenta de OpenRouter, la corrección sobre Gemini gratuito
     (P12) y la retirada de los pasos gratuitos.
- **Verificación**: la del plan, más: una quincena en dev por el gateway con las llamadas
  dichas antes (12 con B′ y 4 comidas), cada `ai_calls` con un proveedor de la lista ZDR;
  *human-verify*: el owner genera una quincena en producción tras cambiar el combo.
- Y en `LOG.md`, la línea de la fase 7 del 2026-09-25 queda sustituida por la decisión
  nueva, y la de «Measuring generation spends no Gemini request» sigue en pie.

### 4.7 La recomendación, en concreto

**Combo `NutrIA-Fallback`** (configuración del owner en OmniRoute), después de la medición:

1. `openrouter/deepseek/deepseek-v4-flash-0731`, con el esfuerzo que la medición dé por
   bueno (lo esperable: `none`).
2. `openrouter/mistralai/mistral-small-2603`.
3. Nada más. Detrás está la biblioteca, que es la red de seguridad de siempre.

Si la medición invierte el orden o descarta a uno, el siguiente de la lista es GLM 5.3
Flash, después gpt-oss-120b; Gemini de pago solo como último recurso y nunca para
`/consulta`. `AI_REWRITE_MODEL`: el mismo combo, o vacío.

## 5. Requisitos

- **Código** (nada nuevo en la ruta de seguridad):
  - `bench-models.mjs` (fase 2): el filtro, al revés; `--allow-paid`, `--reasoning-effort`,
    el bloque `provider`, y guardar el proveedor que respondió.
  - Fase 7 enmendada: peticiones paralelas, `AI_REASONING_EFFORT`, bloque `provider`.
- **Infraestructura**: ninguna nueva. OpenRouter ya está en el gateway.
- **Dinero** (decisión del owner): 10 $ de crédito + 0,80 $ de comisión (≈ 9,2–10,3 €),
  una vez. La medición gasta ≤ 0,43 $ (≤ 0,74 $ con la segunda pasada opcional); el resto
  paga producción: ~600–1.500 generaciones con DeepSeek (**estimado**). Tope mensual en la
  *guardrail*.
- **Decisiones del owner**:
  1. producción a `stub` ya, o esperar a la fase 5 incumpliendo la regla unos días;
  2. ZDR en toda la cuenta de OpenRouter o solo en la *guardrail* de NutrIA;
  3. autorizar por escrito las llamadas y el presupuesto de la fase 2;
  4. la fase 7 enmendada (§ 4.6);
  5. el tope de gasto mensual.
- **`legal`, antes de producción**:
  1. **Contrato de encargo con OpenRouter**: si el DPA de sus condiciones (§ 10.2,
     «incorporated by reference» para uso comercial) vale para una cuenta de pago normal, o
     si solo se firma con Enterprise, como dice su centro de ayuda (P14). Qué dice de los
     proveedores de modelos (¿subencargados?) y de las cláusulas tipo.
  2. **Dónde se procesa**: OpenRouter enruta desde EE. UU.; DeepInfra es de EE. UU.;
     Mistral tiene endpoint en la UE (`mistral/eu`). Si hace falta fijar la UE para
     Mistral, se puede con `only`/`order` (**hipótesis** sobre la sintaxis con la etiqueta).
  3. **Transferencias**: OpenRouter y DeepInfra en la lista del Marco de Privacidad UE-EE.
     UU. (`dataprivacyframework.gov`), o cláusulas tipo en el DPA.
  4. **Términos de cada modelo** (OpenRouter § 5.1): ninguna cláusula de uso clínico.
  5. **La categorización anónima de OpenRouter** (§ 9): si cabe en «ni para nada propio».
  6. Después, **`/privacidad` pasa a la variante A** (`02-politica-privacidad.md:97`), la
     frase de variante B de transferencias desaparece (`:118`), y se actualizan la EIPD
     (M3), el registro de actividades (fila 2), `analisis.md` (P0-3, P1-10 y la frase
     sobre Gemini gratuito, P12) y la *checklist*. Mientras tanto, la variante B sigue
     siendo verdad: dice más riesgo del que habrá, no menos.
- **Tiempo del owner**: § 8, fase 1 (≈ 30 min); leer 6 platos de cada candidato (30 min);
  cambiar el combo y la clave en OmniRoute (15 min); una quincena en producción.

## 6. Riesgos

| Riesgo | Para quién | Probabilidad | Cómo se vería | Cómo se deshace |
| --- | --- | --- | --- | --- |
| **Privacidad: el gateway manda una petición de NutrIA a otra clave suya** (Gemini gratuito, OpenCode) por un combo mal editado | usuarios | media: el gateway guarda esas claves para otros usos del owner | modelo o proveedor fuera de la lista en `ai_calls` (`/admin`) | combo solo `openrouter/…` y clave de NutrIA limitada a ese combo (§ 4.3, capa 3); `stub` mientras se corrige |
| **Privacidad: encender ZDR en la cuenta antes de cambiar el combo** | usuarios | alta si se hace en ese orden | los pasos `:free` de OpenRouter fallan y el combo cae a Gemini gratuito, que incumple sus condiciones en el EEE | el orden de § 8: primero `stub`, después la cuenta |
| **Legal: sin DPA firmado con OpenRouter** (P14) | owner | media | — | `legal` decide; plan B: Mistral directo (UE) como principal o respaldo, o Vercel Pro |
| **Privacidad: la categorización anónima de OpenRouter** | usuarios | baja (muestreo, sin cuenta ni id) | — | `legal` decide si cabe; si no, ruta sin OpenRouter (Mistral directo, Vercel Pro) |
| **Dinero: un bucle o un abuso gasta crédito** | owner | baja: la generación ya está limitada por cuenta (`0015`, `0042`) | `costUsd` en `/admin`; aviso de OpenRouter | tope de la *guardrail* con reinicio mensual; al llegar, OpenRouter rechaza y el plan sale de la biblioteca |
| **Calidad: ningún candidato pasa la medición** | usuarios | media: cero mediciones | fase 2 | se queda `stub` (biblioteca sola) a 0 €, que cumple la regla; o Gemini de pago para usuarios normales, con el owner decidiendo el precio |
| **Calidad: fp4 frente a fp8 según el proveedor al que caiga** | usuarios | media | desviación distinta entre llamadas del mismo modelo | medir con proveedor fijado (fase 2); en producción, `quantizations` en el preset si hace falta |
| **Producción en `stub`: un perfil restrictivo sin platos suficientes** | usuarios con muchas exclusiones | baja–media | `GENERATION_POOL_TOO_SMALL` en los jobs de `/admin` | volver al combo en cuanto la fase 5 esté lista; hoy esos perfiles ya dependían de un gratuito que respondía 2 de 6 |
| **Latencia: DeepInfra más lento de lo esperado** | usuarios | desconocida | `timeout`/`outOfTime` en `ai_calls` | razonamiento `none`; B′; Mistral primero |
| **Esquema: un proveedor ignora `json_schema`** | nadie (fallo recuperable) | baja con `require_parameters` | `invalid_output` en `ai_calls` | `require_parameters: true` en el preset y en la petición |
| **Precio: sube o desaparece un endpoint** | owner | media en meses | factura | otro endpoint ZDR del mismo modelo (hay 20); nada del código nutricional cambia |
| **Seguridad alimentaria** | usuarios | **ninguna nueva**: el modelo sigue sin decidir nada (`0004`) | — | las mismas puertas para cualquier proveedor (`PoolBuilder.validate`, `assertPlanIsSafe`) |

## 7. Coste y esfuerzo

| Pieza | Esfuerzo | Dinero | Variables |
| --- | --- | --- | --- |
| Producción a `stub` | 5 min del owner | 0 | — |
| Cuenta de OpenRouter (crédito, privacidad, *guardrail*, preset) | 30 min del owner | 10,80 $ una vez | — |
| Cambios en `bench-models.mjs` | 1–2 h de agente | 0 | — |
| Medición (fase 2) | 1–2 h de reloj | ≤ 0,43 $ peor caso, ~0,10 $ esperado (+ ≤ 0,31 $ la pasada opcional) | salida real por plato; reintentos: ninguno, el script no reintenta |
| Fase 7 enmendada | 1–1,5 días de agente | 0 | specs con reloj falso, ya previstas |
| Revisión de `legal` y texto de `/privacidad` | 0,5–1 día de agente + lo que diga el abogado | 0 | P14 |
| Producción | — | ~0,3–0,9 $/mes a 50 generaciones, ~3–9 $ a 500, ~33–87 $ a 5.000 (DeepSeek, B′) | esfuerzo de razonamiento, nº de comidas (3–6), cambios de plato, endpoint real |

## 8. Plan

Cada fase se entrega sola. Ninguna gasta dinero sin la autorización escrita del owner con
número de llamadas y presupuesto; ninguna llama a Gemini; ninguna llama a un modelo que
entrene.

**Fase 0 — Cumplir hoy (owner, 5 min, 0 €).** En el proyecto de la API en Vercel,
`AI_PROVIDER=stub` y redesplegar. Métrica: `ai_calls` vacíos en los jobs nuevos y planes
generados con normalidad desde la biblioteca. Parar (volver atrás) si los jobs fallan con
`GENERATION_POOL_TOO_SMALL` más de lo que fallaban antes.

**Fase 1 — La cuenta de OpenRouter (owner, ~30 min).** Los pasos exactos:

1. Comprar **10 $ de crédito** en OpenRouter (con la comisión, 10,80 $ ≈ 9,2–10,3 €).
2. *Settings › Privacy*: **apagar el entrenamiento** para modelos de pago y para
   gratuitos; comprobar que «OpenRouter use of inputs/outputs» y el registro de prompts
   están apagados; **encender ZDR** para toda la cuenta (o, si la cuenta tiene otros usos,
   dejarlo para la *guardrail*).
3. *Workspaces › Guardrails › New Guardrail*, asignada a la clave que usa OmniRoute:
   **tope de gasto de 5 $ con reinicio mensual**, **ZDR impuesto**, y **modelos
   permitidos**: `deepseek/deepseek-v4-flash-0731`, `mistralai/mistral-small-2603`,
   `z-ai/glm-5.3-flash`, `openai/gpt-oss-120b`, `nvidia/nemotron-3-ultra-550b-a55b`.
4. **Escribir la autorización**, por ejemplo: «Autorizo 36 llamadas de pago de la fase 2
   (y 12 más si hace falta la segunda pasada) a esos cinco modelos, con un máximo de 1 $».
   El lead la anota en `LOG.md`.

**Fase 2 — Medir en seco, con el prompt real (agente, 1–2 h).**

- *Cambios en `bench-models.mjs`* (lo demás del script, igual):
  - El filtro, al revés (`:269`). La línea
    `if (!model.endsWith(':free') && !model.startsWith('groq/')) {`
    pasa a ser
    `if (!options.allowPaid.has(model)) {`
    con el mensaje «is not named in --allow-paid», y `--allow-paid id,id` leído como los
    demás flags (`options.allowPaid`, un `Set`, vacío por defecto). Ya no pasa ningún
    `:free` ni `groq/`: los primeros pueden entrenar y los segundos ya están medidos. La
    regla de Gemini (`:265-267`) se queda.
  - `--reasoning-effort <none|minimal|low|medium|high>`, que añade al cuerpo
    `reasoning: { effort }` (el campo de OpenRouter; no `reasoning_effort`).
  - En **cada** petición, fijo:
    `provider: { zdr: true, data_collection: 'deny', require_parameters: true, allow_fallbacks: false, only: ['deepinfra', 'mistral'] }`.
    Con ZDR, esa lista deja un solo proveedor por modelo (DeepInfra para cuatro, Mistral
    para Mistral Small), así que se mide lo mismo que luego se sirve y el precio es
    conocido.
  - Guardar `body.provider` de la respuesta junto a `answeredModel` (`:360`): es la prueba
    de por dónde fue.
- *Las llamadas* (`--dishes 3`, las 6 fichas de la fase 6 —desayuno, comida, cena y
  merienda omnívoros; comida y cena veganas—, `--month 9`, `--max-tokens 16000`, una
  pasada, por el gateway):

  | # | Modelo (id en el gateway) | Proveedor | Razonamiento | Llamadas | Peor caso $ |
  | --- | --- | --- | --- | --- | --- |
  | 1 | `openrouter/deepseek/deepseek-v4-flash-0731` | DeepInfra fp8 (0,06 / 0,18) | `none` | 6 | 0,019 |
  | 2 | `openrouter/deepseek/deepseek-v4-flash-0731` | DeepInfra fp8 | `medium` | 6 | 0,019 |
  | 3 | `openrouter/mistralai/mistral-small-2603` | Mistral ZDR (≤ 0,165 / 0,66) | no se envía | 6 | 0,069 |
  | 4 | `openrouter/z-ai/glm-5.3-flash` | DeepInfra fp4 (0,075 / 0,25) | `low` | 6 | 0,026 |
  | 5 | `openrouter/openai/gpt-oss-120b` | DeepInfra (bf16 0,037 / 0,17; turbo 0,15 / 0,60) | `low` | 6 | 0,063 |
  | 6 | `openrouter/nvidia/nemotron-3-ultra-550b-a55b` | DeepInfra fp4 (0,50 / 2,20) | no se envía — control de la fase 6 | 6 | 0,228 |
  | | **Total** | | | **36** | **≤ 0,43 $ (≈ 0,37–0,41 €)** |
  | 1b | Segunda pasada de los dos mejores (opcional) | | | 12 | ≤ 0,31 $ |

  Peor caso: 5.500 tokens de entrada y 16.000 de salida (el tope de `--max-tokens`) en
  cada llamada, al precio más caro del proveedor fijado. Lo esperado: **~0,10 $** (0,06–0,20
  $), con 4.500 de entrada y 3 platos de 600–2.750 tokens. **Por qué 6 llamadas por
  configuración y no 12**: es una criba — cubre las cuatro comidas y el perfil vegano —, y
  la pasada 1b repite solo lo que merezca repetirse. **Por qué nemotron**, que es el más
  caro: es el único con calidad medida (en su versión gratuita), y separa lo que era
  infraestructura (timeouts) de lo que es el modelo; es el primero que quitar si el owner
  quiere gastar menos (el total baja a ≤ 0,20 $).
- *Métricas de paso, por configuración*: 6/6 respuestas (≥ 11/12 con la 1b); p90 ≤ 120 s;
  ≥ 80 % de platos válidos; desviación mediana ≤ 15 puntos en kcal, P, H y G (muse-spark
  antes: ~11; nemotron gratuito: 19–33); 0 `foreign_food`; ≤ 1 slug desconocido; el
  proveedor de cada respuesta en la lista ZDR; y el owner lee 6 platos de cada una a ciegas:
  «¿lo pondría en mi plan?».
- *Parar* si ninguna configuración pasa: producción se queda en `stub` a 0 €, y la
  pregunta vuelve al owner con dos salidas y su precio: Gemini de pago para usuarios
  normales (0,05–0,33 $ por generación, nunca `/consulta`) o Vercel Pro con muse-spark
  estándar.

**Fase 3 — El código (fase 7 enmendada, § 4.6).** 1–1,5 días. Métrica: specs verdes; una
quincena en dev por el gateway con las llamadas dichas antes, 0 fallos del job, días
dentro del 5 % en los cuatro macros iguales o mejores que con la biblioteca sola
(`evaluate-plans.mjs --compare`), `costUsd` visible en `/admin`. Parar si la quincena sale
peor que sin modelo.

**Fase 4 — `legal` (antes de producción).** Los seis puntos de § 5. Parar si el DPA de
OpenRouter no cubre una cuenta de pago normal: se decide entre Mistral directo y Vercel
Pro antes de seguir.

**Fase 5 — Producción, con tope (owner).** En OpenRouter, el preset `@preset/nutria-zdr`
(§ 4.3) y la *guardrail* reducida a los dos modelos elegidos; en OmniRoute, el preset en
la conexión, el combo de § 4.7 y la clave de NutrIA limitada a ese combo; en Vercel,
`AI_PROVIDER=omniroute` de nuevo. Una semana mirando `/admin`: ≥ 95 % de llamadas
respondidas por el primer paso, p90 del job < 200 s, coste por generación dentro de
§ 4.2, planes con `backfilled` bajo, **ningún modelo ni proveedor fuera de la lista**.
Parar si el primer paso responde < 80 % (se sube el respaldo o se baja el esfuerzo) o si
aparece un proveedor fuera de la lista (vuelta a `stub`).

## 9. Qué no sé

- **La calidad de cualquiera de los candidatos sin entrenamiento** en esta tarea: cero
  mediciones, salvo la versión gratuita de nemotron. La fase 2.
- **Si OmniRoute reenvía de verdad `provider` y `reasoning`** y aplica el preset de la
  conexión: su código dice que sí; ninguna llamada lo ha comprobado. La primera de la fase
  2 lo dice (proveedor que respondió; `reasoning_tokens` a 0 con `none`).
- **Cómo expone el panel de OmniRoute** la lista de modelos permitidos de una clave: el
  campo existe en su base de datos; el runbook solo documenta «Allowed Combos».
- **Si el DPA de OpenRouter cubre una cuenta de pago normal** (P14), si OpenRouter y
  DeepInfra están en el DPF, y si la categorización anónima de prompts se apaga con ZDR.
  `legal` y, si hace falta, el soporte de OpenRouter.
- **La velocidad de DeepInfra y Mistral con este prompt**, y cuánto escribe Mistral Small 4
  por plato con su razonamiento por defecto.
- **Qué combo hay hoy en el gateway de producción** (es configuración del owner).
- **Cuántos perfiles de producción no caben en la biblioteca sola** (el riesgo de `stub`):
  `0001` lo midió en sus perfiles, no en los reales.
- **Cuántas generaciones al mes habrá.** Por debajo de ~500, el modelo cuesta menos de
  10 $ al mes en cualquier caso razonable; por encima, los límites son Vercel y Neon.

## Fuentes (consultadas el 2026-09-25)

- OpenRouter: [lista de modelos](https://openrouter.ai/api/v1/models), `/api/v1/models/{id}/endpoints`
  y [endpoints ZDR](https://openrouter.ai/api/v1/endpoints/zdr) (leídos ~21:30 UTC);
  [selección de proveedor](https://openrouter.ai/docs/guides/routing/provider-selection);
  [políticas de datos de los proveedores](https://openrouter.ai/docs/guides/privacy/provider-logging);
  [ZDR](https://openrouter.ai/docs/guides/features/zdr);
  [qué guarda OpenRouter](https://openrouter.ai/docs/guides/privacy/data-collection);
  [presets](https://openrouter.ai/docs/guides/features/presets);
  [guardrails](https://openrouter.ai/docs/guides/features/guardrails);
  [límite por clave](https://openrouter.ai/docs/guides/overview/auth/provisioning-api-keys);
  [razonamiento](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens);
  [FAQ (comisión, gratuitos)](https://openrouter.ai/docs/faq);
  [condiciones, actualizadas 2026-08-31](https://openrouter.ai/terms);
  [DPA en el centro de ayuda](https://openrouter.zendesk.com/hc/en-us/articles/47828437697051-How-do-I-get-OpenRouter-s-Data-Processing-Agreement-DPA-for-GDPR-compliance);
  [Nemotron 3 Ultra (free)](https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free).
- OmniRoute: código público en la etiqueta [`v3.8.50`](https://github.com/diegosouzapw/OmniRoute/tree/v3.8.50)
  (`open-sse/executors/default.ts`, `open-sse/translator/index.ts`, `paramSupport.ts`,
  `src/lib/providers/requestDefaults.ts`, `src/lib/db/jsonMigration.ts`, `CHANGELOG.md`).
- Meta: [precios de la Model API](https://dev.meta.ai/docs/pricing-rate-limits).
- Google: [Gemini API Additional Terms, vigentes 2026-03-23](https://ai.google.dev/gemini-api/terms).
- OpenCode: [Zen, actualizada 2026-09-25](https://opencode.ai/docs/zen/).
- Mistral: [ZDR](https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr);
  [uso de datos para entrenar](https://help.mistral.ai/en/articles/323757-do-you-use-my-user-data-to-train-your-artificial-intelligence-models).
- Groq: [tus datos en GroqCloud](https://console.groq.com/docs/your-data).
- Vercel AI Gateway: [modelos](https://ai-gateway.vercel.sh/v1/models) (campos `zdr`,
  `no_training`, `reasoning_options`);
  [no entrenar, 2026-09-10](https://vercel.com/docs/ai-gateway/security-and-compliance/disallow-prompt-training);
  [ZDR, 2026-09-22](https://vercel.com/docs/ai-gateway/security-and-compliance/zdr);
  [precios, 2026-09-08](https://vercel.com/docs/ai-gateway/pricing).
- Resumen de terceros sobre DeepSeek y otros: [betterclaw.io, 2026-09-15](https://www.betterclaw.io/blog/ai-provider-training-data-policy-2026).
- DeepSeek: [modo JSON](https://api-docs.deepseek.com/guides/json_mode).
