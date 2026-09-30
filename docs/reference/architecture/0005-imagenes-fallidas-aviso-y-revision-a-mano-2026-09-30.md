# 0005 — Imágenes fallidas: aviso por correo, candidata guardada y aceptación a mano

> **Purpose**: respuesta del agente `architect` a la petición del owner del 2026-09-30,
> el mismo día en que salió el reintento a mano (#168): (1) un correo cuando falla la
> imagen de un plato, (2) poder ver en la consola la imagen que falló y aceptarla a mano,
> también contra el juez de alérgenos, y (3) guardar las imágenes rechazadas siete días
> en Vercel Blob. Dice, para cada una, si se puede, qué cuesta de verdad, qué rompe, cómo
> queda escrito el invariante del juez, y en qué orden hacerlo.
> **Audience**: el owner y los agentes. **Committed**: sí. **Maintained by**: el agente
> `architect`; una vez fusionado no se edita — una revisión posterior es un informe nuevo.
>
> Base: `main` en `4aa4796` (el código de imágenes es el de #168, `530ba29`), leído en un
> checkout que estaba en la rama `sentry-11`; sus cambios sin confirmar no tocan imágenes,
> avisos, consola, `core`, `database` ni `docs/legal` (comprobado con `git diff`). Cada número
> lleva etiqueta: **medido** (dónde), **estimado** (con la hipótesis) o **desconocido**.
> Para este informe se leyó el código y la documentación de Vercel Blob (páginas del
> 2026-09-15 y 2026-09-23). **No se hizo ninguna llamada a modelo, no se leyó producción,
> no se escribió en ninguna base de datos y no se gastó nada.** La base de desarrollo está
> por encima de su cuota de Neon (nota de #168), así que no hay medición nueva: los números
> medidos son los de los pilotos y el `LOG.md` del proyecto 006.

---

## 1. Veredicto

Son tres preguntas, y cada una tiene su respuesta.

| # | Pregunta | Veredicto | Lo que lo condiciona |
| --- | --- | --- | --- |
| 1 | Correo al owner cuando falla una imagen | **Sí, con condiciones** | «Inmediato, agrupado y como mucho uno por hora» sin cron nuevo significa: el primero sale al momento, los de esa hora esperan al siguiente correo. Y el correo lleva **motivos y recuentos, no nombres de plato** (recomendación; § 4.1) |
| 2 | Ver la imagen que falló y aceptarla a mano | **Sí, con condiciones** | Solo se acepta un fichero con C2PA, comprobado otra vez sobre los bytes al aceptar. Toda aceptación es una anulación del juez de alérgenos (no existe otro rechazo del juez). No se entrega sin una forma de **retirar** lo aceptado |
| 3 | Guardar las rechazadas 7 días en Blob | **Sí, con condiciones** | En un **almacén privado aparte** (acción del owner en Vercel), nunca con URL pública. Las imágenes sin C2PA **no se guardan**. La limpieza va por las rutas guardadas en la base, dentro del cron de las 03:30 |

Nada de esto cuesta dinero apreciable (< 0,01 $ al mes, **estimado**, § 8), no necesita
migración y no toca `0004`: los alérgenos del plato siguen saliendo de la receta, en
código. Lo que sí cambia es una frase que hoy es verdad en cuatro sitios — «una imagen
rechazada nunca se guarda» — y hay que reescribirla con precisión (§ 5).

**La restricción del lead queda confirmada**: un fichero sin manifiesto C2PA no puede
aceptarse nunca, ni a mano (§ 2, P3).

---

## 2. Premisas revisadas

| # | Premisa | Estado | Evidencia |
| --- | --- | --- | --- |
| P1 | Hoy solo se guarda una imagen aceptada | **confirmada** | `apps/api/src/modules/ai/services/DishPicture.service.ts:154-155` y `:251-259`: el único `store.put` está en `keep()`. Los bytes de un intento rechazado se pierden al volver de `attempt()` (`:219-225`: solo sale una nota y un motivo) |
| P2 | Las imágenes con candidata son las de `judge_allergen`, `judge_rejected` y `no_provenance` | **incorrecta**, en tres puntos | (a) **`judge_rejected` no puede ocurrir**: `judgePicture` rechaza solo cuando `rejecting` no está vacío, y entonces escribe siempre `extra_allergen:` (`packages/core/src/domain/DishPicture/judge.ts:496`, `:502`, `:511`); `reasonOfRejection` lo lee como `judge_allergen` (`packages/core/src/entities/DishPicture/PictureReason.ts:66-68`). **Toda imagen rechazada por el juez lo es por un alérgeno.** (b) Hay un cuarto caso con imagen dibujada: el juez falla (tiempo agotado, 5xx) después de dibujar (`DishPicture.service.ts:213-217`, `:243-247`): imagen con C2PA que nadie juzgó. (c) El motivo de la fila es el del **último** intento (`:159`): una fila `call_failed` puede tener una imagen rechazada por el juez en el intento 1 |
| P3 | Una imagen sin C2PA nunca debe poder aceptarse | **confirmada** | Código: `DishPicture.service.ts:207-211` («a file without its C2PA manifest is never kept»). Legal: el C2PA firmado es la capa de metadatos del art. 50.2 y de la medida 1.1.1 del Código (`docs/legal/imagenes-de-platos.md` § 1.5, § 2.3.2), y la política en vivo dice «los ficheros llevan además una marca invisible y legible por máquina» (§ 4.2 b, «sin variantes […] así que la última frase es verdad»). Aceptar un fichero sin manifiesto hace falsa esa frase. El camino «sin C2PA» que legal contempla (§ 2.3.3) exige escribir IPTC, otro texto y un abogado: no es un botón |
| P4 | Vercel Blob permite guardar algo no público | **confirmada, con un matiz que decide el diseño** | El acceso es una propiedad **del almacén**, no del fichero: «Private storage requires a private Blob store» (docs de Vercel, *Private Storage*, 2026-09-15). El almacén actual es público (`apps/api/src/modules/ai/clients/VercelBlobPictureStore.ts:35`). Privado = un segundo almacén. El SDK instalado (`@vercel/blob` 2.8.0) ya trae `get()` con `access: 'private'`. Los almacenes son ilimitados en todos los planes (*Blob Pricing*, 2026-09-23) |
| P5 | La limpieza cabe en el cron de las 03:30 | **confirmada** | `apps/api/src/modules/recipes/controllers/Cron.controller.ts:72-90`: ya hay un paso previo al barrido con presupuesto propio (`WATCH_BUDGET_MS`, `:19`, `:76-79`). `del()` es gratis; `list()` es una operación avanzada y no hace falta (§ 4.2) |
| P6 | El correo cabe en `owner-alerts` con su reclamo | **confirmada** | `apps/api/src/modules/owner-alerts/services/OwnerAlerts.service.ts:163-183` (`deliver(kind, since, mail)`) y `packages/core/src/repositories/Analytics/AnalyticsRepository.ts:42-80` (bloqueo consultivo + comprobación + inserción). Un reclamo `picture-failed` desde «hace una hora» da «como mucho uno por hora» sin código nuevo de deduplicación |
| P7 | «Inmediato pero agrupado» | **hipótesis que no se cumple tal cual** | Sin cron por hora (rechazado en `0071`: +15 CU-h de Neon al mes) no hay quien envíe «al final de la hora». El primer fallo envía; los siguientes de esa hora no pueden. § 4.1 dice adónde van |
| P8 | El nombre de un plato es dato de catálogo y puede ir en el correo | **confirmada hoy, y aun así no lo recomiendo** | Las recetas son datos de referencia que no nombran a nadie (`AdminCatalogue.controller.ts:25-29`) y la consola ya lista sus nombres. Pero: `recipe_source` admite `user` (`packages/database/src/schemas/_enums.ts:52`) con `recipes.createdBy` (`recipe.schema.ts:23`) — ningún código la escribe hoy, pero el día que exista, un nombre será texto de una persona; y la regla de los correos es mecánica y prohíbe el plato **por su nombre**: «There is no field for an address, a name, a message or a dish, so the mail cannot carry one» (`packages/core/src/controllers/Admin/AdminAlertController.ts:50-55`), con su centinela en el spec (`apps/api/src/modules/email/templates/OwnerMail.spec.ts:22`, `SENTINEL-DISH-NAME`) |
| P9 | Hace falta una migración | **incorrecta** | `recipe_images.provenance` es `jsonb` (`packages/database/src/schemas/recipe.schema.ts:136`), el `check` de `status` no cambia (`:145`) y `audit_logs.action` es `text` sin `check` (`platform.schema.ts:85`). Es como entró `provenance.reason` en #168 |
| P10 | El reintento convive con una candidata | **incorrecta hoy** | `retryPicture` pone `provenance: null` (`packages/core/src/repositories/Recipe/RecipeRepository.ts:809`) y `completePicture`/`failPicture`/`releasePicture` la sobrescriben entera (`:230`, `:254`, `:775-782`). Cualquiera de los cuatro, sobre una fila con candidata, pierde la ruta del fichero para siempre |
| P11 | Lo aceptado se puede deshacer | **incorrecta** | No hay ninguna ruta que quite una imagen `ready`: el reintento la rechaza (`packages/core/src/controllers/Recipe/RecipeController.ts:480-482`, `not_retryable`). Hoy deshacer sería una migración de datos revisada |
| P12 | El aviso se dispara desde `DishPictureService` | **con matiz** | `modules/ai` no puede importar `core/controllers/Admin` (`apps/api/src/modules/ai/health-boundary.spec.ts:52`), que es de donde lee `OwnerAlertsService`. El gancho va **fuera** de `modules/ai` (§ 6) |
| P13 | Nada de esto roza `0028` | **confirmada** | Una imagen, una receta, sus ingredientes y sus alérgenos no nombran a nadie. La ruta de Blob lleva el id de la receta y un aleatorio (`DishPicture.service.ts:257-258`). Ninguna lectura nueva toca `created_by` |
| P14 | Siete días, igual que la espera | **confirmada, y debe ser la misma constante** | `PICTURE_COOL_OFF_DAYS = 7` (`RecipeController.ts:59`). Con un solo reloj (`lastAttemptAt`), «la candidata caduca» y «el plato puede redibujarse» son el mismo instante (§ 4.2) |

---

## 3. Qué hay hoy

**El dibujo.** Una vista reclama el dibujo (`RecipeController.requestPicture`,
`RecipeController.ts:417-438`; una sola sentencia en `RecipeRepository.claimPicture`,
`RecipeRepository.ts:99-126`) y `DishPictureService.draw` corre después de la respuesta.
Hace hasta `PICTURE_ATTEMPTS = 3` intentos (`RecipeController.ts:62`). Cada intento: tope
del mes → imagen → **C2PA** (`:207-211`; sin manifiesto el plato falla ya, sin más
intentos, `:166-168`) → dos llamadas al juez → `judgePicture`. Solo `keep()` guarda, en el
almacén público, con caché de un año (`VercelBlobPictureStore.ts:9`, `:34-41`). Si nada se
acepta, `failPicture` deja la fila `failed` con `provenance: { notes, reason }` (`:176`) y
el plato espera 7 días. El tope, o que la cuenta no pueda pagar (402, 429; `isRefusal`,
`:60-66`), **devuelven** el reclamo (`release`, `:287-291`):
la fila queda `failed` con `provenance.released` y cualquier vista la reclama al momento.

**El juez.** Rechaza solo por un alimento de más, nombrado, más que una traza, con un
alérgeno que el plato no lleva; los alérgenos salen del catálogo, en código (`judge.ts:1-24`,
`:496`). Lo que el juez vio queda en `verdict.extras` — con los **slugs del catálogo** a
los que se mapeó cada nombre (`mappedTo`) y las **claves de alérgeno** (`foreignAllergens`)
— pero hoy solo se guardan las notas como texto (`DishPicture.service.ts:223`).

**La consola.** Recetas muestra el motivo cerrado y el botón «Reintentar»
(`AdminCatalogue.controller.ts:63-77`; `POST /admin/catalogue/recipes/:id/picture/retry`,
30 por hora, auditoría `picture.retried` en la transacción del reclamo,
`RecipeController.ts:488-490`). `provenance` nunca sale tal cual
(`packages/core/src/repositories/Admin/AdminCatalogueRepository.ts:39`).

**Los avisos.** `OwnerAlertsService` envía el resumen de las 08:00 y tres avisos
inmediatos (tres generaciones fallidas, gasto al 80 %/100 %, cron callado), cada uno
reclamado antes de enviar (`OwnerAlerts.service.ts:19-43`). El resumen **no** lleva los
fallos de imagen: `OwnerDigest` no tiene campo para ellos
(`packages/core/src/controllers/Admin/AdminAlertController.ts:56-65`). Los correos llevan
números, códigos cerrados y enlaces; su spec rechaza una `@`, un uuid y seis centinelas.

**Producción, lo único medido**: el 2026-09-28, 6 imágenes listas, 0 fallidas, 0,24 $
(**medido**, `docs/projects/006-realistic-dish-pictures/LOG.md`, «`/admin` the same day»).
El juez, repetido sobre las 57 respuestas del piloto: 57 de 57 aceptadas, 3 de 3 controles
de receta equivocada rechazados, y **2 falsos rechazos encontrados y corregidos**
(**medido**, mismo `LOG.md`, fase 2). Cuántas imágenes rechaza el juez en producción:
**desconocido**.

---

## 4. Propuesta

### 4.1 El correo

**Forma.** Un tipo nuevo de `OwnerAlert`, `picture-failures`, con recuentos por motivo
cerrado (`PICTURE_REASONS`) y un enlace a `/admin/catalogo?picture=failed` (ya existe:
`apps/web/src/app/(admin)/admin/catalogo/imagenes/page.tsx:154`). Reclamo
`picture-failed` desde «hace una hora».

**Qué cuenta.** Las filas `failed` **no devueltas** cuyo `lastAttemptAt` es posterior al
último aviso `picture-failed` (`AnalyticsRepository.lastOwnerAlert`, `:83-87`), o a hace
24 h si no hubo ninguno. Así cada correo lleva **todo lo fallado desde el correo
anterior** y nada se pierde por el reclamo de la hora.

**Cuándo se intenta enviar** (siempre el mismo método, que reclama o calla):

1. al terminar cualquier dibujo, acabe como acabe — la base ya está despierta;
2. en los dos crons diarios (03:30 y 08:00 UTC), que ya llaman a `owner-alerts`.

**Lo que esto da, dicho sin adornos.** El primer fallo de una racha llega al momento. Los
que caen dentro de esa hora salen con el siguiente dibujo que termine pasada la hora o, si
nadie abre un plato, con el siguiente cron: **hasta ~19 h después** en el peor caso
(**estimado**: correo a las 08:00, fallo a las 08:30, siguiente cron a las 03:30).
Siempre están en la consola al momento. Techo: 24 correos al día por construcción.

**Las devoluciones no avisan.** El tope ya tiene su aviso de gasto al 100 %. Un 402 en la
clave de imágenes no lo avisa nadie hoy; es una línea más en este mismo correo con su
propio reclamo de 6 h, si el owner la quiere (§ 11, Q5).

**El nombre del plato.** Puede ir sin tocar la privacidad de nadie — hoy. No lo
recomiendo, por tres razones: la regla de `0071` («un número o una etiqueta cerrada, o no
entra») está sostenida por un spec que prohíbe justo eso; `source = 'user'` existe en el
esquema y un día un nombre será texto de alguien; y el nombre no cambia lo que el owner
hace después, que es abrir la consola, donde el nombre sí está. El id de la receta
tampoco va, ni en el enlace: el spec rechaza cualquier uuid. **Esto se aparta de lo que
pidió el owner («con el plato y el motivo»)**: si quiere el nombre, se puede con tres
condiciones — solo recetas `seed`/`ai`, nombre saneado y acortado en `core` (como
`safeCode`), y la enmienda escrita de `0071` y de su spec — y es decisión suya (Q2).

Alternativas descartadas:

| Alternativa | Por qué perdió |
| --- | --- |
| Un cron cada hora que agrupe | `0071` ya lo rechazó: despierta Neon 24 veces al día |
| Un correo por fallo | El owner pidió agrupar; una racha (el proveedor deja de firmar) serían decenas |
| Solo añadirlo al resumen de las 08:00 | No es inmediato; como complemento sí sirve y es barato |
| Retrasar el envío unos minutos con `waitUntil` para agrupar | La función muere a los 300 s (`apps/api/vercel.json`); agruparía minutos, no una hora |

### 4.2 La candidata: dónde vive, cómo se ve, cuándo se borra

**Qué se guarda.** Una candidata por plato: **la última imagen con C2PA que el juez
rechazó** en un dibujo que terminó `failed`. Se retiene en memoria durante el dibujo
(≤ 227 KB, **medido** en el piloto, `docs/legal/imagenes-de-platos.md` § 2.1) y se sube
**solo si el dibujo acaba fallido**: un dibujo que acaba aceptado o devuelto no deja nada.
Si la subida falla, el plato falla como hoy, sin candidata: nunca cambia el resultado.

**Qué no se guarda.**

- **`no_provenance`**: no hay nada que decidir sobre ella (P3) y un fichero de IA sin
  marca es justo lo que no conviene tener. En su lugar, la fila guarda un diagnóstico
  cerrado: tipo de contenido, tamaño y las tres marcas de `pictureMarks` (`jpeg`, `c2pa`,
  `trainedAlgorithmicMedia`). Si el proveedor deja de firmar, fallan todos los platos al
  primer intento y el correo lo dice por el recuento.
- **La imagen que el juez no llegó a ver** (P2 b): fuera de la primera versión (Q3).
- **Las de un dibujo devuelto** (tope, 402): la fila se reclama al momento; no hay
  «fallida» que revisar.

**Dónde.** Un **segundo almacén de Vercel Blob, privado, en `fra1`**, con su propio token.
La ruta sigue la forma de la pública: `dish-picture-candidates/<recipeId>/<versión>-<aleatorio>.jpg`.

| Opción | Quién puede leer el fichero | Veredicto |
| --- | --- | --- |
| **Almacén privado aparte** | Solo quien tenga el token del almacén: la API | **Recomendada.** «Sin URL pública» es literal. Coste igual (*Blob Pricing*: «priced the same for storage, operations, and uploads»). Pide una acción del owner en Vercel |
| Prefijo aleatorio en el almacén público actual | Cualquiera con el enlace (`imagenes-de-platos.md` § 4.1: «accessible to anyone with the link») | Perdió: es oscuridad, no privacidad; una URL que se cuele en un log o en un DTO publica una imagen que el juez rechazó |
| URL firmada de vida corta (`presignUrl`) | Cualquiera con el enlace, hasta que caduque | Perdió: añade la superficie de tokens firmados para ahorrar un salto de función que aquí no cuesta nada |
| Bytes en Postgres | Solo la API | Perdió: `0066` sacó los bytes de Neon por la cuota |

**Cómo la ve la consola.** Una ruta de la API que sirve los bytes:
`GET /admin/catalogue/recipes/:id/picture/candidate`, `@Roles('admin')` (404 para
cualquier otro, como toda negación), que lee con `get()` del almacén privado y responde
con `Content-Type: image/jpeg`, `X-Content-Type-Options: nosniff` y
`Cache-Control: private, no-store`. La web ya reenvía `/api/v1/*` a la API con la cookie
de sesión como cookie propia (`apps/web/next.config.js`), así que un `<img>` apuntando a
esa ruta funciona sin nada nuevo. **La ruta de Blob no sale nunca de la API**: la fila de
receta gana un campo `pictureCandidate` con las claves de alérgeno, los ingredientes del
catálogo a los que se mapeó lo que vio el juez, y cuándo caduca — nunca la ruta.

**Qué se enseña del juez.** Las **claves de alérgeno** y los **ingredientes del catálogo**
de `verdict.extras` (`foreignAllergens`, `mappedTo`), que son conjuntos cerrados nuestros.
**No** la palabra que escribió el modelo de visión: es texto de un tercero, y la regla de
#168 es que ese texto no llega a una pantalla (`PictureReason.ts:3-7`). Para eso hay que
guardar `extras` al rechazar, no solo las notas.

**Un reloj.** La candidata se puede revisar mientras `now < lastAttemptAt + 7 días`: la
misma constante y el mismo instante que la espera. La lectura de la consola aplica esa
regla ella misma, así que una candidata caducada que el cron aún no borró no se ve ni se
acepta.

**Limpieza, en el cron de las 03:30, antes del barrido y con presupuesto propio.** Lee las
filas con candidata que ya no es revisable (caducada, o la fila ya no es `failed`), hace
`del()` de sus rutas (gratis) y quita el puntero. **Sin `list()`**: la base dice qué
existe. Su recuento va en el `cron_run` de `rewrite`. Una candidata vive en el almacén 7
días y hasta 24 h más; **revisable**, 7 días exactos.

**La regla que evita ficheros huérfanos.** Una fila con puntero a candidata **no se
reclama para dibujar**: `claimPicture` y `unclaimable` la excluyen. El puntero solo se
quita después de borrar el fichero. Consecuencia: **el reintento automático espera a la
limpieza** — el plato vuelve a poder dibujarse tras la primera pasada de las 03:30
posterior al día 7, no al segundo exacto. Si el cron calla, esos platos esperan, y el
resumen de las 08:00 ya avisa del cron callado a las 26 h.

**«Rechazar definitivamente»** = borrar el fichero y quitar el puntero. **No** toca
`status`, `attempts` ni `lastAttemptAt`: el plato sigue fallido hasta que acabe su espera,
y «Reintentar» sigue siendo el verbo aparte que gasta. Un botón que dice «descartar» no
debe costar 0,04–0,11 $.

**«Reintentar» con candidata pendiente** la descarta: la interfaz lo dice antes. Orden:
comprobaciones → reclamo (que limpia `provenance`, como hoy) → `del()`. Si la función
muere entre los dos últimos pasos queda un fichero privado de ≤ 227 KB sin puntero: P3
conocido y aceptado, igual que el de `keep()` (`DishPicture.service.ts:275-277`).

### 4.3 Estados y transiciones

La fila no gana estados (`drawing`, `ready`, `failed`; `none` es no tener fila). Gana un
dato ortogonal: **candidata** (0 o 1), solo en una fila `failed` no devuelta.

| Desde | Qué pasa | Hasta | Candidata | Quién · rastro |
| --- | --- | --- | --- | --- |
| `none`, `failed` enfriada **sin** candidata, o devuelta | una vista abre el plato | `drawing` | — | vista |
| `drawing` | el juez acepta | `ready` | la retenida en memoria se tira | automático |
| `drawing` | sin aceptar tras 3 intentos, con algún rechazo del juez | `failed`, espera 7 d | **se sube la última rechazada** | automático · correo |
| `drawing` | sin C2PA | `failed`, espera 7 d | ninguna; diagnóstico cerrado | automático · correo |
| `drawing` | tope o 402 | `failed` devuelta | ninguna | automático |
| `failed` + candidata | el owner **acepta** (dos pasos, C2PA recomprobado) | `ready`, `acceptedBy: 'owner'` | copiada al almacén público; la privada se borra | owner · `picture.accepted` |
| `failed` + candidata | el owner **descarta** | `failed`, misma espera | borrada | owner · `picture.discarded` |
| `failed` (con o sin candidata) | el owner **reintenta** | `drawing` | borrada | owner · `picture.retried` |
| `failed` + candidata | pasan 7 días | `failed`, reclamable tras la limpieza | borrada por el cron de las 03:30 | cron · `cron_run` |
| `ready` aceptada a mano | el owner **retira** | `failed`, espera 7 d desde ahora | — (el fichero público se borra) | owner · `picture.removed` |

### 4.4 Aceptar

`POST /admin/catalogue/recipes/:id/picture/candidate/accept`, `@Roles('admin')`, con
límite por hora como el reintento. En orden:

1. La fila es `failed`, tiene candidata y no ha caducado; si no, 409.
2. **El cuerpo repite las claves de alérgeno que la consola mostró**, y deben ser las
   guardadas. Es el segundo paso de confirmación puesto en el servidor: no se puede
   aceptar sin haber recibido el aviso, ni aceptar una candidata distinta de la que se vio.
3. La API lee los bytes del almacén privado y **vuelve a pasar `pictureMarks`**: sin
   `jpeg` y `c2pa`, 409 `PICTURE_NOT_ACCEPTABLE`. La marca guardada en la fila no basta.
4. `put()` de esos mismos bytes en el almacén público, en la ruta de siempre
   (`dish-pictures/<recipeId>/<versión>-<aleatorio>.jpg`), con la versión del prompt **de
   la candidata**. Sin tocar un byte: el C2PA sigue validando.
5. Una transacción: `UPDATE` guardado (`status = 'failed'` y el mismo `lastAttemptAt` que
   se leyó) a `ready`, con `provenance` que dice `acceptedBy: 'owner'` y qué alérgenos se
   anularon, **y** la fila `picture.accepted` en `audit_logs` con esas mismas claves. Si
   no actualiza nada (otra pestaña, un reintento), 409 y el fichero público recién subido
   se borra.
6. `del()` de la candidata privada (y la limpieza la recoge si esto falla).

Aceptar no llama a ningún modelo: **el tope del mes no lo frena**. Con el interruptor
`dishPictures` apagado se rechaza, como el reintento.

Entre almacenes no hay `copy()` (el SDK lo limita al almacén del token,
`@vercel/blob/dist/index.d.ts:351`); leer y volver a escribir es además lo que permite el
paso 3.

**Retirar.** `POST …/picture/remove`, solo para una imagen con `acceptedBy: 'owner'`:
fila a `failed` con un motivo cerrado nuevo (`owner_removed`), fichero público borrado,
auditoría `picture.removed`. Sin esto, una aceptación equivocada se queda delante de
todos los que vean ese plato hasta que alguien escriba una migración (P11).

Alternativas descartadas:

| Alternativa | Por qué perdió |
| --- | --- |
| Guardar las tres imágenes de un dibujo fallido | Tres ficheros, tres decisiones y un array en la fila para un caso raro; la última rechazada basta y el diseño admite ampliarlo |
| Parar el dibujo al primer rechazo del juez (ahorra hasta 2 intentos, ~0,07 $) | Convierte cada rechazo en trabajo del owner; hoy un segundo intento puede arreglarlo solo. Cuántas veces lo arregla: **desconocido** (Q-medición, § 11) |
| Tabla nueva `recipe_image_candidates` | Una migración (suelo de `migration-reviewer`, y la base de desarrollo está sobre su cuota) para cientos de filas y un dato transitorio que cabe en el `jsonb` |
| Mostrar la palabra del juez («prawns») | Texto de un modelo ajeno en pantalla; el slug del catálogo dice lo mismo con palabras nuestras |
| Que aceptar exija que el juez vuelva a mirar | El juez ya dijo que no: volver a preguntarle no añade nada a la decisión del owner |

---

## 5. El invariante, y el riesgo real

### Cómo queda escrito

Hoy se dice, en cuatro sitios, que una imagen rechazada «nunca se guarda»
(`DishPicture.service.ts:98-99`; `apps/api/AGENTS.md:255-256`, «is never stored»;
`apps/api/src/modules/ai/clients/PictureStore.ts:5`; PRD 006, criterio 6, «never stored or
shown»). Deja de ser
verdad. La formulación que propongo, para el registro de decisión que enmiende `0066`:

> **Una imagen solo llega a una persona por una de dos puertas.** (a) `judgePicture` la
> aceptó. (b) El owner, con sesión de administrador, la aceptó a mano después de ver el
> alérgeno que el juez señaló, y esa aceptación es una fila `picture.accepted` en
> `audit_logs` escrita en la misma transacción que pone la imagen `ready`. **En las dos,
> el fichero que se publica lleva su manifiesto C2PA, comprobado sobre esos mismos
> bytes.** No hay puerta (c): ningún reintento, cron ni código automático publica una
> candidata. Una imagen rechazada se guarda como mucho 7 días, en un almacén privado que
> solo lee la API, y no tiene URL pública.

`0004` no se mueve: ninguna decisión de seguridad pasa a un prompt, y lo que alguien
puede comer lo sigue decidiendo `findSafetyViolations` contra la receta. El juez de
visión nunca fue esa garantía (`imagenes-de-platos.md`, comentario del § 3.3: «reduce el
riesgo, pero no es la garantía»).

### Qué riesgo añade aceptar contra el juez

| Dirección | Qué es | Lo toca esta función |
| --- | --- | --- |
| La imagen **no** muestra un alérgeno que el plato **sí** lleva (IMG-1, P1) | La peligrosa: alguien se fía de la foto. El juez **nunca** la comprobó; la cubren la lista de ingredientes, el pie «manda la lista de ingredientes» y las condiciones | **No.** Igual antes y después |
| La imagen muestra un alérgeno que el plato **no** lleva (IMG-2, P2) | La que el juez sí mira. Legal la puntúa «confusión, desconfianza, no exposición» | **Sí**: el owner puede publicar una |

El caso real de IMG-2: una persona alérgica a los crustáceos ve gambas en la foto de un
plato que la app le da como seguro. El plato **es** seguro — la receta no las lleva y la
lista de la compra tampoco. Lo que pasa es que desconfía, o se salta la comida. El daño
físico exigiría que alguien cocine «según la foto» y añada por su cuenta un alimento que
no está ni en la receta ni en la compra; para quien tiene la alergia es inverosímil, y
para quien cocina para otro es poco probable y lo cubre el pie. **Probabilidad baja,
gravedad P2, y permanente** mientras la imagen esté publicada: por eso «retirar» es
condición.

La función existe por el caso contrario: el juez se equivoca (la salsa leída como leche;
dos falsos rechazos en la repetición del piloto) y hoy eso cuesta un plato sin imagen o
otros 0,04–0,11 $ en reintentos que pueden acabar igual.

---

## 6. Requisitos

**Código** (quién: `backend`, salvo donde se dice):

- `packages/core`: `candidate` en lo que lee `pictureState`; `claimPicture` y
  `unclaimable` excluyen filas con candidata; métodos guardados nuevos en
  `RecipeRepository` (aceptar, descartar, retirar, candidatas a limpiar) con la auditoría
  en su transacción, como `retryPicture`; `AUDIT_ACTIONS` y `AuditMetadataByAction` ganan
  `picture.accepted` (claves de alérgeno), `picture.discarded`, `picture.removed`;
  `PICTURE_REASONS` gana `owner_removed`; el lector de recuentos de fallos para el correo.
- `apps/api` `modules/ai`: `DishPictureService` retiene la última rechazada, guarda
  `verdict.extras` y sube la candidata al fallar; un `PictureCandidateStore` (put, get,
  del) con su implementación de Blob privado y su stub en memoria. Sin token, no está
  disponible y el dibujo se comporta exactamente como hoy.
- `apps/api` `modules/admin`: las rutas de ver, aceptar, descartar y retirar; el campo
  `pictureCandidate` en las filas de receta. **La de ver es la primera respuesta binaria
  de la API**: hoy ninguna ruta sirve bytes (los dos únicos `@Res()` son redirecciones),
  así que debe escribir ella misma su cuerpo y sus cabeceras (`StreamableFile` o `@Res()`)
  y declarar en `dto/out` lo que responde (`0039`). Su 404 seguirá siendo el JSON de
  `AllExceptionsFilter`, que para un `<img>` es simplemente una imagen rota.
- `owner_removed` entra en `PICTURE_REASONS`, que es el conjunto cerrado sobre el que la
  web elige etiqueta: una clave más en los dos diccionarios.
- `apps/api` `modules/owner-alerts` y plantilla `OwnerAlert`: el tipo `picture-failures`.
  **El gancho va fuera de `modules/ai`** (P12): o `schedule(claim)` acepta un «al
  terminar», o los dos sitios que programan un dibujo
  (`apps/api/src/modules/meal-plans/services/MealPlans.service.ts:72`,
  `apps/api/src/modules/admin/services/AdminCatalogue.service.ts:34`) pasan por un
  servicio pequeño que dibuja y avisa. `backend` elige; lo que no vale es importar
  `OwnerAlertsService` dentro de `modules/ai`.
- Cron de las 03:30: el paso de limpieza y el vaciado del correo; el de las 08:00, el
  vaciado del correo.
- `frontend`: una página de revisión (la imagen grande junto a la lista de ingredientes
  del plato, el aviso con los alérgenos, los dos pasos, descartar, reintentar), el enlace
  desde Recetas, y «Retirar» en una imagen aceptada a mano. Toda pantalla nueva pasa por
  `accessibility` y por la skill de diseño.
- `tests`: suites de extremo a extremo para las cuatro rutas y la limpieza, con el stub.

**Suelos.** Aceptar contra el juez es validación de salida de modelo y alergias: quien lo
implemente y `invariant-reviewer` van en `opus` a `high` (`docs/reference/agent-team.md`,
«Two floors never move»).

**Datos.** Ninguna migración (P9).

**Infraestructura — acciones del owner.** Crear el almacén privado en `fra1` y conectarlo
al proyecto de la API con un nombre de variable propio (por ejemplo
`BLOB_CANDIDATES_READ_WRITE_TOKEN`), que entra en `Env.validation.ts`, `turbo.json` y la
lista de nombres. El nombre exacto que Vercel da a la variable de un segundo almacén lo
confirma `backend` al conectarlo.

**Documentos — el lead.** Un registro de decisión que enmiende `0066` (el invariante del
§ 5, los siete días, el almacén privado) y, si el owner elige nombres en el correo, `0071`.
La nota de imágenes de `apps/api/AGENTS.md` y los comentarios de `DishPicture.service.ts`
y `PictureStore.ts` cambian en la misma PR que el código.

**Legal.** § 10.

---

## 7. Riesgos

| # | Qué puede romperse | Para quién | Probabilidad | Cómo se vería | Cómo se deshace |
| --- | --- | --- | --- | --- | --- |
| R1 | El owner acepta una imagen que de verdad muestra un alérgeno que el plato no lleva | Quien vea ese plato (confusión, IMG-2) | Baja | `picture.accepted` en el Registro; recuento de «aceptadas a mano» en Imágenes | «Retirar» |
| R2 | Se acepta un fichero sin C2PA | Todos: texto legal falso, art. 50.2 | Muy baja: no se guarda, y se recomprueba sobre los bytes | Test que intenta aceptar unos bytes sin manifiesto | «Retirar»; aviso a `legal` |
| R3 | Una candidata rechazada queda accesible desde fuera | Nadie en concreto; una imagen que el juez rechazó, con marca de NutrIA | Muy baja con almacén privado | Test: la ruta responde 404 sin sesión de admin; el DTO no lleva la ruta | Borrar el fichero |
| R4 | La limpieza no corre y las candidatas se acumulan | El owner (platos que no se redibujan) | Baja | El resumen avisa del cron callado a las 26 h; `cron_run` con el recuento | Correr el cron a mano |
| R5 | Un fichero huérfano sin puntero | Nadie | Baja | No se ve; ≤ 227 KB privados | `list()` a mano del almacén, una vez |
| R6 | El correo se vuelve ruido | El owner | Media si el proveedor falla en racha | Más de un par al día | Subir la ventana del reclamo; un interruptor |
| R7 | El gancho del aviso rompe la frontera de `modules/ai` | El invariante de salud | Baja si se sigue el § 6 | `health-boundary.spec.ts` | — |
| R8 | Subir la candidata alarga un dibujo que ya iba justo | Nadie: el dibujo tiene 240 s de 300 | Muy baja | Filas `drawing` viejas | La subida tiene su propio límite y su `catch` |
| R9 | El reintento automático se retrasa hasta 24 h tras el día 7 | Quien abra ese plato ese día: ve el plato de reserva | Segura, y pequeña | — | Es el precio de no dejar huérfanos |

---

## 8. Coste y esfuerzo

**Dinero.** Todo **estimado**, con la hipótesis de que el tope de 10 $ al mes
(`Env.validation.ts:232`) a 0,0337 $ por imagen (`DishPicture.service.ts:23`) da como
mucho ~296 imágenes dibujadas al mes:

| Concepto | Techo | Coste |
| --- | --- | --- |
| Almacenamiento de candidatas | 296 × 227 KB ≈ 67 MB, y solo 7 días cada una | < 0,002 $/mes a 0,023 $/GB |
| Operaciones avanzadas (subir candidata; subir al aceptar; crear el almacén, una vez) | < 600 al mes | < 0,003 $ a 5 $ por millón |
| `del()` | — | gratis |
| Ver una candidata (lectura + función + transferencia de ~0,2 MB) | decenas al mes | céntimos de céntimo |
| Llamadas a modelo | **ninguna nueva** | 0 |
| **Total** | | **< 0,01 $ al mes** |

Se paga del crédito mensual del plan Pro de Vercel (informe `0003`, P5); en Hobby entraría
en lo incluido (1 GB, 2 000 operaciones avanzadas). **No hace falta ninguna decisión de
gasto.** Aceptar a mano **ahorra**: cada candidata aceptada evita un reintento de hasta
~0,11 $ (tres intentos).

**Neon.** Las comprobaciones del correo corren al final de un dibujo o dentro de un cron,
con la base ya despierta: no añaden horas de cómputo. La limpieza es una lectura y una
escritura pequeñas al día.

**Esfuerzo**, en tamaño de fase de equipo (lo mueven: cuántas pantallas nuevas y el suelo
de `opus` en la fase 3):

| Fase | Tamaño | Tiempo del owner |
| --- | --- | --- |
| 1. Correo | S | 5 min: provocar un fallo y ver el correo |
| 2. Candidata, ver y descartar | M | ~15 min: crear el almacén; mirar la página en el iPhone |
| 3. Aceptar y retirar | M (suelo `opus`/`high`) | ~15 min: aceptar una, verla en el plato, retirarla |

---

## 9. Plan

Cada fase se entrega sola y deja `main` verde. Orden: primero lo que no necesita nada del
owner.

**Fase 1 — El correo de fallos.** Tipo `picture-failures`, reclamo por hora, recuentos por
motivo desde el último aviso, enlace a la lista filtrada; se intenta al terminar cada
dibujo y en los dos crons. Sin web, sin Blob.
*Éxito*: con el stub, un dibujo fallido envía un correo; tres en una hora envían uno, y
los otros dos salen en el siguiente; el spec de correos sigue sin `@`, sin uuid y sin
centinelas. *Parar si*: el gancho no puede vivir fuera de `modules/ai` sin rodeos.

**Fase 2 — La candidata: guardar, ver, descartar, limpiar.** Almacén privado y su stub;
`DishPictureService` sube la última rechazada con sus `extras`; `claimPicture` la respeta;
la ruta que sirve los bytes; la página de revisión **sin** botón de aceptar; descartar
(`picture.discarded`); el reintento la borra; la limpieza en el cron. Sin el token, todo
queda apagado y el producto es el de hoy.
*Éxito*: un rechazo del juez deja exactamente un fichero privado y un puntero; la página
lo muestra solo a un admin (404 sin sesión, 404 a un usuario normal); el DTO no lleva
ninguna ruta de Blob; a los 7 días (reloj inyectado) el cron lo borra y el plato vuelve a
ser reclamable; un dibujo aceptado no deja ninguna candidata. *Parar si*: Vercel no deja
conectar un segundo almacén al proyecto con variable propia, o el privado exige algo de
pago.

**Fase 3 — Aceptar contra el juez, y retirar.** La ruta de aceptar con sus seis pasos, el
aviso con los alérgenos y los ingredientes del catálogo, la confirmación en dos pasos,
`picture.accepted`; «Retirar» y `picture.removed`; «aceptadas a mano» en Imágenes; los
textos de `legal`; el registro de decisión.
*Éxito*: unos bytes sin C2PA no se pueden aceptar por ninguna ruta (test); una aceptación
sin repetir los alérgenos se rechaza; cada `ready` con `acceptedBy: 'owner'` tiene su fila
de auditoría (misma transacción: test que hace fallar la auditoría y comprueba que la
imagen no se publica); el fichero publicado es byte a byte el que devolvió Gemini;
`invariant-reviewer` sin P0 ni P1. *Parar si*: `legal` concluye que la anulación exige
cambiar un texto publicado que el owner no quiere cambiar.

**Después, si el owner lo quiere**: la imagen que el juez no llegó a ver (Q3); el 402 de
la clave de imágenes en el correo (Q5); una línea de fallos de imagen en el resumen de
las 08:00.

---

## 10. Notas para `legal`

Lo que `docs/legal/imagenes-de-platos.md` necesita, a juicio de `legal`:

1. **§ 4.2 b, política en vivo**: «un modelo que ejecuta DeepInfra comprueba que la
   imagen no muestra alimentos que la receta no lleva». Sigue describiendo lo que se hace,
   pero tras la fase 3 una imagen publicada puede ser una que esa comprobación rechazó.
   ¿Hace falta decir que una persona puede revisarla? Si cambia, cambia `privacy.updated`.
2. **§ 5, IMG-2**: «lo evita: el juez de visión» pasa a «el juez, o la revisión del owner
   con aviso, doble confirmación y registro». Dos riesgos nuevos: una candidata rechazada
   accesible desde fuera (lo evita el almacén privado) y un fichero sin C2PA aceptado a
   mano (lo evita el código, sobre los bytes).
3. **§ 4.1, tabla de flujos**: una fila para las candidatas — ningún dato personal,
   almacén privado de Vercel Blob en `fra1`, 7 días. Y la casilla en
   `checklist-activacion.md` § 0 ter: **el segundo almacén también en `fra1`**, o «en la
   Unión Europea» deja de ser verdad para lo que se guarda.
4. **Ley de IA**: una candidata que solo ve el owner dentro de la consola, ¿es una
   «exposición» del art. 50.4-50.5? Mi lectura es que no — no se pone a disposición de
   nadie —, pero la página de revisión la titula igualmente como imagen generada por IA.
   **[abogado]** si `legal` lo ve dudoso.
5. **Confirmar P3**: que un fichero sin C2PA no pueda aceptarse a mano bajo ninguna
   circunstancia es una regla de cumplimiento, no una preferencia técnica.
6. La fila `picture.accepted` lleva al owner como actor y claves de alérgeno del catálogo:
   ningún dato personal de un tercero.

---

## 11. Qué no sé

**Solo una medición lo resuelve:**

- Cuántas imágenes rechaza el juez en producción, y cuántas de ellas un segundo o tercer
  intento arregla solo: **desconocido**. Está en la consola del owner (Imágenes, fallos
  por motivo) y en `recipe_image_calls`. Decide si merece la pena parar al primer rechazo
  (§ 4.4) y cuánto va a usarse todo esto.
- Cuántos rechazos del juez son falsos: **desconocido** fuera del piloto. La fase 2 lo
  mide sola: cada candidata que el owner mire es un dato.
- Si el nombre de variable de un segundo almacén conectado es libre: **hipótesis**; se
  comprueba al conectarlo.

**Solo el owner lo decide:**

- **Q1. El almacén privado.** ¿Crea un segundo almacén de Blob, privado, en `fra1`? Es una
  escritura en Vercel y necesita su sí expreso. Sin él, las fases 2 y 3 no empiezan; la
  alternativa (prefijo aleatorio en el público) no la recomiendo.
- **Q2. El nombre del plato en el correo.** Recomiendo que no: motivos, recuentos y
  enlace. Si lo quiere, se enmienda la regla de `0071` con las tres condiciones del § 4.1.
- **Q3. La imagen que el juez no llegó a ver.** ¿Entra como candidata? Aceptarla es
  decidir sin ningún veredicto, ni a favor ni en contra. Recomiendo dejarla fuera de la
  primera versión: un reintento cuesta 0,04 $ y el juez la mira.
- **Q4. Retirar.** ¿Basta con retirar lo aceptado a mano (lo que propongo), o quiere
  retirar cualquier imagen publicada, también las que aceptó el juez?
- **Q5. El 402 de la clave de imágenes.** ¿Lo quiere en el correo, con un reclamo de 6 h?
  Hoy no lo avisa nadie.

---

## Fuentes

- Código de `main` en `4aa4796`, en las rutas citadas.
- `docs/decisions/0004`, `0028`, `0066`, `0068`, `0071`; `docs/decisions/LOG.md`
  (2026-09-27, 2026-09-29, 2026-09-30).
- `docs/legal/imagenes-de-platos.md` §§ 1.5, 2.1, 2.3, 3.3, 4.1, 4.2, 5;
  `docs/legal/checklist-activacion.md` § 0 ter.
- `docs/projects/006-realistic-dish-pictures/PRD.md` (criterios 5 y 6) y `LOG.md`
  (fases 2 y 5).
- `docs/reference/architecture/0003-imagenes-de-platos-2026-09-26.md` (P5, § 7.1).
- Vercel, *Private Storage* (actualizada el 2026-09-15) y *Vercel Blob Pricing*
  (actualizada el 2026-09-23); tipos de `@vercel/blob` 2.8.0 instalados en el repositorio.
