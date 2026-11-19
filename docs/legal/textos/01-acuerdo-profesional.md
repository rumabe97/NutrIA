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
> [`analysis.md` § 11](../analysis.md#11-what-has-to-be-built-for-004-and-by-whom)).
> **Versión**: `PROFESSIONAL_AGREEMENT_VERSION = '1.1.0'`, en vigor
> (`core/entities/Professional`). Cualquier cambio de fondo en este texto o en el 04 la
> sube y vuelve a pedirse. **1.1.0** (2026-10-03, proyecto 011 fase 6): § 8, la viñeta
> ⟦dos-pasos-obligatoria⟧, en `practiceAgreement` de `es-ES.ts` y `en-GB.ts`. **1.0.0**:
> la primera.
>
> **Marcadores**: `{name}` y `{email}` de `legalIdentity.ts` (el titular de NutrIA).
>
> **2.0.0 — borrador, proyecto 025 (2026-11-18), pendiente de la aprobación del propietario.**
> Va justo debajo, antes del texto en vigor. Se publica en la fase 8 del plan, en el mismo cambio
> que sube `PROFESSIONAL_AGREEMENT_VERSION` a `2.0.0`, y no antes. Hasta entonces el texto servido
> es el **1.1.0**, que sigue más abajo tal cual. Lo que cambia y por qué está en
> [`../2026-11-18-anyone-can-open-a-practice.md`](../2026-11-18-anyone-can-open-a-practice.md)
> (mapa § 1, decisiones C1–C12 § 3). Los cambios más grandes:
> - dos niveles (con y sin la insignia), con lo que ve cada uno;
> - el secreto profesional legal para quien tiene la insignia y la confidencialidad por contrato
>   para quien no la tiene;
> - las palabras y el aviso fijo;
> - la insignia, su comprobación anual y su caducidad;
> - la primera revisión del perfil;
> - nunca un menor;
> - los motivos de suspensión y cierre, y los 15 días de aviso de un cambio (P2B arts. 3 y 4);
> - la consulta gratis con diez clientes.
>
> Las condiciones del plan de consulta ([`04`](./04-condiciones-consulta.md)) **salen de esta
> pantalla** (C10): ya no hay plan que contratar. La casilla acepta solo el acuerdo.
>
> **Corrección de una cita del 1.1.0** (F7): la profesión de dietista-nutricionista está en el
> art. **2.2.b** de la Ley 44/2003 (BOE, texto consolidado a 05/06/2021), no en el 2.2.g. El
> comentario del § 1 del 1.1.0 se deja como se publicó.

---

## Versión 2.0.0 — borrador (proyecto 025)

### Español

**title**: Antes de empezar con tus clientes

<!-- Elección C2: el título no dice «consulta», que es una de las palabras clínicas que un perfil sin insignia no puede usar (§ 2 de este acuerdo). La ruta /consulta conserva su nombre (PRD 025, scope 5). -->

**intro**:
- Vas a poder hacer el plan de comidas de las personas que acepten tu invitación y ver lo que cada una comparta contigo. Esto es lo que aceptas para hacerlo. Léelo: son pocas cosas y todas importan.
- NutrIA lo presta {name}, a quien puedes escribir en {email}.

#### 1. Quién eres aquí

- Cualquier persona mayor de 18 años con una cuenta y su correo confirmado puede abrir una consulta en NutrIA. Abrirla no es una comprobación de nada: NutrIA no ha comprobado tus estudios ni ningún título tuyo.
- Solo la insignia «Dietista-nutricionista colegiada/o» hace que NutrIA diga de ti que eres dietista-nutricionista. La da el titular de NutrIA después de comprobarlo, como explica el § 4, y nunca por lo que tú escribas.
- Ofreces tus servicios por tu cuenta, como profesional independiente: no en nombre de NutrIA ni como parte de su equipo.
- La cuenta es personal. Nadie más entra con ella, tampoco alguien de tu equipo.

<!-- Fuente: 0110 decisiones 1-2; 0111 §§ 1-2; PRD 025 scope 1 (switch, correo confirmado, mayor de edad con la fecha anotada) y criterio 2 (ninguna petición da la insignia); Ley 44/2003 art. 2.2.b (profesión titulada; F7) y art. 4.2; CP art. 403; LCD art. 5.1.g. «Una cuenta, un profesional»: PRODUCT.md § Users. -->

#### 2. Lo que puedes decir de ti

- Tu perfil tiene el nombre que muestras, tus estudios, tu precio y tu horario. Hoy solo lo vemos tú y el titular de NutrIA: no sale en ninguna lista, búsqueda ni página pública.
- Tus estudios se muestran siempre como «Declarado por esta persona; NutrIA no lo ha comprobado». Escribe solo lo que es verdad.
- Tu precio es el tuyo: el precio final, impuestos incluidos, con su unidad (por sesión, al mes o por plan). El servicio y el pago los acordáis tú y tu cliente, fuera de NutrIA. NutrIA no cobra a tus clientes por ti ni recibe su dinero.
- **Sin la insignia** no puedes usar, en ningún campo, «dietista», «nutricionista», «dietista-nutricionista», «D-N», «colegiado/a» ni tu número de colegiado, ni el título de grado o diplomatura en Nutrición Humana y Dietética. Tampoco palabras clínicas («consulta», «paciente», «tratamiento», «diagnóstico», «clínico», «terapéutico»), ni ofrecer un servicio para una enfermedad, ni prometer resultados. Puedes presentarte como «asesor/a de alimentación», «asesor/a nutricional» o «coach nutricional». Junto a tu nombre se mostrará siempre «No es un profesional sanitario verificado por NutrIA».
- **Con o sin la insignia**, nadie puede presentarse en NutrIA como médico, endocrino, enfermero/a, farmacéutico/a, psicólogo/a ni técnico/a superior en dietética: NutrIA no comprueba esos títulos.
- Atribuirte en público un título sanitario que no tienes puede ser un delito.
- El sistema rechaza esas palabras al guardar el perfil, y el titular revisa cada perfil (§ 5).

<!-- Fuente: PRD 025 scope 4-5 y criterio 6; legal 2026-11-18 § 3.a (la tabla de palabras; CP art. 403.1 y 403.2.a, LCD arts. 5.1.g y 7, Ley 44/2003 art. 44.1); 0110 decisiones 6 y 9; TRLGDCU art. 20.1.c y LSSI art. 10.1.f («precio final completo, incluidos los impuestos»); RDL 19/2018 art. 1.2 (NutrIA no recibe el dinero del cliente). La lista exacta y sus pruebas: ../2026-11-18-anyone-can-open-a-practice.md § 6. «Por sesión» en vez de «por consulta»: elección C2. «Psicólogo/a» sin «sanitario» y «técnico superior en dietética»: § 6.2 de ese documento (C9; legal O10). -->

#### 3. Qué verás y qué podrás hacer

Solo de las personas que acepten tu invitación, y mientras el enlace siga activo.

**Sin la insignia:**
- **Verás** su nombre, los planes que le hagas a través del enlace —los que generes, los que te lleguen para revisar y los que publiques—, con sus platos, cantidades y totales de cada día, y en qué punto estáis: desde cuándo estáis vinculados, si ha terminado su perfil, si tiene un plan en marcha o por revisar y si le quedan generaciones en la quincena. Nada de antes del enlace.
- **No verás** su peso, sus objetivos diarios ni cómo se calcularon, cuánto sigue el plan, sus check-ins, sus condiciones de salud, su medicación, sus suplementos, sus alergias, sus intolerancias ni su correo.
- **Podrás** generar y cambiar su plan, revisarlo antes de que lo vea y publicarlo. No podrás fijar sus objetivos: el plan se hace con los que tiene en su cuenta.

**Con la insignia**, y solo con quien haya aceptado la lista que corresponde a la insignia:
- **Verás además** sus objetivos diarios y cómo se calcularon, sus planes anteriores, cuánto ha seguido de cada quincena, su peso a lo largo del tiempo y las respuestas de cada check-in. Sus condiciones de salud, su medicación y sus suplementos, **solo si tu cliente lo marca aparte**, y dejas de verlos en cuanto lo desmarca.
- **Podrás además** fijar sus objetivos diarios dentro de los mismos límites de seguridad que usa la calculadora.
- Si consigues la insignia cuando ya tienes clientes, de cada uno seguirás viendo solo sus planes hasta que acepte la lista ampliada. Si la pierdes, desde la siguiente petición verás de todos solo lo de arriba, «sin la insignia».

**En los dos casos:**
- NutrIA no te enseña las alergias ni las intolerancias de nadie. Si un plato no se puede ofrecer a un cliente, solo verás «Este plato no encaja con este cliente», sin el motivo.
- Una persona que tiene anotada en NutrIA una condición de salud o una medicación solo puede vincularse con un profesional con la insignia. Si no la tienes, no sabrás por qué una invitación no se acepta o un enlace termina.
- No intentes averiguar el motivo de ninguna de estas dos cosas, ni lo preguntes.
- Cada vez que miras o cambias algo, tu cliente lo ve en su perfil: quién, qué y cuándo.

<!-- Fuente: 0110 decisión 3; 0111 §§ 4-5 y 8; PRD 025 scope 7-9 y criterios 9-13 (sin strategy, targets de día ni status de comida; los totals del día son el contenido del plan; objetivos, progreso, check-ins y salud 404; ningún error nombra un alérgeno); CareController.withClient y el rastro care_access_log (0059); RGPD arts. 5.1.c y 9.2.a. «Este plato no encaja con este cliente»: el diseño aprobado el 2026-11-18. «No intentes averiguar»: RGPD art. 5.1.b (fin limitado) y la inferencia que el consentimiento del cliente ya declara (textos/05 § F). -->

#### 4. La insignia

- **Qué dice**: «Dietista-nutricionista colegiada/o», con la fecha de la comprobación. Quiere decir que ese día NutrIA comprobó en el registro público de tu colegio que figuras como colegiado/a y habilitado/a con ese número, y que la cuenta es tuya. No dice nada de la calidad de tu trabajo, y NutrIA no te recomienda por tenerla.
- **Cómo se pide**: la pides tú, desde tu consulta, con tu colegio y tu número. El titular consulta ese registro y te envía un código a un contacto profesional que publica ese registro, por este orden: el correo del registro; una carta a tu dirección profesional del registro; una llamada al teléfono del registro. **Nunca** a un contacto que nos des tú. Introduces el código en tu consulta antes de 30 días y el titular lo confirma.
- **Qué guardamos**: quién lo comprobó, cuándo, qué registro, el resultado, el número y por qué vía fue el código. Ninguna copia de tu documento de identidad. El contacto al que fue el código no se guarda en NutrIA.
- **Cada año**: se vuelve a comprobar a los doce meses, y antes si alguien nos avisa de algo. Si pasan 30 días desde la fecha en que tocaba y no se ha podido completar, la insignia caduca. Te lo decimos con el motivo, aunque el retraso sea nuestro, y puedes volver a pedirla.
- **Se retira** si el registro deja de mostrarte habilitado/a, si resulta que el código no lo recibiste tú, o si incumples lo que este acuerdo dice de la insignia o de las palabras. Siempre con los motivos por escrito (§ 13).
- **Al perderla**: desde la siguiente petición ves de cada cliente solo lo de «sin la insignia». Los enlaces con clientes que tengan anotada una condición de salud o una medicación terminan. Las palabras de tu perfil que solo permite la insignia dejan de mostrarse, y tu perfil vuelve a revisión, hasta que lo edites.

<!-- Fuente: 0110 decisión 2; 0111 §§ 2-3 y 7-8; PRD 025 scope 6 y criterios 3-5 (el orden de los canales decidido el 2026-11-18; el correo del colegio descartado por el propietario el mismo día, C12; el registro: quién, cuándo, qué registro, resultado, número, canal; un re-chequeo vencido 30 días caduca la insignia con motivos); legal § 3.a (tres pasos; base: art. 6.1.b para quien la pide; nada de documentos, art. 5.1.c y e), § 6.0.1; DSA art. 17 y P2B art. 4.1 (motivos en soporte duradero, antes o al surtir efecto). «Aunque el retraso sea nuestro»: F5 de ../2026-11-18-anyone-can-open-a-practice.md. -->

#### 5. La primera revisión de tu perfil

- El titular de NutrIA mira cada perfil nuevo, y otra vez tras cada cambio en un texto, solo para ver que no hay publicidad engañosa, spam ni palabras que no puedes usar. No comprueba tus estudios.
- Que lo haya revisado no significa que NutrIA te apruebe, te recomiende ni responda de ti.
- Hoy la revisión no bloquea nada: tu consulta funciona igual mientras tanto. Si ocultamos tu perfil, te decimos por escrito por qué y cómo pedir que lo revisemos de nuevo.

<!-- Fuente: 0110 decisión 5; PRD 025 scope 11 y criterio 18 (no condiciona nada; un cambio en un texto la devuelve a la cola; nada la presenta como aprobación); DSA arts. 7 (revisar por iniciativa propia no hace perder la exención) y 17; LCD art. 21.1.c (no afirmar una aprobación). -->

#### 6. Confidencialidad y secreto profesional

- **Con la insignia**: lo que veas aquí está bajo tu secreto profesional, igual que lo que te cuentan en tu consulta. No lo compartes con nadie ajeno a la atención de esa persona, salvo cuando la ley te obliga o te permite hacerlo.
- **Sin la insignia**: la ley no te impone el secreto profesional de los sanitarios, y por eso te comprometes aquí, por contrato. Lo que veas de tus clientes es confidencial: no lo cuentas ni lo enseñas a nadie, salvo que tu cliente te lo pida o la ley te obligue, tampoco después de que el enlace termine. Tu cliente sabe, antes de aceptar, que tu obligación es esta y no la legal.
- Si trabajas con otras personas, ninguna usa tu cuenta ni ve tu consulta.

<!-- Fuente: Ley 44/2003 art. 5.1.c; Código Deontológico CGCODN arts. 22 y 29 (no verificados de nuevo: la página seguía protegida el 2026-11-18); RGPD art. 9.3 (el 9.2.h exige un profesional sujeto a secreto: sin insignia no hay 9.2.h, legal § 3.e); Código Civil art. 1091 (lo pactado obliga). -->

#### 7. Quién responde de los datos

- **NutrIA** es responsable de los datos de la cuenta de tu cliente: los guarda, los protege, decide cuánto duran y atiende sus derechos sobre ellos. Cuando tu cliente acepta tu invitación, NutrIA **te comunica** lo que dice su lista porque tu cliente lo pide y lo consiente.
- **Tú** eres responsable, por tu cuenta, de lo que hagas con lo que ves. Con la insignia, lo haces para tu asistencia dietética, con tu propia base legal como profesional sanitario, y lo que tu profesión te obliga a registrar lo registras en tu historia clínica, fuera de NutrIA. Sin la insignia, solo puedes usarlo para hacer el plan de esa persona, con el consentimiento que te da al aceptar. Cuando el enlace termina, ese consentimiento se acaba: borra lo que hubieras copiado de NutrIA, salvo lo que la ley te obligue a conservar.
- NutrIA **no** trata datos por cuenta tuya: no es tu encargado del tratamiento. Si algún día NutrIA guardara algo que escribes para tu práctica —notas, una ficha, documentos— o te dejara exportar la ficha de un cliente, antes firmaríamos un contrato de encargo y te pediríamos aceptarlo.
- Si un cliente te pide ejercer un derecho sobre los datos que viven en NutrIA, le indicas que lo haga desde su perfil o escribiendo a {email}. Si nos lo pide a nosotros sobre lo que tú guardas fuera, se lo diremos. Cada uno informa a los clientes de lo suyo: NutrIA ya les dice, en la invitación y en su política de privacidad, qué te comunica y quién eres.
- Si una autoridad o un tribunal considerara que decidimos juntos el tratamiento, este apartado es nuestro acuerdo de reparto de responsabilidades. NutrIA informa a los clientes, atiende sus derechos sobre lo que vive en NutrIA y es el punto de contacto. Tú lo haces sobre lo que guardas fuera. Sus aspectos esenciales están en la política de privacidad.

<!-- Fuente: RGPD arts. 4.7-4.8, 6.1.a y 9.2.a (comunicación consentida), 9.2.h y 9.3 (solo con la insignia), 7.3 (la retirada se hace terminando el enlace), 17.1.b (supresión cuando se retira el consentimiento y no hay otra base), 26.1-2, 28; CEPD Directrices 07/2020 v2.0, apdos. 55, 70, 71; LOPDGDD DA 17ª; Ley 41/2002 arts. 15-17. Un consentimiento para dos responsables: legal § 3.e y M12 — **[abogado]**. «Borra lo que hubieras copiado»: M16 de ../2026-11-18-anyone-can-open-a-practice.md — **[abogado]**. -->

#### 8. NutrIA es una herramienta, no una segunda opinión

- NutrIA planifica comidas. No diagnostica, no trata y no deriva ninguna regla de una enfermedad, salvo una: la celiaquía excluye el gluten. La medicación no produce nada.
- Los platos y las recetas los propone un modelo de inteligencia artificial y los comprueba nuestro código: alergias e intolerancias declaradas, límites de calorías y de proteína. Esas comprobaciones valen para cualquier plan, también el que hagas tú. Pueden tener errores de cantidades o de pasos. La decisión sobre el plan y su revisión son tuyas.
- Los datos de salud de tu cliente nunca llegan al modelo, y nada de tu perfil ni de tu insignia llega tampoco.
- Sin la insignia no eres un profesional sanitario verificado por NutrIA. No hagas planes para tratar una enfermedad.

<!-- Fuente: 0004, 0008; ARCHITECTURE.md § Invariants; PRD 025 criterio 16 (perfiles, insignias y códigos dentro de health-boundary.spec.ts y assistant-boundary.spec.ts); 0110 decisión 11 y legal B5 (los mismos límites para el plan de un profesional); CP art. 403 y Ley 44/2003 art. 7.2.g (legal § 3.a: la exposición es mayor en una patología); Reglamento (UE) 2024/1689, art. 4. -->

#### 9. A quién invitas

- Solo a personas que ya te conocen y que saben, antes de recibir el correo, que las vas a invitar. Su dirección nos la das tú, y con ella solo enviamos la invitación.
- Nunca a menores de 18 años. Tampoco a personas que necesiten nutrición clínica que NutrIA no cubre: una enfermedad metabólica diagnosticada que requiera una pauta específica, el embarazo, la recuperación de un trastorno de la conducta alimentaria o la alimentación infantil. Sin la insignia, tampoco a nadie que te haya dicho que tiene una enfermedad o toma medicación.
- Tu cliente decide: puede decir que no, aceptar sin compartir su salud, retirar esa parte o terminar el enlace cuando quiera. No le condiciones tu atención a que acepte.

<!-- Fuente: RGPD arts. 5.1.b y 6; LSSI art. 21; LOPDGDD art. 7 y condiciones de uso (18 años); PRODUCT.md § Users, «Not a user (v1)»; 0110 decisión 4 y PRD 025 scope 10 (la regla de la enfermedad); RGPD art. 7.4. -->

#### 10. Lo que cuesta

- Abrir tu consulta y usarla es gratis, con hasta 10 clientes activos. Las invitaciones sin responder también ocupan plaza hasta que caducan.
- Vincularse contigo no le da Premium a tu cliente ni le cambia los límites de su cuenta.
- Si algún día NutrIA ofrece planes de pago para profesionales, tendrán sus propias condiciones, que aceptarías aparte antes de pagar nada.

<!-- Fuente: 0110 decisión 13; 0111 § 6 (practiceClients, 10 en los dos niveles, resuelto según 0097); PRD 025 scope 2-3 y criterios 7-8. Ley 7/1998 art. 5 (condiciones disponibles antes de aceptar). Las condiciones del plan de consulta (textos/04) salen de esta pantalla: C10. -->

#### 11. Qué pasa con los datos cuando algo termina

- **Termina un enlace**, porque lo terminas tú, tu cliente, o NutrIA por la regla del § 3: dejas de ver sus datos en la siguiente petición. Los objetivos que fijaste se quedan en su cuenta y pasan a ser suyos. Un plan que tenías pendiente de revisar no se le muestra. Tu nombre sigue en su registro de accesos, porque es su derecho saber quién miró.
- **Borras tu cuenta**: terminan todos tus enlaces y se borran tus invitaciones, tu perfil y lo que guardamos de tu insignia. Tu nombre se queda en el registro de accesos de cada cliente que tuviste, sin tu cuenta.
- **Tu cliente borra su cuenta**: dejas de verlo; su registro se borra con ella.
- **Suspendemos tu cuenta como profesional** (§ 13): mientras dure, no ves los datos de ningún cliente, no puedes invitar a nadie y no puedes abrir una consulta.
- **Cerramos tu consulta definitivamente** (§ 13): pierdes el acceso a tus clientes y tus invitaciones se anulan.
- Lo que hayas copiado fuera de NutrIA lo conservas o lo borras según el § 7.

<!-- Fuente: 0059 (cierre en la siguiente petición); 0060 enmienda fase 5 (plan pendiente sin coste); care.schema.ts (professionalName conservado con professionalId a NULL); PLAN 025 fase 2 (perfil, comprobaciones y códigos en cascada con el profesional); 0111 § 9 (la revocación del titular sigue); RGPD arts. 13.2.a y 15. Ya no hay «concesión» ni plan que se pause. -->

#### 12. Seguridad

- Protege tu acceso: una contraseña que no uses en otro sitio, o entra con Google. No dejes la sesión abierta en un ordenador compartido.
- Si tu cuenta tiene contraseña, la verificación en dos pasos con una app de autenticación es obligatoria: sin ella no se abren los datos de tus clientes, y una llave de acceso no la sustituye mientras tu cuenta tenga contraseña. La activas en tu perfil, en Seguridad. Si entras solo con Google, mantén activada la verificación en dos pasos de tu cuenta de Google: nosotros no podemos comprobarla.
- No hagas capturas ni copias de la ficha de un cliente, salvo para tu historia clínica si tienes la insignia, y guárdalas con la misma protección que el resto de tu documentación.
- Si crees que alguien ha entrado en tu cuenta o ha visto datos de un cliente que no debía, escríbenos a {email} en cuanto lo sepas, y en todo caso en 24 horas. Nosotros valoraremos si hay que avisar a la Agencia Española de Protección de Datos y a los clientes; si la brecha es tuya, fuera de NutrIA, esa obligación es tuya.

<!-- Fuente: como el § 8 del 1.1.0 (RGPD arts. 32-34; Ley 41/2002 art. 17.6; ProfessionalGuard y core/domain/SecondFactor, en producción desde el proyecto 011 fase 6). -->

#### 13. Usos prohibidos, y qué hacemos si se incumple el acuerdo

No puedes:
- intentar ver datos de alguien que no ha aceptado tu invitación, o saber si una dirección tiene cuenta en NutrIA;
- invitar a direcciones de personas que no te conocen, ni usar la invitación para anunciar tus servicios;
- usar los datos de tus clientes para algo que no sea hacer su plan o atenderles: ni publicidad, ni estudios, ni venderlos ni cederlos;
- presentarte, en NutrIA o ante tus clientes de NutrIA, con un título o una palabra que el § 2 no te permite;
- intentar averiguar por qué un plato no encaja, por qué una invitación no se acepta o por qué un enlace termina;
- compartir o prestar tu cuenta;
- extraer datos de forma automatizada o intentar saltarte los límites o las medidas de seguridad.

Si se incumple este acuerdo:
- **Podemos ocultar tu perfil o retirar tu insignia** por incumplir los §§ 2, 6, 7, 9 o este § 13, por los motivos del § 4 para la insignia, o por una orden de una autoridad o una obligación legal. Se aplica en el momento, y te damos los motivos por escrito, por correo, antes o en ese momento: los hechos, la cláusula y cómo pedir que lo revisemos.
- **Podemos suspender tu cuenta como profesional** por las mismas causas, o si hay un riesgo para tus clientes. También se aplica en el momento, con los motivos por escrito, antes o en ese momento. Mientras dure, no ves los datos de ningún cliente, no puedes invitar a nadie y no puedes abrir una consulta, hasta que la levantemos. Si la levantamos, te lo decimos por correo y puedes volver a abrir tu consulta.
- **Podemos cerrar tu consulta definitivamente** por las mismas causas. Te lo avisamos por correo con 30 días y los motivos. Puede ser antes si la ley nos obliga o si has incumplido este acuerdo de forma repetida, y entonces te damos los motivos sin demora. Al cerrarla, pierdes el acceso a tus clientes y tus invitaciones se anulan (§ 11).
- **Para pedir que lo revisemos**, responde a ese correo o escribe a {email}. Lo revisa una persona y te contesta. Si deshacemos un ocultamiento o una retirada, recuperas tu perfil o tu insignia como estaban.

<!-- Fuente: 0059; RGPD art. 5.1.b; LSSI art. 21; CP art. 403.2.a; Reglamento (UE) 2019/1150 arts. 3.1.c (los motivos de suspensión y cierre, en las condiciones), 4.1 (motivos al restringir o suspender, en soporte duradero), 4.2 (30 días antes de cerrar), 4.3 (aclarar los hechos; reincorporar sin demora si se revoca), 4.4 (excepciones: obligación legal, razón imperiosa, incumplimiento reiterado) y 4.5 (contenido de la motivación) — leídos en el DOUE L 186 de 11.7.2019, pp. 70-71; DSA art. 17.3 (contenido de la declaración de motivos). Si P2B se aplica ya antes del directorio es dudoso (F8; M17) — se aplica igual. **Lo que el producto hace, y nada más**: ocultar (`hidden_at`, fase 6), retirar la insignia (`withdrawn`, fase 3) y la revocación del titular (`ProfessionalRepository.revoke`, `packages/core/src/repositories/Professional/ProfessionalRepository.ts:198`: borra la fila `professionals` y las invitaciones; los enlaces quedan sin acceso). **Decidido por el propietario el 2026-11-18** (a raíz del hallazgo sobre la revocación): el plan gana una suspensión real desde la consola — mientras dure, la cuenta no puede abrir ni reabrir una consulta —; el cierre definitivo lleva motivos y 30 días de aviso; ocultar un perfil y retirar una insignia siguen siendo inmediatos. El texto dice eso y nada más: «no ves los datos de ningún cliente, no puedes invitar a nadie y no puedes abrir una consulta» es lo que la suspensión tiene que garantizar en el código, sea cual sea su forma. Los 30 días antes del cierre definitivo son un deber del titular (go-live-checklist § 1 bis). P2B art. 4.1 (suspensión: motivos antes o al surtir efecto), 4.2 (terminación: 30 días), 4.3 (reincorporar si se revoca). -->

#### 14. Cambios y duración

- Este acuerdo dura mientras tengas tu consulta. Puedes dejarla cuando quieras borrando tu cuenta o pidiéndonoslo en {email}.
- Si lo cambiamos, te lo diremos por correo al menos 15 días antes de que se aplique, y puedes dejar la consulta antes de esa fecha. Solo puede ser antes si la ley nos obliga o para frenar un fraude o un ataque. Si el cambio es importante, te pediremos aceptarlo de nuevo antes de volver a abrir los datos de tus clientes; mientras tanto, tus clientes siguen con sus cuentas.
- Se rige por la ley española.

<!-- Fuente: Reglamento (UE) 2019/1150 art. 3.2 (aviso en soporte duradero, al menos quince días, derecho a resolver antes) y 3.4 (excepciones: obligación legal; peligro imprevisto e inminente de fraude, programas maliciosos, spam o ciberseguridad); Ley 7/1998 arts. 5 y 7; Código Civil art. 1256. «Pidiéndonoslo»: cerrar la propia consulta desde la app está fuera del proyecto 025 (PLAN § Out of scope); la revocación del titular es la vía. -->

**checkbox**: He leído y acepto el acuerdo del profesional.

**accept**: Aceptar y empezar

**version**: Versión {version}

**acceptedOn**: Aceptado el {date}, versión {version}.

### English

**title**: Before you start with your clients

**intro**:
- You will be able to make the meal plans of the people who accept your invitation and see what each of them shares with you. This is what you agree to in order to do so. Please read it: it is short and all of it matters.
- NutrIA is provided by {name}, who you can write to at {email}.

#### 1. Who you are here

- Anyone over 18 with an account and a confirmed email address can open a practice on NutrIA. Opening one checks nothing: NutrIA has not checked your studies or any title of yours.
- Only the badge "Registered dietitian-nutritionist" makes NutrIA say that you are a dietitian-nutritionist. NutrIA's owner gives it after checking, as section 4 explains, and never because of anything you type.
- You offer your services on your own account, as an independent professional: not on NutrIA's behalf or as part of its team.
- The account is personal. Nobody else signs in with it, including anyone on your team.

#### 2. What you may say about yourself

- Your profile holds the name you show, your studies, your price and your hours. Today only you and NutrIA's owner see it: it is in no list, search or public page.
- Your studies are always shown as "Declared by this person; NutrIA has not checked it". Write only what is true.
- Your price is your own: the final price, taxes included, with its unit (per session, per month or per plan). You and your client agree the service and the payment outside NutrIA. NutrIA does not charge your clients on your behalf or receive their money.
- **Without the badge** you may not use, in any field, "dietitian", "nutritionist", "dietitian-nutritionist", "D-N", "registered" or your registration number, or the degree or diploma in Human Nutrition and Dietetics. Nor clinical words ("consultation", "patient", "treatment", "diagnosis", "clinical", "therapeutic"), nor offer a service for a disease, nor promise results. You may present yourself as a "food adviser", "nutrition adviser" or "nutrition coach". Beside your name the product always shows "Not a health professional verified by NutrIA".
- **With or without the badge**, nobody may present themselves on NutrIA as a doctor, endocrinologist, nurse, pharmacist, psychologist or dietetic technician: NutrIA does not check those titles.
- Publicly claiming a health title you do not hold can be a criminal offence.
- The system refuses those words when the profile is saved, and NutrIA's owner reviews every profile (section 5).

#### 3. What you will see and what you can do

Only for people who accept your invitation, and only while the link is active.

**Without the badge:**
- **You will see** their name, the plans you make for them through the link — the ones you generate, the ones sent to you for review and the ones you publish — with their dishes, amounts and each day's totals, and where things stand: since when you have been linked, whether they have finished their profile, whether they have a plan under way or waiting for review and whether they have generations left this fortnight. Nothing from before the link.
- **You will not see** their weight, their daily targets or how they were worked out, how much of the plan they follow, their check-ins, their health conditions, medication or supplements, their allergies or intolerances, or their email address.
- **You can** generate and change their plan, review it before they see it and publish it. You cannot set their targets: the plan is made with the ones in their account.

**With the badge**, and only with someone who has accepted the list that goes with the badge:
- **You will also see** their daily targets and how they were worked out, their earlier plans, how much of each fortnight they followed, their weight over time and their answers to each check-in. Their health conditions, medications and supplements **only if your client ticks that separately**, and you stop seeing them as soon as they untick it.
- **You can also** set their daily targets within the same safety bounds the calculator uses.
- If you gain the badge while you already have clients, you keep seeing only each one's plans until they accept the wider list. If you lose it, from the next request you see of everyone only what is listed above under "without the badge".

**Either way:**
- NutrIA shows nobody's allergies or intolerances. If a dish cannot be offered to a client, you will only see "This dish does not suit this client", without the reason.
- A person who has a health condition or a medication on record in NutrIA can only link with a professional who holds the badge. If you do not hold it, you will not know why an invitation is not accepted or a link ends.
- Do not try to find out the reason for either, or ask about it.
- Every time you look at or change something, your client sees it on their profile: who, what and when.

#### 4. The badge

- **What it says**: "Registered dietitian-nutritionist", with the date of the check. It means that on that day NutrIA checked, on your college's public register, that you are listed as registered and entitled to practise under that number, and that the account is yours. It says nothing about the quality of your work, and NutrIA does not recommend you for holding it.
- **How you apply**: you apply yourself, from your practice, with your college and your number. NutrIA's owner looks at that register and sends you a code at a professional contact that register publishes, in this order: the register's email; a letter to your professional address on the register; a call to the register's phone number. **Never** to a contact you give us. You enter the code in your practice within 30 days and the owner confirms it.
- **What we keep**: who checked, when, which register, the result, the number and which way the code went. No copy of your identity document. The contact the code went to is not kept on NutrIA.
- **Every year**: it is checked again after twelve months, and sooner if somebody tells us something. If 30 days pass after the date it was due and the check could not be completed, the badge lapses. We tell you, with the reason, even if the delay was ours, and you can apply again.
- **It is removed** if the register stops showing you as entitled to practise, if it turns out you were not the one who received the code, or if you breach what this agreement says about the badge or about words. Always with the reasons in writing (section 13).
- **When you lose it**: from the next request you see of each client only what is listed under "without the badge". Links with clients who have a health condition or a medication on record end. The words in your profile that only the badge allows stop being shown, and your profile goes back for review, until you edit it.

#### 5. The first review of your profile

- NutrIA's owner looks at every new profile, and again after every change to a text, only to see that there is no misleading advertising, spam or words you may not use. The owner does not check your studies.
- Having reviewed it does not mean that NutrIA approves of you, recommends you or answers for you.
- Today the review blocks nothing: your practice works the same in the meantime. If we hide your profile, we tell you in writing why and how to ask us to look again.

#### 6. Confidentiality and professional secrecy

- **With the badge**: what you see here is covered by your professional secrecy, like anything a client tells you in a consultation. You do not share it with anyone outside that person's care, except where the law requires or allows you to.
- **Without the badge**: the law does not bind you to health professionals' secrecy, so you commit to confidentiality here, by contract. What you see of your clients is confidential: you do not tell it or show it to anybody, unless your client asks you to or the law requires it, including after the link ends. Your client knows, before accepting, that this is your duty, and not the legal one.
- If you work with others, none of them uses your account or sees your practice.

#### 7. Who is responsible for the data

- **NutrIA** is the controller of the data in your client's account: it stores it, protects it, decides how long it is kept and handles their rights over it. When your client accepts your invitation, NutrIA **discloses** to you what their list says, because your client asks for it and consents.
- **You** are responsible, on your own account, for what you do with what you see. With the badge, you do so for your dietetic care, on your own legal basis as a health professional, and whatever your profession requires you to record you record in your clinical record, outside NutrIA. Without the badge, you may only use it to make that person's plan, under the consent they give you when they accept. When the link ends, that consent ends: delete anything you copied from NutrIA, except what the law requires you to keep.
- NutrIA does **not** process data on your behalf: it is not your processor. If NutrIA ever stored something you write for your practice — notes, a record, documents — or let you export a client's file, we would first sign a processing agreement and ask you to accept it.
- If a client asks you to exercise a right over the data held in NutrIA, point them to their profile or to {email}. If they ask us about what you keep outside NutrIA, we will tell them. Each of us informs clients about our own part: NutrIA already tells them, in the invitation and in its privacy policy, what it discloses to you and who you are.
- If an authority or a court considered that we decide the processing jointly, this section is our arrangement. NutrIA informs clients, handles their rights over what is held in NutrIA and is the contact point. You do so for what you keep outside. Its essence is set out in the privacy policy.

#### 8. NutrIA is a tool, not a second opinion

- NutrIA plans meals. It does not diagnose or treat, and it derives no rule from any condition except one: coeliac disease excludes gluten. Medication produces nothing.
- Dishes and recipes are proposed by an artificial-intelligence model and checked by our code: declared allergies and intolerances, calorie and protein bounds. Those checks apply to every plan, including the ones you make. They can contain mistakes in quantities or steps. The decision on the plan, and its review, are yours.
- Your client's health data never reaches the model, and nothing of your profile or your badge does either.
- Without the badge you are not a health professional verified by NutrIA. Do not make plans to treat a disease.

#### 9. Who you invite

- Only people who already know you and who know, before the email arrives, that you are inviting them. You give us their address, and we only use it to send the invitation.
- Never anyone under 18. Nor people who need clinical nutrition NutrIA does not cover: a diagnosed metabolic disease requiring a specific regimen, pregnancy, recovery from an eating disorder, or infant feeding. Without the badge, nor anyone who has told you they have a condition or take medication.
- Your client decides: they can say no, accept without sharing their health, withdraw that part or end the link at any time. Do not make your care conditional on their accepting.

#### 10. What it costs

- Opening and using your practice is free, for up to 10 active clients. Unanswered invitations also take a place until they expire.
- Linking with you does not give your client Premium or change their account's limits.
- If NutrIA ever offers paid plans for professionals, they will have their own terms, which you would accept separately before paying anything.

#### 11. What happens to the data when something ends

- **A link ends**, because you end it, your client does, or NutrIA does under the rule in section 3: you stop seeing their data on the next request. The targets you set stay in their account and become theirs. A plan you had pending review is not shown to them. Your name stays in their access record, because knowing who looked is their right.
- **You delete your account**: all your links end, and your invitations, your profile and what we keep about your badge are deleted. Your name stays in the access record of every client you had, without your account.
- **Your client deletes their account**: you stop seeing them; their record goes with it.
- **We suspend your account as a professional** (section 13): while it lasts, you see no client's data, you cannot invite anyone and you cannot open a practice.
- **We close your practice for good** (section 13): you lose access to your clients and your pending invitations are cancelled.
- Whatever you copied outside NutrIA you keep or delete as section 7 says.

#### 12. Security

- Protect your access: a password you do not use anywhere else, or sign in with Google. Do not leave the session open on a shared computer.
- If your account has a password, two-step verification with an authenticator app is required: without it your clients' data does not open, and a passkey does not replace it while your account has a password. You turn it on in your profile, under Security. If you sign in only with Google, keep your Google account's two-step verification on: we cannot check it.
- Do not take screenshots or copies of a client's page, except for your clinical record if you hold the badge, and keep them with the same protection as the rest of your documentation.
- If you think someone has got into your account or seen a client's data they should not have, write to {email} as soon as you know, and in any case within 24 hours. We will assess whether the Spanish Data Protection Agency and the clients must be told; if the breach is yours, outside NutrIA, that duty is yours.

#### 13. Prohibited uses, and what we do if the agreement is breached

You may not:
- try to see the data of anyone who has not accepted your invitation, or find out whether an address has a NutrIA account;
- invite the addresses of people who do not know you, or use the invitation to advertise your services;
- use your clients' data for anything other than making their plan or caring for them: no advertising, no studies, no selling or passing it on;
- present yourself, on NutrIA or to your NutrIA clients, with a title or a word that section 2 does not allow you;
- try to find out why a dish does not suit someone, why an invitation is not accepted or why a link ends;
- share or lend your account;
- extract data automatically or try to get round the limits or the security measures.

If the agreement is breached:
- **We may hide your profile or remove your badge** for a breach of sections 2, 6, 7, 9 or this section 13, for the reasons in section 4 for the badge, or on an authority's order or a legal obligation. It takes effect at once, and we give you the reasons in writing, by email, before or at that moment: the facts, the clause, and how to ask us to look again.
- **We may suspend your account as a professional** for the same causes, or if there is a risk to your clients. It also takes effect at once, with the reasons in writing, before or at that moment. While it lasts, you see no client's data, you cannot invite anyone and you cannot open a practice, until we lift it. If we lift it, we tell you by email and you can open your practice again.
- **We may close your practice for good** for the same causes. We tell you by email 30 days in advance, with the reasons. It may be sooner if the law requires it or if you have breached this agreement repeatedly, and then we give you the reasons without delay. When it is closed, you lose access to your clients and your pending invitations are cancelled (section 11).
- **To ask us to look again**, reply to that email or write to {email}. A person reviews it and answers you. If we reverse a hiding or a removal, you get your profile or your badge back as it was.

#### 14. Changes and term

- This agreement lasts as long as you have your practice. You can leave it whenever you like by deleting your account or asking us at {email}.
- If we change it, we will tell you by email at least 15 days before the change applies, and you can leave your practice before that date. It can only be sooner if the law requires it or to stop a fraud or an attack. If the change is important, we will ask you to accept it again before your clients' data opens again; your clients keep their accounts in the meantime.
- It is governed by Spanish law.

**checkbox**: I have read and accept the professional's agreement.

**accept**: Accept and start

**version**: Version {version}

**acceptedOn**: Accepted on {date}, version {version}.

---

## Pantallas de la consulta (proyecto 025, borrador)

**Dónde**: `/consulta`, namespace `practice` (claves nuevas, en `es-ES.ts` y `en-GB.ts`). Fases 8
(la consulta) y 9 (la consola). Ninguna sube versión: no son textos de consentimiento, pero el de
la solicitud cumple el art. 13 para la comprobación de la insignia y **tiene que estar en pantalla
antes del primer `POST` de solicitud** (PLAN fase 3, paso 2).

### P1. Abrir la consulta

| Clave | es-ES | en-GB |
| --- | --- | --- |
| `practice.openTitle` | `Abre tu consulta` | `Open your practice` |
| `practice.openIntro` | `Es gratis, con hasta 10 clientes. Antes de ver nada de nadie te pediremos que aceptes el acuerdo del profesional.` | `It is free, for up to 10 clients. Before you see anything of anyone we will ask you to accept the professional's agreement.` |
| `practice.openBirthDate` | `Tu fecha de nacimiento` | `Your date of birth` |
| `practice.openBirthDateHint` | `Para comprobar que eres mayor de edad. Se guarda en tu cuenta.` | `To check that you are an adult. It is kept in your account.` |
| `practice.openCta` | `Abrir mi consulta` | `Open my practice` |

<!-- Fuente: PRD 025 scope 1 y criterio 1 (assertOldEnough y fecha no nula); RGPD art. 13.1.c; LOPDGDD art. 7. -->

### P2. Pedir la insignia (art. 13)

| Clave | es-ES | en-GB |
| --- | --- | --- |
| `practice.badgeApplyTitle` | `Pedir la insignia de dietista-nutricionista` | `Apply for the dietitian-nutritionist badge` |
| `practice.badgeApplyIntro` | `Si eres dietista-nutricionista colegiada/o, la insignia lo dice en NutrIA y te deja ver de tus clientes lo que tu profesión necesita, si ellos lo aceptan.` | `If you are a registered dietitian-nutritionist, the badge says so on NutrIA and lets you see of your clients what your profession needs, if they accept it.` |
| `practice.badgeRegister` | `Tu colegio` | `Your college` |
| `practice.badgeNumber` | `Tu número de colegiada/o` | `Your registration number` |
| `practice.badgeApplyPrivacy` | `Al pedirla, consultaremos el registro público de colegiados de tu colegio con este número y te enviaremos un código al contacto profesional que publica ese registro: su correo, una carta a tu dirección profesional o una llamada a su teléfono. Nunca a un contacto que nos des tú, así que no te lo pedimos. Guardaremos qué registro consultamos, cuándo, el resultado («habilitada/o» o no), el número y por qué vía enviamos el código, mientras exista tu cuenta. No guardamos copia de ningún documento. Lo volveremos a comprobar cada año. Más en la {privacy}.` | `When you apply, we will look up this number on your college's public register and send you a code at the professional contact that register publishes: its email, a letter to your professional address or a call to its phone number. Never to a contact you give us, so we do not ask you for one. We will keep which register we looked at, when, the result (entitled to practise or not), the number and which way we sent the code, for as long as your account exists. We keep no copy of any document. We will check again every year. More in the {privacy}.` |
| `practice.badgeApplyCta` | `Pedir la insignia` | `Apply for the badge` |

<!-- Fuente: RGPD art. 13.1.c (fin y base: 6.1.b, lo pide quien la quiere) y 13.2.a (plazo); 5.1.c (nada de documentos); PRD 025 scope 6 (la solicitud nombra registro y número y dice que se leerá el registro y se guardará el resultado); legal § 3.a «Data protection of the person looked up». El cuerpo de la petición no lleva ningún contacto (PLAN fase 3, paso 2). `{privacy}` enlaza a /privacidad#tu-profesional. -->

### P3. El código y el estado de la insignia

| Clave | es-ES | en-GB |
| --- | --- | --- |
| `practice.badgeState.none` | `Sin insignia.` | `No badge.` |
| `practice.badgeState.applied` | `Lo has pedido. Vamos a consultar el registro de tu colegio; el código te llegará por el contacto que publica.` | `You have applied. We are going to look at your college's register; the code will reach you through the contact it publishes.` |
| `practice.badgeState.codeSent` | `Te hemos enviado un código. Introdúcelo aquí antes del {date}.` | `We have sent you a code. Enter it here before {date}.` |
| `practice.badgeState.badged` | `Dietista-nutricionista colegiada/o · Comprobado por NutrIA el {date}` | `Registered dietitian-nutritionist · Checked by NutrIA on {date}` |
| `practice.badgeState.due` | `Toca volver a comprobar tu insignia. No tienes que hacer nada salvo si te llega un código nuevo; si el {date} no lo hemos completado, caducará.` | `Your badge is due for its yearly check. You need do nothing unless a new code reaches you; if we have not completed it by {date}, it will lapse.` |
| `practice.badgeState.lapsed` | `Tu insignia ha caducado. Te hemos escrito con el motivo. Puedes volver a pedirla.` | `Your badge has lapsed. We have written to you with the reason. You can apply again.` |
| `practice.badgeCode` | `Código` | `Code` |
| `practice.badgeCodeCta` | `Comprobar` | `Check` |
| `practice.badgeCodeWrong` | `Ese código no vale. Revisa que lo has copiado bien; si ha caducado, vuelve a pedir la insignia.` | `That code is not valid. Check you copied it correctly; if it has expired, apply for the badge again.` |
| `practice.badgeCodeDone` | `Código recibido. En cuanto lo confirmemos, verás tu insignia.` | `Code received. As soon as we confirm it, you will see your badge.` |
| `practice.badgeMeaning` | `Qué significa: el {date} comprobamos en el registro de {register} que figuras como dietista-nutricionista colegiada/o y habilitada/o, con el número {number}, y que esta cuenta es tuya. No es una valoración de tu trabajo. Lo comprobamos de nuevo cada año.` | `What it means: on {date} we checked on {register}'s register that you are listed as a registered dietitian-nutritionist entitled to practise, under number {number}, and that this account is yours. It is not an assessment of your work. We check again every year.` |

<!-- Fuente: PRD 025 criterio 3 («a wrong, used or expired code answers exactly as an unknown one»: por eso una sola frase para los tres casos); 0111 §§ 2-3; legal § 3.a. El número se muestra solo desde una comprobación «pass» (PLAN fase 3, paso 6; PRD criterio 5). -->

### P4. El aviso fijo y el perfil

| Clave | es-ES | en-GB |
| --- | --- | --- |
| `practice.unverifiedNotice` (también lo pinta la invitación, `05` § F.3) | `No es un profesional sanitario verificado por NutrIA` | `Not a health professional verified by NutrIA` |
| `practice.unverifiedSelf` (al practicante sin insignia, fijo en su consulta) | `Sin la insignia, de cada cliente ves el plan que le haces y en qué punto está, nada de su salud.` | `Without the badge, you see of each client the plan you make for them and where it stands, nothing of their health.` |
| `practice.profileName` | `El nombre que muestras` | `The name you show` |
| `practice.profileStudies` | `Tus estudios` | `Your studies` |
| `practice.profileStudiesNote` | `Declarado por esta persona; NutrIA no lo ha comprobado.` | `Declared by this person; NutrIA has not checked it.` |
| `practice.profilePrice` | `Precio final, impuestos incluidos` | `Final price, taxes included` |
| `practice.profilePriceUnit` | `por sesión` · `al mes` · `por plan` | `per session` · `per month` · `per plan` |
| `practice.profilePriceNote` | `Lo cobras tú, fuera de NutrIA.` | `You charge it yourself, outside NutrIA.` |
| `practice.profileHours` | `Horario` | `Hours` |
| `practice.profileHoursNote` | `Solo informativo: en NutrIA no se reserva nada.` | `For information only: nothing is booked on NutrIA.` |
| `practice.profileWordRefused` | `Sin la insignia no puedes usar «{word}» en tu perfil.` | `Without the badge you cannot use "{word}" in your profile.` |
| `practice.profileWordNever` | `En NutrIA nadie puede presentarse como «{word}»: no comprobamos ese título.` | `Nobody can present themselves on NutrIA as "{word}": we do not check that title.` |
| `practice.profilePromiseRefused` (**aprobado por el propietario el 2026-11-19**, por opción marcada) | `En NutrIA nadie puede prometer resultados, como «{word}»: lo que consiga cada persona no se puede garantizar.` | `Nobody can promise results on NutrIA, such as "{word}": what each person achieves cannot be guaranteed.` |
| `practice.profileReviewNote` | `Revisamos cada perfil nuevo y cada cambio, solo para ver que no hay publicidad engañosa, spam ni palabras que no puedes usar. No comprobamos tus estudios, y que lo hayamos revisado no significa que NutrIA te recomiende.` | `We review every new profile and every change, only to see that there is no misleading advertising, spam or words you may not use. We do not check your studies, and our having reviewed it does not mean that NutrIA recommends you.` |
| `practice.profileReviewState.queued` | `Pendiente de revisión` | `Waiting for review` |
| `practice.profileReviewState.seen` | `Revisado` | `Reviewed` |
| `practice.profileReviewState.hidden` | `Oculto: te hemos escrito con el motivo` | `Hidden: we have written to you with the reason` |
| `practice.seats` | `{active} de {limit} clientes` | `{active} of {limit} clients` |
| `practice.seatsPending` | `Y {count} invitaciones sin responder, que también ocupan plaza.` | `And {count} unanswered invitations, which also take a place.` |
| `practice.dishRefused` | `Este plato no encaja con este cliente` | `This dish does not suit this client` |

<!-- Fuente: PRD 025 scope 4-5, 11 y 12; legal § 3.a (aviso fijo; palabras) y § 3.g (el plato rechazado no nombra el motivo: 0013 § 5.3); 0110 decisiones 5, 6 y 9; TRLGDCU art. 20.1.c; LCD art. 21.1.c («Revisado», nunca «Aprobado»). `practice.unverifiedSelf`: el diseño aprobado el 2026-11-18 dice «el plan que hace y el chat»; el chat no existe en el proyecto 025, así que se dice solo el plan (C1). `{limit}` es la plaza resuelta (0097), nunca un 10 escrito en el texto. -->

<!-- `practice.profilePromiseRefused` (2026-11-19, para la fase 6): la tercera categoría que el código rechaza, para todos, con o sin insignia — la pasada sobre el texto en bruto de ../2026-11-18-anyone-can-open-a-practice.md § 6.4 («garantizado/a/os», «asegurado», «100 %», un número seguido de «kg» o «kilos»). `{word}` es el fragmento tal como lo escribió (por ejemplo «10 kg» o «garantizado»), igual que en las otras dos. Fuente: este acuerdo § 2 («ni prometer resultados»), aprobado el 2026-11-18; Ley 44/2003 art. 44.1 (publicidad «objetiva, prudente y veraz, de modo que no levante falsas esperanzas», para quien tiene la insignia); LCD arts. 5.1 y 7 (engaño, para todos); RD 1907/1996 art. 4.2 y 4.4, leído en el BOE (BOE-A-1996-18085, sin modificaciones) el 2026-11-19 — prohíbe la publicidad de «métodos con pretendida finalidad sanitaria» que «sugieran propiedades específicas adelgazantes» o «proporcionen seguridades de alivio o curación cierta»; que un servicio de planes de comida sea uno de esos «métodos» es mi lectura **[abogado]**. La frase no dice «la ley lo prohíbe» porque eso último es una lectura; dice el porqué que es verdad en cualquier caso. -->

---

## Versión 1.1.0 — en vigor

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

<!-- Fuente: RGPD art. 4.7-4.8 (responsable, encargado), 6.1.a y 9.2.a (comunicación consentida), 9.2.h y 9.3 (uso del profesional), 26.1-2 (reparto si hubiera corresponsabilidad; «se pondrán a disposición del interesado los aspectos esenciales»), 28 (encargo, que aquí no hay); CEPD Directrices 07/2020 v2.0, apdos. 55, 70, 71; LOPDGDD DA 17ª.1 c) y e). Análisis: docs/legal/analysis.md § 2. -->

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
- ⟦dos-pasos-obligatoria⟧ Si tu cuenta tiene contraseña, la verificación en dos pasos con una app de autenticación es obligatoria: sin ella no se abren los datos de tus pacientes, y una llave de acceso no la sustituye mientras tu cuenta tenga contraseña. La activas en tu perfil, en Seguridad. Si entras solo con Google, mantén activada la verificación en dos pasos de tu cuenta de Google: nosotros no podemos comprobarla. ⟦fin⟧
- No hagas capturas ni copias de la ficha salvo para tu historia clínica, y guárdalas con la misma protección que el resto de tu documentación clínica.
- Si crees que alguien ha entrado en tu cuenta o ha visto datos de un paciente que no debía, escríbenos a {email} en cuanto lo sepas, y en todo caso en 24 horas. Nosotros valoraremos si hay que avisar a la Agencia Española de Protección de Datos y a los pacientes; si la brecha es tuya, fuera de NutrIA, esa obligación es tuya.

