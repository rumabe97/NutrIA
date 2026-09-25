# Acuerdo del profesional (consulta)

> **No soy abogado.** Borrador para el producto; las fuentes van en comentarios.
>
> **Propósito**: lo que el dietista-nutricionista acepta antes de que se abra su consulta. **Audiencia**: `frontend` (diccionarios), `backend` (almacenamiento y versión), el propietario y el abogado. **Committed**: sí. **Mantenido por**: el agente `legal`; lo aprueban el propietario y el abogado.
>
> **Dónde va**: pantalla `/consulta`, mostrada **en lugar de** la consulta mientras
> `professionals.agreementVersion !== PROFESSIONAL_AGREEMENT_VERSION`. Diccionario:
> namespace nuevo `practiceAgreement` (`es-ES.ts` y `en-GB.ts`), con `title`, `intro`,
> `sections[]` (`heading`, `paragraphs[]`, `list[]`, como `privacy`/`terms`), `checkbox`,
> `accept`, `version`, `acceptedOn`. La misma pantalla incluye las condiciones del plan de
> consulta ([`04-condiciones-consulta.md`](./04-condiciones-consulta.md)) como segundo
> bloque plegable, y una sola casilla acepta ambos.
>
> **Almacenamiento**: `POST /care/practice/agreement { version }` escribe
> `agreementVersion` y `agreementAcceptedAt` en `professionals` (ver
> [`analisis.md` § 11](../analisis.md#11-lo-que-hay-que-construir-para-el-004-y-quién)).
> **Versión**: `PROFESSIONAL_AGREEMENT_VERSION = '1.0.0'`. Cualquier cambio de fondo en
> este texto o en el 04 la sube y vuelve a pedirse.
>
> **Marcadores**: `{name}` y `{email}` de `legalIdentity.ts` (el titular de NutrIA).

---

## Español

**title**: Antes de abrir tu consulta

**intro**:
- Vas a ver datos de salud de tus pacientes. Esto es lo que aceptas para poder hacerlo. Léelo: son pocas cosas y todas importan.
- NutrIA lo presta {name}, a quien puedes escribir en {email}.

### 1. Quién eres aquí

- Usas NutrIA como dietista-nutricionista titulado y, cuando tu comunidad lo exige, colegiado. El número de colegiado que nos diste es tuyo y está en vigor; si deja de estarlo, nos lo dices y dejas de usar la consulta.
- La cuenta es personal. Nadie más entra con ella, tampoco alguien de tu equipo.

<!-- Fuente: Ley 44/2003, art. 2.2.g (dietistas-nutricionistas como profesión sanitaria titulada) y art. 4 (ejercicio, colegiación cuando esté establecida); PRD 004, Decisión 1 (el propietario comprueba el número); 0059 (una cuenta, un profesional: «a shared or borrowed account» está prohibido en PRODUCT.md). -->

### 2. Qué verás y qué podrás hacer

Solo de los pacientes que acepten tu invitación, y mientras el enlace siga activo:
- **Verás** su nombre, sus objetivos diarios y cómo se calcularon, su plan y los anteriores, cuánto de cada quincena ha seguido, su peso a lo largo del tiempo y las respuestas de cada check-in. Sus condiciones de salud, su medicación y sus suplementos, **solo si tu paciente lo marca aparte**, y dejas de verlos en cuanto lo desmarca.
- **No verás** sus alergias ni intolerancias, su correo, sus comentarios escritos ni nada de otras personas.
- **Podrás** fijar sus objetivos diarios dentro de los mismos límites de seguridad que usa la calculadora, generar y cambiar su plan, revisarlo antes de que lo vea y publicarlo.
- Cada vez que miras o cambias algo, tu paciente lo ve en su perfil: quién, qué y cuándo.

<!-- Fuente: lo que el código devuelve — CareClientOverviewView (packages/core/src/controllers/Care/CareController.ts:193-200), rutas de apps/api/src/modules/care/controllers/CareClients.controller.ts; rastro care_access_log (0059). Art. 5.1.c RGPD (minimización) y art. 13.1.e (destinatarios): el paciente sabe que lo ves. -->

### 3. Secreto profesional

- Lo que veas aquí está bajo tu secreto profesional, igual que lo que te cuentan en consulta. No lo compartes con nadie ajeno a la asistencia de ese paciente, salvo en los casos en que la ley te obliga o te permite hacerlo.
- Si trabajas con otras personas, ninguna usa tu cuenta ni ve la consulta.

<!-- Fuente: Ley 44/2003, art. 5.1.c (respetar la intimidad); Código Deontológico CGCODN (22/12/2021), arts. 22 («reserva debida») y 29 (confidencialidad); RGPD art. 9.3 (el 9.2.h exige un profesional sujeto a secreto). -->

### 4. Quién responde de los datos

- **NutrIA** es responsable de los datos de la cuenta de tu paciente: los guarda, los protege, decide cuánto duran y atiende sus derechos sobre ellos (acceso, rectificación, borrado, portabilidad, oposición). Cuando tu paciente acepta tu invitación, NutrIA **te comunica** esos datos porque tu paciente lo pide y lo consiente.
- **Tú** eres responsable, por tu cuenta, de lo que hagas con lo que ves: de tu valoración, de lo que anotes fuera de NutrIA y de tu historia clínica. Lo haces para tu asistencia dietética, con tu propia base legal como profesional sanitario.
- NutrIA **no** trata datos por cuenta tuya: no es tu encargado del tratamiento. Si algún día NutrIA guardara algo que escribes para tu práctica —notas, una ficha, documentos— o te dejara exportar la ficha de un paciente, antes firmaríamos un contrato de encargo y te pediríamos aceptarlo.
- Si un paciente te pide ejercer un derecho sobre los datos que viven en NutrIA, le indicas que lo haga desde su perfil o escribiendo a {email}; si nos lo pide a nosotros sobre lo que tú guardas fuera, se lo diremos. Cada uno informa a los pacientes de lo suyo; NutrIA ya les informa, en la invitación y en su política de privacidad, de que te comunica sus datos y de qué datos son.
- Si una autoridad o un tribunal considerara que decidimos juntos el tratamiento, este apartado es nuestro acuerdo de reparto de responsabilidades: NutrIA informa a los pacientes y atiende sus derechos sobre lo que vive en NutrIA, y es el punto de contacto; tú, sobre lo que guardas fuera. Sus aspectos esenciales están en la política de privacidad.

<!-- Fuente: RGPD art. 4.7-4.8 (responsable, encargado), 6.1.a y 9.2.a (comunicación consentida), 9.2.h y 9.3 (uso del profesional), 26.1-2 (reparto si hubiera corresponsabilidad; «se pondrán a disposición del interesado los aspectos esenciales»), 28 (encargo, que aquí no hay); CEPD Directrices 07/2020 v2.0, apdos. 55, 70, 71; LOPDGDD DA 17ª.1 c) y e). Análisis: docs/legal/analisis.md § 2. -->

