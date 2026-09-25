# Condiciones del plan de consulta (profesionales, B2B)

> **No soy abogado.** Borrador para el producto.
>
> **Propósito**: las condiciones del plan de consulta que contrata un profesional. **Audiencia**: `frontend` (diccionarios), `backend` (almacenamiento y versión), el propietario y el abogado. **Committed**: sí. **Mantenido por**: el agente `legal`; lo aprueban el propietario y el abogado.
>
> **Dónde va**: segundo bloque de la pantalla de aceptación de `/consulta`
> ([`01-acuerdo-profesional.md`](./01-acuerdo-profesional.md)), en el namespace
> `practiceAgreement.terms` (misma forma `sections[]`); una sola casilla acepta ambos y
> comparten `PROFESSIONAL_AGREEMENT_VERSION`. Además, dos claves cortas junto al botón de
> pago de `PracticePlanCard`:
>
> | Clave | es-ES | en-GB |
> | --- | --- | --- |
> | `practice.planTrial` (sustituye «Los primeros {days} días son gratis.») | `Los primeros {days} días son gratis. Al terminar, el plan se cobra cada mes hasta que lo canceles.` | `The first {days} days are free. After that, the plan is charged monthly until you cancel.` |
> | `practice.planTerms` (nueva, bajo el botón) | `Contratas como profesional, no como consumidor. Condiciones del plan de consulta.` (enlace) | `You are buying as a professional, not a consumer. Practice plan terms.` (link) |
>
> **Por qué B2B**: quien contrata es un profesional para su actividad; el TRLGDCU
> protege al consumidor, que es quien actúa «con un propósito ajeno a su actividad
> comercial, empresarial, oficio o profesión» (art. 3). Se aplican la Ley 7/1998 de
> condiciones generales (incorporación: arts. 5 y 7) y la LSSI (arts. 27 y 28), que
> también rigen entre empresarios.

---

## Español

### 1. Qué contratas
El acceso a la consulta de NutrIA para un número de pacientes activos que depende del plan (por ejemplo, 30 o 60). Cuentan como plaza los enlaces activos y las invitaciones que aún no han caducado. Al llegar al límite, puedes pasar a un plan mayor o terminar un enlace.

<!-- Fuente: 0061 (límite contado en la invitación: enlaces activos + invitaciones vivas); PRD 004, Decisión 6. -->

### 2. Precio y pago
El precio mensual de cada plan, con impuestos, se muestra antes de pagar. Se cobra por adelantado cada mes a través de Stripe, con la tarjeta que indiques. ⟦si Managed Payments⟧ La compra la vende Link, el servicio de Stripe, que emite la factura. Si necesitas una factura a nombre de tu actividad, indica tus datos fiscales en el pago.

<!-- Fuente: LSSI art. 27.1 (información previa: trámites, idioma); Ley 37/1992 del IVA y RD 1619/2012 (facturación) [gestor]; P2-6 (tax_id_collection). -->

### 3. Prueba
La primera vez tienes {days} días gratis. Te pedimos la tarjeta al empezar y no cobramos hasta que la prueba acaba; si cancelas antes, no pagas nada. La prueba es una por cuenta.

<!-- Fuente: 0061 y payments.md § 6b (PRACTICE_TRIAL_DAYS = 14, «once per account»). -->

### 4. Renovación y cancelación
El plan se renueva cada mes hasta que lo canceles desde «Gestionar el plan», en tu consulta. Conservas el acceso hasta el final del mes pagado. No hay permanencia. Puedes cambiar de plan desde el mismo sitio; el cambio y su prorrateo los calcula Stripe al momento.

<!-- Fuente: payments.md § 6b (portal de cliente, cambio entre precios); Ley 7/1998 art. 8 y Código Civil art. 1256. -->

### 5. Si el plan no está al día
Si un cobro falla, Stripe lo reintenta durante unos días y mantienes el acceso. Si el plan termina o deja de pagarse, **tus pacientes quedan en pausa**: dejas de ver sus datos, ellos conservan sus cuentas y vuelven a los límites gratuitos, y **no se borra nada**. Si vuelves a pagar, los enlaces se reanudan.

