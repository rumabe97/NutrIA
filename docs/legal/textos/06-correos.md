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
> [`../2026-09-29-mail-to-the-owner.md`](../2026-09-29-mail-to-the-owner.md) (con su
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

### A bis. La invitación cuando cualquiera puede abrir una consulta (proyecto 025, fase 6 — **palabras nuevas, sin aprobar**)

**Plantilla**: `apps/api/src/modules/email/templates/CareInvitation.ts`, objeto `COPY`. **Cuándo
se publica**: en el mismo cambio que deja abrir una consulta sin insignia (fase 6), no después.
Desde ese día, el correo puede salir de alguien a quien nadie ha comprobado.

**Lo que dice hoy la plantilla, campo por campo** (leída el 2026-11-19, rama
`project-025-phase-6-anyone-opens-a-practice`):

| Campo | Hoy | ¿Falso o protegido desde la fase 6? |
| --- | --- | --- |
| `intro` | `{name} te ha invitado a llevar tu plan de comidas juntos en NutrIA, como tu dietista.` / `… as your dietitian.` | **Sí.** «como tu dietista» es NutrIA atribuyendo el título protegido a quien quizá no lo tiene. |
| `meaning` | `Si aceptas, verá tu plan y cómo lo llevas, y podrá ajustarlo contigo. …` | **Sí, sin insignia.** «cómo lo llevas» es la adherencia, y un profesional sin insignia no la ve (PRD 025 criterio 9). |
| `subject`, `button`, `choose`, `expires`, `ignore`, `privacy`, `linkFallback` | — | No. Ninguno dice «dietista», «paciente» ni lo que verá. `choose` («verás exactamente qué podrá ver») es verdad en los dos niveles. |
| comentario de la plantilla (líneas 12-14) | «the dietitian sees the plan and how it goes» | No se publica, pero describe lo que ya no es verdad: lo corrige `backend` con la misma frase de abajo. |

**Decisión: una sola frase neutra para los dos niveles. El correo no nombra el título, ni con
insignia.**

- **El correo no puede pintar el título desde la insignia sin arriesgarse a decir algo falso.**
  Se envía una vez y vale 14 días. Una insignia puede caducar o retirarse dentro de ese plazo
  (`0111` § 2: se lee en cada petición), y el correo ya enviado no se puede corregir. Una
  afirmación de NutrIA sobre una cualificación tiene que ser verdad cuando se lee: LCD arts. 5.1.g
  y 21.1.c; CP art. 403.2.a, porque es NutrIA quien lo atribuye y no el profesional (legal
  § 3.a).
- **La página de la invitación sí lo dice, pintado de la insignia en ese momento**
  ([`05`](./05-consentimientos-cliente.md) § F.1). Esa página es lo que la persona lee antes de
  aceptar, y es donde se pide el consentimiento. El correo es la primera capa e informa de
  quién escribe y para qué (RGPD arts. 12.1, 14.1, 14.3.b).
- **La plantilla solo recibe el nombre** (`careInvitationEmail({ inviterName, … })`). Una frase
  por nivel exigiría pasarle la insignia y la fecha, y sería otro lugar donde puede divergir del
  único `badgeOf`.
- **Es lo que el propietario ya aprobó como principio** (C3, 2026-11-18: «tu profesional» y
  ningún título fuera de la insignia). Las frases exactas son nuevas.

| Campo | es-ES nuevo | en-GB nuevo |
| --- | --- | --- |
| `intro` | `{name} te ha invitado a que te haga el plan de comidas en NutrIA.` | `{name} has invited you to let them make your meal plan on NutrIA.` |
| `meaning` | `Si aceptas, podrá hacerte el plan y ajustarlo contigo. Qué más podrá ver depende de lo que aceptes, y antes de aceptar verás la lista exacta.` | `If you accept, they can make your plan and adjust it with you. What else they can see depends on what you accept, and before accepting you will see the exact list.` |
| `subject` | sin cambios: `{name} te ha invitado a NutrIA` | unchanged: `{name} has invited you to NutrIA` |
| los demás | sin cambios | unchanged |

<!-- Fuente: PRD 025 scope 5 («The title "dietista-nutricionista" on any screen is rendered from the badge, never from typed text») y scope 12 / criterio 19 («tu profesional» salvo con insignia); C3 aprobada el 2026-11-18; legal 2026-11-18 § 3.a (las palabras propias de NutrIA quedan fuera de la exención de alojamiento: LSSI art. 16, DSA art. 6.1) y § 1.3; LCD arts. 5.1.g y 21.1.c; CP art. 403.2.a; RGPD arts. 5.1.a, 12.1, 14.1.c y 14.3.b (el correo informa del fin; la lista se lee detrás del acceso). Sin palabra de salud, como el resto de este fichero. «Qué más podrá ver depende de lo que aceptes» es verdad en los dos niveles: sin insignia, la lista de 05 § F.3; con insignia, la de B1 y la línea de salud aparte. No sube ninguna versión: un correo no es un texto de consentimiento. -->

---

## B. Alta como profesional (nuevo)

> **Proyecto 025: este correo se retira con la ruta que lo envía** (`0111` § 9: `POST
> /admin/accounts/:id/professional` desaparece; la plantilla `ProfessionalGranted.ts` con ella). Nadie
> recibe ya una consulta de manos del titular, y su frase «con el número de colegiado
> {collegiateNumber}» imprimiría un número que nadie ha comprobado. Lo sustituyen §§ R–X.

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

<!-- Fuente: política vigente, § «Cambios en esta política» (es-ES.ts, namespace privacy); RGPD arts. 12.1 y 13.3 (información antes de un tratamiento nuevo), 13.1.e-f (destinatarios y transferencias); analysis.md § 4.4. «No guardan… ni lo usan para entrenar»: NO_TRAINING_PROVIDER (ai.config.ts), ajustes de cuenta del runbook ai-gateway.md § 0 y lista cerrada (P1-12). No menciona la categorización anónima de OpenRouter para no alargar un aviso: la enlaza la política, que sí la dice. Correo de servicio, no comercial: LSSI art. 21 no aplica. {date} = la fecha real del cambio; si se retrasa, no se reenvía, pero no se adelanta. Sin plantilla hoy: si se envía a mano, en copia oculta. -->

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

<!-- Fuente: OwnerDigest.ts:25-38 y 66-106, AdminAlertController.ts:68-74 (safeCode, safeKind), OwnerAlerts.service.ts:54 y 61 (destinatario y enlaces), a1fac59. Sin efecto jurídico frente a nadie: no informa a un interesado ni avisa de un contrato. Su forma responde a RGPD arts. 5.1.c (minimización) y 5.1.f y 32 (confidencialidad): el correo sale por un proveedor y vive en un buzón menos protegido que la consola, así que lleva recuentos, códigos de lista cerrada, etiquetas fijas y enlaces sin id. Para el proveedor es información anónima (considerando 26; C-413/23 P) [abogado]. La propuesta de FOOT evita «dirección», que también es la web de los enlaces, y dice de quién no viaja nada; la de INTRO nombra los códigos, que también viajan. Ninguna contiene «@» (OwnerMail.spec.ts sigue igual). Veredicto: ../2026-09-29-mail-to-the-owner.md. -->

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

<!-- Fuente: AccountWaiting.ts:15-32, AccountWaitingMail.ts:6-9 y 32-51, auth.config.ts:50 (selfService.link) y 182-183, SelfService.ts:51-66; AccountWaiting.spec.ts comprueba en asunto, texto y HTML, en los dos idiomas, que no aparece «@», «usr-», un UUID, «token», «/admin/activate» ni «update "user"»; árbol de trabajo de admin-console-loose-ends sobre e1332b4, sin commit; decisión en docs/decisions/LOG.md (2026-09-29, enmienda 0029/0030; decidió el propietario). Por qué así: el correo sale por el proveedor SMTP (hoy Gmail de consumo, sin DPA, P2-10) y se queda en un buzón sin plazo de supresión. Llevar la dirección era guardar un dato de cada alta sin plazo, fuera del sistema que la borra con la cuenta (art. 5.1.e; minimización, 5.1.c); llevar el token era dejar en ese buzón una llave que abre una cuenta sin sesión (arts. 5.1.f y 32). Ahora el correo no dice quién ni permite hacer nada: para el proveedor y el buzón es información anónima (considerando 26; C-413/23 P) [abogado], y quien lo abre necesita la sesión del propietario para ver algo. Los correos enviados antes del cambio siguen en el buzón con la dirección y un token que GET /admin/activate honra hasta que caduque (30 días, ActivationLink.ts:4): ver la adenda de ../2026-09-29-mail-to-the-owner.md. Sin efecto jurídico frente a nadie; la política no cambia (sus fines del proveedor de correo nunca incluyeron este aviso, y ahora no hace falta). -->

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
(2) `intro`, «Cada plato espera al menos 7 días antes de volver a dibujarse solo» (OwnerAlert.ts:110): cierto para lo que este correo cuenta, que son filas no devueltas (RecipeRepository.ts, claimPicture: una fila `failed` no devuelta solo se reclama con el último intento de hace más de `coolOffDays`). «Solo» quiere decir «sin que el propietario lo reintente»: no hay tarea que lo dibuje; lo dibuja la primera visita a la página de la comida pasado ese plazo. «Al menos» entró en la fase 2 (2026-09-30) y es lo que hace exacta la frase: un plato que guarda una imagen rechazada para revisar no se reclama mientras su fila tenga el puntero (claimPicture, RecipeRepository.ts:143, `not hasCandidate`; `unclaimable`, RecipeController.ts:95-104), y el puntero solo lo quita el propietario —al descartar o reintentar— o la limpieza de las 03:30 UTC posterior al séptimo día (Cron.controller.ts:103-109; RecipeController.ts:309-335). Así que ese plato espera 7 días y hasta 24 h más, o más noches si la limpieza no llega a él (8 s y como mucho 100 filas por noche; un borrado que falla se reintenta la siguiente). Un plato sin imagen guardada —sin C2PA, llamada fallida, o rechazada con el almacén privado sin configurar— espera 7 días exactos. El correo no dice cuál es cuál; «al menos» cubre los dos. Detalle del plazo en ../dish-pictures.md § 4.3.
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
> [`../analysis.md` § 4.1 ter](../analysis.md).

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

<!-- Fuente: RGPD art. 6.1.f con el considerando 49 (EUR-Lex: «Constituye un interés legítimo del responsable del tratamiento interesado el tratamiento de datos personales en la medida estrictamente necesaria y proporcionada para garantizar la seguridad de la red y de la información…») y art. 32.1; para la persona de la cuenta, también 6.1.b. No es comunicación comercial: LSSI (BOE-A-2002-13758, consolidado a 23/01/2025), anexo, letra f (la dirigida a la promoción de bienes, servicios o la imagen de una empresa); el art. 21.1 prohíbe las «publicitarias o promocionales» no solicitadas, y este correo no promociona nada: no necesita consentimiento ni baja, y no se puede desactivar (como «tu contraseña ha cambiado», analysis.md § 4.1 bis). Minimización (art. 5.1.c): nada de quien lo intentó (ni nombre tecleado, ni hora, ni dispositivo, ni IP) — el nombre lo eligió un extraño y podría ser cualquier cosa; la persona no lo necesita para actuar. Ninguna palabra de salud (M14). Art. 13: dentro de «avisos de seguridad de tu cuenta… que no se pueden desactivar» de `/privacidad` («Con quién compartimos», proveedor de correo); el «como» presenta ejemplos, no una lista cerrada. Lo que afirma, contra el código: «no se ha creado ninguna cuenta»: cierto, Better Auth devuelve un usuario sintético y no escribe nada (`better-auth/dist/api/routes/sign-up.mjs:200-202`, 1.7.6); «no ha cambiado nada de la tuya»: cierto, la única fila nueva es la del presupuesto de correos, que es de una huella de la dirección, no de la cuenta; «si creaste la cuenta con Google, entra con Google»: un consejo, no una afirmación sobre la cuenta (el correo es el mismo para todas, y no dice si la cuenta tiene contraseña). Traza: `console.info` con el id de la cuenta, nunca la dirección; `mail_sent` con el tipo y sin usuario (`Email.service.ts:118-119`). -->

**P3 — a quien la cuenta se la creó otra persona.** Si la cuenta existente la creó un
extraño con esta dirección y nunca la confirmó, quien recibe el correo lee «ya tiene una» y
no sabe de qué cuenta se trata. La salida es el enlace de `reset`. Frase nueva, antes de
`reset`, en dos variantes según lo que se fusione:

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `notRemembered` (nuevo), si restablecer confirma la dirección | `Si no recuerdas haber creado una cuenta, puede que alguien la creara con tu dirección: pon una contraseña nueva en el enlace de abajo y entra con ella.` | `If you do not remember creating an account, somebody may have created one with your address: set a new password with the link below and sign in with it.` |
| `notRemembered` (nuevo), si no la confirma | la misma, más `; te enviaremos un enlace para confirmar que la dirección es tuya.` | the same, plus `; we will send you a link to confirm the address is yours.` |

<!-- Cuál es verdad: en `4f36ec5` restablecer NO confirma la dirección (Better Auth 1.7.6, `dist/api/routes/password.mjs`, no toca `emailVerified`): al entrar con la contraseña nueva, la cuenta sin confirmar recibe el 401 y un enlace (`sendOnSignIn`), y el enlace abre la sesión (`autoSignInAfterVerification`) — segunda variante. El 2026-10-03 `backend-011p8` tiene en su árbol de trabajo, sin commit, `onPasswordReset` → `UserController.confirmAddressByReset` (confirma la dirección al restablecer, solo si no lo estaba) — con eso, primera variante. En los dos casos restablecer cierra las sesiones del otro (`revokeSessionsOnPasswordReset: true`) y borra el freno. No prometo «quien la creó ya no podrá entrar»: si activó un segundo factor en esa cuenta, la frase sería más de lo que el código garantiza sin comprobarlo. -->

---

## P. Correo de confirmación de la dirección (tal como está — proyecto 011, seguimiento del barrido, `0092`, PR #250)

> **No soy abogado.** Documentado **tal como está construido** en `main` (`fbab7b1b`), no
> como borrador. Entra en este documento porque desde #250 lleva una **promesa de
> conservación**: dice durante cuánto tiempo se guarda una cuenta que nadie confirma, y eso
> es información del art. 13.2.a dada en el momento de la recogida. Análisis en
> [`../analysis.md` § 4.1 quinquies](../analysis.md).

**Plantilla**: `apps/api/src/modules/email/templates/VerifyEmail.ts`, `EmailKind`
`verify-email`. **Destinatario**: la dirección que se acaba de dar de alta. **Cuándo**: al
crear la cuenta, y otra vez en cada intento de entrar con la contraseña mientras siga sin
confirmar (`emailVerification.sendOnSignIn`). **Límite**: tres por dirección y hora
(`MailBudget`, tipo `verification`). **Marcador**: `{url}`, el enlace con el JWT de
confirmación (caduca a la hora). El enlace **no abre sesión**
(`autoSignInAfterVerification: false`) y **no abre la cuenta**: activarla es cosa del
propietario.

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `Confirma tu correo en NutrIA` | `Confirm your address for NutrIA` |
| `intro` | `Confirma este correo para que sepamos que es tuyo.` | `Confirm this address so we know it is yours.` |
| `button` | `Confirmar mi correo` → `{url}` | `Confirm my address` → `{url}` |
| `next` | `NutrIA se está abriendo poco a poco. En cuanto activemos tu cuenta podrás entrar y empezar; esto no volverá a pedírtelo.` | `NutrIA is opening a few accounts at a time. Once yours is opened you can sign in and start; we will not ask for this again.` |
| `ignore` | `Si no te has registrado, no confirmes nada: ignora este mensaje y, al mes, borramos el correo que nadie confirma junto con su registro.` | `If you did not sign up, do not confirm anything: ignore this message, and we delete an address nobody confirms, with its sign-up, after thirty days.` |
| `linkFallback` | `Si el botón no funciona, copia esta dirección en tu navegador:` + `{url}` | `If the button does not work, copy this address into your browser:` + `{url}` |

**Veredicto**: se puede enviar tal cual, y la promesa de `ignore` es verdad del código
(#250). Dos cosas, abajo: una corrección P3 de redacción y el límite que hay que conocer.

<!-- Fuente: RGPD art. 13.2.a (el plazo de conservación o los criterios para determinarlo — informado aquí en el momento de la recogida, y por eso la política tiene que decir lo mismo: ⟦barrido-sin-confirmar⟧ de 02); art. 5.1.a (lealtad y transparencia: dos textos del mismo producto no pueden decir plazos distintos del mismo dato); art. 5.1.e y 17.1.a (lo que justifica el borrado); art. 32.1.b y 25 (confirmar antes de entrar es la medida que impide que un extraño escriba en una cuenta a nombre de otra dirección). No es comunicación comercial: LSSI (BOE-A-2002-13758, consolidado a 23/01/2025), anexo, letra f — es un mensaje de servicio, base art. 6.1.b. Código leído en `fbab7b1b`: `UNCONFIRMED_ACCOUNT_RETENTION_DAYS = 30` (`packages/core/src/entities/Audit/Audit.ts:70`), `staleUnconfirmedWhere` (`packages/core/src/repositories/User/UserRepository.ts:181`), cron `5 8 * * *` (`apps/api/vercel.json`); `account` en cascada con `user` (`packages/database/src/schemas/auth.schema.ts:96-98`), y el enlace es un JWT firmado, no una fila (Better Auth 1.7.7, `dist/api/routes/email-verification.mjs:14-20`), así que «borramos el correo … junto con su registro» es literal. El docblock de la plantilla ya recoge por qué la línea `ignore` está redactada así; una edición posterior que la suavice vuelve a abrir el residuo que `0092` cierra. -->

**P3 — «al mes» no es «a los treinta días».** El inglés dice `after thirty days` y el
código son treinta días exactos; «al mes» son 28, 30 o 31 según el mes, y la política va a
publicar «a los treinta días» en los dos idiomas. Cambio propuesto, solo el español:

| Campo | es-ES (propuesto) |
| --- | --- |
| `ignore` | `Si no te has registrado, no confirmes nada: ignora este mensaje y, a los treinta días, borramos el correo que nadie confirma junto con su registro.` |

**El límite que hay que conocer.** La promesa no vale para una cuenta que el propietario
haya **abierto** desde la consola sin estar confirmada: abrirla escribe una fila de rastro
(`account.activated` con `subjectUserId`) y eso la saca del barrido para siempre
(`../analysis.md` § 4.1 quinquies). No se arregla en el correo —enumerar excepciones en una
línea que tiene que leerse en dos segundos lo empeora—, sino en la operativa: el
propietario activa solo cuentas confirmadas (casilla del
[`../go-live-checklist.md`](../go-live-checklist.md) § 0 septies) y, si se quiere en
el código, la consola no deja activar una cuenta con `emailVerified = false`.

---

## Q. Aviso del asistente (una vez, antes de encender el interruptor `assistant`, proyecto 023 fase 7)

**Cuándo**: a cada cuenta, una vez, **después** de publicar `/privacidad` y `/condiciones` nuevas
y **antes** del interruptor, que se enciende como pronto al día siguiente. `{date}` = el día en
que el propietario piensa encenderlo; si se retrasa, no se reenvía, pero nunca se adelanta.

**Por qué**: la política y las condiciones prometen las dos «te avisaremos por correo antes de
que se aplique» para un cambio importante. Un destinatario nuevo (Anthropic), un almacén nuevo de
texto libre y un límite nuevo lo son. No es el caso del 2026-10-20, que estrechó una pantalla y no
añadió ningún destinatario. Si el propietario no lo envía, la consecuencia y el porqué de no
encender el interruptor sin él están en [`../assistant-privacy.md`](../assistant-privacy.md) § 6.

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `Llega el asistente de NutrIA, y cambian la política de privacidad y las condiciones` | `NutrIA’s assistant is coming, and the privacy policy and terms are changing` |
| `intro` | `A partir del {date}, NutrIA tiene un asistente: puedes preguntarle por tu plan, por recetas, ingredientes y macros, y te contesta una inteligencia artificial. Es opcional: si no lo usas, no se envía ni se guarda nada nuevo sobre ti.` | `From {date}, NutrIA has an assistant: you can ask it about your plan, recipes, ingredients and macros, and an artificial intelligence answers. It is optional: if you do not use it, nothing new about you is sent or kept.` |
| `what` | `Si lo usas, lo que escribes se envía a Anthropic, que ejecuta el modelo, junto con tu plan, tus objetivos diarios y tus gustos; nunca tu nombre, tu correo, tu peso, tus alergias ni tu salud. Anthropic no entrena con ello y lo borra como mucho a los 30 días, salvo que sus sistemas lo marquen como contrario a sus normas de uso. Tus conversaciones se guardan en tu cuenta para que puedas retomarlas: no las ve tu dietista ni aparecen en nuestra consola, puedes borrarlas cuando quieras y se borran solas seis meses después de su último mensaje. Por favor, no escribas en el asistente nada sobre tu salud.` | `If you use it, what you type is sent to Anthropic, which runs the model, together with your plan, your daily targets and your tastes; never your name, email, weight, allergies or health. Anthropic does not train on it and deletes it within 30 days at most, unless its systems flag it as breaking its usage rules. Your conversations are kept in your account so that you can come back to them: your dietitian does not see them and they do not appear in our console, you can delete them whenever you like, and they delete themselves six months after their last message. Please do not write anything about your health in the assistant.` |
| `terms` | `Las condiciones de uso cambian para incluirlo: los mensajes al asistente tienen un límite por quincena, más alto con Premium; el asistente puede equivocarse y no sustituye a un profesional; y no respondemos de las decisiones de salud que tomes a partir de una respuesta suya sin consultar a un profesional, como ya pasaba con los planes.` | `The terms of use change to include it: messages to the assistant have a limit each fortnight, higher with Premium; the assistant can get things wrong and does not replace a professional; and we do not answer for health decisions you take from one of its answers without speaking to a professional, as was already the case with plans.` |
| `choose` | `Los detalles están en {privacyUrl}, en «El asistente», y en {termsUrl}. Si tienes cualquier duda, escríbenos a {email}. Si no estás de acuerdo, puedes no usar el asistente o borrar tu cuenta desde tu perfil.` | `The details are at {privacyUrl}, under "The assistant", and at {termsUrl}. If you have any question, write to us at {email}. If you do not agree, you can simply not use the assistant, or delete your account from your profile.` |

<!-- Fuente: política vigente, «Cambios en esta política»; condiciones vigentes, «Cambios en estas condiciones»; RGPD arts. 12.1, 13.1.e-f y 13.3; TRLGDCU art. 60.1. Lo que dice de Anthropic, tal como lo dicen sus páginas el 2026-11-10 (../assistant-privacy.md § 8). «Nunca tu peso, tus alergias ni tu salud»: AssistantContext tras F1 y F5 (sin alergias, objetivo ni forma de comer). «Si no lo usas, no se envía ni se guarda nada nuevo»: no se escribe ninguna fila ni se hace ninguna llamada hasta que alguien envía un mensaje. Correo de servicio, no comercial: LSSI art. 21 no aplica. Sin plantilla hoy: si se envía a mano, en copia oculta. {privacyUrl} = /privacidad#asistente (o /en/privacidad#asistente); {termsUrl} = /condiciones (o /en/condiciones). -->

---

# Proyecto 025 — la consulta abierta a cualquiera (borradores del 2026-11-18)

> **Nada de esto está construido.** Cada texto se publica en la fase del plan que trae su
> plantilla, no antes. Qué es cada uno, por qué y qué elecciones hace (C1–C12):
> [`../2026-11-18-anyone-can-open-a-practice.md`](../2026-11-18-anyone-can-open-a-practice.md).
> Rigen las mismas reglas de este fichero: ningún correo lleva una palabra de salud, y el
> titular de NutrIA se identifica enlazando la política (`{privacyUrl}`). Los marcadores nuevos
> están en cada sección. Ninguno lleva el nombre, la dirección ni el teléfono de nadie escritos
> aquí: los rellena el código o el propietario al enviarlos.

---

## R. El código de la insignia, por correo (fase 3)

**Cuándo**: el propietario registra en la consola el canal `register_email` y la dirección que
publica el registro, y la app envía el código. (El canal `college_email` lo descartó el
propietario el 2026-11-18, C12: el código va solo a un contacto que muestra el registro.) **Plantilla
nueva**: `ProfessionalBadgeCode.ts`, `EmailKind` `professional-badge-code`. **El destinatario
puede no ser quien pidió la insignia** (hallazgo F2): por eso lleva la información del art. 14 y
una salida para «no he sido yo».

**Marcadores**: `{registerName}` (el nombre como lo muestra el registro), `{number}`,
`{register}` (el colegio), `{code}`, `{expires}` (fecha), `{privacyUrl}` =
`/privacidad#tu-profesional`.

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `Tu código para comprobar tu colegiación en NutrIA` | `Your code to check your registration on NutrIA` |
| `intro` | `Te escribimos desde NutrIA, una aplicación de planes de comidas. Una cuenta de NutrIA ha pedido nuestra insignia de dietista-nutricionista colegiada/o con este nombre y este número: {registerName}, número {number}, de {register}.` | `We are writing from NutrIA, a meal-planning app. A NutrIA account has applied for our registered dietitian-nutritionist badge with this name and number: {registerName}, number {number}, of {register}.` |
| `ifYou` | `Si has sido tú, entra en NutrIA, ve a tu consulta e introduce este código: {code}. Caduca el {expires}.` | `If it was you, sign in to NutrIA, go to your practice and enter this code: {code}. It expires on {expires}.` |
| `ifNot` | `Si no has sido tú, no hagas nada con el código y respóndenos a este correo: alguien ha usado tu nombre y tu número. No daremos la insignia y no volveremos a escribirte por esto.` | `If it was not you, do nothing with the code and reply to this email: somebody has used your name and number. We will not give the badge, and we will not write to you about this again.` |
| `why` | `Hemos sacado esta dirección de {source}. La usamos solo para enviarte este código, para comprobar que quien pide la insignia eres tú, por nuestro interés legítimo y el de quienes usan NutrIA: que nadie se haga pasar por dietista-nutricionista. En NutrIA no la guardamos; la copia de este correo en nuestro buzón la borramos cuando caduca el código. Guardamos el registro consultado, la fecha, el número, el resultado y que el código fue por correo. Quién es el responsable, tus derechos y cómo reclamar ante la Agencia Española de Protección de Datos: {privacyUrl}` | `We took this address from {source}. We use it only to send you this code, to check that the person applying for the badge is you, in our legitimate interest and that of the people who use NutrIA: that nobody passes themselves off as a dietitian-nutritionist. We do not keep it on NutrIA; we delete the copy of this email in our mailbox when the code expires. We keep the register we looked at, the date, the number, the result and that the code went by email. Who is responsible, your rights and how to complain to the Spanish Data Protection Agency: {privacyUrl}` |

`{source}`: `el registro público de colegiados de {register}, que la publica para que cualquiera pueda comprobar una colegiación` / `{register}'s public register of members, which publishes it so that anyone can check a registration`.

<!-- Fuente: RGPD art. 14.1.a (responsable: en {privacyUrl}, por capas, como el resto de este fichero), 14.1.c (fin y base: 6.1.f), 14.1.d (categorías: nombre, número, dirección), 14.2.a (plazo), 14.2.b (el interés legítimo), 14.2.c y e (derechos y reclamación, en {privacyUrl}), 14.2.f (fuente pública) y 14.3.b («a más tardar en el momento de la primera comunicación»). Leído en el BOE (DOUE-L-2016-80807) el 2026-11-18. 0111 § 3 (el código: un solo uso, 30 días, ligado a un canal; el contacto no se guarda). «La copia de este correo… la borramos»: F3 y C6 del documento del proyecto — Gmail guarda en «Enviados» lo que sale por su SMTP (a comprobar por el propietario); si el propietario no va a borrarla, esta frase cambia a lo que sí haga. «No volveremos a escribirte»: el propietario registra un `fail` con el motivo y no envía otro código a esa dirección por esa solicitud. Nada identifica la cuenta que pidió la insignia: solo lo que el registro ya publica. Correo de servicio, no comercial: LSSI art. 21 no aplica. -->

---

## S. El código de la insignia, por carta (fase 3; la escribe y la envía el propietario)

**Cuándo**: el registro no publica correo. El propietario registra el canal `post`, la consola le
muestra el código **una sola vez** (PLAN fase 3, paso 3), y él imprime y envía esta carta a la
dirección profesional del registro. **El remite del sobre lo decide el propietario fuera del
repositorio**; aquí no se escribe ninguna dirección.

**Membrete**: `NutrIA — {name} — {email}` (de `legalIdentity.ts`, rellenado a mano al imprimir).

> **Para {registerName}**
>
> Te escribimos desde NutrIA, una aplicación de planes de comidas. Una cuenta de NutrIA ha
> pedido nuestra insignia de dietista-nutricionista colegiada/o con tu nombre y tu número de
> colegiado, {number}, de {register}.
>
> **Si has sido tú**, entra en NutrIA, ve a tu consulta e introduce este código antes del
> {expires}:
>
> **{code}**
>
> **Si no has sido tú**, no hagas nada con el código y escríbenos a {email}: alguien ha usado tu
> nombre y tu número. No daremos la insignia.
>
> Hemos sacado esta dirección del registro público de colegiados de {register}, que la publica
> para que cualquiera pueda comprobar una colegiación. La usamos solo para enviarte este código,
> para comprobar que quien pide la insignia eres tú, por nuestro interés legítimo y el de quienes
> usan NutrIA: que nadie se haga pasar por dietista-nutricionista. No la guardamos en NutrIA; lo
> que guardamos es el registro consultado, la fecha, el número, el resultado y que el código fue
> por carta. Quién es el responsable, tus derechos y cómo reclamar ante la Agencia Española de
> Protección de Datos: {privacyUrl}.
>
> {name}, NutrIA

<!-- Fuente: las mismas que § R. 30 días de validez porque el correo postal es lento (0111 § 3). El propietario no se queda copia de la carta con la dirección; si apunta la dirección para escribir el sobre, la nota se destruye al enviarla (F3). {privacyUrl} va escrita entera (la carta no tiene enlaces). -->

---

## T. El código de la insignia, por teléfono: el guion del propietario (fase 3)

**Cuándo**: no hay correo en el registro, y el correo postal no llega o el registro solo publica
un teléfono. Es el último canal (PRD 025, scope 6). **Lo lee el
propietario; no es una plantilla.**

1. Llama **solo** al teléfono que publica el registro de {register}. Nunca a uno que te haya dado
   quien pidió la insignia.
2. «Hola, llamo de NutrIA, una aplicación de planes de comidas. ¿Hablo con {registerName}?» Si
   no es esa persona, pregunta cuándo puedes encontrarla, **sin decir el motivo** a nadie más, y
   cuelga. No dejes el código en un contestador ni a otra persona.
3. A {registerName}: «Una cuenta de NutrIA ha pedido nuestra insignia de dietista-nutricionista
   colegiada/o con tu nombre y tu número. ¿La has pedido tú?»
   - **Sí**: «Te leo un código para que lo introduzcas en tu consulta de NutrIA antes del
     {expires}.» Léelo dos veces. No preguntes nada más.
   - **No**: «Entonces alguien ha usado tu nombre y tu número. No daremos la insignia.» No leas el
     código. Al colgar, registra un `fail` con el motivo «la persona del registro dice que no la
     ha pedido».
4. En los dos casos: «Tu teléfono lo hemos sacado del registro público de tu colegio y no lo
   guardamos. Guardamos solo el registro consultado, la fecha, el resultado y que la
   comprobación fue por teléfono. Todo lo demás, y tus derechos, en nuestra política de
   privacidad: nutria, barra, privacidad.» (Di la dirección real de la web).
5. Después: **borra la llamada del registro de llamadas del teléfono** con el que llamaste, y no
   apuntes el número en ningún sitio.

<!-- Fuente: RGPD art. 14 (como § R; de palabra, por capas, remitiendo a la política) y 5.1.c y e; F2 y F3 del documento del proyecto; legal § 6.0.1, opción 3 («a phone number the register lists — not one the applicant gives»). El código no se deja a terceros: si lo recibe otra persona, ya no prueba que la cuenta sea de {registerName}. -->

---

## U. La comprobación anual

### U.1 Al propietario: lo que vence (fase 3, el barrido diario, solo con el interruptor encendido)

**Plantilla**: `OwnerAlert.ts`, tipo nuevo `badges-due`. Solo en español, como el resto de
avisos al propietario. **Elección C8**: lleva números y un enlace, ninguna dirección.

| Campo | es-ES |
| --- | --- |
| `subject` | `NutrIA: {count} insignias por volver a comprobar` |
| `body` | `Hoy vencen o están vencidas {count} insignias: {soon} caducan en los próximos 7 días si no las compruebas. Están en la consola, en Profesionales.` |
| `link` | `{adminUrl}/profesionales` |

<!-- Fuente: PRD 025 scope 6 y criterio 4 («the daily cron reminds the owner»); 0071 y la nota del 2026-09-29 (los avisos al propietario no llevan direcciones: ../2026-09-29-mail-to-the-owner.md); RGPD art. 5.1.c. El PLAN (fase 3, paso 4) dice «counts and addresses of practitioners only»: propongo quitar también las direcciones (C8), porque la consola ya las tiene. -->

### U.2 Al profesional: su insignia vence (elección C5 — **no está en la fase 3**)

**Cuándo**: el día en que vence (`due_at`), una vez. **Plantilla nueva**:
`ProfessionalBadgeDue.ts`.

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `Toca comprobar tu insignia de NutrIA` | `Your NutrIA badge is due for its check` |
| `intro` | `Hace un año que comprobamos tu colegiación. Vamos a volver a mirar el registro de {register}.` | `It is a year since we checked your registration. We are going to look at {register}'s register again.` |
| `what` | `No tienes que hacer nada, salvo si te llega un código nuevo: entonces introdúcelo en tu consulta. Si el {lapseDate} no lo hemos completado, tu insignia caducará, aunque el retraso sea nuestro, y desde ese día verás de cada cliente solo los planes que le haces. Podrás volver a pedirla.` | `You need do nothing unless a new code reaches you: then enter it in your practice. If we have not completed it by {lapseDate}, your badge will lapse, even if the delay is ours, and from that day you will see of each client only the plans you make for them. You will be able to apply again.` |

<!-- Fuente: 0111 § 2 (vence a los doce meses, caduca 30 días después); F5 del documento del proyecto; P2B art. 4.1 (avisar de una restricción antes de que surta efecto, cuando se puede). -->

---

## V. La insignia ha caducado: declaración de motivos (fase 3, el barrido diario)

**Cuándo**: una vez, cuando el barrido escribe la fila `lapsed`. **Plantilla nueva**:
`ProfessionalBadgeLapsed.ts`.

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `Tu insignia de NutrIA ha caducado` | `Your NutrIA badge has lapsed` |
| `what` | `Desde hoy no tienes la insignia «Dietista-nutricionista colegiada/o». Tu consulta sigue abierta, y desde tu siguiente petición ves de cada cliente lo que el § 3 del acuerdo del profesional describe «sin la insignia». Lo demás que cambia está en su § 4. Las palabras de tu perfil que solo permite la insignia ya no se muestran, y tu perfil vuelve a revisión.` | `From today you no longer hold the "Registered dietitian-nutritionist" badge. Your practice stays open, and from your next request you see of each client what section 3 of the professional's agreement describes "without the badge". The rest of what changes is in its section 4. The words in your profile that only the badge allows are no longer shown, and your profile goes back for review.` |
| `why` | `Por qué: la comprobación anual vencía el {dueDate} y, 30 días después, no la habíamos completado. {detail} Es lo que dice el § 4 del acuerdo del profesional que aceptaste. Lo hemos decidido nosotros, sin ninguna notificación de terceros.` | `Why: the yearly check was due on {dueDate} and, 30 days later, we had not completed it. {detail} That is what section 4 of the professional's agreement you accepted says. We decided it ourselves, with no third-party notice.` |
| `detail` (una de tres) | `No conseguimos confirmar tu colegiación en el registro.` · `Te enviamos un código y no llegó a introducirse.` · `El retraso ha sido nuestro: no llegamos a hacerla a tiempo.` | `We could not confirm your registration on the register.` · `We sent you a code and it was not entered.` · `The delay was ours: we did not get to it in time.` |
| `redress` | `Puedes volver a pedir la insignia desde tu consulta cuando quieras. Si crees que es un error, responde a este correo: lo revisa una persona y te contesta, y si lo deshacemos recuperas la insignia como estaba. También puedes acudir a los tribunales.` | `You can apply for the badge again from your practice whenever you like. If you think this is a mistake, reply to this email: a person reviews it and answers you, and if we reverse it you get the badge back as it was. You can also go to the courts.` |

<!-- Fuente: DSA art. 17.3: a) qué decisión y su alcance; b) hechos, y si fue por notificación o por propia iniciativa; c) medios automatizados — la caducidad la aplica el barrido por fecha, pero la decisión de no haber comprobado es humana, y «sin ninguna notificación» lo dice; e) fundamento contractual (§ 4 del acuerdo); f) vías de recurso: reclamación interna (por correo; NutrIA es micro y el art. 20 no le obliga, art. 19.1) y judicial. P2B art. 4.1, 4.3 y 4.5 (motivación en soporte duradero; aclarar los hechos; reincorporar). El correo no dice que haya terminado ningún enlace, ni cuántos: lo diría aunque el profesional no tuviera ningún cliente con algo anotado, y daría el motivo que al cliente se le promete que no se da (05 § F.2, § G.3; F4). La regla general está en el § 4 del acuerdo, que el profesional ya aceptó. -->

