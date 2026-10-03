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
6. **Los dos caldos no entran hasta que sus filas declaren el apio.** `caldo-de-pollo` y
   `caldo-de-verduras` no tienen ningún alérgeno en el seed (`starter.ts:1060`, `:1071`).
   En cambio, `pastilla-de-caldo-de-verduras` y `sopa-de-verduras-envasada` sí llevan
   "puede contener apio". Un caldo de brick español casi siempre lleva apio. Como plato
   aparte, el caldo llegaría a alguien alérgico al apio sin que nada lo pare. El arreglo:
   añadir el enlace `celery` a las dos filas en la migración revisada de la fase 2. Eso
   protege también a los platos que ya los usan. Hasta entonces, recomiendo rechazar las
   dos entradas. Es un hallazgo de seguridad: va el primero en § Riesgos.

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

## Propuesta

### 1. Familia española: comida y cena (20)

Son guarniciones de casa, de las que se ponen en una mesa española:
- **tres cremas**: calabacín en verano, calabaza en otoño e invierno, puerros todo el año;
- **dos caldos**;
- **verduras de temporada** para cada época:
  - pimientos asados y escalivada a final de verano;
  - acelgas, coliflor y espinacas en invierno;
  - alcachofas y trigueros en primavera;
- **menestra, champiñones y zanahorias aliñadas** todo el año;
- **dos patatas**: cocida y en puré;
- **salmorejo** en verano;
- **picos**.

Con ellas, las opciones de verdura junto a un plato español pasan de 2–5 a 11–18 según el
mes. Hoy, de octubre a mayo, son 2 o 3, porque solo `ensalada-verde` es de todo el año
(medido por combinatoria sobre la lista, sin filtros de persona).

Notas por entrada:
- **`crema-de-puerros`, `patata-cocida`, `pure-de-patata`** son del grupo patata (`0079`,
  tabla 2). En la mesa española encajan en comida y cena, pero no se ofrecen junto a un
  plato que ya lleve 100 g o más de patata por ración (`Accompaniment.ts:485`). Es lo que
  se quiere.
- **`caldo-de-pollo`** tiene la clase `meat`: vegetarianos y veganos no lo reciben y
  tienen `caldo-de-verduras`. Para kosher, `setsBeside` impide servirlo con un yogur
  (`Accompaniment.ts:542`). Los dos caldos aportan 15 kcal: sirven para variar, no para
  cerrar macros (§ Riesgos, punto 4). **No deben entrar hasta que sus filas declaren el
  apio** (condición 6 del veredicto).
- **`salmorejo`** lleva 30 g de pan y es el caso de gluten en comida y cena. Como su papel
  es verdura, el filtro "pan junto a pan" no lo mira: puede salir con pan en el papel de
  almidón. Son 60–90 g de pan entre los dos, dentro de la ración de la AESAN.
- **`espinacas-a-la-catalana`**: ver la condición 5 del veredicto (frutos de cáscara en
  comida y cena).
- **`menestra-de-verduras`** usa las filas congeladas USDA (judía verde, guisantes,
  coliflor), así que es de todo el año. La menestra de temporada (alcachofa, habas y
  guisantes frescos) solo coincidiría en mayo. Las filas `menestra-congelada` y
  `alcachofas-congeladas` son `manual` y no las uso.
- **`picos-de-pan`** es condicional: ver la condición 4 y § Filas que faltan. Le doy dos
  raciones, 20 y 30 g, en vez de las 30 y 60 g de `bread()`. 60 g de picos son unas
  250 kcal.
- **Lo que dejé fuera**:
  - **pimientos de Padrón**: su fila es `manual`; con la de pimiento verde USDA serían
    otra entrada que re-fuentear;
  - **pisto y pipirrana**: más plato que guarnición, o casi iguales a lo que ya hay en
    verano;
  - **caldo con fideos**: por el detalle de `itemGroups`;
  - **setas variadas**: los champiñones ya cubren "setas" y cada verdura de todo el año
    encarece el planificador (§ Riesgos).

| Clave | Papel | Familias | Comidas | Meses | Ración | kcal | P | HC | G | Fibra | Alérgenos | Clases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `crema-de-calabacin` | vegetable | spanish, other | C Ce | 5, 6, 7, 8, 9 | 295.5 g | 102.7 | 3.4 | 11.5 | 5.8 | 3.2 | — | — |
| `crema-de-calabaza` | vegetable | spanish, other | C Ce | 9, 10, 11, 12, 1, 2, 3 | 325.5 g | 137.6 | 3.2 | 22.9 | 5.4 | 2.9 | — | — |
| `crema-de-puerros` | vegetable | spanish, other | C Ce | todo el año | 225.5 g | 187 | 3.6 | 32.9 | 5.5 | 4.2 | — | — |
| `caldo-de-pollo` | vegetable | spanish, other | C Ce | 10, 11, 12, 1, 2, 3, 4 | 250 g | 15 | 1.5 | 1 | 0.5 | 0 | — | meat |
| `caldo-de-verduras` | vegetable | spanish, other | C Ce | 10, 11, 12, 1, 2, 3, 4 | 250 g | 15 | 0.5 | 2.5 | 0.3 | 0 | — | — |
| `pimientos-asados` | vegetable | spanish, other | C Ce | 7, 8, 9, 10 | 157.5 g | 86.2 | 1.6 | 9.7 | 5.5 | 3.2 | — | — |
| `menestra-de-verduras` | vegetable | spanish, other | C Ce | todo el año | 177.5 g | 116.7 | 3.9 | 15.1 | 5.4 | 4.8 | — | — |
| `champinones-al-ajillo` | vegetable | spanish, other | C Ce | todo el año | 162.5 g | 84.2 | 5 | 6.5 | 5.5 | 1.7 | — | — |
| `tomate-alinado` | vegetable | spanish, other, italian | C Ce | 6, 7, 8, 9 | 189.5 g | 79.2 | 1.8 | 7.5 | 5.4 | 2.3 | — | — |
| `escalivada` | vegetable | spanish, other | C Ce | 7, 8, 9, 10 | 225.5 g | 106 | 2.2 | 14.4 | 5.5 | 5.4 | — | — |
| `espinacas-a-la-catalana` | vegetable | spanish, other | C Ce | 10, 11, 12, 1, 2, 3, 4, 5, 6 | 172.5 g | 145.4 | 5.5 | 14.7 | 9.1 | 3.9 | tree_nuts | — |
| `acelgas-rehogadas` | vegetable | spanish, other | C Ce | 8, 9, 10, 11, 12, 1, 2, 3, 4, 5 | 209 g | 88.1 | 3.9 | 8.7 | 5.5 | 3.4 | — | — |
| `coliflor-al-ajoarriero` | vegetable | spanish, other | C Ce | 9, 10, 11, 12, 1, 2, 3, 4 | 162.5 g | 89.6 | 3.2 | 9 | 5.6 | 3.4 | — | — |
| `alcachofas-a-la-plancha` | vegetable | spanish, other, italian | C Ce | 12, 1, 2, 3, 4, 5 | 160.5 g | 116.2 | 5 | 16.2 | 5.2 | 8.2 | — | — |
| `esparragos-trigueros-a-la-plancha` | vegetable | spanish, other, italian | C Ce | 3, 4, 5, 6, 9 | 155.5 g | 74.2 | 3.3 | 5.9 | 5.2 | 3.2 | — | — |
| `zanahorias-alinadas` | vegetable | spanish, other | C Ce | todo el año | 133.5 g | 100.5 | 1.3 | 12.8 | 5.4 | 3.7 | — | — |
| `patata-cocida` | starch | spanish, other | C Ce | todo el año | 157.5 g | 160.4 | 3.1 | 26.4 | 5.2 | 3.2 | — | — |
| `pure-de-patata` | starch | spanish, other | C Ce | todo el año | 195.5 g | 179.7 | 4.3 | 28.2 | 6 | 3.2 | lactose, milk | — |
| `salmorejo` | vegetable | spanish, other | C Ce | 6, 7, 8, 9 | 243 g | 214.4 | 4.6 | 24.8 | 11.6 | 3.3 | gluten | — |
| `picos-de-pan` | starch | spanish, other | D C Ce | todo el año | 20 g | 79.8 | 2.2 | 14.6 | 1.4 | 0.7 | gluten | — |
|  | | | | | 30 g | 119.7 | 3.3 | 21.9 | 2.1 | 1.1 |  |  |

`ACCOMPANIMENTS`:

