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
> Propuesta: `TERMS_VERSION = '2.0.0'` en `packages/core/src/entities/Account` (o donde el
> backend prefiera), y dos columnas en `user` o una tabla `terms_acceptances`: versión y
> fecha, escritas al registrarse. Las condiciones actuales dicen que un cambio se avisa por
> correo antes de aplicarse (sección «Cambios en estas condiciones»): **este cambio debe
> avisarse por correo a las cuentas existentes** antes de publicarlo.
>
> **Stripe *Managed Payments***: si sigue activo, Link es el vendedor de la suscripción y
> sus términos rigen el cobro, el reembolso y parte del desistimiento. La sección C tiene
> dos variantes. **[abogado]**: [`analisis.md` § 10, punto 4](../analisis.md#10-confirmar-con-un-abogado).

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

**paragraphs**:
1. `NutrIA se puede usar gratis, con límites en los planes que puedes rehacer, los platos que puedes cambiar y los eventos de cada plan. La seguridad alimentaria —alergias, intolerancias y nutrientes— es la misma con Premium y sin él.`
2. `Premium amplía esos límites con una suscripción mensual o anual. Antes de pagar ves el precio total con impuestos y lo que se cobra en cada periodo. El pago lo gestiona Stripe.`

**list** (variante **sin** *Managed Payments*):
1. `La primera vez que contratas Premium tienes una prueba gratuita de {trialDays} días. Te pedimos la tarjeta al empezar y no cobramos nada hasta que acabe. Si la cancelas antes, no pagas nada.`
2. `Al terminar la prueba, y luego al final de cada periodo, la suscripción se renueva y se cobra sola hasta que la canceles.`
3. `Si tu plan es anual, te avisaremos por correo al menos 15 días antes de que se renueve.`
4. `Puedes cancelarla cuando quieras desde tu perfil, en «Gestionar la suscripción», igual de fácil que la contrataste. Conservas Premium hasta el final del periodo pagado y no se te vuelve a cobrar. No hay permanencia ni penalización.`
5. `Derecho de desistimiento: tienes 14 días naturales desde que contratas para desistir sin dar explicaciones. Te damos más: si ya se te ha cobrado, puedes desistir durante los 14 días siguientes al primer cobro. Hazlo con el botón «Desistir del contrato aquí» de tu perfil, con el formulario de abajo o escribiendo a {email}. Te devolvemos todo lo pagado en 14 días como máximo, por el mismo medio de pago, y la suscripción termina.`
6. `Si cambiamos el precio, te avisaremos con al menos 30 días de antelación y podrás cancelar antes de que se aplique.`

**list** (variante **con** *Managed Payments*): igual, pero la línea 5 empieza así y añade:
`… La compra la vende Link, el servicio de Stripe que te cobra y te envía el recibo, en nuestro nombre; puedes pedir el desistimiento o un reembolso también a Link, en link.com.`

<!-- Fuente: TRLGDCU art. 97.1.e («en el caso de… un contrato que incluya una suscripción, el precio incluirá el total de los costes por período de facturación»), 97.1.j (condiciones, plazo y procedimiento de desistimiento, y el formulario), 97.1.p (15 días antes del vencimiento, redacción de la Ley 10/2025), 102.1 (14 días), 104.a (para servicios, desde la celebración: damos más), 107 (devolución en 14 días por el mismo medio), 62.3 («en la misma forma en que lo celebró»); Directiva 2023/2673, art. 11 bis Directiva 2011/83 («desistir del contrato aquí»), aplicable desde el 19/6/2026 — España aún no lo ha incorporado al TRLGDCU (consolidado a 28/02/2026); se implanta de todas formas (analisis.md § 10, punto 7). {trialDays} es TRIAL_DAYS (hoy 7, 0056). El «30 días» del cambio de precio es propuesta, no exigencia legal: [abogado]. -->

### Nota para el código

- La línea 5 describe un botón que **no existe** (P1-8): `frontend` añade en la tarjeta de
  Premium, durante los 14 días, «Desistir del contrato aquí», que abre un paso con nombre,
  la suscripción que se desiste y el correo de confirmación, y un botón «Confirmar
  desistimiento»; `backend` cancela de inmediato, reembolsa en Stripe y envía el acuse
  ([`06-correos.md`](./06-correos.md) § C). Hasta que exista, publicar la línea 5 sin la
  mención al botón.
- El desistimiento **no** se renuncia en el checkout (no se recoge el consentimiento
  expreso del art. 103.a), así que la devolución es íntegra: bien así.

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
  - paragraphs: `NutrIA can be used for free, with limits on how many plans you can redo, dishes you can change and events per plan. Food safety — allergies, intolerances and nutrients — is the same with or without Premium.` / `Premium raises those limits with a monthly or yearly subscription. Before paying you see the total price including tax and what is charged each period. Payment is handled by Stripe.`
  - list: `The first time you take Premium you get a free trial of {trialDays} days. We ask for your card at the start and charge nothing until it ends. If you cancel before then, you pay nothing.` / `When the trial ends, and then at the end of each period, the subscription renews and is charged automatically until you cancel.` / `If your plan is yearly, we will email you at least 15 days before it renews.` / `You can cancel whenever you like from your profile, under "Manage subscription", as easily as you signed up. You keep Premium until the end of the paid period and are not charged again. There is no minimum term and no penalty.` / `Right of withdrawal: you have 14 calendar days from signing up to withdraw without giving a reason. We give you more: if you have already been charged, you can withdraw within 14 days of the first charge. Use the "Withdraw from contract here" button on your profile, the form below, or write to {email}. We refund everything you paid within 14 days at most, by the same payment method, and the subscription ends.` / `If we change the price, we will tell you at least 30 days in advance and you can cancel before it applies.`
  - with Managed Payments, append to the withdrawal line: `The purchase is sold by Link, the Stripe service that charges you and sends your receipt, on our behalf; you can also ask Link for withdrawal or a refund at link.com.`
- **E** "Withdrawal form": `Only fill in and send this form if you want to withdraw and prefer not to use the button on your profile.` / `To {name}, {address}, {email}:` / `I hereby give notice that I withdraw from my contract for a NutrIA Premium subscription.` / `Signed up on: ______. Name: ______. Account email: ______.` / `Signature (only if sent on paper): ______. Date: ______.`
- **F** "If you work with a dietitian": `A dietitian-nutritionist can invite you to follow your plan with them on NutrIA. If you accept, they can see and adjust your plan as the invitation and the privacy policy explain, and while the link lasts you get Premium's limits at no cost.` / `Your dietitian is an independent professional: their advice and their relationship with you are between the two of you. NutrIA is the tool and is not responsible for their clinical decisions, just as your dietitian is not responsible for how NutrIA works.` / `You can end the link whenever you like. When it ends, you keep your account, your history and your last published plan, on the free limits.`
- **G** "Liability", append: `If you use NutrIA with a dietitian, their advice is their responsibility as a professional; what NutrIA does — how it calculates, what it checks and what it shows you — is ours.`