---

## W. La insignia no se da o se retira: declaración de motivos (fase 3)

**Cuándo**: el propietario escribe una fila `fail` o `withdrawn` con su motivo en la consola.
**Plantilla nueva**: `ProfessionalBadgeRemoved.ts`. Si la persona nunca tuvo la insignia
(`fail` tras `applied`), el correo dice «no te damos»; si la tenía (`withdrawn`), «te retiramos».

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `Sobre tu insignia de NutrIA` | `About your NutrIA badge` |
| `what` (`fail`) | `No te damos la insignia «Dietista-nutricionista colegiada/o». Tu consulta sigue abierta como hasta ahora.` | `We are not giving you the "Registered dietitian-nutritionist" badge. Your practice stays open as before.` |
| `what` (`withdrawn`) | `Te retiramos la insignia «Dietista-nutricionista colegiada/o» desde hoy. Tu consulta sigue abierta, y desde tu siguiente petición ves de cada cliente lo que el § 3 del acuerdo del profesional describe «sin la insignia». Lo demás que cambia está en su § 4. Las palabras de tu perfil que solo permite la insignia ya no se muestran.` | `We are removing the "Registered dietitian-nutritionist" badge from today. Your practice stays open, and from your next request you see of each client what section 3 of the professional's agreement describes "without the badge". The rest of what changes is in its section 4. The words in your profile that only the badge allows are no longer shown.` |
| `why` | `Por qué: {reason} Es lo que dice el § 4 del acuerdo del profesional que aceptaste. {source}` | `Why: {reason} That is what section 4 of the professional's agreement you accepted says. {source}` |
| `reason` (las que el propietario elige; puede añadir los hechos) | `El registro de {register} no te muestra como colegiada/o habilitada/o con el número {number}, consultado el {checkedOn}.` · `La persona que figura en el registro con ese número nos ha dicho que no ha pedido la insignia.` · `El código caducó sin introducirse.` · `{facts}` | `{register}'s register does not show you as registered and entitled to practise under number {number}, as checked on {checkedOn}.` · `The person listed on the register under that number has told us they did not apply for the badge.` · `The code expired without being entered.` · `{facts}` |
| `source` (una de dos) | `Lo hemos decidido nosotros, por nuestra comprobación.` · `Lo hemos revisado tras un aviso que nos llegó.` | `We decided it ourselves, from our own check.` · `We looked into it after a notice we received.` |
| `redress` | igual que § V, con «pedir la insignia de nuevo» | the same as § V |