```ts
  composed(
    'crema-de-calabacin',
    'vegetable',
    SPANISH,
    [5, 6, 7, 8, 9],
    [
      { grams: 250, slug: 'calabacin' },
      { grams: 40, slug: 'cebolla' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'crema-de-calabaza',
    'vegetable',
    SPANISH,
    [9, 10, 11, 12, 1, 2, 3],
    [
      { grams: 250, slug: 'calabaza' },
      { grams: 40, slug: 'zanahoria' },
      { grams: 30, slug: 'cebolla' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'crema-de-puerros',
    'vegetable',
    SPANISH,
    'all',
    [
      { grams: 120, slug: 'puerro' },
      { grams: 80, slug: 'patata' },
      { grams: 20, slug: 'cebolla' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  {
    families: SPANISH,
    key: 'caldo-de-pollo',
    months: [10, 11, 12, 1, 2, 3, 4],
    portions: [[{ grams: 250, slug: 'caldo-de-pollo' }]],
    role: 'vegetable',
    slots: LD
  },
  {
    families: SPANISH,
    key: 'caldo-de-verduras',
    months: [10, 11, 12, 1, 2, 3, 4],
    portions: [[{ grams: 250, slug: 'caldo-de-verduras' }]],
    role: 'vegetable',
    slots: LD
  },
  composed(
    'pimientos-asados',
    'vegetable',
    SPANISH,
    [7, 8, 9, 10],
    [
      { grams: 150, slug: 'pimiento-rojo' },
      { grams: 2, slug: 'ajo' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'menestra-de-verduras',
    'vegetable',
    SPANISH,
    'all',
    [
      { grams: 50, slug: 'judia-verde-congelada' },
      { grams: 30, slug: 'guisantes-congelados' },
      { grams: 40, slug: 'coliflor-congelada' },
      { grams: 30, slug: 'zanahoria' },
      { grams: 20, slug: 'cebolla' },
      { grams: 2, slug: 'ajo' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'champinones-al-ajillo',
    'vegetable',
    SPANISH,
    'all',
    [
      { grams: 150, slug: 'champinon' },
      { grams: 4, slug: 'ajo' },
      { grams: 3, slug: 'perejil' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'tomate-alinado',
    'vegetable',
    [...SPANISH, 'italian'],
    SUMMER,
    [
      { grams: 180, slug: 'tomate' },
      { grams: 1, slug: 'ajo' },
      { grams: 3, slug: 'perejil' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'escalivada',
    'vegetable',
    SPANISH,
    [7, 8, 9, 10],
    [
      { grams: 100, slug: 'berenjena' },
      { grams: 80, slug: 'pimiento-rojo' },
      { grams: 40, slug: 'cebolla' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'espinacas-a-la-catalana',
    'vegetable',
    SPANISH,
    [10, 11, 12, 1, 2, 3, 4, 5, 6],
    [
      { grams: 150, slug: 'espinaca' },
      { grams: 10, slug: 'pasas' },
      { grams: 5, slug: 'pinones' },
      { grams: 2, slug: 'ajo' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'acelgas-rehogadas',
    'vegetable',
    SPANISH,
    [8, 9, 10, 11, 12, 1, 2, 3, 4, 5],
    [
      { grams: 200, slug: 'acelga' },
      { grams: 3, slug: 'ajo' },
      { grams: 0.5, slug: 'pimenton-dulce' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'coliflor-al-ajoarriero',
    'vegetable',
    SPANISH,
    [9, 10, 11, 12, 1, 2, 3, 4],
    [
      { grams: 150, slug: 'coliflor' },
      { grams: 3, slug: 'ajo' },
      { grams: 1, slug: 'pimenton-dulce' },
      { grams: 3, slug: 'vinagre-de-vino-tinto' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'alcachofas-a-la-plancha',
    'vegetable',
    [...SPANISH, 'italian'],
    [12, 1, 2, 3, 4, 5],
    [
      { grams: 150, slug: 'alcachofa' },
      { grams: 5, slug: 'limon' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'esparragos-trigueros-a-la-plancha',
    'vegetable',
    [...SPANISH, 'italian'],
    [3, 4, 5, 6, 9],
    [
      { grams: 150, slug: 'esparrago-verde' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'zanahorias-alinadas',
    'vegetable',
    SPANISH,
    'all',
    [
      { grams: 120, slug: 'zanahoria' },
      { grams: 2, slug: 'ajo' },
      { grams: 0.5, slug: 'comino-molido' },
      { grams: 0.5, slug: 'oregano-seco' },
      { grams: 5, slug: 'vinagre-de-vino-tinto' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'patata-cocida',
    'starch',
    SPANISH,
    'all',
    [
      { grams: 150, slug: 'patata' },
      { grams: 2, slug: 'perejil' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'pure-de-patata',
    'starch',
    SPANISH,
    'all',
    [
      { grams: 150, slug: 'patata' },
      { grams: 40, slug: 'leche-semidesnatada' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'salmorejo',
    'vegetable',
    SPANISH,
    SUMMER,
    [
      { grams: 200, slug: 'tomate' },
      { grams: 30, slug: 'pan-blanco' },
      { grams: 2, slug: 'ajo' },
      { grams: 10, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 1, slug: 'sal' }
    ]
  ),
  {
    families: SPANISH,
    key: 'picos-de-pan',
    months: 'all',
    portions: [[{ grams: 20, slug: 'picos-de-pan' }], [{ grams: 30, slug: 'picos-de-pan' }]],
    role: 'starch',
    slots: BLD
  },
```

`COMPOSED_NAMES`:

```ts
  'crema-de-calabacin': { 'en-GB': 'Courgette soup', 'es-ES': 'Crema de calabacín' },
  'crema-de-calabaza': { 'en-GB': 'Pumpkin soup', 'es-ES': 'Crema de calabaza' },
  'crema-de-puerros': { 'en-GB': 'Leek and potato soup', 'es-ES': 'Crema de puerros' },
  'pimientos-asados': { 'en-GB': 'Roasted red peppers', 'es-ES': 'Pimientos asados' },
  'menestra-de-verduras': { 'en-GB': 'Mixed vegetable menestra', 'es-ES': 'Menestra de verduras' },
  'champinones-al-ajillo': { 'en-GB': 'Garlic mushrooms', 'es-ES': 'Champiñones al ajillo' },
  'tomate-alinado': { 'en-GB': 'Dressed tomatoes', 'es-ES': 'Tomate aliñado' },
  escalivada: { 'en-GB': 'Catalan roasted vegetables', 'es-ES': 'Escalivada' },
  'espinacas-a-la-catalana': { 'en-GB': 'Catalan spinach with raisins and pine nuts', 'es-ES': 'Espinacas a la catalana' },
  'acelgas-rehogadas': { 'en-GB': 'Sautéed Swiss chard', 'es-ES': 'Acelgas rehogadas' },
  'coliflor-al-ajoarriero': { 'en-GB': 'Cauliflower with garlic and paprika', 'es-ES': 'Coliflor al ajoarriero' },
  'alcachofas-a-la-plancha': { 'en-GB': 'Griddled artichokes', 'es-ES': 'Alcachofas a la plancha' },
  'esparragos-trigueros-a-la-plancha': { 'en-GB': 'Griddled green asparagus', 'es-ES': 'Espárragos trigueros a la plancha' },
  'zanahorias-alinadas': { 'en-GB': 'Marinated carrots', 'es-ES': 'Zanahorias aliñadas' },
  'patata-cocida': { 'en-GB': 'Boiled potatoes', 'es-ES': 'Patata cocida' },
  'pure-de-patata': { 'en-GB': 'Mashed potato', 'es-ES': 'Puré de patata' },
  salmorejo: { 'en-GB': 'Salmorejo', 'es-ES': 'Salmorejo' },
```

`COMPOSED_PREPARATIONS`:

