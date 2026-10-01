# 0007 — Seguridad de las cuentas: contraseñas fuertes, segundo factor y lo demás

> **Purpose**: respuesta del agente `architect` a la petición del owner del 2026-10-01:
> obligar a contraseñas fuertes (alta, cambio y restablecimiento), ofrecer un segundo
> factor opcional, y repasar todas las opciones de segundo factor y todas las demás
> medidas que subirían la seguridad de las cuentas, con una recomendación ordenada: qué
> sale primero como proyecto, qué después y qué no se hace y por qué. Es la base del PRD
> del proyecto que salga de aquí.
> **Audience**: el owner y los agentes. **Committed**: sí. **Maintained by**: el agente
> `architect`; una vez fusionado no se edita — una revisión posterior es un informe nuevo.
>
> Base: `main` en `09ed8323` (#181). Cada número lleva etiqueta: **medido** (dónde),
> **estimado** (con la hipótesis) o **desconocido**. Se leyó el código de `apps/api`
> (módulo `auth`, guardas, `CreateApp.ts`), de `apps/web` (formularios de acceso, `proxy.ts`,
> `next.config.js`, `/perfil`), el esquema de `packages/database`, la documentación de
> despliegue y la parte legal que toca (`eipd.md`, política de privacidad), y **el código
> instalado de Better Auth 1.7.6** (`apps/api/node_modules/better-auth/dist`), porque lo
> que hace cada plugin se ha leído en su fuente, no en su documentación.
> Se midió: las cabeceras HTTP de producción (dos `HEAD`, como cualquier visita), cuatro
> consultas a la API de rangos de Have I Been Pwned desde el equipo del owner (ninguna con
> una contraseña real) y la versión publicada de `@better-auth/passkey` en npm.
> **No se leyó ninguna base de datos, ni de producción ni de desarrollo, no se leyó el
> entorno de Vercel, no se hizo ninguna llamada a modelo y no se gastó nada.**

---

## 1. Veredicto

**Sí, con condiciones.** Las dos peticiones se pueden hacer **sin gastar un euro** y casi
todo lo que hace falta ya viene dentro de Better Auth 1.7.6, que está instalado: el plugin
`two-factor` (código de app de autenticación, códigos de respaldo, bloqueo por intentos,
dispositivo de confianza), el de contraseñas filtradas (`haveibeenpwned`), el de CAPTCHA y
las rutas para listar y cerrar sesiones. Lo que hay que escribir es la pantalla, unas
reglas propias y un par de ajustes de configuración.

Las condiciones:

1. **Antes que nada, medir si el límite de intentos ve la IP de cada persona.** Es lo único
   que puede cambiar el orden. Producción entra por el *proxy* de la web
   (`docs/reference/deployment.md` § Shape A) y Better Auth 1.7.6, si la cabecera
   `x-forwarded-for` trae más de una IP o ninguna fiable, **mete a todo el mundo en un solo
   contador** (`@better-auth/core/dist/utils/ip.mjs`, `getIPFromHeader`;
   `better-auth/dist/api/rate-limiter/index.mjs:242`). Si es así, tres intentos de acceso
   cada diez segundos valen para **todo el servicio**: un atacante bloquea la entrada de
   todos con una petición cada tres segundos. Se comprueba con una consulta de lectura que
   solo devuelve recuentos (§ 9). Si sale mal, arreglarlo es la fase 0 y va antes que el
   resto.
2. **El segundo factor protege la entrada con contraseña, y solo esa.** Better Auth lo pide
   únicamente en `/sign-in/email` (`two-factor/index.mjs:246`). Quien entra con Google no
   lo ve nunca, y no lo puede ver: su segundo factor es el de Google. Se ofrece a las
   cuentas con contraseña. A las de Google se les dice que activen la verificación en dos
   pasos de Google.
3. **La regla de la contraseña vive en el servidor**, en una constante de `packages/core`
   que lee también la web. La comprobación de contraseñas filtradas se escribe nosotros
   sobre la función que exporta Better Auth, **con tiempo límite y sin bloquear el alta si
   el servicio externo cae**. El plugin tal cual falla cerrado y devolvería un 500 en el
   alta.
4. **Cada correo nuevo sale por el Gmail del owner.** Los avisos de seguridad caben en él.
   El segundo factor por correo, no: un correo en cada acceso es la forma de agotar esa
   cuota y no protege de quien ya tiene el buzón.

**Orden recomendado** (detalle en § 8):

| # | Qué | Por qué en este puesto |
| --- | --- | --- |
| 0 | Medir el límite de intentos y, si hace falta, arreglar de qué cabecera sale la IP | Todo lo demás se apoya en ese límite |
| 1 | Contraseñas: mínimo 12, lista de filtradas, nombre del servicio y correo prohibidos, medidor sencillo. De paso, el restablecimiento deja de delatar por su tiempo de respuesta | Es lo primero que pidió el owner y es barato |
| 2 | «Seguridad» en `/perfil`: cambiar contraseña (cierra las demás sesiones), ver y cerrar sesiones, correo de aviso al cambiar la contraseña | Hoy **no existe cambiar la contraseña** y el segundo factor necesita un sitio donde vivir |
| 3 | Segundo factor opcional: app de autenticación + 10 códigos de respaldo | La segunda petición del owner |
| 4 | Segundo factor obligatorio para profesionales (antes de encender `professional`) y para el admin | El riesgo R8 de la EIPD es la cuenta de un profesional con varios pacientes |
| 5 | Más tarde: cabeceras de la web, freno por cuenta en el acceso, enumeración en el alta, llaves de acceso (*passkeys*) cuando haya dominio | Valen menos, o dependen de una decisión que no está tomada |

**No hacer:** SMS, enlaces mágicos, aprobación por notificación, segundo factor por
correo como método principal, reglas de composición («una mayúscula y un símbolo»),
caducidad periódica de contraseñas, bloqueo duro de cuenta y preguntas de seguridad (§ 4.4).

**Decisiones del owner** (§ 5.1): mínimo 12 o 15 caracteres; si el admin puede entrar
con Google; si el alta sigue fallando abierta cuando el servicio de contraseñas filtradas
cae; qué hace él cuando alguien pierde el móvil y los códigos; si se compra un dominio antes
de las llaves de acceso; Turnstile solo si los datos lo piden (es un encargado nuevo, pasa
por `legal`).

---

## 2. Premisas revisadas

| # | Premisa | Estado | Evidencia |
| --- | --- | --- | --- |
| P1 | La autenticación es Better Auth, en `apps/api/src/modules/auth` | **confirmada** | `auth.config.ts:52` `betterAuth({…})`; versión instalada **1.7.6** (`apps/api/node_modules/better-auth/package.json`) |
| P2 | Existe correo + contraseña | **confirmada** | `auth.config.ts:147-173` |
| P3 | Google en producción, Apple construido y apagado | **confirmada en código**; el estado de producción, por `0058` y la memoria (no leí el entorno) | `SocialProviders.ts`: cada proveedor existe solo si su juego de variables está completo |
| P4 | La vinculación de cuentas es estricta | **confirmada** | `auth.config.ts:67` vincula solo si hay proveedor; ningún `trustedProviders`; `requireLocalEmailVerified` en su valor por defecto (activado), explicado en `:53-66` |
| P5 | El correo sale por Gmail SMTP con contraseña de aplicación | **confirmada en la documentación**, no en el entorno | `apps/api/AGENTS.md` § Mail; `0019` |
| P6 | `BETTER_AUTH_URL` es el origen de la web | **confirmada en la documentación** | `docs/reference/deployment.md` § Shape A |
| P7 | Las migraciones corren contra producción en el *build* de la API | **confirmada** | `apps/api/AGENTS.md:163` (`vercel-build` → `database migrate`) |
| P8 | Hay que forzar contraseñas fuertes «al cambiar la contraseña» | **incorrecta en parte**: **no hay cambio de contraseña**. Better Auth tiene la ruta (`/change-password`, `api/routes/update-user.mjs:76`), pero nada en la web la llama; `/perfil` no tiene sección de seguridad (`app/(app)/perfil/page.tsx:1-40`, importaciones). Hoy la contraseña se fija en el alta (`RegisterScreen.tsx:49`) y en el restablecimiento (`ResetPasswordForm.tsx:64`). Cambiarla estando dentro es una funcionalidad nueva | — |
| P9 | La reautenticación existe para borrar la cuenta (#179) | **confirmada** | `apps/api/AGENTS.md:99`: `freshAge` de un día, 409 `REAUTHENTICATION_REQUIRED` |
| P10 | La toma de una cuenta con privilegios es especialmente grave | **confirmada, con un matiz**. El **admin** no lee la salud de nadie (`0028`, `0068`): tomar su cuenta da la lista de cuentas con correos, los interruptores y la concesión de profesional, pero no datos de salud directamente. El **profesional** sí ve la salud de sus pacientes enlazados: la EIPD lo tiene como **R8** («robo de sesión o de cuenta, incluida la de un profesional con varios pacientes», `docs/legal/eipd.md:131`, residual 3 con M13) | — |
| P11 | (implícita) El límite de intentos de Better Auth protege el acceso | **hipótesis**. Está activado y guarda los contadores en base de datos (`auth.config.ts:213-217`; reglas por defecto en `rate-limiter/index.mjs:302-315`: alta y acceso 3 cada 10 s, restablecimiento 3 por minuto). **Por IP**, y la IP puede no estar llegando (condición 1). Se comprueba como dice § 9 | — |
| P12 | (implícita) Un segundo factor cubre a todo el mundo | **incorrecta**: solo a la entrada con contraseña (`two-factor/index.mjs:246`). Google, Apple y, en el futuro, las llaves de acceso no pasan por él | — |

---

## 3. Qué hay hoy

### 3.1 Lo que está bien y se queda

- **Contraseñas con hash** (scrypt, el de Better Auth) y **longitud máxima 128** por
  defecto (`create-context.mjs:186-187`; la regla larga cumple NIST, que pide aceptar al menos
  64).
- **Mensaje único en el acceso**: contraseña mala y cuenta inexistente responden igual, y
  Better Auth calcula un hash también cuando no hay cuenta, para igualar el tiempo
  (`sign-in.mjs:319-322`; la web, `SignInForm.tsx:67-79`).
- **El restablecimiento responde igual** exista o no la cuenta (`password.mjs:60-71`), el
  token es de un solo uso (`consumeVerificationValue`, `:155`), dura una hora y **cierra
  todas las sesiones** (`auth.config.ts:161`).
- **Cookies**: `httpOnly`, `secure` en producción, `sameSite: 'lax'`
  (`auth.config.ts:85-86`). Better Auth comprueba el origen en las peticiones que cambian
  algo (`trustedOrigins`, `:223-226`).
- **La sesión se relee en cada petición** (`Session.guard.ts`) y la deniega con 404; dura
  30 días y se renueva una vez al día de uso (`auth.config.ts:35-36, 219`).
- **Dirección confirmada y cuenta abierta**: las dos cerraduras (`0030`, `0031`).
- **La API** sirve `helmet` (`CreateApp.ts:63`). **Medido** en
  `/api/v1/health`: CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy: no-referrer`,
  HSTS de un año.
- **Borrar la cuenta pide una sesión de menos de un día** (#179).
- La política de privacidad **ya dice** que se guardan la IP y el navegador de cada sesión
  «para poder cerrarla» (`docs/legal/textos/02-politica-privacidad.md:82`). Una lista de
  sesiones en `/perfil` no necesita cambiar la política.

### 3.2 Lo que es débil

| # | Hallazgo | Dónde | Gravedad |
| --- | --- | --- | --- |
| D1 | El límite de intentos puede estar contando a todos juntos (condición 1) | `rate-limiter/index.mjs:236-245`; `ip.mjs` `getIPFromHeader`; *proxy* en `apps/web/next.config.js` | **Alta si se confirma** (bloqueo de todos los accesos y límite inútil); **hipótesis** |
| D2 | Contraseña mínima de **8**, sin otra regla; el 8 está **escrito dos veces** en la web y ninguna en `core` | `RegisterScreen.tsx:25`, `ResetPasswordForm.tsx:18`; servidor, valor por defecto (`create-context.mjs:186`) | Media |
| D3 | No se comprueba si la contraseña está filtrada | `auth.config.ts` no carga ningún plugin | Media. **Medido**: `Password123!` aparece **295.389** veces en HIBP y hoy se acepta (12 caracteres) |
| D4 | No se puede cambiar la contraseña, ni ver las sesiones, ni cerrar las de otros dispositivos | `/perfil` (`page.tsx`) | Media: tras un susto, la única salida es «olvidé mi contraseña» |
| D5 | **El alta dice si una dirección ya tiene cuenta**: Better Auth responde 422 y la web lo traduce a «ese correo ya está registrado» | `sign-up.mjs:204`; `RegisterScreen.tsx:58` | Media-baja: revela que alguien usa una app de dieta. El límite de 3 cada 10 s por IP solo frena a quien prueba muchas direcciones |
| D6 | **El restablecimiento delata la cuenta por el tiempo**: para una dirección que existe espera al envío SMTP; para una que no, no | `password.mjs:82` (`runInBackgroundOrAwait`, que **espera** porque no hay `advanced.backgroundTasks.handler`, `create-context.mjs:212-218`); `PasswordResetMail.ts:85` espera a `mailer.send` | Media-baja. Magnitud **estimada** en 0,3–2 s (un envío SMTP a Gmail); se mide en local. El arreglo ya existe en el repositorio: `shared/services/BackgroundTask.service.ts:30-41` envuelve `waitUntil` |
| D7 | Las páginas de la web no tienen CSP, ni `frame-ancestors`/`X-Frame-Options`, ni `nosniff`, ni `Referrer-Policy`. Solo HSTS, que pone Vercel | **Medido** con `HEAD /` en producción: solo `strict-transport-security: max-age=63072000; includeSubDomains; preload`. `next.config.js` no define `headers()` | Baja-media. `sameSite: 'lax'` ya impide que una web ajena meta `/perfil` en un `iframe` con la sesión. `/restablecer?token=…` lleva el token en la URL |
| D8 | No hay freno por cuenta: el límite es solo por IP | Diseño de Better Auth (clave `ip|ruta`) | Media frente a robo de credenciales desde muchas IPs |
| D9 | Ningún aviso por correo cuando cambia algo de seguridad | — | Baja hoy; sube con el segundo factor |
| D10 | Ninguna exigencia extra para el admin ni para un profesional | `Admin.guard.ts`, `Professional.guard.ts` | Media; alta cuando se encienda `professional` |

---

## 4. Propuesta

### 4.1 Contraseñas

**Qué dice NIST SP 800-63B-4 (versión final, agosto de 2025):** si la contraseña es el
**único** factor, mínimo **15** caracteres; si forma parte de un acceso con dos factores,
mínimo **8**. Aceptar al menos 64, con espacios y Unicode. **No** imponer reglas de
composición. **Sí** comparar con una lista de contraseñas filtradas, de diccionario y
propias del servicio. No obligar a cambiarla cada cierto tiempo, pero sí cuando hay
pruebas de que se ha filtrado. Dejar pegar, para que funcionen los gestores.

**Recomendación:**

- **Mínimo 12, máximo 128, sin reglas de composición.** El 15 de NIST es para
  contraseñas que son el único factor, y aquí lo serán casi todas, porque el segundo factor
  es opcional. Propongo 12 a sabiendas. En iPhone, con `autocomplete="new-password"`
  (ya está en los dos formularios), el llavero propone una contraseña generada mucho más
  larga y la mayoría de la gente la acepta. Quien la teclea a mano en un móvil sufre cada
  carácter de más. La lista de filtradas aporta más que los tres caracteres que van del 12
  al 15. **Es decisión del owner** (§ 5.1). Las dos cifras cuestan lo mismo de construir.
- **Una sola constante en `packages/core`** (`PASSWORD_MIN_LENGTH`, junto a un esquema Zod
  de contraseña nueva). La leen `auth.config.ts` (`emailAndPassword.minPasswordLength`) y
  los dos formularios, que hoy tienen cada uno su `8`. Es la regla de `ARCHITECTURE.md`:
  una regla se escribe una vez.
- **Subir el mínimo no deja fuera a nadie.** El acceso solo comprueba la longitud máxima
  (`sign-in.mjs:316`). Una contraseña de 8 caracteres creada antes sigue entrando.
- **Filtradas (HIBP, rangos con k-anonimato).** Medido el 2026-10-01: la API es **gratis y
  sin clave**. Se envían los 5 primeros caracteres hexadecimales del SHA-1 y vuelve una
  lista de sufijos, **1.959–2.115 líneas por prefijo con relleno** (4 consultas). La
  contraseña no sale. El prefijo es común a unas dos mil y no identifica a nadie. La
  petición sale de la función de Vercel, así que tampoco viaja la IP de la persona. Latencia
  **medida desde el equipo del owner en España: 158–1.281 ms**; desde `fra1`,
  **desconocida** (estimo algo parecido o menos: la sirve el borde de Cloudflare).
  - **No uso el plugin tal cual.** Si HIBP no responde, lanza `INTERNAL_SERVER_ERROR`
    (`haveibeenpwned/index.mjs:37-41`) y el alta da 500. Propongo un gancho propio
    (`hooks.before` en `/sign-up/email`, `/reset-password` y `/change-password`) que use
    `isPasswordCompromised`, que el mismo módulo exporta, con un tiempo límite de unos
    2 s y que, si falla, **deja pasar y lo registra**. El riesgo de dejar pasar una
    contraseña filtrada durante una caída de HIBP es pequeño. Un alta que no funciona es un
    fallo que el usuario ve. **Decisión del owner** (§ 5.1).
  - En pruebas no se llama a la red: el gancho se apaga con `NODE_ENV=test`, igual que el
    límite de las suites (`auth.config.ts:34`). **Medido**: la contraseña de todas las
    suites, `correct-horse-battery-staple-9`, tiene **0** apariciones en HIBP. No habría
    que cambiar ninguna suite aunque el gancho se encendiera.
  - **Legal**: no sale ningún dato personal. Aun así, `legal` debe confirmar si la política
    nombra la comprobación. Es una línea, no un encargado.
- **Lista propia** (código, sin red): rechazar la contraseña que contiene la parte local del
  correo, el nombre o «nutria». Es lo que NIST llama «palabras del contexto». Son diez
  líneas.
- **Medidor en la web: sencillo, no zxcvbn de momento.** Una barra que avanza con la
  longitud y un texto que diga «mejor una frase de varias palabras». La decisión la toma el
  servidor. zxcvbn-ts con el diccionario español pesa **desconocido** (estimo cientos de
  KB) en una pantalla que se abre con 4G en una tienda. Si se quiere después, se carga
  solo en esas dos pantallas y se mide con el *build*. Añadir
  `passwordrules="minlength: 12;"` al campo, para que el generador de Safari respete el
  mínimo.
- **Usuarios con una contraseña débil:**
  - **Cortas**: no se les obliga. NIST no pide cambiar una contraseña porque la regla haya
    cambiado.
  - **Filtradas**: sí, porque NIST lo exige cuando hay pruebas. Al entrar con éxito, un
    gancho `after` en `/sign-in/email` comprueba la contraseña contra HIBP en segundo plano
    (`BackgroundTaskService`) y, si aparece, marca la cuenta (`password_compromised_at`). La
    web enseña entonces una pantalla que pide cambiarla antes de seguir. Necesita la
    fase 2, porque hoy no hay dónde cambiarla.
  - **No guardar la contraseña ni el hash SHA-1** para hacer esta comprobación más tarde:
    se hace con la contraseña en claro en el momento del acceso, y se olvida.

### 4.2 Segundo factor: todas las opciones

| Opción | Coste | En iPhone | Resiste *phishing* | Recuperación | Better Auth 1.7.6 | Veredicto |
| --- | --- | --- | --- | --- | --- | --- |
| **App de autenticación (TOTP)** | 0 € | Bueno: desde iOS 15 el llavero guarda códigos; tocar un enlace `otpauth://` en el mismo iPhone lo da de alta sin escanear (**hipótesis**, se prueba en el iPhone del owner). También Google Authenticator, 1Password… | No (el código se puede pedir en una web falsa) | Códigos de respaldo | **Nativo**: `twoFactor()` — secreto cifrado, 10 códigos de respaldo cifrados (`backup-codes/index.mjs:15`), 5 intentos por reto (`totp/index.mjs:185`) y bloqueo por cuenta (`failedVerificationCount`, `lockedUntil`, `schema.mjs`), dispositivo de confianza 30 días | **Sí, primero** |
| **Códigos de respaldo** | 0 € | Hay que guardarlos (el llavero o una nota) | — | Son la recuperación | **Nativo**, con TOTP | **Sí, con TOTP, obligatorios** |
| **Llaves de acceso (passkeys / WebAuthn)**, como acceso sin contraseña o como segundo factor | 0 € | **El mejor**: Face ID y llavero de iCloud. En la app instalada (`manifest.ts:29`, `display: 'standalone'`) WebAuthn debería funcionar (**hipótesis**, iOS 16+) | **Sí**, la única de la lista | Otra llave, o contraseña + TOTP | **Paquete aparte**: `@better-auth/passkey@1.7.7`, que pide `better-auth ^1.7.7` (**medido** en npm; hoy hay 1.7.6). Tabla nueva | **Sí, pero después del dominio** (abajo) |
| Código por correo (OTP) | 0 €, pero gasta Gmail en **cada** acceso | Regular: cambiar a Mail y volver | No | El buzón | Nativo (`otpOptions.sendOTP`) | **No como método principal**: quien tiene el buzón ya tiene la cuenta por «olvidé mi contraseña», y cada acceso es un correo |
| SMS | **Coste por mensaje** (estimado 0,05–0,10 € en España con Twilio o similar) | Bueno | No; además, duplicado de SIM | El número | Plugin `phone-number`, no como 2FA puro | **No**: cuesta dinero, el duplicado de SIM lo rompe, NIST lo restringe y obliga a guardar un dato personal nuevo (el teléfono) |
| Enlace mágico | 0 €, un correo por acceso | **Malo**: el enlace se abre en Safari, y la app instalada tiene **otro almacén de cookies**. Se entra en Safari, no en la app | No | El buzón | Plugin `magic-link` | **No**: es un solo factor (el buzón) y en iPhone deja la sesión en el sitio equivocado |
| Aprobación por notificación | Necesita app nativa o un sistema propio | — | No (fatiga de avisos) | — | No existe | **No** |

**Las llaves de acceso dependen de una decisión sobre el dominio.** Una llave queda atada
al dominio de la web (el *RP ID*), que hoy es `nutr-ia-web-phi.vercel.app`. Pasar a un
dominio propio (Shape B de `deployment.md`) **deja inservibles todas las llaves creadas
antes**, y cada persona tendría que crear otra. Si el owner va a comprar un dominio, las
llaves van después. Si no, pueden ir sobre el de Vercel. Es la mejor opción a largo plazo:
la única que resiste el *phishing* y la más cómoda en iPhone.

**Google y Apple.** Better Auth no pide el segundo factor en la entrada con un proveedor, y
no tenemos forma fiable de saber si Google lo pidió: el *token* de Google no garantiza
decir cómo se autenticó la persona (**hipótesis**, no comprobada en un *token* real). Por
eso:

- A una cuenta **solo de Google** no se le ofrece TOTP. Se le explica que su seguridad es la
  de su cuenta de Google y se enlaza a la verificación en dos pasos de Google. Permitir
  activarlo sin contraseña (`allowPasswordless`) daría una casilla que no protege nada:
  la entrada por Google seguiría sin pedirlo.
- Una cuenta con contraseña **y** Google vinculado queda tan segura como el más débil de
  los dos: contraseña + TOTP, o la cuenta de Google. Es aceptable, y hay que decirlo.
- Un restablecimiento de contraseña **no se salta** el segundo factor: tras restablecer, el
  acceso con la contraseña nueva lo vuelve a pedir (el gancho mira `twoFactorEnabled`,
  `two-factor/index.mjs:251`). Con el segundo factor activado, quien solo tiene el
  buzón ya no entra. Es lo que más compra el segundo factor aquí.

**Recuperación.** Si alguien pierde el móvil, entra con un código de respaldo. Si pierde el
móvil y los códigos, no hay salida automática, a propósito: una salida automática por
correo anularía el segundo factor. La salida es el owner. Una acción en la consola,
«Quitar el segundo factor», auditada en `audit_logs`, que envía un correo a la dirección de
la cuenta. El owner la usa solo cuando la petición le llega **desde esa misma dirección**.
Es la puerta por la que entraría la ingeniería social. `legal` debe escribir el
procedimiento, y es **decisión del owner** cuánto pide antes de pulsar.

**Obligatorio para cuentas con privilegios.**

- **Profesionales**: `ProfessionalGuard` exige, además de lo que ya mira, que la cuenta
  tenga `twoFactorEnabled` si tiene contraseña. Si no, 404 en las rutas de cliente, como
  cualquier denegación, y la página del espacio de trabajo (`@BeforePractice()`) explica
  que lo active. Hay que hacerlo **antes de encender `professional`** en producción. Así
  no hay profesionales en marcha a los que cortar, y cierra el residual de R8.
- **Admin**: lo mismo en `AdminGuard`, **después** de que el owner haya activado el suyo y
  guardado los códigos. Si no, se deja fuera de `/admin` él solo. Si el owner entra con
  Google, la regla no le pide nada (Google es su segundo factor). **Decisión del owner**
  (§ 5.1).
- Si una cuenta con privilegios es solo de Google, la regla tampoco pide nada. Es la misma
  decisión.

### 4.3 Las demás medidas, una a una

| Medida | Qué hace falta | Qué puede romper | Coste | Recomendación |
| --- | --- | --- | --- | --- |
| **Saber la IP del cliente** en el límite de Better Auth | Medir (§ 9). Si sale mal: `advanced.ipAddress.ipAddressHeaders` y/o `trustedProxies` en `auth.config.ts`, según lo que Vercel ponga en `x-forwarded-for` / `x-vercel-forwarded-for` tras el *proxy* (documentación de Vercel, **no comprobado**). Y revisar con el mismo dato `trust proxy 1` en `CreateApp.ts:61`, que usa `RateLimitGuard` para quien no ha entrado | Si se configura mal, cualquiera falsea su IP poniendo la cabecera. Por eso se configura sobre lo medido, no sobre lo supuesto | 0 € | **Fase 0** |
| **Freno por cuenta** en el acceso | Gancho `before`/`after` en `/sign-in/email` con un contador por HMAC del correo (en `rate_limit` o en una tabla propia): tras ~10 fallos en 15 min, espera creciente. **Nunca** un bloqueo duro | Un bloqueo duro dejaría a un atacante cerrar la cuenta de cualquiera. Con espera creciente, el dueño sigue entrando con un pequeño retraso | 0 €, una escritura por intento fallido | **Fase 5**, o antes si el § 9 enseña intentos |
| **Límite del segundo factor** | Ya viene: 3 cada 10 s en `/two-factor/*` (`two-factor/index.mjs:338`) más 5 intentos por reto y bloqueo por cuenta | Depende de la fase 0, como todo el límite | 0 € | Con la fase 3 |
| **CAPTCHA (Cloudflare Turnstile)** | Plugin `captcha` nativo; clave secreta en la API y clave pública en la web (una tercera variable `NEXT_PUBLIC_`); un script de `challenges.cloudflare.com` (la futura CSP lo tiene que admitir) | Las suites usan las claves de prueba de Cloudflare. Hace falta `legal`: **Cloudflare sería un encargado nuevo**, con transferencia a EE. UU. y señales del dispositivo | Gratis, **estimado** (plan gratuito de Turnstile según mi conocimiento; comprobar sus condiciones) | **Solo si los datos lo piden** (intentos que el freno por cuenta no para) |
| **Sesiones: duración** | Hoy, 30 días renovados con cada día de uso. Es lo correcto para quien abre la app en la cocina | Acortarla obliga a entrar más y más correos de restablecimiento | 0 € | **Se queda**. Para profesionales y admin, el segundo factor vale más que una sesión corta |
| **Sesiones: ver y cerrar** | Rutas nativas: `/list-sessions`, `/revoke-session`, `/revoke-sessions`, `/revoke-other-sessions` (`api/routes/session.mjs:347-450`). Falta la pantalla en `/perfil`, con dispositivo (del *user agent*) y fecha. La IP solo si la fase 0 la arregla; si no, vale `""` (`internal-adapter.mjs:263`) | Cerrar la sesión de otro dispositivo deja en él la copia sin conexión (`0053`) hasta que vuelva a hablar con la API | 0 € | **Fase 2** |
| **Cambiar la contraseña** cierra las demás sesiones | Pantalla nueva; un gancho `before` en `/change-password` que **fuerce** `revokeOtherSessions: true`, para que no lo decida el cliente (`update-user.mjs:92, 174`) | Nada; es nuevo | 0 € | **Fase 2** |
| **Reautenticación para acciones sensibles** | Ya está para borrar la cuenta. Better Auth pide la contraseña para activar y desactivar el segundo factor, y además una sesión reciente para desactivarlo (`sensitiveSessionMiddleware`, `two-factor/index.mjs:195`). Cambiar la contraseña pide la actual | — | 0 € | Basta con lo que hay más el segundo factor. Para el admin, el 2FA obligatorio hace el papel de *step-up* |
| **Correos de aviso** | Contraseña cambiada o restablecida (`onPasswordReset` existe; `after` en `/change-password`); segundo factor activado o desactivado; llave añadida; un código de respaldo usado. Una plantilla en `modules/email/templates`, sin una palabra de salud (M14) | **Cuota de Gmail**: ~500 destinatarios al día (**estimado**: el límite que Google publica para cuentas personales; no medido, y Google puede cortar antes). Son eventos raros: con 100 cuentas, unos pocos correos al mes (**estimado**) | 0 € | **Fase 2** (contraseña) y **fase 3** (2FA). **No** avisar de cada «acceso desde un dispositivo nuevo» de momento: con sesiones de 30 días es ruido, y es el aviso que más correos gasta |
| **Verificación del correo** | Ya obligatoria: la guarda responde 409 `EMAIL_NOT_VERIFIED` (`0030`) | — | — | **Se queda** |
| **Enumeración en el alta** (D5) | `emailAndPassword.autoSignIn: false`: Better Auth responde igual a una dirección que ya existe (`sign-up.mjs:155-157, 193-201`) y llama a `onExistingUserSignUp`, que puede enviar «alguien intentó crear una cuenta con tu correo; si eras tú, entra o restablece» | **Cambia el alta**: ya no se entra al registrarse, se entra al pulsar el enlace (`autoSignInAfterVerification: true` ya está). En iPhone el enlace se abre en Safari, no en la app instalada. Y un correo más por intento | 0 €, correos | **Fase 5**, decidido con `frontend` y `accessibility` por el cambio de recorrido |
| **Enumeración por tiempo en el restablecimiento** (D6) | `advanced.backgroundTasks.handler` conectado a `BackgroundTaskService` (`waitUntil`), para que la respuesta no espere al SMTP | Si `waitUntil` no está disponible (fuera de Vercel), el servicio ya lo prevé (`BackgroundTask.spec.ts:42`) | 0 € | **Fase 1** |
| **Cabeceras de la web** (D7) | `headers()` en `apps/web/next.config.js`: `frame-ancestors 'none'` / `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` (o `no-referrer`), `Permissions-Policy` | Nada visible | 0 € | **Fase 1** las sencillas |
| **CSP en la web** | Con *nonces*, Next obliga a renderizar cada página en el servidor, y la portada deja de salir de la caché (**medido**: hoy `x-vercel-cache: HIT`). Sin *nonce*, hace falta `'unsafe-inline'` en `script-src`, que la vacía de sentido | Rompe scripts sin aviso si se pone en modo bloqueo de golpe | 0 €, algo más de función por visita | **Fase 5**: primero `Content-Security-Policy-Report-Only` |
| **Registro de eventos de seguridad** | Reusar `audit_logs` (`platform.schema.ts:81-100`, ya con `actorId`/`subjectUserId`) con acciones `auth.password_changed`, `auth.2fa_enabled`, `auth.2fa_disabled`, `auth.2fa_removed_by_owner`, `auth.sessions_revoked`. Sin IP (la regla de `AuditRepository`) | Más filas; `legal` fija cuánto se guardan | 0 € | **Fases 2–4**, cada evento con su fase |
| **2FA obligatorio para admin y profesionales** | § 4.2 | Dejarse fuera de `/admin` si se activa antes que el propio | 0 € | **Fase 4** |

### 4.4 Lo que no se hace

- **SMS**: cuesta dinero por mensaje, el duplicado de SIM lo rompe y obliga a guardar el
  teléfono de cada persona.
- **Enlace mágico**: es un solo factor (el buzón) y en iPhone deja la sesión en Safari, no
  en la app instalada.
- **Aprobación por notificación**: no hay app nativa y es la forma de fatigar al usuario
  hasta que acepta.
- **Segundo factor por correo como método principal**: no protege de quien ya tiene el
  buzón, y gasta un correo en cada acceso.
- **Reglas de composición, caducidad periódica, preguntas de seguridad**: NIST las
  desaconseja; empeoran las contraseñas.
- **Bloqueo duro de cuenta**: convierte el freno en un arma contra la víctima.
- **`allowPasswordless` en el segundo factor**: daría a una cuenta de Google una casilla
  que no protege nada.
- **`freshAge: 0`, proveedores de confianza (`trustedProviders`), aceptar la contraseña en
  `DELETE /users/me`**: ya prohibido (`apps/api/AGENTS.md:99`, `0058`), y aquí se repite.

### 4.5 Alternativas consideradas

| Alternativa | Por qué perdió |
| --- | --- |
| Llaves de acceso primero, antes que TOTP | Quedarían inservibles si luego se compra un dominio |
| Plugin `haveIBeenPwned` tal cual | Falla cerrado: una caída de HIBP tumba el alta |
| zxcvbn en la web y en el servidor | Peso **desconocido** en móvil; HIBP y la longitud cubren casi todo lo que aporta |
| Turnstile desde el principio | Es un encargado nuevo, con su revisión legal, para un problema que no se ha visto |
| Sesión más corta para todos | Hace entrar más a quien usa la app a diario, y el segundo factor ataca el mismo riesgo mejor |
| Un proyecto solo de 2FA | El 2FA necesita la sección de seguridad, que hoy no existe, y su límite de intentos se apoya en la fase 0 |

---

## 5. Requisitos

### 5.1 Decisiones del owner

1. **Longitud mínima: 12 (recomendado) o 15 (lo que dice NIST para un solo factor).**
2. **Si HIBP no responde, ¿se deja pasar el alta (recomendado) o se para?**
3. **El admin, ¿puede entrar con Google y fiarse de la verificación en dos pasos de
   Google, o solo con contraseña + TOTP?** Y lo mismo para un profesional que sea solo de
   Google.
4. **Qué pide el owner antes de quitar el segundo factor a alguien** que ha perdido el
   móvil y los códigos (mínimo: que se lo pida desde la dirección de la cuenta; `legal`
   escribe el procedimiento).
5. **Dominio propio, sí o no, y cuándo**: las llaves de acceso van después.
6. **Turnstile**, solo si la fase 0 o el freno por cuenta enseñan ataques. Cloudflare sería
   un encargado nuevo.
7. **Enumeración en el alta**: si se acepta que ya no se entre al registrarse (fase 5).

### 5.2 Código

- `apps/api/src/modules/auth/auth.config.ts`: `minPasswordLength` de `core`;
  `advanced.backgroundTasks`; `advanced.ipAddress` (si la fase 0 lo pide); `hooks`
  (filtradas, palabras del contexto, `revokeOtherSessions` forzado, freno por cuenta,
  eventos de auditoría); plugin `twoFactor({ issuer: 'NutrIA', … })`; avisos por correo.
- `BackgroundTaskService` se inyecta en `createAuth` desde `auth.module.ts`, como ya se
  hace con `mailer` y `billing`. Lo usan `advanced.backgroundTasks.handler` (fase 1) y la
  comprobación de filtradas al entrar (fase 2). Nadie llama a `waitUntil` directamente.
- En pruebas, `TEST_AUTH_RULE` (`auth.config.ts:214`) sube hoy solo `/sign-in/*` y
  `/sign-up/*`. Las suites de la fase 3 necesitan la misma regla en `/two-factor/*`, o el
  segundo reto de cada suite dará 429 (el plugin pone 3 cada 10 s).
- `apps/api/src/modules/email/templates`: «tu contraseña ha cambiado», «segundo factor
  activado/desactivado/quitado».
- `apps/api/src/shared/guards/Professional.guard.ts` y `Admin.guard.ts`: exigencia de 2FA.
  `SessionGuard` debe pasar `twoFactorEnabled` en `request.user` (`Session.guard.ts:48-55`).
- `apps/api` → consola: «Quitar el segundo factor», auditada.
- `packages/core`: `PASSWORD_MIN_LENGTH`, el esquema de contraseña nueva y las acciones de
  auditoría nuevas en `AUDIT_ACTIONS`.
- `apps/web`: `twoFactorClient` en `lib/auth-client.ts`. **`SignInForm.tsx:63-80` debe
  tratar `twoFactorRedirect`**: hoy una respuesta 200 con `twoFactorRedirect: true` y sin
  error caería en `router.push('/inicio')` sin sesión, y `proxy.ts` devolvería a la persona
  a `/acceder` sin decir nada. Hacen falta además una pantalla de verificación, una sección
  «Seguridad» en `/perfil`, el medidor, `passwordrules` y `headers()` en `next.config.js`.
  Todo con la *skill* de diseño y revisión de `accessibility`.
- **Hallazgo para `backend`** (al lead, para quien construya la fase 3; hoy nadie trabaja en `auth`): con 2FA, `databaseHooks.session.create.after`
  (`auth.config.ts:100-102`) registra `session_started` por la sesión que el plugin crea y
  borra antes del reto (`two-factor/index.mjs:287-288`), y otra vez por la buena. Cada
  acceso con 2FA contaría doble en el embudo de `0033`.

### 5.3 Datos (migraciones)

- `user.two_factor_enabled boolean default false` y la tabla `two_factor` (`secret`,
  `backup_codes`, `user_id`, `verified`, `failed_verification_count`, `locked_until`;
  `schema.mjs` del plugin), copiadas en `auth.schema.ts`. **`user_id` con `ON DELETE
  CASCADE`**: es el invariante de borrado de `ARCHITECTURE.md`, y Better Auth no lo pone
  por nosotros en un esquema Drizzle escrito a mano.
- `user.password_compromised_at timestamp null` (contraseña filtrada al entrar).
- Más tarde, la tabla de llaves de acceso del plugin `passkey`, también con cascada.
- Todas son aditivas y sin relleno de datos. Corren contra producción en el *build*
  (`P7`): una columna con valor por defecto y una tabla vacía.

### 5.4 Infraestructura y dinero

- **Variables nuevas: ninguna** en las fases 0–4 (el secreto de TOTP se cifra con
  `BETTER_AUTH_SECRET`). Turnstile, si llega, añade dos.
- **Dinero: 0 €.** HIBP es gratis y sin clave (medido); TOTP y llaves de acceso no tienen
  coste; Gmail, dentro de su cuota (estimado).
- **Neon**: unas filas por cuenta con 2FA; las escrituras del freno por cuenta solo en
  fallos. Transferencia despreciable (**estimado**).
- **Vercel**: 0,2–1,3 s más en el alta, el restablecimiento y el cambio de contraseña por
  HIBP (**medido** desde España; **desconocido** desde `fra1`). El acceso no espera a
  HIBP, porque esa comprobación va en segundo plano.
- **Better Auth**: subir a 1.7.7 solo cuando lleguen las llaves de acceso.

### 5.5 Tiempo del owner

Hacer la consulta de la fase 0 (5 minutos). Tomar las decisiones de § 5.1. Activar su
propio 2FA y guardar los códigos antes de la fase 4 del admin. Probar en su iPhone el alta
del código con `otpauth://` y el acceso con 2FA desde la app instalada.

### 5.6 Quién más

- **`legal`**: actualizar la EIPD (R8/M13: segundo factor, filtradas, aviso). Confirmar si la
  política nombra la comprobación HIBP. Escribir el procedimiento de «quitar el segundo
  factor». Fijar la conservación de los eventos de seguridad. Turnstile, si llega.
- **`invariant-reviewer`**: cascada de las tablas nuevas; que ninguna denegación nueva deje
  de ser 404; que el 409 de «cambia tu contraseña» siga la excepción documentada de
  `ONBOARDING_INCOMPLETE` (es la propia cuenta y hay que decirle qué hacer); que ningún
  correo de seguridad lleve una palabra de salud.

---

## 6. Riesgos

Primero los de seguridad, privacidad y cuota.

| Riesgo | Para quién | Probabilidad | Cómo se vería | Cómo se deshace |
| --- | --- | --- | --- | --- |
| El límite de intentos ya cuenta a todos juntos (D1) | Todos | **Desconocida**: es lo que mide la fase 0 | Varios 429 seguidos en accesos legítimos; el aviso de Better Auth en los registros (§ 9) | Configurar la cabecera de IP sobre lo medido |
| Arreglar la IP con la cabecera equivocada deja falsear la IP | Todos | Baja si se mide antes | Claves de `rate_limit` con IPs inventadas | Volver al valor anterior; es configuración |
| El owner se deja fuera de `/admin` | El owner | Baja con el orden propuesto | 404 en `/admin` | Códigos de respaldo; en último caso, el owner pone `two_factor_enabled = false` en Neon él mismo |
| Una persona pierde el móvil y los códigos | Quien tenga 2FA | Baja, pero ocurrirá | Escribe al owner | La acción auditada «quitar el segundo factor». El peligro es la ingeniería social: el procedimiento de `legal` la cierra |
| HIBP cae | Quien se registra o cambia la contraseña | Baja | Registro «HIBP no respondió» | Con fallo abierto, nada que deshacer |
| Correos de seguridad agotan Gmail | Todos (el restablecimiento comparte cuota) | Baja con estos eventos; alta si se añadiera el aviso de «dispositivo nuevo» o el OTP por correo | `mail_sent` en la consola (`0071`) | No añadir esos dos; mover el SMTP a un proveedor transaccional el día que haya dominio |
| Una persona con 2FA no sabe usarlo en el iPhone | Usuarios | Media | Mensajes al owner; accesos a medias | Es opcional: lo desactiva con su contraseña |
| El embudo cuenta doble los accesos con 2FA | El owner | **Segura** si no se corrige | `session_started` inflado | El arreglo enviado a `backend` |
| Las suites E2E se rompen | CI | Baja: 2FA es opcional y nadie lo activa en ellas; HIBP apagado en pruebas; la contraseña de las suites tiene 29 caracteres | CI rojo | Suites nuevas para el reto 2FA y la exigencia por rol (las guardas cambian) |
| Los usuarios de Google se sienten fuera | Usuarios de Google | Media | Preguntas | El texto que los manda a la verificación en dos pasos de Google |
| Llaves de acceso inservibles al cambiar de dominio | Quien las haya creado | Segura si se hacen antes del dominio | — | Por eso van después |

---

## 7. Coste y esfuerzo

Dinero: **0 €** en todas las fases recomendadas (§ 5.4). Esfuerzo **estimado** en PRs del
equipo de agentes, con la hipótesis de que cada fase es un PR con revisión:

| Fase | Esfuerzo | Qué lo mueve |
| --- | --- | --- |
| 0 — medir / IP | 5 min del owner; 0,5–1 día si hay que arreglar | Lo que diga la medición; probar la cabecera en un despliegue |
| 1 — contraseñas + tiempo del restablecimiento + cabeceras | 1–2 días | El medidor y sus textos en dos idiomas |
| 2 — sección Seguridad, cambio, sesiones, aviso, filtradas al entrar | 2–3 días | La pantalla, la «obligación de cambiarla» y sus suites |
| 3 — TOTP + respaldo + recuperación por el owner | 2–4 días | El recorrido en iPhone (alta del código, reto, códigos) y la acción de consola |
| 4 — obligatorio por rol | 1 día | Que no deje fuera a nadie; decisión sobre Google |
| 5 — CSP, freno por cuenta, enumeración en el alta, llaves de acceso | 1–2 días cada una | La CSP depende de lo que cargue la web; las llaves, del dominio |

---

## 8. Plan

Un proyecto, «Cuentas más seguras», en fases que se publican una a una.

**Fase 0 — ¿El límite ve a cada persona?** El owner hace la consulta de § 9. Si el
resultado es A, no se toca nada. Si es B, se configura `advanced.ipAddress` sobre lo
medido, se despliega y se repite la consulta.
*Éxito*: en las sesiones nuevas, IPs distintas para personas distintas.
*Parar si*: Vercel no entrega la IP del cliente a través del *proxy*. Entonces se mide la
alternativa (que la web añada una cabecera propia firmada) en un informe aparte.

**Fase 1 — Contraseñas.** Constante en `core` (12 o 15); gancho de filtradas con tiempo
límite y fallo abierto; palabras del contexto; medidor sencillo y `passwordrules`; el
restablecimiento deja de esperar al SMTP; cabeceras sencillas en la web.
*Éxito*: `Password123!` se rechaza en el alta y en el restablecimiento, con un mensaje claro
en los dos idiomas; el restablecimiento tarda lo mismo para una dirección que existe y para
una que no (medido en local); `HEAD /` enseña las cabeceras nuevas.
*Parar si*: HIBP desde `fra1` pasa de 2 s de forma habitual. Entonces solo se consulta en
segundo plano y se avisa después.

**Fase 2 — «Seguridad» en `/perfil`.** Cambiar la contraseña (cierra las demás sesiones);
lista de sesiones con «cerrar» y «cerrar todas las demás»; correo «tu contraseña ha
cambiado» (también tras restablecerla); contraseña filtrada al entrar → pantalla que pide
cambiarla; eventos en `audit_logs`.
*Éxito*: cambiar la contraseña en el iPhone cierra la sesión del ordenador; llega el correo.
*Parar si*: la pantalla obligatoria choca con el recorrido de alta o de `/pendiente`. Se
rediseña antes de seguir.

**Fase 3 — Segundo factor opcional.** Plugin `twoFactor` (TOTP, 10 códigos de respaldo,
dispositivo de confianza 30 días); solo para cuentas con contraseña; pantalla del reto;
correos de activado y desactivado; acción del owner «quitar el segundo factor»; arreglo del
doble `session_started`.
*Éxito*: el owner lo activa en su iPhone con el llavero, entra desde la app instalada con el
código y con un código de respaldo, y lo desactiva.
*Parar si*: el reto no funciona dentro de la app instalada en iPhone.

**Fase 4 — Obligatorio por rol.** Profesionales en `ProfessionalGuard`, antes del
*go-live*; admin en `AdminGuard`, después de que el owner tenga el suyo; la decisión sobre
Google aplicada.
*Éxito*: un profesional sin 2FA recibe 404 en las rutas de cliente y ve en su página qué
hacer; el owner sigue entrando en `/admin`.
*Parar si*: hay profesionales ya activos en producción a los que esto cortaría. Primero se
les avisa.

**Fase 5 — Más tarde, cada una cuando toque.** CSP en modo informe y después en bloqueo;
freno por cuenta en el acceso; enumeración en el alta (si el owner acepta el cambio de
recorrido); llaves de acceso (tras decidir el dominio; Better Auth 1.7.7); Turnstile solo
con datos.

---

## 9. Qué no sé

- **Si el límite de Better Auth ve la IP de cada persona en producción.** No leí la base ni
  los registros. Dos formas de saberlo, las dos de solo lectura:
  - En el editor SQL de Neon, rama `production`, una consulta que solo devuelve recuentos y
    ninguna IP:
    ```sql
    SELECT count(*) AS sesiones,
           count(*) FILTER (WHERE ip_address IS NULL OR ip_address = '') AS sin_ip,
           count(DISTINCT ip_address) AS ips_distintas
    FROM session
    WHERE created_at > now() - interval '30 days';
    ```
    Better Auth guarda en `session.ip_address` la misma IP que usa el límite
    (`db/internal-adapter.mjs:263`), y una cadena vacía cuando no la sabe. **A**: muchas
    IPs distintas → el límite funciona. **B1**: `sin_ip` ≈ `sesiones` → todos comparten el
    contador `no-trusted-ip`. **B2**: una o dos IPs para muchas personas → el contador es
    el de la salida de Vercel, compartido también.
  - O buscar en los registros de la API en Vercel la frase «Rate limiting could not
    determine a client IP».
- Qué pone Vercel en `x-forwarded-for` y `x-vercel-forwarded-for` cuando la web reescribe
  hacia la API. Hay que comprobarlo en la documentación de Vercel o con el dato de arriba.
- La latencia de HIBP desde `fra1`.
- El límite real de Gmail para esta cuenta (estimo ~500 destinatarios al día).
- Si el alta de un código con `otpauth://` y WebAuthn funcionan dentro de la app instalada
  en el iPhone del owner (versión de iOS **desconocida**).
- Si el *token* de Google dice algo fiable sobre cómo se autenticó la persona (no lo he
  visto en un *token* real).
- Cuántas cuentas tienen contraseña y cuántas son solo de Google, y si `professional` está
  encendido en producción: no leí producción. Afecta al impacto de las fases 2–4, no a su
  diseño.
- Cuánto pesa zxcvbn-ts con el diccionario español en el *build* de la web.

Fuentes externas: NIST SP 800-63B-4 (versión final de agosto de 2025, resumida en
<https://www.sakimura.org/en/2025/10/7710/> y <https://www.enzoic.com/blog/nist-sp-800-63b-rev4/>);
la API de rangos de Pwned Passwords, <https://api.pwnedpasswords.com/range/{prefijo}>
(medida); `npm view @better-auth/passkey` (medido).