<!-- Fuente: DSA art. 17.3 a), b) (notificación o iniciativa propia; la identidad de quien notifica solo si es estrictamente necesario: aquí nunca — si la persona del registro dijo que no, el correo lo dice sin nombrarla, y el solicitante ya sabe a quién usó), e) y f); P2B art. 4.1 y 4.5; 0111 § 2. -->

---

## W bis. Suspender la cuenta como profesional, levantar la suspensión y cerrar la consulta (fase 6; decidido por el propietario el 2026-11-18)

**El propietario tiene tres actos sobre una cuenta que practica**, además de ocultar un perfil (§ X)
y retirar una insignia (§ W), que son inmediatos:
- **suspender**, inmediato: mientras dure, la cuenta no ve los datos de ningún cliente, no invita a
  nadie y no puede abrir ni reabrir una consulta;
- **levantar** la suspensión;
- **cerrar definitivamente**, con **30 días de aviso**, salvo obligación legal o incumplimiento
  reiterado.

**Plantillas nuevas**: `ProfessionalSuspended.ts`, `ProfessionalSuspensionLifted.ts`,
`ProfessionalClosing.ts`. Sin palabra de salud y sin nombre de ningún cliente.

### W bis.1 Suspensión

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `Hemos suspendido tu cuenta como profesional en NutrIA` | `We have suspended your account as a professional on NutrIA` |
| `what` | `Desde hoy tu cuenta está suspendida como profesional: no ves los datos de ningún cliente, no puedes invitar a nadie y no puedes abrir una consulta hasta que levantemos la suspensión. Tu cuenta personal de NutrIA sigue como estaba.` | `From today your account is suspended as a professional: you see no client's data, you cannot invite anyone and you cannot open a practice until we lift the suspension. Your personal NutrIA account carries on as it was.` |
| `why` | `Por qué: {reason} Es lo que dice el § 13 del acuerdo del profesional que aceptaste{clause}. {source}` | `Why: {reason} That is what section 13 of the professional's agreement you accepted says{clause}. {source}` |
| `reason` | `{facts}` (el propietario escribe los hechos: qué, cuándo, dónde) | `{facts}` |
| `clause` | `` · `, en relación con su § {n}` | `` · `, read with its section {n}` |
| `source` | `Lo hemos decidido nosotros, por nuestra propia revisión.` · `Lo hemos revisado tras un aviso que nos llegó.` · `Nos lo exige {authority}.` | `We decided it ourselves, from our own review.` · `We looked into it after a notice we received.` · `{authority} requires it of us.` |
| `redress` | `Para aclarar los hechos o pedir que lo revisemos, responde a este correo: lo revisa una persona y te contesta. Si levantamos la suspensión, te lo diremos y podrás volver a abrir tu consulta. También puedes acudir a los tribunales.` | `To clarify the facts or ask us to look again, reply to this email: a person reviews it and answers you. If we lift the suspension, we will tell you and you will be able to open your practice again. You can also go to the courts.` |