```ts
  'crema-de-calabacin': {
    'en-GB': 'Soften the chopped onion in a teaspoon of oil, add the chopped courgette and just enough water to cover, simmer for about 15 minutes, salt and blend until smooth.',
    'es-ES': 'Rehoga la cebolla picada con una cucharadita de aceite, añade el calabacín troceado y agua justo hasta cubrir, cuécelo unos 15 minutos, sala y tritúralo fino.'
  },
  'crema-de-calabaza': {
    'en-GB': 'Soften the chopped onion in a teaspoon of oil, add the pumpkin and carrot in chunks and just enough water to cover, simmer for about 20 minutes, salt and blend until smooth.',
    'es-ES': 'Rehoga la cebolla picada con una cucharadita de aceite, añade la calabaza y la zanahoria en trozos y agua justo hasta cubrir, cuécelo unos 20 minutos, sala y tritúralo fino.'
  },
  'crema-de-puerros': {
    'en-GB': 'Soften the sliced leek and onion in a teaspoon of oil, add the potato in chunks and just enough water to cover, simmer for about 20 minutes, salt and blend until smooth.',
    'es-ES': 'Rehoga el puerro y la cebolla en rodajas con una cucharadita de aceite, añade la patata en trozos y agua justo hasta cubrir, cuécelo unos 20 minutos, sala y tritúralo fino.'
  },
  'pimientos-asados': {
    'en-GB': 'Roast the whole peppers at 200 °C for about 40 minutes, leave them to rest covered, peel them, cut them into strips and dress with the chopped garlic, a teaspoon of oil and the salt.',
    'es-ES': 'Asa los pimientos enteros en el horno a 200 °C unos 40 minutos, déjalos reposar tapados, pélalos, córtalos en tiras y alíñalos con el ajo picado, una cucharadita de aceite y la sal.'
  },
  'menestra-de-verduras': {
    'en-GB': 'Boil the frozen vegetables and the sliced carrot in water with the salt for about 8 minutes, drain and toss them for a couple of minutes with the chopped onion and garlic and a teaspoon of oil.',
    'es-ES': 'Cuece las verduras congeladas y la zanahoria en rodajas en agua con la sal unos 8 minutos, escúrrelas y rehógalas un par de minutos con la cebolla y el ajo picados y una cucharadita de aceite.'
  },
  'champinones-al-ajillo': {
    'en-GB': 'Sauté the sliced mushrooms over high heat in a teaspoon of oil until golden, add the sliced garlic for one more minute and finish with the chopped parsley and the salt.',
    'es-ES': 'Saltea los champiñones laminados a fuego vivo con una cucharadita de aceite hasta que se doren, añade el ajo laminado un minuto más y termina con el perejil picado y la sal.'
  },
  'tomate-alinado': {
    'en-GB': 'Slice the tomatoes and dress them with the finely chopped garlic and parsley, a teaspoon of oil and the salt.',
    'es-ES': 'Corta el tomate en rodajas y alíñalo con el ajo y el perejil muy picados, una cucharadita de aceite y la sal.'
  },
  escalivada: {
    'en-GB': 'Roast the whole aubergine, pepper and onion at 200 °C for about 45 minutes, peel them, cut them into strips and dress with a teaspoon of oil and the salt.',
    'es-ES': 'Asa la berenjena, el pimiento y la cebolla enteros en el horno a 200 °C unos 45 minutos, pélalos, córtalos en tiras y alíñalos con una cucharadita de aceite y la sal.'
  },
  'espinacas-a-la-catalana': {
    'en-GB': 'Toast the pine nuts and sliced garlic in a teaspoon of oil, add the raisins and the spinach and stir until it wilts; salt at the end.',
    'es-ES': 'Dora los piñones y el ajo laminado con una cucharadita de aceite, añade las pasas y las espinacas y saltéalas hasta que pierdan volumen; sala al final.'
  },
  'acelgas-rehogadas': {
    'en-GB': 'Boil the chopped chard in water with the salt for about 6 minutes, drain and sauté with the sliced garlic and a teaspoon of oil; take off the heat and dust with the paprika.',
    'es-ES': 'Cuece las acelgas troceadas en agua con la sal unos 6 minutos, escúrrelas y rehógalas con el ajo laminado y una cucharadita de aceite; aparta del fuego y espolvorea el pimentón.'
  },
  'coliflor-al-ajoarriero': {
    'en-GB': 'Boil the cauliflower florets in water with the salt for about 8 minutes and drain; brown the sliced garlic in a teaspoon of oil, take off the heat, stir in the paprika and vinegar and pour over the cauliflower.',
    'es-ES': 'Cuece la coliflor en ramilletes en agua con la sal unos 8 minutos y escúrrela; dora el ajo laminado con una cucharadita de aceite, aparta del fuego, añade el pimentón y el vinagre y riega la coliflor.'
  },
  'alcachofas-a-la-plancha': {
    'en-GB': 'Trim the artichokes down to their hearts, halve them, rub them with the lemon and griddle them with a teaspoon of oil for about 8 minutes a side; salt at the end.',
    'es-ES': 'Limpia las alcachofas hasta dejar los corazones, pártelos por la mitad, frótalos con el limón y hazlos a la plancha con una cucharadita de aceite unos 8 minutos por lado; sala al final.'
  },
  'esparragos-trigueros-a-la-plancha': {
    'en-GB': 'Snap off the woody ends, brush the asparagus with a teaspoon of oil and cook on a very hot griddle for about 5 minutes, turning them; salt at the end.',
    'es-ES': 'Quita la parte dura de los espárragos, úntalos con una cucharadita de aceite y hazlos a la plancha bien caliente unos 5 minutos, dándoles la vuelta; sala al final.'
  },
  'zanahorias-alinadas': {
    'en-GB': 'Boil the sliced carrots in water with the salt for about 8 minutes, drain and dress with the chopped garlic, cumin, oregano, vinegar and a teaspoon of oil; serve cold.',
    'es-ES': 'Cuece la zanahoria en rodajas en agua con la sal unos 8 minutos, escúrrela y alíñala con el ajo picado, el comino, el orégano, el vinagre y una cucharadita de aceite; sírvela fría.'
  },
  'patata-cocida': {
    'en-GB': 'Boil the potato in chunks in water with the salt for about 20 minutes, drain and dress with a teaspoon of oil and the chopped parsley.',
    'es-ES': 'Cuece la patata en trozos en agua con la sal unos 20 minutos, escúrrela y alíñala con una cucharadita de aceite y el perejil picado.'
  },
  'pure-de-patata': {
    'en-GB': 'Boil the potato in chunks in water with the salt for about 20 minutes, drain and mash with the warm milk and a teaspoon of oil until smooth.',
    'es-ES': 'Cuece la patata en trozos en agua con la sal unos 20 minutos, escúrrela y cháfala con la leche caliente y una cucharadita de aceite hasta que quede fina.'
  },
  salmorejo: {
    'en-GB': 'Blend the tomatoes with the garlic, add the torn bread, let it soak for a few minutes and blend again with two teaspoons of oil and the salt until thick; serve well chilled.',
    'es-ES': 'Tritura el tomate con el ajo, añade el pan troceado, deja que se empape unos minutos y vuelve a triturar con dos cucharaditas de aceite y la sal hasta que quede espeso; sírvelo bien frío.'
  },
```

`meal.accompanimentNames` (web, `es-ES` y `en-GB`):

```ts
// es-ES
      'crema-de-calabacin': 'crema de calabacín',
      'crema-de-calabaza': 'crema de calabaza',
      'crema-de-puerros': 'crema de puerros',
      'caldo-de-pollo': 'un tazón de caldo de pollo',
      'caldo-de-verduras': 'un tazón de caldo de verduras',
      'pimientos-asados': 'pimientos asados',
      'menestra-de-verduras': 'menestra de verduras',
      'champinones-al-ajillo': 'champiñones al ajillo',
      'tomate-alinado': 'tomate aliñado',
      escalivada: 'escalivada',
      'espinacas-a-la-catalana': 'espinacas a la catalana',
      'acelgas-rehogadas': 'acelgas rehogadas',
      'coliflor-al-ajoarriero': 'coliflor al ajoarriero',
      'alcachofas-a-la-plancha': 'alcachofas a la plancha',
      'esparragos-trigueros-a-la-plancha': 'espárragos trigueros a la plancha',
      'zanahorias-alinadas': 'zanahorias aliñadas',
      'patata-cocida': 'patata cocida',
      'pure-de-patata': 'puré de patata',
      salmorejo: 'salmorejo',
      'picos-de-pan': 'picos de pan ({grams})',
// en-GB
      'crema-de-calabacin': 'courgette soup',
      'crema-de-calabaza': 'pumpkin soup',
      'crema-de-puerros': 'leek and potato soup',
      'caldo-de-pollo': 'a bowl of chicken broth',
      'caldo-de-verduras': 'a bowl of vegetable broth',
      'pimientos-asados': 'roasted red peppers',
      'menestra-de-verduras': 'mixed vegetable menestra',
      'champinones-al-ajillo': 'garlic mushrooms',
      'tomate-alinado': 'dressed tomatoes',
      escalivada: 'Catalan roasted vegetables',
      'espinacas-a-la-catalana': 'Catalan spinach with raisins and pine nuts',
      'acelgas-rehogadas': 'sautéed Swiss chard',
      'coliflor-al-ajoarriero': 'cauliflower with garlic and paprika',
      'alcachofas-a-la-plancha': 'griddled artichokes',
      'esparragos-trigueros-a-la-plancha': 'griddled green asparagus',
      'zanahorias-alinadas': 'marinated carrots',
      'patata-cocida': 'boiled potatoes',
      'pure-de-patata': 'mashed potato',
      salmorejo: 'salmorejo',
      'picos-de-pan': 'breadsticks ({grams})',
```
### 2. Asiática (4)

- **Qué entra**:
  - un segundo arroz: el jazmín, para la cocina tailandesa y vietnamita;
  - tres guarniciones que se ponen de verdad al lado del plato: edamame, espinacas con
    sésamo (el *gomae* japonés) y kimchi.
