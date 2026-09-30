# Imágenes de los platos (proyecto 006): Ley de IA, consumo, privacidad y textos

> **No soy abogado.** Este es el análisis que haría uno, con cada conclusión atada al
> artículo o al documento oficial en que se apoya, para que el propietario, o el abogado al
> que se lo enseñe, pueda comprobarla. Lo que depende de una interpretación está marcado
> **[abogado]** y reunido en el § 7.
>
> **Propósito**: decidir qué rótulo llevan las imágenes de los platos, qué marca legible
> por máquina hace falta y qué cambia en la política, el registro y la EIPD, y dejar los
> textos listos para pegar. **Audiencia**: el propietario, el lead, `frontend` y `backend`.
> **Committed**: sí. **Mantenido por**: el agente `legal`.
>
> **Fecha de corte**: 2026-09-27. **Leído**: el PRD en borrador
> `docs/projects/006-realistic-dish-pictures/PRD.md` (rama del lead, sin fusionar), el
> informe [`0003`](../reference/architecture/0003-imagenes-de-platos-2026-09-26.md), el código
> de `main` en `7b28c5d` y el de la rama del lead en `4d48a1a`
> (`apps/web/src/app/(app)/plan/comida/[id]/page.tsx:124-136`,
> `apps/web/src/components/NextMeal/NextMeal.tsx:56-62`,
> `apps/web/src/components/DishPicture/DishPicture.tsx`), y el script del piloto del
> 2026-09-27, que está fuera del repositorio (`docs/local/`, en `.gitignore`).
>
> **Revisión 2026-09-27 (tarde)**, con dos hechos del lead: (1) **medido**: las 8 imágenes
> de Gemini recibidas por OpenRouter traen el manifiesto C2PA firmado por Google y el XMP
> IPTC `trainedAlgorithmicMedia`, y se guardan y sirven sin tocar; (2) **decidido por el
> propietario**: MAI-Image-2.6 queda fuera, solo Gemini en Vertex. Cambian los §§ 0, 1.2,
> 1.5, 2, 4, 5 y 7; lo escrito sobre MAI se queda como el porqué de la decisión.
>
> **Revisión 2026-09-30 (proyecto 009, fase 2)**: una imagen que el juez rechazó ya no se
> tira siempre; la última de un dibujo fallido se guarda en privado para que el
> propietario la mire ([`0072`](../decisions/0072-a-rejected-picture-waits-for-the-owner.md),
> que enmienda `0066`). Cambian el § 4.1 (una fila y una viñeta), el § 5 (IMG-10 e
> IMG-11), el § 7 (d) y las fuentes, y son nuevos los §§ 1.6 y 4.3. Esta revisión **sí está leída contra el código**:
> el árbol de trabajo de `main` sobre `abc0a90`, sin commit; lo que dice es verdad una vez
> fusionado tal cual. Solo la fase 2: aceptar una imagen contra el juez y retirarla
> son la revisión siguiente.
>
> **Revisión 2026-09-30 (proyecto 009, fase 3)**: el propietario puede **publicar a mano**
> una imagen que el juez rechazó, y **retirar** una que aceptó así (`0072`, las dos
> puertas). Cambian el § 0 (punto 8), el § 1.6 (el hecho y el cierre), el § 4.1 (la fila
> «Guardar»), el § 4.2 b (**la frase de `/privacidad` sobre el juez cambia**), el § 4.3
> (la cita, dos filas y dos viñetas), el § 5 (IMG-2 e IMG-10, y nuevos IMG-12 a IMG-16),
> el § 7 (e, f) y las fuentes; son nuevos los §§ 1.7 y 4.4. **Leída contra el código**:
> el árbol de trabajo de `main` sobre `fce954d`, sin commit (núcleo y API), y el árbol de
> `frontend` en `.claude/worktrees/frontend-009-3`, también sin commit (la web y los
> diccionarios). Los números de línea de esta revisión son de esos dos árboles; lo que
> dice es verdad una vez fusionados tal cual.
>
> **Revisión 2026-09-30 (proyecto 010, fase 3)**: la fila de cada plato guarda lo que
> respondió el juez en cada intento, con la receta tal como se juzgó. Cambian el § 4.1 (la
> fila del juez), el § 4.3 (dos filas), el § 4.4 (una frase) y las fuentes; es nuevo el
> § 4.5. **Leída contra el código**: el árbol `.claude/worktrees/backend-010-3` sobre
> `f81e834`, sin commit; los números de línea de esta revisión son de ese árbol.
>
> **Revisión 2026-09-30 (proyecto 010, fase 4)**: «Retirar» vale para **cualquier imagen
> publicada**, la aceptara el juez o el propietario a mano (PRD 010, criterio 9; `0073`;
> respuesta del propietario a la pregunta 4 del informe `0006`). Se cierra IMG-16. Cambian
> el § 4.2 b (solo el comentario de fuentes, no el texto publicado), el § 4.4 (la entrada,
> una fila de los ficheros que pueden quedar, el rastro y los textos de la consola), el § 5
> (IMG-2, IMG-14 e IMG-16) y las fuentes. **Leída contra el código**: el árbol
> `.claude/worktrees/phase4-010` sobre `8e9ca114`, sin commit, que lleva la fase 4 y **no**
> la fase 2 del 010 (la regla del juez): nada de lo que aquí se dice depende de esa regla.
> Los números de línea marcados «fase 4» son de ese árbol.
>
> **Los §§ 0 a 4.2 se escribieron antes de que la función existiera.** Lo que dicen del
> producto sale del PRD, del informe y del piloto, y la comprobación contra el código
> construido sigue pendiente en la lista del § 6, salvo lo que esa lista marca con su
> fuente.

## 0. Resumen

1. **Fechas: no hay periodo de gracia.** El art. 50 de la Ley de IA se aplica desde el
   **2/8/2026**. Los cuatro meses del Ómnibus (hasta el 2/12/2026) solo valen para sistemas
   introducidos **antes** de esa fecha. Las imágenes se ponen en servicio cuando se
   encienda el flag, así que les toca todo el art. 50 desde el primer día (§ 1.1).
2. **NutrIA es proveedor y responsable del despliegue** del sistema que dibuja los
   platos. Google es el proveedor del modelo. El marcado legible por
   máquina (art. 50.2) es obligación de NutrIA, aunque puede apoyarse en el que ya ponen
   los modelos (§ 1.2).
3. **Una foto realista de un plato es, con toda probabilidad, una «ultrasuplantación»**
   según las directrices de la Comisión de julio de 2026 **[abogado]**. Por eso cada
   imagen debe llevar un aviso visible en **cada** sitio donde alguien la vea, también en
   la tarjeta del panel (§ 1.3). Los textos están en el § 3.
4. **Gemini trae las dos capas de marca**: el manifiesto C2PA firmado por Google y la
   marca de agua SynthID. **Medido el 2026-09-27**: llegan a través de OpenRouter (8 de 8).
   MAI-Image-2.6 no traía ninguna documentada y **el propietario lo ha quitado**: solo
   Gemini (§ 2).
5. **Recodificar a WebP con `sharp` borraría el C2PA.** Por eso los ficheros se guardan y
   se sirven tal como llegan (§ 2.3). Falta solo validar la firma una vez con una
   herramienta C2PA (P3).
6. **Privacidad**: el modelo que dibuja no recibe ningún dato personal. Google no es,
   por tanto, destinatario en el sentido del art. 13 RGPD. Aun así hay que
   nombrarlo, porque la política promete que ningún proveedor entrena con lo que le
   enviamos. Además hay que acotar una frase en vigor que hoy dice «nunca los servicios de
   Google», y ampliar la línea de Vercel, que ahora también sirve las imágenes (§ 4).
7. **Consumo**: la imagen no es el plato que la persona va a cocinar. El rótulo lo dice
   («orientativa»), y las condiciones de uso ganan una frase (§ 3.3).
8. **Dos puertas** (009 fase 3): una imagen llega a una persona porque el juez la aceptó
   o porque el propietario la aceptó a mano, contra el juez, tras ver los alérgenos
   señalados. Para la Ley de IA no cambia nada: el mismo fichero con su C2PA, la misma
   marca «IA» y el mismo pie (§ 1.7). Cambia el riesgo IMG-2, que deja de depender de un
   modelo y pasa a depender de una decisión registrada (§ 5), y **cambia una frase
   publicada de `/privacidad`** (§ 4.2 b), que es decisión del propietario.

---

## 1. Ley de IA (Reglamento (UE) 2024/1689, modificado por el 2026/1744)

### 1.1 Desde cuándo

- **Art. 113**: el Reglamento «será aplicable a partir del 2 de agosto de 2026», con
  excepciones que no afectan al art. 50.
- **Art. 111.3**, añadido por el Reglamento (UE) 2026/1744 (DO L de 24/7/2026, en vigor
  el 27/7/2026): «Providers of generative AI systems subject to Article 50(2) that have
  already placed their systems on the market before 2 August 2026 shall have four months
  from that date to adapt their practices». El considerando 38 lo llama «periodo
  transitorio de cuatro meses». Solo cubre el **art. 50.2**, y solo a sistemas ya
  introducidos antes del 2/8/2026.
- **Directrices de la Comisión sobre el art. 50** (C(2026) 5054 final, 20/7/2026),
  apdo. 153: «a targeted grandfathering rule only with regard to the marking and
  detection obligations under Article 50(2) AI Act for generative AI systems placed on the
  market or put into service before 2 August 2026». Y el apdo. 154: lo generado antes del
  2/8/2026 no se marca con carácter retroactivo.