### W bis.2 Suspensión levantada

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `Hemos levantado la suspensión de tu cuenta como profesional` | `We have lifted the suspension of your account as a professional` |
| `body` | `Desde hoy puedes volver a abrir tu consulta en NutrIA. {why}` | `From today you can open your practice on NutrIA again. {why}` |
| `why` | `` · `Lo hemos revisado y {facts}.` | `` · `We have looked into it and {facts}.` |

### W bis.3 Cierre definitivo, con 30 días de aviso

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `Vamos a cerrar tu consulta en NutrIA el {closeDate}` | `We are going to close your NutrIA practice on {closeDate}` |
| `what` | `El {closeDate} cerraremos definitivamente tu consulta: perderás el acceso a tus clientes y tus invitaciones pendientes se anularán. Hasta esa fecha sigue como está{suspendedSuffix}. Tu cuenta personal de NutrIA no cambia.` | `On {closeDate} we will close your practice for good: you will lose access to your clients and your pending invitations will be cancelled. Until then it stays as it is{suspendedSuffix}. Your personal NutrIA account does not change.` |
| `suspendedSuffix` | `` · `, es decir, suspendida` | `` · `, that is, suspended` |
| `why` | igual que W bis.1 | the same as W bis.1 |
| `redress` | `Hasta el {closeDate} puedes aclarar los hechos o pedirnos que lo revisemos respondiendo a este correo: lo revisa una persona y te contesta. También puedes acudir a los tribunales.` | `Until {closeDate} you can clarify the facts or ask us to look again by replying to this email: a person reviews it and answers you. You can also go to the courts.` |
| `immediate` (sustituye a `subject` y a la primera frase de `what` cuando no hay plazo) | `Hemos cerrado tu consulta en NutrIA` · `Desde hoy hemos cerrado definitivamente tu consulta, sin el plazo de 30 días, porque {exception}: …` con `{exception}` = `la ley nos obliga a hacerlo ({law})` o `has incumplido el acuerdo de forma repetida: {facts}` | `We have closed your NutrIA practice` · `From today we have closed your practice for good, without the 30-day period, because {exception}: …` |

