# Correos con efecto jurídico

> **No soy abogado.** Borrador para el producto.
>
> **Propósito**: los correos cuyo texto tiene consecuencias jurídicas: informar a quien no
> es usuario (art. 14 RGPD), avisar de un contrato, acusar un desistimiento.
> **Audiencia**: `backend` (plantillas en `apps/api/src/modules/email/templates/`, objeto
> `COPY` por idioma, como hoy), el abogado. **Committed**: sí. **Mantenido por**: el
> agente `legal`.
>
> Ninguno lleva palabras de salud: un buzón se escanea y una pantalla de bloqueo es
> pública (criterio ya aplicado en `CareInvitation.ts`, `0059`).
>
> **H a N son distintos**: no informan a nadie ni avisan de un contrato; son los
> correos al propietario (`0071`, `0029`, `0072`), y están documentados **tal como están
> construidos**, no como borrador: H, I y J en la rama `agent/008-phase6/backend`
> (`a1fac59`, fusionada en `0ca076c`, #161); K y L en el árbol de trabajo de `admin-console-loose-ends`
> sobre `e1332b4`, **sin commit ni fusión** (verdad una vez fusionado tal cual); M y N
> (proyecto 009, fase 1) en el árbol de trabajo de `main` sobre `0d7b275`, **sin commit**
> (verdad una vez fusionado tal cual). Solo se
> envían en español (`const LOCALE = 'es-ES'` en `OwnerDigest.ts:23` y `OwnerAlert.ts:23`,
> `OWNER_LOCALE` en `AccountWaitingMail.ts:6`), así que su columna en-GB es `—`, salvo en L,
> cuya plantilla tiene inglés aunque nunca se envíe. Los números de línea de H a L son los
> de su fecha de corte: el cambio de M y N mueve los de `OwnerAlert.ts` (hoy: `failures` en
> `:93-101`, `spend` en `:130-138`, `reminders-silent` en `:83-92`) y los de
> `OwnerAlerts.service.ts` (destinatario en `:58-60`, `watchReminders` en `:126-138`).
> Revisión y veredicto:
> [`../2026-09-29-correos-al-propietario.md`](../2026-09-29-correos-al-propietario.md) (con su
> adenda del mismo día para K y L, y la del 2026-09-30 para M y N).
>
> **Marcadores**: `{name}` en estas plantillas es el del profesional o el del
> destinatario, como hoy. El titular de NutrIA no se nombra en el correo: se enlaza a la
> política (`{privacyUrl}` = `APP_URL/privacidad`), que lo identifica — información por
> capas, como recomienda la AEPD para el deber de informar.

---

## A. Invitación del profesional — añadir información del art. 14 (P1-2)

**Plantilla**: `CareInvitation.ts`, campo nuevo `privacy`, pintado con
`paragraph(copy.privacy, 'muted')` después de `ignore` y antes de `linkFallback`. Los demás
campos no cambian, salvo `meaning`, que se alinea con la página (§ B1 de `05`).

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `meaning` (sustituye) | `Si aceptas, verá tu plan y cómo lo llevas, y podrá ajustarlo contigo. Antes de aceptar verás la lista exacta.` | `If you accept, they will see your plan and how it is going, and can adjust it with you. Before accepting you will see the exact list.` |
| `privacy` (nuevo) | `Te escribimos porque {name} nos ha dado tu dirección para invitarte, y no la usamos para nada más. Si aceptas o rechazas, borramos la invitación en ese momento; si no respondes, caduca a los 14 días y la borramos, con tu dirección, como muy tarde al día siguiente. Quién es el responsable y tus derechos: {privacyUrl}` | `We are writing because {name} gave us your address to invite you, and we use it for nothing else. If you accept or decline, we delete the invitation there and then; if you do not answer, it expires after 14 days and we delete it, with your address, by the following day at the latest. Who is responsible and your rights: {privacyUrl}` |

<!-- Fuente: RGPD art. 14.1.a-e (identidad, fines, base, destinatarios), 14.2.a (plazo), 14.2.f (fuente: el profesional), 14.3.b (al primer contacto); care.schema.ts:9-54 (aceptar o rechazar borra la fila; las caducadas las borra el barrido diario de las 08:00, backend cf87d75, así que una invitación puede vivir casi un día más que sus 14: por eso «como muy tarde al día siguiente» y no «14 días como máximo»). Recomendación AEPD, Guía para el cumplimiento del deber de informar: primera capa básica + enlace. -->

---

## B. Alta como profesional (nuevo)

**Cuándo**: cuando el propietario concede el rol en `/admin` (`POST /admin/accounts/:id/professional`).
Hoy el profesional no recibe nada (LEGAL-REVIEW § B1). **Plantilla nueva**:
`ProfessionalGranted.ts`, `EmailKind` `professional-granted`.

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `Tu consulta en NutrIA está lista` | `Your NutrIA practice is ready` |
| `intro` | `Te hemos dado acceso a la consulta de NutrIA como dietista-nutricionista, con el número de colegiado {collegiateNumber}.` | `We have given you access to the NutrIA practice as a dietitian-nutritionist, with registration number {collegiateNumber}.` |
| `agreement` | `Antes de ver datos de ningún paciente te pediremos que aceptes el acuerdo del profesional: secreto, quién responde de los datos y qué no puedes hacer. Léelo con calma; es corto.` | `Before you see any client's data we will ask you to accept the professional's agreement: secrecy, who is responsible for the data and what you may not do. Take your time reading it; it is short.` |
| `button` | `Abrir mi consulta` | `Open my practice` |
| `notYou` | `Si no has pedido esto, respóndenos y lo retiramos.` | `If you did not ask for this, reply and we will revoke it.` |

<!-- Fuente: RGPD art. 13 (el profesional también es interesado: su número de colegiado); Ley 7/1998 art. 5 (las condiciones se ponen a disposición antes de aceptar). -->

---

## C. Acuse de desistimiento de Premium (nuevo — P1-8)

**Cuándo**: al confirmar el desistimiento con el botón del perfil (o al registrar uno
recibido por correo). **Plantilla nueva**: `WithdrawalReceived.ts`. Debe salir en el
momento, con fecha y hora.

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `Hemos recibido tu desistimiento` | `We have received your withdrawal` |
| `intro` | `Has desistido de tu suscripción a NutrIA Premium. Lo recibimos el {date} a las {time}.` | `You have withdrawn from your NutrIA Premium subscription. We received it on {date} at {time}.` |
| `contract` | `Contrato: suscripción {plan} contratada el {startedOn}, a nombre de {name}.` | `Contract: {plan} subscription taken out on {startedOn}, in the name of {name}.` |
| `refund` | `Te devolvemos {amount} por el mismo medio de pago en un máximo de 14 días. Premium termina hoy y no se te volverá a cobrar.` | `We will refund {amount} to the same payment method within 14 days at most. Premium ends today and you will not be charged again.` |
| `keep` | `Tu cuenta, tus planes y tu historial siguen aquí, con los límites gratuitos.` | `Your account, plans and history are still here, on the free limits.` |

<!-- Fuente: TRLGDCU art. 106.3 («comunicará sin demora… en un soporte duradero el acuse de recibo»), 107.1 (reembolso en 14 días, mismo medio); Directiva 2023/2673, art. 11 bis.4 Directiva 2011/83 («acuse de recibo… con información sobre su contenido y la fecha y hora de presentación»). Con Managed Payments, Link envía sus propios correos de reembolso; este sigue siendo necesario para el acuse. -->

---

## D. Aviso de renovación del plan anual (P2-7)

**Solo si *Managed Payments* está desactivado** (con él, Stripe/Link envía el aviso de
aniversario 15 días antes por defecto — comprobar el ajuste *Upcoming renewal events*).
Sin él, activar en Stripe *Settings → Billing → Subscriptions and emails → Upcoming
renewals* a 15 días, o una plantilla propia disparada por el webhook
`invoice.upcoming`:

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `Tu Premium anual se renueva el {date}` | `Your yearly Premium renews on {date}` |
| `intro` | `El {date} se renovará tu suscripción anual y se cobrarán {amount}.` | `On {date} your yearly subscription will renew and {amount} will be charged.` |
| `choose` | `Si no quieres renovarla, cancélala antes de esa fecha desde tu perfil, en «Gestionar la suscripción». Si no haces nada, se renueva un año más.` | `If you do not want to renew, cancel before that date from your profile, under "Manage subscription". If you do nothing, it renews for another year.` |

<!-- Fuente: TRLGDCU art. 97.1.p, redacción de la Ley 10/2025 (disp. final 3ª): «se informará… con quince días de antelación de forma previa al vencimiento del plazo para comunicar la voluntad de no renovación». -->

---

## E. Aviso de check-in al profesional — empuje sin nombre (P3)

**Plantilla**: `CheckInSubmitted.ts:61` (`PUSH`). El correo puede seguir con el nombre; el
empuje se ve en la pantalla de bloqueo.

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `PUSH.title` | `Un paciente ha hecho su check-in` | `A client has done their check-in` |
| `PUSH.body` | `Abre tu consulta para verlo.` | `Open your practice to see it.` |

<!-- Fuente: RGPD art. 5.1.f y 32 (confidencialidad); Código Deontológico CGCODN art. 29. -->

---

## F. Aviso de cambio de condiciones (una vez, antes de publicar las nuevas)

Las condiciones vigentes prometen avisar por correo antes de aplicar un cambio importante.
Envío único a cada cuenta:

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `Cambios en las condiciones y la privacidad de NutrIA` | `Changes to NutrIA's terms and privacy` |
| `intro` | `El {date} cambian nuestras condiciones de uso y nuestra política de privacidad.` | `On {date} our terms of use and privacy policy change.` |
| `what` | `Explicamos mejor qué datos tuyos son de salud y te pedimos un consentimiento para ellos, añadimos cómo desistir de Premium y todo lo que tiene que ver con trabajar con un dietista en NutrIA.` | `We explain more clearly which of your data is health data and ask for your consent to it, add how to withdraw from Premium, and everything to do with working with a dietitian on NutrIA.` |
| `choose` | `Puedes leerlas en {termsUrl} y {privacyUrl}. Si no estás de acuerdo, puedes borrar tu cuenta desde tu perfil.` | `You can read them at {termsUrl} and {privacyUrl}. If you do not agree, you can delete your account from your profile.` |

<!-- Fuente: condiciones actuales, § «Cambios en estas condiciones» (es-ES.ts); RGPD art. 12.1 y 13.3; TRLGDCU art. 85.3 (no modificar unilateralmente sin causa y aviso). Es un correo de servicio, no comercial: LSSI art. 21 no aplica. -->

---

## G. Aviso del cambio de proveedor de IA (una vez, el día que se publique el estado 2 de la política)

**Cuándo**: el mismo día que `/privacidad` pasa al estado 2 de
[`02`](./02-politica-privacidad.md) («La inteligencia artificial»), y **antes** de poner
`AI_PROVIDER=openrouter` (como pronto, al día siguiente). Envío único a cada cuenta. Si
§ F aún no se ha enviado, se pueden unir en uno solo añadiendo `what` de este a aquel.

**Por qué**: la política vigente promete «Si cambiamos algo importante… te avisaremos por
correo antes de que se aplique». Un destinatario nuevo (OpenRouter y quien ejecuta el
modelo) lo es, aunque sustituya a otros que protegían menos.

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `Cambiamos el proveedor de inteligencia artificial de NutrIA` | `We are changing NutrIA's artificial-intelligence provider` |
| `intro` | `A partir del {date}, cuando un modelo de inteligencia artificial diseñe platos nuevos para tu plan, lo hará a través de OpenRouter, en Estados Unidos, con proveedores que no guardan lo que reciben ni lo usan para entrenar ningún modelo.` | `From {date}, when an artificial-intelligence model designs new dishes for your plan, it will do so through OpenRouter, in the United States, with providers that neither keep what they receive nor use it to train any model.` |
| `what` | `El modelo sigue recibiendo solo lo mismo que hasta ahora: nunca tu nombre, tu correo, tu edad, tu peso, tus alergias, tu salud ni nada que hayas escrito tú. Ya no usamos modelos gratuitos que puedan aprender de lo que reciben.` | `The model still receives only what it did before: never your name, email, age, weight, allergies, health or anything you wrote yourself. We no longer use free models that may learn from what they receive.` |
| `choose` | `Los detalles están en {privacyUrl}, en «La inteligencia artificial». Si tienes cualquier duda, escríbenos a {email}. Si no estás de acuerdo, puedes borrar tu cuenta desde tu perfil.` | `The details are at {privacyUrl}, under "Artificial intelligence". If you have any question, write to us at {email}. If you do not agree, you can delete your account from your profile.` |

<!-- Fuente: política vigente, § «Cambios en esta política» (es-ES.ts, namespace privacy); RGPD arts. 12.1 y 13.3 (información antes de un tratamiento nuevo), 13.1.e-f (destinatarios y transferencias); analisis.md § 4.4. «No guardan… ni lo usan para entrenar»: NO_TRAINING_PROVIDER (ai.config.ts), ajustes de cuenta del runbook ai-gateway.md § 0 y lista cerrada (P1-12). No menciona la categorización anónima de OpenRouter para no alargar un aviso: la enlaza la política, que sí la dice. Correo de servicio, no comercial: LSSI art. 21 no aplica. {date} = la fecha real del cambio; si se retrasa, no se reenvía, pero no se adelanta. Sin plantilla hoy: si se envía a mano, en copia oculta. -->

---

## H. Resumen diario al propietario (tal como está — `0071`)

**Plantilla**: `OwnerDigest.ts`, `EmailKind` `owner-digest`. **Destinatario**: solo
`OWNER_EMAIL`. **Cuándo**: dentro de `/cron/reminders`, como mucho uno por día de Madrid y
solo si alguna línea no es cero o un gasto llega al 80 % de su tope. Cada línea aparece
solo si su número no es cero, seguida de `Abrir en la consola` con su enlace.
**Marcadores**: `{n}` es un número; `{codigo}` pasa por `safeCode` (`[A-Z][A-Z0-9_]`, si no
`OTHER`); `{plantilla}` por `safeKind` (`[a-z][a-z0-9-]`, si no `unknown`); `{gastado}` y
`{tope}` en USD con dos decimales; `{pct}` redondeado.

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `NutrIA — resumen del día` | — |
| `INTRO` | `Esto es lo que hoy pide una mirada. Solo hay números, códigos y enlaces.` (propuesta P3 aplicada) | — |
| cuentas | `Cuentas esperando: {n}` → `/admin/cuentas?activated=no` | — |
| buzón | `Mensajes nuevos en el buzón: {n}` → `/admin/buzon?state=waiting` | — |
| generaciones | `Generaciones fallidas en 24 h: {n}` y una línea `{codigo}: {n}` por código → `/admin/generacion?status=failed&since=24h` | — |
| gasto de texto | `Gasto de texto este mes: {gastado} de {tope} ({pct} %)`, solo desde el 80 % → `/admin/generacion/ia` | — |
| gasto de imágenes | `Gasto de imágenes este mes: {gastado} de {tope} ({pct} %)`, solo desde el 80 % → `/admin/catalogo/imagenes` | — |
| catálogo | `{etiqueta} (debería ser cero): {n}`, con cinco etiquetas fijas: `Comidas con raciones fuera de los límites`, `Recetas por encima del límite de una ración`, `Recetas que el barrido ya no reintenta`, `Recetas cuyos macros no se pueden calcular`, `Platos sin ingredientes que sirvan a sus comidas` → `/admin/catalogo?check=…` o `/admin/catalogo/calidad` | — |
| correos | `Correos fallidos en 24 h: {n}` y una línea `{plantilla}: {n}` por plantilla → `/admin/ajustes/sistema` | — |
| tareas | `Tareas programadas sin correr en más de 26 h` y una línea por tarea (`recordatorios`, `reescritura nocturna`) → `/admin/ajustes/sistema` | — |
| `FOOT` | `Este correo no lleva el correo electrónico, el nombre ni el texto de ninguna persona usuaria.` (propuesta P3 aplicada) | — |

<!-- Fuente: OwnerDigest.ts:25-38 y 66-106, AdminAlertController.ts:68-74 (safeCode, safeKind), OwnerAlerts.service.ts:54 y 61 (destinatario y enlaces), a1fac59. Sin efecto jurídico frente a nadie: no informa a un interesado ni avisa de un contrato. Su forma responde a RGPD arts. 5.1.c (minimización) y 5.1.f y 32 (confidencialidad): el correo sale por un proveedor y vive en un buzón menos protegido que la consola, así que lleva recuentos, códigos de lista cerrada, etiquetas fijas y enlaces sin id. Para el proveedor es información anónima (considerando 26; C-413/23 P) [abogado]. La propuesta de FOOT evita «dirección», que también es la web de los enlaces, y dice de quién no viaja nada; la de INTRO nombra los códigos, que también viajan. Ninguna contiene «@» (OwnerMail.spec.ts sigue igual). Veredicto: ../2026-09-29-correos-al-propietario.md. -->

---

## I. Aviso al propietario: tres generaciones seguidas fallidas (tal como está — `0071`)

**Plantilla**: `OwnerAlert.ts`, `type: 'failures'`, `EmailKind` `owner-alert`.
**Destinatario**: solo `OWNER_EMAIL`. **Cuándo**: al terminar una generación fallida, si
las tres últimas terminadas (de todas las cuentas) fallaron; como mucho uno cada 6 horas.
`{codigos}`: los tres, del más reciente al más antiguo, cada uno por `safeCode`.

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `NutrIA — tres generaciones seguidas han fallado` | — |
| `intro` | `Las tres últimas generaciones de planes terminaron en fallo, una tras otra.` | — |
| `detail` | `Códigos, del más reciente al más antiguo: {codigos}.` | — |
| `button` | `Abrir el registro` → `/admin/generacion?status=failed&since=24h` | — |
| `again` | `Si sigue fallando, no volverás a recibir este aviso durante 6 horas.` | — |

<!-- Fuente: OwnerAlert.ts:39-44, AdminAlertController.ts (failureStreak, safeCode), AdminGenerationsRepository.ts lastOutcomes (lee solo estado y código, sin cuenta), a1fac59. Los códigos posibles están en PlanGeneration.service.ts:51-59 más GENERATION_FAILED y OTHER: ninguno nombra una enfermedad, medicación ni alergia; GENERATION_PROFILE_CONSENT_REQUIRED es un estado de consentimiento, no un dato de salud (C-184/20, alcance de «datos de salud») [abogado]. Mismo fundamento de forma que H (arts. 5.1.c, 5.1.f, 32). -->

---

## J. Aviso al propietario: gasto al 80 % o al 100 % del tope (tal como está — `0071`)

**Plantilla**: `OwnerAlert.ts`, `type: 'spend'`, `EmailKind` `owner-alert`.
**Destinatario**: solo `OWNER_EMAIL`. **Cuándo**: al terminar una generación, al terminar
el barrido nocturno y en el resumen diario; uno por umbral, fuente y mes UTC (si se salta
del 79 % al 100 %, sale solo el de 100). `{fuente}`: `texto` o `imágenes`; `{umbral}`: 80 o
100.

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `NutrIA — el gasto de {fuente} ha llegado al {umbral} %` | — |
| `intro` | `El gasto de {fuente} de este mes ha llegado al {umbral} % de su tope.` | — |
| `detail` | `Van {gastado} de {tope}, el {pct} % del tope.` | — |
| `button` | `Abrir el gasto` → `/admin/generacion/ia` (texto) o `/admin/catalogo/imagenes` (imágenes) | — |
| `again` | `Un aviso por umbral y mes: no volverá a llegar hasta el mes que viene.` | — |

<!-- Fuente: OwnerAlert.ts:29 y 47-52, OwnerAlerts.service.ts (spendAlert, checkSpend), a1fac59; topes AI_TEXT_MONTHLY_CAP_USD y AI_IMAGE_MONTHLY_CAP_USD (0071, 0064). Sin ningún dato de persona: cifras de gasto del servicio. Sin efecto jurídico; mismo fundamento de forma que H. -->

---

## K. Aviso al propietario: la tarea de recordatorios lleva más de 26 h sin correr (tal como está — `0071`)

**Plantilla**: `OwnerAlert.ts:38-46`, `type: 'reminders-silent'`, `EmailKind` `owner-alert`.
**Destinatario**: solo `OWNER_EMAIL`, y solo si hay SMTP (`OwnerAlerts.service.ts:54`).
**Cuándo**: lo primero que hace `/cron/rewrite-steps` (03:30 UTC, `apps/api/vercel.json`),
antes del barrido y aunque el barrido esté parado por el tope, vacío o falle
(`Cron.controller.ts:69`): si la última ejecución terminada de `/cron/reminders` (08:00 UTC)
tiene más de 26 h, o no hay ninguna (`AdminAlertController.silentCrons`,
`CRON_STALE_HOURS = 26`, `cronStates` en `AdminSystemController.ts:121-131`, la misma regla
que la consola), sale el aviso; uno al día mientras siga callada, reclamado para 20 h para
que una ejecución algo más temprana que la del día anterior no lo pierda
(`owner_alerted { kind: 'cron-silent-reminders' }`, `OwnerAlerts.service.ts:121-133`). **Marcadores**: ninguno; el texto es fijo.

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `NutrIA — la tarea de recordatorios lleva más de 26 h sin correr` | — |
| `intro` | `La tarea de recordatorios lleva más de 26 h sin correr.` | — |
| `detail` | `Los recordatorios, el resumen de la mañana y el borrado de las invitaciones caducadas salen de esa tarea: mientras no corra, no ocurren.` | — |
| `button` | `Abrir Sistema` → `/admin/ajustes/sistema` | — |
| `again` | `Si sigue sin correr, no volverás a recibir este aviso hasta mañana.` | — |

<!-- Fuente: OwnerAlert.ts:28 y 38-46, OwnerAlerts.service.ts:121-133 (watchReminders; ventana de 20 h), Cron.controller.ts:65-69, AdminAlertController.silentCrons, AdminSystemController.ts:61 (CRON_STALE_HOURS) y 121-131 (cronStates: sin ejecución también cuenta como callada), vercel.json crons; árbol de trabajo de admin-console-loose-ends sobre e1332b4, sin commit. Es el más limpio de los avisos: no lleva ni un número ni un código, solo texto fijo y un enlace sin id; OwnerMail.spec.ts lo incluye en ALERTS y lo pasa por los mismos centinelas que I y J. Sin ningún dato de persona; sin efecto jurídico frente a nadie. Mismo fundamento de forma que H (arts. 5.1.c, 5.1.f y 32). Lo que sí tiene alcance jurídico es lo que vigila: /cron/reminders también borra las invitaciones caducadas (ExpiredInvitationsService.forget, antes del barrido de recordatorios), y los textos prometen borrarlas «como muy tarde al día siguiente» de caducar (registro, fila 5: ≤ 15 días; art. 5.1.e). Si la tarea no corre, esa promesa deja de cumplirse, y este aviso es lo que se lo dice al propietario en el primer día. `detail` no lo nombra: es cierto en lo que dice e incompleto (P3, redacción; propuesta: «Los recordatorios, el resumen de la mañana y el borrado de las invitaciones caducadas salen de esa tarea: mientras no corra, no ocurren.»). Un fallo del borrado con la tarea en marcha no dispara el aviso (forget no lanza); ese caso queda en el log. -->

---

## L. Aviso al propietario: una cuenta está esperando (tal como está — `0029`, enmendado el 2026-09-29)

**Plantilla**: `AccountWaiting.ts:15-32`, `EmailKind` `account-waiting`.
**Destinatario**: solo `OWNER_EMAIL`, y solo si hay SMTP (`AccountWaitingMail.ts:37-39`).
**Cuándo**: al confirmar alguien su dirección (`afterEmailVerification`,
`auth.config.ts:182-183` → `onAddressConfirmed` → `notifyOwnerOfWaitingAccount`), solo si la
activación es manual y la cuenta no se ha abierto sola. **Enlace**:
`webUrl(APP_URL, '/admin/cuentas?activated=no', DEFAULT_WEB_LOCALE)` — `APP_URL` +
`/admin/cuentas?activated=no`, sin prefijo porque el español no lo lleva
(`packages/core/src/domain/WebUrl/WebUrl.ts:13`, `22` y `44-52`): la lista de cuentas
esperando de la consola, que solo abre con la sesión del propietario. **Marcadores**:
ninguno. **Lo que ya no lleva** (hasta el 2026-09-29 sí): la dirección de la persona, el
botón `Abrir esta cuenta` con un token de activación firmado válido 30 días, ni la
sentencia SQL con la dirección. (La plantilla antigua tenía también una línea «Todavía no
ha confirmado su correo», que solo salía si se le pasaba `emailVerified: false`; como el
aviso se envía al confirmar, no consta que llegara a salir.) La función ni
siquiera recibe la cuenta (`AccountWaitingMail.ts:32-36`), y la línea del log ya no lleva
el id del usuario, y la del fallo solo la clase del error, no su mensaje, que puede llevar
la dirección del destinatario (`AccountWaitingMail.ts:46` y `49`).

| Campo | es-ES (el único que se envía) | en-GB (en la plantilla, no se envía) |
| --- | --- | --- |
| `subject` | `NutrIA — una cuenta está esperando` | `NutrIA — an account is waiting` |
| `intro` | `Alguien se ha registrado y está esperando a que le abras la cuenta. En la consola verás quién es.` | `Someone signed up and is waiting for their account to be opened. You will see who in the console.` |
| `button` | `Ver las cuentas esperando` → `/admin/cuentas?activated=no` | `See the accounts waiting` → el mismo enlace |

En la versión de texto plano no va la etiqueta del botón: `intro`, una línea en blanco y el
enlace.

<!-- Fuente: AccountWaiting.ts:15-32, AccountWaitingMail.ts:6-9 y 32-51, auth.config.ts:50 (selfService.link) y 182-183, SelfService.ts:51-66; AccountWaiting.spec.ts comprueba en asunto, texto y HTML, en los dos idiomas, que no aparece «@», «usr-», un UUID, «token», «/admin/activate» ni «update "user"»; árbol de trabajo de admin-console-loose-ends sobre e1332b4, sin commit; decisión en docs/decisions/LOG.md (2026-09-29, enmienda 0029/0030; decidió el propietario). Por qué así: el correo sale por el proveedor SMTP (hoy Gmail de consumo, sin DPA, P2-10) y se queda en un buzón sin plazo de supresión. Llevar la dirección era guardar un dato de cada alta sin plazo, fuera del sistema que la borra con la cuenta (art. 5.1.e; minimización, 5.1.c); llevar el token era dejar en ese buzón una llave que abre una cuenta sin sesión (arts. 5.1.f y 32). Ahora el correo no dice quién ni permite hacer nada: para el proveedor y el buzón es información anónima (considerando 26; C-413/23 P) [abogado], y quien lo abre necesita la sesión del propietario para ver algo. Los correos enviados antes del cambio siguen en el buzón con la dirección y un token que GET /admin/activate honra hasta que caduque (30 días, ActivationLink.ts:4): ver la adenda de ../2026-09-29-correos-al-propietario.md. Sin efecto jurídico frente a nadie; la política no cambia (sus fines del proveedor de correo nunca incluyeron este aviso, y ahora no hace falta). -->

---

## M. Aviso al propietario: imágenes de platos fallidas (tal como está — `0072`, proyecto 009 fase 1; una frase cambiada en la fase 2)

**Plantilla**: `OwnerAlert.ts:103-114`, `type: 'picture-failures'`, `EmailKind`
`owner-picture-alert` (`OwnerAlert.ts:145`, `Layout.ts:28`; etiqueta propia para que
Sistema lo cuente aparte). **Destinatario**: solo `OWNER_EMAIL`, y solo si hay SMTP
(`OwnerAlerts.service.ts:58-60`). **Cuándo**: se intenta al terminar cualquier dibujo,
acabe como acabe y después de la respuesta (`DishPictureService.schedule(claim, onEnd)`,
llamado desde `MealPlans.service.ts:76` y `AdminCatalogue.service.ts:77`), y en los dos
crons diarios (`Cron.controller.ts:75` y `:95`); sale si hay al menos una fila de
`recipe_images` en `failed` **no devuelta** cuyo último intento cae entre el último aviso
de este tipo —o hace 24 h si no hubo ninguno— y ahora
(`AdminAlertController.ts:225-240`, `AdminRepository.ts:93-102`), y como mucho uno por
hora (`owner_alerted { kind: 'picture-failed' }`, reclamado desde «hace una hora» y
fechado en el instante hasta el que contó, `OwnerAlerts.service.ts:160-167`).
**Marcadores**: `{total}` y `{n}` son enteros no negativos (`whole`, `OwnerAlert.ts:68-70`);
`{motivo}` es una de ocho etiquetas fijas (`REASON`, `OwnerAlert.ts:51-60`), elegida por
`reasonLabel` (`:63-65`): lo que no esté en `PICTURE_REASONS` sale como `Otro motivo`,
nunca como llegó; `{dias}` es `PICTURE_COOL_OFF_DAYS` (7, `RecipeController.ts:60`).

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `NutrIA — imágenes de platos fallidas: {total}` | — |
| `intro` | `Imágenes de platos que han fallado desde el aviso anterior: {total}. Cada plato espera al menos {dias} días antes de volver a dibujarse solo.` (desde la fase 2; antes, sin «al menos») | — |
| `detail` | `Por motivo: {motivo}: {n}; {motivo}: {n}.` — etiquetas posibles: `El revisor vio un alérgeno que el plato no tiene`, `El revisor la rechazó`, `Sin firma C2PA`, `El modelo rechazó la petición`, `El proveedor no puede cobrar`, `La llamada falló`, `Tope del mes alcanzado`, `Otro motivo` | — |
| `button` | `Abrir las imágenes fallidas` → `/admin/catalogo?picture=failed` | — |
| `again` | `Como mucho un aviso por hora: lo que falle mientras tanto irá en el siguiente.` | — |

<!-- Fuente: OwnerAlert.ts:35, 51-75, 103-114 y 145; OwnerAlerts.service.ts:20-23 (PICTURE_REPEAT_HOURS = 1), 58-60 y 152-180; AdminAlertController.ts:76 (PICTURE_ALERT_KINDS), 85-94 y 225-240; AdminUsageController.ts:84-94 (countByReason); AdminRepository.ts:84 y 93-102 (la lectura devuelve solo `provenance` y si la fila fue devuelta: ni el id de la receta ni su nombre salen de la base); PictureReason.ts (lista cerrada; el texto del proveedor o del revisor se reduce a una de ocho palabras en `pictureReasonOf`); AnalyticsRepository.ts claimOwnerAlert (el evento guarda solo `kind`, con `userId: null`); OwnerMail.spec.ts:43-62, 68-76, 153-160 y 173-215 (los dos avisos pasan por los mismos centinelas que I-K, el de nombre de plato incluido; un motivo hostil —nombre de plato, uuid, texto del revisor con una dirección, `__proto__`— sale como `Otro motivo`, y un recuento que no es un número sale como `0`); fase 1 en `abc0a90` (#172); la frase de la fase 2 y las líneas de Cron.controller.ts, RecipeController.ts y AdminCatalogue.service.ts, en el árbol de trabajo de main sobre `abc0a90`, sin commit.
Datos de persona: ninguno. Cuenta filas de `recipe_images`, que son platos del catálogo, no personas; no lleva el nombre del plato (decisión del propietario, 0072: `recipe_source` admite `user` y un día un nombre sería texto de alguien), ni su id, ni lo que escribió un proveedor o el revisor. `El revisor vio un alérgeno que el plato no tiene` habla de una imagen y de una receta, no de la alergia de nadie, y no nombra el alérgeno: no es dato de salud (art. 4.15 RGPD; C-184/20 no llega a un dato que no se refiere a una persona). El enlace no lleva id y solo abre con la sesión del propietario. Para el proveedor de correo y el buzón es información anónima (considerando 26 RGPD: «información que no guarda relación con una persona física identificada o identificable»; C-413/23 P) [abogado, la misma pregunta que H]. La hora a la que llega el primer aviso de una racha sigue a la visita de alguien a la página de una comida (el dibujo se reclama en esa visita): no viaja ningún identificador, y solo el propietario, con la consola que ya tiene, podría relacionar una hora con una cuenta; misma lectura que el § 2 de la nota del 2026-09-29. Sin efecto jurídico frente a nadie. Mismo fundamento de forma que H (RGPD arts. 5.1.c, 5.1.f y 32).
Lo que afirma, contra el código (nada es falso; tres imprecisiones P3):
(1) `intro`, «desde el aviso anterior» (OwnerAlert.ts:110): cierto desde el segundo aviso; el primero, sin ninguno anterior, cuenta las últimas 24 h (AdminAlertController.ts:226 y 232). Lo contado son platos que **siguen** en `failed` al leer: uno que falló y que el propietario reintentó entre dos avisos solo aparece en el siguiente si el reintento también falla, y entonces una vez, con la fecha del reintento (RecipeRepository.ts, `retryPicture` lo pone en `drawing` y `failPicture` fecha el nuevo fallo).
(2) `intro`, «Cada plato espera al menos 7 días antes de volver a dibujarse solo» (OwnerAlert.ts:110): cierto para lo que este correo cuenta, que son filas no devueltas (RecipeRepository.ts, claimPicture: una fila `failed` no devuelta solo se reclama con el último intento de hace más de `coolOffDays`). «Solo» quiere decir «sin que el propietario lo reintente»: no hay tarea que lo dibuje; lo dibuja la primera visita a la página de la comida pasado ese plazo. «Al menos» entró en la fase 2 (2026-09-30) y es lo que hace exacta la frase: un plato que guarda una imagen rechazada para revisar no se reclama mientras su fila tenga el puntero (claimPicture, RecipeRepository.ts:143, `not hasCandidate`; `unclaimable`, RecipeController.ts:95-104), y el puntero solo lo quita el propietario —al descartar o reintentar— o la limpieza de las 03:30 UTC posterior al séptimo día (Cron.controller.ts:103-109; RecipeController.ts:309-335). Así que ese plato espera 7 días y hasta 24 h más, o más noches si la limpieza no llega a él (8 s y como mucho 100 filas por noche; un borrado que falla se reintenta la siguiente). Un plato sin imagen guardada —sin C2PA, llamada fallida, o rechazada con el almacén privado sin configurar— espera 7 días exactos. El correo no dice cuál es cuál; «al menos» cubre los dos. Detalle del plazo en ../imagenes-de-platos.md § 4.3.
(3) `again`, «Como mucho un aviso por hora: lo que falle mientras tanto irá en el siguiente»: lo primero lo sostiene el reclamo (OwnerAlerts.service.ts:163; OwnerAlerts.spec.ts, «three failures within the hour»; picture-alerts.e2e-spec.ts). Lo segundo es cierto con una excepción que el propio código anota (AdminAlertController.ts:222-223: un dibujo que termina mientras se lee, fechado antes y escrito después, no entra en ningún correo; está en la consola). «El siguiente» no tiene hora: sale con el primer dibujo que termine pasada la hora o, si nadie abre un plato, con el siguiente cron (03:30 u 08:00 UTC), hasta unas 19 h después (informe 0005 § 4.1). El texto no promete plazo, así que no es falso.
Orden en `/cron/reminders`: la comprobación de este aviso va **después** de borrar las invitaciones caducadas (Cron.controller.ts:70 y 74-77; P3 aplicado el 2026-09-30, antes iba delante), porque el borrado sostiene un plazo prometido a terceros (§ A y § K; art. 5.1.e) y este aviso solo informa al propietario. En los dos crons corre dentro de un tope de 10 s (`WATCH_BUDGET_MS`, `:19`; `Promise.race` en `:74-77` para `/cron/reminders` y en `:92-98` para `/cron/rewrite-steps`, donde lo comparte con la vigilancia de K): un servidor de correo que no responde no retiene el barrido de recordatorios ni el nocturno más allá de ese tope. Tampoco lanza (`.catch` en `:75` y `:96`). En `/cron/rewrite-steps`, desde la fase 2, la limpieza de las imágenes rechazadas caducadas corre después de este aviso y con su propio tope de 8 s (`CLEANUP_BUDGET_MS`, `:26` y `:103-109`).
Las devoluciones (filas dadas de vuelta sin culpa del plato) no entran en este correo: las del proveedor —sin pago o límite de uso— van en N; la del tope del mes tiene su aviso de gasto (J); la de una receta borrada (`other`) solo se ve en la consola. -->

---

## N. Aviso al propietario: el proveedor de imágenes rechaza las peticiones (tal como está — `0072`, proyecto 009 fase 1)

**Plantilla**: `OwnerAlert.ts:116-128`, `type: 'picture-payment-refused'`, `EmailKind`
`owner-picture-alert`. **Destinatario**: solo `OWNER_EMAIL`, y solo si hay SMTP.
**Cuándo**: en los mismos momentos que M (es el mismo método,
`OwnerAlerts.service.ts:152-180`); sale si hay al menos una fila de `recipe_images`
**devuelta** con el motivo `payment_refused` o `model_refused` (`REFUSALS`,
`AdminAlertController.ts:79` y `238`) cuyo último intento cae entre el último aviso de
este tipo —o hace 24 h— y ahora (`:226` y `233`), y como mucho uno cada 6 horas
(`owner_alerted { kind: 'picture-payment-refused' }`, `OwnerAlerts.service.ts:169-176`;
el nombre del reclamo y del tipo no ha cambiado, aunque desde la decisión del propietario
del 2026-09-30 cubre también el límite de uso). `payment_refused` es un 402 o un mensaje de
clave o cuota agotada; `model_refused` en una fila **devuelta** es un 429, el límite de
uso: es el único otro rechazo que devuelve un dibujo (`isRefusal`,
`DishPicture.service.ts:77-83`; `reasonOfCall`, `PictureReason.ts`). Vengan de la llamada
que dibuja o de las del revisor: las dos usan la misma clave (`OPENROUTER_IMAGE_API_KEY`,
`ai.config.ts:388`). **Marcadores**: `{total}` y `{n}`, enteros no negativos (`whole`);
`{motivo}`, por `reasonLabel`, aquí una de dos etiquetas: `El proveedor no puede cobrar`
y `El modelo rechazó la petición`.

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `NutrIA — el proveedor de imágenes rechaza las peticiones` | — |
| `intro` | `El proveedor de las imágenes está rechazando las peticiones: la clave de imágenes no puede pagar o ha llegado a su límite de uso. Mientras dure, los dibujos que rechace se devuelven sin dibujar.` (propuesta P3 aplicada) | — |
| `detail` | `Platos con el dibujo devuelto desde el aviso anterior: {total}. Por motivo: {motivo}: {n}; {motivo}: {n}. Esos platos no cuentan como fallidos: se dibujan en la siguiente visita, cuando el proveedor vuelva a aceptar peticiones.` | — |
| `button` | `Abrir las imágenes` → `/admin/catalogo/imagenes` | — |
| `again` | `Mientras dure, no volverás a recibir este aviso durante 6 horas.` | — |

<!-- Fuente: OwnerAlert.ts:36, 73-75 (byReason) y 116-128; OwnerAlerts.service.ts:20 (REPEAT_HOURS = 6) y 169-176; AdminAlertController.ts:70-79, 88-93 y 225-240; DishPicture.service.ts:77-83 (isRefusal: 402, 429, cuota o límite de la clave) y release(); RecipeRepository.ts releasePicture (`provenance: { reason, released }`) y claimPicture (una fila devuelta se reclama en la siguiente visita, sin espera); AdminCatalogueRepository.ts:99-103 (PICTURE_STATE: una fila devuelta se lee como `none`, no como `failed`); OwnerMail.spec.ts:55-61, 202-215 y 217-227; OwnerAlerts.spec.ts:314 («mails a refused payment or a rate limit under its own claim, once in six hours»); AdminAlertController.test.ts:223 («counts the provider’s refusals — no payment, a rate limit — only on rows given back, and never the month’s cap»); picture-alerts.e2e-spec.ts:457; decisión del propietario del 2026-09-30 (el límite de uso se avisa junto con el pago rechazado); árbol de trabajo de main sobre 0d7b275, sin commit.
Datos de persona: ninguno; recuentos, dos etiquetas fijas y un enlace sin id, por los mismos filtros que M (`reasonLabel`, `whole`). Es información sobre la cuenta del propietario con su proveedor, no sobre nadie más. Sin efecto jurídico frente a nadie; mismo fundamento de forma que H (arts. 5.1.c, 5.1.f y 32) y misma lectura [abogado] del considerando 26.
Lo que afirma, contra el código (nada es falso; de las dos imprecisiones P3 que nacieron de sumar el límite de uso, la primera está corregida y la segunda se deja como está):
(1) `intro`, «Mientras dure, los dibujos que rechace se devuelven sin dibujar» (OwnerAlert.ts:124): cierto para los dos motivos (`release()`, DishPicture.service.ts: el dibujo rechazado se devuelve y no cuenta contra el plato). Antes decía «no se dibuja ninguna», exacto para una clave que no puede pagar y de más para un límite de uso, donde un 429 devuelve el dibujo que lo recibe y el siguiente puede salir; corregido el 2026-09-30. «Está rechazando», en presente, es cierto cuando el aviso sale al terminar el dibujo rechazado; si sale por un cron horas después puede haber pasado ya, y «Mientras dure» lo cubre.
(2) `detail`, etiqueta `El modelo rechazó la petición` para un 429 (OwnerAlert.ts:56): es la palabra de la consola para `model_refused`, pero en este correo ese motivo es siempre el límite de uso del proveedor, no una negativa del modelo; la `intro` lo dice bien («ha llegado a su límite de uso») y la etiqueta no. No pido cambio: mantener la palabra de la consola tiene más valor que afinarla aquí.
(3) `detail`, «Platos con el dibujo devuelto desde el aviso anterior: {total}»: cuenta platos cuya fila sigue devuelta al leer, uno por plato (AdminAlertController.ts:238), y el total es la suma de los dos motivos (OwnerAlert.ts:117). Como en M, el primer aviso cuenta 24 h (P3, aceptable).
(4) «Esos platos no cuentan como fallidos: se dibujan en la siguiente visita, cuando el proveedor vuelva a aceptar peticiones»: cierto (no entran en M, AdminAlertController.ts:237; la consola los lee como sin imagen; el intento devuelto no gasta intentos del plato ni abre la espera de 7 días).
(5) `again`, «durante 6 horas»: OwnerAlerts.service.ts:172. Un solo reclamo para los dos motivos: un 429 suelto silencia durante 6 h también el aviso de un pago rechazado que llegue después; ese pago sale en el siguiente aviso, con su recuento, porque cada uno cuenta desde el anterior. -->

---

## O. «Alguien ha intentado crear una cuenta con tu correo» (tal como está — proyecto 011 fase 8, PR #217)

> **No soy abogado.** Documentado tal como está construido en `feat/011-p8-signup`
> (`4f36ec5`), verdad una vez fusionado. Análisis en
> [`../analisis.md` § 4.1 ter](../analisis.md).

**Plantilla**: `apps/api/src/modules/email/templates/ExistingAccountSignUp.ts`, `EmailKind`
`existing-account-sign-up`. **Destinatario**: la dirección de la cuenta que ya existe, y
nadie más (`ExistingAccountMail.ts`). **Cuándo**: alguien pide crear una cuenta con esa
dirección; Better Auth contesta al que lo pide lo mismo que a una dirección nueva y llama a
`onExistingUserSignUp`, en segundo plano. **Límite**: tres por dirección y hora
(`MailBudget`, tipo `existing-account`); el cuarto no sale. **Idioma**: el guardado en la
cuenta; si no, el de la petición. **Marcadores**: los dos enlaces, `{signInUrl}` (`/acceder`)
y `{recoverUrl}` (`/recuperar`), con el prefijo del idioma.

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `Alguien ha intentado crear una cuenta con tu correo` | `Somebody tried to create an account with your address` |
| `what` | `Alguien ha intentado crear una cuenta de NutrIA con esta dirección, que ya tiene una. Si has sido tú, no necesitas otra: entra con la que ya tienes.` | `Somebody tried to create a NutrIA account with this address, which already has one. If it was you, you do not need another: sign in with the one you have.` |
| `button` | `Entrar` → `{signInUrl}` | `Sign in` → `{signInUrl}` |
| `google` | `Si creaste la cuenta con Google, entra con Google.` | `If you created the account with Google, sign in with Google.` |
| `reset` | `Si no recuerdas la contraseña, puedes poner una nueva aquí:` + `{recoverUrl}` | `If you have forgotten your password, you can set a new one here:` + `{recoverUrl}` |
| `notYou` | `Si no has sido tú, no tienes que hacer nada: no se ha creado ninguna cuenta y no ha cambiado nada de la tuya.` | `If it was not you, there is nothing to do: no account was created and nothing of yours changed.` |
| `linkFallback` | `Si el botón no funciona, copia esta dirección en tu navegador:` + `{signInUrl}` | `If the button does not work, copy this address into your browser:` + `{signInUrl}` |

**Veredicto**: se puede enviar tal cual. Una mejora P3, abajo.

<!-- Fuente: RGPD art. 6.1.f con el considerando 49 (EUR-Lex: «Constituye un interés legítimo del responsable del tratamiento interesado el tratamiento de datos personales en la medida estrictamente necesaria y proporcionada para garantizar la seguridad de la red y de la información…») y art. 32.1; para la persona de la cuenta, también 6.1.b. No es comunicación comercial: LSSI (BOE-A-2002-13758, consolidado a 23/01/2025), anexo, letra f (la dirigida a la promoción de bienes, servicios o la imagen de una empresa); el art. 21.1 prohíbe las «publicitarias o promocionales» no solicitadas, y este correo no promociona nada: no necesita consentimiento ni baja, y no se puede desactivar (como «tu contraseña ha cambiado», analisis.md § 4.1 bis). Minimización (art. 5.1.c): nada de quien lo intentó (ni nombre tecleado, ni hora, ni dispositivo, ni IP) — el nombre lo eligió un extraño y podría ser cualquier cosa; la persona no lo necesita para actuar. Ninguna palabra de salud (M14). Art. 13: dentro de «avisos de seguridad de tu cuenta… que no se pueden desactivar» de `/privacidad` («Con quién compartimos», proveedor de correo); el «como» presenta ejemplos, no una lista cerrada. Lo que afirma, contra el código: «no se ha creado ninguna cuenta»: cierto, Better Auth devuelve un usuario sintético y no escribe nada (`better-auth/dist/api/routes/sign-up.mjs:200-202`, 1.7.6); «no ha cambiado nada de la tuya»: cierto, la única fila nueva es la del presupuesto de correos, que es de una huella de la dirección, no de la cuenta; «si creaste la cuenta con Google, entra con Google»: un consejo, no una afirmación sobre la cuenta (el correo es el mismo para todas, y no dice si la cuenta tiene contraseña). Traza: `console.info` con el id de la cuenta, nunca la dirección; `mail_sent` con el tipo y sin usuario (`Email.service.ts:118-119`). -->

**P3 — a quien la cuenta se la creó otra persona.** Si la cuenta existente la creó un
extraño con esta dirección y nunca la confirmó, quien recibe el correo lee «ya tiene una» y
no sabe de qué cuenta se trata. La salida es el enlace de `reset`. Frase nueva, antes de
`reset`, en dos variantes según lo que se fusione:

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `notRemembered` (nuevo), si restablecer confirma la dirección | `Si no recuerdas haber creado una cuenta, puede que alguien la creara con tu dirección: pon una contraseña nueva en el enlace de abajo y entra con ella.` | `If you do not remember creating an account, somebody may have created one with your address: set a new password with the link below and sign in with it.` |
| `notRemembered` (nuevo), si no la confirma | la misma, más `; te enviaremos un enlace para confirmar que la dirección es tuya.` | the same, plus `; we will send you a link to confirm the address is yours.` |

<!-- Cuál es verdad: en `4f36ec5` restablecer NO confirma la dirección (Better Auth 1.7.6, `dist/api/routes/password.mjs`, no toca `emailVerified`): al entrar con la contraseña nueva, la cuenta sin confirmar recibe el 401 y un enlace (`sendOnSignIn`), y el enlace abre la sesión (`autoSignInAfterVerification`) — segunda variante. El 2026-10-03 `backend-011p8` tiene en su árbol de trabajo, sin commit, `onPasswordReset` → `UserController.confirmAddressByReset` (confirma la dirección al restablecer, solo si no lo estaba) — con eso, primera variante. En los dos casos restablecer cierra las sesiones del otro (`revokeSessionsOnPasswordReset: true`) y borra el freno. No prometo «quien la creó ya no podrá entrar»: si activó un segundo factor en esa cuenta, la frase sería más de lo que el código garantiza sin comprobarlo. -->