**Aplicado aquí.** El ilustrador de `0010` nunca estuvo encendido en producción: solo
funcionaba con `AI_PROVIDER=google` y `AI_ILLUSTRATIONS=true` (ver
[`analisis.md` § 1.3](./analisis.md#1-qué-hace-el-producto-lo-que-he-leído-no-lo-que-dicen-los-documentos)).
El sistema del 006, con otros modelos, otro cliente y otro almacén, se pone en servicio
cuando el propietario encienda el flag, después del 2/8/2026. **Los arts. 50.2, 50.4 y
50.5 se aplican el mismo día en que se encienda.** Esto responde a la pregunta del
informe `0003` § 9 («si la v2 cuenta como sistema nuevo»: sí; y, aunque no lo contara, la
v1 tampoco se introdujo antes del 2/8/2026).

### 1.2 Quién es quién

| Actor | Rol | Por qué |
| --- | --- | --- |
| NutrIA (su propietario) | **Proveedor** del sistema de IA que genera las imágenes | Art. 3.3: «desarrolle un sistema de IA […] y lo introduzca en el mercado o ponga en servicio el sistema de IA con su propio nombre o marca». NutrIA construye el sistema (prompt, cliente, juez, reintentos, almacén) y lo pone en servicio bajo su marca. Directrices, apdo. 11: el ejemplo de la empresa que ofrece «a generative […] AI application (e.g. […] image generator […]) on the Union market under its own name» |
| NutrIA | **Responsable del despliegue** | Art. 3.4: «utilice un sistema de IA bajo su propia autoridad». Decide publicar las imágenes y cómo mostrarlas. Directrices, apdo. 12 |
| Google (Gemini 3.1 Flash Lite Image, en Vertex). Microsoft (MAI-Image-2.6) salió el 2026-09-27 | Proveedor del **modelo** de uso general (capítulo V) | El art. 50 no se les aplica por los modelos (Directrices, apdo. 27), pero su marca «a nivel de modelo» facilita el cumplimiento del proveedor posterior (cdo. 133; Directrices, apdo. 74) |
| OpenRouter | Intermediario técnico que enruta la petición | No desarrolla el sistema ni lo pone en servicio con su marca. Sin obligaciones del art. 50 frente a esta salida |
| La persona que ve el plato | Persona expuesta | Destinataria del aviso (art. 50.5; Directrices, apdo. 141) |

Directrices, apdo. 74: el proveedor puede apoyarse en la marca que pone el proveedor del
modelo «without prejudice to the responsibility of the provider of the AI system to
demonstrate compliance with Article 50(2) AI Act». **La responsabilidad sigue siendo de
NutrIA.**

### 1.3 ¿Es una «ultrasuplantación»? Sí, con toda probabilidad **[abogado]**

Art. 3.60: «un contenido de imagen […] generado o manipulado por una IA que se asemeja a
personas, objetos, lugares, entidades o sucesos reales y que puede inducir a una persona a
pensar erróneamente que son auténticos o verídicos». Las Directrices (apdos. 113-116) lo
parten en cuatro criterios acumulativos:

| Criterio | Las Directrices | Una foto realista de «lentejas con verduras» |
| --- | --- | --- |
| Parecido | «a high level of similarity» | Se busca a propósito: fotorrealista, «not a 3D render, not glossy or plastic» (prompt del piloto) |
| Existente | basta con algo que «exists, can plausibly exist or could have plausibly existed» | Un plato de lentejas existe y podría haber existido tal cual |
| Objeto | «realistic, inanimate material items, including […] consumer goods» | Comida en un plato |
| Aparenta ser auténtico | se valora con el contexto y el público previsible; «a high degree of photorealism renders it more likely»; hay que tener en cuenta a mayores y a personas con poca alfabetización digital (apdo. 115) | En una app de planificación, una foto realista del plato que toca hoy puede tomarse por una foto real del plato. El público incluye a personas mayores |

Entre los **ejemplos de ultrasuplantación**, las Directrices incluyen: «An AI-generated
image of a product in advertisement or packaging that can affect the audience's perception
and mislead as to the actual product appearance». Entre los que **no** lo son están las
escenas imposibles (una esfinge sobre la torre Eiffel) y los fondos de un producto real.
Una foto de comida inventada pero verosímil está mucho más cerca de lo primero.

**Conclusión**: diseño como si se aplicara el art. 50.4. Si un abogado lo descartara,
bastaría con el art. 50.2 (marca legible por máquina). Aun así mantendría el rótulo: lo
piden el derecho de consumo (§ 3.3) y el principio de producto «Never fake it»
(`docs/PRODUCT.md`), que `0010` aplicaba a las ilustraciones.

### 1.4 Qué exige, en concreto

- **Art. 50.2 (proveedor)**: que las imágenes estén «marcadas en un formato legible por
  máquina» y que «sea posible detectar» que son artificiales, con soluciones «eficaces,
  interoperables, sólidas y fiables en la medida en que sea técnicamente viable». Las dos
  cosas: marca **y** medio de detección (Directrices, apdo. 70). La excepción de «apoyo a
  la edición estándar» no se aplica: la imagen se genera de cero. → § 2.
- **Art. 50.4 (responsable del despliegue)**: «harán público que estos contenidos o
  imágenes han sido generados o manipulados de manera artificial». No es una obra artística
  ni creativa, así que no cabe el aviso atenuado.
- **Art. 50.5**: «de manera clara y distinguible a más tardar con ocasión de la primera
  interacción o exposición», y ajustado a «los requisitos de accesibilidad aplicables».
  - Directrices, apdo. 143: la obligación «applies to each output of an AI system with
    respect to any natural person exposed to the content». **Cada sitio donde se ve la
    imagen necesita su aviso.** La tarjeta del panel suele ser la primera exposición, así
    que **sí necesita marca propia**. Esto responde a la pregunta de `0003` § 9.
  - Directrices, apdo. 142: no es claro lo que «can be easily overlooked […] (e.g. only
    included […] in terms of use)». La política y las condiciones informan, pero **no
    sustituyen** al rótulo.
  - Directrices, apdo. 144: el art. 50 no añade requisitos de accesibilidad propios, pero
    el aviso debe cumplir los que ya se apliquen. NutrIA, como microempresa, está exenta de
    los de la Ley 11/2023 (art. 3.3; ver [`analisis.md` § 8](./analisis.md#8-accesibilidad)).
    Aun así fijo el nombre accesible como requisito del producto: sin él, quien usa un
    lector de pantalla no recibe el aviso.
- **Sanción** (art. 99.4): hasta 15 M€ o el 3 %; para una pyme, «whichever is lower»
  (Directrices, apdo. 152).

### 1.5 El Código de buenas prácticas, y por qué este documento es su análisis de brecha

El *Code of Practice on Transparency of AI-Generated Content* es la versión final del
10/6/2026, que la Comisión y el Consejo de IA valoraron como adecuada. **NutrIA no lo ha
firmado.** Quien no lo firma debe demostrar el cumplimiento «through other adequate means»,
por ejemplo con «a gap analysis that compares the measures they have implemented with the
measures set out by a code of practice» (Directrices, apdo. 148). Este cuadro es ese
análisis:

| Medida del Código | Qué pide | Qué hace NutrIA (con lo recomendado aquí) |
| --- | --- | --- |
| S1, 1.1 | Al menos dos capas: metadatos **firmados** (1.1.1) y marca de agua imperceptible (1.1.2) | Gemini: C2PA firmado por Google + SynthID, en el fichero original que se sirve sin tocar (medido, § 2.3). MAI: fuera |
| S1, 1.2 | No quitar marcas existentes | El original se sirve sin recodificar ✔. Si algún día se deriva otro tamaño, añadir los metadatos IPTC (§ 2.4) |
| S1, 2.1 | Detección disponible y gratuita | La de Google (SynthID y Content Credentials; cualquier visor C2PA). NutrIA no necesita una propia mientras solo use las marcas de Google |
| S1, 3.4 | Metadatos con un estándar abierto | C2PA (el de Google) e IPTC `DigitalSourceType` |
| S2, 1.1 | Icono o rótulo cuyo elemento principal sea el acrónimo «AI», o el de la lengua nacional si la ley lo exige | «IA» en español y «AI» en inglés. **Divergencia consciente**: el Código pide «AI» en inglés salvo incompatibilidad con la ley nacional de lenguas. Elijo «IA» para el público español porque el apdo. 142 exige que se entienda y en España el acrónimo común es «IA» **[abogado]** |
| S2, 1.1 (accesibilidad) | Contraste alto, compatible con lectores de pantalla, detectable por tecnologías de apoyo | Nombre accesible propio (§ 3.2); contraste sobre cualquier foto |
| S2, 1.2.1 | Visible sin interacción; encima o sobre el contenido; distinguible sobre cualquier fondo; en la primera exposición | Marca superpuesta en la esquina superior derecha de la tarjeta **y** de la imagen grande; en la grande, además, el pie con «orientativa» |
| S2, 1.2.2 a | «in the top right corner of an image» | Esquina superior derecha |

### 1.6 La imagen rechazada que solo ve el propietario (009, fase 2): ¿es una «exposición»?

**El hecho.** La imagen que el juez rechazó se ve en un solo sitio: la página
`/admin/catalogo/<id>/imagen` de la consola, con sesión de administrador
(`AdminCatalogue.controller.ts:49` y `:116-123`). No es la imagen de ningún plato, no
tiene dirección pública y, mientras espera, nada la publica (§ 4.3). Desde la fase 3
puede dejar de esperar: si el propietario la acepta, pasa a ser la imagen del plato y
sale de esta sección para entrar en el § 1.7.

**La pregunta.** El art. 50.4 obliga al responsable del despliegue a «hacer público» que
la imagen es artificial, y el 50.5 a decírselo «a las personas físicas de que se trate
[…] a más tardar con ocasión de la primera interacción o exposición». ¿Es el propietario,
mirando su propia consola, una de esas personas?

| Lectura | Qué dice | En qué se apoya |
| --- | --- | --- |
| Literal | Sí: es una persona física que ve el contenido | Directrices, apdo. 141: son personas de que se trate los «active or passive users and other persons exposed to the AI-generated or manipulated synthetic content»; apdo. 143: «any natural person exposed to the content». Ninguno de los dos excluye a quien despliega |
| Por la finalidad (**la que sigo**) | No: el deber es de quien despliega **hacia su público**, y aquí el único que mira es quien despliega | Art. 3.60: la ultrasuplantación es lo que «puede inducir a una persona a pensar erróneamente» que es auténtico; quien encargó la imagen y la revisa sabiendo que el juez la rechazó no puede ser inducido a ese error. Cdo. 134: el deber es «hacer público […] etiquetando los resultados de salida». Directrices, apdo. 115: el engaño se mide sobre «the reasonably foreseeable audience», según «the intended distribution channels», y aquí no hay canal ni audiencia. Apdo. 87 (escrito para el 50.2 y para salidas «strictly technical», que una foto de comida no es: vale como indicio de la lógica, no como regla): trata aparte los «production steps and workflows before the output is finalised and made available to other external persons or the public», vistos solo por personas de la propia organización y con controles de acceso |

**Las Directrices no resuelven el caso con estas palabras**: ningún apartado habla de la
revisión interna de una ultrasuplantación antes de publicarla. Por eso es una
interpretación, y va a la lista del § 7 **[abogado]**.

**Por qué no necesita la hora con el abogado.** El resultado es el mismo con las dos
lecturas, porque el producto cumple la más estricta:

- **Aviso visible (50.4 y 50.5)**: la página dice, debajo de la imagen, «Imagen generada
  por IA. El revisor la rechazó y no está publicada: solo se ve en esta página.»
  (`adminPictureReview.pictureCaption`, `es-ES.ts:532`; `page.tsx:89`); el `alt` dice
  «Imagen de {dish} generada por IA, pendiente de revisión»
  (`es-ES.ts:531`; `page.tsx:84`); y la imagen se pinta con el mismo componente que las
  publicadas, que le pone la marca «IA» en la esquina superior derecha
  (`DishPicture.tsx:75-80`).
- **Marca legible por máquina (50.2)**: solo se guarda un fichero que lleva su manifiesto
  C2PA, comprobado dos veces sobre los bytes (`DishPicture.service.ts:276` y `:369`), y
  se guarda y se sirve sin tocar un byte (`:378`; `AdminCatalogue.controller.ts:120-122`).

**Cuándo habría que volver aquí**: si esa imagen saliera de la consola —en un correo, en
una exportación, en una pantalla que vea alguien que no actúa bajo la autoridad del
propietario—. Entonces hay audiencia y el aviso va con la imagen, como en el § 3. Que un
fichero sin C2PA no se guarde nunca es, por lo mismo, una regla de cumplimiento y no una
preferencia técnica (informe `0005` § 10.5): es lo que sostiene la última frase del
§ 4.2 b de la política.

**La fase 3 es ese caso, y ya está resuelto**: la imagen aceptada a mano sale de la
consola por el único camino que existe, el de cualquier imagen publicada, con su aviso
(§ 1.7).

### 1.7 La imagen aceptada a mano (009, fase 3): ¿cambia algo que la publique una persona?

**El hecho.** `POST /admin/catalogue/recipes/:id/picture/candidate/accept`, solo para
administrador (`AdminCatalogue.controller.ts:52` y `:157-158`). Lee el fichero del
almacén privado, vuelve a mirar sus marcas sobre esos bytes (`RecipeController.ts:398`:
sin JPEG y sin manifiesto C2PA, 409), pone **esos mismos bytes** en el almacén público
(`:405`; `PictureCandidates.service.ts:181-182`) y, en una transacción, deja la fila
`ready` con `acceptedBy: 'owner'` y escribe `picture.accepted` (`:429`;
`RecipeRepository.ts:107`). A partir de ahí la aplicación de una persona lee lo mismo que
de cualquier imagen: `ready` y una dirección. La pinta el mismo componente
(`DishPicture.tsx`), con la marca «IA» y, en la página de la comida, el pie
`meal.pictureCaption` (`es-ES.ts:1668`).

| Pregunta | Respuesta | En qué se apoya |
| --- | --- | --- |
| **Art. 50.2** (marca legible por máquina): ¿sigue marcado el fichero? | **Sí, igual que por la puerta del juez.** Es el mismo JPEG de Gemini, sin recodificar, y la presencia del manifiesto se comprueba otra vez sobre los bytes que se publican | `RecipeController.ts:393-402`; `RecipeAcceptance.test.ts:425-462` (paso 3) y `:186` (los mismos bytes); `picture-doors.spec.ts` (solo dos servicios escriben en el almacén público). Directrices, apdo. 74 (apoyarse en la marca del proveedor del modelo) |
| ¿Se verifica la **firma** del manifiesto? | **No, en ninguna de las dos puertas.** `pictureMarks` busca el segmento del manifiesto, no valida su firma. No es nuevo ni lo agrava la fase 3: es el pendiente P3 del § 2.3.1 (validar una vez con `c2patool` un fichero tal como lo sirve Blob). Conviene hacerlo **una vez también con un fichero aceptado a mano**, que ha pasado por dos almacenes | `apps/api/AGENTS.md:289-296`; § 2.3.1 |
| **Art. 50.4 y 50.5** (aviso visible): ¿lleva el aviso? | **Sí, el mismo.** Ningún código distingue, al pintar, una imagen aceptada a mano de otra: marca «IA» en la tarjeta y en la imagen grande, pie y `alt` en la página de la comida | `DishPicture.tsx:75-80`; § 3.1 y § 3.2 |
| ¿Trae la **revisión humana** la excepción del art. 50.4, párrafo segundo («revisión humana o control editorial»)? | **No, ni a favor ni en contra.** Esa excepción está en el párrafo segundo, que trata del **texto** «que se publique con el fin de informar al público sobre asuntos de interés público». Las imágenes que son ultrasuplantación están en el párrafo primero, cuyas únicas salvedades son la persecución de delitos y el aviso atenuado de las obras creativas. Que una persona revise la imagen **no quita** el deber de avisar, y tampoco añade ninguno | Art. 50.4, texto del DOUE (párrafos primero y segundo); Directrices, apdos. 130 y 133 («Article 50(4), second subparagraph […] the AI generated or manipulated **text** must have undergone human review or editorial control»). Aunque se aplicara, el apdo. 134 exige un examen de fondo con «fact-checking», y el 135 descarta la «cursory editorial approval» |
| ¿Deja de ser «generada por IA» por haberla elegido una persona? | **No.** El propietario elige entre publicar y no publicar; no toca un píxel. El contenido sigue siendo salida íntegra del sistema | Art. 3.60; art. 50.2 (la salvedad es para sistemas que «no alteren sustancialmente los datos de entrada», no para la selección humana de salidas) |
| ¿Cambian los **roles** del § 1.2? | **No.** NutrIA sigue siendo proveedor y responsable del despliegue. La aceptación es un acto del responsable del despliegue: él decide publicar | Art. 3.4 |
| ¿Algo nuevo para el propietario como operador? | El **art. 4** (alfabetización en IA): quien maneja el sistema debe entender qué hace y qué no. Aquí el operador es una sola persona, y lo que necesita saber para este acto está en el aviso de dos pasos (§ 4.4) y en este documento: el juez solo mira lo que sobra, se equivoca en los dos sentidos, y la garantía de alergias no es él | Art. 4, texto del DOUE |

**Conclusión.** Los §§ 1.4, 1.5 y 2 no cambian: el cuadro del análisis de brecha (§ 1.5)
vale igual para una imagen aceptada a mano. Lo que sostiene esa conclusión es una regla
de código y no una costumbre: **no hay tercera puerta** y **sin manifiesto no se acepta**
(`0072`; `apps/api/AGENTS.md:289-303`). Si un día se pudiera aceptar un fichero subido
por el propietario, o uno recodificado, habría que rehacer el § 2 para él.

---

## 2. Marca legible por máquina (art. 50.2)

### 2.1 Qué trae cada modelo

| Modelo | Metadatos firmados (C2PA) | Marca de agua | Fuente |
| --- | --- | --- | --- |
| `google/gemini-3.1-flash-lite-image` en Vertex | **Sí**. Google lo firma: «All images or videos created or modified using the listed models are automatically digitally signed by Google LLC», y `gemini-3.1-flash-lite-image` está en la lista | **SynthID**: «All generated images include a SynthID watermark». Es una marca del modelo, así que se espera también en Vertex **(por confirmar)** | Vertex AI, *Content Credentials* (act. 2026-09-25); Gemini API, *Image generation* (act. 2026-09-23) |
| `microsoft/mai-image-2.6` en Azure | **No documentado** | **No documentada** | Microsoft Learn, *Content provenance* (act. 2026-09-17/23). La tabla solo nombra MAI-Image-2.5, 2.5-Flash, 2e y 2.5-Pro. **2.6 no aparece** |

**Lo que el piloto dice de los ficheros**: Gemini devolvió JPEG (20 de 20, 1200 × 896,
mediana de 182 KB y máximo de 227 KB). MAI devolvió PNG (18, 1024 × 768, mediana de
1,3 MB). El piloto solo guardó WebP recodificados, así que no se podía saber si el C2PA
de Google llegaba a través de OpenRouter.

**Medido el 2026-09-27** (lead y backend, 8 JPEG de Gemini en bruto, recibidos por
OpenRouter antes de cualquier proceso): los 8 llevan un manifiesto C2PA firmado por Google
(`claim_generator` «Google C2PA Core Generator Library»; acciones `c2pa.created`, «Created
by Google Generative AI», y «Applied imperceptible SynthID watermark»; `c2pa.hash.data`) y
un XMP IPTC `DigitalSourceType = trainedAlgorithmicMedia`. **La firma no se ha validado
criptográficamente** (no se usó `c2patool`). El propio manifiesto declara la marca SynthID,
así que el «por confirmar» de la tabla queda respondido por Google, no por una detección
nuestra.

### 2.2 Qué rompe la recodificación

- `sharp` descarta los metadatos por defecto. Aunque se conservara el bloque C2PA,
  recomprimir cambia los bytes y el manifiesto deja de validar: su «hard binding» es un
  hash del contenido. Google lo dice así: «Any modification to a C2PA-compliant media file
  using a non-C2PA tool is considered tampering». Y Microsoft: la procedencia puede
  perderse con «Format conversion, transcoding, or compression».
- SynthID va en los píxeles y está hecha para aguantar compresión y reescalado (Código,
  medida 3.3). Sobrevive, pero es solo una capa.
- El campo IPTC `DigitalSourceType = trainedAlgorithmicMedia` escrito con `withXmp`, que
  propone `0003` § 7.2, es estándar y barato, pero **no está firmado**. No cumple la
  subme­dida 1.1.1 («digitally signed and time-stamped»): es una pista más, no la capa de
  metadatos.

### 2.3 Lo que recomiendo

1. ~~**Medir antes de construir**~~ — **hecho el 2026-09-27**: el C2PA llega (§ 2.1).
   Queda validar la firma una vez con una herramienta C2PA (`c2patool` o el verificador
   de Content Credentials, gratis) sobre un fichero **tal como lo sirve Blob**: comprueba a
   la vez que Google firmó y que ni OpenRouter, ni el backend, ni Blob tocaron un byte (P3).
2. **El C2PA llega, así que** (lo que se ha construido): guardar en Blob y **servir el JPEG de Gemini tal como llega**,
   sin recodificar ni añadir metadatos (tocar un byte invalida el manifiesto). Usar el
   mismo fichero en la imagen grande (4:3) y en la tarjeta (16:9, recortada con CSS). Las
   dos capas de Google llegan intactas a quien vea la imagen, y cualquier visor C2PA o la
   verificación de Google la detectan. Cuesta ~70 KB más por imagen que el WebP del piloto
   (mediana de 108 KB). Es la vía más barata que cumple el Código.
3. *(Ya no aplica; se queda por si un día el C2PA dejara de llegar.)* **Si el C2PA no llega**: queda SynthID, más el campo IPTC de metadatos (§ 2.4) en el
   fichero que se sirva. Es una capa sólida y otra que no está firmada: por debajo del
   Código, pero defendible como «technically feasible» y proporcionado al coste
   (art. 50.2; Directrices, apdos. 81 y 85) **[abogado]**. La alternativa completa es que
   NutrIA firme su propio manifiesto C2PA tras recodificar (biblioteca abierta
   `c2pa-node`/`c2pa-rs`, con el manifiesto de Google como ingrediente si existe). Necesita
   un certificado de firma. Lo dejo como P2 con fecha: al revisar el Código o si un
   abogado lo pide.
4. **Si hace falta un tamaño menor** para la tarjeta, derivarlo con `sharp` y escribir en
   él el campo IPTC (§ 2.4). La imagen grande sigue siendo el original.
5. **Decidido el 2026-09-27: el propietario quitó MAI-Image-2.6.** El razonamiento que llevó a recomendarlo: fuera de producción hasta que (a) Microsoft lo incluya en su tabla
   de procedencia, o (b) la medición del paso 1 muestre C2PA y marca de agua en sus
   respuestas. Mientras tanto, una imagen de MAI no llevaría ninguna marca firmada ni
   marca de agua, y NutrIA tendría que poner las dos, incluida una marca de agua propia:
   un trabajo desproporcionado para un modelo de respaldo. El PRD ya admite que un plato se
   quede sin imagen, y en el piloto Gemini no falló ninguna de 20. **Es una decisión de
   producto del propietario**: si quiere MAI, el coste es la marca de agua propia.
   Si algún día vuelve MAI u otro modelo, se repite este § 2 para él antes de activarlo, y
   la política lo nombra antes (§ 4.2 b).

### 2.4 El campo IPTC, para cualquier fichero que NutrIA escriba o recodifique

XMP con `Iptc4xmpExt:DigitalSourceType` =
`http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia`. Opcionalmente, y
recomendado por el Código (medida 1.3), el nombre del sistema («NutrIA») y la fecha de
generación. **Nunca** un identificador de usuario ni de cuenta (Código, 1.1.1: «without
including privacy-sensitive […] information»).

### 2.5 La detección

Con la vía del § 2.3.2, la detección es la de Google (Content Credentials en cualquier
visor C2PA; SynthID en la verificación de Google), que es gratuita y pública. Eso cumple la
segunda parte del art. 50.2 (Directrices, apdos. 74-76). La política dirá, en una frase,
que las imágenes llevan esas marcas (§ 4.2). Así se cumple también el art. 50.5 para esta
información: quien quiera comprobarlo sabe que puede.

---

## 3. Los textos que ve la persona

Se muestran en español y en inglés, como el resto del producto. Ninguno se acepta, así que
**no hay que subir ninguna constante de versión**. Las claves son una propuesta: `frontend`
puede renombrarlas, pero el texto es este.

### 3.1 La imagen grande (página de la comida, 4:3)

| Clave | Dónde | es-ES | en-GB |
| --- | --- | --- | --- |
| `meal.pictureCaption` (sustituye a `meal.illustration`, `es-ES.ts:741`) | `<figcaption>` visible, justo debajo de la imagen (`plan/comida/[id]/page.tsx:136`) | `Imagen generada por IA. Es orientativa: manda la lista de ingredientes.` | `AI-generated image. For illustration only: the ingredient list is what counts.` |
| `meal.pictureOf` (sustituye a `meal.illustrationOf`, `es-ES.ts:742`) | `alt` de la imagen (`page.tsx:131`) | `Imagen de {name} generada por IA` | `AI-generated image of {name}` |

<!-- Fuente: art. 50.4 y 50.5 Ley de IA (aviso claro, distinguible, en la primera exposición, accesible); Directrices C(2026) 5054, apdos. 142-144. «Imagen», no «Ilustración»: una ilustración sugiere un dibujo y estas son fotorrealistas (0003 § 1); no «foto», que sugiere una cámara. «Es orientativa: manda la lista de ingredientes»: Ley 3/1991 de Competencia Desleal (consolidada a 27/12/2025), arts. 5.1.b (engaño sobre «las características principales del bien o servicio, tales como […] su composición») y 7.1 (información «poco clara […] ambigua»), y TRLGDCU art. 60.1 (información «veraz y suficiente sobre las características principales»). Riesgo bajo: el art. 5.1 exige que la información pueda «alterar su comportamiento económico», y NutrIA no vende la comida; el rótulo cuesta una frase; el mismo giro que ya usa el producto en `nutrition.note` («la etiqueta manda»). El alt repite «generada por IA» a propósito: quien navega por imágenes con un lector de pantalla oye el alt y no el pie. -->

**La imagen grande lleva además la misma marca de esquina que la tarjeta** (§ 3.2: `IA`,
con su nombre accesible). El Código pide que el rótulo esté «directly embedded into the
content» o en una capa que «appears to be on the content» (sección 2, medida 1.2.1 c), en
la esquina superior derecha (1.2.2 a). Un pie *debajo* de la imagen no es ninguna de las
dos cosas. `DishPicture` pinta las dos variantes, así que la marca vive en un solo
componente. El pie se queda para el mensaje de consumo («orientativa»).

### 3.2 La marca de esquina (tarjeta del panel, 16:9, e imagen grande, 4:3)

| Clave | Dónde | es-ES | en-GB |
| --- | --- | --- | --- |
| `picture.aiMark` | Texto visible de la marca, superpuesta en la esquina superior derecha de la imagen, en la tarjeta (`NextMeal.tsx:58-62`) y en la imagen grande (`page.tsx:128-136`) | `IA` | `AI` |
| `picture.aiMarkLabel` | Nombre accesible de la marca | `Imagen generada por IA` | `AI-generated image` |

<!-- Fuente: art. 50.4 y 50.5; Directrices, apdo. 143 (cada salida, cada persona expuesta: la tarjeta es a menudo la primera exposición) y apdo. 142; Código de buenas prácticas, sección 2, medidas 1.1 (acrónimo como elemento principal; contraste; detectable por tecnologías de apoyo) y 1.2.1-1.2.2 (visible sin interacción, superpuesta, esquina superior derecha, distinguible sobre cualquier fondo). «IA» y no «AI» en español: ver § 1.5. -->

Requisitos de la marca, que `frontend` y `accessibility` resuelven como quieran:

- Se ve sin tocar nada, encima de la imagen y en la esquina superior derecha, con fondo
  propio (una píldora opaca o translúcida) que contraste sobre **cualquier** foto: WCAG
  1.4.3, 4,5:1, contando el peor fondo posible.
- No tapa nada que importe, y no se puede cerrar ni ocultar.
- **Llega a las tecnologías de apoyo.** La imagen de la tarjeta tiene hoy `alt=""`. El
  texto que se lee debe ser «Imagen generada por IA», no «IA». Por ejemplo, con «IA»
  visible y `aria-hidden` más un texto solo para lectores. La tarjeta es un enlace
  (`Card as={Link}`), así que ese texto pasa a formar parte de su nombre, y está bien que
  así sea.
- Aparece solo cuando se ve una imagen. El plato de reserva (el glifo) o una imagen que no
  carga **no** llevan marca: no hay nada sintético que avisar (PRD, criterio 8).

### 3.3 Condiciones de uso: una frase nueva

**Dónde**: namespace `terms`, sección «Contenido generado con inteligencia artificial»
(`es-ES.ts:1694-1697`; `en-GB.ts:1688`). Se añade como segundo párrafo. Hay que actualizar
`terms.updated`.

| es-ES | en-GB |
| --- | --- |
| `Las imágenes de los platos también las genera una inteligencia artificial, a partir de la receta, y las marcamos como tales. Son orientativas: no son una foto del plato que vas a cocinar y pueden no mostrar todos sus ingredientes ni su cantidad real. Lo que lleva cada plato lo dice su lista de ingredientes, y es la que tiene en cuenta tus alergias.` | `The pictures of the dishes are also generated by artificial intelligence, from the recipe, and we mark them as such. They are for illustration only: they are not a photo of the dish you will cook and may not show all of its ingredients or its real quantities. What each dish contains is what its ingredient list says, and that list is the one that takes your allergies into account.` |

<!-- Fuente: TRLGDCU art. 60.1 (información «veraz y suficiente sobre las características principales»); Ley 3/1991, arts. 5.1.b y 7.1; Ley 7/1998, art. 5.5 (transparencia, claridad, concreción y sencillez de las condiciones generales). La última frase dice lo que el código hace: la puerta de alérgenos va contra la lista de ingredientes en la base de datos (`0004`), no contra la imagen; el juez de visión reduce el riesgo, pero no es la garantía (0003 § 6.2). Solo informa, no cambia derechos ni obligaciones: no es un «cambio importante» de la sección «Cambios en estas condiciones» y no exige correo previo. Si el propietario prefiere avisar igualmente, una línea en el siguiente correo basta. -->

---

## 4. Privacidad

### 4.1 Qué datos entran y quién los ve

| Flujo | Datos personales | Quién |
| --- | --- | --- |
| Pedir la imagen (la página de la comida llama a la API) | La sesión de quien abre la página, como en cualquier otra petición | Vercel (ya encargado) |
| Dibujar la imagen | **Ninguno.** El prompt se hace solo con la receta: nombre, ingredientes ordenados por peso con su proporción en palabras («most of the plate»…), y el estilo fijo (piloto, `buildPrompt`; PRD, criterio 4). Nada del usuario, del perfil, de alergias ni de salud. Tampoco quién la pidió ni cuándo | OpenRouter → Google (Vertex, `google-vertex/global`), con ZDR y sin respaldo |
| Juez de visión | **Ninguno**: la imagen y la lista de la receta. Desde el 010 fase 3, lo que responde (alimentos que ve, su cruce con los ingredientes y el veredicto) **se guarda** en la fila del plato y no se enseña a nadie (§ 4.5) | OpenRouter → DeepInfra (ya nombrada); la respuesta, en `recipe_images` en Neon |
| Guardar la imagen que se publica: la que el juez aceptó o, desde el 009 fase 3, la que el propietario aceptó a mano contra el juez (§ 4.4) | Ninguno: la imagen y sus metadatos técnicos (modelo, versión del prompt, tamaño). En la aceptada a mano, además, `acceptedBy: 'owner'` —la palabra fija, no un id de cuenta— y las claves de alérgeno que el juez había señalado (`RecipeController.ts:417-425`). Quién la aceptó está solo en el registro de acciones (§ 4.4) | Vercel Blob (almacén público); `recipe_images` en Neon |
| Guardar, para que el propietario la mire, la última imagen que el juez rechazó (proyecto 009 fase 2, `0072`; § 4.3) | **Ninguno.** Como mucho un fichero por plato: el JPEG tal como lo devolvió el modelo, con su C2PA, hecho solo con la receta. En la fila del plato (`recipe_images.provenance.candidate`): la ruta del fichero, el modelo, la versión del prompt y lo que señaló el juez, como claves de alérgeno y slugs del catálogo de NutrIA. De un fichero sin C2PA no se guarda el fichero, solo qué era (tipo, tamaño y tres marcas sí/no). No añade ningún dato sobre quién abrió el plato: la hora del fallo sigue a una visita, como ya pasaba antes de esta fase, y no viaja con ningún identificador ([`textos/06`](./textos/06-correos.md) § M) | Vercel Blob, en un **segundo almacén, privado**, en `fra1` (Vercel ya es encargado); la fila, en Neon. Lo ve **solo una sesión de administrador**, a través de la API; no hay dirección pública y la ruta no sale de la API. **Se puede ver 7 días** desde el fallo; el fichero se borra después, normalmente en la limpieza de la noche siguiente, **sin plazo garantizado** (§ 4.3) |
| Ver la imagen | La IP y el navegador de quien la carga, que llegan a la red de Vercel | Vercel (ya encargado) |
| Avisar al propietario de que una imagen falló o de que el proveedor rechaza las peticiones —la clave no puede pagar o ha llegado a su límite de uso— (proyecto 009 fase 1, `0072`; [`textos/06`](./textos/06-correos.md) § M y § N) | **Ninguno**: recuentos por motivo de una lista cerrada y un enlace a la consola; ni el nombre ni el id del plato, ni lo que escribió el proveedor o el revisor | El proveedor SMTP (ya nombrado), hacia el buzón del propietario |

**Consecuencias**:

- Google no recibe datos personales. No es encargado de NutrIA (art. 28
  RGPD) ni «destinatario» en el sentido del art. 13.1.e, y el envío no es una
  transferencia del capítulo V. **No se añade** a «Transferencias», porque daría a
  entender que salen datos personales. **Sí se nombra** en «La inteligencia artificial»,
  porque la política promete «solo usamos proveedores que borran la petición en cuanto
  responden y no la usan para entrenar» y el propietario ha decidido que la regla valga
  para todo lo que NutrIA envía (memoria *no training providers*; `0003` § 5.3).
- El P1-11 (DPA de OpenRouter) no bloquea las imágenes: por esa clave no pasa ningún dato
  personal.
- **Vercel Blob**: la región del almacén se elige al crearlo y no se puede cambiar
  (documentación de Vercel Blob, act. 2026-08-26). Debe crearse en **`fra1`** para que
  «en la Unión Europea» siga siendo verdad para lo que se guarda. Lo que se sirve pasa por
  los nodos regionales de Vercel, como ya pasa con la web.
- **Almacén público**: «blob URLs are accessible to anyone with the link». La ruta no debe
  llevar nada de nadie: ni id de usuario ni de plan, solo el de la receta y un hash
  (`recipes/<id>/<hash>…`, `0003` § 7.2). Lo compruebo al revisar el código (§ 6).
- **Almacén privado** (009 fase 2): es otro almacén, no una carpeta del público. Vercel:
  «Private Blob stores require authentication for all read and write operations» y la
  dirección de un fichero «is not publicly accessible» (*Private Storage*, act.
  2026-09-15). El token solo lo tiene la API, y la API no arranca si es el mismo que el
  del almacén público (`Env.validation.ts:585-591`). Su región también se fija al crearlo:
  en `fra1`, «en la Unión Europea» sigue siendo verdad para lo que se guarda. La ruta
  lleva el id de la receta, la versión del prompt y una parte aleatoria
  (`DishPicture.service.ts:374`), nada de nadie.
- **Registro y EIPD**: no hay actividad nueva con datos personales. El registro añade la
  entrega por Vercel Blob a la fila 2, y la EIPD una nota (hecho en este mismo cambio).
  El 2026-09-30 los dos nombran el segundo almacén; sigue sin haber dato, fin ni
  destinatario nuevo.

### 4.2 Cambios en `/privacidad` (en vivo) y en [`textos/02`](./textos/02-politica-privacidad.md)

Se publican **antes** de encender el flag o el mismo día, y con `privacy.updated` nuevo.
No hace falta correo previo: no cambia qué datos personales se tratan ni con quién.

**a) «La inteligencia artificial», párrafo «A quién va»** (`es-ES.ts:1362`; `en-GB.ts:1349`).
Solo se cambia el final, para acotarlo al diseño de los platos. La frase actual («nunca
los servicios de Google ni de DeepSeek») la leerá mal quien, dos párrafos después,
encuentre a Google dibujando imágenes.

| | es-ES | en-GB |
| --- | --- | --- |
| Hoy | `…; son modelos abiertos que ejecutan esas empresas, nunca los servicios de Google ni de DeepSeek.` | `…; they are open models run by those companies, never by Google's or DeepSeek's own services.` |
| Nuevo | `…; son modelos abiertos que ejecutan esas empresas: lo que se envía para diseñar tus platos nunca pasa por los servicios de Google ni de DeepSeek.` | `…; they are open models run by those companies: what is sent to design your dishes never goes through Google's or DeepSeek's own services.` |

**b) El párrafo de las ilustraciones** (`es-ES.ts:1365`; `en-GB.ts:1352`). Se sustituye:

| es-ES | en-GB |
| --- | --- |
| `Las imágenes de los platos las genera otro modelo, a partir solo de la receta: su nombre, sus ingredientes y en qué proporción. Nunca recibe nada tuyo, ni siquiera quién ha abierto el plato. La petición va a OpenRouter, que la pasa a Google (Vertex AI), y un modelo que ejecuta DeepInfra comprueba que la imagen no muestra alimentos que la receta no lleva. Ninguno guarda la petición ni la usa para entrenar. Las imágenes se guardan en Vercel, se muestran a todas las personas que ven ese plato y llevan la marca «IA»; los ficheros llevan además una marca invisible y legible por máquina que dice que están generados por IA.` | `The pictures of the dishes are generated by another model, from the recipe alone: its name, its ingredients and in what proportion. It never receives anything of yours, not even who opened the dish. The request goes to OpenRouter, which passes it to Google (Vertex AI), and a model run by DeepInfra checks that the picture shows no food the recipe does not contain. None of them keeps the request or trains on it. The pictures are stored on Vercel, shown to everyone who sees that dish, and carry the "AI" mark; the files also carry an invisible, machine-readable mark saying they were generated by AI.` |

Sin variantes desde el 2026-09-27: MAI está fuera y el C2PA llega en todos los ficheros,
que se sirven sin tocar, así que la última frase es verdad. Si vuelve otro modelo, se
nombra aquí antes de activarlo.

**Desde el 009 fase 3, la frase del juez cambia.** Es la única frase publicada que esta
fase toca, y el plan la deja a la decisión del propietario (PLAN 009, fase 3, señal de
parada).

> **Decidido por el propietario el 2026-09-30: el texto A**, publicado en el mismo cambio
> que el botón de aceptar, con `privacy.updated` = 30 de septiembre de 2026 /
> 30 September 2026. `/condiciones` no cambia (la frase opcional del § 4.4 no se toma).
> **Comprobado el 2026-09-30 en el árbol de trabajo de `main`**: el texto A está, letra
> por letra, en `es-ES.ts:2288` y `en-GB.ts:2243`; la frase anterior ya no aparece en
> ningún diccionario; `privacy.updated` dice «Última actualización: 30 de septiembre de
> 2026» / «Last updated: 30 September 2026» (`es-ES.ts:2359`; `en-GB.ts:2314`), y
> `terms.updated` sigue en el 29.

*Por qué no puede quedarse.*

1. **Qué clase de frase es.** No es información de los arts. 13-14 RGPD: en este flujo
   no hay datos personales (§ 4.1), y tanto esos artículos como el 5.1.a («tratados de
   manera lícita, leal y transparente **en relación con el interesado**») solo alcanzan
   al tratamiento de datos personales (art. 2.1). Tampoco es el aviso del art. 50 de la
   Ley de IA: ese artículo obliga a decir **que** la imagen es artificial (50.4) y a
   marcarla (50.2), no a describir qué controles pasa; la frase que sí sirve al 50.5 es la
   última del párrafo, la de las marcas. La frase del juez es una **manifestación
   voluntaria sobre cómo funciona el servicio**, hecha a consumidores.
2. **Qué norma la mide.** El derecho de consumo. TRLGDCU art. 19.2: son prácticas
   comerciales «todo acto, omisión, conducta, manifestación o comunicación comercial» del
   empresario, y se rigen por esa ley y por la de Competencia Desleal. Ley 3/1991,
   art. 5.1: es engañosa la conducta «que contenga información falsa o información que,
   **aun siendo veraz**, por su contenido o presentación induzca o pueda inducir a error
   a los destinatarios, siendo susceptible de alterar su comportamiento económico», cuando
   incide, entre otras cosas, sobre «**los resultados y características esenciales de las
   pruebas o controles efectuados al bien o servicio**» (letra b) o sobre «los riesgos
   que éste pueda correr» (letra h). TRLGDCU art. 8.1.d: derecho a «la información
   correcta sobre los diferentes bienes o servicios»; art. 61.2: el contenido de lo que se
   anuncia del servicio es exigible «aún cuando no figuren expresamente en el contrato
   celebrado».
   **El listón, por tanto, no es que la frase sea literalmente cierta: es que un lector
   medio no saque de ella una idea equivocada**, y aquí el lector incluye a personas
   alérgicas.
3. **Qué entiende quien la lee.** «Un modelo […] comprueba que la imagen no muestra
   alimentos que la receta no lleva» se lee como: las imágenes que veo han pasado esa
   comprobación. Tras la fase 3 sigue siendo cierto que el modelo mira cada imagen, pero
   una publicada puede ser justo la que el modelo rechazó. Veraz palabra por palabra, y
   engañosa en lo que da a entender: el supuesto del art. 5.1.
4. **Y ya decía más de lo que el código hace.** La escribí el 2026-09-27 desde el PRD,
   antes de que existiera el juez. El juez construido **no** rechaza cualquier alimento
   que sobre: solo el que se ve con claridad —nombrado, en más que una traza— y lleva un
   alérgeno que ningún ingrediente del plato lleva (`judge.ts:16-18`, `:497` y `:512`).
   Una imagen con perejil o tomate que la receta no lleva se publica. Eso es verdad hoy
   en producción, con o sin fase 3.

*El riesgo de dejarla*, medido: bajo. El art. 5.1 exige que el error pueda «alterar su
comportamiento económico», y nadie contrata ni deja de contratar NutrIA por esta frase;
el pie de cada imagen grande y las condiciones ya dicen que manda la lista. Pero es una
afirmación sobre alérgenos que el código no sostiene, y la regla de este directorio es
que una política que promete lo que el código no hace es peor que ninguna. **P1** si la
fase 3 se activa sin cambiarla (la misma escala que IMG-5).

**Texto nuevo** — sustituye, dentro del párrafo de arriba, desde «La petición va a
OpenRouter» hasta «para entrenar.»; el resto del párrafo no cambia:

| | es-ES | en-GB |
| --- | --- | --- |
| Hasta el 2026-09-30 (estaba en `es-ES.ts:2285`; `en-GB.ts:2240`) | `La petición va a OpenRouter, que la pasa a Google (Vertex AI), y un modelo que ejecuta DeepInfra comprueba que la imagen no muestra alimentos que la receta no lleva. Ninguno guarda la petición ni la usa para entrenar.` | `The request goes to OpenRouter, which passes it to Google (Vertex AI), and a model run by DeepInfra checks that the picture shows no food the recipe does not contain. None of them keeps the request or trains on it.` |
| **Nuevo (A: el elegido, 2026-09-30; en `main`: `es-ES.ts:2288`, `en-GB.ts:2243`)** | `La petición va a OpenRouter, que la pasa a Google (Vertex AI), y un modelo que ejecuta DeepInfra revisa cada imagen antes de que se publique. Ninguno guarda la petición ni la usa para entrenar. Si ese modelo ve con claridad en la imagen un alimento con un alérgeno que la receta no lleva, la imagen se rechaza, y solo se publica si después la revisamos a mano y decidimos publicarla. Esa revisión no es una garantía: la imagen puede mostrar algo que el plato no lleva, y lo que lleva lo dice su lista de ingredientes.` | `The request goes to OpenRouter, which passes it to Google (Vertex AI), and a model run by DeepInfra reviews every picture before it is published. None of them keeps the request or trains on it. If that model clearly sees in the picture a food carrying an allergen the recipe does not have, the picture is rejected, and it is published only if we then review it by hand and decide to publish it. That review is not a guarantee: the picture may show something the dish does not contain, and what the dish contains is what its ingredient list says.` |
| Alternativa (B, el cambio mínimo; **descartada**) | `La petición va a OpenRouter, que la pasa a Google (Vertex AI), y un modelo que ejecuta DeepInfra comprueba que la imagen no muestra alimentos que la receta no lleva; si la rechaza, solo se publica cuando la revisamos a mano y decidimos publicarla. Ninguno guarda la petición ni la usa para entrenar.` | `The request goes to OpenRouter, which passes it to Google (Vertex AI), and a model run by DeepInfra checks that the picture shows no food the recipe does not contain; if it rejects it, the picture is published only when we review it by hand and decide to publish it. None of them keeps the request or trains on it.` |

- **A** corrige las dos cosas: lo que la fase 3 añade (punto 3) y lo que la frase ya
  decía de más (punto 4). **B** corrige solo la primera y deja «alimentos que la receta
  no lleva», que sigue siendo más ancho que el juez. Recomendé A, y A es el elegido.
- **No hay variante C**: no encuentro una redacción que deje la frase como está y sea
  verdad una vez aceptada la primera imagen a mano. Si el propietario no quiere cambiar
  la frase, la aceptación a mano no se activa (o se quita la cláusula del juez entera,
  que también es cambiar el texto).
- **`privacy.updated` cambia con ella** (`es-ES.ts:2359`; `en-GB.ts:2314`): 30 de
  septiembre de 2026, por decisión del propietario. Si el cambio llegara a producción
  otro día, la fecha es la de ese día. `terms.updated` no.
- **Sin correo previo.** La política promete avisar por correo antes de un cambio
  importante; este no cambia qué datos personales se tratan, para qué ni con quién, y no
  quita nada a nadie: informa mejor.
- **Orden.** La frase solo se vuelve engañosa cuando exista la primera imagen aceptada a
  mano, y eso solo puede hacerlo el propietario. Lo más simple es que el diccionario
  cambie **en el mismo cambio** que trae el botón. Si se separan: el texto primero, y el
  propietario no acepta ninguna imagen hasta verlo en `/privacidad`
  ([`checklist-activacion.md`](./checklist-activacion.md) § 0 ter).

<!-- Fuente del texto nuevo. «revisa cada imagen antes de que se publique»: no toda imagen dibujada llega al juez —la que viene sin manifiesto C2PA se descarta antes, `DishPicture.service.ts:279`, y el juez corre después, `:320`—, pero toda imagen que llega a publicarse pasó por `judgePicture` — por la puerta (a) la aceptó; por la (b) la rechazó y el propietario la aceptó; la que el juez no llegó a ver no se guarda ni se acepta (PRD 009, Out). «Si ese modelo ve con claridad […] un alimento con un alérgeno que la receta no lleva, la imagen se rechaza»: `judge.ts:16-18` y `:497` (`specific`, no genérico, `amount !== 'trace'`, `foreignAllergens.length > 0`); los alérgenos salen del catálogo, no del modelo. «solo se publica si después la revisamos a mano y decidimos publicarla»: las dos puertas de `0072`; `RecipeController.ts:359-466` (sesión de administrador, los alérgenos señalados repetidos en la petición, `picture.accepted` en la misma transacción); `picture-doors.spec.ts`. «no es una garantía […] puede mostrar algo que el plato no lleva»: el juez deja pasar lo que sobra sin alérgeno ajeno y las trazas, puede no ver algo, y el propietario puede aceptar contra él; «lo que lleva lo dice su lista de ingredientes»: `0004`, la puerta de alérgenos va contra la receta (misma frase que § 3.3). No se promete «y podemos retirarla»: hasta el 010 fase 4 solo se podía retirar la aceptada a mano; desde esa fase se puede retirar cualquier imagen publicada (`RecipeRepository.ts:1041`, árbol de la fase 4: `status = 'ready'` y nada más), pero sigue sin prometerse: una promesa en la política es exigible (TRLGDCU art. 61.2), y retirar es un acto discrecional del propietario en su consola, no un derecho de quien lee; la frase publicada es verdad con retirada y sin ella, y no cambia. Normas: Ley 3/1991 (BOE-A-1991-628, consolidada a 27/12/2025), arts. 5.1.b, 5.1.h y 7.1; TRLGDCU (BOE-A-2007-20555, consolidado a 28/02/2026), arts. 8.1.d, 19.2, 60.1 y 61.2; RGPD arts. 2.1 y 5.1.a (no alcanzan esta frase); Ley de IA art. 50.4-50.5 (no la exige). -->

<!-- Fuente: RGPD arts. 5.1.a y 13.1.e (sin datos personales no hay destinatario que informar; se nombra por lealtad y por la promesa en vigor); PRD 006, criterios 3-4; prompt del piloto (`buildPrompt`: nombre y proporciones, sin datos del usuario); `0003` §§ 5.3, 6.2, 7.1; OpenRouter `provider.only` = `google-vertex/global` / `deepinfra` (MAI y `azure` fuera desde el 2026-09-27), `allow_fallbacks: false`, ZDR (metadatos del piloto). Marca invisible: Vertex AI, Content Credentials (act. 2026-09-25) y Gemini API, «All generated images include a SynthID watermark» (act. 2026-09-23); medido el 2026-09-27 en 8 de 8 ficheros recibidos (C2PA de Google con la acción «Applied imperceptible SynthID watermark» y XMP IPTC), servidos sin tocar. Ley de IA art. 50.2 y 50.5 (quien quiera comprobarlo sabe que puede). «Se muestran a todas las personas que ven ese plato»: la imagen es de la receta, compartida (PRD, Outcome); así nadie cree que su imagen dice algo de él. -->

**c) «Con quién compartimos tus datos», línea de Vercel** (`es-ES.ts:1373`; `en-GB.ts`,
equivalente):

| es-ES | en-GB |
| --- | --- |
| `Vercel (alojamiento de la web, la API y las imágenes de los platos, en la Unión Europea) y Neon (base de datos, en la Unión Europea). Son empresas de Estados Unidos.` | `Vercel (hosting for the website, the API and the pictures of the dishes, in the European Union) and Neon (database, in the European Union). Both are US companies.` |

<!-- Fuente: RGPD art. 13.1.e; Vercel Blob (región elegible al crear el almacén, docs act. 2026-08-26): la frase «en la Unión Europea» solo es verdad si el almacén se crea en `fra1` (§ 6). -->

**d) «Transferencias»**: sin cambios (§ 4.1).
### 4.3 La imagen rechazada que espera al propietario (009, fase 2)