### W bis.4 El cierre se anula, antes o después de su fecha (**palabras nuevas, sin aprobar**, 2026-11-19)

**Cuándo**: el propietario levanta en la consola un cierre que había anunciado. El mismo acto,
`lifted`, quita también una suspensión si la había
(`packages/core/src/repositories/Professional/PracticeRestrictionRepository.ts`:
`restrictionFrom`). **Plantilla nueva**: `ProfessionalCloseWithdrawn.ts`. Dos variantes, según
haya llegado o no `{closeDate}`. Sin palabra de salud y sin el nombre de ningún cliente.

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` (antes de la fecha) | `No vamos a cerrar tu consulta en NutrIA` | `We are not going to close your NutrIA practice` |
| `body` (antes de la fecha) | `Hemos anulado el cierre de tu consulta que te anunciamos para el {closeDate}: no se va a producir. Tu consulta sigue abierta{liftedSuffix}. {why}` | `We have cancelled the close of your practice we announced for {closeDate}: it will not happen. Your practice stays open{liftedSuffix}. {why}` |
| `subject` (después de la fecha) | `Puedes volver a abrir tu consulta en NutrIA` | `You can open your NutrIA practice again` |
| `body` (después de la fecha) | `Hemos revocado el cierre de tu consulta del {closeDate}. Desde hoy puedes volver a abrirla en NutrIA; al hacerlo te pediremos aceptar de nuevo el acuerdo del profesional. Tu perfil sigue ahí. Si tenías la insignia, se retiró con el cierre: puedes volver a pedirla desde tu consulta y, mientras tanto, las palabras de tu perfil que solo permite la insignia no se muestran y, si las lleva, tu perfil ha vuelto a revisión. Los enlaces con tus clientes terminaron con el cierre y no vuelven solos: para retomarlos, invita de nuevo a cada persona, que verá otra vez la lista y decidirá. {why}` | `We have reversed the close of your practice of {closeDate}. From today you can open it again on NutrIA; when you do, we will ask you to accept the professional's agreement again. Your profile is still there. If you held the badge, it was withdrawn with the close: you can apply for it again from your practice and, until then, the words in your profile that only the badge allows are not shown and, if it carries any, your profile has gone back for review. The links with your clients ended with the close and do not come back by themselves: to pick them up again, invite each person again, and they will see the list again and decide. {why}` |
| `liftedSuffix` | `` · `, y también hemos levantado la suspensión` | `` · `, and we have also lifted the suspension` |
| `why` | `` · `Lo hemos revisado y {facts}.` | `` · `We have looked into it and {facts}.` |

