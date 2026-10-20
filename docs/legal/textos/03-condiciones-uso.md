# Condiciones de uso — cambios

> **No soy abogado.** Borrador para el producto.
>
> **Propósito**: los cambios de las condiciones de uso para consumidores. **Audiencia**: `frontend` (diccionarios), `backend` (almacenamiento y versión), el propietario y el abogado. **Committed**: sí. **Mantenido por**: el agente `legal`; lo aprueban el propietario y el abogado.
>
> **Dónde va**: namespace `terms` de `es-ES.ts` (líneas 1385-1487 hoy) y `en-GB.ts`;
> página `/condiciones`. Solo se reescriben las secciones indicadas; el resto queda como
> está. Actualizar `terms.updated`.
>
> **Versión**: hoy no se guarda qué versión de las condiciones aceptó cada cuenta (P2-2).
> **Decidido el 2026-09-29 (D5)**: `TERMS_VERSION = '2.0.0'` en `packages/core` y dos
> columnas nulas en `user` (`termsVersion`, `termsAcceptedAt`), escritas por el servidor al
> crear la cuenta; sin tabla nueva ni relleno. La 2.0.0 publica además la sección «Cómo se
> celebra este contrato». Especificación completa en
> [`../2026-09-29-accepting-the-legal-texts.md`](../2026-09-29-accepting-the-legal-texts.md) § 5 y § 6. Las condiciones actuales dicen que un cambio se avisa por
> correo antes de aplicarse (sección «Cambios en estas condiciones»): **este cambio debe
> avisarse por correo a las cuentas existentes** antes de publicarlo.
>
> **2026-10-20 — el propietario no va a enviar correos.** Preguntado ese día por el aviso
> previo que promete la sección «Cambios en estas condiciones», respondió: «no voy a mandar
> correos». Queda anotado, no se vuelve a discutir, y lo que significa y a qué expone está
> en el **§ D bis.2**. La frase de arriba se conserva porque describe lo que las condiciones
> publicadas prometen, no lo que se ha hecho.
>
> **Stripe *Managed Payments***: si sigue activo, Link es el vendedor de la suscripción y
> sus términos rigen el cobro, el reembolso y parte del desistimiento. La sección C tiene
> dos variantes. **[abogado]**: [`analysis.md` § 10, punto 4](../analysis.md#10-to-confirm-with-a-lawyer).

---

## A. El aviso del registro

**Clave**: `auth.legalNotice` (`es-ES.ts:183`) — hoy «Al continuar aceptas las {terms} y la {privacy}.»

| es-ES | en-GB |
| --- | --- |
| `Al crear tu cuenta aceptas las {terms}. Cómo tratamos tus datos te lo explica la {privacy}.` | `By creating your account you accept the {terms}. How we handle your data is explained in the {privacy}.` |

<!-- Fuente: la política de privacidad informa (RGPD art. 13), no se «acepta»: el consentimiento del art. 9.2.a se da aparte y explícito (textos/05 § A). Ley 7/1998 art. 5.1 (las condiciones generales se aceptan). -->

## B. Sección «Quién presta el servicio»

| es-ES | en-GB |
| --- | --- |
| `NutrIA lo presta {name}. Su domicilio, NIF, teléfono y correo están en el {legalNotice}. Para cualquier cuestión sobre estas condiciones, escribe a {email}.` | `NutrIA is provided by {name}. Their address, tax ID, phone and email are in the {legalNotice}. For anything about these terms, write to {email}.` |

`{legalNotice}` enlaza a la página de [`07-aviso-legal.md`](./07-aviso-legal.md).

<!-- Fuente: LSSI art. 10.1.a y e; TRLGDCU art. 97.1.b-c. -->

## C. Sección «Tu cuenta» — primera línea

| es-ES | en-GB |
| --- | --- |
| `Necesitas tener al menos 18 años. Si la fecha de nacimiento que indicas es de alguien menor, no podremos crear tu perfil.` | `You must be at least 18. If the date of birth you give belongs to someone younger, we will not be able to create your profile.` |

Publicar la segunda frase solo con la puerta de edad construida (P1-4).

<!-- Fuente: LOPDGDD art. 7 (14 para consentir: 18 es más estricto y lícito); RGPD art. 8. 18 años por decisión del propietario, 2026-09-25 (antes 16): un plan de adelgazamiento para un menor es el daño que se quiere evitar, y los términos de Gemini exigen 18 a quien usa la API. -->

## D. Sección «El plan gratuito y Premium» — sustituye la `list` y los `paragraphs`

> **Estado al 2026-10-20**: el **párrafo 1 ya está publicado**, con la redacción del
> **§ D bis** —que es la que manda— desde el PR #302 (`3791b07e` en `main`), y con
> `terms.updated` al 19 de octubre de 2026 en los dos idiomas. El **párrafo 2 y la `list`
> siguen siendo borrador**: la página de hoy lleva una lista más corta, sin `{trialDays}`,
> sin el botón de desistimiento y sin el aviso de los 15 días, y no se publica hasta
> Stripe *live* (tanda C).

**paragraphs**:
1. **Publicado el 2026-10-20** — la redacción viva, con sus fuentes, en el § D bis:
   `NutrIA se puede usar gratis, con unos límites en los planes que puedes rehacer, las comidas que puedes cambiar y los eventos de cada plan. Con el plan gratuito ves la quincena que estás viviendo, entera y siempre; las quincenas que ya terminaron se guardan igual, y verlas en la aplicación forma parte de Premium. Guardadas lo están en cualquier caso: puedes pedirnos una copia de tus datos cuando quieras, como explica la política de privacidad. La seguridad alimentaria —alergias, intolerancias y nutrientes— es la misma con Premium y sin él.`
2. **Borrador** (la página dice hoy «Premium, cuando está disponible, amplía esos límites…»):
   `Premium amplía esos límites con una suscripción mensual o anual. Antes de pagar ves el precio total con impuestos y lo que se cobra en cada periodo. El pago lo gestiona Stripe.`

**list** (variante **sin** *Managed Payments*):
1. `La primera vez que contratas Premium tienes una prueba gratuita de {trialDays} días. Te pedimos la tarjeta al empezar y no cobramos nada hasta que acabe. Si la cancelas antes, no pagas nada.`
2. `Al terminar la prueba, y luego al final de cada periodo, la suscripción se renueva y se cobra sola hasta que la canceles.`
3. `Si tu plan es anual, te avisaremos por correo al menos 15 días antes de que se renueve.`
4. `Puedes cancelarla cuando quieras desde tu perfil, en «Gestionar la suscripción», igual de fácil que la contrataste. Conservas Premium hasta el final del periodo pagado y no se te vuelve a cobrar. No hay permanencia ni penalización.`
5. `Derecho de desistimiento: tienes 14 días naturales desde que contratas para desistir sin dar explicaciones. Te damos más: si ya se te ha cobrado, puedes desistir durante los 14 días siguientes al primer cobro. Hazlo con el botón «Desistir del contrato aquí» de tu perfil, con el formulario de abajo o escribiendo a {email}. Te devolvemos todo lo pagado en 14 días como máximo, por el mismo medio de pago, y la suscripción termina.`
6. `Si cambiamos el precio, te avisaremos con al menos 30 días de antelación y podrás cancelar antes de que se aplique.`

**list** (variante **con** *Managed Payments*): igual, pero la línea 5 empieza así y añade:
`… La compra la vende Link, el servicio de Stripe que te cobra y te envía el recibo, en nuestro nombre; puedes pedir el desistimiento o un reembolso también a Link, en link.com.`

<!-- Fuente: TRLGDCU art. 97.1.e («en el caso de… un contrato que incluya una suscripción, el precio incluirá el total de los costes por período de facturación»), 97.1.j (condiciones, plazo y procedimiento de desistimiento, y el formulario), 97.1.p (15 días antes del vencimiento, redacción de la Ley 10/2025), 102.1 (14 días), 104.a (para servicios, desde la celebración: damos más), 107 (devolución en 14 días por el mismo medio), 62.3 («en la misma forma en que lo celebró»); Directiva 2023/2673, art. 11 bis Directiva 2011/83 («desistir del contrato aquí»), aplicable desde el 19/6/2026 — España aún no lo ha incorporado al TRLGDCU (consolidado a 28/02/2026); se implanta de todas formas (analysis.md § 10, punto 7). {trialDays} es TRIAL_DAYS (hoy 7, 0056). El «30 días» del cambio de precio es propuesta, no exigencia legal: [abogado]. -->

### Nota para el código

- La línea 5 describe un botón que **no existe** (P1-8): `frontend` añade en la tarjeta de
  Premium, durante los 14 días, «Desistir del contrato aquí», que abre un paso con nombre,
  la suscripción que se desiste y el correo de confirmación, y un botón «Confirmar
  desistimiento»; `backend` cancela de inmediato, reembolsa en Stripe y envía el acuse
  ([`06-correos.md`](./06-correos.md) § C). Hasta que exista, publicar la línea 5 sin la
  mención al botón.
- El desistimiento **no** se renuncia en el checkout (no se recoge el consentimiento
  expreso del art. 103.a), así que la devolución es íntegra: bien así.

## D bis. El pasado detrás de Premium — **publicado** el 2026-10-20 (PR #302)

**Esto no es un borrador pendiente: es el registro poniéndose al día.** El párrafo 1 de la
sección «El plan gratuito y Premium» se publicó el 2026-10-20 (PR #302, `3791b07e` en
`main`), con `terms.updated` al 19 de octubre de 2026 en los dos idiomas. La decisión del
propietario, lo que cambia en el producto y su radio medido están en
[`0021`](../../decisions/0021-the-past-is-read-only.md) § *Amended 2026-10-19 — and the past
is premium*.

En una línea: **una cuenta gratuita lee solo la quincena que está viviendo; los planes que
ya no están activos (`completed` o `archived`) se guardan enteros y los abre Premium.** Ojo
a la diferencia entre esa línea y la frase publicada, que dice «las quincenas que ya
terminaron»: el § 1 explica por qué no es lo mismo y qué hay que arreglar.

**Dónde está**: namespace `terms`, sección «El plan gratuito y Premium», primer párrafo de
`paragraphs` (`es-ES.ts:3233`; `en-GB.ts:3145`). Lo que lee quien toca una quincena cerrada:
`plan.historyLockedIntro`, `plan.lockedTitle` y `plan.lockedBody` (`es-ES.ts:2409`,
`:2415-2417`).

| es-ES (vivo) | en-GB (vivo) |
| --- | --- |
| `NutrIA se puede usar gratis, con unos límites en los planes que puedes rehacer, las comidas que puedes cambiar y los eventos de cada plan. Con el plan gratuito ves la quincena que estás viviendo, entera y siempre; las quincenas que ya terminaron se guardan igual, y verlas en la aplicación forma parte de Premium. Guardadas lo están en cualquier caso: puedes pedirnos una copia de tus datos cuando quieras, como explica la política de privacidad. La seguridad alimentaria —alergias, intolerancias y nutrientes— es la misma con Premium y sin él.` | `NutrIA can be used for free, with limits on the plans you can redo, the meals you can swap and the events in each plan. On the free plan you see the fortnight you are living, in full and always; fortnights that have ended are kept all the same, and seeing them in the app is part of Premium. Kept they are either way: you can ask us for a copy of your data whenever you like, as the privacy policy explains. Food safety — allergies, intolerances and nutrients — is the same with Premium and without it.` |

<!-- Fuente: TRLGDCU (RDLeg. 1/2007, BOE-A-2007-20555; texto consolidado leído por la API de
datos abiertos del BOE el 2026-10-20, última actualización del consolidado 2026-03-02)
art. 60.1 y 60.2.a (información previa «relevante, veraz y suficiente» sobre las
características principales: qué se ve sin pagar y qué no es una característica principal de
este servicio) y art. 80.1.a (concreción y claridad, sin reenvíos; art. 80.2: en la duda
prevalece la interpretación más favorable al consumidor, que es la razón de decir «entera y
siempre» y no «tu plan actual»); art. 61.2 (lo ofrecido es exigible aunque no figure en el
contrato: por eso cada cosa que la frase promete tiene que ser verdad en el código, § 1).
Ley 7/1998 art. 5.5 (redacción clara). RGPD arts. 15.1 y 15.3 (acceso y copia de los datos
tratados), 12.3 (un mes) y 12.5 (gratis) — DOUE L 119 de 4/5/2016, consultado el 2026-10-20:
son el derecho al que remite la tercera frase, y el gate no lo toca. Ley 3/1991 arts. 5.1.b y
7.1 (no engañar por acción ni por omisión: de ahí «se guardan igual», que es lo que una
persona teme cuando una pantalla se cierra).

Lo que esta frase **no** es: no es la cláusula de modificación —eso es «Cambios en estas
condiciones», § 3— ni una limitación de responsabilidad ni un cambio de precio. Y «verlas en
la aplicación» está escrito así a propósito: lo que se vende es la pantalla, no el dato, y la
frase no debe poder leerse como que el pasado desaparece. -->

### 1. Qué sostiene cada promesa (código leído el 2026-10-20)

Frase por frase, con lo que la sostiene en el código. Si una de estas líneas deja de ser
verdad, la frase publicada pasa a ser un texto falso (P0) y hay que cambiarla en el mismo
despliegue. Una de ellas ya no se sostiene del todo: la tercera.

- «ves la quincena que estás viviendo, entera y siempre»: el gate solo mira el pasado.
  `mayReadPastPlans` se aplica tras `isPastPlan`, que excluye el plan activo, el que espera su
  día y el que está en revisión (`packages/core/src/domain/Allowance/Allowance.ts:302-308`;
  `packages/core/src/entities/Plan/Plan.ts:326`).
- «las quincenas que ya terminaron se guardan igual»: no hay borrado ni recorte ninguno; el
  gate es de lectura. `PlanController.getPlan`, `getDay` y `getMeal` lanzan
  `PremiumOnlyError('past_plan')` (`packages/core/src/controllers/Plan/PlanController.ts:706-707`
  y `:864-865`), que la API responde **409 con `code: 'PREMIUM_ONLY'`** y nunca 404
  (`apps/api/src/shared/filters/AllExceptions.filter.ts:252`). La fila sigue listada con sus
  fechas, su número y su marca (`PlanController.ts:814-822`), y la propiedad se decide antes
  que el tier: un plan de otra persona sigue siendo «no encontrado».
- **P1 — «las quincenas que ya terminaron» no es todo lo que el gate cierra.** `isPastPlan`
  es verdad para `completed` y `archived`, y un plan pasa a `completed` en cuanto otro se
  activa: rehacer la quincena en curso cierra el plan sustituido **el mismo día**
  (`packages/core/src/repositories/Plan/PlanRepository.ts:290-295` y `:1585`,
  `completesActive: status === 'active'`). Una cuenta gratuita tiene un rehacer por quincena
  (`planRedosPerFortnight: 1`, `Allowance.ts:93`; `0015`, y la tabla que el propietario
  puede mover, `0097`), así que es alcanzable el día 2: el plan que sustituyó queda detrás de Premium sin que su
  quincena haya terminado. El producto distingue las dos cosas en la pantalla —«Terminado» y
  «Sustituido», `plan.historyStatus` (`es-ES.ts:2476`)— y las condiciones solo nombran la
  primera. La frase, por tanto, describe menos de lo que cierra: art. 60.1 («veraz y
  suficiente») y art. 80.2 (la duda, a favor del consumidor). **Dos arreglos, uno u otro, en
  el despliegue que lo decida** (§ 5, punto 2).
- «puedes pedirnos una copia de tus datos cuando quieras, como explica la política de
  privacidad»: `/privacidad` § «Tus derechos» ofrece el acceso y la portabilidad por correo y
  promete respuesta en un mes y gratis (`es-ES.ts:2827`, `:2830`, `:2836`). **Esta frase crea
  una obligación manual**: no hay exportación construida (P2-9 de
  [`analysis.md`](../analysis.md)), así que, si alguien la ejerce, el propietario tiene que
  poder producir la quincena bloqueada —sus días, sus platos y lo que marcó— en el plazo del
  art. 12.3 RGPD. Mientras no exista `GET /users/me/export`, esa frase es una promesa que
  cumple una persona, no el producto.
- «La seguridad alimentaria … es la misma con Premium y sin él»: el gate no toca el catálogo,
  las alergias ni la calidad del plan (`0021` § *The data is not touched*).
- Lo que la frase calla y es verdad a favor de la persona: `/progreso` conserva todos los
  números (`ProgressController.ts:175` y `:210`), y un dietista lee el pasado de su cliente
  pague lo que pague el cliente (`CareController`, `reader: 'professional'`). No hace falta
  decirlo en las condiciones; lo dice la pantalla.
- **P3, con el interruptor `premium` apagado**: `pastOpensFor` abre el pasado a todo el mundo
  cuando no hay tier que comprar, y entonces la frase dice más de lo que el producto limita.
  No engaña a nadie —concede, no quita— y no se cambia por eso.

### 2. La decisión del propietario: no habrá correo (2026-10-20)

**Lo decidido.** Preguntado el 2026-10-20 por el aviso previo que promete la sección «Cambios
en estas condiciones», el propietario respondió: «no voy a mandar correos». No se envió
ningún correo antes del cambio ni se enviará después por este cambio. Está decidido; aquí se
anota lo que implica, no se discute.

**Lo que había que saber al decidirlo, y se sabía** (`0021` § *What this cost*): 8 cuentas en
producción, 4 gratuitas, con 5 quincenas terminadas entre ellas y como máximo 2 cada una, así
que **exactamente una cuenta pierde de vista exactamente un plan**; es una beta de amigos sin
checkout (Stripe *live* es la tanda C) y Premium se concede a mano desde `/admin`.

**Lo que eso significa en la práctica.**

- El cambio se anuncia **después** y **solo donde la persona lo encuentre**: la fecha de
  `/condiciones` y la pantalla de la quincena cerrada. Existe un aviso; lo que no existe es un
  aviso **previo** ni en **soporte duradero**.
- La promesa incumplida es la del propio contrato, y una promesa del contrato es exigible
  (TRLGDCU art. 61.2 y la propia cláusula). Quien la invoque no tiene que probar ningún
  perjuicio: basta leer la sección.
- La cuenta afectada no puede comprar lo que ha perdido de vista, porque no hay checkout. Eso
  convierte «lo abre Premium» en «lo abre el propietario cuando quiera», que es peor de
  explicar, no mejor.

**A qué expone.** Dos patas, y la segunda no depende de lo que prometan las condiciones.

1. **La cláusula propia.** Incumplir el aviso que uno mismo escribió es el reproche más fácil
   que se le puede hacer a una cláusula de cambios que ya estaba señalada por otra razón
   («seguir usando significa aceptar»: TRLGDCU arts. 85.3 y 126 bis;
   [`../2026-09-29-accepting-the-legal-texts.md`](../2026-09-29-accepting-the-legal-texts.md)
   § 4.4). Para un expediente de consumo encaja en el art. 47.g (información previa a la
   contratación) o en el 47.t, con multa de infracción leve de 150 a 10.000 € (art. 49.1.a).
   Con una cuenta y un plan, lo previsible no es una sanción: es que la cláusula se tenga por
   no cumplida y el cambio no se le pueda oponer a quien no lo aceptó.
2. **El deber legal, si el contrato gratuito está en el Libro II.** El art. 59.4 incluye los
   contratos en que el empresario suministra un servicio digital y la persona facilita datos
   personales, **salvo** que esos datos se traten *exclusivamente* para suministrar el
   servicio o para cumplir la ley. NutrIA registra además el uso del producto por interés
   legítimo (`analytics_events`, atado a `userId`; [`analysis.md`](../analysis.md) § 3), así
   que la excepción probablemente no se aplica y el Libro II entra. Si entra:
   - **art. 126**: modificar un servicio digital más allá de lo necesario para mantener su
     conformidad exige, de forma acumulativa, que el contrato lo permita y dé una razón
     válida (a), que no cueste nada (b), que se informe de forma clara y comprensible (c) y,
     cuando haya derecho a resolver, que se informe **«con una antelación razonable y en un
     soporte duradero»** de las características y el momento de la modificación y de ese
     derecho (d);
   - **art. 126 bis.1 y .2**: hay derecho a resolver sin cargo, en treinta días naturales, si
     la modificación afecta negativamente al acceso o al uso, *salvo si ese efecto negativo es
     de menor importancia*.
   - Un correo a cuatro cuentas gratuitas es exactamente el soporte duradero del art. 126.d, y
     es lo que no se ha enviado. **La redacción vigente tampoco da «una razón válida
     especificada en el contrato»**, que es lo que el art. 85.3 pide para que la facultad de
     modificar unilateralmente no sea abusiva (§ 3).

**[abogado]**, y es la lectura que hace llevadero no avisar: ¿es esta modificación «de menor
importancia» (art. 126 bis.1) —una cuenta, un plan, el dato intacto, la copia disponible y el
progreso completo—, con lo que no nacería el derecho a resolver ni, por tanto, el deber de
informar del art. 126.d? Yo no la decido. Lo que sí digo: **la misma decisión en el
lanzamiento real, con desconocidos, con cobro y con quincenas acumuladas, no es defendible
con este argumento**, porque entonces el efecto negativo deja de ser menor. El aviso previo
tiene que estar construido antes de ese día.

**Lo que lo cerraría hoy en un minuto, si el propietario quiere**: conceder Premium desde
`/admin` a la única cuenta afectada elimina el único perjuicio concreto, y el expediente
queda en una cláusula que hay que reescribir (§ 3). Es su decisión.

### 3. La cláusula «Cambios en estas condiciones» ya no dice la verdad — P1

Si no se van a enviar correos, la sección no puede seguir prometiéndolos: sería un texto que
promete algo que el producto no hace, que es la definición de P0 en este repositorio, y la
siguiente modificación repetiría el problema de hoy. La reescritura, además, cumple de paso
lo que al art. 85.3 le falta: decir **qué razones válidas** permiten el cambio.

**Dónde va**: namespace `terms`, sección «Cambios en estas condiciones», sustituye el único
párrafo (`es-ES.ts:3276-3279`; `en-GB.ts:3188-3191`). Sube `terms.updated` y **sube
`TERMS_VERSION`** (§ 4).

**paragraphs**:

| es-ES | en-GB |
| --- | --- |
| `Podemos cambiar estas condiciones cuando lo exija la ley, cuando cambie el servicio o lo que cuesta mantenerlo, o por seguridad. El cambio se publica en esta página con su fecha, y la versión vigente es siempre la que ves aquí.` | `We may change these terms when the law requires it, when the service or what it costs to run changes, or for security. Any change is published on this page with its date, and the version in force is always the one you see here.` |
| `Si un cambio empeora lo que puedes ver o hacer con tu cuenta, y no es algo menor, te lo diremos antes de que se aplique con un aviso que puedas guardar, y durante los treinta días siguientes podrás terminar tu suscripción o borrar tu cuenta sin coste. Seguir usando NutrIA después de un cambio que no te afecte así significa que lo aceptas.` | `If a change makes what you can see or do with your account worse, and it is not a minor matter, we will tell you before it applies with a notice you can keep, and for the following thirty days you will be able to end your subscription or delete your account at no cost. Continuing to use NutrIA after a change that does not affect you in that way means you accept it.` |

<!-- Fuente: TRLGDCU art. 85.3, párrafo primero (la facultad de modificación unilateral es
abusiva «salvo… que concurran motivos válidos especificados en el contrato»: de ahí la primera
frase, que los enumera; los párrafos siguientes del 85.3 son de servicios financieros y no se
aplican aquí); art. 126.a-d y art. 126 bis.1-2 (información clara, sin coste, con antelación
razonable y en soporte duradero cuando nace el derecho a resolver, y treinta días naturales
para resolver sin cargo); art. 60.1 (veracidad: no se promete un canal que no se va a usar);
art. 80.1.a y 80.2. Texto consolidado del TRLGDCU leído el 2026-10-20 (última actualización
2026-03-02).

«un aviso que puedas guardar» es deliberadamente el requisito del soporte duradero y no la
palabra «correo»: deja al propietario elegir el canal, pero **no le deja no avisar**. Si el
canal elegido no es el correo, tiene que ser algo que la persona pueda conservar sin que
nosotros lo podamos alterar (un PDF, un mensaje descargable): un aviso dentro de la
aplicación, por sí solo, no es soporte duradero. **[abogado]**: ¿aguanta «seguir usando
significa aceptar» para los cambios que no empeoran nada, una vez acotado así? Es la pregunta
que ya estaba abierta en
[`../2026-09-29-accepting-the-legal-texts.md`](../2026-09-29-accepting-the-legal-texts.md)
§ 4.4, ahora con menos superficie. -->

### 4. `TERMS_VERSION`: **sí sube**, a `2.1.0`

**Mi respuesta**: sube, y la decide la regla que este repositorio ya escribió, no una
preferencia mía — [`../2026-09-29-accepting-the-legal-texts.md`](../2026-09-29-accepting-the-legal-texts.md)
§ 5.4: *«cualquier cambio de significado en `terms`, en `es-ES.ts` o en `en-GB.ts`, sube
`TERMS_VERSION` y `terms.updated` en el mismo commit; una corrección de estilo no»*. Esto
quita algo que antes se veía: es un cambio de significado, no una aclaración. (Compárese con
el § I, que **no** sube la versión: allí se informaba de una función nueva sin tocar derecho
ni obligación.)

Y hay una razón más fuerte que la regla: **la columna existe para poder probar qué texto vio
cada cuenta** (§ 3.2 de esa nota). Si `2.0.0` pasa a designar dos textos distintos —el de
antes y el del 19 de octubre—, la columna deja de probar eso justo en el cambio en que más
falta hace, porque **no hay correo** que acredite el aviso: la versión almacenada es el único
rastro.

**Cómo se hace, sin fingir lo que no fue:**

- `TERMS_VERSION = '2.1.0'` en `packages/core/src/entities/User/User.ts:20`, **ya, en un
  commit propio**, sin esperar a la cláusula del § 3. La versión es un identificador, no un
  changelog: `2.1.0` pasa a designar «el texto vigente desde el 19 de octubre de 2026», que
  es el que una cuenta nueva ve hoy. La cláusula del § 3 y, si se elige la opción (a) del
  § 5.2, la frase del párrafo 1 subirán a `2.2.0` cuando se publiquen. Una segunda subida no
  cuesta nada; un alta mal registrada no se deshace. Si se esperase a la cláusula —que lleva
  dos marcas **[abogado]** y puede tardar semanas—, cada cuenta nueva seguiría guardándose
  como que aceptó un texto que no vio.
- **Las 8 cuentas existentes se quedan en `2.0.0`**, que es la verdad, y la consola las cuenta
  como «en una versión anterior» (`AdminConsentController.ts:70`;
  `AdminSystemController.ts:175`). Esa cifra es, a partir de ahora, el registro de cuántas
  cuentas no han aceptado el texto vigente **y a cuántas no se avisó**. Es incómoda a
  propósito: no se rellena, no se retoca y no se backfillea.
- **El agujero que hay que anotar**: entre el 2026-10-20 y la subida, una cuenta nueva se
  guarda como `2.0.0` habiendo visto el texto del 19 de octubre. Es un defecto acotado, el
  texto exacto está en el historial del repositorio y `terms.updated` lo fecha. El
  propietario puede ver cuántas son en `/admin` → Personas › Consentimientos; lo esperable es
  cero.
- `2.1.0` y no `3.0.0`: el contrato es el mismo, con una sección acotada. Un
  mayor se reserva para una reescritura completa o para un cambio en **quién** contrata (por
  ejemplo, el día en que el propietario se dé de alta como autónomo y cambie la identidad del
  aviso legal).
- Lo que esto rompe en el código: `apps/api/test/terms-record.e2e-spec.ts:118` fija `'2.0.0'`
  literalmente. Es de `tests`, no mío.

### 5. Lo que queda debiéndose, por gravedad

1. **P0 — la portada promete lo contrario.** `landing.faq`, la respuesta a «¿Qué pasa con mis
   planes anteriores?» (`es-ES.ts:1893-1895`; `en-GB.ts:1802-1805`), dice hoy «puedes
   consultarlos cuando quieras» / «you can look them up whenever you like». Para una cuenta
   gratuita es falso desde el 2026-10-20, y es información **previa** a la contratación en una
   página pública: el art. 61.2 la hace exigible y el art. 80.2 resuelve la duda a favor del
   consumidor, así que hoy una cuenta gratuita podría oponer la portada a las condiciones. Hay
   que cambiarla ya; es `frontend`, sin versión que subir (no es la `terms`) y sin fecha que
   mover.

   | es-ES | en-GB |
   | --- | --- |
   | `Se quedan guardados, con sus recetas, sus listas y tus comentarios. La quincena que estás viviendo la ves entera y siempre; las que ya terminaron las abre Premium, y puedes pedirnos una copia de tus datos cuando quieras.` | `They are kept, with their recipes, their shopping lists and your notes. You always see the fortnight you are living, in full; the ones that have ended are opened by Premium, and you can ask us for a copy of your data whenever you like.` |

   **Y hay que ajustarla a lo que se elija en el punto 2**: con la opción (a), «los planes
   anteriores los abre Premium»; con la (b), el borrador de arriba ya es verdad tal cual. La
   portada no puede quedar diciendo «las que ya terminaron» si las condiciones dicen otra
   cosa.

   <!-- Fuente: TRLGDCU arts. 60.1 y 60.2.a (información previa veraz), 61.1-61.2 (la
   publicidad integra el contrato y es exigible), 80.2; Ley 3/1991 arts. 5.1.b y 7.1. La
   redacción repite la de las condiciones a propósito: dos textos sobre lo mismo que no se
   parecen son una contradicción esperando a que alguien la encuentre. -->

2. **P1 — el plan que sustituiste también queda detrás de Premium, y la frase no lo dice**
   (§ 1). Dos arreglos posibles, y hay que elegir uno:
   - **(a) el texto describe lo que el código hace** — es lo que exige la regla de este
     repositorio (describir, no desear). Sustituye la segunda frase del párrafo 1, con
     `terms.updated` y con `TERMS_VERSION = '2.2.0'` (§ 4: la `2.1.0` es el texto vigente
     desde el 19 de octubre; esta frase sería un texto nuevo):

     | es-ES | en-GB |
     | --- | --- |
     | `Con el plan gratuito ves la quincena que estás viviendo, entera y siempre; los planes anteriores —los que ya terminaron y los que sustituiste al rehacer uno— se guardan igual, y verlos en la aplicación forma parte de Premium.` | `On the free plan you see the fortnight you are living, in full and always; earlier plans — the ones that have ended and the ones you replaced by redoing a plan — are kept all the same, and seeing them in the app is part of Premium.` |

   - **(b) el código deja de cerrar el plan que se sustituye dentro de la quincena que la
     persona está viviendo**, y entonces la frase publicada ya es verdad y no hay nada que
     publicar. Es la opción que menos explica y la que no toca un texto que la gente ya leyó;
     si se elige, no sube nada. Decide el propietario, con `backend`.

   <!-- Fuente: TRLGDCU art. 60.1 (información veraz y suficiente sobre las características
   principales), art. 80.1.a y 80.2; art. 61.2 (lo que el texto promete es exigible). El
   defecto lo describe también `docs/reference/marketing/the-past-is-premium.md` § «What this
   decides» como su único defecto, con una recomendación de producto; aquí solo se dice qué
   exige la ley de la frase publicada. -->
3. **P1 — la cláusula de cambios** (§ 3), con `terms.updated` y `TERMS_VERSION = '2.1.0'` (§ 4).
4. **P2 — la copia que hay que poder dar.** Mientras no exista la exportación (P2-9), el
   propietario es quien cumple el art. 15.3 RGPD en un mes (art. 12.3) y gratis (art. 12.5),
   y ahora las condiciones mandan a la gente ahí expresamente. Si alguna cuenta gratuita la
   pide, la copia tiene que incluir la quincena bloqueada.
5. **P3 — la pantalla dice «lo abre Premium» donde no hay nada que comprar.** `plan.lockedBody`
   (`es-ES.ts:2415-2417`) y `plan.historyLockedIntro` (`:2409`) están bien escritos para el
   día en que haya checkout; hoy la única vía es que el propietario lo conceda a mano. No es
   falso —Premium es lo que la abre— pero conviene revisarlo el día de la tanda C.

## E. Formulario de desistimiento (nueva sección, al final)

**heading**: `Formulario de desistimiento`

**paragraphs**:
1. `Solo tienes que rellenarlo y enviarlo si quieres desistir y prefieres no usar el botón de tu perfil.`
2. `A la atención de {name}, {address}, {email}:`
3. `Por la presente le comunico que desisto de mi contrato de suscripción a NutrIA Premium.`
4. `Contratado el: ______. Nombre: ______. Correo de la cuenta: ______.`
5. `Firma (solo si se envía en papel): ______. Fecha: ______.`

<!-- Fuente: TRLGDCU art. 97.1.j y 106.1; anexo I, letra B (modelo de formulario de desistimiento); art. 106.3 (formulario electrónico: acuse de recibo «sin demora en un soporte duradero»). {address} es el marcador nuevo de textos/07. -->

## F. Sección nueva «Si trabajas con un dietista»

**heading**: `Si trabajas con un dietista`

**paragraphs**:
1. `Un dietista-nutricionista puede invitarte a llevar tu plan en NutrIA con su ayuda. Si aceptas, podrá ver y ajustar tu plan como explica la invitación y la política de privacidad, y mientras el enlace dure tendrás los límites de Premium sin pagar nada.`
2. `Tu dietista es un profesional independiente: su consejo y su relación contigo son cosa suya y tuya. NutrIA es la herramienta y no responde de sus decisiones clínicas, del mismo modo que tu dietista no responde de cómo funciona NutrIA.`
3. `Puedes terminar el enlace cuando quieras. Al terminar, conservas tu cuenta, tu historial y tu último plan publicado, con los límites gratuitos.`

<!-- Fuente: 0061 (el cliente vinculado tiene Premium mientras el enlace y la consulta estén activos); PRD 004, Decisiones 7 y 8; TRLGDCU art. 82 y 86 (no excluir la responsabilidad propia: solo se delimita la ajena). -->

## G. Sección «Responsabilidad» — añadir al final

`Si usas NutrIA con un dietista, lo que te aconseje es responsabilidad suya como profesional; lo que haga NutrIA —cómo calcula, qué comprueba y qué te muestra— es responsabilidad nuestra.`

---

## English

- **A** `auth.legalNotice`: `By creating your account you accept the {terms}. How we handle your data is explained in the {privacy}.`
- **B** "Who provides the service": `NutrIA is provided by {name}. Their address, tax ID, phone and email are in the {legalNotice}. For anything about these terms, write to {email}.`
- **C** "Your account", first line: `You must be at least 18. If the date of birth you give belongs to someone younger, we will not be able to create your profile.`
- **D** "The free plan and Premium":
  - paragraphs, first one — **published on 2026-10-20** (PR #302; this is the live wording, § D bis): `NutrIA can be used for free, with limits on the plans you can redo, the meals you can swap and the events in each plan. On the free plan you see the fortnight you are living, in full and always; fortnights that have ended are kept all the same, and seeing them in the app is part of Premium. Kept they are either way: you can ask us for a copy of your data whenever you like, as the privacy policy explains. Food safety — allergies, intolerances and nutrients — is the same with Premium and without it.`
  - paragraphs, second one — still a draft: `Premium raises those limits with a monthly or yearly subscription. Before paying you see the total price including tax and what is charged each period. Payment is handled by Stripe.`
  - "Changes to these terms" (§ D bis.3, a draft, with `TERMS_VERSION = '2.1.0'`): `We may change these terms when the law requires it, when the service or what it costs to run changes, or for security. Any change is published on this page with its date, and the version in force is always the one you see here.` / `If a change makes what you can see or do with your account worse, and it is not a minor matter, we will tell you before it applies with a notice you can keep, and for the following thirty days you will be able to end your subscription or delete your account at no cost. Continuing to use NutrIA after a change that does not affect you in that way means you accept it.`
  - `landing.faq`, "What happens to my previous plans?" (§ D bis.5, P0, a draft): `They are kept, with their recipes, their shopping lists and your notes. You always see the fortnight you are living, in full; the ones that have ended are opened by Premium, and you can ask us for a copy of your data whenever you like.`
  - list: `The first time you take Premium you get a free trial of {trialDays} days. We ask for your card at the start and charge nothing until it ends. If you cancel before then, you pay nothing.` / `When the trial ends, and then at the end of each period, the subscription renews and is charged automatically until you cancel.` / `If your plan is yearly, we will email you at least 15 days before it renews.` / `You can cancel whenever you like from your profile, under "Manage subscription", as easily as you signed up. You keep Premium until the end of the paid period and are not charged again. There is no minimum term and no penalty.` / `Right of withdrawal: you have 14 calendar days from signing up to withdraw without giving a reason. We give you more: if you have already been charged, you can withdraw within 14 days of the first charge. Use the "Withdraw from contract here" button on your profile, the form below, or write to {email}. We refund everything you paid within 14 days at most, by the same payment method, and the subscription ends.` / `If we change the price, we will tell you at least 30 days in advance and you can cancel before it applies.`
  - with Managed Payments, append to the withdrawal line: `The purchase is sold by Link, the Stripe service that charges you and sends your receipt, on our behalf; you can also ask Link for withdrawal or a refund at link.com.`
- **E** "Withdrawal form": `Only fill in and send this form if you want to withdraw and prefer not to use the button on your profile.` / `To {name}, {address}, {email}:` / `I hereby give notice that I withdraw from my contract for a NutrIA Premium subscription.` / `Signed up on: ______. Name: ______. Account email: ______.` / `Signature (only if sent on paper): ______. Date: ______.`
- **F** "If you work with a dietitian": `A dietitian-nutritionist can invite you to follow your plan with them on NutrIA. If you accept, they can see and adjust your plan as the invitation and the privacy policy explain, and while the link lasts you get Premium's limits at no cost.` / `Your dietitian is an independent professional: their advice and their relationship with you are between the two of you. NutrIA is the tool and is not responsible for their clinical decisions, just as your dietitian is not responsible for how NutrIA works.` / `You can end the link whenever you like. When it ends, you keep your account, your history and your last published plan, on the free limits.`
- **G** "Liability", append: `If you use NutrIA with a dietitian, their advice is their responsibility as a professional; what NutrIA does — how it calculates, what it checks and what it shows you — is ours.`

---

## H. Las imágenes de los platos (proyecto 006, 2026-09-27)

**Dónde**: namespace `terms`, sección «Contenido generado con inteligencia artificial»
(`es-ES.ts:1694-1697`; `en-GB.ts:1688`), como segundo párrafo. Actualizar `terms.updated`.
Se publica antes de encender el flag de las imágenes o el mismo día. Solo informa: no es un
«cambio importante» y no exige correo previo. Texto, fuentes y porqué en
[`dish-pictures.md`](../dish-pictures.md) § 3.3.

| es-ES | en-GB |
| --- | --- |
| `Las imágenes de los platos también las genera una inteligencia artificial, a partir de la receta, y las marcamos como tales. Son orientativas: no son una foto del plato que vas a cocinar y pueden no mostrar todos sus ingredientes ni su cantidad real. Lo que lleva cada plato lo dice su lista de ingredientes, y es la que tiene en cuenta tus alergias.` | `The pictures of the dishes are also generated by artificial intelligence, from the recipe, and we mark them as such. They are for illustration only: they are not a photo of the dish you will cook and may not show all of its ingredients or its real quantities. What each dish contains is what its ingredient list says, and that list is the one that takes your allergies into account.` |

<!-- Fuente: TRLGDCU art. 60.1; Ley 3/1991, arts. 5.1.b y 7.1; Ley 7/1998, art. 5.5; Ley de IA art. 50.4 (la condición informa, pero no sustituye al rótulo: Directrices C(2026) 5054, apdo. 142). -->

**2026-09-30 (proyecto 009 fase 3), opcional (P3)**: la frase calla que una imagen puede
mostrar algo que el plato no lleva. Sigue siendo verdad como está; si el propietario
cambia la frase de `/privacidad` sobre el juez, conviene igualar esta en el mismo cambio,
con `terms.updated`. **No se toma** (propietario, 2026-09-30): esta frase se queda como
está. Texto y fuentes, por si se reabre, en
[`dish-pictures.md`](../dish-pictures.md) § 4.4 («`/condiciones`»).

---

## I. Si pides un plato escribiendo su nombre (informe `0011` § 4 a, 2026-10-13)

**Nada construido.** No se publica hasta que exista el campo, y se publica **en el mismo
cambio que lo enciende**. Solo es verdad si se cumplen las cinco condiciones de
[`analysis.md`](../analysis.md) P0-3 al 2026-10-13.

**Dónde**: namespace `terms`, sección «Contenido generado con inteligencia artificial»
(`es-ES.ts`, `en-GB.ts`), como **tercer** párrafo, detrás del de las imágenes.
Actualizar `terms.updated`. **No es un «cambio importante»** de las condiciones y no exige
correo previo: no toca el precio, el plazo, la renovación, el desistimiento ni la
responsabilidad — informa de una función nueva y de lo que no se debe escribir en ella.
No sube `TERMS_VERSION`; lo que sí sube es `PROFILE_CONSENT_VERSION`, por la política
([`05`](./05-consentimientos-cliente.md) § A bis).

| es-ES | en-GB |
| --- | --- |
| `Si nos pides un plato escribiendo su nombre, ese texto se envía a la inteligencia artificial. Escribe solo el nombre de un plato: no es un sitio para contar nada sobre ti ni sobre nadie. Podemos no atender una petición, y puede que el plato que salga no encaje en tu plan y no llegues a verlo. El que sí salga se guarda en nuestra biblioteca de platos —la misma para todo el mundo— con el nombre que escriba el modelo, y no dice quién lo pidió.` | `If you ask us for a dish by typing its name, that text is sent to the artificial intelligence. Write only a dish's name: it is not a place to tell us anything about you or about anybody else. We may not act on a request, and the dish that comes out may not fit your plan, in which case you never see it. The one that does is kept in our library of dishes — the same one for everybody — under the name the model writes, and it does not say who asked for it.` |

<!-- Fuente: TRLGDCU art. 60.1 (información previa de las características del servicio) y
art. 80.1 (claridad y concreción); Ley 7/1998 art. 5.5 (redacción clara de las condiciones
generales); Ley 34/2002 (LSSI) art. 27.1 (información previa sobre el procedimiento de
contratación y las condiciones del servicio); Reglamento (UE) 2024/1689 art. 50
(transparencia: la persona sabe que interactúa con un sistema de IA y qué se le envía);
RGPD art. 5.1.c — «no es un sitio para contar nada sobre ti» es la medida de minimización
en el único punto donde la persona decide qué entra.

**Por qué esta cláusula y no solo la política.** La política informa del tratamiento; las
condiciones son el contrato, y aquí hay tres cosas contractuales que la política no dice:
(1) que NutrIA **puede no atender** una petición — sin esto, negarse sería incumplir lo
ofrecido (TRLGDCU art. 60.1); (2) que el plato puede no encajar y no llegar a verse, que es
lo que de verdad pasa cuando `fitsPlate` o el tiempo de cocinado lo tumban (informe `0011`
§ 4, «lo que la generación no arregla»): prometer un plato a la carta y no darlo sería
publicidad desleal (Ley 3/1991 arts. 5.1.b y 7.1); (3) que el plato queda en una biblioteca
**compartida** — la persona contribuye con una petición a un catálogo del que comen los
demás, y eso se dice antes, no después.

**Lo que esta cláusula NO hace**: no es una licencia sobre el texto escrito, y no hace
falta, porque el texto no se guarda (condición 2 de P0-3 al 2026-10-13) y lo que se guarda
—nombre y receta— lo escribe el modelo, no la persona. Si algún día el texto escrito se
guardara o se mostrara, haría falta cláusula de contenido de usuario (uso aceptable,
licencia, retirada) y esta frase **no bastaría**. -->
