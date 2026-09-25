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

## 1. Antes de encender `professional`

**Código**
- [ ] **P0-1** — El cliente puede activar y desactivar la línea de salud desde su perfil sin terminar el enlace; cada cambio deja fila en el rastro; desactivar cierra el acceso en la siguiente petición. Test de extremo a extremo que la retira a mitad de sesión.
- [ ] **P1-1** — Aceptación del profesional: `PROFESSIONAL_AGREEMENT_VERSION`, columnas en `professionals`, `ProfessionalGuard` la exige, `POST /care/practice/agreement`, pantalla en `/consulta` ([`analisis.md` § 11](./analisis.md#11-lo-que-hay-que-construir-para-el-004-y-quién)). Test: un profesional sin aceptar recibe 404 en toda ruta de clientes y en la compra.
- [ ] **P1-3** — Página de invitación con los textos nuevos; `CARE_CONSENT_VERSION = '2.0.0'`; ningún enlace real aceptado con `1.0.0`.
- [ ] **P1-2** — Correo de invitación con el párrafo del art. 14.
- [ ] Correo de alta al profesional ([`textos/06`](./textos/06-correos.md) § B).
- [ ] **P1-10** — Gemini fuera de la combinación usada para planes generados desde `/consulta`, o confirmación de Google por escrito.
- [ ] `HEALTH_CONSENT_VERSION = '1.1.0'` con la nota precisada (`05` § C).

**Textos**
- [ ] Acuerdo del profesional y condiciones de consulta en `practiceAgreement` (es y en), con `{name}`/`{email}` y sin identidad en el diccionario.
- [ ] Política con la sección «Tu dietista en NutrIA» y el reparto de responsabilidades visible (art. 26.2, por si acaso).
- [ ] Condiciones de uso § F y § G.

**Organización**
- [ ] El propietario comprueba cada número de colegiado en el registro público del colegio correspondiente antes de conceder, y anota la fecha de la comprobación.
- [ ] Procedimiento de brecha escrito: quién mira, cómo se decide en 72 horas si se notifica a la AEPD (art. 33) y a los afectados (art. 34).
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