**Lo que deja de ser verdad.** Hasta el 2026-09-30 el código, `0066` y el PRD del 006
decían que una imagen rechazada «nunca se guarda». Este documento no lo prometía con esas
palabras, pero lo daba por hecho: la fila «Guardar» del § 4.1 solo conocía la imagen
aceptada. Dicho con precisión, para la fase 2:

> Una imagen que el juez rechazó **no la publica ningún código automático**: ningún
> dibujo, reintento ni tarea la convierte en la imagen de un plato. **Se guarda una, en
> privado**: la última de un dibujo que terminó fallido, si llevaba su manifiesto C2PA,
> para que el propietario la mire durante 7 días. **Solo él puede publicarla** (fase 3):
> a mano, con sesión de administrador, después de ver los alérgenos que el juez señaló,
> y con una fila en el registro de acciones escrita en la misma transacción (§ 4.4). Un
> fichero sin manifiesto no se guarda nunca, en ningún almacén, ni se puede aceptar.

(La fase 2 decía aquí «nunca se publica […] ninguna ruta […] la convierte en una». Dejó
de ser verdad con la fase 3, y se corrige arriba.)

**Qué se guarda y qué no** (`DishPicture.service.ts:173-246` y `:367-386`;
`PictureCandidate.ts:36-43` y `:52-58`):

