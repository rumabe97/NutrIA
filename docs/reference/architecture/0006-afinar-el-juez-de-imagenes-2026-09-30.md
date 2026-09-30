# 0006 — Afinar el juez de imágenes: que deje de rechazar fotos fieles, en todo tipo de platos

> **Purpose**: respuesta del agente `architect` a la petición del owner del 2026-09-30
> («Refina el juez», y «tiene que afinar para todo tipo de platos, no solo el que he
> encontrado»), el día en que el proyecto 009 enseñó por primera vez una imagen fiel
> rechazada. Dice por qué mecanismos la regla rechaza fotos fieles, cuántos platos de la
> biblioteca están expuestos a cada uno, qué opciones hay, qué deja pasar cada una que no
> debería, cuál recomiendo y en qué orden hacerlo. Es la base del PRD del proyecto 010.
> **Audience**: el owner y los agentes. **Committed**: sí. **Maintained by**: el agente
> `architect`; una vez fusionado no se edita — una revisión posterior es un informe nuevo.
>
> Base: `main` en `efba83b6` (#174). Cada número lleva etiqueta: **medido** (dónde),
> **estimado** (con la hipótesis) o **desconocido**. Para este informe se leyó el código
> y se midió **sin conexión**: las respuestas del juez guardadas del piloto
> (`docs/local/image-pilot-2026-09-27/`), el catálogo de la semilla (930 ingredientes,
> `packages/database/src/seed/`) y los 500 platos de `docs/local/nutria-seed-500.sql`,
> pasados por `judgePicture` tal como está hoy y por un prototipo de cada opción.
> **No se hizo ninguna llamada a modelo, no se leyó producción ni la base de desarrollo,
> no se escribió en ninguna base de datos y no se gastó nada.** Los datos de producción
> que aparecen son los que midió el lead el 2026-09-30 y me pasó (las notas de las 18
> filas con imagen); no los he comprobado. **Producción no se puede volver a pasar por
> otra regla**: de cada intento se guardan las notas del veredicto, no las respuestas de
> las dos llamadas. Solo el piloto se puede repetir.
> De la biblioteca (privada) solo hay recuentos y algún plato de ejemplo.

---

## 1. Veredicto

**Sí, con condiciones.** La regla se puede afinar para todo tipo de platos **solo en
código**, sin tocar lo que se pregunta a los dos modelos y sin gastar nada, y el afinado
no abre la puerta a las imágenes que el juez existe para parar.

La causa no es un plato: es una idea que la regla no tiene. Hoy, cuando el juez nombra
una **forma** («pancakes», «meatballs», «bread», «milk», «yogurt»), el código le pone
los alérgenos de **la receta más habitual** de esa forma, y los compara con el plato.
Pero una foto enseña la forma, no de qué está hecha. Si el plato **lleva su propia
versión** de esa forma — tortitas de harina de maíz, pan sin gluten, yogur de soja,
heura — la forma que se ve es la del plato, y sus alérgenos son los del plato.

Lo que recomiendo (opción **R**, § 7): **la versión propia del plato**. Una tabla cerrada
de familias de formas; cuando el plato tiene un ingrediente que *es* esa forma, o su
título la nombra, la palabra de la forma no aporta alérgenos. Todo lo demás del nombre
sigue contando («wheat noodles», «egg noodles», «cheese pancakes», «feta cheese» se
siguen rechazando). Más tres arreglos pequeños de vocabulario.

Medido sin conexión:

| | Hoy | Opción R |
| --- | --- | --- |
| Piloto: 65 imágenes fieles aceptadas | 65 de 65 | 65 de 65 |
| Piloto: 3 controles de receta equivocada rechazados | 3 de 3 | 3 de 3 |
| Los tres casos de producción (6 reconstrucciones) aceptados | 0 de 6 | 6 de 6 |
| Platos de la biblioteca expuestos a un rechazo falso (de 500) | 128 | 47 |
| … de las tres clases ya vistas en producción | 43 | 0 (salvo «nuggets», a propósito) |
| Alimentos de más que pasarían y hoy se rechazan (31.500 pares plato × alimento) | — | 229 (0,87 % de lo que hoy se rechaza) |

**Las condiciones**:

1. Lo construye `backend-high` y lo revisa `invariant-reviewer`, los dos en opus a
   `high`: es validación de salida de modelo y toca alérgenos (§ 13).
2. Antes de cambiar la regla, el conjunto de aceptación queda escrito como tests (§ 12):
   sin él, cada palabra que se añade a una lista es una apuesta.
3. Se conserva la regla del P2 de 006: un nombre corto visto **junto a** el completo es
   un segundo alimento («milk» al lado de «soy milk» se sigue rechazando).
4. Dos tests que hoy fijan el comportamiento equivocado se reescriben a propósito, con
   el revisor delante (§ 5.5).
5. Una decisión nueva enmienda `0066` (§ 13).
6. No entran en esta tanda: la lactosa, el «puede contener», el tofu leído como queso
   y el revuelto de tofu leído como huevo. Cuestan más de lo que arreglan o no se han
   visto nunca (§ 7.4); se deciden con datos de producción.

**Lo que no debe costar** (§ 8): la regla de hoy tiene además agujeros en la otra
dirección — 19 de 166 nombres de alimentos con alérgeno no se mapean a nada («omelet»,
«pizza», «crepes», «tortilla», «fusilli», «paneer»…). Cerrar esos agujeros es la segunda
mitad del mismo trabajo, y solo es posible **después** de R: hoy, cada sinónimo nuevo
rechazaría más platos fieles.

---

## 2. Premisas revisadas

| # | Premisa | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | Los tres rechazos de producción fueron falsos para el alérgeno que nombraron | **Confirmada** por el mecanismo; **hipótesis** en lo visual | Los reproduzco sin conexión (§ 5.2); la nota del caso 2 sale letra por letra. Del caso 1 ya no hay notas (la aceptación a mano las borró); queda la captura del owner: solo gluten, y un único ingrediente reconocido, «Tortitas americanas» — justo lo que da «pancakes» en mi medida, y no lo que daría «corn pancakes» (cinco filas). No he visto las imágenes: que la de las tortitas «mostraba el plato tal como es» lo vio el owner; de las otras dos no lo sé |
| 2 | «Todos los rechazos vinieron del nombre de un alimento preparado mapeado a un producto del catálogo con los alérgenos de su receta habitual» | **Confirmada** para dos; **incorrecta** para el tercero | «pancakes» → `tortitas-americanas` y «meatballs» → `albondigas-envasadas`, sí. «grain base» no es un producto: la palabra «base» cayó en el paso de palabras sueltas (`judge.ts:354-367`) y la única fila del catálogo con esa palabra es «Fresh pizza base». Es un accidente de vocabulario, otra clase (§ 4, M4) |
| 3 | El juez rechaza por un solo motivo | **Confirmada** | `judge.ts:497` y `:512` |
| 4 | La llamada de emparejado (b) no decide nada | **Incorrecta en parte** | No puede aprobar sola un alérgeno (`judge.ts:491-494`), pero **sí decide** si la forma propia del plato pasa: la exención `shortened` solo vale si (b) emparejó el nombre (`judge.ts:480-489`); si lo dejó como «extra», se rechaza. Dos tests lo fijan así (`judge.test.ts:402` frente a `:414`; `:418-435`). El caso 3 de producción es eso: en el intento 1 (b) dejó «meatballs» como extra |
| 5 | «Un rechazo equivocado cuesta un redibujo» (`judge.ts:22-24`) | **Incorrecta** como modelo de coste | Vale si el error es al azar. Estos son **deterministas por plato**: las tortitas de maíz, 3 de 3. Cuesta los tres intentos (≈ 0,10 $, estimado), deja el plato sin imagen 7 días y le da trabajo al owner |
| 6 | El piloto habría visto este problema | **Incorrecta** | De los 20 platos del piloto, ninguno tiene una forma preparada sin su alérgeno habitual salvo los fideos de arroz (plato 17) y el tofu (12 y 19), que el juez nombró bien (medido: «tofu» en 8 de 8 imágenes). La clase no estaba en la muestra |
| 7 | El piloto sigue dando 57 de 57 y los 3 controles rechazados | **Confirmada** | Repetido hoy con el código de `main` (§ 5.1) |
| 8 | El catálogo tiene cinco filas `sin-gluten` / `sin-lactosa` | **Confirmada** | `pan-sin-gluten`, `pan-rallado-sin-gluten`, `pasta-sin-gluten`, `galletas-sin-gluten`, `leche-sin-lactosa` |
| 9 | 18 platos con imagen, 3 con algún rechazo, los 3 falsos | **No comprobada** (dato del lead) | No leo producción. La uso como la dio: 3 de 18 platos (17 %; con 18 platos el intervalo al 95 % va de 6 % a 39 %, estimado), y 5 intentos rechazados de 22 juzgados (15 platos a la primera, 2 a la segunda, las tortitas tras 3) |
| 11 | Lo que pasó en producción se puede estudiar después | **Incorrecta** | Las respuestas de (a) y (b) no se guardan en ningún sitio; solo las notas. Y la aceptación a mano reescribe `provenance` y borra las notas de los intentos y los `extras` de la candidata: el plato que motivó este informe ya no tiene su evidencia (§ 9) |
| 10 | El catálogo de producción es el de la semilla | **Hipótesis** | Mido con las 930 filas de la semilla, las mismas que usó la calibración de 006. Se comprueba con un recuento de solo lectura |

---

## 3. Qué hay hoy

Por cada intento, tres pasos (`DishPicture.service.ts:307-326`):

1. **Llamada (a), a ciegas** (`OpenRouterVisionJudgeClient.ts:17-25`): el modelo de
   visión recibe solo la imagen y devuelve los alimentos que ve, cada uno con un nombre
   corto en inglés, si lo nombra con seguridad (`specific`) y cuánto hay (`amount`). No
   sabe qué plato debería ser.
2. **Llamada (b), solo texto** (`:28-37`): recibe esos nombres y **todos** los
   ingredientes de la receta (nombre y slug; también la harina, que el prompt del dibujo
   trata como invisible) y dice cuáles ve, con qué nombres, y cuáles «sobran».
3. **`judgePicture`** (`packages/core/src/domain/DishPicture/judge.ts`) decide:
   - Son «extras» los que (b) listó como tales y los que (b) no mencionó (`:376-380`, `:431`).
   - También se revisan los que (b) emparejó con un ingrediente (`:491-494`), salvo que
     el nombre sea el del ingrediente acortado (`shortened`, `:480-489`).
   - Cada nombre se mapea al catálogo (`mapName`, `:325-370`) en cuatro pasos: (1) el
     nombre entero, exacto, o por `SEEN_SYNONYMS` (`:209-251`); (2) toda fila cuyo
     nombre esté hecho solo de palabras del alimento; (3) las palabras que queden, por
     `SEEN_SYNONYMS`; (4) para cada palabra aún suelta, todas las filas que la tengan,
     contando solo los alérgenos que comparten todas.
   - Un alérgeno es «ajeno» si el alimento lo **contiene** y ningún ingrediente del plato
     lo contiene, o si **puede contenerlo** y ninguno lo contiene ni puede (`:443-448`).
   - Se rechaza si hay un extra nombrado, no genérico, en más que una traza, con algún
     alérgeno ajeno (`:497`). Todo lo demás son notas.

Lo que esto da por bueno: que el nombre que pone un modelo de visión, leído con «la
receta más habitual», dice qué alérgenos **se ven**. Es cierto para una gamba, un
cacahuete o un huevo frito. No lo es para una tortita, una albóndiga, un vaso de algo
blanco o una rebanada de pan.

`0004` no entra en juego y no se mueve: qué puede comer una persona se decide en código
contra la receta. El juez protege otra cosa, la de `imagenes-de-platos.md` § 5 IMG-2: que
una persona alérgica a X no vea en la foto algo que se lee como X en un plato que no lo
lleva, y desconfíe de un plato seguro.

---

## 4. Las clases de rechazo falso, por mecanismo

Leyendo `mapName`, `SEEN_SYNONYMS`, el paso de palabras, `shortened` y `mismatched`, y
comprobando cada nombre contra el catálogo real (medido, 930 filas).

| # | Mecanismo | Dónde | Ejemplo | ¿Lo fija un test? |
| --- | --- | --- | --- | --- |
| **M1** | **Forma preparada → fila de producto con su receta habitual.** «pancakes» → `tortitas-americanas` (gluten, leche, huevo); «waffles» → `gofre`; «cake» → `bizcocho`; «muffins» → `magdalena`; «cookies», «biscuits» → `galletas-de-mantequilla`; «bread», «toast», «croutons», «breaded», «batter», «dumplings», «pastry», «pie», «noodles», «penne», «spaghetti» por la tabla de sinónimos | `:209-251`, `:328`, `:346-348` | Tortitas de harina de maíz (producción, 3 de 3). Pan sin gluten visto como «toast». Espaguetis sin gluten vistos como «spaghetti» | `judge.test.ts:364-380` fija la lectura segura sobre un plato de arroz (correcta ahí). `:414` y `:418-435` fijan que la forma propia, si (b) la deja como extra, se rechaza: **comportamiento equivocado, fijado** |
| **M2** | **Forma de carne → fila de producto.** «meatballs» → `albondigas-envasadas` (gluten, huevo; puede contener leche); «burger», «burger patty» → gluten (por las filas de pan de hamburguesa); «nuggets» → gluten, soja | `:354-367` | Guiso con heura (producción). Cualquier plato con heura, seitán, tempeh o soja texturizada. «chicken», «meat chunks», «meat patties» no llevan alérgeno y pasan | No |
| **M3** | **Parecido vegetal de un lácteo, y nombre compuesto leído como dos alimentos.** «yogurt» → yogur de leche. «soy yogurt», «coconut yogurt» → leche, porque el paso 3 lee «yogurt» aparte. «coconut milk» → leche, porque el paso 2 mete toda fila cuyo nombre sea solo «milk» («Whole milk» sin el descriptor). «plant milk» → leche | `:339-351` | **El propio ingrediente del plato, nombrado en inglés americano, se rechaza aunque (b) lo empareje**: el catálogo dice «Soya yoghurt» y el juez dice «soy yogurt» (16 platos de la biblioteca). Curry con leche de coco | No. `:478` fija «soy milk» + «milk» vistos a la vez, que es otro caso y se conserva |
| **M4** | **Palabra que no es un alimento, en el paso de palabras sueltas.** «base» → «Fresh pizza base» (gluten). «glass of milk» arrastra «azúcar glas» y «fideos de cristal». «crab sticks» arrastra la canela en rama. «sandwich» → galletas rellenas. «taco» → sazonador para tacos (gluten) | `:354-367` | Tortitas de arroz vistas como «grain base» (producción) | No |
| **M5** | **La moneda de (b).** La misma foto y el mismo nombre pasan si (b) empareja y se rechazan si (b) lo lista como extra o no lo menciona | `:376-380`, `:480-492` | Caso 3, intento 1. En el piloto (b) listó 11 extras y dejó 10 alimentos sin mencionar, de 323 vistos (medido) | `:402` / `:414` y `:418-435` lo fijan |
| **M6** | **Ortografía.** El catálogo está en inglés británico («yoghurt», «soya», «pitta»); el juez escribe en americano. `shortened` y el paso 2 piden la misma palabra (`sameWord`, `:279`) | `:279`, `:480-489` | «yogurt» emparejado con «Soya yoghurt» no cuenta como el ingrediente acortado | No |
| **M7** | **Variante justa con un alérgeno que no se ve.** «mozzarella» o «parmesan» (leche + lactosa) sobre un plato con queso curado (leche, sin lactosa) → lactosa. «king prawns» (pueden llevar sulfitos) sobre un plato de gambas → sulfitos. El «puede contener» de una fila de producto (la leche de las albóndigas) | `:443-448` | 22 platos de la biblioteca llevan leche y no lactosa. 15 llevan gambas | `:314-328` fija que la variante pasa «porque lleva los alérgenos de su ingrediente»; solo es cierto cuando coinciden |
| **M8** | **Parecido de huevo.** «scrambled eggs», «omelette» sobre un revuelto de tofu | `:325-370` | 4 platos de la biblioteca | No |
| **M9** | **Tofu leído como queso** («feta cheese», «cheese cubes») | — | 26 platos llevan tofu. **No observado**: 0 de 8 imágenes de tofu del piloto | No |

Lo que **no** es una clase aparte sino un amplificador: un extra que (b) nombra y (a) no
se toma como principal y nombrado (`:435-437`); un alimento sin `specific` se toma como
específico si el catálogo lo conoce (`:450`). Las dos cosas son correctas en la otra
dirección y no las toco.

---

## 5. Medidas

Método, para que se pueda repetir: `judge.ts` de `main` empaquetado con el catálogo de
la semilla (930 filas, nombres es-ES y en-GB, `contains` y `may_contain` como los escribe
`seed/index.ts`), y una copia con interruptores para cada opción. Las tablas del
prototipo están en el anexo. El arnés vive en el directorio temporal de la sesión y
desaparece con ella: quien construya lo rehace como tests (§ 12, fase 0).

### 5.1 El piloto, repetido

Las 57 respuestas re-juzgadas (`mini/rejudge.json`), las 8 del mini-piloto
(`mini/results.json`) y los 3 controles de receta equivocada (`mini/positive-control.json`).

| Regla | 57 del piloto | 8 del mini | 3 controles |
| --- | --- | --- | --- |
| Hoy | 57 aceptadas | 8 aceptadas | 3 rechazados (gambas; pulpo y feta; pan de hamburguesa) |
| Opción (ii) | igual | igual | igual |
| Opción R | igual | igual | igual |
| R con lactosa, R con «puede contener» | igual | igual | igual |

**Medido.** Ninguna opción cambia un solo veredicto ni una sola nota del piloto. Aviso:
de los controles se guardó el veredicto, no la respuesta de (b); la he reconstruido con
los extras que el veredicto guardó.

Eso es una buena noticia a medias: el piloto no distingue entre opciones porque no
contiene la clase (premisa 6).

### 5.2 Los tres casos de producción, reconstruidos

No tengo las respuestas del juez, solo las notas. Reconstruyo cada caso de las dos
maneras en que (b) pudo contestar.

| Caso | Hoy | (ii) | R | R sin el título |
| --- | --- | --- | --- | --- |
| 1a Tortitas de maíz: «pancakes» como extra | rechaza | rechaza | **acepta** | rechaza |
| 1b Tortitas de maíz: «pancakes» emparejado con la harina de maíz | rechaza | acepta | **acepta** | rechaza |
| 2a Tortitas de arroz: «grain base» emparejado (como en producción) | rechaza | acepta | **acepta** | acepta |
| 2b Tortitas de arroz: «grain base» como extra | rechaza | acepta | **acepta** | acepta |
| 3a Guiso con heura: «meatballs» como extra (como en producción) | rechaza | rechaza | **acepta** | acepta |
| 3b Guiso con heura: «meatballs» emparejado con la heura | rechaza | acepta | **acepta** | acepta |

**Medido** sobre la reconstrucción. La del caso 2a da la nota de producción letra por
letra (`extra_allergen:grain base=gluten extra_food:shredded chicken/diced
potatoes/grain base matched_foreign:grain base`), así que el mecanismo es ese. **No se
sabe, y ya no se puede saber**, si en el caso 1 (b) emparejó o no: las notas se borraron
al aceptar la imagen a mano. De eso depende que la opción (ii) hubiera arreglado el plato
que encontró el owner; R lo arregla en los dos supuestos.

### 5.3 La biblioteca: cuántos platos están expuestos

Sobre los 500 platos de la semilla. Un plato está **expuesto** a una clase si lleva lo
que la clase necesita y la regla rechaza una imagen **fiel** cuando el juez usa un nombre
verosímil para ello. Los nombres son una tabla mía (anexo): **lo medido es la regla, lo
supuesto es el nombre**. No es una tasa de rechazo: es el tamaño de la superficie.

Cada celda: platos rechazados si (b) empareja el nombre / si (b) lo deja como extra.

| Clase (nombre que pone el juez) | Platos que la llevan | Hoy | (ii) | R |
| --- | --- | --- | --- | --- |
| Masa en el título: tortitas de harina, crepes, galettes («pancakes», «waffles») | 7 | 7 / 7 | 0 / 7 | 0 / 0 |
| Pan sin gluten, arepas («toast», «bread») | 7 | 7 / 7 | 0 / 7 | 0 / 0 |
| Tortilla de maíz: tacos, enchiladas («wrap», «flatbread», «taco») | 7 | 7 / 7 | 0 / 7 | 0 / 0 |
| Pasta sin gluten, fideos de arroz («spaghetti», «pasta», «noodles») | 7 | 5 / 5 | 0 / 5 | 0 / 0 |
| Tortitas de arroz o de maíz («crackers», «grain base») | 13 | 13 / 13 | 0 / 13 | 0 / 0 |
| Proteína vegetal: heura, seitán, tempeh, soja texturizada («meatballs», «burger patty») | 24 | 24 / 24 | 0 / 24 | 0 / 0 |
| … la misma, vista como «nuggets» | 24 | 22 / 22 | 22 / 22 | 22 / 22 (a propósito) |
| Bebida vegetal («milk») | 17 | 0 / 17 | 0 / 17 | 0 / 0 |
| Batido con bebida vegetal («milkshake») | 8 | 8 / 8 | 0 / 8 | 0 / 0 |
| Leche o crema de coco («coconut milk», «cream») | 14 | 14 / 14 | 0 / 14 | 0 / 0 |
| Yogur de soja o de coco («yogurt», «soy yogurt») | 16 | 16 / 16 | 0 / 16 | 0 / 0 |
| Queso vegano («cheese») | 1 | 0 / 1 | 0 / 1 | 0 / 0 |
| Gambas vistas como «king prawns» (sulfitos) | 15 | 14 / 14 | 0 / 0 | 0 / 0 |
| Queso curado visto como «mozzarella», «parmesan» (lactosa) | 28 | 21 / 21 | 21 / 21 | 21 / 21 (fuera de esta tanda) |
| Revuelto de tofu («scrambled eggs», «omelette») | 4 | 4 / 4 | 4 / 4 | 4 / 4 (fuera) |
| Tofu visto como «cheese», «feta cheese» | 26 | 24 / 24 | 24 / 24 | 24 / 24 (fuera; nunca observado) |
| **Cualquiera, sin contar el tofu-como-queso** | | **127 / 128** | 47 / 117 | **47 / 47** |
| **Las tres clases ya vistas en producción** (masa en el título, proteína vegetal, tortitas de arroz) | | **43 / 43** | 22 / 43 | 22 / 22, todo «nuggets» |

**Medido** (la regla) sobre nombres **supuestos**. Lectura:

- Uno de cada cuatro platos de la biblioteca (128 de 500, 26 %) lleva algo cuyo nombre
  más natural en inglés hace rechazar una imagen fiel. Para las tres clases que ya han
  aparecido en producción son 43 platos (9 %).
- La opción (ii) solo arregla cuando (b) empareja: entre 47 y 117 platos siguen
  expuestos, según una moneda que no controlamos.
- Lo que R deja expuesto es lo que dejo fuera a propósito (§ 7.4).

Para situar esos números: 375 de los 500 platos no llevan gluten, 354 no llevan leche,
425 no llevan huevo, 416 no llevan soja (medido).

### 5.4 Lo que cada opción deja pasar

La prueba al revés: a cada uno de los 500 platos se le añade, como alimento **de más**
que (b) lista como extra, cada uno de 63 alimentos con alérgeno (pan, tostada, tortitas,
pasta, queso, leche, yogur, gambas, cacahuetes, albóndigas…). Son 31.500 pares; hoy se
rechazan 26.394 (los demás son alimentos cuyo alérgeno el plato ya lleva).

| Regla | Pares que pasan a aceptarse | Platos | Cuáles |
| --- | --- | --- | --- |
| Solo los arreglos de vocabulario | 14 | 14 | «king prawns» en platos que ya llevan crustáceos (sulfitos) |
| Opción (ii) + vocabulario | 14 | 14 | los mismos. Por construcción: un extra nunca está emparejado |
| **Opción R** | **229** (0,87 %) | 130 | «meatballs» 51, «burger patty» 26, «milk» 26, «yogurt» 16, «king prawns» 14, «crackers» 13, «cream» 10, «wrap» 9, «flatbread» 9, «bread», «toast», «bun», «croutons», «pancakes», «waffles» 7 cada uno, «pasta» 5, «spaghetti» 5, «noodles» 2, «cake» 1 |
| R + lactosa no ajena si hay leche | 386 | 146 | lo anterior más «yogurt», «milk», «cream», «mozzarella», «feta»… en platos con queso curado |
| R + «puede contener» solo para el gluten | 2.002 | 498 | lo anterior más pepitas de chocolate (496), pipas (403 + 403), chocolate negro (122), galletas saladas, hojaldre… |

**Medido.** Los 229 pares de R son todos de la misma especie: un alimento de más **de la
misma familia** que una forma que el plato ya tiene — otro pan en un plato con pan sin
gluten, un vaso de leche en un plato con bebida de soja, albóndigas en un plato con
heura. En todos, lo que se ve en la foto es indistinguible de la versión del plato. Las
dos últimas filas son por qué no toco la lactosa ni el «puede contener» ahora.

### 5.5 Tests de hoy que cambian con R

Comprobado con el catálogo real (medido):

| Test | Hoy | R | Qué hacer |
| --- | --- | --- | --- |
| `judge.test.ts:414` «noodles» como extra en un plato de fideos de arroz | rechaza | acepta | Reescribir: es el caso 3 de producción con otro alimento |
| `:418-435` «cake» como extra en un plato de tortitas de arroz | rechaza | acepta | Reescribir: es el caso 2 |
| `:476-485` «soy milk» + «milk», «vegan cheese» + «cheese», «peanut butter» + «butter» vistos a la vez | rechaza | rechaza | Se conservan (condición 3) |
| `:398` pan sobre un plato de avena; `:382` avena sobre arroz; `:301` gambas emparejadas con brócoli | rechaza | rechaza | Se conservan |
| `:402`, `:487` | acepta | acepta | Se conservan |

Y casos nuevos que R resuelve como debe: «wheat noodles» y «egg noodles» sobre fideos de
arroz, «cheese pancakes» sobre tortitas de maíz sin queso, «toast» sobre tortitas de
maíz, «bun» sobre el guiso con heura, «feta cheese» sobre un bol de tofu, «shrimp»
sobre las tortitas, «pancakes» sobre un plato que no las nombra: **todos rechazados**.
«soy yogurt» sobre yogur de soja y «coconut milk» sobre un curry de coco: aceptados (hoy
se rechazan).

### 5.6 Los agujeros de hoy, en la otra dirección

De 166 nombres de alimentos que cualquiera esperaría con un alérgeno (lista mía; lo
medido es el mapeo), **19 no dan ese alérgeno** con la regla de hoy (11 %):

`tortilla`, `pizza`, `pizza crust`, `pizza slice`, `tart`, `crepe`, `crepes`, `cupcake`,
`fusilli`, `burrito`, `fritters`, `crumble` (gluten); `paneer`, `latte` (leche); `omelet`,
`frittata`, `meringue`, `hollandaise` (huevo); `crayfish` (crustáceos).

«pizza» y «tortilla» no dan gluten porque el paso 4 solo cuenta lo que comparten todas
las filas con esa palabra, y entre ellas hay una salsa de tomate para pizza y una
tortilla de maíz. «omelet» (grafía americana) no existe; «omelette» sí. Una pizza o una
tortilla francesa dibujadas sobre un plato sin gluten o sin huevo **pasan hoy**.

---

## 6. Las opciones

| | Qué arregla | Qué deja pasar que no debería | Coste | `0004` y «(b) no decide» |
| --- | --- | --- | --- | --- |
| **(i) Lista cerrada de formas con base sustituible — mi opción R** | Las clases M1 a M6. 6 de 6 reconstrucciones. 128 → 47 platos expuestos | 229 pares de 26.394: otro alimento de la misma familia que el del plato, indistinguible en la foto | Una tanda de `backend-high` y su revisión. Sin migración, sin contrato, sin web | Los cumple. Solo usa datos de la receta y el catálogo. **Reduce** lo que depende de (b) |
| **(ii) Usar lo que (b) ya dice** (la forma emparejada con su ingrediente, con comprobación en código) | Lo mismo, **solo cuando (b) empareja**. 3 de 6 reconstrucciones más las 2 de «grain base», que arregla el vocabulario. 47 a 117 platos expuestos | Casi nada propio (14 pares, los sulfitos). Pero si (b) empareja mal un extra con un ingrediente base, pasa | Algo menos de código | Cumple `0004`. **Aumenta** lo que decide (b): su emparejado pasa a ser condición para aceptar, y el caso 3 de producción demuestra que (b) no es estable |
| **(iii) Cambiar lo que se pregunta** (decirle a (a) el nombre del plato; pedir «el alimento visible, no el tipo de plato») | Desconocido: no se puede medir sin llamadas | Decirle el plato a (a) rompe el diseño a ciegas: un modelo que sabe qué debería ver lo ve. Los 3 controles de receta equivocada dependen de que no lo sepa | Invalida la calibración: las 65 respuestas guardadas ya no sirven y hay que volver a juzgar (≈ 0,05 $, estimado, decisión del owner). Y sube la versión del prompt | Cumple `0004` solo si el código sigue decidiendo. El problema no está en lo que el modelo dice («pancakes» es verdad) sino en cómo lo lee el código |
| **(iv) No tocar la regla y aceptar a mano** | Nada | Nada nuevo | 0,10 $ y una revisión a mano por plato bloqueado (estimado). Con 43 platos de las clases ya vistas: hasta 4,4 $ de un tope de 10 $ al mes y 43 revisiones, si todos se bloquearan (cota superior) | Los cumple. Pero cada aceptación a mano es una anulación registrada del juez (`0072`): convertirla en rutina le quita el sentido |

**Recomiendo (i)**, en la forma R del § 7, con los arreglos de vocabulario.

**Por qué no (ii)**: arregla la mitad, y la mitad que arregla la elige un modelo de
texto. El owner pidió que no dependa del plato que encontró; (ii) depende además de la
tirada.

**Por qué no (iii)**: el modelo no se equivoca al decir «pancakes». Quien se equivoca es
la lectura. Y es la única opción que no puedo medir gratis ni deshacer sin volver a
calibrar.

**Por qué no (iv)** sola: la puerta a mano es para el caso raro. Medido, la superficie es
un plato de cada cuatro.

**Lo que no haría en ningún caso**:

- Que una forma nunca rechace («pancakes» nunca es gluten). El control del pan de
  hamburguesa sobre un bol de skyr dejaría de rechazarse.
- Dejar que (b) decida más, o pedirle al modelo los alérgenos. `0004`.
- Tocar la lactosa y el «puede contener» en la misma tanda (§ 5.4: 386 y 2.002 pares).
- Meter el tofu en la familia del queso. Un queso rallado no se parece a un dado de
  tofu, y el juez nunca los ha confundido (0 de 8).

---

## 7. Propuesta: la versión propia del plato

### 7.1 La regla, en una frase

> Una palabra que nombra una **forma** no aporta alérgenos cuando el plato tiene su
> propia versión de esa forma. El resto del nombre se sigue mapeando como hoy.

### 7.2 Cómo se decide «el plato tiene su propia versión»

Dos llaves, las dos datos de la receta, ninguna del modelo de visión:

1. **Un ingrediente del plato *es* esa forma**: una tabla cerrada de slugs del catálogo
   por familia. `pan-sin-gluten` es un pan; `pasta-sin-gluten` y `fideos-de-arroz-*` son
   pasta; `tortilla-de-maiz` es una tortilla; `tortitas-de-arroz` es una galleta salada;
   `yogur-de-soja` es un yogur; `leche-de-soja`, `leche-de-avena`, `leche-sin-lactosa`
   son una leche; `heura`, `seitan`, `tempeh`, `soja-texturizada`, la carne picada son
   de lo que se hace una albóndiga.
2. **El título del plato nombra la forma**: una tabla cerrada de palabras en español
   por familia. «Tortitas caseras de maíz…» nombra tortitas; «Arepas…» nombra un pan.
   Sin esta llave el caso 1 no se arregla (§ 5.2, última columna): la harina de maíz no
   *es* una tortita.

Por qué el título es una llave legítima: el riesgo que el juez cubre es que la foto diga
algo que el plato no dice. Si el título dice «tortitas», la foto de unas tortitas no
añade nada; de qué están hechas lo dice la lista de ingredientes, que es la que manda.

Las otras maneras de decidirlo, y por qué perdieron:

- **Por categoría del catálogo** (`bakery`, `pantry`…): demasiado gruesa — el pan rallado
  y las tortitas de arroz están en la misma.
- **Por peso del ingrediente**: 5 g de maicena espesan un guiso y 60 g hacen tortitas,
  pero el umbral es un número sin dueño y no distingue unas tortitas de un rebozado.
- **Solo por ingrediente, sin título**: no arregla el plato del owner.
- **Título y además un ingrediente «del que se puede hacer»** (harina, copos): es la
  variante prudente. Medido con una versión anterior del prototipo, deja 2 o 3 platos
  más expuestos de 500 (unas tortitas de patata, unos muffins de huevo: formas sin
  harina). Es la pregunta 2 del § 14.

### 7.3 Lo que acota la regla

- **Familias estrechas.** Una familia es un conjunto de formas que una foto no
  distingue entre sí: {pan, tostada, panecillo, picatostes}; {tortita, crepe, gofre};
  {bizcocho, magdalena}; {galleta}; {tortilla, wrap, taco, pan plano}; {pasta, fideos,
  espaguetis}; {albóndiga, hamburguesa, salchicha}; {leche, batido}; {yogur}; {queso};
  {nata}. Tener pan sin gluten no excusa unas tortitas, y nombrar tortitas no excusa
  una tostada (medido, § 5.5).
- **Solo la palabra de la forma.** «wheat noodles» conserva «wheat»; «egg noodles»,
  «egg»; «cheese pancakes», «cheese»; «feta cheese», «feta». Se rechazan como hoy.
- **El segundo alimento.** Si la imagen muestra a la vez un nombre más completo de esa
  forma y el corto («soy milk» y «milk»), el corto es otro alimento y se juzga como hoy.
  Es el P2 de 006, conservado, y ya sin depender de (b).
- **Lo rebozado se ve.** «nuggets» y «croquettes» solo se excusan por el título
  («Croquetas de…»), nunca por llevar heura: el rebozado es visible.
- **«Tortitas» es ambiguo en español.** Si el plato lleva `tortitas-de-arroz` o
  `tortitas-de-maiz`, su título no excusa «pancakes».
- **Queda escrito.** Cuando la exención actúa, el veredicto lleva una nota
  (`own_form:<nombre>`), que ya se guarda con la imagen aceptada
  (`DishPicture.service.ts:338-343`). Es el único modo de saber, después, qué imágenes
  pasaron por la regla nueva.

### 7.4 Los arreglos de vocabulario que van con ella

| Arreglo | Qué hace | Coste medido |
| --- | --- | --- |
| Palabras que no son un alimento (`base`, `glass`, `bowl`, `cup`, `stick`, `bed`, `layer`, `stack`, `mix`) no se mapean en el paso de palabras sueltas | Arregla «grain base» (caso 2), «glass of milk», «crab sticks». «pizza base» sigue siendo gluten: es un nombre entero del catálogo | 0 pares |
| Un calificativo vegetal (`soy`, `soya`, `oat`, `almond`, `coconut`, `rice`, `plant`, `vegan`…) delante de `milk`, `yogurt`, `cheese`, `cream`, `butter`: la palabra láctea no se mapea; el calificativo sí (soja, frutos secos) | Arregla «soy yogurt», «coconut milk», «plant milk» también como extra | 0 pares |
| Los sulfitos nunca rechazan una imagen | Arregla «king prawns» sobre gambas. Nadie ve un sulfito | 14 pares, todos en platos que ya llevan crustáceos |

### 7.5 Lo que queda fuera de esta tanda, y por qué

| Clase | Platos | Por qué espera |
| --- | --- | --- |
| Lactosa (M7) | 21 | Tratarla como no ajena cuando hay leche deja pasar 157 pares más: un yogur de más en un plato con queso curado, que una persona con intolerancia sí leería. No se ha visto en producción ni en el piloto (el juez dice «cheese», «grated cheese») |
| «Puede contener» (M7) | — | 1.773 pares más, casi todos pipas y chocolate. Es una decisión sobre qué promete el juez, no un afinado |
| Revuelto de tofu (M8) | 4 | La foto fiel de ese plato **parece** huevo. Es exactamente para lo que está la aceptación a mano |
| Tofu como queso (M9) | 24 | Nunca observado |

---

## 8. La otra dirección

**¿Acepta la regla de hoy imágenes que debería rechazar?** Sí, por vocabulario: los 19
nombres del § 5.6. Es un fallo de hoy, no de ninguna opción.

**¿Y las notas aceptadas de producción?** Ninguna es un error de alérgeno de hecho:

- Pollo por pavo, patata por manzana (tortitas de arroz, intento 2): ni el pollo ni la
  patata llevan alérgeno. Es una foto **infiel**, no una foto con alérgeno.
- «meat patties» con el seitán sin ver: el seitán a la plancha parece carne. La carne no
  lleva alérgeno en el catálogo. Una persona vegetariana puede extrañarse; no es IMG-2.
- «tortilla chips» por pita crujiente: el plato ya lleva gluten; los nachos no lo llevan.
- «oatmeal/butter» con el queso cottage sin ver: el plato lleva gluten (la tostada) y
  leche (el cottage).

**¿Debería importar `missing_main`?** Como rechazo, no. En el piloto aparece en 5 de 65
imágenes **fieles** (medido) y en los 3 controles: distingue mal. En producción está en
5 de las 17 imágenes que el juez aceptó (dato del lead): rechazar por ello habría
dejado sin imagen a casi un tercio. Y el seitán «no visto» estaba en la foto, con otro
nombre. Lo que mide es sobre todo cómo
nombra el juez, no lo que falta. Como **señal** de fidelidad sí vale: un recuento en
`/admin` de imágenes aceptadas con un principal sin ver le diría al owner cuáles mirar.
Es otra pregunta (la 6 del § 14), y no es de alérgenos.

**Lo que el afinado no debe costar**, como criterios:

1. Los 3 controles siguen rechazados.
2. Ningún nombre calificado se excusa (trigo, huevo, queso, feta, cacahuete).
3. Una forma de otra familia se sigue rechazando.
4. El P2 de 006 se conserva.
5. Los agujeros no crecen: los 19 de hoy no pueden ser 20.
6. Lo que R deja pasar se conoce por adelantado: los 229 pares, por familia. Si el
   número sube al construirlo, se explica o no se fusiona.

**Un riesgo que R agranda y hay que decir**: una imagen que el juez **acepta** no se
puede retirar (IMG-16; «Retirar» solo vale para las aceptadas a mano). R hace que el
juez acepte más. Si una de esas aceptaciones resulta mala, hoy solo la quita una
migración de datos. Es la pregunta 4.

---

## 9. Requisitos

- **Código**: `packages/core/src/domain/DishPicture/judge.ts` y, mejor, un fichero al
  lado para las tablas (familias, slugs, palabras del título, palabras que no son
  alimento). `judge.test.ts`. Nada en `apps/api` salvo que se quiera guardar la versión
  de la regla con la imagen (una clave más en `provenance`, sin migración).
- **Datos**: ninguno. Sin migración. El catálogo no cambia.
- **Infraestructura y dinero**: nada. 0 €.
- **Guardar la evidencia** (no es parte de la regla, pero sin ello el siguiente
  afinado vuelve a hacerse a ciegas):
  - que la aceptación a mano **conserve** las notas de los intentos y los `extras` de
    la candidata en vez de reescribir `provenance` (hoy se pierden; le pasó al plato de
    este informe);
  - que cada intento juzgado guarde las respuestas de (a) y (b) — nombres de alimentos,
    cantidades, el emparejado — junto a sus notas. Son unos cientos de bytes en el
    `jsonb` que ya existe, sin migración, y nada de una persona. Con eso producción se
    podría volver a pasar por una regla nueva, que es lo que hoy no se puede. `0072`
    prohíbe **enseñar** las palabras del modelo en la consola, no guardarlas; las notas
    ya las llevan (`extra_food:meatballs`). Que `legal` e `invariant-reviewer` lo miren.
- **Título en otros idiomas**: las palabras del título son en español. Si hay recetas
  con `locale` en inglés, la tabla necesita sus palabras (las mismas que ya usa el
  juez). **Desconocido** cuántas hay.
- **Tiempo del owner**: leer este informe y contestar el § 14; después de publicar,
  mirar en `/admin` las imágenes con nota `own_form` la primera semana y volver a
  intentar los platos bloqueados (≈ 0,04 $ cada uno).
- **Decisiones**: las del § 14.

---

## 10. Riesgos

| Riesgo | Para quién | Probabilidad | Cómo se vería | Cómo se deshace |
| --- | --- | --- | --- | --- |
| R acepta una imagen con un alimento de más de la misma familia (un pan de trigo junto al pan sin gluten) | Persona alérgica que desconfía de un plato seguro (IMG-2, P2). El plato sigue siendo seguro | Baja: hace falta que el modelo dibuje de más **y** que sea de la misma familia. Acotado a 229 de 26.394 pares | Nota `own_form` más `extra_food` en la imagen aceptada | Hoy, solo una migración (IMG-16). Por eso la pregunta 4 |
| Una tabla mal escrita excusa de más (una familia demasiado ancha, un slug equivocado) | El mismo | Media sin el conjunto de aceptación; baja con él | El recuento de pares del § 5.4 sube | Revertir el commit. Las imágenes ya aceptadas se quedan |
| El título lo escribió un modelo y nombra una forma que el plato no tiene | El mismo | Baja. La foto coincide con lo que la persona lee en el título | — | La variante prudente del § 7.2 |
| Se toca la regla y se rompe la calibración | El owner (rechazos nuevos) | Baja con el piloto como test | El piloto deja de dar 65 de 65 | Revertir |
| Cerrar agujeros (fase 3) crea rechazos falsos nuevos | El owner | Media: «tortilla» es una tortilla de trigo y una tortilla de patatas | La exposición de la biblioteca sube | Cada sinónimo es una línea |
| Privacidad, cuota | Nadie | Nula: no cambia qué se envía a ningún modelo ni cuántas llamadas se hacen. Menos rechazos son menos redibujos | — | — |

---

## 11. Coste y esfuerzo

| Concepto | Valor | Etiqueta |
| --- | --- | --- |
| Dinero para construir R | 0 € | medido: ninguna llamada |
| Un rechazo falso | ≈ 0,034 $ (imagen 0,0337 $ + dos llamadas del juez ≈ 0,0007 $) | medido en el piloto |
| Un plato bloqueado (3 intentos) | ≈ 0,10 $, 7 días sin imagen, una revisión a mano | estimado de los precios medidos |
| Lo gastado en los 5 intentos rechazados de producción | ≈ 0,17 $ | estimado |
| Código de R | 150 a 250 líneas en `core`, 40 a 60 casos de test | estimado, del prototipo (≈ 90 líneas sin tests) |
| Rondas de revisión | 1 a 2 (006 fase 2 tuvo 2) | estimado |
| Fase de agujeros | 20 a 40 líneas de sinónimos, y volver a medir | estimado |

Lo que mueve el esfuerzo: cuántas familias entran en la primera tanda y si el título va
solo o con ingrediente. Lo que no lo mueve: el tamaño de la biblioteca.

---

## 12. Plan, y cómo se mide

Cada fase se publica sola. Todas en `quality-max`.

**Fase 0 — El conjunto de aceptación, como tests, antes de tocar la regla.**
- El piloto como test: las 65 respuestas y los 3 controles. Hoy viven en `docs/local`,
  que no se publica; hay que decidir cómo entran (pregunta 5).
- Las 6 reconstrucciones de producción, en rojo.
- Un caso por clase del § 4, en las dos direcciones (los del § 5.5).
- El recuento de la prueba al revés (§ 5.4) sobre un conjunto fijo de platos de
  ejemplo, como número que un test compara.
- *Éxito*: con la regla de hoy fallan exactamente los casos que deben fallar.
  *Señal para parar*: un caso que no se puede escribir sin inventar la respuesta del juez.

**Fase 1 — La regla R, los tres arreglos de vocabulario y guardar la evidencia**
(§ 9: las respuestas del juez con cada intento; las notas, conservadas al aceptar a mano).
- *Éxito* (los números que lleva el PRD):
  - piloto 65 de 65 aceptadas, sin cambio en ninguna nota; 3 de 3 controles rechazados;
  - 6 de 6 reconstrucciones de producción aceptadas;
  - cada clase M1 a M6: su caso fiel aceptado y su caso contrario rechazado;
  - los tres tests del P2 de 006 (`:476-485`) sin tocar y en verde;
  - los pares que pasan a aceptarse: los previstos (229 con estas tablas), explicados
    por familia;
  - cobertura de `judge.ts` sin bajar del suelo del dominio (90 % de ramas).
- *Señal para parar*: un control cambia; o el revisor devuelve el mismo P0 o P1 dos veces.

**Fase 2 — Lo escrito.** La decisión que enmienda `0066`, `apps/api/AGENTS.md`, los
comentarios de `judge.ts`, y `legal` sobre sus documentos (§ 13). Puede ir en el mismo
PR que la fase 1.

**Fase 3 — Cerrar los agujeros** (`omelet`, `frittata`, `crepe`, `pizza`, `cupcake`,
`fusilli`, `paneer`, `crayfish`, `meringue`…).
- *Éxito*: de 19 agujeros a los que se decida dejar, con nombre (mi candidato a quedarse:
  `tortilla`, por ambiguo); piloto sin cambio; la exposición de la biblioteca no sube.
- *Señal para parar*: un sinónimo que rechaza un plato fiel del piloto.

**Fase 4 — Mirar producción, a las 2 a 4 semanas.** Decidir con datos la lactosa, el
«puede contener», el revuelto de tofu, y si `missing_main` merece un recuento.

**Lo que solo se sabe después de publicar**, y dónde se lee:

| Qué | Dónde | Punto de partida |
| --- | --- | --- |
| Platos que acaban fallidos por el juez | `/admin/pictures`, `failedByReason.judge_allergen` | 1 de 18 (dato del lead) |
| Intentos rechazados | `recipe_images.provenance.notes` (`N:rejected:…`, también en las aceptadas por el juez; **no** en las aceptadas a mano, que las pierden) | 5 de 22 intentos juzgados (dato del lead) |
| Platos con algún rechazo | lo mismo | 3 de 18 |
| Aceptaciones por la regla nueva | `provenance.judge` con `own_form:` | 0 |
| Aceptadas a mano | el recuento «aceptadas a mano» de Imágenes | 1 |
| Gasto | `recipe_image_calls` | — |

Con 18 platos el punto de partida tiene un intervalo de 6 % a 39 %: hasta que no haya
unos 60 platos dibujados con la regla nueva, una bajada de la tasa no demuestra nada.
Lo que sí demuestra algo desde el primer día: que los tres platos de producción, al
reintentarlos, se acepten.

---

## 13. Suelos y proceso

- **Quién lo construye y lo revisa.** `docs/reference/agent-team.md` § Models: quien
  implementa validación de alergias o **validación de la salida de un modelo** es opus a
  `high`, y `invariant-reviewer` también; `AGENTS.md` lo llama `quality-max`. «Un cambio
  de una línea ahí no es un cambio pequeño.» Esto es las dos cosas. `backend-high` y
  `invariant-reviewer`; `tests` si se añade un caso al e2e de imágenes.
- **Decisión.** Hace falta un registro nuevo (`0073`) que **enmiende `0066`**. La frase
  de `0066` («se rechaza solo por un alimento de más claramente visible que el juez
  nombra y que lleva un alérgeno que el plato no tiene») sigue siendo verdad palabra por
  palabra; lo que cambia es qué es «de más», y dos tests que lo fijaban al revés.
  `0072` y `0004` no se tocan. Lo redacta el lead con lo que decida el owner.
- **`legal`.**
  - *Política de privacidad* («Si ese modelo ve con claridad en la imagen un alimento
    con un alérgeno que la receta no lleva, la imagen se rechaza»): con R sigue siendo
    verdad, y a mi juicio más que hoy — hoy se rechaza también un alimento que la receta
    **sí** lleva, nombrado de otra manera. Con (iv) no cambia nada. Con (iii) habría que
    revisar «a partir solo de la receta» si al juez se le pasa el nombre del plato (es
    dato de la receta, no de la persona). Que lo confirme `legal`.
  - *Condiciones*, § 3.3: no cambia con ninguna opción.
  - *`imagenes-de-platos.md` § 5, IMG-2*: hay que añadir una tercera vía — «el juez
    acepta una forma de la misma familia que la del plato» — con su mitigación (la nota
    `own_form`, la tabla cerrada). IMG-1 no cambia. IMG-16 pesa más (§ 8).
  - Las referencias a líneas de `judge.ts` en el § 4.2 se quedan viejas.
  Aviso a `legal` cuando el owner decida; hasta entonces no hay texto que cambiar.
- **El asesor.** No lo he consultado: la regla del equipo lo reserva para cuando uno
  está atascado, y no lo estuve.

---

## 14. Preguntas que solo el owner puede contestar

| # | Pregunta | Mi recomendación |
| --- | --- | --- |
| 1 | ¿Se acepta el principio: la forma que el plato tiene o nombra no cuenta como alimento de más? | **Sí.** Es lo que arregla los tres casos y 81 de los 128 platos expuestos, a cambio de 229 pares de 26.394 |
| 2 | ¿El título basta como llave, o hace falta además un ingrediente del que se pueda hacer la forma? | **El título basta.** La variante prudente deja 2 o 3 platos más sin arreglar y añade una tabla. Si `invariant-reviewer` la prefiere, la diferencia es pequeña |
| 3 | La familia de las formas de carne: ¿vale para heura, seitán, tempeh, soja texturizada, tofu firme y carne picada, o solo para los sustitutos vegetales? | **Para todos esos.** Lo que está en juego son los aglutinantes de unas albóndigas de bote (gluten, huevo), que no se ven en ninguna |
| 4 | ¿«Retirar» debe valer para cualquier imagen publicada, y no solo para las aceptadas a mano (IMG-16)? | **Sí, ahora.** Se dejó fuera en 009; R hace que el juez acepte más, y hoy una aceptación mala solo se quita con una migración |
| 5 | ¿Pueden entrar en el repositorio (público) las respuestas del juez del piloto, como test? | **Sí, reducidas**: los alimentos vistos, el emparejado y los slugs con sus gramos, sin el nombre de los platos de la biblioteca privada. Sin eso el criterio principal no es un test |
| 6 | ¿`missing_main` debe verse en `/admin` como aviso de foto poco fiel? | **Más adelante** (fase 4). Hoy mide sobre todo cómo nombra el juez |
| 7 | ¿Se cierran los agujeros del § 5.6 en este proyecto? | **Sí, como fase 3.** Es la mitad del trabajo que hace al juez más estricto |
| 8 | Lactosa y «puede contener»: ¿se revisan ahora? | **No.** Con datos de producción, en la fase 4 |
| 9 | Después de publicar, ¿reintentar los platos bloqueados? | **Sí**, a mano desde `/admin`: ≈ 0,04 $ cada uno |
| 10 | ¿Se guardan las respuestas de las dos llamadas del juez con cada intento, y se conservan las notas al aceptar a mano? | **Sí, en la fase 1.** Es lo que permite medir el siguiente afinado con producción y no con suposiciones. Sin datos de nadie y sin migración |

---

## 15. Qué no sé

- **Con qué frecuencia usa el juez cada nombre.** Toda la exposición del § 5.3 supone
  nombres. Solo lo dicen las notas de producción (con el tiempo) o llamadas de pago.
- **Si en el caso de las tortitas (b) emparejó o no.** Ya no se puede saber: la
  aceptación a mano borró las notas.
- **Qué contestó el juez en producción.** Solo quedan las notas del veredicto; las 17
  imágenes aceptadas no se pueden volver a juzgar con otra regla sin pagar las llamadas.
- **Qué mostraban las tres imágenes.** Solo el owner vio una.
- **Si el catálogo de producción es el de la semilla** (930 filas). Una fila de más con
  una palabra común cambia el paso de palabras sueltas.
- **Cuántas recetas tienen el título en inglés.**
- **El efecto real sobre la tasa de rechazo.** Con 18 platos no se puede afirmar; ver § 12.
- **Si la variante del título con ingrediente cambia los 229 pares.** La medí con una
  versión anterior de las tablas; hay que repetirlo con las definitivas.

---

## Anexo — Las tablas del prototipo

Son el punto de partida del PRD, no el diseño final: cada fila es un test y una línea
que el revisor lee.

**Familias** (palabra del juez → el plato tiene su versión si…):

| Palabras | Un ingrediente que *es* la forma | El título nombra |
| --- | --- | --- |
| bread, toast, bun, roll, baguette, sandwich, crouton | `pan-sin-gluten` | pan, panecillo, tostada, tosta, tostaditas, rebanada, bocadillo, sándwich, bikini, montadito, arepas, migas |
| breadcrumb, crumb, breaded, batter, battered, tempura | `pan-rallado-sin-gluten`, `copos-de-maiz` | rebozado, empanado, tempura |
| pancake, crepe, waffle, fritter | — | tortitas (si el plato no lleva tortitas de arroz o de maíz), crepes, galette, gofres, blinis, buñuelos |
| cake, muffin, cupcake, brownie | `tortitas-de-arroz`, `tortitas-de-maiz` | bizcocho, magdalena, muffin, tarta, pastel, brownie |
| biscuit, cookie | `galletas-sin-gluten` | galletas |
| cracker | `tortitas-de-arroz`, `tortitas-de-maiz` | — |
| tortilla, wrap, taco, flatbread, pita | `tortilla-de-maiz`, `nachos` | wrap, tacos, burrito, fajitas, enchiladas, quesadilla, arepas |
| pizza, crust, dough, pastry, pie, tart, quiche, empanada, dumpling, gyoza | — | pizza, empanada, empanadillas, quiche, hojaldre, gyozas |
| pasta, noodle, spaghetti, penne, macaroni, fusilli, lasagna | `pasta-sin-gluten`, `fideos-de-arroz-*`, `fideos-de-cristal` | — |
| meatball, burger, patty, sausage | `heura`, `seitan`, `tofu-firme`, `tofu-ahumado`, `tempeh`, `soja-texturizada`, `hamburguesa-vegetal`, `carne-picada-*` | albóndigas, hamburguesa, salchichas |
| nugget, croquette | — | nuggets, croquetas |
| milk, milkshake | `leche-de-soja`, `-avena`, `-almendra`, `-arroz`, `-coco`, `-coco-ligera`, `bebida-de-*`, `leche-sin-lactosa` | — |
| yogurt, yoghurt | `yogur-de-soja`, `yogur-de-coco` | — |
| cheese | `queso-vegano` | — |
| cream | `crema-de-coco`, `leche-de-coco*`, `nata-vegetal-*` | — |

**Nombres supuestos para medir la exposición** (§ 5.3): los de la columna «nombre que
pone el juez» de esa tabla. **Alimentos de más de la prueba al revés** (§ 5.4): 63, entre
ellos bread, toast, bun, croutons, breadcrumbs, pancakes, waffles, cake, cookies,
crackers, pizza base, pastry, pasta, noodles, spaghetti, wheat tortilla, wrap,
flatbread, meatballs, burger patty, nuggets, croquettes, milk, yogurt, cheese, feta
cheese, mozzarella, parmesan, cream, butter, egg, shrimp, prawns, king prawns, mussels,
squid, salmon, tuna, peanuts, walnuts, almonds, sesame seeds, tofu, soy sauce, mustard,
celery, oats, couscous, seitan, mayonnaise, hummus, pesto, surimi.

**Límites del método.** El prototipo es una copia de `judge.ts` con interruptores; no
pasó por lint, tipos ni revisión. La prueba al revés pone cada alimento de más como
«principal» y «específico», el caso más duro. La reconstrucción de un caso de producción
a partir de su nota es fiel en lo que la nota dice y supuesta en lo que calla.