- **Verdura**: pasa de 2–3 opciones a 5–6.
- **`arroz-jazmin`**: es del grupo arroz. La mesa asiática lo admite en comida y cena, pero
  no junto a un plato de arroz (`Accompaniment.ts:485`).
- **`espinacas-con-sesamo`**: usa `salsa-de-soja` (USDA; soja y gluten) y no
  `salsa-de-soja-baja-en-sal`, que es `manual`. Es el segundo caso de gluten del lote.
- **`kimchi`**: su fila lleva trazas de pescado y crustáceos. Quien marcó esas trazas no
  lo recibe. Aporta 9 kcal (§ Riesgos, punto 4).
- **`edamame`**: lleva soja y 11 g de proteína. Va en el papel de verdura, como la sopa de
  miso.

| Clave | Filas de `0077` que lleva (`traditional_spanish`) |
|---|---|
| `arroz-jazmin` | `arroz-jazmin-crudo` |
| `edamame` | `edamame-congelado` |
| `espinacas-con-sesamo` | `sesamo`, `salsa-de-soja` |
| `kimchi` | `kimchi` |


| Clave | Papel | Familias | Comidas | Meses | Ración | kcal | P | HC | G | Fibra | Alérgenos | Clases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `arroz-jazmin` | starch | asian | C Ce | todo el año | 50 g | 182.5 | 3.6 | 40 | 0.4 | 0.7 | — | — |
| `edamame` | vegetable | asian | C Ce | todo el año | 101 g | 109 | 11.2 | 7.6 | 4.7 | 4.8 | soy | — |
| `espinacas-con-sesamo` | vegetable | asian | C Ce | 10, 11, 12, 1, 2, 3, 4, 5, 6 | 160 g | 65.8 | 5.6 | 6.8 | 3.1 | 3.9 | gluten, sesame, soy | — |
| `kimchi` | vegetable | asian | C Ce | todo el año | 60 g | 9 | 0.7 | 1.4 | 0.3 | 1 | crustaceans (trazas), fish (trazas) | — |

`ACCOMPANIMENTS`:

```ts
  composed(
    'arroz-jazmin',
    'starch',
    ['asian'],
    'all',
    [
      { grams: 50, slug: 'arroz-jazmin-crudo' }
    ]
  ),
  composed(
    'edamame',
    'vegetable',
    ['asian'],
    'all',
    [
      { grams: 100, slug: 'edamame-congelado' },
      { grams: 1, slug: 'sal' }
    ]
  ),
  composed(
    'espinacas-con-sesamo',
    'vegetable',
    ['asian'],
    [10, 11, 12, 1, 2, 3, 4, 5, 6],
    [
      { grams: 150, slug: 'espinaca' },
      { grams: 5, slug: 'sesamo' },
      { grams: 5, slug: 'salsa-de-soja' }
    ]
  ),
  {
    families: ['asian'],
    key: 'kimchi',
    months: 'all',
    portions: [[{ grams: 60, slug: 'kimchi' }]],
    role: 'vegetable',
    slots: LD
  },
```

`COMPOSED_NAMES`:

```ts
  'arroz-jazmin': { 'en-GB': 'Jasmine rice', 'es-ES': 'Arroz jazmín' },
  edamame: { 'en-GB': 'Edamame', 'es-ES': 'Edamame' },
  'espinacas-con-sesamo': { 'en-GB': 'Sesame spinach', 'es-ES': 'Espinacas con sésamo' },
```

`COMPOSED_PREPARATIONS`:

```ts
  'arroz-jazmin': {
    'en-GB': 'Rinse the rice, cook it covered in one and a half times its volume of water over the lowest heat for about 12 minutes and let it rest for 10.',
    'es-ES': 'Lava el arroz, cuécelo tapado con vez y media su volumen de agua a fuego mínimo unos 12 minutos y déjalo reposar 10.'
  },
  edamame: {
    'en-GB': 'Boil the edamame for about 5 minutes, drain it and sprinkle with the salt.',
    'es-ES': 'Cuece el edamame en agua hirviendo unos 5 minutos, escúrrelo y espolvorea la sal.'
  },
  'espinacas-con-sesamo': {
    'en-GB': 'Blanch the spinach for a minute, cool it in cold water, squeeze it dry and dress it with the soy sauce and the toasted sesame.',
    'es-ES': 'Escalda las espinacas un minuto, enfríalas en agua fría, escúrrelas apretando bien y alíñalas con la salsa de soja y el sésamo tostado.'
  },
```

`meal.accompanimentNames` (web, `es-ES` y `en-GB`):

```ts
// es-ES
      'arroz-jazmin': 'arroz jazmín',
      edamame: 'edamame',
      'espinacas-con-sesamo': 'espinacas con sésamo',
      kimchi: 'kimchi ({grams})',
// en-GB
      'arroz-jazmin': 'jasmine rice',
      edamame: 'edamame',
      'espinacas-con-sesamo': 'sesame spinach',
      kimchi: 'kimchi ({grams})',
```
### 3. Mexicana y latina (4)

- **Qué entra**:
  - tres almidones de la mesa latina que no son ni tortilla ni arroz: yuca con mojo
    (Cuba, Colombia), plátano macho al horno y elote (México, en verano);
  - el guacamole como verdura.
- **La verdura latina sigue corta** (3–4 opciones). En el catálogo no hay filas USDA de
  nopal ni de chayote, y las ensaladas latinas se parecen a las que ya hay.
- **`yuca-con-mojo`**: `yuca` es del grupo patata. La mesa latina la admite en comida y
  cena (`Cuisine.ts:236`).
- **`elote`**: `mazorca-de-maiz` no tiene grupo. 150 g de grano es una mazorca grande
  (`gramsPerUnit` 150).
- **Lo que las aparta del tradicional español**: `yuca`, `platano-macho` y `guacamole`
  están en la lista de `0077`. `elote` no lleva ninguna fila de esa lista; lo aparta la
  familia (ver § Premisas revisadas).


| Clave | Papel | Familias | Comidas | Meses | Ración | kcal | P | HC | G | Fibra | Alérgenos | Clases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `yuca-con-mojo` | starch | latin | C Ce | todo el año | 132.5 g | 240.7 | 1.8 | 46.9 | 5.4 | 2.3 | — | — |
| `platano-macho-al-horno` | starch | latin | C Ce | todo el año | 125.5 g | 226.6 | 1.4 | 44 | 5.1 | 2.6 | — | — |
| `elote` | starch | latin | C Ce | 7, 8, 9 | 156 g | 132.1 | 5 | 28.9 | 2.2 | 3.3 | — | — |
| `guacamole` | vegetable | latin | C Ce | todo el año | 60 g | 94.2 | 1.1 | 3.6 | 8.4 | 3 | — | — |

`ACCOMPANIMENTS`:

```ts
  composed(
    'yuca-con-mojo',
    'starch',
    ['latin'],
    'all',
    [
      { grams: 120, slug: 'yuca' },
      { grams: 2, slug: 'ajo' },
      { grams: 5, slug: 'lima' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'platano-macho-al-horno',
    'starch',
    ['latin'],
    'all',
    [
      { grams: 120, slug: 'platano-macho' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'elote',
    'starch',
    ['latin'],
    [7, 8, 9],
    [
      { grams: 150, slug: 'mazorca-de-maiz' },
      { grams: 5, slug: 'lima' },
      { grams: 0.5, slug: 'cayena-molida' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  {
    families: ['latin'],
    key: 'guacamole',
    months: 'all',
    portions: [[{ grams: 60, slug: 'guacamole' }]],
    role: 'vegetable',
    slots: LD
  },
```

`COMPOSED_NAMES`:

```ts
  'yuca-con-mojo': { 'en-GB': 'Cassava with garlic and lime', 'es-ES': 'Yuca con mojo' },
  'platano-macho-al-horno': { 'en-GB': 'Baked plantain', 'es-ES': 'Plátano macho al horno' },
  elote: { 'en-GB': 'Corn on the cob with lime and chilli', 'es-ES': 'Elote' },
```

`COMPOSED_PREPARATIONS`:

```ts
  'yuca-con-mojo': {
    'en-GB': 'Boil the peeled cassava in chunks in water with the salt for about 25 minutes, until tender, drain and pour over the chopped garlic, the lime juice and a teaspoon of oil.',
    'es-ES': 'Cuece la yuca pelada y en trozos en agua con la sal unos 25 minutos, hasta que esté tierna, escúrrela y riégala con el ajo picado, el zumo de lima y una cucharadita de aceite.'
  },
  'platano-macho-al-horno': {
    'en-GB': 'Peel the plantain, cut it into thick slices, brush them with a teaspoon of oil and bake at 200 °C for about 20 minutes, turning them halfway; salt at the end.',
    'es-ES': 'Pela el plátano macho, córtalo en rodajas gruesas, úntalas con una cucharadita de aceite y hornéalas a 200 °C unos 20 minutos, dándoles la vuelta a mitad; sala al final.'
  },
  elote: {
    'en-GB': 'Boil the corn cob for about 10 minutes, or grill it, and serve it with the lime juice, the cayenne and the salt.',
    'es-ES': 'Cuece la mazorca en agua hirviendo unos 10 minutos, o ásala a la plancha, y sírvela con el zumo de lima, la cayena y la sal.'
  },
```

