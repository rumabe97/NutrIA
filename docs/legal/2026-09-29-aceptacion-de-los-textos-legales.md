# D5 — ¿Debe el registro guardar la aceptación versionada de `/privacidad` y `/condiciones`? (2026-09-29)

> **No soy abogado.** Lo ha escrito un agente, no un abogado. Cada conclusión cita el
> artículo y la versión consolidada en que se apoya para que el propietario —o el abogado
> al que se lo enseñe— pueda comprobarla. Lo que depende de una interpretación va marcado
> **[abogado]** y reunido en el § 7.
>
> **Propósito**: responder a la decisión D5 del proyecto 008
> ([PRD](../projects/008-console-watches-quality-and-spend/PRD.md), [PLAN](../projects/008-console-watches-quality-and-spend/PLAN.md)
> fase 3 paso 7 y fase 7; [`0071`](../decisions/0071-the-service-records-what-leaves-no-row-and-the-console-watches-it.md) «Consequences»).
> **Audiencia**: el lead (que enmienda la fase 7 con el § 5), `backend`, `frontend`,
> `tests`, el propietario y el abogado. **Committed**: sí — el repositorio es público: aquí
> no hay nombres, correos ni NIF; los textos usan los marcadores de `legalIdentity.ts`.
> **Mantenido por**: el agente `legal`. **Fecha de corte**: 2026-09-29, commit leído
> `a8b6a96`.

## 0. Veredicto

**La fase 7 se ejecuta, solo para las condiciones de uso.**

- **Política de privacidad: no se registra ninguna «aceptación».** La política informa
  (RGPD art. 13); no se acepta. Registrar su «aceptación» describiría mal la base jurídica
  y la consola la contaría como un consentimiento que no existe (§ 2).
- **Condiciones de uso: ninguna norma en vigor obliga a guardar la aceptación cuenta por
  cuenta.** El único precepto que lo exigía se derogó en 2014 (§ 3.1). Pero **conviene**,
  y el riesgo de no hacerlo es concreto: la carga de probar que las condiciones se
  incorporaron al contrato recae en NutrIA, y desde el 21 de septiembre ha habido tres
  textos distintos, así que la fecha de alta ya no basta para saber cuál vio cada persona
  (§ 3.2).
- **Qué se guarda**:
  - qué versión de `/condiciones` y cuándo;
  - en dos columnas nulas de `user` (`termsVersion` y `termsAcceptedAt`);
  - el servidor las escribe al crear la cuenta, por cualquier vía (correo, Google, Apple),
    a partir de la constante `TERMS_VERSION = '2.0.0'`;
  - Consentimientos cuenta las cuentas con la versión vigente, con una anterior y sin
    registro.
- **Cómo se muestra**: el aviso tiene que verse **antes y junto a** cada control que crea
  una cuenta. Hoy no se ve en el caso de Google (§ 4.1).
- **Dos textos cambian en el mismo despliegue**:
  - una sección nueva de las condiciones sobre cómo se celebra el contrato y qué se
    archiva (LSSI art. 27.1);
  - una frase en la política de privacidad que nombra el dato nuevo (§ 6).
- La especificación exacta de la fase 7 está en el § 5.

## 1. Lo que hace hoy el producto (leído en el código)

- **Consentimientos que ya se guardan con versión** (los cuatro de la consola):
  - **Consentimiento del perfil**: `profile_data_consents` (`packages/database/src/schemas/profile.schema.ts:215`),
    `PROFILE_CONSENT_VERSION`.
  - **Datos de salud**: `health_data_consents` (`:200`), `HEALTH_CONSENT_VERSION = '1.1.0'`
    (`packages/core/src/entities/Health/Health.ts:47`), exigida con `z.literal` (`:97`).
  - **Enlace con el dietista**: `care_links.consentVersion` y `consentedAt` (`care.schema.ts:79-80`),
    `CARE_CONSENT_VERSION`.
  - **Acuerdo del profesional**: `professionals.agreementVersion` y `agreementAcceptedAt`
    (`professional.schema.ts:26-27`), `PROFESSIONAL_AGREEMENT_VERSION` (`packages/core/src/entities/Professional/Professional.ts:27`).
  - Los cuatro son una versión y una fecha, en una fila de la persona, y una versión
    distinta de la constante vuelve a pedirse.