| | Se guarda | Dónde |
| --- | --- | --- |
| La última imagen con C2PA que el juez rechazó, **solo si el dibujo termina fallido** | El JPEG, byte a byte | Almacén privado, `dish-picture-candidates/<id de receta>/<versión del prompt>-<aleatorio>.jpg` |
| Su puntero | La ruta, el modelo, la versión del prompt y, por cada alimento señalado, claves de alérgeno y slugs del catálogo (`flaggedExtras`, `judge.ts:523-527`): **no** la palabra que escribió el modelo de visión | `recipe_images.provenance.candidate` (Neon) |
| Un fichero sin C2PA | El fichero, **no**. Un diagnóstico cerrado: tipo de contenido, tamaño y tres marcas sí/no | `recipe_images.provenance.diagnostic` |
| Las otras imágenes rechazadas del mismo dibujo; las de un dibujo que acaba aceptado o devuelto; la que el juez no llegó a ver | Del fichero, nada. Desde el 010 fase 3, **lo que el juez respondió** sobre cada una que llegó a juzgar sí se guarda (§ 4.5) | `recipe_images.provenance.drawings` |
| Las notas del dibujo | Como antes de esta fase: `provenance.notes` guarda las notas del juez, que **sí** incluyen nombres de alimentos escritos por el modelo de visión (`judge.ts:502-510`). No llegan a ninguna pantalla ni a ningún correo: la consola solo saca de esa fila el motivo de la lista cerrada y lo que lleva el puntero (`AdminCatalogueController.ts:213-226` y `:235-239`; ningún DTO de `modules/admin/dto/out` lleva `notes` ni `provenance`). Desde el 010 fase 3, además, las respuestas enteras del juez, en `drawings` (§ 4.5) | `recipe_images.provenance.notes` |

