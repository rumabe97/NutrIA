# Legal — NutrIA

> **Esto no es asesoramiento jurídico.** Lo ha escrito un agente, no un abogado. Cada
> afirmación cita el artículo y la versión consolidada en que se apoya para que el
> propietario —o el abogado al que se lo enseñe— pueda comprobarla. Donde una cuestión
> depende de una interpretación, el texto lo dice y la lleva a la lista
> [«confirmar con un abogado»](./analisis.md#10-confirmar-con-un-abogado).
>
> **Propósito**: supervisar NutrIA frente al derecho español y de la UE en vigor a
> 2026-09-25 y dejar redactados los textos que el producto necesita.
> **Audiencia**: el propietario, un abogado, y los agentes `frontend`/`backend`, que
> pegan los textos y construyen lo que falta. **Committed**: sí — el repositorio es
> **público**: aquí no hay nombres, correos, NIF ni direcciones; la identidad vive solo
> en `apps/web/src/i18n/legalIdentity.ts` y los textos usan sus marcadores (`{name}`,
> `{email}` y los nuevos que propone [`textos/07-aviso-legal.md`](./textos/07-aviso-legal.md)).
> **Mantenido por**: el agente `legal`; lo aprueban el propietario y el abogado.

## El mapa

| Documento | Qué es |
| --- | --- |
| [`analisis.md`](./analisis.md) | El análisis: roles por flujo, bases jurídicas, art. 9, conservación, transferencias, EIPD y DPD, el propietario como persona física, la Ley de IA, accesibilidad, la lista de riesgos ordenada y la lista para el abogado. **Empieza aquí.** |
| [`eipd.md`](./eipd.md) | La evaluación de impacto (art. 35 RGPD), con la estructura del modelo de la AEPD. Es obligatoria. |
| [`registro-actividades.md`](./registro-actividades.md) | El registro de actividades de tratamiento (art. 30 RGPD). Obligatorio: la excepción del art. 30.5 no se aplica a quien trata datos de salud. |
| [`procedimiento-brechas.md`](./procedimiento-brechas.md) | Qué hacer ante una brecha de datos personales: contener, guardar pruebas, decidir en 72 horas, notificar a la AEPD, avisar a los afectados y registrar (arts. 33 y 34 RGPD). |
| [`checklist-activacion.md`](./checklist-activacion.md) | Lo que tiene que ser verdad antes de encender el flag `professional`, y antes de poner las claves *live* de Stripe. |
| [`textos/01-acuerdo-profesional.md`](./textos/01-acuerdo-profesional.md) | Lo que el dietista-nutricionista acepta antes de que `/consulta` se abra: secreto, roles, seguridad, qué pasa con los datos, usos prohibidos. Con su almacenamiento y su versión. |
| [`textos/02-politica-privacidad.md`](./textos/02-politica-privacidad.md) | La política de privacidad completa, sustituyendo a la actual, con el proyecto 004 dentro. |
| [`textos/03-condiciones-uso.md`](./textos/03-condiciones-uso.md) | Cambios en las condiciones de uso (Premium, desistimiento, formulario, edad). |
| [`textos/04-condiciones-consulta.md`](./textos/04-condiciones-consulta.md) | Las condiciones del plan de consulta (B2B): precio, prueba, renovación, cancelación, pausa. |
| [`textos/05-consentimientos-cliente.md`](./textos/05-consentimientos-cliente.md) | El consentimiento de salud del registro (nuevo), la invitación y su página, y el fin del enlace. Sube `CARE_CONSENT_VERSION` y `HEALTH_CONSENT_VERSION`. |
| [`textos/06-correos.md`](./textos/06-correos.md) | Correos con efecto jurídico: la invitación, el alta del profesional, el acuse de desistimiento, el aviso de renovación anual, el aviso de cambio de condiciones y el del cambio de proveedor de IA. |
| [`textos/07-aviso-legal.md`](./textos/07-aviso-legal.md) | El aviso legal que exige el art. 10 LSSI y los datos que el art. 97 TRLGDCU pide antes de vender. |

## Cómo se leen los textos

Cada texto dice **dónde va** (clave de diccionario, pantalla o plantilla de correo),
está en español (fuente de verdad) y en inglés cuando el producto lo muestra en inglés,
y cada cláusula va seguida de un comentario HTML `<!-- Fuente: … -->` que la página no
muestra. Cuando un texto que alguien ya aceptó cambia, el documento dice qué constante de
versión hay que subir.

Los textos son **borradores para el producto**: `frontend` los pega en los diccionarios,
`backend` guarda las aceptaciones, el lead publica. Ninguno está en producción por
estar aquí.

## Fuentes primarias usadas (versión consultada)

- RGPD — Reglamento (UE) 2016/679, texto del DOUE en BOE (`DOUE-L-2016-80807`).
- LOPDGDD — LO 3/2018, BOE-A-2018-16673, consolidada a 27/12/2025.
- LSSI-CE — Ley 34/2002, BOE-A-2002-13758, consolidada a 23/01/2025.
- TRLGDCU — RDLeg. 1/2007, BOE-A-2007-20555, consolidada a 28/02/2026.
- Ley 10/2025, de servicios de atención a la clientela, BOE-A-2025-26698 (modifica el art. 97.1.p TRLGDCU).
- Directiva (UE) 2023/2673 (función de desistimiento, art. 11 bis Directiva 2011/83), `DOUE-L-2023-81696`.
- Ley 41/2002 (autonomía del paciente), BOE-A-2002-22188, consolidada a 01/03/2023.
- Ley 44/2003 (profesiones sanitarias), BOE-A-2003-21340, consolidada a 05/06/2021.
- Reglamento (UE) 2024/1689 (Ley de IA), `DOUE-L-2024-81079`, y su modificación por el Reglamento (UE) 2026/1744 («Ómnibus digital sobre IA»), `DOUE-L-2026-81147`.
- Ley 11/2023 (accesibilidad de productos y servicios), BOE-A-2023-11022.
- AEPD — Listas de tratamientos que requieren (art. 35.4) y que no requieren (art. 35.5) EIPD.
- CEPD — Directrices 07/2020 sobre responsable y encargado, versión 2.0 (en español).
- TJUE — C-184/20 *OT* (1/8/2022) y C-21/23 *Lindenapotheke* (4/10/2024), sobre el alcance de «datos de salud».
- Código Deontológico de la profesión de Dietista-Nutricionista, CGCODN, aprobado el 22/12/2021.
- Condiciones de proveedores: Gemini API Additional Terms (en vigor 23/03/2026), OpenCode Zen (privacidad de modelos gratuitos), Stripe Managed Payments (documentación consultada el 25/09/2026).
- Proveedores de IA para el cambio de `0064`, leídos el 26/09/2026: OpenRouter — condiciones (31/08/2026), política de privacidad (31/08/2026), *Enterprise Access Agreement* con su DPA (22/06/2026), documentación de ZDR, *Data collection* y *provider routing*, lista de subencargados (`trust.openrouter.ai`; espejo `sub-processors.com`, 20/03/2026) y su API pública (`/api/v1/endpoints/zdr`, `/api/v1/providers`, `/api/v1/models/…/endpoints`); DeepInfra — condiciones (17/08/2026), privacidad (15/08/2026), documentación de privacidad; CoreWeave — privacidad (24/02/2026), DPA, política de uso aceptable; Together — condiciones y privacidad (17/12/2025); licencias en Hugging Face de DeepSeek V4.1 Flash (MIT) y MiniMax M3 (*MiniMax Community License*, ya fuera); Gemma 4 31B — ficha en Hugging Face (Apache 2.0, 20/07/2026), `ai.google.dev/gemma/docs/gemma_4_license`, *Gemma Terms of Use* (01/04/2026, excluyen Gemma 4) y *Gemma Prohibited Use Policy* (21/02/2024); Gemini API Additional Terms (23/03/2026), otra vez, para corregir el § 1.3.
- Lista oficial del Marco de Privacidad de Datos UE-EE. UU. (`dataprivacyframework.gov`, consultada por su API el 26/09/2026).
- TJUE — C-413/23 P *CEPD c. JUR* (4/9/2025), sobre datos seudonimizados y el deber de informar del destinatario.
