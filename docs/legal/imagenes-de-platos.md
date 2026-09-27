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
> **Describe una función que aún no existe.** Lo que aquí se dice del producto sale del
> PRD, del informe y del piloto. Antes de encender el flag hay que comprobarlo contra el
> código que se construya (§ 6).

## 0. Resumen

1. **Fechas: no hay periodo de gracia.** El art. 50 de la Ley de IA se aplica desde el
   **2/8/2026**. Los cuatro meses del Ómnibus (hasta el 2/12/2026) solo valen para sistemas
   introducidos **antes** de esa fecha. Las imágenes se ponen en servicio cuando se
   encienda el flag, así que les toca todo el art. 50 desde el primer día (§ 1.1).
2. **NutrIA es proveedor y responsable del despliegue** del sistema que dibuja los
   platos. Google y Microsoft son los proveedores de los modelos. El marcado legible por
   máquina (art. 50.2) es obligación de NutrIA, aunque puede apoyarse en el que ya ponen
   los modelos (§ 1.2).
3. **Una foto realista de un plato es, con toda probabilidad, una «ultrasuplantación»**
   según las directrices de la Comisión de julio de 2026 **[abogado]**. Por eso cada
   imagen debe llevar un aviso visible en **cada** sitio donde alguien la vea, también en
   la tarjeta del panel (§ 1.3). Los textos están en el § 3.
4. **Gemini trae las dos capas de marca**: el manifiesto C2PA firmado por Google y la
   marca de agua SynthID. **MAI-Image-2.6 no trae ninguna documentada**: Microsoft no lo
   incluye en su lista de modelos con procedencia. Recomiendo no activar MAI hasta que
   eso cambie (§ 2).
5. **Recodificar a WebP con `sharp` borra el C2PA.** Lo más barato es servir el JPEG de
   Gemini tal como llega (mediana de 182 KB en el piloto). Hay que medir antes si
   OpenRouter conserva ese manifiesto (§ 2.3).
6. **Privacidad**: el modelo que dibuja no recibe ningún dato personal. Google y Microsoft
   no son, por tanto, destinatarios en el sentido del art. 13 RGPD. Aun así hay que
   nombrarlos, porque la política promete que ningún proveedor entrena con lo que le
   enviamos. Además hay que acotar una frase en vigor que hoy dice «nunca los servicios de
   Google», y ampliar la línea de Vercel, que ahora también sirve las imágenes (§ 4).
7. **Consumo**: la imagen no es el plato que la persona va a cocinar. El rótulo lo dice
   («orientativa»), y las condiciones de uso ganan una frase (§ 3.3).

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
| Google (Gemini 3.1 Flash Lite Image, en Vertex) y Microsoft (MAI-Image-2.6, en Azure) | Proveedores de los **modelos** de uso general (capítulo V) | El art. 50 no se les aplica por los modelos (Directrices, apdo. 27), pero su marca «a nivel de modelo» facilita el cumplimiento del proveedor posterior (cdo. 133; Directrices, apdo. 74) |
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
| S1, 1.1 | Al menos dos capas: metadatos **firmados** (1.1.1) y marca de agua imperceptible (1.1.2) | Gemini: C2PA firmado por Google + SynthID, **si** se sirve el fichero original (§ 2.3). MAI: ninguna → fuera hasta que la tenga |
| S1, 1.2 | No quitar marcas existentes | Servir el original sin recodificar. Si se deriva otro tamaño, añadir los metadatos IPTC (§ 2.4) |
| S1, 2.1 | Detección disponible y gratuita | La de Google (SynthID y Content Credentials; cualquier visor C2PA). NutrIA no necesita una propia mientras solo use las marcas de Google |
| S1, 3.4 | Metadatos con un estándar abierto | C2PA (el de Google) e IPTC `DigitalSourceType` |
| S2, 1.1 | Icono o rótulo cuyo elemento principal sea el acrónimo «AI», o el de la lengua nacional si la ley lo exige | «IA» en español y «AI» en inglés. **Divergencia consciente**: el Código pide «AI» en inglés salvo incompatibilidad con la ley nacional de lenguas. Elijo «IA» para el público español porque el apdo. 142 exige que se entienda y en España el acrónimo común es «IA» **[abogado]** |
| S2, 1.1 (accesibilidad) | Contraste alto, compatible con lectores de pantalla, detectable por tecnologías de apoyo | Nombre accesible propio (§ 3.2); contraste sobre cualquier foto |
| S2, 1.2.1 | Visible sin interacción; encima o sobre el contenido; distinguible sobre cualquier fondo; en la primera exposición | Marca superpuesta en la esquina superior derecha de la tarjeta; pie de foto bajo la imagen grande |
| S2, 1.2.2 a | «in the top right corner of an image» | Esquina superior derecha |

