# Procedimiento: quitar el segundo factor de una cuenta que lo ha perdido

> **Propósito**: lo que el propietario hace, en orden, cuando alguien escribe que ha perdido el teléfono y los códigos de respaldo y no puede entrar. **Audiencia**: el propietario (lo aprueba antes de que la fase 4 del proyecto 011 salga); el lead y los agentes, como referencia. **Committed**: sí: sin nombres, correos ni direcciones de nadie; las direcciones de las cuentas no se copian nunca al repositorio. **Mantenido por**: el agente `legal`.
>
> **No soy abogado.** Cada regla cita su fuente; lo interpretable va marcado **[abogado]**.

**Cómo funciona la máquina** (contrato 011 fase 4): el propietario pide la retirada desde la consola; el sistema escribe a la dirección de la cuenta **al momento**; si la persona entra con un código antes, la petición se cancela sola; si no, el barrido diario la ejecuta **la primera vez que corre pasadas 48 horas** (entre 48 y 72). El propietario no puede acortar el plazo. **Ojo**: una cuenta con un dispositivo de confianza (30 días) o con Google enlazado no recibe petición de código al entrar, así que entrar no cancela nada; esa persona debe escribir desde la dirección de la cuenta y el propietario cancela (§ 5).

## 1. La tarjeta

1. La petición llega **desde la dirección de la cuenta**, y solo desde ahí. Si no, no se hace nada (§ 2).
2. Comprueba las cabeceras (§ 2). Si algo no cuadra, no pidas nada y responde por la dirección de la cuenta (§ 5).
3. Pide la retirada en la consola. **Nunca** pidas contraseña, códigos ni documentos (§ 3).
4. Responde «recibida» con la fecha que te da la consola (§ 4).
5. Si la cuenta escribe «yo no fui»: **Cancelar** primero, preguntar después (§ 5).
6. Anota la fecha de caducidad de tu copia del correo (§ 6).

## 2. Comprobar que la petición es de la cuenta

La retirada solo se pide si el correo viene de **exactamente la misma dirección** que la de la cuenta en la consola. En Gmail: ⋮ junto a «Responder» → **Mostrar original**.

| Mira | Debe ser | Señal de alarma |
| --- | --- | --- |
| **De** (`From`) | La dirección de la cuenta, **carácter a carácter** (cópiala de la consola, no al revés) | Otro dominio o terminación (`.co` por `.com`), `rn` por `m`, `l` por `I`, `0` por `o`, letras de otro alfabeto, un `+algo` que la cuenta no tiene; un nombre que parece el de la persona pero una dirección distinta |
| **Responder a** (`Reply-To`) | No existe, o es idéntica a `From` | Cualquier otra dirección: la respuesta iría a un tercero |
| **SPF**, **DKIM**, **DMARC** | Los tres en **PASS**, y el dominio firmado es el de `From` | Un FAIL, un NEUTRAL, o `mailed-by`/`signed-by` de un dominio que no es el de `From` |

SPF/DKIM en PASS solo prueba que el remitente **no ha falsificado el dominio**; no prueba que sea la persona. Por eso la dirección exacta es la comprobación que importa, y las cabeceras la protegen de la falsificación.

Si la petición llega **de otra dirección** (la persona «ha perdido también el correo»), no se hace nada: no hay forma proporcionada de saber que es la titular. Se le responde, **a la dirección de la cuenta** (no a la que escribió), con la plantilla D.

Responde siempre escribiendo un correo nuevo a la dirección que muestra la consola, nunca con «Responder» si hay `Reply-To`.

<!-- Fuente: RGPD art. 32.1 (medidas apropiadas al riesgo: la dirección de la cuenta es el único canal que el sistema conoce de la persona; una cuenta con segundo factor protege datos de salud, art. 9) y 5.1.f (integridad y confidencialidad). La lista de señales (homoglifos, `Reply-To`, SPF/DKIM/DMARC) es buena práctica de seguridad, no un requisito legal. «No hay forma proporcionada»: ver § 3 y § 8. -->

## 3. Qué pides y qué no

**Pides**: nada más que la petición, desde la dirección de la cuenta.

**Nunca pides ni aceptas**: la contraseña; ningún código (el de la aplicación, el de respaldo, el de un correo de recuperación); capturas de la aplicación de autenticación; ningún enlace de recuperación; datos de salud; su IP. Si te los envían, no los uses y no los copies a ningún sitio; borra el correo y dilo en la respuesta.

**Documentos de identidad: no.** Un DNI enviado por correo no prueba que quien escribe controle la cuenta (solo que existe un DNI) y añade un dato que NutrIA no tiene ni necesita (art. 5.1.c). El control de la dirección de correo es el único vínculo con la cuenta, y la demora de 48 a 72 horas con aviso a esa dirección es la salvaguarda. Solo si algún día una ley o una autoridad lo exigiera para este caso, se pediría lo mínimo y se borraría al cerrar; hoy no hay norma que lo imponga.