- **Qué se guarda de las condiciones al registrarse: nada.**
  - La tabla `user` (`packages/database/src/schemas/auth.schema.ts:25-43`) solo tiene
    `createdAt`.
  - El registro por correo (`apps/web/src/app/_shared/RegisterScreen.tsx:49`) envía
    nombre, correo y contraseña.
  - Google y Apple crean la cuenta en la devolución del proveedor.
  - Todas las vías pasan por `databaseHooks.user.create` (`apps/api/src/modules/auth/auth.config.ts:124-136`).
- **Qué ve la persona.**
  - `LegalNotice` (`apps/web/src/components/LegalNotice/LegalNotice.tsx`) pinta
    `auth.legalNotice`: «Al crear tu cuenta aceptas las {terms}. Cómo tratamos tus datos
    te lo explica la {privacy}.» (`es-ES.ts:636`, `en-GB.ts:609`). Ya distingue bien
    aceptar e informar: es el texto de [`textos/03`](./textos/03-condiciones-uso.md) § A.
  - **Dónde aparece**:
    - en `/registro`, **debajo** del botón «Crear cuenta» (`RegisterScreen.tsx:101`);
      los botones de Google y Apple están arriba, antes del formulario (`:76`);
    - en `/acceder`, que también crea cuentas con Google (`0058`), lo mismo: botones en
      `SignInForm.tsx:98` y aviso en `:118`.
  - La línea de la edad (`auth.legalAge`) solo está en `/registro` (`:106`).
- **Las condiciones han cambiado tres veces en ocho días** (`git log -G` sobre frases de
  `terms` en `es-ES.ts`):
  - #45 el 21/09;
  - #104 el 25/09 (entre otras cosas, la edad mínima pasó a 18);
  - #131 el 28/09 (las imágenes de los platos).
  - La sección «Cambios en estas condiciones» (`es-ES.ts:2201`) dice que un cambio
    importante se avisa por correo antes de aplicarse, y que seguir usando NutrIA equivale
    a aceptarlo.

## 2. La política de privacidad se informa; no se acepta

1. **Qué exige la ley.** El RGPD no pide que el interesado acepte la política. Pide que
   el responsable le informe:
   - «en el momento en que [los datos] se obtengan» (art. 13.1);
   - y que pueda demostrar que cumple (art. 5.2, responsabilidad proactiva).

   <!-- Fuente: RGPD arts. 5.2 y 13.1 (texto del DOUE en BOE, DOUE-L-2016-80807, consultado el 29/09/2026). -->
2. **Por qué los datos de la cuenta no dependen de ningún consentimiento.** Nombre,
   correo y sesión se tratan porque son necesarios para el contrato (art. 6.1.b), como ya
   dice la política («Por qué podemos tratar estos datos», es-ES.ts, sección de
   `privacy`).
   - Los datos de salud tienen sus propios consentimientos, versionados y separados.
   - Presentar la lectura de la política como una «aceptación» mezclaría dos bases que
     el RGPD mantiene separadas.
   - El CEPD dice que no pueden «fusionarse y difuminarse» (Directrices 05/2020, § 26)
     y que aceptar en bloque las condiciones generales «no puede considerarse un acto
     afirmativo claro» de consentimiento (§ 81).
   - Si alguien leyera ese registro como el consentimiento de la persona, se presumiría
     que no se dio libremente: «cuando el cumplimiento de un contrato… sea dependiente del
     consentimiento» (art. 7.4 y considerando 43; Directrices, § 13).
   - La LOPDGDD lo dice también: «No podrá supeditarse la ejecución del contrato a que el
     afectado consienta el tratamiento de los datos personales para finalidades que no
     guarden relación con… la relación contractual» (art. 6.3).

   <!-- Fuente: RGPD arts. 6.1.b, 7.2, 7.4 y considerandos 32 y 43; LOPDGDD art. 6.3 (BOE-A-2018-16673, consolidada a 27/12/2025); CEPD, Directrices 05/2020 sobre el consentimiento, versión 1.1 (13/05/2020), §§ 13, 26, 71 y 81. -->
3. **Cómo se prueba que se informó, sin escribir nada por cuenta.**
   - El enlace a `/privacidad` está en el mismo punto en que se crea la cuenta.
   - El texto de cada versión, con su fecha `privacy.updated`, está en el historial
     público del repositorio.
   - `user.createdAt` dice cuándo se creó cada cuenta.

   Con esas tres cosas se demuestra qué política estaba publicada cuando se recogieron los
   datos de cada persona (art. 5.2). El CEPD pide que la prueba no genere «cantidades
   excesivas de tratamiento adicional» (Directrices 05/2020, § 106). Esa idea, escrita
   para el consentimiento, vale también aquí.