---

## 2. Marca legible por máquina (art. 50.2)

### 2.1 Qué trae cada modelo

| Modelo | Metadatos firmados (C2PA) | Marca de agua | Fuente |
| --- | --- | --- | --- |
| `google/gemini-3.1-flash-lite-image` en Vertex | **Sí**. Google lo firma: «All images or videos created or modified using the listed models are automatically digitally signed by Google LLC», y `gemini-3.1-flash-lite-image` está en la lista | **SynthID**: «All generated images include a SynthID watermark». Es una marca del modelo, así que se espera también en Vertex **(por confirmar)** | Vertex AI, *Content Credentials* (act. 2026-09-25); Gemini API, *Image generation* (act. 2026-09-23) |
| `microsoft/mai-image-2.6` en Azure | **No documentado** | **No documentada** | Microsoft Learn, *Content provenance* (act. 2026-09-17/23). La tabla solo nombra MAI-Image-2.5, 2.5-Flash, 2e y 2.5-Pro. **2.6 no aparece** |

**Lo que el piloto dice de los ficheros**: Gemini devolvió JPEG (20 de 20, 1200 × 896,
mediana de 182 KB y máximo de 227 KB). MAI devolvió PNG (18, 1024 × 768, mediana de
1,3 MB). El piloto solo guardó WebP recodificados, así que **no se puede saber** si el
C2PA de Google llegó a través de OpenRouter.

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

1. **Medir antes de construir** (backend, una llamada, ~0,034 $): mirar si la primera
   respuesta real de Gemini por OpenRouter, antes de pasar por `sharp`, lleva la caja C2PA
   (JUMBF, etiqueta `c2pa`). Por ejemplo con `c2patool` o buscando `jumb`/`c2pa` en los
   bytes. **No afirmo ni una cosa ni la otra**: el resultado decide el paso 2.
2. **Si el C2PA llega**: guardar en Blob y **servir el JPEG de Gemini tal como llega**,
   sin recodificar ni añadir metadatos (tocar un byte invalida el manifiesto). Usar el
   mismo fichero en la imagen grande (4:3) y en la tarjeta (16:9, recortada con CSS). Las
   dos capas de Google llegan intactas a quien vea la imagen, y cualquier visor C2PA o la
   verificación de Google la detectan. Cuesta ~70 KB más por imagen que el WebP del piloto
   (mediana de 108 KB). Es la vía más barata que cumple el Código.
3. **Si el C2PA no llega**: queda SynthID, más el campo IPTC de metadatos (§ 2.4) en el
   fichero que se sirva. Es una capa sólida y otra que no está firmada: por debajo del
   Código, pero defendible como «technically feasible» y proporcionado al coste
   (art. 50.2; Directrices, apdos. 81 y 85) **[abogado]**. La alternativa completa es que
   NutrIA firme su propio manifiesto C2PA tras recodificar (biblioteca abierta
   `c2pa-node`/`c2pa-rs`, con el manifiesto de Google como ingrediente si existe). Necesita
   un certificado de firma. Lo dejo como P2 con fecha: al revisar el Código o si un
   abogado lo pide.
4. **Si hace falta un tamaño menor** para la tarjeta, derivarlo con `sharp` y escribir en
   él el campo IPTC (§ 2.4). La imagen grande sigue siendo el original.
5. **MAI-Image-2.6, fuera de producción** hasta que (a) Microsoft lo incluya en su tabla
   de procedencia, o (b) la medición del paso 1 muestre C2PA y marca de agua en sus
   respuestas. Mientras tanto, una imagen de MAI no llevaría ninguna marca firmada ni
   marca de agua, y NutrIA tendría que poner las dos, incluida una marca de agua propia:
   un trabajo desproporcionado para un modelo de respaldo. El PRD ya admite que un plato se
   quede sin imagen, y en el piloto Gemini no falló ninguna de 20. **Es una decisión de
   producto del propietario**: si quiere MAI, el coste es la marca de agua propia.

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