<!-- Fuente: 0056 (past_due sigue pagando), 0061 («A lapse pauses, never deletes»); criterio 13 del PRD 004. -->

### 6. Sin derecho de desistimiento de consumidor
Como contratas para tu actividad profesional, no se aplica el derecho de desistimiento de 14 días de los consumidores. Aun así, si cancelas durante la prueba no pagas nada.

<!-- Fuente: TRLGDCU arts. 3 y 102 (solo consumidores). [abogado]: un profesional autónomo que contrata para su actividad no es consumidor; confirmar. -->

### 7. Disponibilidad y cambios
Hacemos lo posible porque la consulta funcione siempre, pero puede haber interrupciones. Si cambiamos el precio te avisamos con al menos 30 días y puedes cancelar antes. Si algún día cerramos el servicio, avisaremos con tiempo y devolveremos la parte no disfrutada del mes.

### 8. Responsabilidad
Respondemos de lo que cause NutrIA por dolo o negligencia grave y de lo que la ley no permite excluir. No respondemos de tus decisiones clínicas ni de lo que hagas con los datos fuera de NutrIA, que son tuyos como profesional. Nuestra responsabilidad por lo demás se limita a lo que hayas pagado en los últimos doce meses.

<!-- Fuente: Código Civil arts. 1102 (el dolo no se excluye) y 1103; Ley 7/1998 art. 8 (nulidad de cláusulas contrarias a norma imperativa). El tope de 12 meses es habitual entre empresarios [abogado]. -->

### 9. Ley y tribunales
Se rigen por la ley española. Para cualquier conflicto, los juzgados y tribunales del domicilio del titular de NutrIA, salvo que la ley disponga otra cosa.

<!-- Fuente: Ley 1/2000 (LEC) art. 55 (sumisión expresa, válida entre empresarios; no en contratos de adhesión con consumidores, art. 54.2). -->

---

## English

### 1. What you are buying
Access to the NutrIA practice for a number of active clients that depends on the plan (for example, 30 or 60). Active links and invitations that have not yet expired both take a place. At the limit, you can move to a larger plan or end a link.

### 2. Price and payment
Each plan's monthly price, including tax, is shown before you pay. It is charged monthly in advance through Stripe, to the card you give. ⟦if Managed Payments⟧ The purchase is sold by Link, Stripe's service, which issues the invoice. If you need an invoice in your business's name, enter your tax details at checkout.

### 3. Trial
The first time, you get {days} days free. We ask for your card at the start and charge nothing until the trial ends; if you cancel before then, you pay nothing. One trial per account.

### 4. Renewal and cancellation
The plan renews every month until you cancel it from "Manage plan" in your practice. You keep access until the end of the paid month. There is no minimum term. You can change plan from the same place; Stripe works out the change and any proration immediately.

### 5. If the plan is not paid up
If a payment fails, Stripe retries it for a few days and you keep access. If the plan ends or stops being paid, **your clients are paused**: you stop seeing their data, they keep their accounts and return to the free limits, and **nothing is deleted**. If you pay again, the links resume.

### 6. No consumer right of withdrawal
Because you are buying for your professional activity, the 14-day consumer right of withdrawal does not apply. Even so, if you cancel during the trial you pay nothing.

### 7. Availability and changes
We do our best to keep the practice running at all times, but there may be interruptions. If we change the price we will tell you at least 30 days in advance and you can cancel before then. If we ever close the service, we will give notice and refund the unused part of the month.

### 8. Liability
We are liable for harm caused by NutrIA through wilful misconduct or gross negligence and for anything the law does not allow us to exclude. We are not liable for your clinical decisions or for what you do with data outside NutrIA, which are yours as a professional. Otherwise our liability is capped at what you paid in the last twelve months.

### 9. Law and courts
These terms are governed by Spanish law. Any dispute goes to the courts of the domicile of NutrIA's owner, unless the law provides otherwise.