Sin el token del almacén privado no se guarda nada y el dibujo es el de antes
(`DishPicture.service.ts:369`; `VercelBlobPictureCandidateStore.ts:21-23`).

**Quién la ve.** Solo una sesión de administrador, por dos rutas con `@Roles('admin')`
(`AdminCatalogue.controller.ts:49`): la que responde los bytes
(`GET /admin/catalogue/recipes/:id/picture/candidate`, `:116-123`, con
`Cache-Control: private, no-store` y `nosniff`) y la que responde la receta con lo que
señaló el juez y cuándo caduca, **sin ruta ni dirección** (`:86-89`). Para cualquier otro,
un 404. Vercel, como alojamiento, guarda el fichero: ya es encargado y ya está nombrado.

**Cuánto tiempo: lo que es verdad, y lo que no se puede prometer.**

| | Plazo | Fuente |
| --- | --- | --- |
| Se puede ver | Mientras la fila siga `failed` y no hayan pasado **7 días exactos** desde el último intento. Pasado ese instante ni se enseña ni se sirve, aunque el fichero siga ahí | `reviewableCandidate` y `candidateExpiry`, `RecipeController.ts:112-134`; `PICTURE_COOL_OFF_DAYS = 7`, `:60` |
| Se borra antes | Cuando el propietario la descarta (primero el fichero, después el puntero y la fila `picture.discarded`, en una transacción) o reintenta el dibujo (primero el reclamo, que quita el puntero; después el fichero). Y, desde la fase 3, cuando la **acepta**: publicada la imagen, se borra el fichero privado y después su puntero; si ese borrado falla, la aceptación vale y la limpieza nocturna, que también toma las filas que ya no están `failed`, termina el trabajo | Descartar y reintentar: `RecipeController.ts:565-568` (`discardCandidate`) y `:843-888` (`retryPicture`). Aceptar: `RecipeController.ts:462-468`; `RecipeRepository.ts:1128-1139` |
| Se borra al caducar | En la limpieza de las **03:30 UTC** (`apps/api/vercel.json`), dentro de `/cron/rewrite-steps`: hasta 24 h después de caducar. Primero el fichero, después el puntero | `Cron.controller.ts:103-109`; `RecipeController.ts:309-335`; `RecipeRepository.ts:968-979` |
| Puede tardar más | La limpieza tiene 8 s, no empieza un borrado en sus últimos 4 s y toma como mucho 100 filas por noche, las más antiguas primero. Un borrado que falla deja el puntero y se reintenta la noche siguiente, sin límite de noches. Si la tarea no corre, nada se borra; el resumen diario avisa de que la «reescritura nocturna» lleva más de 26 h sin correr ([`textos/06`](./textos/06-correos.md) § H) | `Cron.controller.ts:26`; `PictureCandidates.service.ts:14` y `:46-50`; `RecipeController.ts:69` y `:318-331` |
| Puede quedarse **sin plazo** | Un fichero **sin puntero**, que ninguna ruta puede leer y que la limpieza no encuentra, porque lee la base y nunca lista el almacén: (a) el borrado tras un reintento falla, y el fallo se traga (`RecipeController.ts:625-627`); (b) el fichero se subió y la fila no llegó a escribirse —la función murió, o el reclamo se perdió y el borrado de después falló— (`DishPicture.service.ts:236-243` y `:389-397`); (c) se quita el token con punteros vivos: la limpieza quita los punteros y no borra nada (`PictureCandidates.service.ts:41-50`); (d) fase 3: al **retirar** una imagen cuya fila aún guardaba el puntero de la candidata, el borrado del fichero privado falla y se traga (`RecipeController.ts:773-777`). Solo lo borra el propietario, a mano, desde el panel de Vercel | las citadas |

Por eso ningún texto debe decir «como mucho 7 días». Lo que se puede afirmar es: **se
puede ver 7 días; después se borra, normalmente en la limpieza de la noche siguiente**.
`0072` lo dice así desde el 2026-09-30 («can be reviewed for 7 days»; antes decía «kept
for at most 7 days»), igual que `apps/api/AGENTS.md:339-340`. El informe `0005` § 5
conserva «como mucho 7 días»: es un informe cerrado y no se edita; manda `0072`.

Al borrar, Vercel avisa de que «it may take up to one minute for them to be fully removed
from the Vercel CDN cache» (*Using the Blob SDK*, `del()`, act. 2026-08-26). Esa copia
solo se lee con el token, y la API pide siempre el original, no la copia
(`VercelBlobPictureCandidateStore.ts:32`, `useCache: false`). No he encontrado en la
documentación de Vercel qué pasa con un fichero borrado en sus copias de seguridad: **no
lo sé**.

**¿Hay un plazo legal que cumplir?** No. El art. 5.1.e RGPD limita la conservación de
**datos personales**, y aquí no hay ninguno (abajo). Los 7 días son una decisión de
producto: que un fichero huérfano dure más no incumple nada frente a nadie. Lo que sí
sería un problema es escribir un plazo que el código no sostiene en un texto que alguien
lea, y por eso se revisó la página: la nota del plazo (`adminPictureReview.decideNote`),
el aviso tras reintentar (`retryDone`) y «pasados al menos 7 días» en Imágenes quedaron
corregidos el 2026-09-30. Dos imprecisiones se quedan, conocidas y anotadas en el LOG
del proyecto: entre la caducidad y la limpieza, Recetas dice de ese plato «Se reintenta
sola en la siguiente visita» (`adminRecipes.retryNext`), y no es así hasta que la
limpieza quita el puntero; y la página sin imagen que revisar da tres causas cuando el
plato puede no haber tenido ninguna (`nothingBody`).

**Con la fase 2, `/privacidad` no cambia**, ni `privacy.updated` (con la fase 3 sí: § 4.2 b):

- **No hay datos personales** (RGPD art. 4.1: «toda información sobre una persona física
  identificada o identificable»; art. 2.1: el Reglamento se aplica al tratamiento «de
  datos personales»; cdo. 26: no se aplica a la «información que no guarda relación con
  una persona física identificada o identificable»). El fichero es una foto de comida
  hecha con la receta; el puntero lleva una ruta con el id de la receta, un modelo, una
  versión y palabras del catálogo. Una clave de alérgeno aquí describe una imagen y una
  receta, no la alergia de nadie: no es dato de salud (art. 4.15).
- **No hay destinatario nuevo** (art. 13.1.e): Vercel ya está nombrado, con «las imágenes
  de los platos, en la Unión Europea» (`es-ES.ts:2229`; `en-GB.ts:2187`), y el segundo
  almacén está en `fra1`.
- **No hay fin nuevo ni nada que una persona vea distinto** (art. 13.1.c y 13.3): la
  política se informa a los interesados sobre sus datos, y a nadie se le trata un dato
  más.
- **La frase en vigor sigue siendo verdad** (art. 5.1.a): «Las imágenes se guardan en
  Vercel, se muestran a todas las personas que ven ese plato y llevan la marca «IA»»
  (`es-ES.ts:2221`) habla de las imágenes de los platos, y una rechazada no es la imagen
  de ningún plato ni se muestra a nadie. «un modelo que ejecuta DeepInfra comprueba que
  la imagen no muestra alimentos que la receta no lleva» sigue describiendo la única
  puerta por la que una imagen llega a una persona. **La fase 3 sí obliga a volver a esa
  frase**, y se ha vuelto: cambia (§ 4.2 b).
- **El rastro**: descartar escribe una fila `picture.discarded` con el id del propietario
  como autor, igual que `picture.retried` desde el 008 (y, desde la fase 3,
  `picture.accepted` y `picture.removed`: § 4.4). Es un
  dato del propio responsable en su propio registro de acciones: no hay interesado al que
  informar. Si un día administra otra persona, será un dato suyo ([`analisis.md` § 1](./analisis.md),
  tabla de lo que queda al borrar una cuenta, fila `audit_logs.actorId`).

`/condiciones` tampoco cambia: la frase del § 3.3 habla de las imágenes que se muestran.

### 4.4 Aceptar contra el juez, y retirar (009, fase 3; retirar cualquiera, 010 fase 4)

**Qué pasa, en datos.** Ningún dato personal entra ni sale. Aceptar mueve un fichero —una
foto de comida hecha con la receta— del almacén privado al público y cambia una fila de
`recipe_images`; retirar borra el fichero público y devuelve la fila a `failed` con el
motivo cerrado `owner_removed` (`RecipeRepository.ts:957-986`) y, desde el 010 fase 3,
con lo que el juez respondió sobre el plato (§ 4.5). No hay destinatario
nuevo: Vercel ya guarda y sirve las imágenes. Lo único que nombra a alguien es el rastro,
y nombra al propietario (abajo).

**Desde el 010 fase 4, «Retirar» vale para cualquier imagen publicada**, la aceptara el
juez o el propietario a mano: la única condición es que la fila esté `ready`
(`RecipeRepository.ts:1020-1056`, la condición en `:1041`, árbol de la fase 4); la cláusula
`handAccepted` que citaba IMG-16 ya no existe. Un plato sin imagen publicada responde 409
y no se escribe nada (`RecipeController.ts:798-800`, fase 4). Lo que hace es lo mismo que
arriba, para las dos puertas: primero la fila (desde ese instante ninguna pantalla recibe
la dirección), después el fichero público, con los mismos límites de caché (tabla de
abajo). Se conservan en la fila las respuestas del juez (`provenance.drawings`, § 4.5), que
ninguna respuesta de la API enseña; lo demás que dejó la puerta —la marca de la aceptación
a mano y los alérgenos anulados— se quita (`keepingDrawings`, `RecipeRepository.ts:1036`,
fase 4). **Retirar no publica nada**: no escribe ninguna fila `ready`, así que las dos
puertas de `0072` siguen siendo las únicas por las que una imagen llega a una persona. Y no
cambia qué datos se recogen ni qué llega a un modelo: no llama a ninguno.

**Los ficheros que pueden quedar donde no deberían.**

| Caso | Qué queda | Quién puede verlo | Cómo se arregla |
| --- | --- | --- | --- |
| **Huérfano público tras una aceptación** | La aceptación escribe el fichero en el almacén público **antes** de la transacción que lo publica (el otro orden publicaría una fila sin fichero). Si la función muere entre las dos, si la transacción falla y el borrado de después también, o si no se puede saber cómo acabó la transacción, queda en el almacén **público** una imagen que el juez rechazó, sin ninguna fila que apunte a ella (`RecipeController.ts:405`, `:437-460`; `0072` § Consequences; `apps/api/AGENTS.md`, paso 5) | Cualquiera **que tenga la dirección**, y nadie la tiene: lleva un UUID aleatorio (`PictureCandidates.service.ts:182`), no se devuelve en ninguna respuesta, no se guarda en ninguna fila y el código no la escribe en ningún registro. Es oscuridad, no privacidad, y `0072` lo dice con esas palabras. El fichero lleva su C2PA; suelto, no lleva el aviso visible | Nada lo recoge. El propietario, a mano, en el panel de Vercel: carpeta `dish-pictures/<id de la receta>/`, el fichero que no sea la imagen actual del plato |
| **Retirada con el fichero sin borrar** (`fileDeleted: false`) | La fila primero, el fichero después: si el borrado falla, la retirada vale y el fichero sigue en el almacén público (`RecipeController.ts:781-789`; fase 4: `:812-818`). **Desde el 010 fase 4, una segunda causa**: si la dirección que guarda la fila está en la carpeta de **otra** receta, no se le pide nada al almacén —retirar un plato nunca borra el fichero de otro— y la retirada vale igual (`PictureCandidates.service.ts:210-215` y `DishPicture.ts:70-74`, fase 4). Ningún código escribe hoy una fila así (la aceptación y el dibujo suben a la carpeta de su propia receta); solo podría venir de una migración de datos | Cualquiera con la dirección, y **esta dirección sí se repartió**: la tuvo la aplicación de cada persona que abrió el plato. Ninguna pantalla vuelve a recibirla desde este plato | La consola lo dice (`removeLeftover`) y el propietario lo borra a mano. **En el segundo caso no hay que borrar nada**: ese fichero es la imagen de otro plato, y el texto de la consola no distingue los dos casos (P3, abajo) |
| **Retirada con el fichero borrado** (`fileDeleted: true`) | Copias fuera del almacén. Vercel: «Since blobs are cached, it may take up to one minute for them to be fully removed from the Vercel CDN cache» (*Using the Blob SDK*, `del()`, act. 2026-08-26). Y el fichero se publicó con un año de caché (`VercelBlobPictureStore.ts:11` y `:70`; `cacheControlMaxAge` configura «the edge and browser cache»): un navegador que ya lo cargó conserva su copia | Quien ya la vio, en su propio dispositivo. El trabajador de servicio de la web no guarda imágenes (`DishPicture.tsx`, comentario; `sw.js`), pero sí copias de hasta dos páginas para usarlas sin conexión, que pueden seguir nombrando la dirección hasta que se refresquen. **No he medido** cuánto tarda en desaparecer de un teléfono | No se arregla: es el límite de «Retirar», y el aviso de aceptar debe decirlo (abajo) |

