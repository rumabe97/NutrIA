# Checklist de activación

> **Propósito**: lo que tiene que ser verdad antes de encender el flag `professional` y
> antes de poner claves *live* de Stripe. Cada casilla remite al hallazgo del
> [`analisis.md` § 9](./analisis.md#9-riesgos-ordenados-por-lo-que-le-puede-pasar-a-una-persona-real).
> **Audiencia**: el propietario y el lead. **Committed**: sí. **Mantenido por**: el agente
> `legal`.
>
> **No soy abogado.** Esta lista no sustituye la hora con uno: la última casilla de cada
> bloque es esa hora.

## 0. Ya, con independencia de cualquier flag (afecta a producción)

> Marcadas: hechas en la tanda legal-a (backend `1a3742b`, frontend `d036c40`), revisadas contra el código el 2026-09-25; cuentan cuando se fusionen juntas y se aplique la migración `0039`. P0-3 queda cerrada en lo sustancial (ver `analisis.md` § 9).

- [x] **P0-3** — La combinación de modelos solo con proveedores sin entrenamiento y con contrato (o sin texto libre ni etiquetas religiosas en el prompt). El propietario anota qué modelos sirven hoy.
- [x] **P0-2** — Consentimiento explícito del perfil construido, pedido también a las cuentas existentes ([`textos/05`](./textos/05-consentimientos-cliente.md) § A).
- [x] **P1-4** — Puerta de edad (**18**, decisión del propietario de 2026-09-25) en el servidor. Comprobar en la base de datos si hay cuentas con menos de 18 años: con menos de 14, P0 (su consentimiento de salud no vale: borrar sus datos de salud y avisar); de 14 a 17, avisar de que el servicio pasa a ser para mayores de edad y cerrar la cuenta con tiempo para que se lleven sus datos.
- [ ] **P1-6** — Exportaciones manuales cifradas, en disco cifrado, borradas a los 30 días; las antiguas sin cifrar, borradas.
- [ ] **EIPD** revisada y firmada por el propietario ([`eipd.md`](./eipd.md) § 7).
- [ ] Política de privacidad nueva publicada solo con las frases cuyo ⟦requisito⟧ se cumple ([`textos/02`](./textos/02-politica-privacidad.md)); correo de aviso de cambio enviado antes ([`textos/06`](./textos/06-correos.md) § F).

## 0 bis. Antes de poner `AI_PROVIDER=openrouter` en producción (`0064`)

> Producción corre con `AI_PROVIDER=stub` desde el 2026-09-26: no sale nada a ningún
> modelo. Estas casillas son del propietario salvo donde se dice. Detalle y fuentes en
> [`analisis.md` § 4.4](./analisis.md#44-openrouter-y-quien-ejecuta-el-modelo-2026-09-26-para-el-cambio-de-0064).

**Ya, aunque no se cambie nada**
- [ ] `/privacidad` con el **estado 1** de «La inteligencia artificial», «Con quién compartimos» y «Transferencias» ([`textos/02`](./textos/02-politica-privacidad.md)): el texto en vivo dice que «hoy» se usan modelos gratuitos que pueden entrenar, y desde el 2026-09-26 no se usa ninguno (frontend).

**Contrato y cuenta — bloquean el cambio**
- [ ] **P1-11** — DPA de OpenRouter: pedir acceso en `trust.openrouter.ai`, descargar el DPA y la lista de subencargados; pedir a soporte, por escrito, que confirme que el DPA que su § 10.2 incorpora «for commercial, for-profit purposes» se aplica a esta cuenta de pago y que incluye las cláusulas tipo. Guardar ambos, con fecha, fuera del repositorio. Si la respuesta es que no: parar y volver a `legal`.
- [x] **P1-12** — Hecho el 2026-09-26 (propietario): en la cuenta (ajustes de privacidad), *Allowed providers* = DeepInfra y CoreWeave. Pendiente solo la comprobación de después: Comprobar después en `/api/v1/models/deepseek/deepseek-v4.1-flash/endpoints` y en `/admin` que las primeras llamadas las responden solo esas. Si se permite otra empresa, se nombra en la política antes.
- [ ] Ajustes del runbook [`ai-gateway.md` § 0](../reference/ai-gateway.md): entrenamiento **apagado** para modelos de pago y gratuitos; ZDR **encendido** para toda la cuenta; «OpenRouter use of inputs/outputs» **apagado**; registro de prompts (*logging*) **apagado**; la clave con solo los dos modelos, ZDR y tope mensual. Una captura de cada ajuste, fechada, fuera del repositorio (art. 5.2: poder demostrarlo).
- [x] **P1-13** — Cerrado el 2026-09-26: el propietario quitó MiniMax M3; Gemma 4 31B (`google/gemma-4-31b-it`) es el principal y DeepSeek V4.1 Flash la reserva (decisión del 2026-09-26); Gemma es Apache 2.0, sin aviso, atribución ni restricciones que trasladar (`analisis.md` § 4.4 d). La clave debe admitir ese modelo y no `:free`.
- [x] (backend) `provider.only` en cada petición desde `AI_PROVIDER_ONLY`, obligatorio al arrancar con `openrouter` (`apps/api/src/config/Env.validation.ts:506-507`). Valor: `deepinfra,coreweave`.
- [x] **P2-12** — Decidido el 2026-09-26: el propietario acepta la categorización anónima con aviso en la política (estado 2).
- [ ] El propietario pide por escrito a OpenRouter que excluya su cuenta de la categorización y guarda la respuesta fuera del repositorio. No bloquea: si la excluye, la frase de la política puede quitarse.

**Textos — en este orden**
1. [ ] `/privacidad` con el **estado 2** (frontend), con `updated` nuevo, cuando las casillas anteriores estén marcadas.
2. [ ] El mismo día, el correo [`textos/06`](./textos/06-correos.md) § G a cada cuenta (la política vigente promete avisar por correo antes de un cambio importante).
3. [ ] `AI_PROVIDER=openrouter` **no antes del día siguiente** al correo.

**Después**
- [ ] En la primera quincena, mirar en `/admin` qué proveedor respondió cada llamada; uno que no esté en la lista es un incidente (el texto sería falso): volver a `stub` y registrarlo ([`procedimiento-brechas.md`](./procedimiento-brechas.md) § 8).
- [ ] Cada cambio de `AI_MODEL`, `AI_FALLBACK_MODELS` o de la lista de proveedores permitidos pasa antes por la política.

## 1. Antes de encender `professional`

**Código**
- [ ] **P0-1** — El cliente puede activar y desactivar la línea de salud desde su perfil sin terminar el enlace; cada cambio deja fila en el rastro; desactivar cierra el acceso en la siguiente petición. Test de extremo a extremo que la retira a mitad de sesión.
- [ ] **P1-1** — Aceptación del profesional: `PROFESSIONAL_AGREEMENT_VERSION`, columnas en `professionals`, `ProfessionalGuard` la exige, `POST /care/practice/agreement`, pantalla en `/consulta` ([`analisis.md` § 11](./analisis.md#11-lo-que-hay-que-construir-para-el-004-y-quién)). Test: un profesional sin aceptar recibe 404 en toda ruta de clientes y en la compra.
- [ ] **P1-3** — Página de invitación con los textos nuevos; `CARE_CONSENT_VERSION = '2.0.0'`; ningún enlace real aceptado con `1.0.0`.
- [ ] **P1-2** — Correo de invitación con el párrafo del art. 14.
- [ ] Correo de alta al profesional ([`textos/06`](./textos/06-correos.md) § B).
- [x] **P1-10 — cerrado** (2026-09-26): producción no usa ningún modelo (`stub`) y el cambio de `0064` no tiene Gemini (la clave solo admite Gemma 4 31B y DeepSeek V4.1 Flash, sin cláusula de uso clínico; Gemma 4 no es la API de Gemini). Se reabre si vuelve `AI_PROVIDER=google` o un modelo de Google a la clave.
- [ ] `HEALTH_CONSENT_VERSION = '1.1.0'` con la nota precisada (`05` § C).

**Textos**
- [ ] Acuerdo del profesional y condiciones de consulta en `practiceAgreement` (es y en), con `{name}`/`{email}` y sin identidad en el diccionario.
- [ ] Política con la sección «Tu dietista en NutrIA» y el reparto de responsabilidades visible (art. 26.2, por si acaso).
- [ ] Condiciones de uso § F y § G.

**Organización**
- [ ] El propietario comprueba cada número de colegiado en el registro público del colegio correspondiente antes de conceder, y anota la fecha de la comprobación.
- [ ] **Procedimiento de brechas** — escrito en [`procedimiento-brechas.md`](./procedimiento-brechas.md). Se marca cuando el propietario haya rellenado fuera del repositorio cada ⟦…⟧ (§ 9: acceso a la sede de la AEPD, cuentas de los proveedores, dispositivos, pasarela, dónde vive el registro) y lo haya **firmado y fechado**.
- [ ] Hora con el abogado: puntos 1, 3 y 9 del [`analisis.md` § 10](./analisis.md#10-confirmar-con-un-abogado).

**Orden de encendido** (decisión del lead, 2026-09-25: primero el interruptor, después las concesiones — el correo de alta enlaza a `/consulta`, que solo funciona con el interruptor encendido, y un interruptor sin concesiones no enseña nada a nadie)

1. [ ] **Recuento de enlaces con el consentimiento antiguo**: el lead ejecuta en producción, **solo lectura**, el número de `care_links` con `consentVersion = '1.0.0'` (por estado: `active`, `paused`, `ended`). No se lee nada más de esas filas.
2. [ ] **El propietario decide sobre ellos** antes de encender: un enlace `1.0.0` se aceptó con una invitación que prometía un control que no existía (P0-1) y no decía que el profesional podía escribir y retener planes (P1-3). Lo recomendable es terminar los `active`/`paused` (`endedBy = professional` si son pruebas del propio propietario) y volver a invitar con la versión `2.0.0`; conservar un `1.0.0` activo es tratar datos de salud con un consentimiento no informado. Los `ended` se quedan: son la prueba de lo que se consintió. Anotar la decisión y la fecha.
3. [ ] Todo lo anterior de este § 1 marcado, en particular P1-1: la aceptación del acuerdo tiene que estar en producción **antes** de que exista la primera concesión, para que nadie vea un dato sin haber aceptado.
4. [ ] **Encender el interruptor `professional`** en `/admin`. Sin concesiones, nadie ve nada nuevo.
5. [ ] **Conceder** a cada profesional, uno a uno, tras comprobar su número de colegiado (casilla de «Organización»). La concesión envía el correo de alta, y su enlace a `/consulta` lleva al acuerdo antes que a nada.

## 2. Antes de claves *live* de Stripe (Premium y consulta)

**Identidad y alta**
- [ ] Alta censal (036) y, si procede, RETA — con un gestor.
- [ ] `legalIdentity.ts` con `address`, `taxId`, `phone`, rellenado por el propietario; decidido si el domicilio es el personal o uno profesional.
- [ ] **P1-7** — Página `/aviso-legal` publicada ([`textos/07`](./textos/07-aviso-legal.md)) y enlazada en el pie; cauce de reclamaciones postal, telefónico y electrónico, con justificante y respuesta en 15 días (TRLGDCU art. 21.2-3).
- [ ] Decidido *Managed Payments* sí o no (Link como vendedor), con el gestor y el abogado; los textos usan la variante que toca.

**Consumidor (Premium)**
- [ ] **P1-8** — Condiciones con el desistimiento y el formulario modelo; botón «Desistir del contrato aquí» durante 14 días; acuse inmediato por correo ([`textos/06`](./textos/06-correos.md) § C); reembolso en 14 días.
- [ ] **P2-7** — Aviso de renovación anual 15 días antes (Stripe o plantilla propia).
- [ ] **P2-6** — Checkout con aceptación de condiciones (`consent_collection.terms_of_service`) y URLs de condiciones y privacidad en los ajustes de Checkout de Stripe.
- [ ] El precio mostrado antes de pagar incluye impuestos y el total por periodo (TRLGDCU art. 97.1.e); el botón final de Stripe deja claro que hay obligación de pago (art. 98.2) — revisar el rótulo con prueba gratuita **[abogado]**.
- [ ] **P2-2** — Se guarda la versión de las condiciones aceptada al registrarse.

**Profesional (consulta)**
- [ ] **P1-9** — Condiciones de consulta aceptadas antes de pagar (misma pantalla que el acuerdo); `practice.planTrial` dice que se cobra al terminar la prueba.
- [ ] Recogida de datos fiscales para factura (`tax_id_collection`) si el gestor lo pide.

**Hora con el abogado**
- [ ] Puntos 4, 5, 6 y 7 del [`analisis.md` § 10](./analisis.md#10-confirmar-con-un-abogado).

## 3. Con fecha

- [ ] **2/12/2026** — Art. 50.2 Ley de IA: recetas marcadas como generadas por IA en formato legible por máquina (P2-8).
- [ ] Cada año, o al superar unos miles de cuentas con salud — revisar EIPD, RAT y la necesidad de DPD.