Sin marca de esquina en la imagen grande: el pie está justo debajo y es visible en la
misma pantalla. Si `frontend` quiere la misma marca que en la tarjeta por coherencia, puede
ponerla, pero el pie se queda.

### 3.2 La tarjeta del panel («Lo siguiente», 16:9)

| Clave | Dónde | es-ES | en-GB |
| --- | --- | --- | --- |
| `dashboard.pictureMark` | Texto visible de la marca, superpuesta en la esquina superior derecha de la imagen (`NextMeal.tsx:58-62`) | `IA` | `AI` |
| `dashboard.pictureMarkLabel` | Nombre accesible de la marca | `Imagen generada por IA` | `AI-generated image` |

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
| Dibujar la imagen | **Ninguno.** El prompt se hace solo con la receta: nombre, ingredientes ordenados por peso con su proporción en palabras («most of the plate»…), y el estilo fijo (piloto, `buildPrompt`; PRD, criterio 4). Nada del usuario, del perfil, de alergias ni de salud. Tampoco quién la pidió ni cuándo | OpenRouter → Google (Vertex, `google-vertex/global`) o Microsoft (Azure), con ZDR y sin respaldo |
| Juez de visión | **Ninguno**: la imagen y la lista de la receta | OpenRouter → DeepInfra (ya nombrada) |
| Guardar | Ninguno: la imagen y sus metadatos técnicos (modelo, versión del prompt, tamaño) | Vercel Blob; `recipe_images` en Neon |
| Ver la imagen | La IP y el navegador de quien la carga, que llegan a la red de Vercel | Vercel (ya encargado) |

**Consecuencias**:

- Google y Microsoft no reciben datos personales. No son encargados de NutrIA (art. 28
  RGPD) ni «destinatarios» en el sentido del art. 13.1.e, y el envío no es una
  transferencia del capítulo V. **No se añaden** a «Transferencias», porque darían a
  entender que salen datos personales. **Sí se nombran** en «La inteligencia artificial»,
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
- **Registro y EIPD**: no hay actividad nueva con datos personales. El registro añade la
  entrega por Vercel Blob a la fila 2, y la EIPD una nota (hecho en este mismo cambio).

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
| `Las imágenes de los platos las genera otro modelo, a partir solo de la receta: su nombre, sus ingredientes y en qué proporción. Nunca recibe nada tuyo, ni siquiera quién ha abierto el plato. La petición va a OpenRouter, que la pasa a Google (Vertex AI) o, si no responde, a Microsoft (Azure), y un modelo de DeepInfra comprueba que la imagen no muestra alimentos que la receta no lleva. Ninguno guarda la petición ni la usa para entrenar. Las imágenes se guardan en Vercel, se muestran a todas las personas que ven ese plato y llevan la marca «IA»; los ficheros llevan además una marca invisible y legible por máquina que dice que están generados por IA.` | `The pictures of the dishes are generated by another model, from the recipe alone: its name, its ingredients and in what proportion. It never receives anything of yours, not even who opened the dish. The request goes to OpenRouter, which passes it to Google (Vertex AI) or, if it does not answer, to Microsoft (Azure), and a model run by DeepInfra checks that the picture shows no food the recipe does not contain. None of them keeps the request or trains on it. The pictures are stored on Vercel, shown to everyone who sees that dish, and carry the "AI" mark; the files also carry an invisible, machine-readable mark saying they were generated by AI.` |

Variantes que dependen de lo que se construya (publicar la que sea verdad):

- **Sin MAI** (recomendado, § 2.3.5): quitar «o, si no responde, a Microsoft (Azure)» /
  «or, if it does not answer, to Microsoft (Azure)».
- **Si la marca invisible no es verdad para todos los ficheros** (el C2PA no llega y la
  tarjeta usa un derivado sin SynthID; no debería pasar, porque SynthID sobrevive al
  reescalado): cambiar la última frase por «…y llevan la marca «IA».» / «…and carry the
  "AI" mark.»

