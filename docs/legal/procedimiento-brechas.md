# Procedimiento de brechas de datos personales

> **Propósito**: qué hacer, en orden, cuando algo pueda haber expuesto, alterado o hecho
> perder datos personales de NutrIA, escrito para **una sola persona** (el propietario,
> persona física, sin equipo) que lo lee a las 3 de la mañana. Cubre los arts. 33 y 34 del
> RGPD, la guía y el formulario de la AEPD y las infracciones de la LOPDGDD. **Audiencia**:
> el propietario; el lead y los agentes, como referencia. **Committed**: sí — no contiene
> nombres, correos, teléfonos ni nombres de dispositivos: lo que el propietario debe
> rellenar va marcado **⟦…⟧** y se rellena **fuera del repositorio** (ver § 9).
> **Mantenido por**: el agente `legal`; se revisa cuando cambie un proveedor, un secreto o
> un flag, y tras cada incidente.
>
> **No soy abogado.** Cada regla cita su fuente; lo interpretable va marcado **[abogado]**.

**Fuentes** (verificadas el 2026-09-25):
- **RGPD**: arts. 4.12 (definición de violación de seguridad), 28.3.f (el encargado ayuda con los arts. 32 a 36), 33 y 34 — texto del DOUE en BOE, `DOUE-L-2016-80807`.
- **LOPDGDD** (LO 3/2018, BOE-A-2018-16673, consolidada a 27/12/2025): art. 73.q-s (infracciones graves) y art. 74.m-ñ (leves).
- **AEPD**, *Guía para la notificación de brechas de datos personales*, v. junio de 2021: la guía de referencia.
- **AEPD**, *Formulario de notificación de brechas de datos personales*: el PDF, y el mismo formulario en la sede electrónica.
- **AEPD**, herramientas *Asesora Brecha* y *Comunica-Brecha RGPD*.
- **Documentación de los proveedores** del § 7.

---

## 0. La tarjeta de las 3 de la mañana

1. **Respira y apunta la hora** en que supiste que había datos personales afectados: desde ese momento cuentan las **72 horas** (fines de semana y festivos incluidos).
2. **Contén** (§ 3): corta el acceso que está pasando.
3. **Guarda pruebas antes de borrar nada** (§ 4). Los registros de Vercel duran **una hora** en el plan Hobby.
4. **Abre la entrada del registro** (§ 8) y escribe lo que sabes, aunque sea poco.
5. **Antes de 72 horas**: decide y, si toca, **notifica a la AEPD** (§ 5); vale una notificación inicial incompleta.
6. **Si el riesgo es alto**, **avisa a las personas afectadas** (§ 6) sin dilación.
7. **Duerme.** Lo demás tiene plazo de 30 días.

<!-- Fuente: RGPD art. 33.1 («a más tardar 72 horas después de que haya tenido constancia»), 33.4 (información gradual), 33.5; AEPD guía, § «Plazos para notificar» (el plazo corre «incluyendo las horas trascurridas durante fines de semana y días festivos»; notificación inicial y modificación en 30 días). -->

---

## 1. Qué es una brecha aquí

Una brecha es «toda violación de la seguridad que ocasione la destrucción, pérdida o
alteración accidental o ilícita de datos personales… o la comunicación o acceso no
autorizados a dichos datos» (art. 4.12 RGPD). Afecta a la **confidencialidad** (alguien
vio lo que no debía), la **integridad** (alguien lo cambió) o la **disponibilidad** (se
perdió o no se puede usar). No hace falta que haya un atacante: un error propio cuenta.

En NutrIA casi todo es **dato de salud** (alergias, peso, objetivo, condiciones,
medicación; ver `analisis.md` § 1.2). Eso sube el riesgo de cualquier brecha.