<!-- Fuente: Reglamento (UE) 2019/1150 art. 4.3 («cuando la restricción, suspensión o terminación sea revocada… reincorporará sin demora indebida al usuario profesional, incluso en lo que respecta al acceso a los datos… generados por su uso… antes») — leído en el DOUE L 186, p. 71; y **art. 1.5** («se entenderá sin perjuicio del Derecho de la Unión, en particular… la protección de datos»), leído el 2026-11-19. Por eso los enlaces no vuelven: cada uno descansaba en el consentimiento de un cliente a ese enlace (RGPD art. 9.2.a), y el cierre lo terminó. Reabrir el flujo de datos sin que el cliente vuelva a decidir no sería «reincorporar» al profesional sino comunicar los datos de un tercero sin base. Lo que sí vuelve sin demora es lo que es del propio profesional: el perfil y las comprobaciones de la insignia, que son de la **cuenta** y no de la fila `professionals` que borra el cierre (`packages/database/src/schemas/professional.schema.ts`, «Owned by the practitioner's account»), y la posibilidad de abrir la consulta (`barsOpening` deja de impedirlo). «Te pediremos aceptar de nuevo el acuerdo»: la versión aceptada vive en la fila `professionals`, que el cierre borra, así que la consulta reabierta la pide otra vez. **[abogado]**: que P2B art. 4.3 cede aquí ante el RGPD es mi lectura (M18). La insignia no vuelve: un cierre ejecutado escribe siempre una comprobación `withdrawn` en la misma transacción si había insignia (`ProfessionalRepository.close`, `packages/core/src/repositories/Professional/ProfessionalRepository.ts:133-151`: bloqueo de la insignia → fin de los enlaces → `withdrawHeld` → `requeueIf` del perfil si lleva palabras de la insignia, `ProfessionalController.ts:371` → borrado de la fila), y deshacer el cierre no la restaura; se pide de nuevo (acuerdo 2.0.0 § 4). El perfil, de la cuenta, se queda, con lo que la insignia perdida retiene (0111 § 7). Acuerdo 2.0.0 § 13 («si deshacemos…»). -->

<!-- Fuente: decisión del propietario del 2026-11-18 (suspensión real desde la consola; cierre definitivo con motivos y 30 días; ocultar y retirar, inmediatos); acuerdo 2.0.0 §§ 11 y 13; Reglamento (UE) 2019/1150 art. 4.1 (motivación de una suspensión antes o al surtir efecto, en soporte duradero), 4.2 (terminación: 30 días antes, con declaración de motivos), 4.3 (aclarar los hechos; reincorporar sin demora si se revoca), 4.4 (excepciones al plazo, con motivos sin demora) y 4.5 (hechos concretos, notificaciones de terceros, motivo del art. 3.1.c) — DOUE L 186, pp. 70-71; DSA art. 17.1.c-d y 17.3 a)-f). «Tu cuenta personal sigue como estaba»: la suspensión alcanza la consulta, no el uso de NutrIA como cliente de sí mismo. El aviso de 30 días lo da el propietario; el código no lo impone (go-live-checklist § 1 bis). -->

