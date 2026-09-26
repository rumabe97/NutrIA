# Evaluación de impacto relativa a la protección de datos (EIPD) — NutrIA

> **Propósito**: la EIPD que exige el art. 35 RGPD, con la estructura de la guía de la
> AEPD *Gestión del riesgo y evaluación de impacto en tratamientos de datos personales*:
> descripción, necesidad y proporcionalidad, riesgos, medidas, riesgo residual, plan de
> acción y conclusión. **Audiencia**: el propietario (responsable, que la firma), el
> abogado, la AEPD si la pide. **Committed**: sí. **Mantenido por**: el agente `legal`;
> se revisa con cada cambio que mueva datos de salud y, en todo caso, cada año.
>
> **No soy abogado.** Esto es un borrador que el responsable debe revisar, completar donde
> se indica y aprobar con fecha. Una EIPD no aprobada por el responsable no cuenta.

| Campo | Valor |
| --- | --- |
| Responsable | {name} (ver `legalIdentity.ts`) |
| Tratamientos | (1) planificación de comidas con datos de salud y de creencias, con IA generativa; (2) comunicación de datos a dietistas-nutricionistas (proyecto 004) |
| Versión / fecha | 0.2 borrador, 2026-09-26 (0.1: 2026-09-25). La 0.2 revisa solo el tratamiento con IA (`0064`: OpenRouter): § 1.3, 1.4, 2, R2, R14, M3, M4, § 5 y § 6 |
| Aprobación | pendiente — firma y fecha del responsable |
| DPD | no designado (no obligatorio: [`analisis.md` § 5.2](./analisis.md#52-dpd--no-obligatorio-hoy)) |
| Por qué es obligatoria | Lista de la AEPD (art. 35.4), criterios 1, 4, 8 y 10; art. 28.2.c LOPDGDD — [`analisis.md` § 5.1](./analisis.md#51-eipd--obligatoria) |

---

## 1. Descripción sistemática del tratamiento (art. 35.7.a)

### 1.1 Naturaleza, alcance, contexto y fines

- **Fines**: (F1) calcular objetivos nutricionales y generar planes de comidas de 14 días
  seguros para las alergias declaradas; (F2) seguimiento (adherencia, peso, check-in) y
  adaptación del siguiente plan; (F3) permitir que un dietista-nutricionista elegido por el
  usuario vea y ajuste su plan (004); (F4) cobro de Premium y de planes de consulta;
  (F5) funcionamiento y seguridad (sesiones, errores, métricas).
- **Interesados**: adultos que quieren comer mejor (usuarios); dietistas-nutricionistas
  (profesionales); personas invitadas que aún no son usuarias. Posibles menores (no hay
  puerta de edad: P1-4).
- **Escala**: decenas de cuentas hoy; acceso abierto cuenta a cuenta por el propietario
  (`0017`). Ámbito: España principalmente; servicio en español e inglés.
- **Contexto**: un solo responsable persona física, sin personal; alojamiento
  *serverless* en la UE; modelos de IA de terceros; repositorio de código público.

### 1.2 Datos (ver inventario en [`analisis.md` § 1](./analisis.md#1-qué-hace-el-producto-lo-que-he-leído-no-lo-que-dicen-los-documentos))

| Categoría | Ejemplos | Art. 9 |
| --- | --- | --- |
| Identificación | nombre, correo, IP y navegador de la sesión | no |
| Corporales y objetivo | fecha de nacimiento, sexo, altura, peso, serie de peso, objetivo | sí (salud, lectura amplia) |
| Alergias e intolerancias | lista, texto libre, gravedad | sí (salud) |
| Forma de comer | sin gluten, sin lactosa, halal, kósher | sí (salud / religión) |
| Salud declarada | condiciones, medicación, suplementos | sí (salud) |
| Uso del plan | comidas hechas o saltadas, valoraciones, comentarios, check-ins | puede contener salud |
| Relación asistencial (004) | enlace, versión del consentimiento, rastro de accesos | revela que la persona es paciente de un dietista |
| Profesional | número de colegiado, concesión, aceptación del acuerdo | no |
| Pago | id de cliente y suscripción en Stripe, estado | no |

### 1.3 Ciclo de vida

1. **Captura**: onboarding y perfil (el usuario), invitación (el profesional teclea un
   correo), check-in y marcas diarias (el usuario), objetivos y planes (el profesional).
2. **Almacenamiento**: PostgreSQL en Neon (`eu-central-1`); copia de restauración de Neon;
   exportación manual en el equipo del propietario.
3. **Uso**: cálculo determinista de objetivos (`packages/core/domain/Nutrition`),
   generación con IA (prompt 4.1.0 sin identificadores, salud ni texto libre, § 1.3 del
   análisis; desde el 2026-09-26 ninguna llamada, `stub`; tras `0064`, OpenRouter),
   comprobación
   determinista de alergias (`findSafetyViolations`), acceso del profesional por
   `CareController.withClient` con fila de rastro.
4. **Cesión/comunicación**: al profesional vinculado; a OpenRouter y a la empresa que
   ejecuta el modelo (tras `0064`); a Stripe; al proveedor de correo; a Sentry (sin datos
   personales).
5. **Borrado**: en cascada al borrar la cuenta; invitaciones a los 14 días; salud al
   retirar el consentimiento; sin purga para métricas y trabajos de generación.

### 1.4 Activos y encargados

Vercel (cómputo, `fra1`), Neon (base de datos, UE), OpenRouter (EE. UU., encargado, tras
`0064`) y la empresa que ejecuta el modelo (EE. UU.; propuesta: DeepInfra o CoreWeave,
lista cerrada en la cuenta — P1-12), Google (correo SMTP), Stripe/Link, Sentry
(opcional), servicios push de navegador. Equipo del propietario (credenciales,
exportaciones). La pasarela OmniRoute ya no está en producción (solo experimentos).

---

## 2. Necesidad y proporcionalidad (art. 35.7.b)

| Pregunta | Respuesta |
| --- | --- |
| ¿Base legítima? | Sí, con los cambios del [`analisis.md` § 3](./analisis.md#3-bases-jurídicas-y-excepción-del-art-9): consentimiento explícito (9.2.a) para todos los datos de salud y creencias; hoy falta para alergias y datos corporales (**P0-2**). |
| ¿Fines determinados y limitados? | Sí. No hay publicidad, venta ni perfiles para terceros. |
| ¿Minimización? | Buena en el diseño: la medicación no tiene dosis porque nada la usaría; la IA no recibe identificadores ni salud declarada; el profesional no ve alergias, correo ni comentarios; el rastro no guarda la carga. **Excesos**: ~~texto libre de alergias y comentarios del check-in hacia la IA~~ (quitados en el prompt 4.0.0, P0-3); «Halal»/«Kosher» como etiqueta en vez de restricción (P2-1). |
| ¿Exactitud? | El usuario corrige desde su perfil; los objetivos anulados se revalidan en cada lectura. |
| ¿Limitación del plazo? | Parcial: cascada completa al borrar; faltan plazos para métricas y trabajos (P2-4) y para la exportación manual (P1-6). |
| ¿Información? | Insuficiente hoy (P1-2, P1-3, P1-5); textos nuevos en `textos/`. |
| ¿Derechos? | Acceso, rectificación, supresión en el producto; portabilidad por correo (P2-9); retirada de la salud compartida con el profesional sin terminar el enlace: **no existe** (P0-1). |
| ¿Transferencias? | A EE. UU.; DPF (Vercel, Neon vía Databricks, Stripe, Sentry: verificado 2026-09-26) o cláusulas tipo (OpenRouter, en su DPA — P1-11). Las empresas que ejecutan el modelo no tienen garantía propia frente a NutrIA: la petición no identifica a nadie ([`analisis.md` § 4.2 y § 4.4](./analisis.md#42-transferencias-internacionales-arts-44-49)). |
| ¿Hay una alternativa menos intrusiva? | Para la IA: hecho las dos — el prompt ya no lleva texto libre, salud ni creencias (4.0.0) y el cambio de `0064` lleva a modelos de pago sin entrenamiento ni retención. La menos intrusiva de todas es la actual (`stub`, ningún modelo), a costa de platos nuevos; un proveedor con contrato directo en la UE (Mistral) cerraría P2-11. Para el 004: ya se comparte lo mínimo; la salud va en línea aparte. |

---

## 3. Riesgos para los derechos y libertades (art. 35.7.c)

Probabilidad (P) e impacto (I) de 1 (bajo) a 4 (muy alto); riesgo = P × I. **Inherente**
es antes de las medidas; **residual**, después de las medidas del § 4 ya implantadas **y**
de las pendientes marcadas.

| # | Amenaza | Daño a la persona | P | I | Inherente | Medidas (§ 4) | Residual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Un plato con un alérgeno declarado llega al plan | Reacción alérgica, anafilaxia | 3 | 4 | **12** | M1, M2 | 4 (el texto libre no resuelto sigue siendo «mejor esfuerzo» y el usuario lo sabe) |
| R2 | Datos enviados a la IA reutilizados por un proveedor para entrenar o guardados | Pérdida de control; exposición de preferencias y objetivos (ya no de alergias, creencias ni comentarios: prompt 4.0.0) | 4 hasta el 2026-09-25; 1 desde el 2026-09-26 (`stub`) | 3 → 2 (prompt 4.x) | **12** → 2 | M3, M4 | 2 con M3 (categorización anónima de OpenRouter, P2-12) |
| R14 | La petición a la IA acaba en una empresa o un país que la política no nombra (p. ej. un endpoint en Indonesia) | Transferencia sin garantía; información falsa | 3 con la cuenta sin lista cerrada | 2 | 6 | M3 (lista cerrada, **pendiente P1-12**) | 1 |
| R3 | Un profesional ve datos de alguien que no aceptó, o después de terminar | Revelación de salud a un tercero | 2 | 4 | 8 | M5, M6, M7 | 2 |
| R4 | Un profesional usa lo que ve fuera de la asistencia (difusión, publicidad) | Revelación; discriminación | 2 | 4 | 8 | M8 (**acuerdo pendiente**), M7 | 4 |
| R5 | Una persona comparte su salud con el profesional sin saberlo o no puede dejar de hacerlo | Consentimiento viciado; pérdida de control | 3 hoy | 3 | 9 | M9 (**pendiente**) | 2 |
| R6 | Un menor obtiene un plan de adelgazamiento | Daño a la salud de un menor; consentimiento inválido | 2 | 4 | 8 | M10 (**pendiente**) | 2 |
| R7 | Acceso no autorizado a la base de datos o a la exportación | Brecha masiva de datos de salud | 2 | 4 | 8 | M11, M12 (**cifrado pendiente**) | 3 |
| R8 | Robo de sesión o de cuenta (incluida la de un profesional con varios pacientes) | Revelación de salud de varias personas | 2 | 4 | 8 | M13 | 3 |
| R9 | Datos de salud en registros, errores o correos | Revelación accidental | 2 | 3 | 6 | M14 | 1 |
| R10 | La invitación revela a un tercero que alguien tiene cuenta o es paciente | Revelación de la relación asistencial | 2 | 3 | 6 | M15 | 1 |
| R11 | Un plan que no es seguro por calorías o proteína (IA o profesional) | Daño a la salud | 2 | 3 | 6 | M16 | 2 |
| R12 | El usuario cree que NutrIA sustituye a un profesional | Decisiones de salud mal informadas | 2 | 3 | 6 | M17 | 3 |
| R13 | Imposibilidad de ejercer derechos (portabilidad, limitación) | Pérdida de control | 2 | 2 | 4 | M18 (**exportación pendiente**) | 2 |

---

## 4. Medidas (art. 35.7.d)

| # | Medida | Estado |
| --- | --- | --- |
| M1 | Alergias aplicadas por código comparando ids (`findSafetyViolations`), antes de guardar y antes de devolver; `SafetyController.getSafetyProfile` único ensamblador | ✔ |
| M2 | Texto libre no resuelto declarado «mejor esfuerzo» al usuario; plato con ingredientes sin resolver rechazado | ✔ |
| M3 | Solo proveedores de IA con contrato de encargo, sin entrenamiento, retención cero, garantía de transferencia; y no enviar texto libre ni etiquetas religiosas | Texto libre y etiquetas: ✔ (4.0.0). Producción sin modelo desde el 2026-09-26 ✔. Para el cambio (`0064`): código ✔ (`NO_TRAINING_PROVIDER`: `zdr`, `data_collection: 'deny'` en cada petición); cuenta y clave (entrenamiento off, ZDR, dos modelos, tope) — propietario; **pendientes**: DPA de OpenRouter en la mano (P1-11) y lista cerrada de proveedores (P1-12) |
| M4 | La IA no recibe identificadores ni salud declarada; test de frontera `health-boundary.spec.ts`; sin cabecera de sesión hacia OpenRouter (`resolveCallSettings`); registro de prompts de OpenRouter apagado | ✔ (el registro de prompts: propietario, al configurar la cuenta) |
| M5 | Acceso solo por `withClient` (id de enlace, sesión, estado `active`), denegación 404, sin caché | ✔ |
| M6 | Invitación de un solo uso, hash, 14 días, correo de la sesión debe coincidir | ✔ |
| M7 | Rastro visible para el cliente de cada lectura y escritura | ✔ |
| M8 | Acuerdo del profesional aceptado y versionado antes de abrir la consulta; retirada de la concesión por incumplimiento | **pendiente (P1-1)** |
| M9 | Línea de salud separada, desmarcada por defecto, **retirable sin terminar el enlace**, texto verdadero | separada ✔; retirable y texto **pendiente (P0-1)** |
| M10 | Puerta de edad (18, decisión del propietario de 2026-09-25) en el servidor | **pendiente (P1-4)** |
| M11 | Solo `apps/api` abre conexión; propiedad por `WHERE userId`; sesión re-leída en cada petición | ✔ |
| M12 | Exportación manual cifrada, en disco cifrado, borrada a los 30 días | **pendiente (P1-6)** |
| M13 | Better Auth: contraseñas con hash, límite de intentos en base de datos, vinculación estricta de cuentas, revocar sesiones al resetear, cookies `httpOnly`/`secure`/`lax` | ✔ |
| M14 | Redacción pino de campos de salud; Sentry sin cuerpo, usuario ni cabeceras; correos sin palabras de salud | ✔ |
| M15 | La ruta de invitación responde igual exista o no la cuenta; correo en segundo plano | ✔ |
| M16 | Suelo de calorías y techo de proteína aplicados por código a cualquier objetivo, también al del profesional (`targetViolations`) | ✔ |
| M17 | Avisos de supervisión y descargos; «no usuario» para nutrición clínica | ✔ (texto enlazado mejorable, `05` § E) |
| M18 | Exportación de datos en JSON | **pendiente (P2-9)** |

---

## 5. Riesgo residual y consulta previa (art. 36)

- **Con las medidas pendientes implantadas**, ningún riesgo residual queda en nivel alto
  (≥ 9): la EIPD concluye que el tratamiento **puede** realizarse sin consulta previa a la
  AEPD.
- **Sin M3, M8 y M9**, R2 (12), R4 y R5 (9 hoy) quedan altos. **Con esos riesgos residuales
  altos no se debe encender el flag `professional`**. R2 ya no afecta a producción desde
  el 2026-09-26 (`stub`); **no se debe poner `AI_PROVIDER=openrouter` sin M3 completa**
  (P1-11 y P1-12): R14 subiría y la política diría algo falso.

## 6. Plan de acción

| Orden | Medida | Quién | Antes de |
| --- | --- | --- | --- |
| 1 | M3 — DPA de OpenRouter (P1-11) y lista cerrada de proveedores (P1-12); licencia de MiniMax (P1-13) | propietario (cuenta de OpenRouter) + backend (`provider.only`) | el cambio a `openrouter` |
| 2 | Consentimiento explícito del perfil (P0-2) | backend + frontend | ya (producción) |
| 3 | M9 — retirar salud del enlace + textos | backend + frontend | flag `professional` |
| 4 | M8 — acuerdo del profesional | backend + frontend | flag `professional` |
| 5 | M10 — edad | backend + frontend | ya |
| 6 | M12 — exportación cifrada | propietario | la próxima exportación |
| 7 | Textos de `textos/` | frontend | flag `professional` / claves *live* |
| 8 | M18, purgas | backend | revisión anual |

## 7. Aprobación

El responsable declara haber revisado esta evaluación y asumido el plan de acción.

Fecha: __________ Firma: __________ (fuera del repositorio: la firma no se publica)