| Situación | ¿Brecha? | Qué datos | Punto de partida |
| --- | --- | --- | --- |
| **La URL de la base de datos se filtra** (`DATABASE_URL` o `DIRECT_DATABASE_URL` en un commit, un log, una captura o un chat) | **Sí**, aunque no se sepa si alguien entró: hubo posibilidad de acceso no autorizado a todo | Todo: cuentas, salud, planes | § 3, fila A. Casi seguro: **notificar** |
| **Un profesional lee a un cliente después de terminar el enlace** (sale en `care_access_log` una fila `read` con fecha posterior a `care_links.endedAt`) | **Sí**: acceso no autorizado a datos de salud por un fallo del control de acceso | Lo que devuelve la ficha (`analisis.md` § 1.4) | Fila B. **Notificar**; **comunicar** al cliente |
| **Un correo a la persona equivocada**. Por ejemplo, un profesional teclea mal la dirección de una invitación. | Solo si el correo lleva datos de otra persona. La invitación solo nombra al profesional y no dice nada del paciente al que iba dirigida (`CareInvitation.ts`, `0059`), así que en principio **no** es brecha del paciente. **Registrar igualmente.** | Nombre del profesional | Fila C |
| **Un correo de aviso de check-in llega a otro profesional** (fallo de código) | **Sí**: revela que esa persona es paciente de un dietista | Nombre del cliente y relación asistencial | Fila C. **Notificar** |
| **Neon comprometido** (lo avisa Neon o lo ves en su estado) | **Sí** si llegó a los datos | Todo | Fila D |
| **Vercel comprometido** (variables de entorno o despliegues) | **Sí**: las variables dan acceso a la base de datos | Todo | Fila D + fila A |
| **Sentry comprometido** | Probablemente **no**: Sentry no recibe cuerpos, usuarios ni cabeceras (`apps/api/src/shared/observability/ErrorReporter.ts:45-110`). **Registrar**, y comprobar que ningún error llevaba datos | Pilas de error | Fila D |
| **Portátil perdido o robado** con `docs/local`, exportaciones de la base de datos o sesiones abiertas | **Sí** si tenía datos personales (una exportación los tiene todos) y el disco **no** estaba cifrado; si estaba cifrado con clave segura, el riesgo es improbable: **registrar** | Según lo que hubiera | Fila E |
| **Dispositivo robado con una sesión abierta** del propietario (acceso a `/admin`) | Posible: `/admin` no lee datos de nadie (`0028`), pero concede profesionales y enciende flags | Según lo que se hiciera con ella | Fila E |
| **Dispositivo robado de un usuario** con su sesión | Es un problema de esa persona, no una brecha de NutrIA, salvo que NutrIA haya fallado. Ayúdale: revoca sus sesiones. **Registrar** si te lo cuenta | Sus propios datos y la copia sin conexión de su plan | Fila E |
| **Una clave de la IA filtrada** (`OPENROUTER_API_KEY`, y las antiguas `OMNIROUTE_API_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`) | Normalmente **no** es brecha de datos personales: el prompt no lleva identificadores ni salud (`PoolPrompt.ts`, versión 4.1.0) y, con el registro de prompts apagado, OpenRouter no guarda contenido que la clave deje leer (solo metadatos en su página de actividad). Es un riesgo de coste, limitado por el tope de la clave. **Registrar** | — | Fila F |
| **Una petición a la IA la responde una empresa fuera de la lista permitida** (se ve en `/admin`) | No es brecha si la petición no identifica a nadie, pero la política diría algo falso: volver a `AI_PROVIDER=stub`, corregir la lista en la cuenta de OpenRouter y **registrar** | La petición (sin identificadores) | Fila F |
| **Borrado o corrupción** de datos por un fallo o una migración | **Sí** (disponibilidad o integridad), aunque se restaure; si se restaura pronto y nadie más lo vio, el riesgo suele ser improbable | Lo afectado | Fila G |
| **Un profesional difunde fuera de NutrIA lo que vio** (capturas, mensajes) | **Brecha del profesional**, que es responsable independiente (§ 10); NutrIA actúa para cortar el acceso y registra | Lo que difundiera | § 10 |

<!-- Fuente: RGPD art. 4.12; AEPD guía, § sobre tipos de brecha (confidencialidad, integridad, disponibilidad) y formulario § 6 («Datos personales enviados por error», «Dispositivo perdido o robado», «Ciberincidente: acceso no autorizado a datos en sistema TI»). -->

---

## 2. Antes de que pase: lo que tiene que estar listo

Todo esto se hace una vez y se rellena **fuera del repositorio** (§ 9):