4. **Consecuencia para la consola.**
   - Personas › Consentimientos **no** debe mostrar la política de privacidad como un
     consentimiento, ni tener una columna de «aceptación de la privacidad».
   - Si algún día se quiere una cifra, será «cuentas creadas mientras estuvo publicada la
     política de fecha X». Se calcula con `createdAt` y no necesita ningún campo.

## 3. Las condiciones de uso: exigido, recomendable o innecesario

### 3.1 Ninguna norma en vigor exige guardar la aceptación

- **Ley 7/1998, de condiciones generales.**
  - **Art. 5.4** exigía, en la contratación electrónica, que «conste… la aceptación de
    todas y cada una de las cláusulas». Lo **derogó** la Ley 3/2014 (disposición
    derogatoria única.2).
  - **El RD 1906/1999**, que lo desarrollaba, quedó **derogado el 29/03/2014** por la
    misma ley.
  - **Lo que queda en vigor** son los arts. 5.1, 5.3, 5.5 y 7:
    - las condiciones se incorporan si el adherente las acepta;
    - el adherente tiene que haber sido informado expresamente de que existen y tener un
      ejemplar;
    - quedan fuera las que no pudo «conocer de manera completa al tiempo de la
      celebración».
  - Ninguno de esos artículos exige un registro.

  <!-- Fuente: Ley 7/1998, BOE-A-1998-8789, consolidada a 16/03/2019, arts. 5 (apdo. 4 derogado por la Ley 3/2014, BOE-A-2014-3329) y 7; RD 1906/1999, BOE-A-1999-24914, «Fecha de derogación: 29/03/2014». -->
- **LSSI.**
  - **Art. 23.1**: el contrato electrónico vale «cuando concurran el consentimiento y los
    demás requisitos».
  - **Art. 24.1**: se prueba «por las reglas generales».
  - **Art. 24.2**: el soporte electrónico se admite como prueba documental.
  - **Art. 27**: obliga a informar antes de contratar y a poner las condiciones a
    disposición del destinatario para que pueda guardarlas.
  - **Art. 28**: obliga a confirmar que se ha recibido la aceptación.
  - Ninguno obliga a que el prestador guarde un registro por persona.

  <!-- Fuente: LSSI-CE, BOE-A-2002-13758, consolidada a 23/01/2025, arts. 23, 24, 27 y 28. -->
- **TRLGDCU.**
  - **Art. 80.1.a-b**: las cláusulas no negociadas tienen que ser accesibles y el
    consumidor tiene que poder conocerlas antes de contratar.
  - **Art. 63.1**: pide entregar un justificante con las condiciones generales.
  - **Art. 98.7**: pide confirmar el contrato a distancia en un soporte duradero.
  - Todo eso es entregar información a la persona, no guardar su aceptación.

  <!-- Fuente: TRLGDCU, BOE-A-2007-20555, consolidado a 28/02/2026, arts. 63.1, 80.1 y 98.7. -->

**Conclusión: guardar la aceptación no está exigido.**

### 3.2 Pero conviene: el riesgo de no guardarla

1. **La prueba es de NutrIA.**
   - Si una persona niega que una cláusula le vincule, es NutrIA quien tiene que probar
     que la aceptó y que pudo conocerla completa al contratar. Si no lo prueba, la
     cláusula no se incorporó (Ley 7/1998 arts. 5.1 y 7.a).
   - En Premium, la ley lo dice expresamente para la información precontractual: «La carga
     de la prueba… incumbirá al empresario» (TRLGDCU art. 97.8).

   <!-- Fuente: Ley 7/1998 arts. 5.1 y 7.a; TRLGDCU art. 97.8 (consolidado a 28/02/2026). -->
2. **La fecha de alta ya no basta.**
   - Con un solo texto, «cuenta creada el día X» más el historial del repositorio decían
     qué condiciones vio cada persona.
   - Con tres textos en ocho días, y con más cambios anunciados (Premium, desistimiento y
     aviso legal: `textos/03`, `textos/07`), esa reconstrucción ya es una inferencia.
   - Además, nunca responde a la pregunta que importará: «¿esta persona aceptó la versión
     nueva?».