### 5. NutrIA es una herramienta, no una segunda opinión

- NutrIA planifica comidas. No diagnostica, no trata y no deriva ninguna regla de una enfermedad, salvo una: la celiaquía excluye el gluten. La medicación no produce nada.
- Los platos y las recetas los propone un modelo de inteligencia artificial y los comprueba nuestro código: alergias e intolerancias declaradas, límites de calorías y de proteína. Pueden tener errores de cantidades o de pasos. La decisión clínica y la revisión del plan son tuyas.
- Los datos de salud de tu paciente nunca llegan al modelo, compartan o no contigo.
- NutrIA no es tu historia clínica. Lo que tu profesión te obliga a registrar y conservar, lo registras y conservas tú, fuera de NutrIA. Cuando el enlace termina, dejas de ver todo lo que había aquí.

<!-- Fuente: 0004, 0008 (celiaquía → gluten), ARCHITECTURE.md § Invariants («The boundary is mechanical»); Ley 41/2002 arts. 14.1, 15.1 y 17.1 (historia clínica, conservación mínima de cinco años) y 17.5 («Los profesionales sanitarios que desarrollen su actividad de manera individual son responsables de la gestión y de la custodia de la documentación asistencial que generen»); Código Deontológico CGCODN art. 21 (historia clínica escrita); Reglamento (UE) 2024/1689, art. 4 (alfabetización en IA, en la redacción del Reglamento 2026/1744). -->