- ⟦Cómo entras en la sede electrónica de la AEPD: DNIe, certificado FNMT de persona física o Cl@ve permanente, y en qué dispositivo⟧. Pruébalo antes de necesitarlo.
- ⟦Correo de las cuentas de Vercel, Neon, Stripe, Sentry, Google y OpenRouter⟧: es por donde los proveedores avisan de sus brechas. Tiene que llegarte al móvil.
- ⟦Dónde guardas el registro de incidentes y cómo lo respaldas⟧ (§ 8).
- ⟦Dispositivos con acceso de administrador⟧: portátil, teléfono; ¿disco cifrado?, ¿bloqueo con código?
- ⟦Dónde está alojada la pasarela OmniRoute y cómo entrar⟧.
- Las exportaciones manuales de la base de datos, cifradas y borradas a los 30 días (P1-6). Si no lo están, un portátil perdido es una brecha de todos los usuarios.

---

## 3. La primera hora — contener

Haz solo lo que corte el daño. Cada paso, anótalo con la hora en el registro (§ 8).

**Siempre primero**: guarda lo que caduca (§ 4, pasos 1 y 2) **antes** de revocar
sesiones o rotar secretos, porque borrar sesiones borra también quién estaba conectado.

### Fila A — un secreto filtrado (o Vercel comprometido)

1. Identifica **qué** secreto. Todos viven en el proyecto `nutria-api` de Vercel
   (Settings → Environment Variables). Los que dan acceso a datos personales, en orden:
   - `DATABASE_URL`, `DIRECT_DATABASE_URL`: en Neon, Console → el proyecto → **Roles** → *Reset password* del rol de la aplicación. Pon la nueva cadena en Vercel (**Production**) y redespliega. Hasta que redespliegues, la API está caída: es aceptable.
   - `BETTER_AUTH_SECRET`: genera uno nuevo (32 bytes aleatorios), ponlo en Vercel y redespliega. **Efectos**: se cierran todas las sesiones, los enlaces de activación pendientes dejan de valer y los tokens OAuth guardados cifrados (`encryptOAuthTokens`) no se podrán descifrar. Nada de eso se usa para servir el producto: es aceptable.
   - `SMTP_PASS`: revoca la contraseña de aplicación en la cuenta de Google y crea otra.
   - `STRIPE_SECRET_KEY`: en Stripe, Developers → API keys → *Roll key*. `STRIPE_WEBHOOK_SECRET`: en el endpoint del webhook, *Roll secret*.
   - `GOOGLE_OAUTH_CLIENT_SECRET`, `APPLE_OAUTH_PRIVATE_KEY`: rótalos en la consola de Google Cloud y en Apple Developer.
   - `CRON_SECRET`, `VAPID_PRIVATE_KEY`: rota el primero; el segundo solo si se filtró, porque rotarlo deja sin avisos a todos los teléfonos suscritos.
   - Claves de la IA: `OPENROUTER_API_KEY` en openrouter.ai → *Keys* (bórrala y crea otra con la misma *guardrail*: dos modelos, ZDR, tope); las antiguas (`OMNIROUTE_API_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`) y la clave de gestión de la pasarela, si existen, en su panel.
2. Si el secreto estaba en un **commit** del repositorio público, rotarlo es lo único que
   sirve: reescribir la historia no lo borra de las copias que ya existan.
3. Si fue **Vercel** el comprometido: rota **todos** los secretos de la lista, revisa en
   Vercel los despliegues y los miembros del equipo de los últimos días, y cambia la
   contraseña y el segundo factor de la cuenta.

### Fila B — un profesional ve lo que no debe

1. **Apaga el interruptor `professional`** en `/admin`. Se cierra `/consulta` para todos
   en la siguiente petición; los clientes siguen con sus cuentas (`0059`, `0061`).
2. Si es un solo profesional, **retira su concesión** en `/admin` (Retirar) en vez de apagarlo todo.
3. No vuelvas a encender hasta tener el fallo corregido y probado.

### Fila C — un correo a quien no debía

1. Si es un fallo de código que se repite (avisos de check-in, invitaciones), **apaga lo
   que envía**: el interruptor `professional` cierra la consulta y sus avisos, y
   `checkInReminders` los recordatorios.
2. Escribe a quien lo recibió pidiéndole que lo borre y te lo confirme por escrito. Con esa
   confirmación, el riesgo puede pasar a improbable (§ 5).

### Fila D — un proveedor comprometido (Neon, Vercel, Sentry)

1. Lee su aviso: qué datos, qué fechas, qué te piden hacer. Sigue sus pasos.
2. Rota los secretos de ese proveedor (fila A).
3. Si fue **Neon** y hay duda sobre la integridad de los datos, crea una rama desde un
   instante anterior al incidente (Console → Branches → *Create branch* → *From a point in
   time*; `docs/reference/deployment.md` § 8). No sobrescribe nada, así que sirve de prueba
   y de plan de restauración.