`meal.accompanimentNames` (web, `es-ES` y `en-GB`):

```ts
// es-ES
      'yuca-con-mojo': 'yuca con mojo',
      'platano-macho-al-horno': 'plátano macho al horno',
      elote: 'elote',
      guacamole: 'guacamole ({grams})',
// en-GB
      'yuca-con-mojo': 'cassava with garlic and lime',
      'platano-macho-al-horno': 'baked plantain',
      elote: 'corn on the cob with lime and chilli',
      guacamole: 'guacamole ({grams})',
```
### 4. Árabe y magrebí (5)

- **Qué entra**:
  - el cuscús, que en Marruecos se come a mediodía;
  - mutabal (berenjena asada con tahini) en verano;
  - dos ensaladas de todo el año, zanahoria y remolacha, para que la mesa árabe no se quede
    en `hummus` y `ensalada-verde` de octubre a mayo;
  - dátiles como postre.
- **`cuscus`**: es del grupo de granos. La mesa árabe lo admite solo en comida
  (`Cuisine.ts:233`), y la entrada se declara `['lunch']`, igual que `tabule`.
- **`mutabal`**: lleva sésamo (tahini). No lleva aceite, y su frase no lo nombra.
- **`datiles`**: postre de la familia árabe en desayuno, comida y cena. Una ración de 30 g
  son 3–4 dátiles (`gramsPerUnit` 8) y 85 kcal.
- **El tradicional español**: `ensalada-de-zanahoria-marroqui`, `ensalada-de-remolacha`,
  `cuscus` y `datiles` no llevan ninguna fila de `0077`. Lo que los aparta es la familia del
  plato.

| Clave | Papel | Familias | Comidas | Meses | Ración | kcal | P | HC | G | Fibra | Alérgenos | Clases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `cuscus` | starch | arab | C | todo el año | 50.5 g | 188 | 6.4 | 38.7 | 0.3 | 2.5 | gluten | — |
| `mutabal` | vegetable | arab | C Ce | 6, 7, 8, 9, 10 | 167.5 g | 101.4 | 3.4 | 12.1 | 5.7 | 5.6 | sesame | — |
| `ensalada-de-zanahoria-marroqui` | vegetable | arab | C Ce | todo el año | 141 g | 100 | 1.4 | 13 | 5.4 | 3.9 | — | — |
| `ensalada-de-remolacha` | vegetable | arab | C Ce | todo el año | 136 g | 102.1 | 2.3 | 13 | 5.4 | 2.8 | — | — |
| `datiles` | dessert | arab | D C Ce | todo el año | 30 g | 84.6 | 0.8 | 22.5 | 0.1 | 2.4 | — | — |

`ACCOMPANIMENTS`:

```ts
  composed(
    'cuscus',
    'starch',
    ['arab'],
    'all',
    [
      { grams: 50, slug: 'cuscus-crudo' },
      { grams: 0.5, slug: 'sal' }
    ],
    ['lunch']
  ),
  composed(
    'mutabal',
    'vegetable',
    ['arab'],
    [6, 7, 8, 9, 10],
    [
      { grams: 150, slug: 'berenjena' },
      { grams: 10, slug: 'tahini' },
      { grams: 5, slug: 'limon' },
      { grams: 2, slug: 'ajo' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'ensalada-de-zanahoria-marroqui',
    'vegetable',
    ['arab'],
    'all',
    [
      { grams: 120, slug: 'zanahoria' },
      { grams: 10, slug: 'limon' },
      { grams: 0.5, slug: 'comino-molido' },
      { grams: 5, slug: 'perejil' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'ensalada-de-remolacha',
    'vegetable',
    ['arab'],
    'all',
    [
      { grams: 120, slug: 'remolacha-cocida' },
      { grams: 5, slug: 'limon' },
      { grams: 0.5, slug: 'comino-molido' },
      { grams: 5, slug: 'perejil' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  {
    families: ['arab'],
    key: 'datiles',
    months: 'all',
    portions: [[{ grams: 30, slug: 'datiles' }]],
    role: 'dessert',
    slots: BLD
  },
```

`COMPOSED_NAMES`:

```ts
  cuscus: { 'en-GB': 'Couscous', 'es-ES': 'Cuscús' },
  mutabal: { 'en-GB': 'Moutabal', 'es-ES': 'Mutabal' },
  'ensalada-de-zanahoria-marroqui': { 'en-GB': 'Moroccan carrot salad', 'es-ES': 'Ensalada de zanahoria a la marroquí' },
  'ensalada-de-remolacha': { 'en-GB': 'Beetroot salad', 'es-ES': 'Ensalada de remolacha' },
```

`COMPOSED_PREPARATIONS`:

```ts
  cuscus: {
    'en-GB': 'Put the couscous in a bowl with the salt, pour over the same volume of boiling water, cover for 5 minutes and fluff it with a fork.',
    'es-ES': 'Pon el cuscús en un bol con la sal, cúbrelo con el mismo volumen de agua hirviendo, tápalo 5 minutos y suéltalo con un tenedor.'
  },
  mutabal: {
    'en-GB': 'Roast the whole aubergine at 200 °C for about 40 minutes, scoop out the flesh, drain it and mash it with the tahini, the lemon juice, the chopped garlic and the salt.',
    'es-ES': 'Asa la berenjena entera en el horno a 200 °C unos 40 minutos, saca la pulpa, escúrrela y cháfala con el tahini, el zumo de limón, el ajo picado y la sal.'
  },
  'ensalada-de-zanahoria-marroqui': {
    'en-GB': 'Grate the carrot and dress it with the lemon juice, the cumin, the chopped parsley, a teaspoon of oil and the salt.',
    'es-ES': 'Ralla la zanahoria y alíñala con el zumo de limón, el comino, el perejil picado, una cucharadita de aceite y la sal.'
  },
  'ensalada-de-remolacha': {
    'en-GB': 'Dice the cooked beetroot and dress it with the lemon juice, the cumin, the chopped parsley, a teaspoon of oil and the salt.',
    'es-ES': 'Corta la remolacha cocida en dados y alíñala con el zumo de limón, el comino, el perejil picado, una cucharadita de aceite y la sal.'
  },
```

`meal.accompanimentNames` (web, `es-ES` y `en-GB`):

```ts
// es-ES
      cuscus: 'cuscús',
      mutabal: 'mutabal',
      'ensalada-de-zanahoria-marroqui': 'ensalada de zanahoria a la marroquí',
      'ensalada-de-remolacha': 'ensalada de remolacha',
      datiles: 'dátiles ({grams})',
// en-GB
      cuscus: 'couscous',
      mutabal: 'moutabal',
      'ensalada-de-zanahoria-marroqui': 'Moroccan carrot salad',
      'ensalada-de-remolacha': 'beetroot salad',
      datiles: 'dates ({grams})',
```
### 5. Desayuno, y lo que vale para todas las familias (9)

Hay 11 entradas nuevas con desayuno entre sus comidas: estas 9, más `picos-de-pan` y
`datiles`. El criterio del PRD (al menos 5) se cumple sobre el papel. Pero el planificador
no pone acompañamientos en el desayuno (condición 1), así que solo se verán las que también
valen para comida y cena:

| Entrada | Comidas | ¿Se sirve hoy? |
|---|---|---|
| `pan-con-tomate` | D C Ce | sí, en comida y cena (el pa amb tomàquet de la cena catalana) |
| `tostada-con-aceite` | D | **no**: solo desayuno |
| `yogur-con-miel` | D C Ce | sí, como el yogur de hoy |
| `macedonia` | D C Ce | sí, de noviembre a marzo |
| `avellanas` | D | **no**: solo desayuno (respuesta 7 de `0079`) |
| `nispero`, `cereza`, `albaricoque`, `granada` | D C Ce | sí, cada una en sus meses del catálogo |

- **Las cuatro frutas** llenan los meses más flojos:
  - el níspero (4–5), la cereza (5–7) y el albaricoque (5–8) entran en primavera. En abril
    hoy solo hay 7 postres en la mesa española.
  - la granada (10–11) entra en otoño.
  - Las cuatro ya están en el conjunto `FRUIT` de `Accompaniment.ts:399`, así que el filtro
    "fruta junto a fruta" ya las conoce.
- **`yogur-con-miel`** lleva leche. La miel tiene la clase `animal`, así que un vegano no
  lo recibe. Kosher no lo pone junto a carne (`setsBeside`).