### 6. A quién invitas

- Solo a personas que ya son tus pacientes y que saben, antes de recibir el correo, que las vas a invitar. Su dirección nos la das tú, y con ella solo enviamos la invitación.
- Nunca a menores de 18 años. Tampoco a pacientes que necesiten nutrición clínica que NutrIA no cubre: una enfermedad metabólica diagnosticada que requiera una pauta específica, el embarazo, la recuperación de un trastorno de la conducta alimentaria o la alimentación infantil. Para ellos, NutrIA no es la herramienta.
- Tu paciente decide: puede decir que no, aceptar sin compartir su salud, retirar esa parte o terminar el enlace cuando quiera. No le condiciones tu atención a que acepte.

<!-- Fuente: RGPD art. 5.1.b y 6 (el profesional necesita base para comunicar el correo: la relación asistencial y el conocimiento previo del paciente); LSSI art. 21 (evitar que la invitación sea una comunicación no solicitada); LOPDGDD art. 7 y condiciones de uso (18 años desde 2026-09-25); PRODUCT.md § Users, «Not a user (v1)»; RGPD art. 7.4 (consentimiento libre). -->

### 7. Qué pasa con los datos cuando algo termina

- **Termina un enlace** (lo terminas tú, tu paciente, o se pausa porque tu plan no está al día): dejas de ver sus datos en la siguiente petición. Los objetivos que fijaste se quedan en su cuenta y pasan a ser suyos. Un plan que tenías pendiente de revisar no se le muestra y no le cuesta nada. Tu nombre sigue en su registro de accesos, porque es su derecho saber quién miró.
- **Borras tu cuenta**: terminan todos tus enlaces y se borran tus invitaciones, tu concesión y tu suscripción. Tu nombre se queda en el registro de accesos de cada paciente que tuviste, sin tu cuenta.
- **Tu paciente borra su cuenta**: dejas de verlo; su registro se borra con ella.
- **Retiramos tu concesión** (por ejemplo, si tu número de colegiado deja de estar en vigor o incumples este acuerdo): pierdes el acceso a la consulta y tus invitaciones se anulan.
- Lo que hayas copiado fuera de NutrIA para tu historia clínica es tuyo y lo conservas según tu normativa.

<!-- Fuente: comportamiento del código — 0059 (revocar cierra en la siguiente petición), 0060 enmienda Fase 5 (plan pendiente ignorado sin coste), 0061 (lapso pausa, no borra), care.schema.ts:122 (professionalName conservado con professionalId a NULL), auth.config.ts:212-231 (borrado: Stripe primero, invitaciones por dirección), practice.endConfirmBody; RGPD art. 13.2.a (plazos) y 15 (el paciente tiene derecho a saber a quién se comunicaron sus datos). -->

### 8. Seguridad

- Protege tu acceso: una contraseña que no uses en otro sitio, o entra con Google. No dejes la sesión abierta en un ordenador compartido.
- No hagas capturas ni copias de la ficha salvo para tu historia clínica, y guárdalas con la misma protección que el resto de tu documentación clínica.
- Si crees que alguien ha entrado en tu cuenta o ha visto datos de un paciente que no debía, escríbenos a {email} en cuanto lo sepas, y en todo caso en 24 horas. Nosotros valoraremos si hay que avisar a la Agencia Española de Protección de Datos y a los pacientes; si la brecha es tuya, fuera de NutrIA, esa obligación es tuya.