### Fila E — un dispositivo perdido o robado

1. **Tu dispositivo**:
   - cambia las contraseñas de Vercel, Neon, Stripe, Google y GitHub;
   - cierra las sesiones de esos servicios desde otro equipo;
   - revoca tu sesión de NutrIA: borra tus filas de `session`, tras guardarlas (§ 4).
   - Si el dispositivo tenía exportaciones o `docs/local` y el disco no estaba cifrado, trátalo como la **fila A** además: rota los secretos.
2. **Dispositivo de un usuario**:
   - borra sus filas de `session`: lo desconecta en la siguiente petición, porque la sesión se relee en cada petición (`docs/ARCHITECTURE.md` § Invariants);
   - dile que cambie la contraseña;
   - la copia sin conexión del plan se borra al cerrar sesión en ese navegador (`0053`).
3. **Borrar sesiones** es una escritura en producción: la haces tú, a mano, en Neon (SQL
   Editor). Para una persona: `delete from session where "userId" = ⟦id⟧;`. Para todas,
   más rápido: rotar `BETTER_AUTH_SECRET` (fila A).

### Fila F — una clave de IA filtrada

1. Rota la clave (fila A).
2. Revisa el gasto en el panel del proveedor.
3. Registra el incidente. Normalmente no hay nada más: no es brecha de datos personales.

### Fila G — datos borrados o corrompidos

1. **Para las escrituras**: pon la API en pausa desde Vercel (Settings → *Pause project*)
   o despliega la versión anterior.
2. Restaura desde una rama de Neon en un instante anterior (fila D, paso 3).
3. Comprueba con los recuentos de filas que todo volvió.

<!-- Fuente: nombres de variables, apps/api/src/config/Env.validation.ts y ErrorReporter.ts (allSecrets); flags, packages/core/src/domain/Flag/Flag.ts:15 (automaticActivation, checkInReminders, premium, professional); sesión, apps/api/src/modules/auth/auth.config.ts (encryptOAuthTokens, SESSION_MAX_AGE_DAYS), BETTER_AUTH_SECRET también firma los enlaces de activación (selfService.link.secret); ProfessionalGuard relee la concesión y el interruptor en cada petición. RGPD art. 32 y 33.3.d (medidas). -->

---

## 4. La primera hora — guardar pruebas

Guarda las pruebas en la carpeta del incidente, fuera del repositorio (§ 9). Van en este
orden **porque caducan en este orden**:

1. **Registros de Vercel** — proyectos `nutria-api` y web → *Logs*. En el plan Hobby
   Vercel guarda **solo una hora** de registros. Filtra por el intervalo, la ruta (por
   ejemplo `/api/v1/care/*`) y el código de estado, y copia o exporta lo que salga.
   Anota los `requestId`. Los registros no llevan datos de salud: pino los redacta.
2. **Sesiones**, antes de borrarlas. En Neon, SQL Editor, solo lectura:
   `select id, "userId", "ipAddress", "userAgent", "createdAt", "expiresAt" from session where …;`.
   Guarda el resultado.
3. **El rastro del profesional**, si el incidente es de la consulta. Solo lectura:
   `select * from care_access_log where "professionalId" = ⟦id⟧ and "createdAt" >= ⟦desde⟧ order by "createdAt";`.
   Crúzalo con `select id, status, "endedAt", "endedBy" from care_links where "professionalId" = ⟦id⟧;`.
   Una fila `read` o `write` posterior a `endedAt` es la prueba. El rastro no guarda qué
   datos exactos se leyeron: `kind` dice de qué tipo eran.
4. **Neon**: si puede haber alteración, crea una rama en un instante anterior (§ 3, fila
   D) como foto. Revisa *Operations* y *Roles* del proyecto.
5. **Sentry**, si está activado: los *issues* del intervalo.
6. **Stripe**, si afecta a pagos: Developers → *Logs* y *Events*.
7. **El correo enviado**, si fue un correo: la copia en la carpeta de enviados de la cuenta SMTP.
8. **GitHub**, si fue un secreto en un commit: el enlace al commit y cuándo se publicó.

No toques ni borres nada que no sea necesario para contener. Anota quién, qué y cuándo
de cada acción tuya.

