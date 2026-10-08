# Checklist de activación

> **Propósito**: lo que tiene que ser verdad antes de encender el flag `professional` y
> antes de poner claves *live* de Stripe. Cada casilla remite al hallazgo del
> [`analisis.md` § 9](./analisis.md#9-riesgos-ordenados-por-lo-que-le-puede-pasar-a-una-persona-real).
> **Audiencia**: el propietario y el lead. **Committed**: sí. **Mantenido por**: el agente
> `legal`.
>
> **No soy abogado.** Esta lista no sustituye la hora con uno: la última casilla de cada
> bloque es esa hora.

## 0. Ya, con independencia de cualquier flag (afecta a producción)

> Marcadas: hechas en la tanda legal-a (backend `1a3742b`, frontend `d036c40`), revisadas contra el código el 2026-09-25; cuentan cuando se fusionen juntas y se aplique la migración `0039`. P0-3 queda cerrada en lo sustancial (ver `analisis.md` § 9).

- [x] **P0-3** — La combinación de modelos solo con proveedores sin entrenamiento y con contrato (o sin texto libre ni etiquetas religiosas en el prompt). El propietario anota qué modelos sirven hoy.
- [x] **P0-2** — Consentimiento explícito del perfil construido, pedido también a las cuentas existentes ([`textos/05`](./textos/05-consentimientos-cliente.md) § A).
- [x] **P1-4** — Puerta de edad (**18**, decisión del propietario de 2026-09-25) en el servidor. Comprobar en la base de datos si hay cuentas con menos de 18 años: con menos de 14, P0 (su consentimiento de salud no vale: borrar sus datos de salud y avisar); de 14 a 17, avisar de que el servicio pasa a ser para mayores de edad y cerrar la cuenta con tiempo para que se lleven sus datos.
- [ ] **P1-6** — Exportaciones manuales cifradas, en disco cifrado, borradas a los 30 días; las antiguas sin cifrar, borradas.
- [ ] **EIPD** revisada y firmada por el propietario ([`eipd.md`](./eipd.md) § 7).
- [ ] Política de privacidad nueva publicada solo con las frases cuyo ⟦requisito⟧ se cumple ([`textos/02`](./textos/02-politica-privacidad.md)); correo de aviso de cambio enviado antes ([`textos/06`](./textos/06-correos.md) § F).

## 0 quater. Antes de publicar «se borra a los 12 meses» en `/privacidad` (proyecto 011)

- [ ] La purga diaria de `audit_logs` (`action LIKE 'auth.%'`, `createdAt` de más de 12 meses) está en producción: fase 7 del 011, en el cron diario de fallos de inicio de sesión. Con prueba de que no borra filas de administración (`analisis.md` § 4.1 bis). Solo entonces se publica la frase marcada ⟦si purga-seguridad⟧ de [`textos/02`](./textos/02-politica-privacidad.md). Hasta entonces la política dice solo «mientras exista tu cuenta».

## 0 quinquies. Antes de llevar a producción el alta que no revela nada (proyecto 011 fase 8, PR #217)

- [ ] La viñeta ⟦frenos⟧ y la frase de interés legítimo de [`textos/02`](./textos/02-politica-privacidad.md) en `privacy` (es-ES y en-GB), **en el mismo cambio** (P2-14). Si se publica otro día que el 3 de octubre de 2026, `privacy.updated` con esa fecha. Sin correo de aviso.
- [ ] `requireEmailVerification: true` no sale antes de que el propietario haya visto, en lectura, cuántas cuentas de producción no han confirmado su dirección (lo pide el PLAN). Recomendado, no exigido: escribirles una vez con un enlace antes de encenderlo.
- [ ] (P3, no bloquea) Las dos frases de la web que el presupuesto puede volver falsas (`auth.signUpSent`, `auth.invalidCredentials`) y la frase nueva del correo § O de [`textos/06`](./textos/06-correos.md) (`analisis.md` § 9, P3).
- [ ] `/condiciones` **no** cambia: el contrato se sigue celebrando al pulsar; si alguien quiere decir allí que hay que confirmar el correo, sube `TERMS_VERSION` (`0071`).

## 0 bis. Antes de poner `AI_PROVIDER=openrouter` en producción (`0064`)

> Producción corre con `AI_PROVIDER=stub` desde el 2026-09-26: no sale nada a ningún
> modelo. Estas casillas son del propietario salvo donde se dice. Detalle y fuentes en
> [`analisis.md` § 4.4](./analisis.md#44-openrouter-y-quien-ejecuta-el-modelo-2026-09-26-para-el-cambio-de-0064).

**Ya, aunque no se cambie nada**
- [ ] `/privacidad` con el **estado 1** de «La inteligencia artificial», «Con quién compartimos» y «Transferencias» ([`textos/02`](./textos/02-politica-privacidad.md)): el texto en vivo dice que «hoy» se usan modelos gratuitos que pueden entrenar, y desde el 2026-09-26 no se usa ninguno (frontend).

**Contrato y cuenta — bloquean el cambio**
- [ ] **P1-11** — DPA de OpenRouter: pedir acceso en `trust.openrouter.ai`, descargar el DPA y la lista de subencargados; pedir a soporte, por escrito, que confirme que el DPA que su § 10.2 incorpora «for commercial, for-profit purposes» se aplica a esta cuenta de pago y que incluye las cláusulas tipo. Guardar ambos, con fecha, fuera del repositorio. Si la respuesta es que no: parar y volver a `legal`.
- [x] **P1-12** — Hecho el 2026-09-26 (propietario): en la cuenta (ajustes de privacidad), *Allowed providers* = DeepInfra y CoreWeave. Pendiente solo la comprobación de después: Comprobar después en `/api/v1/models/deepseek/deepseek-v4.1-flash/endpoints` y en `/admin` que las primeras llamadas las responden solo esas. Si se permite otra empresa, se nombra en la política antes.
- [ ] Ajustes del runbook [`ai-gateway.md` § 0](../reference/ai-gateway.md): entrenamiento **apagado** para modelos de pago y gratuitos; ZDR **encendido** para toda la cuenta; «OpenRouter use of inputs/outputs» **apagado**; registro de prompts (*logging*) **apagado**; la clave con solo los dos modelos, ZDR y tope mensual. Una captura de cada ajuste, fechada, fuera del repositorio (art. 5.2: poder demostrarlo).
- [x] **P1-13** — Cerrado el 2026-09-26: el propietario quitó MiniMax M3; Gemma 4 31B (`google/gemma-4-31b-it`) es el principal y DeepSeek V4.1 Flash la reserva (decisión del 2026-09-26); Gemma es Apache 2.0, sin aviso, atribución ni restricciones que trasladar (`analisis.md` § 4.4 d). La clave debe admitir ese modelo y no `:free`.
- [x] (backend) `provider.only` en cada petición desde `AI_PROVIDER_ONLY`, obligatorio al arrancar con `openrouter` (`apps/api/src/config/Env.validation.ts:506-507`). Valor: `deepinfra,coreweave`.
- [x] **P2-12** — Decidido el 2026-09-26: el propietario acepta la categorización anónima con aviso en la política (estado 2).
- [ ] El propietario pide por escrito a OpenRouter que excluya su cuenta de la categorización y guarda la respuesta fuera del repositorio. No bloquea: si la excluye, la frase de la política puede quitarse.

**Textos — en este orden**
1. [ ] `/privacidad` con el **estado 2** (frontend), con `updated` nuevo, cuando las casillas anteriores estén marcadas.
2. [ ] El mismo día, el correo [`textos/06`](./textos/06-correos.md) § G a cada cuenta (la política vigente promete avisar por correo antes de un cambio importante).
3. [ ] `AI_PROVIDER=openrouter` **no antes del día siguiente** al correo.

**Después**
- [ ] En la primera quincena, mirar en `/admin` qué proveedor respondió cada llamada; uno que no esté en la lista es un incidente (el texto sería falso): volver a `stub` y registrarlo ([`procedimiento-brechas.md`](./procedimiento-brechas.md) § 8).
- [ ] Cada cambio de `AI_MODEL`, `AI_FALLBACK_MODELS` o de la lista de proveedores permitidos pasa antes por la política.

## 0 ter. Antes de encender el flag de las imágenes de los platos (proyecto 006)

> Detalle, fuentes y el porqué de cada casilla en [`imagenes-de-platos.md`](./imagenes-de-platos.md).
> El art. 50 de la Ley de IA se aplica **el mismo día** en que se encienda: sin periodo de
> gracia (§ 1.1 de ese documento).

**Marca legible por máquina (art. 50.2)**
- [x] (backend) Medido el 2026-09-27 con 8 respuestas reales de Gemini por OpenRouter, antes de cualquier proceso: las 8 llevan el C2PA firmado por Google (con la acción SynthID) y el XMP IPTC `trainedAlgorithmicMedia`.
- [x] (backend) El fichero que se guarda y se sirve es el JPEG de Gemini **sin tocar**.
- [ ] Validar una vez la firma C2PA (`c2patool` o el verificador de Content Credentials) sobre un fichero **tal como lo sirve Blob** en producción; si no valida, a `legal`. No bloquea (P3).
- [ ] (backend) Cualquier variante recodificada lleva el XMP IPTC; ningún fichero lleva un id de usuario, ni en los metadatos ni en la ruta de Blob.
- [x] (propietario) **MAI-Image-2.6 fuera** (decidido el 2026-09-27): solo Gemini en Vertex. Otro modelo, si vuelve, repite antes [`imagenes-de-platos.md`](./imagenes-de-platos.md) § 2 y entra antes en la política.

**Aviso visible (art. 50.4 y 50.5)**
- [x] (frontend) Pie `meal.pictureCaption` y `alt` `meal.pictureOf` en la página de la comida, en los dos idiomas. — En `main` (`abc0a90`): `es-ES.ts` y `en-GB.ts`, `meal.pictureCaption` y `meal.pictureOf`; `MealPicture.tsx:71-73`.
- [ ] (frontend + accessibility) Marca `picture.aiMark` («IA»/«AI») en la esquina superior derecha de la imagen, en la tarjeta y en la imagen grande, visible sin interacción, 4,5:1 sobre cualquier foto, con nombre accesible `picture.aiMarkLabel`; sin marca en el plato de reserva.
- [ ] Ningún otro sitio muestra la imagen sin su aviso (filas del plan, consulta, correos, notificaciones, vista previa al compartir). Si se añade uno, lleva la marca.

**Privacidad y textos**
- [x] (propietario) Almacén de Vercel Blob creado en **`fra1`** (no se puede cambiar después). — Según `docs/reference/deployment.md:95`; `legal` no lo ha visto en Vercel: el propietario lo confirma en el panel (Storage → el almacén → región).
- [x] (propietario) **Segundo almacén**, el de las imágenes rechazadas que esperan al propietario (proyecto 009 fase 2, `0072`): `nutria-picture-candidates`, **privado** y en **`fra1`**, creado el **2026-09-30** y conectado solo a Producción del proyecto de la API como `BLOB_CANDIDATES_READ_WRITE_TOKEN`. — Según `docs/reference/deployment.md:96` y el lead; `legal` no lo ha visto en Vercel: el propietario confirma en el panel las dos cosas que no se pueden cambiar después, **Private** y **`fra1`**. Si no fuera privado, una imagen rechazada tendría dirección pública (IMG-10); si no estuviera en `fra1`, «en la Unión Europea» dejaría de ser verdad en `/privacidad`. Detalle en [`imagenes-de-platos.md`](./imagenes-de-platos.md) § 4.3.
- [x] (frontend) `/privacidad`: cambios a, b y c del § 4.2, con `privacy.updated` nuevo, publicados antes del flag o el mismo día. Sin Microsoft (MAI fuera). — En `main` (`abc0a90`): los tres párrafos están en `es-ES.ts` y `en-GB.ts` (namespace `privacy`), con «Última actualización: 29 de septiembre de 2026». La fase 2 del 009 no los toca ([`imagenes-de-platos.md`](./imagenes-de-platos.md) § 4.3); **la fase 3 sí cambia una frase** (casillas de abajo).
- [x] (frontend) `/condiciones`: la frase del § 3.3, con `terms.updated` nuevo. — En `main` (`abc0a90`): namespace `terms` de `es-ES.ts` y `en-GB.ts`, con «Última actualización: 29 de septiembre de 2026».
- [ ] (propietario) Leídas las condiciones de Google Cloud para IA generativa (Vertex). Cualquier cláusula que choque, a `legal` (IMG-9).
- [ ] `legal` revisa el código construido contra este documento, porque hoy describe un plan, no código. — Hecho solo para lo que añaden las fases 2 y 3 del 009 (la imagen rechazada guardada, § 1.6 y § 4.3; aceptarla a mano y retirarla, § 1.7 y § 4.4; 2026-09-30), para lo que añade la fase 4 del 010 (retirar cualquier imagen publicada, § 4.4; 2026-09-30, leída contra el árbol de la fase 4 y comprobada después en `main`, `28854ac`), para la regla de la forma propia de la fase 2 del 010 (§ 4.6; 2026-09-30, contra el árbol de trabajo de `main` sobre `28854ac`, sin commit, ya endurecida) y para las casillas de arriba que llevan su fuente. El resto del 006 (la marca en cada pantalla, el contraste, las rutas del almacén público) sigue sin revisar.

**Aceptar a mano una imagen que el juez rechazó (proyecto 009 fase 3, `0072`)**

> La función no tiene flag propio: existe en cuanto se despliega, para la sesión del
> propietario. El único interruptor que la frena es el de las imágenes (`dishPictures`:
> apagado, aceptar se rechaza; retirar funciona siempre), y ese ya está encendido en
> producción desde el 2026-09-28. Lo que sigue tiene que ser verdad **antes de la primera aceptación**, y esa
> solo puede hacerla él. Detalle en [`imagenes-de-platos.md`](./imagenes-de-platos.md)
> § 1.7, § 4.2 b y § 4.4.

- [x] (propietario) **Decidido el 2026-09-30**: la frase de `/privacidad` sobre el juez cambia al **texto A** del § 4.2 b, en el mismo cambio que el botón de aceptar, con `privacy.updated` = 30 de septiembre de 2026.
- [x] (frontend) `/privacidad` con la frase nueva en `es-ES` y `en-GB`, y `privacy.updated` = 30 de septiembre de 2026, **en el mismo cambio** que trae el botón de aceptar. Sin correo previo: no cambia qué datos se tratan ni con quién. — Comprobado el 2026-09-30 en el árbol de trabajo de `main` (`es-ES.ts:2288` y `:2359`; `en-GB.ts:2243` y `:2314`), letra por letra; cuenta cuando se fusione y se despliegue.
- [ ] (propietario) **No aceptar ninguna imagen a mano hasta ver la frase nueva en `/privacidad` en producción** (IMG-15).
- [x] (frontend) Redacción del aviso de aceptar y del diálogo de retirar: lo que «Retirar» no deshace (copias en caché), dónde borrar un fichero que no se pudo borrar y la viñeta de lo que el revisor no mira ([`imagenes-de-platos.md`](./imagenes-de-platos.md) § 4.4). — Comprobado el 2026-09-30 en el árbol de trabajo de `main` (`adminPictureReview`: `acceptEffects`, `removeBody`, `removeLeftover`, en los dos idiomas), letra por letra. Queda un P3 en una cadena nueva, `publishedLoadFailed` («retírala para que el plato vuelva a dibujarse»: retirar no lo dibuja); no bloquea.
- ~~(propietario, opcional) `/condiciones`: «…o mostrar algo que el plato no lleva»~~ — **no se toma** (propietario, 2026-09-30): `/condiciones` no cambia. La frase actual sigue siendo verdad (§ 4.4).
- [ ] (propietario) En la verificación de la fase —aceptar una, verla en el plato, retirarla—, comprobar que la imagen aceptada lleva la marca «IA» en la tarjeta y en la página de la comida, y el pie en esta; y, una vez, pasar por `c2patool` o el verificador de Content Credentials un fichero **aceptado a mano** tal como lo sirve Blob (ha pasado por dos almacenes; la firma no se valida en el código, § 1.7). Si no valida, retirar y a `legal`.
- [x] (backend) El borrado fallido del almacén público ya no escribe la dirección del fichero en el registro (IMG-13). — Comprobado el 2026-09-30 en el árbol de trabajo de `main`: `VercelBlobPictureStore.ts:43-54` y `:89-97` sustituyen la dirección y la ruta por `[picture]` y lanzan sin `cause`, también en `put`; spec en `VercelBlobPictureStore.spec.ts:99-125`.
- [x] ~~Conocido y fuera de alcance (propietario, 2026-09-30; LOG del 009): una imagen que el **juez** aceptó por error no se puede retirar, solo las aceptadas a mano (IMG-16).~~ — **Cerrado por el 010 fase 4** (2026-09-30): «Retirar» vale para cualquier imagen publicada, la aceptara el juez o el propietario (`RecipeRepository.ts:1041` en `main`: `status = 'ready'` y nada más; PRD 010, criterio 9; `0073`). Una aceptación mala del juez se quita desde su página en la consola, sin migración; cada retirada deja una fila `picture.removed` con `acceptedBy` (`judge` u `owner`) y nada sobre una persona ([`imagenes-de-platos.md`](./imagenes-de-platos.md) § 4.4 y § 5, IMG-16). Fusionado en `28854ac` (#178) y desplegado, según el lead. Alcanza también a las imágenes que el juez acepte por la forma propia (010 fase 2): la regla nueva no reabre IMG-16.
- [ ] (propietario) Cada cierto tiempo, mirar el recuento «aceptadas a mano» en Imágenes y repasar esas imágenes desde el filtro de Recetas; una que ya no convenza, retirarla. Desde el 010 fase 4, lo mismo con una que aceptó el juez: «Revisar la imagen» en su fila de Recetas y «Retirar». Ningún código señala una imagen que el juez aceptó mal; hace falta verla.

**La forma propia del plato (proyecto 010 fase 2, `0073`)**

> La regla no tiene flag: llega a producción con el despliegue. No toca datos personales,
> el fichero, su C2PA, la marca «IA» ni el pie. Detalle en
> [`imagenes-de-platos.md`](./imagenes-de-platos.md) § 4.6.

- [x] (propietario) **Decidir la frase del juez en `/privacidad`** — **decidido (b) el 2026-09-30** («Mete la cláusula de privacidad»); va con la fase 2 del 010. (P2, no bloquea): (a) dejarla, o (b) añadir la cláusula del § 4.6 («…; no cuenta lo que tiene la forma de algo que el plato ya tiene o que su nombre dice, como su pan o su leche, porque una imagen no muestra de qué está hecho»). `legal` recomienda (b). Si se toma: `privacy` en `es-ES.ts` y `en-GB.ts` y [`textos/02`](./textos/02-politica-privacidad.md), con `privacy.updated` del día en que llegue a producción; sin correo previo. Puede ir en el mismo despliegue que la regla o después.
- [ ] (propietario) Tras el despliegue, en la relectura de producción de la fase 6, buscar las imágenes cuya nota lleva `own_form:` (solo con una consulta de lectura sobre `recipe_images.provenance`: ninguna pantalla la enseña) y mirarlas; una que muestre un segundo alimento con alérgeno, «Retirar».

## 1. Antes de encender `professional`

**Código**
- [ ] **P0-1** — El cliente puede activar y desactivar la línea de salud desde su perfil sin terminar el enlace; cada cambio deja fila en el rastro; desactivar cierra el acceso en la siguiente petición. Test de extremo a extremo que la retira a mitad de sesión.
- [ ] **P1-1** — Aceptación del profesional: `PROFESSIONAL_AGREEMENT_VERSION`, columnas en `professionals`, `ProfessionalGuard` la exige, `POST /care/practice/agreement`, pantalla en `/consulta` ([`analisis.md` § 11](./analisis.md#11-lo-que-hay-que-construir-para-el-004-y-quién)). Test: un profesional sin aceptar recibe 404 en toda ruta de clientes y en la compra.
- [ ] **011 fase 6** — Antes de que un profesional real acepte el acuerdo: (backend) activar la verificación en dos pasos cierra las demás sesiones de la cuenta, con prueba de extremo a extremo — **hecho** en la fase 6 (`168f12f0`, PR #214; [`eipd.md`](./eipd.md) R8 b); (backend + frontend) acuerdo § 8 con la viñeta ⟦dos-pasos-obligatoria⟧ y `PROFESSIONAL_AGREEMENT_VERSION = '1.1.0'` ([`textos/01`](./textos/01-acuerdo-profesional.md)) — **hecho** en la fase 6 (`44924577`, PR #214). La casilla se marca cuando el PR esté fusionado y desplegado.
- [ ] **P1-3** — Página de invitación con los textos nuevos; `CARE_CONSENT_VERSION = '2.0.0'`; ningún enlace real aceptado con `1.0.0`.
- [ ] **P1-2** — Correo de invitación con el párrafo del art. 14.
- [ ] Correo de alta al profesional ([`textos/06`](./textos/06-correos.md) § B).
- [x] **P1-10 — cerrado** (2026-09-26): producción no usa ningún modelo (`stub`) y el cambio de `0064` no tiene Gemini (la clave solo admite Gemma 4 31B y DeepSeek V4.1 Flash, sin cláusula de uso clínico; Gemma 4 no es la API de Gemini). Se reabre si vuelve `AI_PROVIDER=google` o un modelo de Google a la clave.
- [ ] `HEALTH_CONSENT_VERSION = '1.1.0'` con la nota precisada (`05` § C).

**Textos**
- [ ] Acuerdo del profesional y condiciones de consulta en `practiceAgreement` (es y en), con `{name}`/`{email}` y sin identidad en el diccionario.
- [ ] Política con la sección «Tu dietista en NutrIA» y el reparto de responsabilidades visible (art. 26.2, por si acaso).
- [ ] Condiciones de uso § F y § G.

**Organización**
- [ ] El propietario comprueba cada número de colegiado en el registro público del colegio correspondiente antes de conceder, y anota la fecha de la comprobación.
- [ ] **Procedimiento de brechas** — escrito en [`procedimiento-brechas.md`](./procedimiento-brechas.md). Se marca cuando el propietario haya rellenado fuera del repositorio cada ⟦…⟧ (§ 9: acceso a la sede de la AEPD, cuentas de los proveedores, dispositivos, pasarela, dónde vive el registro) y lo haya **firmado y fechado**.
- [ ] Hora con el abogado: puntos 1, 3 y 9 del [`analisis.md` § 10](./analisis.md#10-confirmar-con-un-abogado).

**Orden de encendido** (decisión del lead, 2026-09-25: primero el interruptor, después las concesiones — el correo de alta enlaza a `/consulta`, que solo funciona con el interruptor encendido, y un interruptor sin concesiones no enseña nada a nadie)

1. [ ] **Recuento de enlaces con el consentimiento antiguo**: el lead ejecuta en producción, **solo lectura**, el número de `care_links` con `consentVersion = '1.0.0'` (por estado: `active`, `paused`, `ended`). No se lee nada más de esas filas.
2. [ ] **El propietario decide sobre ellos** antes de encender: un enlace `1.0.0` se aceptó con una invitación que prometía un control que no existía (P0-1) y no decía que el profesional podía escribir y retener planes (P1-3). Lo recomendable es terminar los `active`/`paused` (`endedBy = professional` si son pruebas del propio propietario) y volver a invitar con la versión `2.0.0`; conservar un `1.0.0` activo es tratar datos de salud con un consentimiento no informado. Los `ended` se quedan: son la prueba de lo que se consintió. Anotar la decisión y la fecha.
3. [ ] Todo lo anterior de este § 1 marcado, en particular P1-1: la aceptación del acuerdo tiene que estar en producción **antes** de que exista la primera concesión, para que nadie vea un dato sin haber aceptado.
4. [ ] **Encender el interruptor `professional`** en `/admin`. Sin concesiones, nadie ve nada nuevo.
5. [ ] **Conceder** a cada profesional, uno a uno, tras comprobar su número de colegiado (casilla de «Organización»). La concesión envía el correo de alta, y su enlace a `/consulta` lleva al acuerdo antes que a nada.

## 2. Antes de claves *live* de Stripe (Premium y consulta)

**Identidad y alta**
- [ ] Alta censal (036) y, si procede, RETA — con un gestor.
- [ ] `legalIdentity.ts` con `address`, `taxId`, `phone`, rellenado por el propietario; decidido si el domicilio es el personal o uno profesional.
- [ ] **P1-7** — Página `/aviso-legal` publicada ([`textos/07`](./textos/07-aviso-legal.md)) y enlazada en el pie; cauce de reclamaciones postal, telefónico y electrónico, con justificante y respuesta en 15 días (TRLGDCU art. 21.2-3).
- [ ] Decidido *Managed Payments* sí o no (Link como vendedor), con el gestor y el abogado; los textos usan la variante que toca.

**Consumidor (Premium)**
- [ ] **P1-8** — Condiciones con el desistimiento y el formulario modelo; botón «Desistir del contrato aquí» durante 14 días; acuse inmediato por correo ([`textos/06`](./textos/06-correos.md) § C); reembolso en 14 días.
- [ ] **P2-7** — Aviso de renovación anual 15 días antes (Stripe o plantilla propia).
- [ ] **P2-6** — Checkout con aceptación de condiciones (`consent_collection.terms_of_service`) y URLs de condiciones y privacidad en los ajustes de Checkout de Stripe.
- [ ] El precio mostrado antes de pagar incluye impuestos y el total por periodo (TRLGDCU art. 97.1.e); el botón final de Stripe deja claro que hay obligación de pago (art. 98.2) — revisar el rótulo con prueba gratuita **[abogado]**.
- [ ] **P2-2** — Se guarda la versión de las condiciones aceptada al registrarse (proyecto 008, fase 7; [nota D5](./2026-09-29-aceptacion-de-los-textos-legales.md) § 5), y el aviso se ve junto al botón de Google en `/registro` y `/acceder`.

**Profesional (consulta)**
- [ ] **P1-9** — Condiciones de consulta aceptadas antes de pagar (misma pantalla que el acuerdo); `practice.planTrial` dice que se cobra al terminar la prueba.
- [ ] Recogida de datos fiscales para factura (`tax_id_collection`) si el gestor lo pide.

**Hora con el abogado**
- [ ] Puntos 4, 5, 6 y 7 del [`analisis.md` § 10](./analisis.md#10-confirmar-con-un-abogado).

## 3. Con fecha

- [ ] **2/12/2026** — Art. 50.2 Ley de IA: recetas marcadas como generadas por IA en formato legible por máquina (P2-8).
- [ ] **30 días después de desplegar el aviso de cuenta esperando sin dirección** (enmienda de `0029`, 2026-09-29) — quitar `GET /admin/activate` y `ActivationLink.ts` (ya no queda ningún token válido), y el propietario borra del buzón y de la papelera los avisos antiguos que llevan la dirección de cada alta (arts. 5.1.e y 32; [adenda](./2026-09-29-correos-al-propietario.md#adenda-2026-09-29-tarde-el-aviso-de-cuenta-esperando-resuelto-y-un-cuarto-aviso) § 3).
- [ ] Cada año, o al superar unos miles de cuentas con salud — revisar EIPD, RAT y la necesidad de DPD.