**¿Importa legalmente?** No hay plazo ni derecho de nadie en juego: no son datos
personales (RGPD art. 4.1), así que ni el art. 5.1.e ni el 17 se aplican. Lo que hay es
el riesgo IMG-2 con menos mitigación: una imagen rechazada, accesible sin su rótulo para
quien tenga el enlace (IMG-13 e IMG-14, § 5).

**El rastro: `picture.accepted` y `picture.removed`.**

| Campo | Qué lleva | ¿Dato personal? |
| --- | --- | --- |
| `actorId` | El id de la cuenta de administrador que aceptó o retiró (`RecipeController.ts:429` y `:766`; fase 4: `:449` y `:795`) | **Del propietario, sí**: es un dato suyo. **De un tercero, no** |
| `entity`, `entityId` | `recipe` y el id de la receta | No: una receta no es de nadie (`0028`) |
| `metadata` | En `picture.accepted`, `{ allergens }`: las claves de alérgeno que el juez señaló, **todas** las señaladas, también las de una traza (`candidateFlags`, `PictureCandidate.ts:80-88`; `Audit.ts:66`). En `picture.removed`, vacío hasta el 010 fase 4 (`Audit.ts:68`); **desde esa fase, `{ acceptedBy }`**, una palabra cerrada, `judge` u `owner`: por qué puerta había llegado la imagen retirada, leída de la fila bloqueada en la misma transacción (`Audit.ts:72-74`, `DishPicture.ts:102-104`, `RecipeRepository.ts:1049`, fase 4). Las filas escritas antes siguen con `{}` | No. Una clave de alérgeno aquí describe una imagen, no la alergia de una persona: no es dato de salud (art. 4.15). `acceptedBy` describe una imagen: `owner` no nombra a nadie que `actorId` no nombrara ya, y `judge` nombra un modelo. Ni ruta, ni dirección, ni palabras del modelo (`RecipeAcceptance.test.ts:226`; fase 4, `:707` y `:729`, que comprueban la fila entera) |
| `subjectUserId`, `ipHash` | Vacíos (`AuditRepository.ts:51`: «never an IP address») | — |

Confirmado, por tanto: **ningún dato personal de un tercero**. Para el propietario es un
dato propio en su propio registro: es a la vez responsable y único interesado, no hay a
quién informar (arts. 13-14) y el registro de actividades no gana fila ni categoría
(art. 30.1.c: «categorías de interesados»; el propietario no es interesado de su propio
tratamiento en ningún sentido útil). **Plazo**: el código no borra nunca una fila de
`audit_logs`; al borrar una cuenta, `actorId` queda a `NULL` (`platform.schema.ts`,
`onDelete: 'set null'`). Mientras administre una sola persona, el art. 5.1.e no obliga a
nada. **Si un día administra otra persona**, esas filas son datos suyos: habrá que
informarle, fijar un plazo y anotarlo en el registro
([`analisis.md` § 1](./analisis.md), fila `audit_logs.actorId`).

Para qué sirve el rastro, además: es la **prueba de diligencia** del propietario. Quien
presta un servicio responde de los daños «salvo que prueben que han cumplido […] los
demás cuidados y diligencias que exige la naturaleza del servicio» (TRLGDCU art. 147).
La fila dice qué se le advirtió y cuándo decidió. Corta en los dos sentidos: prueba que
fue avisado, y por eso mismo prueba que publicó sabiéndolo **[abogado]**.

**Los textos de la consola, frase por frase contra el código** (árbol de `frontend`,
`adminPictureReview`, `es-ES.ts:508-593`; los lee solo el propietario, así que no los mide
el derecho de consumo sino la regla de este directorio: ningún texto que el código no
sostenga).

| Frase | ¿Verdad? | Fuente |
| --- | --- | --- |
| «La imagen se publica para todas las personas que reciban este plato.» | Sí: la imagen es de la receta, compartida | `RecipeRepository.ts:107-150`; `PlanRepository.ts:336` |
| «Si muestra un alimento con un alérgeno que el plato no lleva, una persona con esa alergia puede desconfiar de un plato que es seguro para ella.» | Sí: es IMG-2, dicho sin exagerar ni quitarle peso | § 5 |
| «Los alérgenos del plato los decide la receta, no la imagen: aceptarla no cambia lo que el plato lleva ni a quién se le da.» | **Sí.** La aceptación escribe en `recipe_images` y en `audit_logs` y en nada más. De `packages/core`, solo leen esa tabla los repositorios de recetas, de planes y de la consola, y el de planes lee el estado y la dirección para pintarla (`PlanRepository.ts:336`, `:464-468`), no para elegir platos. La puerta de alérgenos va contra los ingredientes (`0004`) | las citadas; `picture-doors.spec.ts` |
| «Queda en el registro de acciones, con tu cuenta y los alérgenos que el revisor señaló.» | **Sí**, y en la misma transacción que publica: sin fila de auditoría no hay imagen publicada | `RecipeController.ts:429`; `RecipeAcceptance.test.ts:492` |
| «Se puede deshacer: «Retirar» deja el plato sin imagen otra vez.» | **A medias (P3).** Deja el plato sin imagen, sí. No deshace lo ya visto: copias en caché (tabla de arriba). Y no devuelve la candidata: el fichero privado se borró al aceptar | `RecipeController.ts:462-468`; `VercelBlobPictureStore.ts:11` |
| Paso 2: «He visto la imagen y la publico aunque el revisor vio en ella: {alérgenos}» | Sí. La petición repite esas claves y la caducidad de **esa** candidata; el servidor rechaza cualquier otra cosa. Que la haya mirado de verdad no lo puede comprobar nadie | `RecipeController.ts:383-389`; `PictureAcceptAction.tsx:121-123` |
| «…se publica tal cual…» | Sí: los mismos bytes | `RecipeAcceptance.test.ts:186` |
| Retirar: «El plato vuelve a quedarse sin imagen para todas las personas que lo reciban, y el archivo publicado se borra.» | **A medias (P3).** La primera parte, sí, desde el instante en que la fila cambia. «Se borra»: del almacén, si el borrado no falla; la red de Vercel puede servirlo hasta un minuto más y un navegador conserva su copia | tabla de arriba |
| «Espera al menos 7 días antes de volver a dibujarse solo, salvo que lo reintentes a mano desde Recetas.» | Sí: `lastAttemptAt = now`, una espera entera; el reintento a mano admite cualquier fila `failed` | `RecipeRepository.ts:971`; `RecipeController.ts:864-872` |
| «Queda en el registro de acciones, con tu cuenta.» | Sí, en la misma transacción | `RecipeController.ts:766` |
| `removeLeftover` (`fileDeleted: false`): «La imagen está retirada: el plato ya no la muestra a nadie. Pero su archivo no se ha podido borrar del almacén público y sigue ahí hasta que lo borres a mano.» | Sí. Le falta decir **dónde** (P3) | `RecipeController.ts:781-789` |
| `acceptedHelp`: «Retirar deja el plato sin imagen para todos y borra el archivo publicado. No cuesta nada.» | Sí, con el mismo matiz de la caché; aquí no hace falta repetirlo, lo dice el diálogo | — |
| `pictureNotAcceptable`: «…no es un JPEG con la firma C2PA…» | Impreciso y coherente: lo que se comprueba es que el **manifiesto** está, no su firma (§ 1.7). Todo el producto lo llama «firma C2PA» desde la fase 1; no pido cambiar una sola frase | `apps/api/AGENTS.md:294-296` |

**¿Basta el aviso para que la decisión del propietario sea informada?** Ningún artículo
fija qué debe leer quien despliega antes de publicar una salida: el art. 50 regula lo que
se dice al público, y el art. 4 pide que quien maneja el sistema lo entienda. Medido
contra lo que la decisión necesita, **sí basta**: tiene la imagen en grande, los
ingredientes del plato con sus gramos, sus alérgenos y trazas, los alérgenos y los
ingredientes del catálogo que el juez reconoció, la consecuencia para una persona
alérgica, que la garantía de alergias no se mueve, que queda registrado y que se puede
retirar; y el segundo paso le hace repetir los alérgenos. Le faltan dos cosas para ser
completo, las dos de redacción (P3). **Las cuatro redacciones de la tabla se han tomado
tal cual, en los dos idiomas (lead, 2026-09-30)**, y **comprobado ese mismo día en el
árbol de trabajo de `main`** que están letra por letra (`es-ES.ts:524-531`, seis viñetas;
`:577` y `:581`; y sus pares en `en-GB.ts`). La columna «¿Verdad?» de arriba describe,
por tanto, los textos **anteriores** en las tres filas marcadas «A medias» o «Le falta
decir dónde»: con la redacción nueva las tres son verdad.

Una cadena más, que `frontend` añadió después y no pedí (`publishedLoadFailed`,
`es-ES.ts:573`; `page.tsx:197`): «No se ha podido cargar la imagen publicada: puede que
su archivo ya no esté. Recarga la página; si sigue sin verse, retírala para que el plato
vuelva a dibujarse.» Es verdad salvo en el final: retirar **no** dibuja el plato; lo
deja sin imagen y en espera de al menos 7 días, o hasta que se reintente a mano
(`RecipeRepository.ts:971`). P3; redacción propuesta: `…si sigue sin verse, retírala: el
plato se queda sin imagen y se vuelve a dibujar pasados al menos 7 días, o antes si lo
reintentas desde Recetas.` / `…if it still does not show, remove it: the dish is left
without a picture and is drawn again after at least 7 days, or sooner if you retry it
from Recipes.`

Las redacciones tomadas:

| Clave | es-ES | en-GB |
| --- | --- | --- |
| `adminPictureReview.acceptEffects[4]` (hoy: «Se puede deshacer: …») | `Se puede retirar después: «Retirar» deja el plato sin imagen otra vez. No borra las copias que un navegador ya haya guardado.` | `It can be taken back later: “Remove” leaves the dish without a picture again. It does not delete the copies a browser has already stored.` |
| `adminPictureReview.acceptEffects`, una viñeta más, antes de la del registro (opcional) | `El revisor solo mira lo que sobra en la imagen. Si falta un ingrediente que el plato sí lleva, nadie lo ha comprobado: compárala tú con la lista del plato.` | `The checker only looks at what is extra in the picture. If an ingredient the dish does contain is missing, nobody has checked that: compare it with the dish’s list yourself.` |
| `adminPictureReview.removeBody` (cambia solo la primera frase) | `El plato vuelve a quedarse sin imagen para todas las personas que lo reciban, y el archivo publicado se borra del almacén. La red de Vercel puede seguir sirviéndolo hasta un minuto, y un navegador que ya lo cargó conserva su copia. Espera al menos 7 días antes de volver a dibujarse solo, salvo que lo reintentes a mano desde Recetas. Queda en el registro de acciones, con tu cuenta.` | `The dish goes back to having no picture for everyone who gets it, and the published file is deleted from the store. Vercel’s network may go on serving it for up to a minute, and a browser that already loaded it keeps its copy. It waits at least 7 days before it is drawn again on its own, unless you retry it by hand from Recipes. It is recorded in the audit log, with your account.` |
| `adminPictureReview.removeLeftover` | `La imagen está retirada: el plato ya no la muestra a nadie. Pero su archivo no se ha podido borrar del almacén público y sigue ahí hasta que lo borres a mano, en el panel de Vercel: en el almacén de las imágenes, la carpeta dish-pictures y, dentro, la que lleva el id de este plato (está en la dirección de esta página).` | `The picture is removed: the dish no longer shows it to anyone. But its file could not be deleted from the public store, and it stays there until you delete it by hand, in the Vercel dashboard: in the pictures’ store, the dish-pictures folder and, inside it, the one named with this dish’s id (it is in this page’s address).` |

<!-- Fuente: Vercel, *Using the Blob SDK*, `del()` y `put()` → `cacheControlMaxAge` (act. 2026-08-26); `VercelBlobPictureStore.ts:11` y `:70`; `RecipeController.ts:755-790`; `PictureCandidates.service.ts:182` (la ruta pública es `dish-pictures/<id de la receta>/<versión>-<uuid>.jpg`); la página es `/admin/catalogo/<id>/imagen`. Segunda viñeta: `judge.ts:16-18` (el juez solo rechaza lo que sobra; IMG-1). Ley de IA art. 4. -->

**Los textos de la consola que trae el 010 fase 4**, frase por frase contra el código
(árbol de la fase 4, `es-ES.ts` y sus pares en `en-GB.ts`). La misma regla: los lee solo
el propietario.