<!-- Fuente: Vercel, documentación «Runtime Logs» (actualizada 28/08/2026): «Hobby — 1 hour of logs; Pro — 1 day of logs»; care_access_log y care_links (packages/database/src/schemas/care.schema.ts); RGPD art. 33.5 (documentar los hechos). -->

---

## 5. Las 72 horas — decidir y notificar a la AEPD

### 5.1 La prueba de riesgo, en tres preguntas

1. **¿Hubo datos personales afectados?** Si no hubo ninguno (por ejemplo, una clave de la
   IA), **no hay brecha**. Regístralo como incidente y termina.
2. **¿Es *improbable* que haya riesgo para las personas?** Solo si se cumple alguno de estos:
   - los datos eran **ininteligibles** para quien los tuvo (cifrados con una clave que no se filtró);
   - quien los recibió es de **confianza**, los ha **borrado** y lo ha **confirmado por escrito**, y no los usó;
   - se **recuperaron** enseguida sin que nadie los viera (solo disponibilidad).

   Si no puedes afirmar ninguna con pruebas, **hay riesgo**: con datos de salud, casi
   siempre. → **Notifica a la AEPD.**
3. **¿Es probable un riesgo *alto*?** Con datos de salud vistos por alguien no autorizado
   que no es de confianza, o por un número indeterminado de personas: **sí**. → Además,
   **comunícalo a las personas afectadas** (§ 6).

En caso de duda, las herramientas de la AEPD **Asesora Brecha** (¿notifico?) y
**Comunica-Brecha RGPD** (¿comunico a los afectados?) guían las mismas preguntas.
Guarda su resultado en el registro.

<!-- Fuente: RGPD art. 33.1 («a menos que sea improbable que dicha violación de la seguridad constituya un riesgo»), 34.1 («alto riesgo»), 34.3.a-b (cifrado; medidas ulteriores); AEPD guía, apartado de evaluación del riesgo (el riesgo se mide para las personas, no para la organización), y sus herramientas. Formulario AEPD § 6: «pérdida de confidencialidad de datos afectados por secreto profesional» es una consecuencia listada. -->

### 5.2 Cómo se notifica

- **Dónde**: sede electrónica de la AEPD (`sedeagpd.gob.es`), trámite de notificación de
  brechas de datos personales. Se entra con **certificado electrónico reconocido** (DNIe o
  certificado FNMT de persona física) o **Cl@ve permanente**.
- **Como persona física**, el propietario no está obligado a relacionarse por medios
  electrónicos (Ley 39/2015, art. 14.1). Por eso puede usar también el **formulario en
  PDF** de la AEPD por registro, pero la sede es más rápida y deja constancia inmediata.
- **Por fases**: si a las 72 horas no lo sabes todo, envía una notificación **inicial**
  con lo que tengas y tus estimaciones. Complétala con una **modificación**, dando el
  número de registro de la inicial, **antes de 30 días** (días hábiles, según la guía).
  Por regla general se admite una sola modificación.
- **Si llegas tarde**: notifica igual, explicando el motivo del retraso (art. 33.1).

**Qué pregunta el formulario** (sus 15 apartados). Tenlo a mano:

| § | Pregunta | Qué pones en NutrIA |
| --- | --- | --- |
| 1 | Responsable | tu nombre, NIF, dirección, teléfono, correo; «autónomo o microempresa»; sector ⟦el de la lista que corresponda: salud / servicios de la sociedad de la información⟧ |
| 2 | Encargado implicado | el proveedor, si fue suyo (Neon, Vercel…) |
| 3 | DPD o contacto | no hay DPD; tú como contacto |
| 4 | Tipo | nueva o modificación (con el registro de la anterior) |
| 5 | Tratamiento | desde cuándo (menos de 1 año / de 1 a 5); número aproximado de personas en el tratamiento; ámbito (España nacional, o más Estados si hay usuarios de fuera) |
| 6 | La brecha | accidental o intencionada, interna o externa, cómo ocurrió; confidencialidad, integridad o disponibilidad; ¿datos ininteligibles?; consecuencias y gravedad |
| 7 | Tipos de datos | **salud**; identificativos; contacto; en su caso, creencias |
| 8 | Perfil de afectados | usuarios / pacientes; posibles menores: no, por la puerta de 18 años |
| 9 | Transfronterizo | si hay afectados en otros Estados |
| 10 | Fechas | inicio, detección, contención |
| 11 | Medidas previas | las de `eipd.md` § 4 que estuvieran implantadas; ¿había análisis de riesgos? sí: la EIPD |
| 12 | Acciones tras el incidente | lo hecho en §§ 3-4; si se denunció a la policía |
| 13 | Comunicación a afectados | sí / no / se hará; fecha, número, medio |
| 14 | Documentación | adjuntos |
| 15 | Completa o por fases | lo dicho arriba |