<!-- Fuente: RGPD art. 5.1.c (minimización) y 32.1; art. 12.6 («cuando el responsable… tenga dudas razonables en relación con la identidad de la persona física que cursa la solicitud a que se refieren los artículos 15 a 21, podrá solicitar que se facilite la información adicional necesaria para confirmar la identidad del interesado», texto del DOUE verificado el 2026-10-01): el art. 12.6 se refiere a las solicitudes de los **derechos de los arts. 15 a 21**; quitar el segundo factor no es una de ellas, así que el art. 12 solo sirve de **analogía** (si hay dudas, se pide lo mínimo necesario). Interpretación a confirmar con un abogado [abogado]: que no pedir identidad sea proporcionado aquí, y que un DNI por correo no sea una medida mejor que la dirección + demora. No cito una resolución de la AEPD concreta sobre el DNI: no la he verificado. -->

## 4. Qué respondes, en cada paso

Plantillas listas para pegar. Escríbelas en el idioma en que escribió la persona. No añadas nada más (ni qué datos tiene la cuenta, ni si tiene plan, ni nada de salud). ⟦fecha⟧ es la que muestra la consola.

### A. Recibida y programada

> **es** — Asunto: Tu petición para quitar la verificación en dos pasos
>
> Hola. Hemos recibido tu petición. Te acabamos de escribir un correo del sistema a esta misma dirección. A partir del ⟦fecha⟧ (y como mucho 24 horas después) quitaremos la verificación en dos pasos de tu cuenta. Si recuperas el teléfono o un código de respaldo, entra con él antes y la petición se cancela sola. Nunca te pediremos tu contraseña ni ningún código. Si al entrar no te pide el código (por ejemplo, en un dispositivo de confianza o con Google), la petición no se cancela: respóndenos a este correo y la cancelamos. Si no fuiste tú, responde «no fui yo» a este correo y la cancelamos al momento.
>
> **en** — Subject: Your request to remove two-step verification
>
> Hello. We have received your request. We have just sent you a system email to this same address. From ⟦date⟧ (and at most 24 hours later) we will remove two-step verification from your account. If you get your phone or a backup code back, sign in with it before then and the request cancels itself. We will never ask for your password or for any code. If signing in does not ask you for the code (for example, on a trusted device or with Google), the request is not cancelled: reply to this email and we will cancel it. If it was not you, reply «it wasn't me» to this email and we will cancel it right away.

### B. Cancelada

Si la cancelación la hizo la persona entrando con un código, el sistema ya le escribe; no hace falta responder. Si la pidió ella por correo, o la cancelaste tú (§ 5):

> **es** — Hemos cancelado la petición: tu verificación en dos pasos sigue activa. Si quieres volver a pedirla, escríbenos desde esta dirección.
>
> **en** — We have cancelled the request: your two-step verification stays on. If you want to ask again, write to us from this address.

### C. Hecha

El sistema escribe «Hemos quitado tu verificación en dos pasos». Responde (opcional, pero cierra el caso):

> **es** — Hecho: hemos quitado la verificación en dos pasos de tu cuenta. Entra con tu contraseña y, desde tu perfil, vuelve a activarla con tu teléfono cuando quieras. Si no fuiste tú quien lo pidió, cambia tu contraseña ahora y escríbenos.
>
> **en** — Done: we have removed two-step verification from your account. Sign in with your password and, from your profile, turn it on again with your phone whenever you want. If you did not ask for this, change your password now and write to us.

### D. No podemos hacerlo (otra dirección o cabeceras que no cuadran)

Enviada **a la dirección de la cuenta**, no a la del remitente:

> **es** — Hemos recibido una petición para quitar la verificación en dos pasos de esta cuenta que no venía de esta dirección, y no la hemos tramitado. Si fuiste tú, escríbenos desde esta dirección. Si no, no tienes que hacer nada; si quieres, cambia tu contraseña.
>
> **en** — We received a request to remove two-step verification from this account that did not come from this address, and we have not acted on it. If it was you, write to us from this address. If not, you do not need to do anything; you may change your password if you like.

<!-- Fuente: RGPD art. 12.1 (información clara y sencilla; aquí por analogía, § 3) y 32.1; los correos del sistema (petición, cancelada, hecha) son mensajes de servicio de seguridad (art. 6.1.b/f; LSSI art. 21 no aplica: no son comunicaciones comerciales) y no se pueden desactivar. «Como mucho 24 horas después» es el reflejo del cron diario (contrato 011 fase 4): si el cron cambia de frecuencia, cambia la frase. -->

## 5. Si la cuenta escribe «yo no fui»