3. **El cambio de condiciones necesita saber quién está en cada versión.**
   - La cláusula actual dice que seguir usando NutrIA equivale a aceptar un cambio. Frente
     a un consumidor, es frágil:
     - es abusiva la cláusula que reserva al empresario la modificación unilateral sin
       «motivos válidos especificados en el contrato» (TRLGDCU art. 85.3);
     - si la modificación empeora de forma apreciable el servicio digital, el consumidor
       puede resolver el contrato en 30 días (art. 126 bis).
   - Guardar la versión es lo que permite, más adelante, volver a pedir la aceptación a
     quien tenga una anterior, como ya se hace con los cuatro consentimientos.
   - La fase 7 no construye esa nueva petición; deja todo preparado para hacerla. **[abogado]**, § 7.

   <!-- Fuente: TRLGDCU arts. 85.3 y 126 bis (este, para contratos desde el 01/01/2022). -->
4. **Cuesta poco.** Son dos columnas nulas en una tabla que ya existe (el PRD, criterio 13,
   prohíbe tablas nuevas), un hook que ya se ejecuta y un recuento más en una página que la
   fase 3 ya construye. Coste: 0 €.
5. **Ya estaba decidido.** El análisis lo dejó como P2-2 («guardar `termsVersion` y fecha
   al registrarse»: [`analisis.md` § 9](./analisis.md#p2)), en la lista de antes de Stripe
   *live* ([`checklist-activacion.md` § 2](./checklist-activacion.md)).

**Conclusión: guardarla es recomendable, no exigido, y se hace ya.** «Recomendable» no
significa «da igual». Sin el registro, frente a un consumidor que discuta una cláusula,
el propietario solo tiene una inferencia.

### 3.3 ¿La cuenta gratuita es un contrato de consumo?

- **La duda**: el Libro II del TRLGDCU abarca los servicios digitales que se pagan con
  datos personales, salvo que los datos se usen «exclusivamente» para prestar el servicio
  (art. 59.4). NutrIA registra además el uso del producto por interés legítimo (`0071`),
  así que se puede discutir si la cuenta gratuita entra.
- **El veredicto no depende de esto**:
  - la Ley 7/1998 protege a cualquier adherente;
  - el título IV de la LSSI se aplica a cualquier contrato electrónico;
  - Premium es contrato de consumo sin discusión.
- **[abogado]**, § 7.

<!-- Fuente: TRLGDCU art. 59.4 (añadido por el RDL 7/2021, en vigor desde el 01/01/2022). -->

## 4. Lo que falla hoy, se guarde algo o no

### 4.1 Quien se registra con Google puede no ver el aviso — P1

- **El problema.**
  - En `/registro` los botones de Google y Apple (`RegisterScreen.tsx:76`) están por
    encima del formulario.
  - El aviso de las condiciones está debajo del botón «Crear cuenta» (`:101`).
  - En `/acceder`, igual (`SignInForm.tsx:98` y `:118`).
  - En un teléfono, quien toca «Continuar con Google» crea la cuenta sin que el aviso
    haya aparecido en la pantalla.
- **Por qué importa.**
  - La Ley 7/1998 deja fuera del contrato las condiciones que el adherente «no haya tenido
    oportunidad real de conocer» al contratar (art. 7.a).
  - El TRLGDCU pide que se haga «referencia expresa» a ellas y que el consumidor pueda
    conocerlas antes de contratar (art. 80.1.a-b).
  - Un aviso que queda por debajo de la parte visible, y lejos del botón que se pulsa, es
    justo lo que un juez puede considerar que no dio esa oportunidad.
- **Arreglo.** Es parte de la fase 7 (§ 5, punto 5), porque sin él la versión guardada
  diría que se aceptó algo que no se mostró.
- **Edad (P3).** La línea de la edad (`auth.legalAge`) falta en `/acceder`, que también
  crea cuentas con Google. La puerta de edad del perfil sigue protegiendo, pero la línea
  debe acompañar al aviso.

<!-- Fuente: Ley 7/1998 art. 7.a; TRLGDCU art. 80.1.a-b; LSSI art. 27.4. -->

### 4.2 Las condiciones no dicen cómo se celebra el contrato ni si se archiva — P2

- **Qué exige la ley.** El art. 27.1 LSSI obliga a informar, antes de contratar, de:
  - a) los trámites;
  - b) «si el prestador va a archivar el documento electrónico en que se formalice el
    contrato y si éste va a ser accesible»;
  - c) cómo se corrigen los errores al introducir los datos;
  - d) las lenguas.
- **Qué hace hoy el producto.** Las condiciones no dicen nada de esto.
- **Por qué va con la fase 7.** En cuanto se guarde la versión, la letra b) tiene
  respuesta y hay que darla.
- **Texto**: § 6.A.