<!-- Fuente: AEPD guía, § «Cómo se debe notificar» (certificado reconocido o Cl@ve permanente; el PDF para quien no esté obligado a relacionarse electrónicamente, nota 24) y § «Carácter de la notificación» (nueva completa o inicial; modificación en 30 días con el número de registro; «de forma general, está prevista una única modificación»); formulario AEPD, apartados 1 a 15. -->

### 5.3 Qué pasa si no se hace

No notificar una brecha que había que notificar es infracción **grave** (LOPDGDD art.
73.r). No comunicarla a los afectados cuando la AEPD lo ha requerido también es grave
(art. 73.s). Notificar incompleto, tarde o mal (art. 74.m) y no documentarla (art. 74.n)
son infracciones **leves**. Notificar a tiempo, aunque sea incompleto, es siempre mejor
que esperar a tenerlo todo.

---

## 6. Avisar a las personas afectadas (art. 34)

**Cuándo**: si el riesgo es **alto** (§ 5.1, pregunta 3), **sin dilación indebida**. No
hace falta si se cumple una de estas condiciones:
- los datos estaban cifrados de forma que nadie no autorizado puede leerlos;
- ya tomaste medidas que eliminan el alto riesgo;
- avisar persona a persona supone un esfuerzo desproporcionado. En ese caso, publica un
  aviso público igual de eficaz (por ejemplo, un aviso en la web y en `/inicio`).

**Qué debe decir**, en lenguaje claro: qué pasó; un contacto; las consecuencias
probables; lo que has hecho y lo que la persona puede hacer.

**Cómo**: un correo a cada persona, desde la misma dirección de siempre, **sin** poner a
todos en copia (un correo a varios destinatarios sin copia oculta es, en sí mismo, una
brecha). Usa el idioma de la cuenta (`profiles.locale`).

### Plantilla (español)

**Asunto**: Un problema de seguridad que afecta a tus datos en NutrIA

> Hola, {nombre}:
>
> Te escribimos para contarte un problema de seguridad que afecta a tus datos en NutrIA.
>
> **Qué ha pasado.** El {fecha}, {descripción en una o dos frases: por ejemplo, «un fallo
> permitió que un dietista que ya no estaba vinculado contigo viera tu plan y tu peso
> durante unas horas», o «una clave de acceso a nuestra base de datos quedó expuesta»}. Lo
> supimos el {fecha de detección} y lo cortamos el {fecha de contención}.
>
> **Qué datos tuyos.** {Lista concreta: tu nombre, tus objetivos, tu peso a lo largo del
> tiempo, tus alergias… Solo lo que de verdad esté afectado.}
>
> **Qué puede suponer para ti.** {Consecuencia probable en términos sencillos: que una
> persona ajena conozca esos datos de salud; que recibas correos de suplantación…}
>
> **Qué hemos hecho.** {Medidas: cerramos el acceso, cambiamos las claves, corregimos el
> fallo, lo hemos notificado a la Agencia Española de Protección de Datos.}
>
> **Qué puedes hacer tú.** {Consejos concretos: cambia tu contraseña si la usas en otro
> sitio; desconfía de correos que digan venir de NutrIA y te pidan datos; no hace falta que
> hagas nada más.}
>
> Si tienes cualquier duda, responde a este correo o escríbenos a {email}. También
> puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).
>
> Sentimos lo ocurrido.
>
> {name}, NutrIA

Para las cuentas en inglés, traduce con el mismo orden de apartados.

<!-- Fuente: RGPD art. 34.1 («sin dilación indebida»), 34.2 («en un lenguaje claro y sencillo… como mínimo la información y las medidas a que se refiere el artículo 33, apartado 3, letras b), c) y d)»), 34.3.a-c (excepciones; comunicación pública), 34.4 (la AEPD puede exigirla); formulario AEPD § 6 («envío de email a múltiples destinatarios sin copia oculta» como tipo de brecha) y § 13 (fecha, número y medio). {name} y {email} son los marcadores de legalIdentity.ts. -->

---

## 7. Los encargados y su deber hacia NutrIA

