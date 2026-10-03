# 0009 — Más acompañamientos: el primer lote de 42

> **Purpose**: borrador del agente `architect` para la fase 1 del proyecto 018 (más
> acompañamientos). Contiene 42 acompañamientos nuevos, cada uno listo para pegar en
> `core/domain/Accompaniment` y en el diccionario web, con sus macros calculadas del catálogo.
> Incluye también las premisas del PRD que el código no sostiene y lo que falta en el
> catálogo. El lead acepta o rechaza cada entrada y lo apunta en el LOG del proyecto.
> **Audience**: el owner, el lead y los agentes de las fases 2 y 3. **Committed**: sí.
> **Maintained by**: el agente `architect`. Una vez fusionado no se edita; una revisión
> posterior es un informe nuevo.
>
> **Base**: la rama `agent/plan-018/lead-018` en `d99b4e82`, que es `main` con 017 fase 2
> (#202) y el plan de 018.
>
> **Números**: cada uno lleva su etiqueta: **medido** (dónde), **estimado** (con la
> hipótesis) o **desconocido**. Las macros de las entradas las calculé con un script que
> lee las filas del seed (`packages/database/src/seed/ingredients/*.ts`). Suma como
> `composeMacros` (`core/domain/Composition/Composition.ts:18`) y redondea a la décima
> como `round`. Son las cifras que el código dará, no una estimación.
>
> **Medición**: no hubo ninguna llamada a un modelo ni ninguna lectura de Neon. El único
> servicio externo consultado es la API pública de USDA FoodData Central, para una fila
> (`picos-de-pan`).

## Veredicto

**Sí, con condiciones.** Hay 42 entradas listas:
- 22 de familia española;
- 4 asiáticas, 4 latinas y 5 árabes;
- 7 para todas las familias.

Todas usan filas que ya están en el catálogo, y todas esas filas son USDA salvo una:
`picos-de-pan` es BEDCA y queda condicionada. **No falta ningún slug.** Ninguna entrada
española lleva una fila que `traditional_spanish` excluya. Toda línea de preparación nombra
el aceite exacto de su ración. Las condiciones:

1. **El desayuno no recibe acompañamientos hoy.** El planificador solo los ofrece en comida
   y cena, y solo cuando esa comida pasa de 700 kcal (`Scheduler.ts:272` y `:774`,
   `MAIN_SLOTS` en `Variety.ts:35`). Las 11 entradas nuevas con desayuno cumplen el criterio
   del PRD sobre el papel. Nueve de ellas también sirven en comida y cena, y esas sí se
   verán. Dos son solo de desayuno: `tostada-con-aceite` y `avellanas`. Esas dos, igual que
   las nueces, las almendras y los quesos de hoy, no llegan a ningún plan. Que el desayuno
   lleve acompañamientos es un cambio del planificador fuera del alcance de 018. **Decide
   el lead.**
2. **El tiempo de `schedulePlan` está en riesgo.** El número de conjuntos que el planificador
   valora por plato, comida y día en la familia española pasa de 410 a 2.666 de media, ×6,5
   (medido por combinatoria, sin los filtros de cada persona; ver § Riesgos). El PRD pide
   no pasar de +10 %. Hay que medirlo al principio de la fase 3, con una señal de parada y
   un remedio ya pensado.
3. **Más entradas no garantizan más variedad.** El planificador elige el conjunto que mejor
   cierra las macros y deshace empates por el orden de la tabla. No hay ningún coste por
   repetir un acompañamiento (`rankedSets`, `Scheduler.ts:298`). Que suban los
   acompañamientos distintos por quincena es una **hipótesis** que mide la fase 3. Si no
   suben, falta una regla de repetición, que es un cambio del planificador.
4. **`picos-de-pan` depende de re-fuentear su fila** de BEDCA a USDA (FDC 174929). Eso es
   un `UPDATE` de una fila que ya existe, no el `INSERT … ON CONFLICT DO NOTHING` de la
   fase 2. Mi recomendación: la entrada entra solo cuando lo haga la tarea pendiente de
   re-fuentear las 14 filas BEDCA. Si no, se queda fuera de este lote.
5. **`espinacas-a-la-catalana` lleva 5 g de piñones en comida y cena.** La respuesta 7 del
   owner en `0079` dice que los frutos secos como acompañamiento son solo de desayuno.
   Leo que habla del fruto seco servido como acompañamiento, no de la guarnición de una
   verdura. Recomiendo aceptarla: es el caso de frutos de cáscara que la fase 3 necesita en
   comida y cena. Pero choca con la letra de esa respuesta, así que la marco.

## Premisas revisadas

| Premisa (PRD 018) | Estado | Evidencia |
|---|---|---|
| Faltan guarniciones españolas: cremas de verdura, caldo, pimientos asados, menestra, setas, pan integral, picos | **confirmada, salvo el pan integral**, que es **incorrecta** | `pan-integral` está en `ACCOMPANIMENTS` (`Accompaniment.ts:86`) y en la tabla 3a de `0079`. Lo demás no está |
| Asiática, latina y árabe tienen 2–3 opciones cada una | **confirmada a medias** | Propias de cada familia: asiática 4 (`arroz-blanco`, `sopa-de-miso`, `ensalada-de-pepino`, `pak-choi-salteado`), latina 4 (`tortilla-de-maiz`, `arroz-rojo`, `pico-de-gallo`, `frijoles`), árabe 5 (`pan-de-pita`, `hummus`, `ensalada-marroqui`, `tabule`, `naranja-con-canela`). Las tres comparten además `ensalada-verde`, la fruta y el yogur. Por papel son 1–3, y eso es lo que el PRD quiere decir |
| El desayuno gana al menos 5 | **incorrecta como variedad servida** | El desayuno no recibe acompañamientos (`Scheduler.ts:272`, `:774`; `MAIN_SLOTS` = comida y cena, `Variety.ts:35`). Lo mismo dice el plan de 016, línea 21: "at K = 6 per main slot" |
| Los mismos acompañamientos vuelven en la quincena, y más entradas lo arreglan | **hipótesis** | La elección es por ajuste de macros, con empates por posición en la tabla, y no hay coste de repetición (`Scheduler.ts:291–310`). Se prueba con la cuenta de distintos por perfil y quincena que la fase 3 añade al evaluador |
| Los acompañamientos actuales son "USDA salvo `queso-de-burgos`" (comentario en `Accompaniment.ts:74–82`) | **incorrecta** | En el seed, cinco filas que ya se usan son `manual`, no USDA: `requeson`, `pan-sin-gluten`, `alga-wakame`, `salsa-de-soja-baja-en-sal` y `vinagre-de-arroz`. No es BEDCA, pero tampoco es una fuente pública. Mi regla para el lote: solo filas USDA; ninguna `manual`; BEDCA nunca, salvo `picos-de-pan`, y esa queda condicionada |
| Los filtros de la despensa (`larderFor`) cubren cualquier entrada nueva | **confirmada para alergias, intolerancias, formas de comer y gustos** | `larderFor` pasa cada fila por `dishSafety` y por `excludedIngredientIds` (`Accompaniment.ts:368–396`), y el conjunto se juzga otra vez con el plato para kosher (`setsBeside`, `:530`) |
| "El tradicional español nunca recibe uno extranjero" lo garantiza la despensa | **incorrecta para 5 entradas** | `ensalada-de-zanahoria-marroqui`, `ensalada-de-remolacha`, `cuscus`, `datiles` y `elote` no llevan ninguna fila de la lista de `0077` (`Preference.ts:98`). Lo que los aparta es que solo se ofrecen junto a un plato de su familia (`portionsBeside`, `:483`), y que `traditional_spanish` rechaza los platos de cocina extranjera (`FOREIGN_CUISINES`, `Preference.ts:761–821`). La prueba de la fase 3 debe ir por `setsBeside` con un plato de esa familia, no solo por `larderFor` |
| `schedulePlan` se queda dentro de +10 % | **hipótesis en riesgo** | Los conjuntos por clave de caché crecen ×6,5 en la familia española (§ Riesgos) |
| Las reglas de grupo de `0079` (arroz, pasta, granos, patata, legumbre) se aplican al acompañamiento como al plato | **incorrecta en un detalle** | `itemGroups` (`Accompaniment.ts:446`) no tiene umbral de gramos; `dishGroups` sí (`FOOD_GROUP_GRAMS`, `Cuisine.ts:184`). Un acompañamiento con 10 g de fideos ya es "pasta": en una mesa española quedaría solo para la comida. Por eso no propongo "caldo con fideos". Ninguna entrada del lote depende de una cantidad pequeña de un grupo |

## Qué hay hoy

- **La lista**: 46 entradas en `ACCOMPANIMENTS` (`Accompaniment.ts:83–317`). Son 10
  almidones, 15 verduras y 21 postres; 18 compuestas, con nombre en `COMPOSED_NAMES`
  (`:566`) y preparación en `COMPOSED_PREPARATIONS` (`:594`). Cada una tiene su frase web
  en `meal.accompanimentNames` (`apps/web/src/i18n/dictionaries/es-ES.ts:1706`, y el mismo
  bloque en `en-GB.ts`). Si una clave no tiene frase, la pantalla muestra el nombre que manda
  la API (`apps/web/src/lib/accompaniments.ts:18`).
- **Cómo se filtra**:
  - `larderFor` aplica la seguridad y las exclusiones de la persona.
  - `portionsBeside` aplica la familia del plato, la comida, la tabla 2 de `0079` para el
    grupo del propio acompañamiento, la temporada (filtro duro) y "no repetir lo que ya
    lleva el plato": pan con pan, el mismo grupo, fruta con fruta.
  - `setsBeside` vuelve a juzgar el conjunto con el plato.
- **Cómo se elige**:
  - Solo en comida y cena, y solo cuando esa comida pasa de 700 kcal
    (`ACCOMPANIED_FROM_KCAL`, `Scheduler.ts:213`).
  - `setsOf` forma todos los conjuntos posibles: nada, o un almidón, una verdura y un
    postre como mucho. Es el producto de los tres papeles (`:501`).
  - `rankedSets` los valora todos y se queda con los 6 que mejor cierran el hueco de
    macros (`:298`).
  - Los acompañamientos no pueden pasar del 35 % de la energía de la comida
    (`ACCOMPANIMENT_MAX_SHARE`, `:224`).
  - La caché de conjuntos se guarda por plato, comida, mes y presupuesto del día (`:276`).
- **Nombres**: una entrada es compuesta si tiene más de una fila o si su fila no se llama
  como su clave (`isComposed`, `:684`). Las compuestas necesitan nombre y preparación en los
  dos idiomas. Las simples toman el nombre del catálogo.

## Cómo está hecho el lote

- **Ingredientes**: solo filas del catálogo con fuente `usda`, salvo `picos-de-pan`. Lo
  comprueba el script, entrada por entrada (§ Comprobaciones).
- **Raciones**: las de la AESAN que ya usa `0079`:
  - verdura, 150–200 g de producto crudo; las cremas llevan más porque son sobre todo
    agua de cocción, que no cuenta;
  - fruta, 120–200 g;
  - pan, 30–60 g;
  - patata, 150 g.
- **Aceite**: solo si la ración lo lleva, y entonces la frase dice exactamente cuánto. 5 g
  es "una cucharadita" y 10 g "dos cucharaditas". Ninguna frase nombra otra grasa.
- **Meses**: en una compuesta salen de cruzar los meses de sus filas frescas, con dos
  excepciones declaradas, igual que hizo el gazpacho en `0079`:
  - **Los caldos** (10–4): es lo que se toma en los meses fríos. Sus filas no tienen
    temporada.
  - **`pan-con-tomate`** (todo el año): lleva tomate triturado de bote, como `arroz-rojo`.
- **Familias**:
  - Las españolas usan `SPANISH` (española y "otras"). Tres de ellas son también italianas:
    `tomate-alinado`, `alcachofas-a-la-plancha` y `esparragos-trigueros-a-la-plancha`.
  - Las extranjeras, solo su familia.
  - La fruta, el yogur con miel, la macedonia y las avellanas, todas las familias, como las
    simples de hoy.
- **Forma**: cada entrada va como literal de TypeScript con las ayudas del propio fichero
  (`composed`, `fruit`, `BLD`, `LD`, `SPANISH`, `SUMMER`), más su nombre, su preparación y
  sus frases web. La fase 3 solo tiene que pegar y ordenar las claves. Comprobé que los
  literales se evalúan y que dan exactamente las entradas de las tablas.
- **Leyenda de las tablas**: comidas D desayuno, C comida, Ce cena. Las macros son por
  ración: kcal, proteína, hidratos, grasa y fibra en gramos. "Clases" son las del catálogo
  que ningún alérgeno revela (`meat`, `animal`), las que leen vegetarianos, veganos y kosher.