---

## X. Ocultar un perfil tras la primera revisión: declaración de motivos (fase 6)

**Cuándo**: el propietario oculta un perfil desde la cola, con un motivo (`hidden_reason`). El
esquema tiene un solo acto, ocultar, y ninguno distinto de «rechazar» (hallazgo F6).
**Plantilla nueva**: `ProfessionalProfileHidden.ts`.

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `Hemos ocultado tu perfil de NutrIA` | `We have hidden your NutrIA profile` |
| `what` | `Hemos ocultado tu perfil. Hoy ningún perfil se muestra a nadie fuera de tu consulta, así que en la práctica no cambia nada; pero mientras siga oculto no aparecerá en ningún sitio donde NutrIA muestre perfiles. Tu consulta y tus clientes siguen como estaban.` | `We have hidden your profile. Today no profile is shown to anyone outside your practice, so in practice nothing changes; but while it stays hidden it will not appear anywhere NutrIA shows profiles. Your practice and your clients carry on as they were.` |
| `why` | `Por qué: {reason} Es lo que dicen los §§ 2 y 5 del acuerdo del profesional que aceptaste. Lo ha visto una persona, no un programa, en la revisión que hacemos de cada perfil{noticeSuffix}.` | `Why: {reason} That is what sections 2 and 5 of the professional's agreement you accepted say. A person saw it, not a program, in the review we make of every profile{noticeSuffix}.` |
| `reason` (una o varias; el propietario añade los hechos) | `Usa una palabra que el acuerdo no permite sin la insignia: «{word}».` · `Ofrece un servicio para una enfermedad.` · `Promete resultados.` · `Se presenta con un título que NutrIA no comprueba: «{word}».` · `Es publicidad que no tiene que ver con tus servicios.` · `{facts}` | `It uses a word the agreement does not allow without the badge: "{word}".` · `It offers a service for a disease.` · `It promises results.` · `It presents a title NutrIA does not check: "{word}".` · `It is advertising unrelated to your services.` · `{facts}` |
| `noticeSuffix` | `` (vacío) · `, después de un aviso que nos llegó` | `` (empty) · `, after a notice we received` |
| `redress` | `Edita tu perfil y volverá a la revisión: si ya no tiene lo que te decimos, dejará de estar oculto. Si crees que es un error, responde a este correo: lo revisa una persona y te contesta. También puedes acudir a los tribunales.` | `Edit your profile and it goes back for review: if it no longer has what we mention, it will stop being hidden. If you think this is a mistake, reply to this email: a person reviews it and answers you. You can also go to the courts.` |