Cada encargado debe avisar a NutrIA **sin dilación indebida** de las brechas que conozca
(art. 33.2) y ayudarle a cumplir los arts. 32 a 36 (art. 28.3.f). La AEPD recomienda que
ese plazo no pase de 72 horas. Su aviso **no** sustituye tu notificación: la evaluación
del riesgo y la notificación a la AEPD son tuyas.

| Proveedor | Qué trata | Dónde está su compromiso | Por dónde avisa | Estado del servicio |
| --- | --- | --- | --- | --- |
| **Vercel** | API y web; variables de entorno con todos los secretos | DPA, `vercel.com/legal/dpa`, § 8.c: avisa «without undue delay» tras confirmar un incidente | Al correo de la cuenta ⟦cuenta de Vercel⟧ | `vercel-status.com` |
| **Neon** | La base de datos | DPA, `neon.com/dpa` ⟦comprobar plazo y canal en su cláusula de incidentes⟧ | Al correo de la cuenta ⟦cuenta de Neon⟧ | `status.neon.tech` |
| **Stripe** | Cobros | DPA, `stripe.com/legal/dpa` ⟦comprobar⟧; con *Managed Payments*, Link es además responsable de su venta | Al correo de la cuenta ⟦cuenta de Stripe⟧ | panel de Stripe |
| **Proveedor de correo (Google, SMTP)** | Todos los correos | Una cuenta Gmail de consumo **no** tiene DPA (P2-10); Google Workspace sí, `workspace.google.com/terms/dpa_terms.html` | ⟦cuenta de Google⟧ | — |
| **Sentry** (si está activo) | Errores sin datos personales | DPA, `sentry.io/legal/dpa/` ⟦comprobar⟧ | ⟦cuenta de Sentry⟧ | `status.sentry.io` |
| **OpenRouter** (tras `0064`) | Prompts sin identificadores; metadatos de cada llamada | El DPA que sus condiciones § 10.2 incorporan ⟦comprobar plazo y canal en el texto obtenido (P1-11)⟧; el DPA Enterprise (§ 7) dice «without undue delay, and in any case, within seventy-two (72) hours» | ⟦cuenta de OpenRouter⟧ | `status.openrouter.ai` |
| **Quien ejecuta el modelo** (DeepInfra, CoreWeave) | La petición, sin identificadores, solo mientras responde (retención cero) | Sin contrato con NutrIA: su compromiso es con OpenRouter (`analisis.md` § 4.4 b); te enterarías por OpenRouter o por la prensa | — | — |
| **Pasarela OmniRoute** | Solo experimentos desde `0064` | La alojas tú ⟦dónde está alojada⟧ | — | — |

<!-- Fuente: RGPD arts. 33.2 y 28.3.f; AEPD guía, § «Plazos para notificar» («no debería ser superior a las 72 horas»); Vercel DPA § 8.c, consultado el 2026-09-25 («upon becoming aware of a confirmed Security Incident, Vercel will notify Customer without undue delay»; y «Customer is solely responsible for complying with Security Incident notification laws applicable to Customer»). Las demás cláusulas no se pudieron leer sin JavaScript: ⟦comprobar⟧. -->

---

## 8. El registro de incidentes (art. 33.5)

**Toda** brecha se documenta, **también las que no se notifican**: los hechos, sus
efectos y las medidas tomadas. El registro es lo que la AEPD pide para comprobar que
decidiste bien. Apunta además los incidentes que resultaron no ser brechas, con el porqué.

**Dónde**: ⟦fuera del repositorio público — por ejemplo `docs/local/brechas/`, que no se
publica, con una copia cifrada en otro sitio, porque `docs/local` no tiene copia de
seguridad⟧. Un registro de incidentes en un repositorio público es un mapa para un
atacante. **Nunca** pongas en él datos de salud ni nombres de afectados: cuenta personas,
no las nombres.

### Plantilla de una entrada

