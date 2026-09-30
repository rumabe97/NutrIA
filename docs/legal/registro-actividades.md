# Registro de actividades de tratamiento (art. 30 RGPD)

> **Propósito**: el registro que el art. 30.1 exige al responsable. La excepción del
> art. 30.5 (menos de 250 personas) **no aplica**: el tratamiento no es ocasional e incluye
> categorías especiales del art. 9.1. **Audiencia**: el propietario; la AEPD si lo pide
> (art. 30.4). **Committed**: sí. **Mantenido por**: el agente `legal`; se actualiza en el
> mismo cambio que añada un dato, un destinatario o un fin.
>
> Revisado el 2026-09-26: fila 2 (IA, `0064`). Revisado el 2026-09-27: fila 2 (imágenes de los platos, proyecto 006).
> Revisado el 2026-09-28: fila 2
> (onboarding, `0067` — verdad una vez fusionada `feat/onboarding-cleanup`; incluye
> «país», que empieza a leerse con este mismo cambio). Revisado otra vez el mismo
> día: fila 2 (la migración `0043` pone a `NULL`, para todas las cuentas, las diez
> columnas que `0067` deja de rellenar — verdad una vez fusionada la misma rama).
> Revisado el 2026-09-29: fila 7 (correos al propietario, `0071` — verdad una vez fusionada
> `agent/008-phase6/backend`): ningún dato, fin ni destinatario nuevo; el correo lleva solo
> recuentos, códigos y enlaces ([nota](./2026-09-29-correos-al-propietario.md)).
> Revisado otra vez el mismo día: filas 1, 5 y 7 (el aviso al propietario de cuenta esperando
> deja de llevar la dirección y el enlace de activación, enmienda de `0029`; y un aviso de
> tarea callada — verdad una vez fusionado el árbol de trabajo de `admin-console-loose-ends`
> sobre `e1332b4`): ningún dato, fin ni destinatario nuevo; un dato menos en el buzón del
> propietario ([adenda](./2026-09-29-correos-al-propietario.md#adenda-2026-09-29-tarde-el-aviso-de-cuenta-esperando-resuelto-y-un-cuarto-aviso)).
> Revisado el 2026-09-30: fila 7 (dos avisos al propietario sobre las imágenes de los platos,
> `0072`, proyecto 009 fase 1 — verdad una vez fusionado el árbol de trabajo de `main` sobre
> `0d7b275`): ningún dato, fin ni destinatario nuevo; recuentos por motivo de lista cerrada y
> un enlace, sin el nombre ni el id de ningún plato. Lo único que se guarda de más son dos
> valores nuevos del tipo en `owner_alerted` y uno de la plantilla en `mail_sent`, los dos
> sin usuario ([`textos/06`](./textos/06-correos.md) § M y § N).
> Revisado otra vez el mismo día: fila 2 (proyecto 009 fase 2 — verdad una vez fusionado el
> árbol de trabajo de `main` sobre `abc0a90`): un segundo almacén de Vercel Blob, privado y
> en `fra1`, guarda hasta una imagen rechazada por plato para que el propietario la mire.
> Ningún dato personal, fin ni destinatario nuevo
> ([`imagenes-de-platos.md`](./imagenes-de-platos.md) § 4.3).
> Revisado otra vez el mismo día: fila 2 (proyecto 009 fase 3 — verdad una vez fusionados el
> árbol de trabajo de `main` sobre `fce954d` y el de `frontend`): el propietario puede
> publicar a mano una imagen que el juez rechazó, y retirarla. Ningún dato personal, fin,
> interesado ni destinatario nuevo: se mueve un fichero sin datos de nadie entre los dos
> almacenes de Vercel Blob. El rastro gana dos acciones (`picture.accepted`, con las claves
> de alérgeno que el juez señaló, y `picture.removed`), cuyo autor es el propio responsable
> ([`imagenes-de-platos.md`](./imagenes-de-platos.md) § 4.4).
> Revisado otra vez el mismo día: fila 2 **sin cambios** (proyecto 010 fase 3 — verdad una
> vez fusionado el árbol `.claude/worktrees/backend-010-3` sobre `f81e834`): la fila de
> cada plato en `recipe_images` guarda ahora lo que respondieron las dos llamadas del juez
> y su veredicto, con la receta tal como se juzgó. Son palabras de un modelo sobre una foto
> de comida hecha solo con la receta: ningún dato personal, fin, interesado, destinatario
> ni plazo nuevo que anotar (art. 30.1 solo alcanza a tratamientos de datos personales)
> ([`imagenes-de-platos.md`](./imagenes-de-platos.md) § 4.5).
>
> **No soy abogado.** Los plazos y destinatarios marcados «pendiente» dependen de
> decisiones del [`analisis.md` § 9](./analisis.md#9-riesgos-ordenados-por-lo-que-le-puede-pasar-a-una-persona-real).

**Responsable**: {name}, {email} (datos completos en el aviso legal). **DPD**: no designado.

| # | Actividad | Fines | Interesados | Categorías de datos | Destinatarios | Transferencias | Plazo de supresión | Medidas (art. 32) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Cuentas y acceso | alta, inicio de sesión, recuperación; prueba de las condiciones aceptadas | usuarios, profesionales | nombre, correo, contraseña (hash), IP y navegador de sesión, proveedor social; versión de las condiciones aceptada y fecha (**pendiente**: desde la fase 7 del 008 en producción, [nota D5](./2026-09-29-aceptacion-de-los-textos-legales.md)) | Vercel, Neon, proveedor SMTP, Google/Apple (inicio de sesión) | EE. UU. (empresas) — DPF/cláusulas tipo | cuenta; sesiones 30 días | Better Auth, límites en BD, cookies seguras; el aviso al propietario de cuenta esperando no lleva dirección, nombre, id ni enlace de activación (desde el 2026-09-29; los enviados antes, con dirección y un token de 30 días, siguen en su buzón hasta que los borre) |
| 2 | Planificación de comidas | objetivos, planes, lista de la compra, cambios | usuarios | corporales, objetivo, alergias, intolerancias, forma de comer (**salud, religión**), país (qué alimentos ofrece el catálogo, `0034`; leído desde `0067` — antes se guardaba y no se usaba), preferencias de comida y cocina (forma de las comidas, tiempo máximo de cocina, cocinas, gustos). El onboarding **ya no pide** (`0067`, prompt 4.4.0): hora de despertar y de dormir, días y hora de entrenar, notas del horario laboral, presupuesto, frecuencia de cocina, estilo de desayuno, preferencia de ración ni el objetivo personalizado en texto libre — minimización, art. 5.1.c. **A la IA solo va** (prompt 4.4.0): objetivos diarios y tipo de objetivo, forma de las comidas, tiempo máximo de cocina, vegetariano/vegano, gustos por nombre de catálogo, nombres de platos, respuestas cerradas del check-in — sin identificadores | Vercel, Neon. IA: **ninguna desde el 2026-09-26** (`stub`); tras `0064`, **OpenRouter, Inc.** (encargado) y la empresa que ejecuta el modelo, de una lista cerrada en la cuenta (DeepInfra, CoreWeave; modelos Gemma 4 31B y, de reserva, DeepSeek V4.1 Flash). **Imágenes de los platos** (006, con su flag): el dibujo y el juez no reciben datos personales (solo la receta), así que Google (Vertex) y DeepInfra no son destinatarios; las imágenes se guardan y sirven en **Vercel Blob** (`fra1`), que ve la IP y el navegador de quien las carga; desde el 009 fase 2, un segundo almacén de Vercel Blob, **privado** y en `fra1`, guarda la última imagen que el juez rechazó de un plato, sin datos personales y solo para la sesión del propietario; desde el 009 fase 3 el propietario puede publicarla a mano —pasa entonces al almacén público, como cualquier otra— y retirarla ([`imagenes-de-platos.md`](./imagenes-de-platos.md) § 4) | UE (Vercel, Neon; DPF). IA: EE. UU. — OpenRouter: cláusulas tipo de su DPA (**por obtener**, P1-11); quien ejecuta el modelo: sin garantía frente a NutrIA, petición sin identificadores (P2-11) | cuenta. En la IA: nada (retención cero); OpenRouter guarda metadatos (tokens, tiempo, coste). Las diez columnas que el onboarding ya no rellena están a `NULL` **en todas las cuentas**, incluidas las que ya las tenían, desde la migración `0043` (mismo cambio que `0067`); la baja de esas columnas y del valor `'custom'` del enum es de la entrega siguiente (ver [`analisis.md` § 4.1](./analisis.md#41-conservación) y § 9 P2-13) | puerta de alergias por código; frontera de salud; en cada petición `zdr` y `data_collection: 'deny'`; cuenta con entrenamiento apagado y ZDR; clave limitada a dos modelos y con tope; lista cerrada de proveedores ✔ (2026-09-26: cuenta y `AI_PROVIDER_ONLY`) |
| 3 | Salud declarada | mostrar, exclusión por celiaquía, aviso de supervisión | usuarios | condiciones, medicación, suplementos (**salud**) | Vercel, Neon; dietista vinculado si el usuario lo marca | UE | cuenta o retirada del consentimiento | tablas propias, fuera del prompt, redacción en logs |
| 4 | Seguimiento | adherencia, peso, check-in, recordatorios | usuarios | marcas, valoraciones, comentarios, peso, respuestas | Vercel, Neon, SMTP, push del navegador (cifrado) | EE. UU. (empresas) | cuenta | — |
| 5 | Consulta de dietistas (004) | comunicación consentida al profesional, rastro | usuarios vinculados, invitados, profesionales | los de 2-4 según el enlace; correo del invitado; rastro; colegiado | el profesional vinculado (responsable independiente) | — | enlace: cuenta; invitación: hasta que se responde, o 14 días más el barrido diario (≤ 15; si esa tarea lleva más de 26 h sin correr, aviso al propietario, [`textos/06`](./textos/06-correos.md) § K); rastro: cuenta del cliente | `withClient`, rastro, 404, acuerdo del profesional (**pendiente**) |
| 6 | Cobros | Premium y planes de consulta | usuarios de pago, profesionales | ids de Stripe, estado, periodo | Stripe / Link | EE. UU./UE — DPA de Stripe | cuenta; Stripe según ley fiscal | checkout y portal alojados por Stripe; webhook firmado |
| 7 | Métricas y errores | saber si funciona | usuarios | evento + `userId`; error y pila sin datos | Neon; Sentry (si activo) | EE. UU./UE según región de Sentry | **pendiente**: 24 meses métricas, 12 meses trabajos | sin salud; redacción de secretos; los correos al propietario (resumen y avisos de fallos, gasto y tarea callada, `0071`; imágenes de platos fallidas y proveedor de imágenes que rechaza las peticiones por pago o límite de uso, `0072`) solo llevan recuentos, códigos de lista cerrada, texto fijo y enlaces |
| 8 | Buzón de sugerencias | leer y responder | usuarios | texto libre | Neon | — | **pendiente**: 24 meses tras «atendido» | solo el propietario lo lee |
| 9 | Copias de seguridad | recuperación | todos | todo | Neon (restauración), equipo del propietario (exportación) | UE | Neon: ventana del plan (**anotar**); exportación: **30 días (pendiente)** | cifrado de la exportación **pendiente** |