<!-- Fuente: RGPD arts. 5.1.a y 13.1.e (sin datos personales no hay destinatario que informar; se nombra por lealtad y por la promesa en vigor); PRD 006, criterios 3-4; prompt del piloto (`buildPrompt`: nombre y proporciones, sin datos del usuario); `0003` §§ 5.3, 6.2, 7.1; OpenRouter `provider.only` = `google-vertex/global` / `azure` / `deepinfra`, `allow_fallbacks: false`, ZDR (metadatos del piloto). Marca invisible: Vertex AI, Content Credentials (act. 2026-09-25) y Gemini API, «All generated images include a SynthID watermark» (act. 2026-09-23). Ley de IA art. 50.2 y 50.5 (quien quiera comprobarlo sabe que puede). «Se muestran a todas las personas que ven ese plato»: la imagen es de la receta, compartida (PRD, Outcome); así nadie cree que su imagen dice algo de él. -->

**c) «Con quién compartimos tus datos», línea de Vercel** (`es-ES.ts:1373`; `en-GB.ts`,
equivalente):

| es-ES | en-GB |
| --- | --- |
| `Vercel (alojamiento de la web, la API y las imágenes de los platos, en la Unión Europea) y Neon (base de datos, en la Unión Europea). Son empresas de Estados Unidos.` | `Vercel (hosting for the website, the API and the pictures of the dishes, in the European Union) and Neon (database, in the European Union). Both are US companies.` |

<!-- Fuente: RGPD art. 13.1.e; Vercel Blob (región elegible al crear el almacén, docs act. 2026-08-26): la frase «en la Unión Europea» solo es verdad si el almacén se crea en `fra1` (§ 6). -->

**d) «Transferencias»**: sin cambios (§ 4.1).

---

## 5. Riesgos, ordenados por lo que le puede pasar a una persona

| # | Qué puede pasar | Gravedad | Qué lo evita |
| --- | --- | --- | --- |
| IMG-1 | Una persona alérgica ve una foto sin el alimento que le hace daño, aunque el plato lo lleve (una salsa, un aceite de sésamo «cocinado dentro»), y se fía de la foto | **P1** (daño a la salud, aunque la lista esté bien) | La puerta de alérgenos es código contra la lista, no contra la imagen (`0004`). El pie dice «manda la lista de ingredientes». Las condiciones lo dicen (§ 3.3). El juez solo rechaza lo que **sobra**, no lo que falta: el pie es la medida |
| IMG-2 | La foto muestra un alimento con alérgeno que el plato no lleva (nueces en un plato sin nueces) | P2 (confusión, desconfianza, no exposición) | El juez de visión (PRD, criterio 6) |
| IMG-3 | Una imagen de MAI llega a alguien sin marca legible por máquina | **P1** (art. 50.2 incumplido) | MAI fuera (§ 2.3.5) |
| IMG-4 | La tarjeta del panel muestra la imagen sin aviso | **P1** (art. 50.4-50.5) | `dashboard.pictureMark` (§ 3.2) |
| IMG-5 | La política dice que no se usa Google y Google dibuja | **P1** (texto que se leería falso) | § 4.2 a |
| IMG-6 | El almacén se crea fuera de la UE y la política dice «en la Unión Europea» | P1 (texto falso sobre IP de visitantes) | `fra1` (§ 6) |
| IMG-7 | Una ruta pública de Blob lleva un id de usuario | P1 (dato personal expuesto a cualquiera con el enlace) | Solo el id de la receta y un hash (§ 4.1) |
| IMG-8 | Recodificar borra el C2PA de Google | P2 (queda SynthID) | Servir el original (§ 2.3.2) |
| IMG-9 | No haber leído las condiciones de Google Cloud (IA generativa) ni de Microsoft para estos modelos | P2 (licencia de uso) | Leerlas antes de encender (§ 6). **No las he leído**; la cláusula de «práctica clínica» de P1-10 era de la API de Gemini, y aquí no hay uso clínico: son fotos de recetas |

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
- (c) Si el C2PA no llega por OpenRouter: ¿basta SynthID más un IPTC sin firmar, o hace
  falta que NutrIA firme su propio manifiesto?

## Fuentes (versión consultada el 2026-09-27)

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