- **`macedonia`** lleva naranja, manzana y plátano. Sus meses son el cruce de los de la
  naranja y la manzana.
- **`pan-con-tomate` y `tostada-con-aceite`** son de familia española y cuentan entre sus
  22. `tostada-con-aceite` usa `pan-integral` para no repetir el pan blanco de
  `pan-con-tomate`.
- **Las avellanas** son el caso de frutos de cáscara de desayuno, junto a las nueces y las
  almendras de hoy. Las propongo por si el lead decide abrir el desayuno. Si no, puede
  rechazarlas sin perder nada.

| Clave | Papel | Familias | Comidas | Meses | Ración | kcal | P | HC | G | Fibra | Alérgenos | Clases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `pan-con-tomate` | starch | spanish, other | D C Ce | todo el año | 95.5 g | 204.4 | 5.1 | 30.9 | 7.1 | 2.2 | gluten | — |
| `tostada-con-aceite` | starch | spanish, other | D | todo el año | 55.5 g | 170.2 | 6.2 | 21.4 | 6.8 | 3 | gluten | — |
| `yogur-con-miel` | dessert | todas | D C Ce | todo el año | 135 g | 100.4 | 7.2 | 17.9 | 0.3 | 0 | lactose, milk | animal |
| `macedonia` | dessert | todas | D C Ce | 11, 12, 1, 2, 3 | 180 g | 107.4 | 1.3 | 26.7 | 0.3 | 4.4 | — | — |
| `avellanas` | dessert | todas | D | todo el año | 20 g | 125.6 | 3 | 3.3 | 12.2 | 1.9 | tree_nuts | — |
|  | | | | | 30 g | 188.4 | 4.5 | 5 | 18.2 | 2.9 |  |  |
| `nispero` | dessert | todas | D C Ce | catálogo | 150 g | 70.5 | 0.6 | 18.2 | 0.3 | 2.6 | — | — |
| `cereza` | dessert | todas | D C Ce | catálogo | 150 g | 94.5 | 1.7 | 24 | 0.3 | 3.2 | — | — |
| `albaricoque` | dessert | todas | D C Ce | catálogo | 140 g | 67.2 | 2 | 15.5 | 0.6 | 2.8 | — | — |
| `granada` | dessert | todas | D C Ce | catálogo | 150 g | 124.5 | 2.6 | 28.1 | 1.8 | 6 | — | — |

`ACCOMPANIMENTS`:

```ts
  composed(
    'pan-con-tomate',
    'starch',
    SPANISH,
    'all',
    [
      { grams: 50, slug: 'pan-blanco' },
      { grams: 40, slug: 'tomate-triturado' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ],
    BLD
  ),
  composed(
    'tostada-con-aceite',
    'starch',
    SPANISH,
    'all',
    [
      { grams: 50, slug: 'pan-integral' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ],
    ['breakfast']
  ),
  {
    families: 'all',
    key: 'yogur-con-miel',
    months: 'all',
    portions: [[{ grams: 125, slug: 'yogur-natural-desnatado' }, { grams: 10, slug: 'miel' }]],
    role: 'dessert',
    slots: BLD
  },
  {
    families: 'all',
    key: 'macedonia',
    months: [11, 12, 1, 2, 3],
    portions: [[{ grams: 80, slug: 'naranja' }, { grams: 60, slug: 'manzana' }, { grams: 40, slug: 'platano' }]],
    role: 'dessert',
    slots: BLD
  },
  {
    families: 'all',
    key: 'avellanas',
    months: 'all',
    portions: [[{ grams: 20, slug: 'avellanas' }], [{ grams: 30, slug: 'avellanas' }]],
    role: 'dessert',
    slots: ['breakfast']
  },
  fruit('nispero', 150),
  fruit('cereza', 150),
  fruit('albaricoque', 140),
  fruit('granada', 150),
```

`COMPOSED_NAMES`:

```ts
  'pan-con-tomate': { 'en-GB': 'Bread with tomato', 'es-ES': 'Pan con tomate' },
  'tostada-con-aceite': { 'en-GB': 'Wholemeal toast with olive oil', 'es-ES': 'Tostada integral con aceite' },
  'yogur-con-miel': { 'en-GB': 'Yoghurt with honey', 'es-ES': 'Yogur con miel' },
  macedonia: { 'en-GB': 'Fruit salad', 'es-ES': 'Macedonia de fruta' },
```

`COMPOSED_PREPARATIONS`:

```ts
  'pan-con-tomate': {
    'en-GB': 'Toast the bread, spread the crushed tomato over it and finish with a teaspoon of oil and the salt.',
    'es-ES': 'Tuesta el pan, extiende encima el tomate triturado y termina con una cucharadita de aceite y la sal.'
  },
  'tostada-con-aceite': {
    'en-GB': 'Toast the bread and drizzle it with a teaspoon of oil and the salt.',
    'es-ES': 'Tuesta el pan y riégalo con una cucharadita de aceite y la sal.'
  },
  'yogur-con-miel': {
    'en-GB': 'Serve the yoghurt with the honey drizzled over it.',
    'es-ES': 'Sirve el yogur con la miel por encima.'
  },
  macedonia: {
    'en-GB': 'Chop the peeled orange, the apple and the banana and toss them in a bowl in their own juice.',
    'es-ES': 'Trocea la naranja pelada, la manzana y el plátano y mézclalos en un bol con su propio zumo.'
  },
```

`meal.accompanimentNames` (web, `es-ES` y `en-GB`):

```ts
// es-ES
      'pan-con-tomate': 'pan con tomate',
      'tostada-con-aceite': 'tostada integral con aceite',
      'yogur-con-miel': 'yogur con miel',
      macedonia: 'macedonia de fruta',
      avellanas: 'avellanas ({grams})',
      nispero: 'nísperos ({grams})',
      cereza: 'cerezas ({grams})',
      albaricoque: 'albaricoques ({grams})',
      granada: 'granada ({grams})',
// en-GB
      'pan-con-tomate': 'bread with tomato',
      'tostada-con-aceite': 'wholemeal toast with olive oil',
      'yogur-con-miel': 'yoghurt with honey',
      macedonia: 'fruit salad',
      avellanas: 'hazelnuts ({grams})',
      nispero: 'loquats ({grams})',
      cereza: 'cherries ({grams})',
      albaricoque: 'apricots ({grams})',
      granada: 'pomegranate seeds ({grams})',
```
### 6. El lote entero

| | Almidón | Verdura | Postre | Total |
|---|---|---|---|---|
| Española (con "otras"; 3 también italianas) | 5 | 17 | 0 | 22 |
| Asiática | 1 | 3 | 0 | 4 |
| Mexicana y latina | 3 | 1 | 0 | 4 |
| Árabe y magrebí | 1 | 3 | 1 | 5 |
| Todas las familias | 0 | 0 | 7 | 7 |
| **Total** | **10** | **24** | **8** | **42** |

Por comidas:
- 30 son de comida y cena;
- 9 de desayuno, comida y cena;
- 2 solo de desayuno;
- 1 solo de comida (`cuscus`).

Por tipo: 31 compuestas, 7 simples y 4 frutas.

La lista para aceptar o rechazar. El número entre paréntesis remite a la condición del
veredicto.


