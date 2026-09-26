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