<!-- Fuente: LSSI art. 27.1 y 27.4. -->

### 4.3 No se confirma la aceptación — P2, **[abogado]**

- **Qué exige la ley.** El art. 28.1 LSSI obliga a confirmar que se ha recibido la
  aceptación, de una de estas formas:
  - un acuse por correo en 24 horas;
  - o una confirmación en el mismo medio, en cuanto termina el proceso, que el destinatario
    pueda archivar.
- **Qué hace hoy el producto.**
  - El correo de verificación (registro por correo) no menciona las condiciones.
  - Quien entra con Google o Apple no recibe ningún correo.
- **El arreglo más pequeño.** Una línea en el correo de verificación:
  - «Al crear tu cuenta aceptaste las condiciones de uso del {fecha}: {enlace}».
  - Para Google y Apple haría falta otro cauce.
- **No bloquea la fase 7**, salvo que el abogado diga otra cosa (§ 7).

<!-- Fuente: LSSI art. 28.1 y 28.3. -->

### 4.4 «Seguir usando NutrIA significa que lo aceptas» — P2, **[abogado]**

- **Qué dice la cláusula** (`es-ES.ts:2201`, `en-GB.ts:2167`): los cambios se aceptan por
  seguir usando el servicio. Es el punto débil del § 3.2.3 (TRLGDCU arts. 85.3 y 126 bis).
- **Una promesa que no puedo comprobar.** La misma sección promete un correo antes de que
  se aplique cualquier cambio importante.
  - Hubo cambios el 25/09 (edad mínima de 16 a 18) y el 28/09 (imágenes).
  - Este documento no puede afirmar si esos correos se enviaron. El propietario lo sabe.
  - Si no se enviaron, la cláusula prometía algo que no se hizo.
- **Qué hace la fase 7.** No reescribe esta cláusula. La versión guardada es lo que
  permitirá sustituir «seguir usando» por «volver a aceptar» cuando el abogado lo confirme.

## 5. La fase 7: exactamente qué se construye

Este apartado es el que copia la enmienda del plan.

1. **Documento**: solo `/condiciones` (namespace `terms`). La política de privacidad no se
   registra (§ 2).
2. **Versión**: `TERMS_VERSION = '2.0.0'` en `packages/core`, junto a las otras cuatro
   constantes (por ejemplo, en `entities/User` o donde `backend` prefiera).
   - «1.x» son los tres textos del 21, 25 y 28 de septiembre, que no se registraron y
     siguen en el historial del repositorio.
   - «2.0.0» es el primer texto registrado: el que publica la fase 7, con la sección del
     § 6.A.
   - Así lo proponía ya [`textos/03`](./textos/03-condiciones-uso.md).
3. **Almacenamiento**:
   - `user.termsVersion text` y `user.termsAcceptedAt timestamptz`, las dos nulas. No hay
     tabla nueva.
   - Se declaran en `additionalFields` de Better Auth con `input: false`, como `activatedAt`
     (`auth.config.ts:219-230`): ningún cliente puede escribirlas.
   - Una migración añade las columnas. **No hay relleno**: las cuentas anteriores se quedan
     con `null`, que significa «antes del registro», porque escribirles una versión sería
     afirmar algo que no se puede probar.
4. **Cuándo y quién las escribe**:
   - **Quién**: el servidor, en el mismo `INSERT` que crea la cuenta:
     `databaseHooks.user.create.before` (`auth.config.ts:124-136`), que devuelve los datos
     con `termsVersion: TERMS_VERSION` y `termsAcceptedAt: now`.
   - **Vías**: sirve para todas (correo, Google y Apple), porque todas pasan por ese hook.
   - **No viaja la versión desde el navegador**:
     - web y API se despliegan juntas y leen la misma constante de `core`, así que lo que
       se guarda es lo que se muestra;
     - la excepción aceptada es una pestaña que quedó abierta durante un despliegue que
       cambió el texto: esa persona vio el texto anterior y queda con la versión nueva;
     - es un caso raro, de minutos, y se acepta.
   - **Regla de subida**: cualquier cambio de significado en `terms`, en `es-ES.ts` o en
     `en-GB.ts`, sube `TERMS_VERSION` y `terms.updated` **en el mismo commit**. Una
     corrección de erratas no la sube.