<!-- Fuente: DSA art. 17.1.a (restricción de la visibilidad) y 17.3 a)-f) — c): «lo ha visto una persona» porque las palabras que el código rechaza nunca llegan a guardarse, así que lo oculto en la revisión lo decidió el propietario; e): §§ 2 y 5 del acuerdo; f): reclamación interna por correo (art. 19.1: el art. 20 no obliga a una micro) y tribunales. P2B art. 4.1. PRD 025 scope 11 y criterio 18 (no condiciona nada; un cambio vuelve a la cola). «No aparecerá en ningún sitio donde NutrIA muestre perfiles»: describe lo que guarda `hidden_at` y lo que leerá el directorio (0111, Consecuencias: «Project 4 reads professional_profiles' first-look state to decide appearance»); hoy no existe ese sitio, y el texto lo dice. -->

---

## Y. La regla de la enfermedad: los avisos (fase 5)

**Al profesional: ninguno.** Ni correo, ni empuje, ni una etiqueta distinta (hallazgo F4):
- Una aceptación rechazada no le llega: para él, la invitación sigue sin responder hasta que caduca.
- Un enlace terminado por la regla se le muestra **igual** que uno que termina el cliente. Si
  `care_link_ended_by` gana un valor nuevo (hoy `professional`, `client`, `lapse`, `account`:
  `packages/database/src/schemas/_enums.ts:97`), las vistas del profesional lo presentan como `client`.
- Hoy no hay correo de «enlace terminado» a nadie (no existe esa plantilla). Si un día se crea,
  sale en **todo** fin de enlace y con el mismo texto, nunca solo en este.

**Al cliente**: en pantalla, lo de [`05`](./05-consentimientos-cliente.md) § G. Por correo, solo
cuando el enlace lo termina el barrido diario (la persona no está mirando), y **sin ninguna
palabra de salud**. **Plantilla nueva**: `CareLinkEndedByRule.ts`.

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `Tu enlace con {professional} en NutrIA ha terminado` | `Your link with {professional} on NutrIA has ended` |
| `body` | `Tu enlace con {professional} ha terminado hoy. Tu plan, tus objetivos y tu historial se quedan contigo. Entra en NutrIA para ver por qué: te lo explicamos en tu perfil.` | `Your link with {professional} ended today. Your plan, your targets and your history stay with you. Sign in to NutrIA to see why: we explain it on your profile.` |
| `button` | `Abrir mi perfil` | `Open my profile` |

<!-- Fuente: 0111 § 8; PRD 025 scope 10 y criterio 22; RGPD arts. 5.1.f y 32 (un buzón y una pantalla de bloqueo no llevan salud: criterio de este fichero desde CareInvitation.ts, 0059); art. 13.2.f y 22.3 (el porqué y la revisión humana están en la pantalla, 05 § G.3). -->

---

## Z. El aviso del cambio, a cada cuenta (fase 10, antes del interruptor)

**Cuándo**: a cada cuenta, una vez, **después** de publicar los textos de §§ 4 y 5 del documento
del proyecto y **antes** de encender el interruptor `professional`, como pronto al día siguiente
(PRD 025, scope 13 y criterio 23). A los profesionales que ya existen, además, el acuerdo 2.0.0
con **15 días** de antelación (P2B art. 3.2): hoy solo existe la cuenta del propietario, así que
en la práctica no hay que esperar. `{date}` = el día en que el propietario piensa encender el
interruptor: si se retrasa, no se reenvía, pero nunca se adelanta.

| Campo | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `Cambian la política de privacidad y las condiciones de NutrIA` | `NutrIA's privacy policy and terms are changing` |
| `intro` | `A partir del {date}, cualquier persona mayor de edad podrá abrir una consulta en NutrIA y hacer el plan de comidas de quien la invite a ello. Si no trabajas con ningún profesional, para ti no cambia nada.` | `From {date}, any adult will be able to open a practice on NutrIA and make the meal plan of whoever invites them to. If you do not work with a professional, nothing changes for you.` |
| `what` | `Solo quien lleve nuestra insignia «Dietista-nutricionista colegiada/o» es alguien a quien hemos comprobado en el registro de su colegio. Un profesional sin ella verá de ti los planes que te haga y en qué punto están, nunca tu peso, tus objetivos, tu salud ni tus alergias, y antes de aceptar su invitación verás exactamente qué verá. Si tienes anotada una condición de salud o una medicación, solo podrás vincularte con un profesional con la insignia. Y estar vinculado a un profesional no da Premium.` | `Only someone with our "Registered dietitian-nutritionist" badge is a person we have checked on their college's register. A professional without it will see of you the plans they make for you and where they stand, never your weight, your targets, your health or your allergies, and before you accept their invitation you will see exactly what they will see. If you have a health condition or a medication on record, you will only be able to link with a professional who holds the badge. And being linked to a professional does not give you Premium.` |
| `choose` | `Los detalles están en {privacyUrl}, en «Tu profesional en NutrIA», y en {termsUrl}. Si tienes cualquier duda, escríbenos a {email}. Si no estás de acuerdo, puedes borrar tu cuenta desde tu perfil.` | `The details are at {privacyUrl}, under "Your professional on NutrIA", and at {termsUrl}. If you have any question, write to us at {email}. If you do not agree, you can delete your account from your profile.` |

<!-- Fuente: política vigente, «Cambios en esta política» («te avisaremos por correo antes de que se aplique»); condiciones vigentes, «Cambios en estas condiciones»; RGPD arts. 12.1, 13.1.e y 13.3; TRLGDCU art. 85.3; P2B art. 3.2 para los profesionales. Es «importante»: un destinatario nuevo (un profesional que NutrIA no ha comprobado) y un uso nuevo de los datos de salud (la regla). «Tu salud» es una palabra de salud genérica, sin nada de nadie: el criterio de este fichero es no revelar nada de la persona, y aquí no se revela nada (lo mismo hizo § Q). Correo de servicio, no comercial: LSSI art. 21 no aplica. Sin plantilla hoy: si se envía a mano, en copia oculta. {privacyUrl} = /privacidad#tu-profesional. -->