| Frase | ¿Verdad? | Fuente |
| --- | --- | --- |
| `judgeAcceptedTitle` / `judgeAcceptedIntro`: «Imagen aceptada por el revisor» / «La imagen de este plato está publicada: la aceptó el revisor. La ven todas las personas que reciben el plato.» | **Sí.** Se enseña en una fila `ready` que no lleva la marca de la aceptación a mano, y toda fila así la dejó la puerta del juez: la migración `0042` vació la tabla de las ilustraciones anteriores, y desde entonces solo escriben `ready` el dibujo tras la aceptación del juez y la aceptación a mano, que deja su marca | `es-ES.ts:564-568` (fase 4); `DishPicture.ts:102-104` (fase 4); migración `0042` (el `DELETE` final); § 4.2 b, comentario |
| `judgeAcceptedHelp`: «Si muestra algo que el plato no lleva, retírala: el plato se queda sin imagen para todos y se borra el archivo publicado. No cuesta nada.» | Sí, con el matiz de la caché de arriba, que el diálogo dice. «No cuesta nada»: retirar no llama a ningún modelo ni cuenta en el tope | `RecipeController.ts:784-819` (fase 4); `apps/api/AGENTS.md`, «Remove» (fase 4) |
| `judgePublishedCaption`: «Imagen generada por IA. La aceptó el revisor y está publicada: es la que ven las personas que reciben este plato.» | Sí. Y la consola la rotula como IA, igual que la rechazada (§ 1.6) | las de arriba |
| `removeBody`, frase nueva: «…se borra del almacén: esta imagen no se puede recuperar.» | **Sí.** La fila pierde la dirección, el fichero público se borra y, si quedaba el puntero de una candidata, también su fichero privado; nada guarda una copia | `RecipeRepository.ts:1033-1040`; `RecipeController.ts:802-818` (fase 4) |
| `removeTitle`: «¿Retirar la imagen de {dish}?» | Sí | — |
| `pictureNotRemovable`: «Esa imagen no se puede retirar: el plato ya no tiene una imagen publicada.» | Sí: es el 409 de una fila que no está `ready` | `RecipeController.ts:798-800` (fase 4) |
| Ayuda de Recetas (`es-ES.ts:887`, fase 4): «Toda imagen lista se puede retirar, la aceptara el revisor o tú a mano…» | Sí | `RecipeRepository.ts:1041` (fase 4) |
| Motivo `owner_removed` y ayuda de Imágenes: «Retiraste una imagen publicada: la había aceptado el revisor o la aceptaste tú a mano…» | Sí | `RecipeRepository.ts:1036` (fase 4) |
| Registro de acciones: `picture.removed` «Imagen publicada de un plato, retirada», y `removedAcceptedBy`: «La había aceptado el revisor» / «La habías aceptado a mano, contra el revisor»; una fila anterior a la fase 4 no dice nada | Sí: lee `acceptedBy` y nada más | `es-ES.ts:185` y `:206` (fase 4); `Audit.ts:72-74` (fase 4) |
| `removeLeftover` (sin cambio): «…la carpeta dish-pictures y, dentro, la que lleva el id de este plato…» | **A medias (P3), solo en el caso nuevo.** Cuando la retirada se negó a borrar un fichero de la carpeta de **otra** receta, la API responde lo mismo, `fileDeleted: false`, y el texto manda al propietario a una carpeta donde ese fichero no está; el fichero que la fila nombraba es la imagen de otro plato y no hay que borrarlo. Nadie resulta afectado (no hay datos personales ni se borra nada por error: el texto señala la carpeta de este plato), y hoy ningún código escribe una fila así. Cambio más pequeño: que la respuesta distinga el caso y la consola diga «no hay nada que borrar». Pasado al lead (2026-09-30); no bloquea. Redacción propuesta para ese caso: `La imagen está retirada: el plato ya no la muestra a nadie. Su archivo no se ha borrado porque está en la carpeta de otro plato: es la imagen de ese plato y no hay que borrarlo.` / `The picture is removed: the dish no longer shows it to anyone. Its file was not deleted because it is in another dish’s folder: it is that dish’s picture and must not be deleted.` | `PictureCandidates.service.ts:210-215`; `RecipeController.ts:812-818` (fase 4) |

<!-- Fuente: árbol `.claude/worktrees/phase4-010` sobre `8e9ca114`, sin commit: `RecipeRepository.ts:1020-1056`, `RecipeController.ts:784-819`, `PictureCandidates.service.ts:210-227`, `DishPicture.ts:70-104`, `Audit.ts:72-74`, `es-ES.ts` y `en-GB.ts` (namespaces `adminAudit`, `adminPictureReview`, `adminPictures`, `adminRecipes` y `errors`). Migración `0042_a_picture_is_a_url_with_its_drawing_state.sql`. PRD 010, criterio 9; `0073`; informe `0006`, pregunta 4. Sin norma nueva: textos que solo lee el responsable, medidos con la regla de este directorio (RGPD art. 5.1.a no los alcanza: no informan a ningún interesado). -->

**`/condiciones`**: la frase del § 3.3 sigue siendo verdad («Lo que lleva cada plato lo
dice su lista de ingredientes»). Dice que las imágenes «pueden no mostrar todos sus
ingredientes ni su cantidad real», y calla lo contrario: que pueden mostrar algo que el
plato no lleva. Eso ya podía pasar antes de esta fase (el juez deja pasar lo que sobra
sin alérgeno ajeno) y ahora puede pasar con un alérgeno. **No es condición de la fase**;
si el propietario cambia la frase de `/privacidad`, conviene igualarla en el mismo
cambio, con `terms.updated` (P3). **No se toma** (propietario, 2026-09-30):
`/condiciones` se queda como está. El texto se conserva por si se reabre:

| es-ES | en-GB |
| --- | --- |
| `…y pueden no mostrar todos sus ingredientes ni su cantidad real, o mostrar algo que el plato no lleva. Lo que lleva cada plato lo dice su lista de ingredientes, y es la que tiene en cuenta tus alergias.` | `…and may not show all of its ingredients or its real quantities, or may show something the dish does not contain. What each dish contains is what its ingredient list says, and that list is the one that takes your allergies into account.` |

<!-- Fuente: TRLGDCU art. 60.1; Ley 3/1991, art. 7.1 (omisión de información necesaria); Ley 7/1998, art. 5.5. Solo informa: no es un «cambio importante» y no exige correo previo (§ 3.3). -->

### 4.5 Lo que dijo el juez se guarda (010, fase 3)

**Qué se guarda.** En `recipe_images.provenance.drawings`, por cada intento que llegó al
juez (las dos llamadas respondieron y la regla corrió): la hora del juicio, el número del
intento, lo que el modelo de visión dijo ver (nombre de cada alimento, cantidad y si es
específico; cosas que no son comida; nitidez, realismo), el cruce con los ingredientes de
la receta, el veredicto y sus notas. Una vez por dibujo, la receta tal como se juzgó:
nombre e ingredientes con sus gramos. Como mucho 3 dibujos de 3 intentos por plato, con
tope en cada lista y cada cadena; lo que no cabe se corta y un intento que aun así pasa de
6 KB no se guarda (`PictureJudgement.ts:24-41`, `:74-97`, `:249-294`).

**¿Nombra o describe a alguien?** No.

- El esquema es cerrado (`strictObject`) y se llena solo con las respuestas, el veredicto,
  la hora y el número del intento (`DishPicture.service.ts:361`), y con la receta que lee
  `pictureRecipe` (nombre e ingredientes, `RecipeRepository.ts:857-879`). **Nada del
  reclamo ni de la petición**: ni id de usuario, ni sesión, ni quién abrió el plato.
- Lo que el modelo de visión describe es una imagen generada solo con la receta (§ 4.1).
  Una palabra suya («mano», «mantel», un alimento) describe esa imagen, no a una persona:
  no es información «sobre una persona física» (RGPD art. 4.1; cdo. 26).
- El nombre de la receta lo escribe el modelo que diseña los platos, o sale de la
  biblioteca: el único escritor de `recipes` fija `source: 'ai'` y toma el nombre del
  borrador del modelo (`PlanRepository.ts:1246-1262`); ningún camino guarda un nombre que
  haya escrito una persona. Es la misma entrada que ya recibe el dibujo.
- `recipes.createdBy` sigue ligando una receta generada a la cuenta que la generó, como
  antes ([`analisis.md` § 1.1](./analisis.md)); la copia de la receta **no** lo copia, y
  una receta no es de nadie (`0028`).
- La hora de cada juicio (`at`) sigue a una visita, igual que `lastAttemptAt` desde el
  006: no viaja con ningún identificador (§ 4.1, fila de la imagen rechazada).

**¿Queda algo falso o incompleto en el registro o la EIPD?** No. No hay categoría de datos
personales, fin, interesado ni destinatario nuevos: las respuestas las producen los mismos
proveedores que ya las producían (§ 4.1), y se guardan en Neon, ya nombrado. **Plazo**: lo
que dure la fila del plato, que se borra con la receta (`recipe.schema.ts:139`, `ON DELETE
CASCADE`); las recetas no se borran al borrar una cuenta. Acotado **en tamaño** (3 × 3),
**no en tiempo**. El art. 5.1.e solo limita la conservación de datos personales. Anotado
en el registro y en la EIPD, sin fila nueva.

**¿Sale de la API?** No, según el código: la consola lee `provenance - 'drawings'`
(`AdminCatalogueRepository.ts:172`; `AdminRepository.ts:103`, que alimenta los recuentos y
el correo de fallos); la lectura de la candidata solo saca de la fila el puntero
(`RecipeController.ts:146`); la aceptación a mano la vuelve a escribir en la fila, no en
el registro de acciones (`RecipeController.ts:439`); los `logger.warn` del servicio llevan
el id de la receta y un motivo, no las respuestas (`DishPicture.service.ts:266`, `:399`,
`:430`, `:455`).

**¿Obliga a algo guardar la salida de un modelo sin enseñarla?**

- **Ley de IA**: no. El art. 50.2 pide marcar el contenido sintético que el sistema genera
  para que se pueda detectar; estas palabras son una salida técnica, dentro de un flujo
  interno con control de acceso, que no llega a nadie: el supuesto que las Directrices
  tratan aparte (apdo. 87, § 1.6). El 50.4-50.5 es hacia el público, y aquí no hay
  público. Los registros de los arts. 12 y 26.6 son solo para sistemas de alto riesgo, y
  este no lo es. Nada en el Reglamento prohíbe ni exige guardar la salida.
- **Consumo**: no. Sin comunicación al consumidor no hay práctica comercial (TRLGDCU
  art. 19.2), y estas palabras no llegan a ninguno.
- **Condiciones de los proveedores**, tal como las recoge este directorio: nada limita que
  NutrIA guarde lo que le responden. El ajuste «OpenRouter use of inputs/outputs»
  ([`checklist-activacion.md`](./checklist-activacion.md)) es sobre el uso que hace
  OpenRouter, no NutrIA. **Las condiciones de DeepInfra sobre sus salidas no las he
  leído** (la misma laguna que IMG-9 para Google): P3.
- **El día que una pantalla, una exportación o un correo enseñe estas palabras a alguien**,
  hay que volver al § 1 y al § 4.2.

**`/privacidad` sigue siendo verdad.** «Ninguno guarda la petición ni la usa para entrenar»
habla de los proveedores (OpenRouter, Google, DeepInfra), no de NutrIA; «Nunca recibe nada
tuyo, ni siquiera quién ha abierto el plato» no cambia, porque las llamadas no cambian. El
párrafo de los planes («Nadie entrena con ello ni lo guarda») habla de la petición del
diseño de platos, no de esta. Ninguna frase publicada promete que NutrIA no guarde lo que
responde el juez (`es-ES.ts:2280-2290`, en `main`). **Sin cambio de texto ni de
`privacy.updated`.**

<!-- Fuente: RGPD (texto del DOUE en BOE, PDF `L00001-00088`) arts. 2.1, 4.1, 5.1.e y 30.1, cdo. 26; Reglamento (UE) 2024/1689 arts. 50.2, 50.4, 50.5 y Directrices C(2026) 5054 final, apdo. 87 (consultados el 2026-09-30 para el § 1.6; no vueltos a consultar en esta revisión); arts. 12 y 26.6 (registros, solo alto riesgo): **no consultados para esta revisión**, lectura de su título y su capítulo (III, alto riesgo) que un abogado puede comprobar en un minuto; TRLGDCU (BOE-A-2007-20555, consolidado a 28/02/2026) art. 19.2. Código: árbol `.claude/worktrees/backend-010-3` sobre `f81e834`. -->

---

## 5. Riesgos, ordenados por lo que le puede pasar a una persona