Llegue como llegue (respondiendo a tu correo o al del sistema):

1. **Cancela ya** en la consola («Cancelar»). Sin pedir pruebas: cancelar protege a la titular y la peor consecuencia es una demora.
2. Responde con la plantilla B **a la dirección de la cuenta**.
3. Añade: que cambie la contraseña y cierre las demás sesiones desde su perfil.
4. **No** vuelvas a pedir la retirada de esa cuenta hasta que la titular lo pida de nuevo y las cabeceras cuadren.
5. Apunta en el registro de brechas (`procedimiento-brechas.md` § 8) que hubo una petición no reconocida: un intento de tomar una cuenta con datos de salud, aunque se haya frenado, hay que **registrarlo**; si hubiera indicios de que alguien entró, aplica el procedimiento de brechas desde el principio.

<!-- Fuente: RGPD art. 32.1.b-d (capacidad de restaurar y de verificar), 33.5 (documentar toda brecha, incluso la que no se notifica) y 4.12; la decisión de cancelar sin pruebas es de proporcionalidad: la cancelación solo prolonga la protección. -->

## 6. Qué registros existen

| Registro | Qué dice | Plazo |
| --- | --- | --- |
| `audit_logs` `auth.2fa_removal_requested` | Que el propietario pidió la retirada de esa cuenta, y cuándo. La cuenta, solo en `actorId`/`subjectUserId`; sin IP; `entityId` vacío | 12 meses (purga `auth.*`, fase 7); al borrarse la cuenta, la fila queda sin persona |
| `audit_logs` `auth.2fa_removal_cancelled` (`by`: `owner` o `account`) | Que se canceló, quién y cuándo | Igual |
| `audit_logs` `auth.2fa_removed_by_owner` | Que el barrido la ejecutó, cuándo (actor vacío) | Igual |
| Fila `two_factor_removal` | La petición viva: quién la pidió, cuándo, cuándo vence | Mientras esté pendiente; el código la borra o cierra al ejecutarse |
| **Tu bandeja de entrada** | La petición y tus respuestas: contienen la dirección de la persona | **12 meses** desde que se cierra el caso, y entonces se borran. No se copian a ningún repositorio, incidencia ni chat |

<!-- Fuente: RGPD art. 5.1.e y 5.2; `analisis.md` § 4.1 bis (mismo plazo y mismas condiciones que las demás filas `auth.*`; la purga a 12 meses aún se construye: hasta que exista, `/privacidad` no publica el número); contrato 011 fase 4 (forma de las filas). El plazo de 12 meses para el correo es el de las filas, para que el correo no sobreviva a lo que lo explica. -->

## 7. Base jurídica

- **Art. 6.1.b RGPD**: recuperar el acceso a la cuenta que la persona tiene con NutrIA es parte del servicio contratado.
- **Art. 6.1.f**: el interés legítimo en que **una petición falsa no se lleve la protección de una cuenta**. Ponderación: se trata solo la dirección de la cuenta, que ya se tiene.
- **Art. 32.1**: las tres medidas (dirección exacta, aviso inmediato a esa dirección con demora de 48 a 72 horas y cancelación por código, y registro) son la respuesta técnica y organizativa al riesgo de que alguien se haga pasar por la titular de una cuenta que guarda datos de salud.
- **Art. 12** solo por analogía (§ 3).
- **Art. 13**: `/privacidad` lo cuenta con una frase (`textos/02-politica-privacidad.md`, ⟦quitar-dos-pasos⟧).

## 8. Riesgo que queda, y lo que hay que confirmar con un abogado

**P2, riesgo residual**: si quien pide la retirada **controla la bandeja de entrada** de la cuenta (el caso típico de una toma: contraseña y correo comprometidos), el aviso llega a quien ataca, y las 48 a 72 horas no protegen. La demora solo protege cuando la titular sigue leyendo su correo. Este procedimiento no puede cerrar ese hueco sin pedir datos que NutrIA no tiene (§ 3). El propietario lo acepta o lo decide de otro modo: por ejemplo, **negarse** a quitar el factor si la cuenta tiene un plan de consulta activo o pagos recientes. Es una decisión suya; hoy este documento no la impone.

Para llevar a un abogado en una hora **[abogado]**:
1. Que el art. 12.6 RGPD no obligue ni autorice aquí y que no pedir identidad sea proporcionado (§ 3).
2. Si el riesgo residual de § 8 es razonable para una cuenta con datos de salud, o si hace falta una segunda comprobación.
3. Si guardar el correo 12 meses es proporcionado, o basta con menos.
4. Que cancelar sin pruebas ante un «yo no fui» sea lo prudente (§ 5).

**Qué debe aprobar el propietario**: este documento tal cual, o con los cambios que quiera, antes de que el botón «Quitar el segundo factor» salga a producción.