<!-- Fuente: RGPD art. 32 (seguridad), 33 (notificación a la autoridad en 72 horas por cada responsable de su brecha) y 34 (comunicación al interesado); Ley 41/2002 art. 17.6 (medidas de seguridad en la documentación clínica). -->

### 9. Usos prohibidos

No puedes:
- intentar ver datos de alguien que no ha aceptado tu invitación, o saber si una dirección tiene cuenta en NutrIA;
- invitar direcciones que no sean de tus pacientes, ni usar la invitación para anunciar tus servicios;
- usar los datos de tus pacientes para algo que no sea su asistencia: ni publicidad, ni estudios, ni venderlos ni cederlos;
- compartir o prestar tu cuenta;
- extraer datos de forma automatizada o intentar saltarte los límites de tu plan o las medidas de seguridad.

Si haces alguna de estas cosas, podemos retirar tu concesión de inmediato.

<!-- Fuente: 0059 («An invitation reveals nothing»; «reach a client who has not accepted… or infer that one exists»); RGPD art. 5.1.b (limitación de la finalidad); LSSI art. 21; condiciones de uso § «Uso aceptable». -->

### 10. Cambios y duración

- Este acuerdo dura mientras tengas la concesión. Si lo cambiamos en algo importante, te lo diremos por correo y te pediremos aceptarlo de nuevo antes de volver a abrir la consulta; mientras tanto tus pacientes siguen con sus cuentas.
- Se rige por la ley española. Para las condiciones económicas del plan de consulta, ver abajo.

<!-- Fuente: Ley 7/1998, arts. 5 y 7 (incorporación y aceptación de las condiciones generales); Código Civil art. 1256 (no dejar el contrato al arbitrio de una parte: por eso se vuelve a aceptar). -->

**checkbox**: He leído y acepto el acuerdo del profesional y las condiciones del plan de consulta.

**accept**: Aceptar y abrir mi consulta

**version**: Versión {version}

**acceptedOn**: Aceptado el {date}, versión {version}.

---

## English

**title**: Before your practice opens

**intro**:
- You are about to see your clients' health data. This is what you agree to in order to do so. Please read it: it is short and all of it matters.
- NutrIA is provided by {name}, who you can write to at {email}.

### 1. Who you are here

- You use NutrIA as a qualified dietitian-nutritionist and, where your region requires it, a registered member of your professional college. The registration number you gave us is yours and current; if it stops being so, you tell us and stop using the practice.
- The account is personal. Nobody else signs in with it, including anyone on your team.

### 2. What you will see and what you can do

Only for clients who accept your invitation, and only while the link is active:
- **You will see** their name, their daily targets and how they were worked out, their plan and the earlier ones, how much of each fortnight they followed, their weight over time and their answers to each check-in. Their health conditions, medications and supplements **only if your client ticks that separately**, and you stop seeing them as soon as they untick it.
- **You will not see** their allergies or intolerances, their email address, their written comments or anything about anyone else.
- **You can** set their daily targets within the same safety bounds the calculator uses, generate and change their plan, review it before they see it and publish it.
- Every time you look at or change something, your client sees it on their profile: who, what and when.

### 3. Professional secrecy

- What you see here is covered by your professional secrecy, like anything a client tells you in a consultation. You do not share it with anyone outside that client's care, except where the law requires or allows you to.
- If you work with others, none of them uses your account or sees the practice.

### 4. Who is responsible for the data

