# Política de privacidad (sustituye a la actual)

> **No soy abogado.** Borrador para el producto.
>
> **Propósito**: la política de privacidad completa, lista para sustituir a la publicada. **Audiencia**: `frontend` (diccionarios), `backend` (almacenamiento y versión), el propietario y el abogado. **Committed**: sí. **Mantenido por**: el agente `legal`; lo aprueban el propietario y el abogado.
>
> **Dónde va**: namespace `privacy` de `apps/web/src/i18n/dictionaries/es-ES.ts` (líneas
> 1096-1182 hoy) y `en-GB.ts`, misma forma: `intro[]`, `sections[]` con `heading`,
> `paragraphs[]` y `list[]`, `title`, `updated`. Página `/privacidad`.
>
> **Qué corrige** (ver [`analisis.md` § 9](../analisis.md#9-riesgos-ordenados-por-lo-que-le-puede-pasar-a-una-persona-real)):
> la base del art. 9 para alergias y datos corporales (P0-2), el destino real de los datos
> de la IA (P0-3), transferencias, plazos, derechos que faltaban, el proyecto 004 entero,
> «uso técnico anónimo», la copia de seguridad, y la frase sobre el autónomo (P1-5, P2-5).
>
> **Condiciones para publicarla** — la política no puede prometer lo que el código no
> hace. Las frases marcadas **⟦si X⟧** solo se publican cuando X esté hecho; hasta
> entonces se usa la variante que se indica:
> - **⟦consentimiento-perfil⟧**: el consentimiento explícito del onboarding (P0-2).
> - **⟦ia-encargado⟧**: la combinación de modelos solo con proveedores sin entrenamiento y
>   con contrato (P0-3). Mientras no, la variante B de «La inteligencia artificial».
> - **⟦salud-enlace⟧**: el control para retirar solo la línea de salud del enlace (P0-1).
> - **⟦edad⟧**: la puerta de edad (P1-4).
> - **⟦copias⟧**: la exportación manual cifrada y con plazo (P1-6).
>
> Sin consentimiento de nadie que volver a pedir por la política en sí: lo que se acepta
> son los consentimientos de [`05`](./05-consentimientos-cliente.md), que tienen su versión.
> Cambiar la política sí obliga a actualizar `updated` y, por lo que promete la actual
> («te pediremos tu consentimiento de nuevo»), a pedir otra vez el de salud si cambia cómo
> se trata la salud — lo hace la subida de `HEALTH_CONSENT_VERSION` de `05`.

---

## Español

**title**: Política de privacidad

**updated**: Última actualización: {fecha de publicación}

**intro**:
- Esta política explica qué datos guarda NutrIA sobre ti, para qué, con quién los comparte, cuánto tiempo y qué puedes hacer con ellos.
- NutrIA es una herramienta de planificación de comidas. No es un servicio médico y no sustituye el consejo de un médico ni de un dietista-nutricionista colegiado.

### Quién trata tus datos

- El responsable del tratamiento es {name}, titular de NutrIA. Datos completos en el aviso legal. Puedes escribir a {email} para cualquier cuestión sobre tus datos.
- No tenemos delegado de protección de datos porque la ley no nos lo exige; {email} cumple esa función de contacto.

<!-- Fuente: RGPD art. 13.1.a-b; LOPDGDD art. 34 (DPD no obligatorio: analisis.md § 5.2). Se retira «una persona física — no una empresa ni un autónomo registrado» (P2-5). El aviso legal: textos/07. -->

### Qué datos recogemos y para qué

- **Cuenta**: tu nombre y tu correo y, si entras con Google o Apple, el nombre y el correo que ese servicio nos confirma. Mientras tienes la sesión abierta guardamos la dirección IP y el navegador desde el que entraste, para poder cerrarla. Para que tengas una cuenta y solo tú entres en ella.
- **Tu cuerpo y tu objetivo**: fecha de nacimiento, sexo, altura, peso, nivel de actividad, horarios y tu objetivo (por ejemplo, perder peso). Para calcular cuánto necesitas comer.
- **Alergias e intolerancias**: las que eliges de la lista, las que escribes a mano y su gravedad. Para que ningún plan te proponga algo que te puede hacer daño.
- **Tu forma de comer**: por ejemplo vegetariana, sin gluten o sin lactosa, y la cocina que te gusta o no. Para ajustar los platos.
- **Enfermedades, medicación y suplementos**: solo si decides contárnoslo, bajo un consentimiento aparte que puedes retirar en cualquier momento sin borrar el resto de tu cuenta.
- **Cómo llevas el plan**: qué comidas marcas como hechas o saltadas, tus valoraciones y comentarios de los platos, tu peso a lo largo del tiempo y tus check-ins quincenales. Para que el siguiente plan lo tenga en cuenta.
- **Pagos**: si contratas Premium o un plan de consulta, Stripe cobra y nosotros guardamos solo el identificador de cliente y de suscripción, su estado y cuándo termina el periodo. Nunca vemos el número de tu tarjeta.
- **Uso del producto**: registramos, ligado a tu cuenta, cuándo abres sesión y cuándo pides cambiar un plato, sin más detalle. Para saber si el producto funciona.
- **Lo que nos escribes**: los mensajes del buzón de sugerencias, para leerlos y responderte.
- **Si trabajas con un dietista en NutrIA**: lo que se explica en «Tu dietista en NutrIA».
- **Si eres dietista-nutricionista en NutrIA**: tu número de colegiado y cuándo te dimos acceso, y la versión del acuerdo que aceptaste.

<!-- Fuente: RGPD art. 13.1.c; tablas de packages/database/src/schemas (profile, safety, plan, progress, platform, professional, auth); session.ipAddress/userAgent (auth.schema.ts:45-56); analytics_events con userId (platform.schema.ts:91-100; auth.config.ts:103; MealPlans.service.ts:69) — ya no se llama «anónimo» (P1-5); feedback (platform.schema.ts:16). -->

### Cuáles de estos datos son especialmente protegidos

La ley protege especialmente los datos de salud y los que revelan creencias religiosas. En NutrIA lo son: tus alergias e intolerancias; tu peso, tu altura y tu objetivo, porque dicen algo de tu salud; una forma de comer como «sin gluten» o «sin lactosa», o una ligada a una religión; tus enfermedades, tu medicación y tus suplementos; y lo que escribas sobre cómo te sienta el plan.

<!-- Fuente: RGPD art. 4.15 y 9.1; TJUE C-184/20 (1/8/2022) y C-21/23 (4/10/2024), interpretación amplia; analisis.md § 1.2. -->

### Por qué podemos tratar estos datos

- **Para darte el servicio que pides** (contrato): tu cuenta, tu perfil, tus planes, tus pagos y los correos del servicio.
- **Con tu consentimiento explícito**: ⟦si consentimiento-perfil⟧ tus alergias e intolerancias, tu cuerpo y tu objetivo y tu forma de comer, que nos das con una casilla propia al crear tu perfil. Sin ellos no podemos hacer un plan seguro para ti, por eso sin ese consentimiento no generamos planes; puedes retirarlo cuando quieras borrando esos datos desde tu perfil. Tus enfermedades, tu medicación y tus suplementos, con un consentimiento aparte, opcional. Y lo que compartes con tu dietista, con el consentimiento que das al aceptar su invitación. Cada consentimiento se guarda con su fecha y la versión del texto que aceptaste.
- **Por nuestro interés legítimo**: registrar el uso del producto y los errores técnicos para que funcione, sin datos de salud. Puedes oponerte escribiéndonos.
- **Por obligación legal**: conservar lo que la ley fiscal exige de los pagos (lo hace Stripe).

<!-- Fuente: RGPD art. 6.1.a, b, c, f; 9.2.a (consentimiento explícito); 7.1 (demostrar), 7.3 (retirada), 7.4 (condicionar solo lo necesario: CEPD Directrices 05/2020, apdos. 26-36); 21 (oposición). Mientras no exista ⟦consentimiento-perfil⟧ esta sección NO se puede publicar sin mentir: la versión actual (es-ES.ts:1125) apoya alergias en el contrato, que no es una excepción del art. 9 (P0-2). -->

### Tu dietista en NutrIA

- Un dietista-nutricionista puede invitarte por correo a llevar tu plan en NutrIA con su ayuda. Solo un profesional al que hemos dado acceso tras comprobar su número de colegiado puede hacerlo. Su invitación dura 14 días; tu dirección la usamos solo para enviártela y la borramos con la invitación: en cuanto respondes o, si no respondes, como muy tarde el día después de que caduque.
- **Nada se comparte si no aceptas.** Si aceptas, tu dietista **verá** tu nombre, tus objetivos diarios y cómo se calcularon, tus planes, cuánto sigues cada quincena, tu peso a lo largo del tiempo y tus respuestas a los check-ins. **Podrá** fijar tus objetivos, generar y cambiar tus planes, y revisar cada plan nuevo antes de que lo veas. Tus enfermedades, tu medicación y tus suplementos solo si marcas esa casilla aparte. **No verá** tus alergias ni intolerancias, tu correo ni tus comentarios escritos.
- Cada vez que tu dietista mira o cambia algo, queda anotado y lo ves en tu perfil, en «Quién ha accedido».
- Puedes terminar el enlace cuando quieras desde tu perfil, y desde la siguiente petición tu dietista deja de ver tus datos. ⟦si salud-enlace⟧ También puedes dejar de compartir solo tu salud sin terminar el enlace. Tus objetivos, tu historial y tu último plan publicado se quedan contigo.
- **Quién responde de qué**: NutrIA es responsable de tus datos en NutrIA y te los comunica a tu dietista porque tú lo pides. Tu dietista es responsable, por su cuenta y bajo su secreto profesional, de lo que haga con lo que ve en su consulta, por ejemplo lo que anote en tu historia clínica; para eso, escríbele a él. Para todo lo que está en NutrIA, escríbenos a {email}: somos tu punto de contacto.
- Si tu dietista borra su cuenta, el enlace termina y su nombre sigue en tu registro de accesos.

<!-- Fuente: RGPD art. 13.1.c y e (destinatario: el profesional), 7.3 (retirada), 26.2 (aspectos esenciales del reparto si hubiera corresponsabilidad); 0059, 0060, 0061; CareClientOverviewView (CareController.ts:193-200); care_invitations (care.schema.ts:9-54); analisis.md § 2. Sin ⟦salud-enlace⟧ se omite la frase marcada. -->

### La inteligencia artificial

- Un modelo de inteligencia artificial propone los platos y las recetas. Nuestro propio código comprueba cada uno antes de que te llegue: un alérgeno declarado no llega a tu plan aunque el modelo se equivoque. La IA no toma ninguna decisión sobre ti: los límites de calorías y de proteína los aplican reglas fijas, no el modelo.
- **Lo que recibe el modelo**: tus objetivos diarios y tu objetivo (por ejemplo, perder peso), qué comidas haces y a qué horas te levantas, te acuestas y entrenas, cuánto cocinas y tu presupuesto, si eres vegetariano o vegano, las cocinas y los alimentos que te gustan, los nombres de los platos que te gustaron, que no te gustaron o que comiste la quincena anterior, y tus respuestas cerradas al check-in (hambre, dificultad, nota). Siempre con los nombres de nuestras listas. **Nunca** recibe tu nombre, tu correo, tu edad, tu sexo, tu peso ni tu altura, nada que hayas escrito a mano, tus alergias ni intolerancias, ninguna otra forma de comer (sin gluten, sin lactosa, halal, kósher…), ni tus enfermedades, tu medicación o tus suplementos. Lo que no puedes o no quieres comer lo quitamos antes, en nuestro código, del catálogo de alimentos que ve: le llega el efecto, nunca el dato.
- **Variante A ⟦si ia-encargado⟧**: los modelos los prestan proveedores que tratan esos datos por encargo nuestro, con contrato, sin usarlos para entrenar ni para nada propio, y en su caso fuera de la UE con las garantías que se indican abajo.
- **Variante B (hasta entonces)**: hoy algunos de los modelos que usamos son versiones gratuitas alojadas en Estados Unidos cuyos proveedores pueden usar lo que reciben para mejorar sus modelos. Por eso les enviamos solo lo necesario para diseñar platos. Estamos cambiando a proveedores que no reutilicen los datos.
- Las ilustraciones de las recetas las dibuja un modelo a partir del nombre y los ingredientes de la receta, sin ningún dato tuyo.

<!-- Fuente: PoolPrompt.ts, PROMPT_VERSION 4.0.0 a e28f0e5 (qué entra: ver la nota de profileConsent.ai en textos/05 § A; publicar esta frase solo con esa versión fusionada); ai.config.ts:121-136 (sin ids de persona); health-boundary.spec.ts; RecipeIllustrator.service.ts:21-25; RGPD art. 13.1.e-f, 22 (sin decisiones automatizadas con efectos jurídicos), 28; Reglamento (UE) 2024/1689 art. 50. La variante B es la verdad a 2026-09-12 según docs/reference/ai-gateway.md § 1; con e28f0e5 el modelo ya no recibe salud, creencias ni texto libre, así que la variante B es verdadera y suficiente; la A sigue siendo el objetivo. -->

### Con quién compartimos tus datos

- **Tu dietista**, solo si aceptas su invitación (ver arriba).
- **Proveedores de inteligencia artificial**, como se explica arriba.
- **Vercel** (alojamiento de la web y la API, en la UE) y **Neon** (base de datos, en la UE). Son empresas de Estados Unidos.
- **Stripe** y su servicio **Link**, si pagas algo. ⟦si Managed Payments sigue activo⟧ Link actúa como vendedor en la compra: te cobra, te envía el recibo y gestiona el IVA, y trata tus datos de pago según su propia política.
- **Nuestro proveedor de correo**, para los correos de confirmación, recuperación de contraseña, invitaciones y avisos que actives.
- **El servicio de notificaciones de tu navegador** (Google, Apple o Mozilla), si activas los avisos; el contenido va cifrado y ellos no pueden leerlo.
- **Sentry**, un servicio de errores, solo si está activado: recibe el error y dónde ocurrió, nunca tus datos, tu usuario ni lo que escribiste.
- No vendemos tus datos. No hay anuncios ni cookies publicitarias.

<!-- Fuente: RGPD art. 13.1.e; deployment.md:100-106 (fra1 / eu-central-1); ErrorReporter.ts:45-110; Stripe Managed Payments (Link como merchant of record); web-push VAPID (payload cifrado). -->

### Transferencias fuera de la Unión Europea

Algunos de estos proveedores son empresas de Estados Unidos o tratan datos allí: Vercel, Neon, Stripe, el proveedor de correo, Sentry y los de inteligencia artificial. Vercel está certificado en el Marco de Privacidad de Datos UE-EE. UU., que la Comisión Europea reconoce como garantía suficiente; con el resto nos apoyamos en ese mismo marco o en las cláusulas contractuales tipo de la Comisión, según ofrezca cada uno. ⟦variante B⟧ Los modelos gratuitos de inteligencia artificial que usamos hoy no ofrecen ninguna de esas garantías; por eso solo les enviamos lo que se describe arriba, sin nada que te identifique, que escribas tú ni que sea un dato de salud o una creencia. Puedes pedirnos el detalle de cada garantía en {email}.

<!-- Fuente: RGPD arts. 13.1.f, 45 (decisión de adecuación: Decisión de Ejecución (UE) 2023/1795, Marco de Privacidad UE-EE. UU.), 46.2.c (cláusulas tipo). Verificado 2026-09-25: Vercel figura como certificado en el DPF (dataprivacyframework.gov y changelog de Vercel). Neon, Stripe, Sentry y el proveedor de correo: el propietario comprueba su DPA/DPF en la lista oficial antes de nombrarlos uno a uno [abogado]. La frase de la variante B es obligatoria mientras se usen modelos opencode/*-free o Gemini gratuito: sin ella la sección afirma una garantía que esos proveedores no dan. — analisis.md § 4.2. -->

### Cuánto tiempo guardamos tus datos

- Mientras tu cuenta exista. Al borrarla, todo lo que hay en ella se borra al momento: perfil, alergias, salud, planes, listas, progreso, consentimientos, enlaces con tu dietista y el registro de accesos. Antes cancelamos cualquier suscripción que tengas.
- Una invitación se borra en cuanto la aceptas o la rechazas; si no respondes, caduca a los 14 días y se borra, con tu dirección, como muy tarde al día siguiente.
- El registro de uso del producto se borra a los 24 meses y los registros técnicos de la generación de planes a los 12. ⟦publicar cuando exista la purga (P2-4)⟧
- **Copias de seguridad**: nuestro proveedor de base de datos guarda un historial para recuperarnos de un fallo, que se borra solo pasados {n} días. ⟦si copias⟧ Además, hacemos copias manuales cifradas que se borran a los 30 días. Un dato que borras puede seguir en esas copias hasta que caduquen; no lo usamos para nada más.
- **Si fuiste dietista en NutrIA**, tu nombre se queda en el registro de accesos de tus antiguos pacientes, porque es su derecho saber quién vio sus datos.
- Stripe conserva los datos de facturación el tiempo que le exige la ley, aunque borres tu cuenta.

<!-- Fuente: RGPD art. 13.2.a y 5.1.e; auth.config.ts:212-231 (borrado); care.schema.ts:14-24 (invitaciones); care.schema.ts:122 (nombre del profesional); deployment.md § 8 (la ventana {n} está sin anotar: el propietario la toma de la consola de Neon; mientras falte, «puedes pedirnos el plazo exacto en {email}» —lo que publicó frontend— es una sustitución aceptable, porque el art. 13.2.a admite «los criterios utilizados para determinar este plazo» y no inventa un número). La frase actual «se elimina automáticamente pasado ese plazo» es falsa para la exportación manual (P1-6). -->

### Tus derechos

- **Acceso**: ver qué datos tenemos, desde tu perfil o pidiéndolos por correo.
- **Rectificación**: corregirlos, desde tu perfil en casi todo.
- **Supresión**: borrar tu cuenta desde tu perfil, o pedirlo por correo.
- **Portabilidad**: recibir tus datos en un archivo estructurado para llevarlos a otro servicio; pídenoslo por correo.
- **Limitación**: pedirnos que dejemos de usar un dato mientras resolvemos una reclamación tuya sobre él.
- **Oposición**: al registro de uso del producto, escribiéndonos.
- **Retirar un consentimiento** cuando quieras, sin que afecte a lo que ya hicimos con él: el de tu salud, borrándola desde tu perfil; el de tu dietista, terminando el enlace ⟦si salud-enlace⟧ o dejando de compartir solo tu salud.
- **Reclamar** ante la Agencia Española de Protección de Datos (aepd.es).

Respondemos en un mes como máximo. No te cobramos nada por ello.

<!-- Fuente: RGPD arts. 12.3 (un mes), 12.5 (gratuidad), 13.2.b-d, 15-18, 20, 21, 7.3, 77. La actual omitía portabilidad y limitación (P1-5). -->

### Cómo protegemos tus datos

Tu contraseña nunca se guarda en texto plano y la conexión va siempre cifrada. Tus enfermedades, tu medicación y tus suplementos viven en una parte del código que no puede hablar con la inteligencia artificial, y un test lo comprueba en cada cambio. Un dietista solo llega a tus datos a través del enlace que aceptaste, y cada acceso queda anotado. Los registros del servidor y de errores no guardan lo que escribes. El acceso a la base de datos está restringido y nadie la consulta salvo para arreglar un fallo.

<!-- Fuente: RGPD art. 32; ARCHITECTURE.md § Invariants; ErrorReporter.ts; pino redaction (apps/api/src/shared/logging/pino.ts:51). -->

### Cookies y almacenamiento en tu dispositivo

- Solo usamos lo imprescindible para que el servicio funcione, y por eso no te pedimos permiso: la cookie de tu sesión, la del idioma que has elegido y, al entrar con Google o Apple, las que ese paso necesita durante unos minutos. Ninguna es de terceros ni rastrea tu actividad en otras webs.
- En el almacenamiento de tu navegador guardamos lo que marcas sin conexión hasta que se envía, un aviso de plan pendiente de revisión y, si instalas NutrIA en tu teléfono, una copia de tu plan de hoy y de la lista de la compra para usarlas sin conexión. Todo se queda en tu dispositivo.

<!-- Fuente: LSSI art. 22.2 in fine («estrictamente necesario, para la prestación de un servicio… expresamente solicitado»); proxy.ts:92 y locale-sync.ts:17 (idioma); auth.config.ts:62-81 (sesión); pendingTicks.ts:17, pendingReview.ts:1, arrival.ts:1, offline.ts:61. -->

### Menores de edad

NutrIA no es para menores de 18 años. ⟦si edad⟧ Si la fecha de nacimiento que indicas es de alguien menor, no podemos crear el perfil. Si sabemos que una cuenta es de un menor de 18 años, la borramos.

<!-- Fuente: LOPDGDD art. 7 (14 años para consentir); RGPD art. 8; condiciones de uso (18, decisión del propietario de 2026-09-25). Sin ⟦edad⟧, omitir la segunda frase: hoy no se comprueba (P1-4). -->

### Cambios en esta política

Si cambiamos algo importante, lo diremos aquí con la fecha y te avisaremos por correo antes de que se aplique. Si el cambio afecta a cómo tratamos tus datos de salud o lo que compartes con tu dietista, te pediremos tu consentimiento de nuevo.

<!-- Fuente: RGPD art. 12.1 y 13.3; 7 (nuevo consentimiento cuando cambia el fin). -->

---

## English

**title**: Privacy policy

**updated**: Last updated: {publication date}

**intro**:
- This policy explains what data NutrIA keeps about you, what for, who it shares it with, for how long, and what you can do about it.
- NutrIA is a meal-planning tool. It is not a medical service and does not replace the advice of a doctor or a registered dietitian-nutritionist.

### Who handles your data

- The controller is {name}, who runs NutrIA. Full details are in the legal notice. You can write to {email} about anything to do with your data.
- We have no data protection officer because the law does not require one; {email} is the contact point.

### What we collect and why

- **Account**: your name and email and, if you sign in with Google or Apple, the name and email that service confirms. While you are signed in we keep the IP address and browser you signed in from, so we can end the session. So that you have an account and only you get into it.
- **Your body and your goal**: date of birth, sex, height, weight, activity level, schedule and your goal (for example, losing weight). To work out how much you need to eat.
- **Allergies and intolerances**: the ones you pick from the list, the ones you type yourself, and how severe they are. So that no plan offers you something that could harm you.
- **How you eat**: for example vegetarian, gluten-free or lactose-free, and the cuisines you like or not. To fit the dishes to you.
- **Conditions, medications and supplements**: only if you choose to tell us, under a separate consent you can withdraw at any time without deleting the rest of your account.
- **How the plan is going**: which meals you mark as eaten or skipped, your ratings and comments on dishes, your weight over time and your fortnightly check-ins. So the next plan takes them into account.
- **Payments**: if you buy Premium or a practice plan, Stripe takes the payment and we keep only the customer and subscription identifiers, their status and when the period ends. We never see your card number.
- **Product use**: we record, linked to your account, when you sign in and when you ask to change a dish, and nothing more. To know whether the product works.
- **What you write to us**: messages in the feedback box, so we can read and answer them.
- **If you work with a dietitian on NutrIA**: see "Your dietitian on NutrIA".
- **If you are a dietitian-nutritionist on NutrIA**: your registration number, when we gave you access, and the version of the agreement you accepted.

### Which of these are specially protected

The law gives special protection to health data and to data revealing religious beliefs. On NutrIA these are: your allergies and intolerances; your weight, height and goal, because they say something about your health; a way of eating such as gluten-free or lactose-free, or one tied to a religion; your conditions, medications and supplements; and anything you write about how the plan agrees with you.

### Why we may process this data

- **To provide the service you ask for** (contract): your account, profile, plans, payments and service emails.
- **With your explicit consent**: ⟦if profile-consent⟧ your allergies and intolerances, your body and goal and your way of eating, which you give with a checkbox of its own when you create your profile. Without them we cannot make a safe plan for you, so without that consent we do not generate plans; you can withdraw it at any time by deleting that data from your profile. Your conditions, medications and supplements, under a separate, optional consent. And what you share with your dietitian, under the consent you give when you accept their invitation. Each consent is stored with its date and the version of the text you accepted.
- **Our legitimate interest**: recording product use and technical errors to keep it working, with no health data. You can object by writing to us.
- **Legal obligation**: keeping what tax law requires about payments (Stripe does this).

### Your dietitian on NutrIA

- A dietitian-nutritionist can invite you by email to follow your plan with them on NutrIA. Only a professional we have given access to, after checking their registration number, can do so. The invitation lasts 14 days; we use your address only to send it and delete it with the invitation: as soon as you answer or, if you do not, by the day after it expires at the latest.
- **Nothing is shared unless you accept.** If you do, your dietitian **will see** your name, your daily targets and how they were worked out, your plans, how much of each fortnight you follow, your weight over time and your check-in answers. They **can** set your targets, generate and change your plans, and review each new plan before you see it. Your conditions, medications and supplements only if you tick that separate box. They **will not see** your allergies or intolerances, your email address or your written comments.
- Every time your dietitian looks at or changes something, it is recorded and you can see it on your profile under "Who has accessed".
- You can end the link from your profile at any time, and from the next request your dietitian stops seeing your data. ⟦if health-link⟧ You can also stop sharing just your health without ending the link. Your targets, your history and your last published plan stay with you.
- **Who is responsible for what**: NutrIA is responsible for your data on NutrIA and discloses it to your dietitian because you ask it to. Your dietitian is responsible, on their own account and under professional secrecy, for what they do with what they see in their practice, such as what they note in your clinical record; for that, contact them. For everything held on NutrIA, write to us at {email}: we are your contact point.
- If your dietitian deletes their account, the link ends and their name stays in your access record.

### Artificial intelligence

- An artificial-intelligence model proposes dishes and recipes. Our own code checks each one before it reaches you: a declared allergen does not reach your plan even if the model gets it wrong. The AI makes no decision about you: the calorie and protein bounds are applied by fixed rules, not by the model.
- **What the model receives**: your daily targets and your goal (for example, losing weight), which meals you eat and when you wake, sleep and train, how much you cook and your budget, whether you are vegetarian or vegan, the cuisines and foods you like, the names of dishes you liked, disliked or ate last fortnight, and your closed check-in answers (hunger, difficulty, rating). Always by the names on our lists. It **never** receives your name, email, age, sex, weight or height, anything you typed yourself, your allergies or intolerances, any other way of eating (gluten-free, lactose-free, halal, kosher…), or your conditions, medications or supplements. What you cannot or will not eat we remove first, in our code, from the catalogue of foods it sees: it gets the effect, never the datum.
- **Variant A ⟦if ai-processor⟧**: the models are provided by companies that process this data on our behalf, under contract, without using it for training or for anything of their own, and where outside the EU with the safeguards set out below.
- **Variant B (until then)**: some of the models we use today are free versions hosted in the United States whose providers may use what they receive to improve their models. That is why we send them only what is needed to design dishes. We are moving to providers that do not reuse data.
- Recipe illustrations are drawn by a model from the recipe's name and ingredients, with no data of yours.

### Who we share your data with

- **Your dietitian**, only if you accept their invitation (see above).
- **Artificial-intelligence providers**, as explained above.
- **Vercel** (hosting for the website and API, in the EU) and **Neon** (database, in the EU). Both are US companies.
- **Stripe** and its **Link** service, if you pay for anything. ⟦if Managed Payments stays on⟧ Link acts as the seller of the purchase: it charges you, sends the receipt and handles VAT, and processes your payment data under its own policy.
- **Our email provider**, for confirmation, password-reset, invitation and reminder emails you turn on.
- **Your browser's notification service** (Google, Apple or Mozilla), if you turn on notifications; the content is encrypted and they cannot read it.
- **Sentry**, an error-reporting service, only if enabled: it receives the error and where it happened, never your data, your user or what you wrote.
- We do not sell your data. There are no ads and no advertising cookies.

### Transfers outside the European Union

Some of these providers are US companies or process data there: Vercel, Neon, Stripe, the email provider, Sentry and the AI providers. Vercel is certified under the EU-US Data Privacy Framework, which the European Commission recognises as an adequate safeguard; with the others we rely on that same framework or on the Commission's standard contractual clauses, whichever each offers. ⟦variant B⟧ The free AI models we use today offer neither safeguard; that is why we send them only what is described above, with nothing that identifies you, that you wrote, or that is health data or a belief. You can ask us for the details of each safeguard at {email}.

### How long we keep your data

- While your account exists. When you delete it, everything in it is deleted at once: profile, allergies, health, plans, lists, progress, consents, links with your dietitian and the access record. Before that, we cancel any subscription you have.
- An invitation is deleted as soon as you accept or decline it; if you do not answer, it expires after 14 days and is deleted, with your address, by the following day at the latest.
- The product-use record is deleted after 24 months and the technical records of plan generation after 12. ⟦publish once the purge exists (P2-4)⟧
- **Backups**: our database provider keeps a history to recover from a failure, which is deleted automatically after {n} days. ⟦if backups⟧ We also make encrypted manual copies that are deleted after 30 days. Data you delete may remain in those copies until they expire; we do not use it for anything else.
- **If you were a dietitian on NutrIA**, your name stays in your former clients' access record, because knowing who saw their data is their right.
- Stripe keeps billing data for as long as the law requires it to, even if you delete your account.

### Your rights

- **Access**: see what data we hold, from your profile or by asking by email.
- **Rectification**: correct it, from your profile for almost everything.
- **Erasure**: delete your account from your profile, or ask by email.
- **Portability**: receive your data in a structured file to take to another service; ask us by email.
- **Restriction**: ask us to stop using a piece of data while we resolve your complaint about it.
- **Objection**: to the product-use record, by writing to us.
- **Withdraw a consent** at any time, without affecting what we already did with it: your health consent, by deleting it from your profile; your dietitian's, by ending the link ⟦if health-link⟧ or by stopping sharing just your health.
- **Complain** to the Spanish Data Protection Agency (aepd.es).

We answer within one month at most, free of charge.

### How we protect your data

Your password is never stored in plain text and the connection is always encrypted. Your conditions, medications and supplements live in a part of the code that cannot talk to the artificial intelligence, and a test checks it on every change. A dietitian reaches your data only through the link you accepted, and every access is recorded. Server and error logs do not keep what you write. Database access is restricted and nobody looks at it except to fix a fault.

### Cookies and storage on your device

- We only use what is essential for the service to work, which is why we do not ask for permission: your session cookie, the cookie for the language you chose and, when you sign in with Google or Apple, the ones that step needs for a few minutes. None is third-party or tracks you on other sites.
- In your browser's storage we keep the meals you tick while offline until they are sent, a notice about a plan pending review and, if you install NutrIA on your phone, a copy of today's plan and the shopping list so they work offline. It all stays on your device.

### Children

NutrIA is not for anyone under 18. ⟦if age⟧ If the date of birth you give belongs to someone younger, we cannot create the profile. If we learn that an account belongs to someone under 18, we delete it.

### Changes to this policy

If we change anything important, we will say so here with the date and email you before it applies. If the change affects how we handle your health data or what you share with your dietitian, we will ask for your consent again.