5. **Cómo se muestra al registrarse** (arregla el § 4.1):
   - **Dónde**: `LegalNotice` y `auth.legalAge` tienen que verse **sin desplazar la
     pantalla, antes o inmediatamente junto a** cada control que puede crear una cuenta.
     En `/registro` son los botones de Google y Apple y «Crear cuenta»; en `/acceder`, los
     botones de Google y Apple.
   - **Colocación recomendada**: en las dos pantallas, justo encima de `SocialSignIn`, que
     precede a los dos caminos. Lo decide `frontend` con `apple-web-design`.
   - **Comprobación**: `accessibility` lo verifica con `/local-probe` a 320, 390 y 1280 px,
     en los dos temas.
   - **Texto en `/registro`**: `auth.legalNotice`, sin cambios.
   - **Texto en `/acceder`**: una clave propia, `auth.legalNoticeSignIn` (§ 6.C), porque
     allí «Al crear tu cuenta» se lee raro y quien crea la cuenta es quien entra con un
     proveedor por primera vez.
   - **Sin casilla**:
     - la ley no la exige para las condiciones (§ 3.1): basta un aviso claro, con enlace,
       junto al botón que se pulsa;
     - una casilla para las condiciones, además, se confundiría con los consentimientos de
       salud, que sí la tienen y deben seguir separados (RGPD art. 7.2).
6. **Consola**:
   - **Personas › Consentimientos** (fase 3 paso 3):
     - una fila «Condiciones de uso» con la versión vigente y el número de cuentas con
       esa versión, con una anterior y «sin registro» (`null`);
     - solo números (`0028`);
     - la política de privacidad no aparece.
   - **Ajustes › Sistema** (fase 3 paso 4): `TERMS_VERSION` junto a las demás versiones
     de consentimiento.
   - Las listas exactas de claves del e2e de administración se amplían en el mismo cambio.
7. **Textos en el mismo despliegue**: § 6.A (condiciones, con `terms.updated` nuevo) y
   § 6.B (privacidad, con `privacy.updated` nuevo).
   - El cambio de la política no toca la salud: **no** sube `HEALTH_CONSENT_VERSION`.
   - El de las condiciones es el que publica la 2.0.0.
   - Por lo que promete la cláusula de cambios (§ 4.4), una sección nueva **importante**
     obligaría a avisar por correo. Esta solo informa de cómo se contrata y no cambia
     ningún derecho ni obligación, así que la tengo por no importante. **[abogado]**, § 7.
8. **Qué pasa al borrar la cuenta.**
   - Las dos columnas desaparecen con la fila, porque viven en `user`.
   - Después del borrado no queda prueba de la aceptación. Para la cuenta gratuita no
     importa, y para Premium Stripe guarda su propio rastro del pago.
   - Si hay que conservar la prueba más allá del borrado (RGPD art. 17.3.e), lo dice el
     abogado (§ 7). Si dice que sí, cambia la política de privacidad, y no se hace en
     silencio.
9. **Pruebas** (`tests`):
   - una cuenta creada por correo y otra creada con Google (el stub de proveedor del e2e)
     tienen `termsVersion = TERMS_VERSION` y `termsAcceptedAt` no nulo;
   - un `POST` de registro con `termsVersion` en el cuerpo no lo escribe;
   - la respuesta de Consentimientos tiene la lista exacta de claves;
   - ninguna respuesta de la consola lleva la versión en una fila con dirección.
10. **Qué no hace la fase 7**:
    - volver a pedir la aceptación a las cuentas `null` o con una versión anterior;
    - la confirmación del art. 28 LSSI (§ 4.3);
    - reescribir la cláusula de cambios (§ 4.4);
    - la aceptación en el pago de Stripe (P2-6), que es otra cosa y sigue en la lista de
      Stripe *live*.

## 6. Los textos

### A. Condiciones de uso — sección nueva «Cómo se celebra este contrato»

**Dónde va**: namespace `terms`, `sections[]`, justo después de «Tu cuenta»
(`es-ES.ts:2131`, `en-GB.ts:2097`), con `id: 'contrato'`. Actualizar `terms.updated`. Es
lo que publica `TERMS_VERSION = '2.0.0'`.

**heading**: `Cómo se celebra este contrato` | `How this contract is made`

**list**:

