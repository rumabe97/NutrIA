# Registro de actividades de tratamiento (art. 30 RGPD)

> **Propósito**: el registro que el art. 30.1 exige al responsable. La excepción del
> art. 30.5 (menos de 250 personas) **no aplica**: el tratamiento no es ocasional e incluye
> categorías especiales del art. 9.1. **Audiencia**: el propietario; la AEPD si lo pide
> (art. 30.4). **Committed**: sí. **Mantenido por**: el agente `legal`; se actualiza en el
> mismo cambio que añada un dato, un destinatario o un fin.
>
> **No soy abogado.** Los plazos y destinatarios marcados «pendiente» dependen de
> decisiones del [`analisis.md` § 9](./analisis.md#9-riesgos-ordenados-por-lo-que-le-puede-pasar-a-una-persona-real).

**Responsable**: {name}, {email} (datos completos en el aviso legal). **DPD**: no designado.

| # | Actividad | Fines | Interesados | Categorías de datos | Destinatarios | Transferencias | Plazo de supresión | Medidas (art. 32) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Cuentas y acceso | alta, inicio de sesión, recuperación | usuarios, profesionales | nombre, correo, contraseña (hash), IP y navegador de sesión, proveedor social | Vercel, Neon, proveedor SMTP, Google/Apple (inicio de sesión) | EE. UU. (empresas) — DPF/cláusulas tipo | cuenta; sesiones 30 días | Better Auth, límites en BD, cookies seguras |
| 2 | Planificación de comidas | objetivos, planes, lista de la compra, cambios | usuarios | corporales, objetivo, alergias, intolerancias, forma de comer (**salud, religión**), preferencias, horarios | Vercel, Neon, proveedores de IA (sin identificadores) | EE. UU. (IA) — **pendiente** de garantía (P0-3) | cuenta | puerta de alergias por código; frontera de salud; *No-Log* en pasarela |
| 3 | Salud declarada | mostrar, exclusión por celiaquía, aviso de supervisión | usuarios | condiciones, medicación, suplementos (**salud**) | Vercel, Neon; dietista vinculado si el usuario lo marca | UE | cuenta o retirada del consentimiento | tablas propias, fuera del prompt, redacción en logs |
| 4 | Seguimiento | adherencia, peso, check-in, recordatorios | usuarios | marcas, valoraciones, comentarios, peso, respuestas | Vercel, Neon, SMTP, push del navegador (cifrado) | EE. UU. (empresas) | cuenta | — |
| 5 | Consulta de dietistas (004) | comunicación consentida al profesional, rastro | usuarios vinculados, invitados, profesionales | los de 2-4 según el enlace; correo del invitado; rastro; colegiado | el profesional vinculado (responsable independiente) | — | enlace: cuenta; invitación: hasta que se responde, o 14 días más el barrido diario (≤ 15); rastro: cuenta del cliente | `withClient`, rastro, 404, acuerdo del profesional (**pendiente**) |
| 6 | Cobros | Premium y planes de consulta | usuarios de pago, profesionales | ids de Stripe, estado, periodo | Stripe / Link | EE. UU./UE — DPA de Stripe | cuenta; Stripe según ley fiscal | checkout y portal alojados por Stripe; webhook firmado |
| 7 | Métricas y errores | saber si funciona | usuarios | evento + `userId`; error y pila sin datos | Neon; Sentry (si activo) | EE. UU./UE según región de Sentry | **pendiente**: 24 meses métricas, 12 meses trabajos | sin salud; redacción de secretos |
| 8 | Buzón de sugerencias | leer y responder | usuarios | texto libre | Neon | — | **pendiente**: 24 meses tras «atendido» | solo el propietario lo lee |
| 9 | Copias de seguridad | recuperación | todos | todo | Neon (restauración), equipo del propietario (exportación) | UE | Neon: ventana del plan (**anotar**); exportación: **30 días (pendiente)** | cifrado de la exportación **pendiente** |