<!-- Fuente: RGPD art. 32 (seguridad), 33 (notificación a la autoridad en 72 horas por cada responsable de su brecha) y 34 (comunicación al interesado); Ley 41/2002 art. 17.6 (medidas de seguridad en la documentación clínica). -->

<!-- ⟦dos-pasos-obligatoria⟧ (2026-10-03, proyecto 011 fase 6; no se publican las marcas). Se publica con la fase 6 en producción, no antes: describe lo que hacen `ProfessionalGuard` y `core/domain/SecondFactor` (`secondFactorMissing`: cuenta con contraseña y verificación apagada → 404 en toda ruta de pacientes; la página de la consulta lo dice, `secondFactorRequired`). Fuente: RGPD art. 32.1 (medidas apropiadas al riesgo: el profesional ve datos de salud, art. 9, de varias personas; EIPD R8) y 32.4 no aplica (el profesional no actúa bajo la autoridad de NutrIA: es responsable independiente, § 4), por eso la frase sobre Google es una obligación contractual del acuerdo, no una instrucción; art. 13.2.e (DOUE L 119, 4.5.2016, texto en español leído el 2026-10-03: «si el interesado está obligado a facilitar los datos personales y está informado de las posibles consecuencias de que no facilitar tales datos»; aquí, que la consulta no abre). «No podemos comprobarla»: NutrIA no recibe de Google si su verificación está activada; no afirma nada sobre la política de Google. Versión: añadir una condición de acceso a un servicio de pago entre empresas es «algo importante» en el sentido del § 10 (Ley 7/1998 arts. 5 y 7; Código Civil art. 1256): `PROFESSIONAL_AGREEMENT_VERSION` → `1.1.0` y se pide aceptar de nuevo — **a confirmar con un abogado**; hoy cuesta nada, porque el único profesional en producción es la cuenta del propietario (LOG del 011, fase 6). -->

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
- ⟦dos-pasos-obligatoria⟧ If your account has a password, two-step verification with an authenticator app is required: without it your clients' data does not open, and a passkey does not replace it while your account has a password. You turn it on in your profile, under Security. If you sign in only with Google, keep your Google account's two-step verification on: we cannot check it. ⟦fin⟧
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