| es-ES | en-GB |
| --- | --- |
| `Se celebra al crear tu cuenta: rellenas tu nombre, tu correo y una contraseña y pulsas «Crear cuenta», o entras por primera vez con Google o Apple. En los dos casos, el aviso que acompaña a esos botones te enlaza a estas condiciones.` | `It is made when you create your account: you fill in your name, email and a password and press "Create account", or you sign in with Google or Apple for the first time. Either way, the notice next to those buttons links to these terms.` |
| `Antes de pulsar puedes revisar y corregir lo que has escrito en cada campo, y si falta algo o no es válido te lo decimos antes de crear la cuenta.` | `Before you press, you can review and correct what you have typed in each field, and if something is missing or not valid we tell you before the account is created.` |
| `Guardamos qué versión de estas condiciones aceptaste y cuándo. Esta página muestra siempre la versión vigente, con su fecha, y puedes guardarla o imprimirla. Si quieres la versión que aceptaste, pídenosla en {email}.` | `We keep which version of these terms you accepted and when. This page always shows the current version, with its date, and you can save or print it. If you want the version you accepted, ask us at {email}.` |
| `Puedes contratar en español o en inglés.` | `You can contract in Spanish or English.` |

<!-- Fuente: LSSI art. 27.1.a (trámites), 27.1.c (corregir errores: RegisterScreen.tsx:40-44 valida la contraseña y el formulario muestra el error antes de crear nada), 27.1.b (archivo y acceso: las columnas del § 5.3; las versiones anteriores están en el historial del repositorio y el propietario puede enviarlas), 27.1.d (lenguas: es-ES y en-GB), 27.4 (almacenar y reproducir). Ley 7/1998 art. 5.1 (ejemplar). La frase «pídenosla» describe lo que el propietario puede hacer, no una función de la aplicación. Publicar solo con las columnas del § 5.3 en producción (antes, «Guardamos qué versión…» sería falso) y con el aviso ya colocado junto a los botones como pide el § 5.5 (antes, «el aviso que acompaña a esos botones» sería falso para Google y Apple). -->

> **Nota para `frontend`**: la página `/condiciones` ya pinta `sections[]` con `list`
> (la usa «Tu cuenta»); no hace falta componente nuevo.
>
> **Hay que comprobar un detalle**: la segunda frase dice que el error se muestra antes de
> crear la cuenta. Es verdad para la contraseña corta (`RegisterScreen.tsx:40-44`) y para el
> correo ya usado (`:58`). Si el formulario deja pasar un correo mal escrito hasta el
> servidor, la frase sigue siendo verdad, porque el servidor lo rechaza antes de crear la
> cuenta. Si no lo rechaza, díganmelo y la cambio.

### B. Política de privacidad — la línea «Cuenta»

**Dónde va**: namespace `privacy`, sección «Qué datos recogemos y para qué», primer
elemento de `list` (`es-ES.ts:1765`, `en-GB.ts:1724`). Se añade una frase y se actualiza
`privacy.updated`. No cambia ninguna versión de consentimiento.

| es-ES (sustituye) | en-GB (sustituye) |
| --- | --- |
| `Cuenta: tu nombre y tu correo y, si entras con Google o Apple, el nombre y el correo que ese servicio nos confirma, y qué versión de las condiciones de uso aceptaste al crearla y cuándo. Mientras tienes la sesión abierta guardamos la dirección IP y el navegador desde el que entraste, para poder cerrarla. Para que tengas una cuenta y solo tú entres en ella, y para poder demostrar qué condiciones aceptaste.` | `Account: your name and email and, if you sign in with Google or Apple, the name and email that service confirms to us, and which version of the terms of use you accepted when you created it and when. While you are signed in we keep the IP address and browser you signed in from, so we can end the session. So that you have an account and only you get into it, and so that we can show which terms you accepted.` |

<!-- Fuente: RGPD art. 13.1.c (fines) y 6.1.b (contrato; la prueba de su celebración es parte de él) — alternativa 6.1.f si el abogado la prefiere, § 7. Es la misma frase que textos/02 ya usa para el acuerdo del profesional («la versión del acuerdo que aceptaste»). Publicar en el mismo despliegue que las columnas. -->

> Si [`textos/02`](./textos/02-politica-privacidad.md) sustituye entera a la política
> antes que la fase 7, esta frase se añade también allí. Queda anotado en su cabecera.

### C. El aviso en `/acceder`

**Dónde va**: `auth.legalNoticeSignIn` (clave nueva, en `es-ES.ts` y `en-GB.ts` a la vez).
La pinta `LegalNotice` en `SignInForm.tsx` en lugar de `auth.legalNotice`, con los mismos
marcadores. `auth.legalAge` se pinta a continuación, como en `/registro`.

| es-ES | en-GB |
| --- | --- |
| `Si es la primera vez que entras con Google o Apple, se crea tu cuenta y aceptas las {terms}. Cómo tratamos tus datos te lo explica la {privacy}.` | `If this is the first time you sign in with Google or Apple, your account is created and you accept the {terms}. How we handle your data is explained in the {privacy}.` |

