# Los correos al propietario: resumen diario y dos avisos (2026-09-29)

> **No soy abogado.** Lo ha escrito un agente, no un abogado. Cada conclusión cita el
> artículo en que se apoya para que el propietario —o el abogado al que se lo enseñe— pueda
> comprobarla. Lo que depende de una interpretación va marcado **[abogado]** y reunido en
> el § 6.
>
> **Propósito**: revisar, para el proyecto 008 fase 6 paso 4
> ([PLAN](../projects/008-console-watches-quality-and-spend/PLAN.md), criterio 9 del PRD;
> [`0071`](../decisions/0071-the-service-records-what-leaves-no-row-and-the-console-watches-it.md)),
> los tres correos que el servicio manda solo al propietario: el resumen diario
> (`owner-digest`) y los avisos inmediatos (`owner-alert`) de tres generaciones fallidas
> seguidas y de gasto al 80 % / 100 % del tope.
> **Audiencia**: el lead, `backend`, el propietario y el abogado. **Committed**: sí — el
> repositorio es público: aquí no hay direcciones ni nombres; el destinatario es la variable
> `OWNER_EMAIL`, cuyo valor no se escribe en ningún archivo.
> **Mantenido por**: el agente `legal`. **Fecha de corte**: 2026-09-29, rama
> `agent/008-phase6/backend` en `a1fac59` (**sin fusionar**: todo lo que sigue es verdad
> una vez fusionada tal cual).
>
> **Adenda del mismo día** ([al final](#adenda-2026-09-29-tarde-el-aviso-de-cuenta-esperando-resuelto-y-un-cuarto-aviso)):
> el § 5 (dirección en el aviso de cuenta esperando) queda **resuelto**, y hay un aviso más
> (la tarea de recordatorios callada).

## 0. Veredicto

- **Se pueden enviar como están.** Ningún correo lleva la dirección, el nombre, el
  identificador ni el texto de ninguna persona usuaria. Llevan recuentos, códigos de fallo
  de una lista cerrada, etiquetas fijas y enlaces a la consola, y el código lo garantiza
  por tipo y por test, no por costumbre (§ 1).
- **Para el proveedor de correo y el buzón, el contenido es información anónima**; para el
  propietario, que es el responsable, un recuento pequeño puede señalar a alguien, pero
  solo con datos que ya tiene en la consola y para el mismo fin. No hay dato, fin ni
  destinatario nuevos: **la política de privacidad no cambia y el registro de actividades
  solo anota la revisión** (§ 2 y § 3).
- **La frase del pie es cierta en lo que importa e imprecisa en la letra**, igual que la
  entradilla. Dos cambios de redacción **P3**, opcionales, para `backend` a través del lead (`backend` no estaba disponible; § 4). El
  código no tiene que cambiar nada.

## 1. Qué hacen (leído en el código, `a1fac59`)

| Qué | Dónde | Lo que importa aquí |
| --- | --- | --- |
| Destinatario | `OwnerAlerts.service.ts:54` | solo `OWNER_EMAIL`, y solo si hay SMTP; sin él, nada |
| Cuándo | `OwnerAlerts.service.ts` `digest`, `afterJob`, `checkSpend`; `Cron.controller.ts` (`/cron/reminders`, fin del barrido nocturno); `PlanJobRunner.service.ts` (al terminar cada generación) | resumen: uno al día como mucho y solo si algo no es cero; fallos: uno cada 6 h como mucho; gasto: uno por umbral y mes |
| Resumen | `OwnerDigest.ts:25-38, 66-106` | cuentas esperando (número), mensajes nuevos del buzón (número), generaciones fallidas en 24 h por código, gasto de texto y de imágenes contra su tope, cinco recuentos de catálogo «que deberían ser cero», correos fallidos por plantilla, tareas programadas paradas |
| Aviso de fallos | `OwnerAlert.ts:39-44` | los códigos de las tres últimas generaciones, del más reciente al más antiguo |
| Aviso de gasto | `OwnerAlert.ts:47-52` | fuente (texto / imágenes), dólares gastados, tope, porcentaje |
| Códigos | `AdminAlertController.ts:68-69` (`safeCode`) | lo que viene de `plan_generation_jobs.error` solo pasa si es `^[A-Z][A-Z0-9_]{0,63}$`; si no, `OTHER`. Un texto de error libre no puede colarse |
| Plantillas | `AdminAlertController.ts:73-74` (`safeKind`) | solo `^[a-z][a-z0-9-]{0,39}$`; si no, `unknown` |
| Etiquetas | `OwnerDigest.ts:30-38`, `OwnerAlert.ts:29` | constantes del código |
| Enlaces | `OwnerAlerts.service.ts:61` | `APP_URL` + ruta de la consola + filtros fijos (`?activated=no`, `?status=failed&since=24h`…); ningún id, ningún token. Abrirlos exige la sesión del propietario |
| Rastro | `Email.service.ts:114`; `AnalyticsRepository.ts:70` | `mail_sent` guarda la plantilla y si salió, sin destinatario; `owner_alerted` guarda solo el tipo de aviso, con `userId: null` |
| Test | `OwnerMail.spec.ts` | rellena cada cadena que viaja con centinelas (cuerpo de mensaje, nombre de plato, texto de error, una dirección, un UUID, un id) y falla si alguno, o una `@`, aparece en el asunto, el texto o el HTML |

Los ocho códigos que puede producir una generación (`PlanGeneration.service.ts:51-59`):
`GENERATION_AI_UNAVAILABLE`, `GENERATION_INVALID_PLAN`, `GENERATION_ONBOARDING_INCOMPLETE`,
`GENERATION_POOL_TOO_SMALL`, `GENERATION_PROFILE_CONSENT_REQUIRED`,
`GENERATION_PROFILE_INCOMPLETE`, `GENERATION_TIMED_OUT`, `GENERATION_UNSAFE_CONTENT`; más
`GENERATION_FAILED` para lo inesperado (`PlanJobRunner.service.ts:114`) y `OTHER` del filtro.

## 2. ¿Hay datos personales en estos correos?

**Dato personal** es «toda información sobre una persona física identificada o
identificable», y lo es la identificable «directa o indirectamente» (RGPD art. 4.1). Para
saber si alguien es identificable «deben tenerse en cuenta todos los medios, como la
singularización, que razonablemente pueda utilizar el responsable del tratamiento o
cualquier otra persona», y el Reglamento «no afecta al tratamiento de dicha información
anónima, inclusive con fines estadísticos» (considerando 26).

La respuesta depende de quién lea, que es la lectura relativa que el TJUE admite en
C-413/23 P (*CEPD c. JUR*, 4/9/2025) y que [`analisis.md` § 4.4](./analisis.md#44-openrouter-y-quien-ejecuta-el-modelo-2026-09-26-para-el-cambio-de-0064)
ya usa para la IA:

- **Para el proveedor de correo y quien aloja el buzón** (hoy una cuenta de Gmail, P2-10):
  «Cuentas esperando: 1», «GENERATION_TIMED_OUT: 2» o «9,30 USD de 10,00 USD» no le dan
  ningún medio de llegar a una persona: no hay dirección, id, nombre ni texto, y los enlaces
  solo abren con la sesión del propietario. **Información anónima** para él.
- **Para el propietario, que es el responsable**, un recuento de 1 o tres códigos en fila
  a una hora dada pueden **singularizar** a alguien si los cruza con la consola (que ya
  muestra direcciones en Cuentas, Buzón y Generación, `0068`). Con esa cautela, lo tomo
  como tratamiento de datos personales **que ya tiene y para el fin que ya tiene**:
  - las cuentas esperando sirven a la activación (fila 1 del registro); el aviso de
    `0029` ya le manda, por el mismo proveedor, **la dirección** de cada alta. El resumen
    le manda menos que eso;
  - fallos, correos fallidos, catálogo y gasto sirven a «saber si funciona» (fila 7 del
    registro; política, interés legítimo «registrar el uso del producto y los errores
    técnicos para que funcione»);
  - el responsable no es «destinatario» de sus propios datos, y el correo no los comunica a
    nadie más.

  Es minimización (art. 5.1.c) y confidencialidad (arts. 5.1.f y 32) en su forma más
  simple: el correo sale por un proveedor y vive en un buzón menos protegido que la
  consola, así que lleva solo lo necesario para decidir si abrirla. **[abogado]**, la
  misma lectura relativa que § 4.4.

**Los códigos y la salud.** Ninguno dice una enfermedad, una medicación ni una alergia.
Dos dicen algo de una persona:

- `GENERATION_PROFILE_CONSENT_REQUIRED` dice que a esa persona le falta (o retiró) el
  consentimiento del perfil: es un **estado de consentimiento**, no un dato de salud.
- `GENERATION_POOL_TOO_SMALL` puede sugerir una dieta muy restringida; de ahí no se deduce
  una condición concreta, y el propietario lo deduciría mejor del perfil que ya guarda.

Para cualquier otro lector son anónimos. No veo datos del art. 9 en el correo; el alcance
amplio de «datos de salud» (C-184/20 *OT*, 1/8/2022) exige que el dato **permita deducir**
el estado de salud, y un código de fallo sin persona no lo permite. **[abogado]**, por
prudencia.

**LOPDGDD**: no añade ninguna exigencia a lo anterior para estos correos.

## 3. Política de privacidad y registro de actividades

- **Política: no cambia.** La lista de fines del proveedor de correo (es-ES.ts, `privacy`,
  «para los correos de confirmación, recuperación de contraseña y recordatorio del
  check-in») no tiene que crecer, porque **en estos correos no viaja ningún dato de
  usuario**. El deber de informar (art. 13) recae sobre datos que se recogen del
  interesado, y aquí no se recoge ni se comunica nada nuevo.
- **Registro (art. 30.1): no hay fin, categoría ni destinatario nuevos** (letras b, c y d),
  así que no hay fila nueva. Anoto la revisión en su cabecera y, en la fila 7, el correo
  sin datos como medida.
- **EIPD**: sin cambios; no es un tratamiento nuevo ni aumenta el riesgo.

## 4. La frase del pie y la entradilla (P3, opcional)

`OwnerDigest.ts:28`: «Ninguna dirección, nombre ni texto de nadie viaja en este correo.»

- **En lo que importa es cierta**: ninguna dirección, nombre ni texto de un usuario viaja.
- **En la letra, no del todo**: «dirección» también es una dirección web, y el correo va
  lleno de enlaces; y la cabecera `Para:` lleva la dirección del propietario.

`OwnerDigest.ts:26`: «Solo hay números y enlaces.» Es la menos exacta de las dos: también
viajan códigos de fallo, nombres de plantilla y nombres de tareas.

Nadie más que el responsable lee estas frases y no prometen nada a un interesado, así que
no son el «texto falso» de un P0; son redacción. Propuesta (sin `@`, el test sigue igual;
el test no comprueba estas cadenas):

| Constante | Hoy | Propuesta |
| --- | --- | --- |
| `INTRO` | `Esto es lo que hoy pide una mirada. Solo hay números y enlaces.` | `Esto es lo que hoy pide una mirada. Solo hay números, códigos y enlaces.` |
| `FOOT` | `Ninguna dirección, nombre ni texto de nadie viaja en este correo.` | `Este correo no lleva el correo electrónico, el nombre ni el texto de ninguna persona usuaria.` |

El aviso (`OwnerAlert.ts`) no lleva pie; no hace falta.

## 5. Fuera de alcance, encontrado al leer

- **El aviso de `0029` (`account-waiting`) sí lleva la dirección de cada alta** al buzón
  del propietario, donde se queda sin plazo. Ya está cubierto por P2-10 (Gmail de consumo
  como proveedor, sin DPA); lo que falta es un plazo para esos correos en el buzón.
  Candidato P3 para [`analisis.md` § 9](./analisis.md#9-riesgos-ordenados-por-lo-que-le-puede-pasar-a-una-persona-real):
  borrarlos una vez activada o rechazada la cuenta.
- **La política dice** «nadie la consulta [la base de datos] salvo para arreglar un
  fallo». Una lectura automática de agregados no la hace menos cierta; la consola (`0068`)
  ya la tensaba antes de esto, y eso es otro asunto.

## 6. Confirmar con un abogado (añadir al [`analisis.md` § 10](./analisis.md#10-confirmar-con-un-abogado))

1. ¿Vale la lectura relativa (C-413/23 P) para decir que un recuento o un código de fallo,
   sin identificador, es información anónima para el proveedor de correo, aunque el
   responsable pueda singularizar con la consola?
2. ¿Puede un código como `GENERATION_PROFILE_CONSENT_REQUIRED`, en manos de quien tiene la
   consola, considerarse dato relativo a la salud por el alcance amplio de C-184/20? (Mi
   lectura: no; es un estado de consentimiento.)

## Fuentes consultadas (2026-09-29)

- RGPD, texto en BOE `DOUE-L-2016-80807`: considerando 26, art. 4.1 y 4.2, art. 30.1
  (leídos hoy); arts. 5.1.c, 5.1.f, 13 y 32.
- TJUE C-413/23 P y C-184/20, como constan en el [README](./README.md#fuentes-primarias-usadas-versión-consultada).
- Código en `agent/008-phase6/backend` @ `a1fac59`: `apps/api/src/modules/email/templates/OwnerDigest.ts`,
  `OwnerAlert.ts`, `OwnerMail.spec.ts`, `Email.service.ts`;
  `apps/api/src/modules/owner-alerts/services/OwnerAlerts.service.ts`;
  `packages/core/src/controllers/Admin/AdminAlertController.ts`;
  `packages/core/src/repositories/Admin/AdminGenerationsRepository.ts`;
  `packages/core/src/repositories/Analytics/AnalyticsRepository.ts`;
  `apps/api/src/modules/meal-plans/services/PlanGeneration.service.ts`.
- Decisiones `0029`, `0068`, `0071`.

---

## Adenda (2026-09-29, tarde): el aviso de cuenta esperando, resuelto, y un cuarto aviso

> **Fecha de corte**: árbol de trabajo de la rama `admin-console-loose-ends` sobre
> `e1332b4`, **sin commit ni fusión**: lo que sigue es verdad una vez fusionado tal cual.
> Lo de arriba no se reescribe; esta adenda dice qué ha dejado de ser cierto.

**1. § 5, primer punto: resuelto** por decisión del propietario
([`LOG.md`](../decisions/LOG.md), 2026-09-29, enmienda de `0029`/`0030`). El aviso
`account-waiting` ya no lleva la dirección, el nombre, el id ni un enlace de activación:
dice que hay una cuenta esperando y enlaza a `/admin/cuentas?activated=no`, que solo abre
con la sesión del propietario (`AccountWaiting.ts:15-32`; la función ni recibe la cuenta,
`AccountWaitingMail.ts:32-36`; `AccountWaiting.spec.ts` lo sostiene en los dos idiomas). El
log tampoco lleva ya el id del usuario, y el de un fallo solo la clase del error (`AccountWaitingMail.ts:46` y `49`). El P3
propuesto (borrar esos correos tras activar o rechazar) deja de hacer falta para los
nuevos: no hay nada que borrar. Se va algo más que la dirección: el botón llevaba un
token firmado que abría la cuenta **sin sesión** durante 30 días (`ActivationLink.ts:4`);
un buzón comprometido era una llave (arts. 5.1.f y 32). Texto tal como está:
[`textos/06`](./textos/06-correos.md) § L.

**2. Lo que deja de ser cierto arriba.**

- § 2, «el aviso de `0029` ya le manda, por el mismo proveedor, **la dirección** de cada
  alta. El resumen le manda menos que eso»: una vez fusionado, **ningún** correo al
  propietario lleva la dirección de nadie. La conclusión del § 2 no cambia; su apoyo en
  ese punto sí.
- § 0 y el propósito hablan de **tres** correos: ahora son cinco tipos (el resumen, tres
  avisos inmediatos y el de cuenta esperando).
- § 3 sigue en pie y queda más firme: la lista de fines del proveedor de correo en la
  política nunca nombró este aviso, y ahora no hace falta, porque por él no sale ningún
  dato de usuario.

**3. Lo que queda (residual, P3).** Los correos `account-waiting` enviados **antes** del
cambio siguen en el buzón del propietario con la dirección de cada alta, y su enlace sigue
abriendo la cuenta hasta que el token caduque (30 días desde que se envió);
`GET /admin/activate` se mantiene solo para ellos y el código dice que se borre, con
`ActivationLink.ts`, cuando hayan caducado (`AdminAccounts.controller.ts`, comentario de la
ruta). Recomendación al propietario: **borrar esos correos** del buzón (y de la papelera)
cuando haya actuado sobre cada cuenta — nada del producto los necesita, y la consola tiene
lo mismo; y quitar la ruta 30 días después del despliegue. P2-10 (Gmail de consumo sin
DPA) sigue abierto y no depende de esto.

**4. Un cuarto aviso: la tarea de recordatorios callada.** `OwnerAlert.ts:38-46`,
`type: 'reminders-silent'`, desde `/cron/rewrite-steps` (03:30 UTC) cuando
`/cron/reminders` lleva más de 26 h sin terminar una ejecución (o no tiene ninguna); uno al
día como mucho, reclamado para 20 h (`OwnerAlerts.service.ts:121-133`). Texto fijo y un enlace sin id: ningún dato de persona,
y `OwnerMail.spec.ts` lo pasa por los mismos centinelas. **Veredicto: se puede enviar
como está**; ni la política ni el registro cambian por él (fila 7 ya cubre «avisos»).
Tiene una lectura jurídica a favor: `/cron/reminders` es también la que borra las
invitaciones caducadas, cuyo plazo prometido es «como muy tarde al día siguiente» de
caducar (registro, fila 5; art. 5.1.e), y este aviso es lo que le dice al propietario, el
primer día, que esa promesa está en riesgo. Su `detail` no lo nombra: redacción **P3**
opcional para `backend`, en [`textos/06`](./textos/06-correos.md) § K.

**5. Nada nuevo que confirmar con un abogado**: el aviso nuevo y el aviso reducido caen en
la misma lectura del § 6.1 (información anónima para el proveedor de correo).

Fuentes de esta adenda: `git diff e1332b4` y `git status --short` en la rama
`admin-console-loose-ends` (2026-09-29): `AccountWaiting.ts`, `AccountWaiting.spec.ts`,
`AccountWaitingMail.ts`, `ActivationLink.ts`, `AdminAccounts.controller.ts`,
`auth.config.ts`, `SelfService.ts`, `OwnerAlert.ts`, `OwnerMail.spec.ts`,
`OwnerAlerts.service.ts`, `Cron.controller.ts`, `AdminAlertController.ts`,
`apps/api/vercel.json`, `ExpiredInvitations.service.ts`; `docs/decisions/LOG.md`.