- **NutrIA** is the controller of the data in your client's account: it stores it, protects it, decides how long it is kept and handles their rights over it (access, rectification, erasure, portability, objection). When your client accepts your invitation, NutrIA **discloses** that data to you because your client asks for it and consents.
- **You** are an independent controller of what you do with what you see: your assessment, anything you record outside NutrIA and your clinical record. You do so for your dietetic care, on your own legal basis as a health professional.
- NutrIA does **not** process data on your behalf: it is not your processor. If NutrIA ever stored something you write for your practice — notes, a record, documents — or let you export a client's file, we would first sign a processing agreement and ask you to accept it.
- If a client asks you to exercise a right over the data held in NutrIA, point them to their profile or to {email}; if they ask us about what you keep outside NutrIA, we will tell them. Each of us informs clients about our own part; NutrIA already tells them, in the invitation and in its privacy policy, that it discloses their data to you and which data.
- If an authority or a court considered that we decide the processing jointly, this section is our arrangement: NutrIA informs clients and handles their rights over what is held in NutrIA, and is the contact point; you do so for what you keep outside. Its essence is set out in the privacy policy.

### 5. NutrIA is a tool, not a second opinion

- NutrIA plans meals. It does not diagnose or treat, and it derives no rule from any condition except one: coeliac disease excludes gluten. Medication produces nothing.
- Dishes and recipes are proposed by an artificial-intelligence model and checked by our code: declared allergies and intolerances, calorie and protein bounds. They can contain mistakes in quantities or steps. The clinical decision and the review of the plan are yours.
- Your client's health data never reaches the model, whether or not they share it with you.
- NutrIA is not your clinical record. Whatever your profession requires you to record and keep, you record and keep outside NutrIA. When the link ends, you stop seeing everything that was here.

### 6. Who you invite

- Only people who are already your clients and who know, before the email arrives, that you are inviting them. You give us their address, and we only use it to send the invitation.
- Never anyone under 18. Nor clients who need clinical nutrition NutrIA does not cover: a diagnosed metabolic disease requiring a specific regimen, pregnancy, recovery from an eating disorder, or infant feeding. For them, NutrIA is not the tool.
- Your client decides: they can say no, accept without sharing their health, withdraw that part or end the link at any time. Do not make your care conditional on their accepting.

### 7. What happens to the data when something ends

- **A link ends** (you end it, your client does, or it is paused because your plan is not paid up): you stop seeing their data on the next request. The targets you set stay in their account and become theirs. A plan you had pending review is not shown to them and costs them nothing. Your name stays in their access record, because knowing who looked is their right.
- **You delete your account**: all your links end, and your invitations, your grant and your subscription are deleted. Your name stays in the access record of every client you had, without your account.
- **Your client deletes their account**: you stop seeing them; their record goes with it.
- **We revoke your grant** (for example, if your registration lapses or you breach this agreement): you lose access to the practice and your pending invitations are cancelled.
- Anything you copied outside NutrIA for your clinical record is yours and you keep it under your own rules.

### 8. Security

- Protect your access: a password you do not use anywhere else, or sign in with Google. Do not leave the session open on a shared computer.
- Do not take screenshots or copies of a client's page except for your clinical record, and keep them with the same protection as the rest of your clinical documentation.
- If you think someone has got into your account or seen a client's data they should not have, write to {email} as soon as you know, and in any case within 24 hours. We will assess whether the Spanish Data Protection Agency and the clients must be told; if the breach is yours, outside NutrIA, that duty is yours.

### 9. Prohibited uses

You may not:
- try to see the data of anyone who has not accepted your invitation, or find out whether an address has a NutrIA account;
- invite addresses that are not your clients', or use the invitation to advertise your services;
- use your clients' data for anything other than their care: no advertising, no studies, no selling or passing it on;
- share or lend your account;
- extract data automatically or try to get round your plan's limits or the security measures.

If you do any of these, we may revoke your grant immediately.

### 10. Changes and term

- This agreement lasts as long as you hold the grant. If we change anything important, we will tell you by email and ask you to accept again before the practice reopens; your clients keep their accounts in the meantime.
- It is governed by Spanish law. For the practice plan's commercial terms, see below.

**checkbox**: I have read and accept the professional's agreement and the practice plan terms.

**accept**: Accept and open my practice

**version**: Version {version}

**acceptedOn**: Accepted on {date}, version {version}.