| # | Clave | Familia | Papel | Comidas | Meses | kcal | Alérgenos | Recomendación |
|---|---|---|---|---|---|---|---|---|
| 1 | `crema-de-calabacin` | española | vegetable | C Ce | 5, 6, 7, 8, 9 | 102.7 | — | aceptar |
| 2 | `crema-de-calabaza` | española | vegetable | C Ce | 9, 10, 11, 12, 1, 2, 3 | 137.6 | — | aceptar |
| 3 | `crema-de-puerros` | española | vegetable | C Ce | todo el año | 187 | — | aceptar |
| 4 | `caldo-de-pollo` | española | vegetable | C Ce | 10, 11, 12, 1, 2, 3, 4 | 15 | — | condicional: apio (6) |
| 5 | `caldo-de-verduras` | española | vegetable | C Ce | 10, 11, 12, 1, 2, 3, 4 | 15 | — | condicional: apio (6) |
| 6 | `pimientos-asados` | española | vegetable | C Ce | 7, 8, 9, 10 | 86.2 | — | aceptar |
| 7 | `menestra-de-verduras` | española | vegetable | C Ce | todo el año | 116.7 | — | aceptar |
| 8 | `champinones-al-ajillo` | española | vegetable | C Ce | todo el año | 84.2 | — | aceptar |
| 9 | `tomate-alinado` | española + italiana | vegetable | C Ce | 6, 7, 8, 9 | 79.2 | — | aceptar |
| 10 | `escalivada` | española | vegetable | C Ce | 7, 8, 9, 10 | 106 | — | aceptar |
| 11 | `espinacas-a-la-catalana` | española | vegetable | C Ce | 10, 11, 12, 1, 2, 3, 4, 5, 6 | 145.4 | tree_nuts | aceptar; choca con la respuesta 7 (5) |
| 12 | `acelgas-rehogadas` | española | vegetable | C Ce | 8, 9, 10, 11, 12, 1, 2, 3, 4, 5 | 88.1 | — | aceptar |
| 13 | `coliflor-al-ajoarriero` | española | vegetable | C Ce | 9, 10, 11, 12, 1, 2, 3, 4 | 89.6 | — | aceptar |
| 14 | `alcachofas-a-la-plancha` | española + italiana | vegetable | C Ce | 12, 1, 2, 3, 4, 5 | 116.2 | — | aceptar |
| 15 | `esparragos-trigueros-a-la-plancha` | española + italiana | vegetable | C Ce | 3, 4, 5, 6, 9 | 74.2 | — | aceptar |
| 16 | `zanahorias-alinadas` | española | vegetable | C Ce | todo el año | 100.5 | — | aceptar |
| 17 | `patata-cocida` | española | starch | C Ce | todo el año | 160.4 | — | aceptar |
| 18 | `pure-de-patata` | española | starch | C Ce | todo el año | 179.7 | lactose, milk | aceptar |
| 19 | `salmorejo` | española | vegetable | C Ce | 6, 7, 8, 9 | 214.4 | gluten | aceptar |
| 20 | `picos-de-pan` | española | starch | D C Ce | todo el año | 79.8 / 119.7 | gluten | condicional: fila BEDCA (4) |
| 21 | `pan-con-tomate` | española | starch | D C Ce | todo el año | 204.4 | gluten | aceptar |
| 22 | `tostada-con-aceite` | española | starch | D | todo el año | 170.2 | gluten | aceptar; dormida hasta que el desayuno tenga acompañamientos (1) |
| 23 | `arroz-jazmin` | asian | starch | C Ce | todo el año | 182.5 | — | aceptar |
| 24 | `edamame` | asian | vegetable | C Ce | todo el año | 109 | soy | aceptar |
| 25 | `espinacas-con-sesamo` | asian | vegetable | C Ce | 10, 11, 12, 1, 2, 3, 4, 5, 6 | 65.8 | gluten, sesame, soy | aceptar |
| 26 | `kimchi` | asian | vegetable | C Ce | todo el año | 9 | crustaceans (trazas), fish (trazas) | aceptar |
| 27 | `yuca-con-mojo` | latin | starch | C Ce | todo el año | 240.7 | — | aceptar |
| 28 | `platano-macho-al-horno` | latin | starch | C Ce | todo el año | 226.6 | — | aceptar |
| 29 | `elote` | latin | starch | C Ce | 7, 8, 9 | 132.1 | — | aceptar |
| 30 | `guacamole` | latin | vegetable | C Ce | todo el año | 94.2 | — | aceptar |
| 31 | `cuscus` | arab | starch | C | todo el año | 188 | gluten | aceptar |
| 32 | `mutabal` | arab | vegetable | C Ce | 6, 7, 8, 9, 10 | 101.4 | sesame | aceptar |
| 33 | `ensalada-de-zanahoria-marroqui` | arab | vegetable | C Ce | todo el año | 100 | — | aceptar |
| 34 | `ensalada-de-remolacha` | arab | vegetable | C Ce | todo el año | 102.1 | — | aceptar |
| 35 | `datiles` | arab | dessert | D C Ce | todo el año | 84.6 | — | aceptar |
| 36 | `yogur-con-miel` | todas | dessert | D C Ce | todo el año | 100.4 | lactose, milk | aceptar |
| 37 | `macedonia` | todas | dessert | D C Ce | 11, 12, 1, 2, 3 | 107.4 | — | aceptar |
| 38 | `avellanas` | todas | dessert | D | todo el año | 125.6 / 188.4 | tree_nuts | aceptar; dormida hasta que el desayuno tenga acompañamientos (1) |
| 39 | `nispero` | todas | dessert | D C Ce | 4, 5 (catálogo) | 70.5 | — | aceptar |
| 40 | `cereza` | todas | dessert | D C Ce | 5, 6, 7 (catálogo) | 94.5 | — | aceptar |
| 41 | `albaricoque` | todas | dessert | D C Ce | 5, 6, 7, 8 (catálogo) | 67.2 | — | aceptar |
| 42 | `granada` | todas | dessert | D C Ce | 10, 11 (catálogo) | 124.5 | — | aceptar |

## Filas que faltan

**Ningún slug falta en el catálogo.** Las 42 entradas usan 61 filas distintas, todas en el
seed. Hay dos cambios de datos que no son altas, y por eso no encajan en el
`INSERT … ON CONFLICT (slug) DO NOTHING` que describe la fase 2:

1. **Re-fuentear `picos-de-pan`** (hoy BEDCA: 399 kcal, 11 g de proteína, 73 g de
   hidratos, 7 g de grasa y 3,5 g de fibra por 100 g). Propuesta:

   | Campo | Valor |
   |---|---|
   | FDC id | **174929** (SR Legacy) |
   | Descripción | Bread, sticks, plain |
   | Por 100 g | 412 kcal · 12,0 g proteína · 68,4 g hidratos · 9,5 g grasa · 3,0 g fibra (medido: API de FoodData Central, 2026-10-03) |
   | Alérgenos | `gluten` (contiene). Propongo además `sesame` como trazas: es una **hipótesis**, porque muchos picos españoles avisan "puede contener sésamo". Hay que comprobarlo en dos o tres etiquetas antes de la migración |
   | Efecto | La ración de 30 g pasa de 119,7 a 123,6 kcal. Cambian también los platos que ya usen la fila |

   Es un `UPDATE` de una fila de producción, y es una de las 14 filas BEDCA cuya
   re-fuente está en cola (`000-workspace` LOG). Recomiendo hacerlo dentro de esa tarea, no
   aquí, y dejar `picos-de-pan` fuera de este lote hasta entonces.
2. **Declarar el apio en los caldos** (condición 6): añadir el enlace `celery` a
   `caldo-de-pollo` y a `caldo-de-verduras`. Recomiendo `contains` y no `may_contain`. La
   fila es genérica, y el apio suele ir en la lista de ingredientes del caldo de brick, no
   solo en las trazas. Que siempre sea así es una **hipótesis**: hay que leer tres
   etiquetas de supermercado. Es un alta en la tabla de enlaces de alérgenos y puede ir en
   la migración revisada de la fase 2, con su `ON CONFLICT DO NOTHING`.

Si el lead acepta los caldos, **la fase 2 no se salta**, aunque no falte ningún slug.

## Comprobaciones

Las hice con un script sobre el seed. No hubo base de datos ni modelo.

| Comprobación | Resultado |
|---|---|
| Cada slug está en el catálogo | 42 de 42 entradas; 61 de 61 filas |
| Fuente de cada fila | todas `usda`, salvo `picos-de-pan` (`bedca`). Ninguna `manual` |
| Las entradas españolas no llevan ninguna fila de `traditional_spanish` (`Preference.ts:98`) | 0 de 22 |
| El aceite de la frase coincide con el de la ración, en los dos idiomas | 31 de 31 compuestas |
| Los literales dan exactamente las entradas de las tablas | 42 de 42; las 31 compuestas según `isComposed` tienen nombre y preparación |
| Ningún grupo de la tabla 2 deja una celda muerta (familia × comida declarada que el código nunca ofrecería) | ninguna |
| Los meses declarados salen de las filas frescas | sí, salvo los caldos y `pan-con-tomate` (declarados, ver § Cómo está hecho el lote) |

## Requisitos

- **Código (fase 3)**:
  - pegar las entradas aceptadas en `ACCOMPANIMENTS`, `COMPOSED_NAMES` y
    `COMPOSED_PREPARATIONS`, ordenando las claves como pida el linter;
  - pegar sus frases en `meal.accompanimentNames`, en `es-ES` y `en-GB`;
  - corregir el comentario de `Accompaniment.ts:74–82` ("USDA rows only"), que ya hoy no es
    cierto;
  - las pruebas del PRD, criterio 5:
    - leche: `pure-de-patata` y `yogur-con-miel`;
    - gluten: `salmorejo`, `pan-con-tomate` y `cuscus`;
    - frutos de cáscara en comida y cena: `espinacas-a-la-catalana`;
    - "tradicional español nunca recibe uno extranjero": por `setsBeside`, con un plato de
      esa familia, y al menos con `ensalada-de-zanahoria-marroqui` o `elote`, que no llevan
      ninguna fila de `0077`;
  - la cuenta de acompañamientos distintos por perfil y quincena en el evaluador.
- **Datos (fase 2)**: los dos enlaces de apio, si se aceptan los caldos. `picos-de-pan`
  espera a la tarea BEDCA.