| # | Qué puede pasar | Gravedad | Qué lo evita |
| --- | --- | --- | --- |
| IMG-1 | Una persona alérgica ve una foto sin el alimento que le hace daño, aunque el plato lo lleve (una salsa, un aceite de sésamo «cocinado dentro»), y se fía de la foto | **P1** (daño a la salud, aunque la lista esté bien) | La puerta de alérgenos es código contra la lista, no contra la imagen (`0004`). El pie dice «manda la lista de ingredientes». Las condiciones lo dicen (§ 3.3). El juez solo rechaza lo que **sobra**, no lo que falta: el pie es la medida |
| IMG-2 | La foto muestra un alimento con alérgeno que el plato no lleva (nueces en un plato sin nueces). **Revisado el 2026-09-30 (009 fase 3)**: antes solo podía pasar si el juez no lo veía; ahora puede pasar porque el propietario publica, a mano, una imagen en la que el juez **sí** lo vio. Si el juez acertó, esa imagen muestra de verdad el alimento, y la ven todas las personas a las que se les da el plato, hasta que se retire | **P2, y el más alto de los P2.** La gravedad no sube: el plato es seguro, la receta y la lista de la compra no llevan ese alimento, y para que haya exposición alguien tendría que cocinar «según la foto» y añadirlo por su cuenta. Lo que le pasa a una persona real es que desconfía de un plato seguro, se lo salta o deja de fiarse de la app. Sube la **probabilidad** (ya no hace falta un fallo del modelo: basta una decisión) y cambia la **naturaleza**: deja de ser el error de un modelo y pasa a ser un acto del propietario, avisado y registrado, del que responde él (TRLGDCU art. 147) **[abogado]** | **Dos puertas** (`0072`): el juez, o la revisión del propietario. La segunda lleva: (1) un aviso que nombra los alérgenos y los ingredientes del catálogo que el juez reconoció, con el plato al lado (§ 4.4); (2) dos pasos, y el segundo repetido en el servidor: la petición debe traer esos mismos alérgenos y la caducidad de esa misma candidata (`RecipeController.ts:383-389`); (3) la fila `picture.accepted`, en la transacción que publica; (4) **«Retirar»**, que quita la imagen del plato al instante, con los límites del § 4.4 (copias en caché); (5) el recuento «aceptadas a mano» en Imágenes y su filtro en Recetas, para volver a mirarlas. **Lo que sigue valiendo para cualquier imagen**: el pie «Es orientativa: manda la lista de ingredientes», que **solo está en la página de la comida** (`meal.pictureCaption`, `es-ES.ts:1668`) —la tarjeta del panel lleva la marca «IA» y nada más—, y la frase de las condiciones (§ 3.3). **Desde el 010 fase 4, «Retirar» alcanza también a la imagen que el juez aceptó por error**: el propietario la quita desde la consola, sin migración, y el plato vuelve a quedarse sin imagen para todos, con los mismos límites del § 4.4 (IMG-14; IMG-16 cerrado). Lo que no hace nada es **encontrarla**: ningún código señala una imagen que el juez aceptó mal; hace falta que alguien la vea y la retire |
| IMG-3 | ~~Una imagen de MAI llega a alguien sin marca legible por máquina~~ | cerrado | MAI fuera por decisión del propietario (2026-09-27) |
| IMG-4 | La tarjeta del panel muestra la imagen sin aviso | **P1** (art. 50.4-50.5) | `picture.aiMark` (§ 3.2), en la tarjeta y en la imagen grande |
| IMG-5 | La política dice que no se usa Google y Google dibuja | **P1** (texto que se leería falso) | § 4.2 a |
| IMG-6 | El almacén se crea fuera de la UE y la política dice «en la Unión Europea» | P1 (texto falso sobre IP de visitantes) | `fra1` (§ 6) |
| IMG-7 | Una ruta pública de Blob lleva un id de usuario | P1 (dato personal expuesto a cualquiera con el enlace) | Solo el id de la receta y un hash (§ 4.1) |
| IMG-8 | Recodificar borra el C2PA de Google | P3 (medido: llega y se sirve sin tocar) | Servir el original ✔; validar la firma una vez sobre un fichero servido por Blob (§ 2.3.1) |
| IMG-9 | No haber leído las condiciones de Google Cloud (IA generativa) para este modelo (las de Microsoft ya no hacen falta) | P2 (licencia de uso) | Leerlas antes de encender (§ 6). **No las he leído**; la cláusula de «práctica clínica» de P1-10 era de la API de Gemini, y aquí no hay uso clínico: son fotos de recetas |
| IMG-10 | Una imagen que el juez rechazó —puede mostrar un alimento con un alérgeno que el plato no lleva— llega a alguien que no es el propietario (009 fase 2) | P2 (la misma confusión que IMG-2, y sin el aviso visible si sale como fichero suelto; el C2PA va dentro) | Almacén **privado** aparte, con token propio que la API no confunde con el público (`Env.validation.ts:585-591`); rutas solo para administrador, 404 para el resto; la ruta del fichero no está en ninguna respuesta, registro ni error (`VercelBlobPictureCandidateStore.ts:44-60`); ningún código automático publica una candidata: desde la fase 3 solo la aceptación a mano del propietario (§ 4.3, § 4.4), y eso ya es IMG-2. Un fichero sin C2PA no se guarda nunca |
| IMG-11 | Un texto promete que la imagen rechazada se borra a los 7 días y un fichero dura más (limpieza con retraso, o huérfano sin puntero) | P3 (nadie resulta afectado: no hay datos personales ni plazo legal; sería un texto inexacto, y solo lo lee el propietario) | No escribir «como mucho 7 días» en ningún texto (§ 4.3); la página de revisión dice «hasta el {date}» y «Después la borra la limpieza nocturna, normalmente la noche siguiente»; vaciar a mano el almacén privado si un día importa |
| IMG-12 | El propietario acepta a mano un fichero **sin manifiesto C2PA** (009 fase 3): una imagen de IA publicada sin marca legible por máquina, y la última frase del § 4.2 b sería falsa | P1 si pasara (art. 50.2; texto falso). Probabilidad muy baja | Un fichero sin C2PA no se guarda como candidata; y, aunque la fila dijera que lo lleva, la aceptación vuelve a mirar **los bytes que va a publicar** y rechaza (409 `PICTURE_NOT_ACCEPTABLE`) lo que no sea un JPEG con su manifiesto (`RecipeController.ts:393-402`; `RecipeAcceptance.test.ts:425-462`). Se publican esos mismos bytes, sin recodificar. Es una regla de cumplimiento, no una preferencia técnica. **Límite**: se comprueba que el manifiesto está, no su firma, igual que en la puerta del juez (§ 1.7; pendiente P3 del § 2.3.1) |
| IMG-13 | Una imagen que el juez rechazó se queda en el almacén **público**, en una dirección aleatoria, sin fila que apunte a ella (009 fase 3): la función murió entre subirla y publicarla, o el borrado posterior falló (`0072` § Consequences; § 4.4) | P3. Nadie tiene la dirección: no se devuelve, no se guarda y el código no la registra; quien la tuviera vería una foto de comida sin rótulo visible, con su C2PA dentro. Es la misma confusión de IMG-10, protegida por oscuridad y no por un almacén privado: por eso no es P2 solo mientras la dirección no salga | El orden es deliberado (al revés habría una imagen publicada sin fichero). Nada la recoge: el propietario puede borrarla a mano en el panel de Vercel. **Comprobado por el lead el 2026-09-30: sí podía.** El mensaje de Vercel de un borrado fallido del almacén público podía llevar la dirección, y se escribía en el registro (`PictureCandidates.service.ts:213`, a través de `VercelBlobPictureStore.ts`, que además guardaba el error original como `cause`). **Arreglado y comprobado el 2026-09-30 en el árbol de trabajo de `main`**: `del` y `put` sustituyen la dirección y su ruta por `[picture]` en el mensaje y lanzan un error nuevo **sin `cause`** (`VercelBlobPictureStore.ts:43-54`, `:76-80` y `:89-97`; `VercelBlobPictureStore.spec.ts:99-125`). Con eso, «never logged» de `0072` vuelve a ser verdad para este caso. Lo que el saneado no puede quitar es una dirección que Vercel escribiera de otra forma (codificada, por ejemplo); la ruta solo lleva letras, cifras, `.`, `_` y `-`, así que no hay nada que codificar |
| IMG-14 | Una imagen publicada y después retirada se sigue viendo (009 fase 3, para las aceptadas a mano; desde el 010 fase 4, para cualquiera, la aceptara el juez o el propietario): la red de Vercel la sirve hasta un minuto más, el navegador de quien ya la cargó guarda su copia hasta un año, o el borrado falló y el fichero sigue en el almacén público (§ 4.4) | P3. Es IMG-2 que dura un poco más para quien ya lo vio; ninguna persona nueva recibe la dirección | La fila cambia primero: desde ese instante ninguna pantalla recibe la dirección (`RecipeRepository.ts:957-986`; fase 4: `:1020-1056`, con las dos puertas). Si el fichero no se pudo borrar, la consola lo dice y el propietario lo borra a mano. Los textos del aviso y de la retirada deben decir el límite (§ 4.4, redacción pedida) |
| IMG-15 | `/privacidad` dice que un modelo «comprueba que la imagen no muestra alimentos que la receta no lleva» y una imagen publicada es justo la que esa comprobación rechazó (009 fase 3) | **P1** si se acepta una imagen a mano sin cambiar la frase: veraz palabra por palabra, engañosa en lo que da a entender, y sobre alérgenos (Ley 3/1991, art. 5.1.b; § 4.2 b). Hoy, antes de la fase 3, P2: la frase ya dice más de lo que el juez hace | El texto nuevo del § 4.2 b, con `privacy.updated`, en el mismo cambio que el botón de aceptar; y, hasta que esté publicado, el propietario no acepta ninguna imagen (checklist § 0 ter). **Decisión del propietario** |
| IMG-16 | ~~Una imagen que el juez **aceptó** por error (no vio el alimento con alérgeno) no se puede retirar: «Retirar» solo vale para las aceptadas a mano (`RecipeRepository.ts:972`, `handAccepted`; PRD 009, fuera de alcance), y el reintento a mano no admite una imagen `ready`~~ | **Cerrado el 2026-09-30 (010 fase 4).** Era P2, existía desde el 006 | Se dejó fuera en el 009 (pregunta Q4 del informe `0005`) y se reabrió en el 010: el propietario respondió **sí** a la pregunta 4 del informe `0006` («Retirar» para cualquier imagen publicada), y es el criterio 9 del PRD 010 y parte de la decisión `0073` («Any published picture can be removed by the owner»). En el código: la condición de retirar es `status = 'ready'` y nada más (`RecipeRepository.ts:1041`, árbol de la fase 4); la cláusula `handAccepted` ya no existe. Una aceptación mala del juez se quita desde la consola, sin migración, con la misma transacción y la misma fila `picture.removed`, que ahora dice por qué puerta llegó (`acceptedBy`, § 4.4). Lo que queda es IMG-14 (copias en caché), igual para las dos puertas |

---

## 6. Lista de activación del flag de imágenes

Está copiada en [`checklist-activacion.md` § 0 ter](./checklist-activacion.md).

## 7. Para el abogado

Añadidos al [`analisis.md` § 10](./analisis.md#10-confirmar-con-un-abogado), punto 11:

- (a) ¿Es una foto realista de un plato, en una app de planificación, una
  «ultrasuplantación» (art. 3.60)? Mi lectura, con las Directrices (apdos. 113-116), es que
  sí.
- (b) «IA» en lugar de «AI» en la marca: el Código pide el acrónimo inglés salvo que la ley
  nacional de lenguas lo impida. NutrIA no es firmante, pero ¿algún riesgo?
- ~~(c) Si el C2PA no llega por OpenRouter: ¿basta SynthID más un IPTC sin firmar?~~ Ya
  no hace falta: medido el 2026-09-27, llega.
- (d) (2026-09-30, 009 fase 2) ¿Es una «exposición» del art. 50.4-50.5 que el propietario
  vea, en su consola, una imagen que el juez rechazó y que no se ha publicado? Mi lectura,
  por la finalidad de la norma, es que no (§ 1.6). **No hace falta gastar la hora en
  esto**: la página la rotula igualmente y el fichero lleva su C2PA, así que el producto
  cumple con cualquiera de las dos lecturas. Queda anotada por si la imagen saliera un día
  de la consola.
- (e) (2026-09-30, 009 fase 3) La excepción de «revisión humana o control editorial» del
  art. 50.4, párrafo segundo, ¿alcanza a una imagen que una persona revisa antes de
  publicarla? Mi lectura, con el texto del artículo y las Directrices (apdos. 130 y
  133-135), es que **no**: es solo para texto de interés público. **No hace falta gastar
  la hora**: el producto no se apoya en ella; la imagen aceptada a mano lleva la misma
  marca y el mismo aviso que las demás (§ 1.7).
- (f) (2026-09-30, 009 fase 3) Si una persona sufriera un daño relacionado con una imagen
  que el propietario publicó a mano contra el juez, ¿cómo pesa el registro
  `picture.accepted`: como prueba de diligencia (hubo aviso, dos pasos, posibilidad de
  retirar) o de que publicó a sabiendas? (TRLGDCU art. 147; Código Civil art. 1902, **que
  no he consultado para esta revisión**). **Sí merece cinco minutos de la hora**, junto
  con (a): las dos deciden cuánto cuidado pide publicar una foto realista de comida.

## Fuentes (versión consultada el 2026-09-27; las del final, el 2026-09-30)

- Reglamento (UE) 2024/1689, texto del DOUE en BOE (`DOUE-L-2024-81079`): arts. 3.3, 3.4,
  3.60, 50, 99.4 y 113; cdos. 133 y 134.
- Reglamento (UE) 2026/1744 (Ómnibus digital sobre IA), DO L de 24/7/2026: art. 111.3
  nuevo y considerando 38 (EUR-Lex, versión inglesa).
- Comisión Europea, *Guidelines on the implementation of the transparency obligations for
  certain AI systems under Article 50*, C(2026) 5054 final, anexo, 20/7/2026 (página
  actualizada el 6/8/2026): apdos. 10-12, 27, 69-88, 113-117, 141-148, 152-154.
- *Code of Practice on Transparency of AI-Generated Content*, versión final, 10/6/2026:
  sección 1 (medidas 1.1-1.4, 2.1, 3.3, 3.4) y sección 2 (medidas 1.1 y 1.2).
- Google Cloud, Vertex AI, *Content Credentials* (act. 2026-09-25). Google AI for
  Developers, Gemini API, *Image generation* (act. 2026-09-23).
- Microsoft Learn, *Content provenance* (Foundry; `ms.date` 2026-09-17, act. 2026-09-23).
- Vercel, documentación de *Vercel Blob* (act. 2026-08-26).
- Ley 3/1991, de Competencia Desleal (BOE-A-1991-628, consolidada a 27/12/2025), arts. 5.1.b
  y 7.1; TRLGDCU (BOE-A-2007-20555, consolidada a 28/02/2026), art. 60.1; Ley 7/1998
  (BOE-A-1998-8789, consolidada a 16/03/2019), art. 5.5; Ley 11/2023, art. 3.3; RGPD, arts. 5,
  13 y 28.
- **Consultadas el 2026-09-30** (009 fase 2): Reglamento (UE) 2024/1689, texto del DOUE en
  BOE (PDF `L00001-00144`), arts. 3.60 y 50.2, 50.4 y 50.5, y cdo. 134; Directrices
  C(2026) 5054 final, apdos. 87, 115, 117, 141 y 143; Reglamento (UE) 2016/679, texto del
  DOUE en BOE (PDF `L00001-00088`), arts. 2.1, 4.1, 4.15, 5.1.a, 5.1.e y 13, y cdo. 26;
  Vercel, *Private Storage* (act. 2026-09-15) y *Using the Blob SDK*, `del()` (act.
  2026-08-26). Código: árbol de trabajo de `main` sobre `abc0a90`, sin commit. Que el
  segundo almacén es privado y está en `fra1` lo dice `docs/reference/deployment.md:96`;
  **no lo he comprobado en Vercel**.
- **Consultadas el 2026-09-30** (009 fase 3): Reglamento (UE) 2024/1689, texto del DOUE en
  BOE (PDF `L00001-00144`), arts. 3.60, 4, 50.2, 50.4 (los dos párrafos) y 50.5, y
  cdo. 134; **no he vuelto a comprobar** si el Reglamento (UE) 2026/1744 toca el art. 50.4
  (la revisión del 2026-09-27 encontró solo el art. 111.3 nuevo). Directrices
  C(2026) 5054 final, cuadro de la sección 2 y apdos. 74, 130, 133-138 y 141-143.
  Reglamento (UE) 2016/679, texto del DOUE en BOE (PDF `L00001-00088`), arts. 2.1, 4.1,
  5.1.a y 30.1. Ley 3/1991, de Competencia Desleal (BOE-A-1991-628, consolidada a
  27/12/2025), arts. 5.1 y 7. TRLGDCU (BOE-A-2007-20555, consolidado a 28/02/2026),
  arts. 8.1.d, 19.2, 60.1, 61.2 y 147. Vercel, *Using the Blob SDK*, `del()` y
  `cacheControlMaxAge` (act. 2026-08-26). Código: árbol de trabajo de `main` sobre
  `fce954d` y árbol de `frontend` (`.claude/worktrees/frontend-009-3`), los dos sin
  commit. `0072`, PRD y PLAN del 009, informe `0005` §§ 5 y 10.
- **2026-09-30** (010 fase 3, § 4.5): sin fuente nueva consultada; se apoya en las de las
  dos entradas anteriores. Código: árbol `.claude/worktrees/backend-010-3` sobre
  `f81e834`, sin commit (`PictureJudgement.ts`, `DishPicture.service.ts`,
  `RecipeRepository.ts`, `AdminCatalogueRepository.ts`, `AdminRepository.ts`,
  `RecipeController.ts`, `PlanRepository.ts`, `recipe.schema.ts`); PRD 010, criterio 10;
  `0073`.
- **2026-09-30** (010 fase 4, retirar cualquier imagen publicada; IMG-16 cerrado): sin
  norma nueva consultada; lo que se cita (TRLGDCU art. 61.2, RGPD arts. 4.1, 4.15 y 5.1.a)
  es de las entradas anteriores. Código: árbol `.claude/worktrees/phase4-010` sobre
  `8e9ca114`, sin commit, sin la fase 2 del 010 (`RecipeRepository.ts`,
  `RecipeController.ts`, `PictureCandidates.service.ts`, `DishPicture.ts`, `Audit.ts`,
  `RecipeAcceptance.test.ts`, `apps/api/AGENTS.md` «Remove», y los diccionarios `es-ES.ts`
  y `en-GB.ts`); migración `0042`. PRD 010, criterio 9; `0073`; informe `0006`,
  pregunta 4.