| Campo | Valor |
| --- | --- |
| Número | ⟦AAAA-NN⟧ |
| Detectado (fecha y hora) | cuándo tuviste constancia; desde aquí cuentan las 72 h |
| Ocurrido (desde–hasta) | |
| Cómo se detectó | aviso de proveedor, usuario, revisión propia… |
| Qué pasó | dos o tres frases |
| Tipo | confidencialidad / integridad / disponibilidad |
| Datos afectados | categorías (salud, contacto…) y número aproximado de registros |
| Personas afectadas | número aproximado; ¿profesionales?; ¿menores? |
| Origen | interno / encargado (cuál) / externo; accidental / intencionado / desconocido |
| Contención (§ 3) | cada acción con su hora |
| Pruebas (§ 4) | qué se guardó y dónde |
| Evaluación del riesgo (§ 5.1) | improbable / riesgo / alto riesgo, **y por qué**; resultado de Asesora Brecha / Comunica-Brecha |
| Notificación AEPD | no (motivo) / inicial (fecha, n.º de registro) / modificación (fecha) |
| Comunicación a afectados | no (motivo, art. 34.3) / sí (fecha, número, medio) |
| Profesionales informados (§ 10) | |
| Denuncia policial | sí / no |
| Causa y medidas para que no se repita | |
| Cerrado (fecha) | |

### Resumen (una fila por incidente)

| N.º | Detectado | Tipo | Personas | Riesgo | AEPD | Afectados | Cerrado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | |

<!-- Fuente: RGPD art. 33.5 («documentará cualquier violación de la seguridad de los datos personales, incluidos los hechos relacionados con ella, sus efectos y las medidas correctivas adoptadas»); LOPDGDD art. 74.n (no documentarla es infracción leve); formulario AEPD § 12 («¿ha actualizado el registro de incidentes…?»). -->

---

## 9. Lo que el propietario rellena, una vez, fuera del repositorio

Cada ⟦…⟧ de este documento, en una nota privada junto al registro:
1. el acceso a la sede de la AEPD y en qué dispositivo;
2. las cuentas de cada proveedor por las que llegan sus avisos;
3. los dispositivos con acceso de administrador y si están cifrados;
4. dónde está la pasarela (solo experimentos) y el correo de la cuenta de OpenRouter;
5. dónde vive el registro y su copia.

Cuando esté hecho, el propietario lo **firma y fecha** en esa nota, y en
`checklist-activacion.md` § 1 se marca la casilla.

---

## 10. Los profesionales

- **Una brecha de NutrIA que toca a pacientes de un profesional** (por ejemplo, la base de
  datos, o un fallo que deja a un profesional ver a otro paciente):
  - la notificación a la AEPD y el aviso a los pacientes son **de NutrIA**, que es la
    responsable de esos datos (`analisis.md` § 2);
  - el profesional **no** es encargado de NutrIA ni NutrIA suya, así que el art. 33.2 no
    obliga a avisarle;
  - **aun así, avísale**, porque:
    - lo que vio puede estar en su historia clínica;
    - su secreto profesional está en juego;
    - el acuerdo que aceptó promete cooperación ante una brecha (`textos/01`, cl. 8);
    - si el fallo le mostró a él datos de un paciente que no era suyo, tiene que borrarlos
      de donde los haya copiado.

    Díselo solo a los profesionales afectados, sin datos de pacientes que no sean suyos.
- **Una brecha del profesional**: capturas difundidas, su portátil robado con fichas, su
  cuenta usada por otra persona.
  - Él es responsable independiente de lo que tiene fuera de NutrIA: **la notificación a la
    AEPD y a sus pacientes es suya** (art. 33 y 34; acuerdo, cl. 8).
  - El acuerdo le obliga a avisar a NutrIA **en 24 horas**. NutrIA entonces:
    - corta su acceso (retirar la concesión);
    - guarda el rastro de sus accesos (§ 4, paso 3);
    - valora si también hubo brecha en NutrIA. Por ejemplo, si entraron con **su cuenta**
      de NutrIA, quien vio datos alojados en NutrIA sin permiso fue un tercero: eso es
      brecha de NutrIA, y NutrIA la evalúa y notifica por su lado.
  - En todo caso, **se registra** (§ 8).

<!-- Fuente: RGPD arts. 33.1-2 (deber de cada responsable; el del encargado hacia su responsable), 34; análisis de roles, docs/legal/analisis.md § 2 (responsables independientes); acuerdo del profesional, docs/legal/textos/01, cláusula 8 («escríbenos… en todo caso en 24 horas… si la brecha es tuya, fuera de NutrIA, esa obligación es tuya»); Código Deontológico CGCODN (22/12/2021), arts. 22 y 29. [abogado]: si se apreciara corresponsabilidad, el reparto de la cl. 4 del acuerdo asigna a NutrIA el contacto con los pacientes, lo que es coherente con este apartado. -->