<!-- Fuente: Ley 7/1998 arts. 5.1 y 7.a; TRLGDCU art. 80.1.a; 0058 (Google y Apple crean la cuenta desde /acceder). Mientras Apple siga apagado, «o Apple» es verdad solo en el sentido de lo que el botón haría: si frontend prefiere, que la clave dependa de los proveedores activos como ya lo hace SocialSignIn; decisión suya. -->

## 7. Confirmar con un abogado (añadir al [`analisis.md` § 10](./analisis.md#10-confirmar-con-un-abogado))

1. **La cuenta gratuita y el Libro II del TRLGDCU.** ¿Entra la cuenta gratuita en el art.
   59.4, dado que el uso del producto se registra por interés legítimo? (§ 3.3)
2. **El art. 28 LSSI en la cuenta gratuita.** ¿Hace falta confirmar la aceptación? ¿Basta
   una línea en el correo de verificación, y qué cauce sirve para quien entra con Google o
   Apple? (§ 4.3)
3. **La cláusula de cambios.** ¿Vale «seguir usando = aceptar» frente a consumidores, o hay
   que volver a pedir la aceptación a quien tenga una versión anterior, y con qué preaviso?
   Y qué hacer si los correos de los cambios del 25 y el 28 de septiembre no se enviaron.
   (§ 4.4)
4. **La sección del § 6.A.** ¿Es un cambio «importante» que obliga a avisar por correo
   según la propia cláusula? (§ 5.7)
5. **La prueba después del borrado.** ¿Hay que conservar la versión y la fecha de la
   aceptación cuando se borra la cuenta, y cuánto tiempo? (RGPD art. 17.3.e) (§ 5.8)
6. **La base jurídica de guardar la versión.** ¿Es el art. 6.1.b o el 6.1.f? (§ 6.B)

## 8. Fuera de D5, encontrado al leer — P1 para `frontend` (a través del lead)

- **El fallo.**
  - `HealthPanel.tsx:46` fija `CONSENT_VERSION = '1.0.0'` y lo envía al guardar
    (`:106`).
  - El API exige `z.literal(HEALTH_CONSENT_VERSION)` = `'1.1.0'` (`packages/core/src/entities/Health/Health.ts:47,97`,
    vía `SetHealthDataDto`).
  - Desde #106 (25/09), guardar la sección de salud de `/perfil` se rechaza por validación.
- **Qué significa jurídicamente.** No es tratar datos sin base: el servidor no guarda nada
  sin la versión vigente. Pero una persona no puede dar el consentimiento que la política
  le ofrece.
- **Qué verá la consola.** La página de Consentimientos de la fase 3 mostrará cero
  consentimientos de salud en la versión vigente desde esa fecha.
- **Arreglo**: importar `HEALTH_CONSENT_VERSION` de `core/entities/Health`, como
  `ProfileConsentInterstitial.tsx:13` hace con el suyo.
- **Comprobación pendiente**: el texto que pinta la casilla debe ser el de la 1.1.0
  ([`textos/05`](./textos/05-consentimientos-cliente.md)). Si no lo es, la versión también
  sube con él.

## Fuentes consultadas (2026-09-29)

- **RGPD** — Reglamento (UE) 2016/679, texto del DOUE en BOE (`DOUE-L-2016-80807`): arts.
  5.2, 6.1.b, 7.1-7.4 y 13.1; considerandos 32 y 43.
- **LOPDGDD** — LO 3/2018, BOE-A-2018-16673, consolidada a 27/12/2025: art. 6.3.
- **CEPD** — Directrices 05/2020 sobre el consentimiento, versión 1.1 (13/05/2020): §§ 13,
  26, 71, 81, 104-107.
- **LSSI-CE** — Ley 34/2002, BOE-A-2002-13758, consolidada a 23/01/2025: arts. 23, 24, 27 y
  28.
- **Ley 7/1998** (condiciones generales), BOE-A-1998-8789, consolidada a 16/03/2019: arts.
  5 y 7.
- **Ley 3/2014**, BOE-A-2014-3329: disposición derogatoria única.
- **RD 1906/1999**, BOE-A-1999-24914: derogado el 29/03/2014.
- **TRLGDCU** — RDLeg. 1/2007, BOE-A-2007-20555, consolidado a 28/02/2026: arts. 59.4,
  63.1, 80.1, 85.3, 97.8, 98.7 y 126 bis.