- **Infraestructura y dinero**: nada. 0 €. Ninguna llamada a un modelo. La medición va en
  `pnpm db:local` con `NUTRIA_LOCAL_PG=1`, nunca en Neon.
- **Decisiones del lead** (el owner las delegó el 2026-10-03):
  - aceptar o rechazar cada entrada;
  - el desayuno (condición 1);
  - `picos-de-pan` (4);
  - `espinacas-a-la-catalana` (5);
  - los caldos (6);
  - qué hacer si el tiempo pasa de +10 % (§ Riesgos, punto 3).
- **Tiempo del owner**: ninguno, salvo que se decida abrir el desayuno. Eso cambia el
  planificador y merece su visto bueno.

## Riesgos

1. **Seguridad: apio sin declarar en los caldos.**
   - **Probabilidad**: alta. El caldo de brick suele llevar apio (**hipótesis**, por
     comprobar en etiquetas).
   - **A quién afecta**: a una persona alérgica al apio, que recibiría un tazón de caldo
     sin que nada lo pare.
   - **Cómo se vería**: no se ve en el código. Solo en la etiqueta.
   - **Cómo se deshace**: no aceptar los caldos, o añadir el enlace en la fase 2. El enlace
     protege también a los platos que ya usan esas filas.
2. **Seguridad: alérgenos nuevos en la mesa.**
   - **Qué entra**:
     - frutos de cáscara en comida y cena (`espinacas-a-la-catalana`);
     - sésamo (`mutabal`, `espinacas-con-sesamo`);
     - soja (`edamame`, `espinacas-con-sesamo`);
     - gluten (`salmorejo`, `pan-con-tomate`, `tostada-con-aceite`, `cuscus`,
       `espinacas-con-sesamo`, `picos-de-pan`);
     - leche (`pure-de-patata`, `yogur-con-miel`);
     - trazas de pescado y crustáceos (`kimchi`).
   - **Quién lo para**: todo pasa por el mismo `dishSafety` que juzga los platos. El único
     riesgo real es que una fila del catálogo tenga mal un enlace.
   - **Revisé las filas usadas**: solo encontré el caso del apio. Los piñones van marcados
     como frutos de cáscara, aunque el anexo II del Reglamento 1169/2011 no los nombra. Es
     la opción prudente y la dejo así.
3. **Tiempo de `schedulePlan`.**
   - **Cuánto crecen los conjuntos**: `setsOf` forma el producto de los tres papeles, y
     `rankedSets` valora cada conjunto por cada clave de caché (plato, comida, mes y
     presupuesto del día). La tabla de abajo está medida por combinatoria sobre la lista,
     contando raciones (un pan tiene dos) y sin los filtros de cada persona ni del plato.
     Por eso es un techo.
   - **Lo que no sé**: qué parte del tiempo de `schedulePlan` se va en valorar conjuntos
     (**desconocido**).
   - **Señal de parada**: más de +10 % frente al cierre de 017 en la primera medición de la
     fase 3.
   - **Remedio**:
     - podar cada papel antes del producto, por ejemplo quedarse con las 4 raciones de
       cada papel que mejor cierran el hueco por sí solas. Es un cambio del planificador y
       lo decide el lead;
     - o entrar el lote en dos tandas: primero las de temporada y después las de todo el
       año.
   - **Cómo se deshace**: quitar entradas.
4. **Acompañamientos casi sin energía.**
   - **Cuáles**: los caldos (15 kcal) y `kimchi` (9 kcal).
   - **El problema**: casi no mueven el coste de un conjunto, así que "X + caldo" empata
     casi con "X".
   - **Qué puede pasar** (**hipótesis**): que ocupen puestos del top 6 como casi duplicados,
     o que se añadan casi siempre porque salen gratis.
   - **Cómo se vería**: en el evaluador, la frecuencia de cada clave.
   - **Cómo se deshace**: quitarlos, o darles una ración mayor.
5. **La variedad no sube.** Es la hipótesis de la condición 3.
   - **Cómo se vería**: la nueva cuenta de distintos del evaluador.
   - **Remedio**: un coste por repetir acompañamiento. El PRD deja fuera las "reglas
     nuevas", así que lo decide el lead.
6. **El orden de la tabla decide los empates.** Una entrada añadida al final pierde todos
   los empates frente a las de hoy. Dónde se pegan las entradas cambia los planes. La fase 3
   debe colocarlas a propósito, junto a las de su papel y su familia como hace el fichero,
   y medir.

| Familia | Comida | Conjuntos hoy (media de 12 meses) | Con el lote (media) | Factor | Máximo con el lote (mes: almidón/verdura/postre, frente a hoy) |
|---|---|---|---|---|---|
| española | comida y cena | 410 | 2.666 | ×6,5 | 2.940 (noviembre: 13/13/14; hoy 8/3/11) |
| italiana | comida y cena | 245 | 437 | ×1,8 | 648 (junio: 8/5/11; hoy 8/3/8) |
| asiática | comida y cena | 343 | 847 | ×2,5 | 990 (noviembre: 10/5/14; hoy 9/2/11) |
| latina | comida y cena | 411 | 780 | ×1,9 | 975 (julio: 14/4/12; hoy 11/3/9) |
| árabe | comida | 485 | 1.083 | ×2,2 | 1.344 (julio: 11/7/13; hoy 10/4/9) |
| árabe | cena | 469 | 953 | ×2,0 | 1.120 (julio: 9/7/13; hoy 9/4/9) |

El 77 % de la biblioteca es española (947 de 1.229 platos, `0079`), así que la cifra que
importa es la primera fila.

## Coste y esfuerzo

Todo es **estimado**, con un agente opus a esfuerzo medio, como dice el plan.

| Trabajo | Esfuerzo | De qué depende |
|---|---|---|
| Fase 2: dos enlaces de apio y su revisión | 1–2 h de agente | de que se acepten los caldos |
| Fase 3: pegar, nombres, frases web, comentario | 1–2 h | del número de entradas aceptadas |
| Fase 3: pruebas y cuenta de distintos en el evaluador | 2–3 h | — |
| Fase 3: medir sin y con el flag en la biblioteca de referencia | 1–3 h | del tiempo de `schedulePlan`, que no conozco |
| Si hay que podar por papel | +2–4 h, y una decisión del lead | de la primera medición |
| Dinero | 0 € | — |

## Plan

Va en fases pequeñas para el `PLAN` de 018, como enmienda a sus fases 2 y 3.

1. **Fase 2, solo si se aceptan los caldos.**
   - **Qué**: la migración con los dos enlaces `celery` y el seed igual.
   - **Éxito**: `pnpm db:local reset --reference`, `check-migrations`, y el visto bueno de
     `migration-reviewer`.
   - **Parada**: el revisor la rechaza.
   - `picos-de-pan` no va aquí.
2. **Fase 3a: medir el tiempo antes que nada.**
   - **Qué**: pegar las entradas aceptadas y correr el evaluador sin y con el flag, con
     `ms` por perfil.
   - **Éxito**: dentro de +10 % del cierre de 017.
   - **Parada**: si pasa de +10 %, no seguir. Llevar al lead la poda por papel o la entrada
     en dos tandas.
3. **Fase 3b: lo demás de la fase 3.**
   - **Qué**: las pruebas, los nombres, las frases web y la cuenta de distintos.
   - **Éxito**: el criterio 4 del PRD (196/196 días en banda, 0 alérgenos, 0 snack en
     comida principal, y que suban los distintos).
   - **Parada**: un día perdido, un alérgeno, o que los distintos no suban. En ese caso, va
     al lead como regla de repetición.
4. **Fuera de 018, a decidir.**
   - Abrir el desayuno a los acompañamientos. Las entradas ya están.
   - Re-fuentear `picos-de-pan` con la tarea BEDCA.

## Qué no sé

- **Qué parte de `schedulePlan` es valorar conjuntos.** Solo lo dice la fase 3a.
- **Si suben los acompañamientos distintos por quincena.** Es una hipótesis. Lo dice la
  cuenta nueva del evaluador.
- **Si los caldos de brick españoles llevan siempre apio, y si los picos llevan trazas de
  sésamo.** Se resuelve leyendo tres etiquetas de cada uno.
- **Cuántas comidas pasan de 700 kcal en cada perfil.** Solo esas reciben acompañamientos,
  así que eso pone el techo de la variedad que se puede ver. El evaluador ya da el reparto
  de 0–3 acompañamientos por comida.
- **Si "Bread, sticks, plain" (FDC 174929) es un buen sustituto de los picos.** Las cifras
  están cerca de las de BEDCA (412 frente a 399 kcal). La receta de los picos andaluces
  lleva aceite y puede tener algo más de grasa. Lo decide quien re-fuentee las 14 filas.

