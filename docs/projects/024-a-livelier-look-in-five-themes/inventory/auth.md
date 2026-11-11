# Inventory: the sign-in family

Phase 0 of project 024, acceptance criterion 1. Written from the code. Scope: the 8 routes under `apps/web/src/app/(es)/(auth)/` and their 8 `en/(auth)/` twins, `AuthShell`, and every component they render.

Conventions:

- "Words" is a key path in `apps/web/src/i18n/dictionaries/es-ES.ts`; `en-GB.ts` has the same shape, so both languages are covered. `—` = not from the dictionary.
- Each Spanish route and its English twin share one screen component from `apps/web/src/app/_shared/`. They differ only in the `locale` prop (`es-ES` / `en-GB`) and the layout wrapper, so each screen is documented once with both routes in the heading. English routes are `/en/acceder` and so on (the path segments stay Spanish).
- Fields use `ui/components/Input` (`packages/ui/src/components/Input/Input.tsx`): a label, the input, an optional hint (replaced by the error when one is shown) and an error line (`aria-live="polite"`, `aria-invalid` on the input). `Button` takes `loading` (spinner while a request runs). All forms are `noValidate`, so the browser draws none of its own validation bubbles: every message below is the app's own, and an empty required field is sent to the API as an empty string except where a check is listed.
- Password limits: minimum 12 characters (`PASSWORD_MIN_LENGTH`), maximum 128 (`PASSWORD_MAX_LENGTH`), from `packages/core/src/entities/Password/Password.ts`; `{count}` in the messages is filled with those.
- Redirects owned by `apps/web/src/proxy.ts`, which applies to the Spanish and English paths alike: with a session cookie present, `/acceder`, `/acceder/codigo` and `/registro` redirect to `/inicio`; without one, `/pendiente` and `/cambiar-contrasena` redirect to `/acceder?siguiente=<path>`; `/acceder/codigo` without a session or the two-factor cookie redirects to `/acceder`; an unprefixed auth path is redirected to its `/en` twin when the locale cookie says English.
- Metadata (`pages[...]` keys, `title` shown in the tab, optionally `description`) are listed per route. `/acceder` and `/registro` are indexable; `/acceder/codigo`, `/cambiar-contrasena`, `/pendiente`, `/recuperar`, `/restablecer`, `/verificar-email` are `noindex, follow`.

## Shared S1. AuthShell and the auth layouts (apps/web/src/app/_shared/AuthShell.tsx, apps/web/src/app/(es)/(auth)/layout.tsx, apps/web/src/app/en/(auth)/layout.tsx)
Frames every auth route: a centred card. Inside RootShell of the public trees (skip link and announcer, see `shell.md`; also `SiteJsonLd`, see `public.md` A2). No SiteHeader and no SiteFooter on these screens.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| S1.1 | Brand link to home in the language being read (`withLocale('/', locale)`): decorative mark plus the word "NutrIA"; accessible name "NutrIA — inicio" | link | `app/_shared/AuthShell.tsx` | `siteNav.brandHome` (name); "NutrIA" literal | always |
| S1.2 | Language switch, compact: group "Idioma" with toggles "ES" / "EN" (names "Español" / "English"), `aria-pressed`, disabled while one is pending. Writes the cookie, tries `PATCH /profile` (404 swallowed when signed out), then navigates to the same page's other-language URL keeping the query string (so a `?token=` or `?siguiente=` survives) | toggle | `components/LocaleSwitcher/LocaleSwitcher.tsx` | group label `profile.locale`; marks and names literal | always |
| S1.3 | `<main id="contenido">` around the screen (skip-link and route-announcer target) | text (landmark) | `app/_shared/AuthShell.tsx`, `app/_shared/mainId.ts` | — | always |
| S1.4 | Loading skeleton while an auth route resolves: wave skeleton bar, a thin one, and two input-height bars | status (visual only) | `app/_shared/AuthLoading.tsx` via `app/(es)/(auth)/loading.tsx` and `app/en/(auth)/loading.tsx` | — | while the route loads (mainly the per-request `/pendiente` and `/cambiar-contrasena`) |

## Shared S2. LegalNotice (apps/web/src/components/LegalNotice/LegalNotice.tsx)
Rendered above the sign-up form and, on sign-in, above the provider buttons.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| S2.1 | One centred sentence with two inline links: sign-up variant "Al crear tu cuenta aceptas las {terms}. Cómo tratamos tus datos te lo explica la {privacy}."; sign-in variant "Si es la primera vez que entras con Google o Apple, se crea tu cuenta y aceptas las {terms}. …" | text | `components/LegalNotice/LegalNotice.tsx` | `auth.legalNotice` (sign-up), `auth.legalNoticeSignIn` (sign-in) | sign-up: always; sign-in: only when at least one social provider button is drawn |
| S2.2 | Link "condiciones de uso" to `/condiciones` in the current language, opens a new tab (`target=_blank`, `rel=noopener noreferrer`) with a visually hidden suffix " (se abre en una pestaña nueva)" | link | same | `auth.legalTerms`, `auth.legalOpensInTab` | with S2.1 |
| S2.3 | Link "política de privacidad" to `/privacidad`, new tab, same hidden suffix | link | same | `auth.legalPrivacy`, `auth.legalOpensInTab` | with S2.1 |
| S2.4 | Age line "Necesitas tener al menos 18 años para crear una cuenta." | text | same | `auth.legalAge` | with S2.1 |

## Shared S3. SocialSignIn (apps/web/src/components/SocialSignIn/SocialSignIn.tsx)
On `/acceder` and `/registro`. Renders nothing at all, divider included, when the API lists no provider (`GET /settings/sign-in-providers`, cached 5 minutes server side, any failure = no buttons). Providers drawn: Google, then Apple, only those the API reports.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| S3.1 | One secondary button per provider "Continuar con Google" / "Continuar con Apple" with the provider's mark (mark hidden while that button is loading). Pressing clears copies of the previous user's plan, marks the arrival (sessionStorage), and calls the social sign-in with callbacks: success to `siguiente` (own path only) or `/inicio`; error back to `/acceder` in the current language; new user to `/onboarding`. While one is leaving the other is disabled | button | `components/SocialSignIn/SocialSignIn.tsx`, `ProviderMark.tsx` | `auth.continueWith` with literal provider names "Google" / "Apple" | per provider the API reports |
| S3.2 | Failure alert "No hemos podido completar el acceso. Inténtalo de nuevo o entra con tu correo." (`role="alert"`) when the social call is refused | notice | same | `auth.socialFailed` | after a refused provider call |
| S3.3 | Divider text "o con tu correo" | text | same | `auth.orWithEmail` | whenever any provider is drawn |

## Shared S4. PasswordMeter (apps/web/src/components/PasswordMeter/PasswordMeter.tsx)
Under every "new password" field (registration, reset, change). Length only, never strength.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| S4.1 | Bar that fills with length (full at 20 characters), decorative (`aria-hidden`) | figure | `components/PasswordMeter/PasswordMeter.tsx` | — | always |
| S4.2 | Level line, polite live region: empty (nothing) at 0; "Longitud: corta." under 12; "Longitud: suficiente." from 12 to 19; "Longitud: buena." from 20; "Longitud: demasiado larga." over 128 | status | same, `passwordMeter.ts` | `auth.passwordMeterShort`, `.passwordMeterEnough`, `.passwordMeterLong`, `.passwordMeterTooLong` | always (text depends on length) |
| S4.3 | Missing count beside the level, only while short and not empty: "Faltan {count} caracteres." or "Falta 1 carácter." | status | same | `auth.passwordMeterMissing`, `auth.passwordMeterMissingOne` | length 1 to 11 |
| S4.4 | Standing hint "Mínimo 12 caracteres. Mejor una frase de varias palabras." | text | same | `auth.passwordHint`, `auth.passwordStrengthHint` | always |

Password refusal messages shared by sign-up, reset and change (`lib/newPassword.ts`, `passwordRefusalMessage`):

| Code | Message | Words |
|---|---|---|
| `PASSWORD_TOO_SHORT` (checked in the browser before sending) | "La contraseña debe tener al menos {count} caracteres." | `auth.passwordTooShort` |
| `PASSWORD_TOO_LONG` (browser) | "La contraseña puede tener como máximo {count} caracteres." | `auth.passwordTooLong` |
| has-context (API) | "La contraseña no puede contener tu nombre, tu correo ni «nutria». Elige otra." | `auth.passwordHasContext` |
| compromised (API) | "Esa contraseña aparece en filtraciones conocidas. Elige otra: mejor una frase de varias palabras." | `auth.passwordCompromised` |

## /acceder and /en/acceder  — Sign in (apps/web/src/app/_shared/SignInScreen.tsx + apps/web/src/components/SignInForm/SignInForm.tsx; pages apps/web/src/app/(es)/(auth)/acceder/page.tsx, apps/web/src/app/en/(auth)/acceder/page.tsx)
Signed-out visitors. With a session the proxy redirects to `/inicio`. Tab title `pages['/acceder']` ("Acceder"), indexable, with description. Query inputs: `?siguiente=<path>` (own paths only, via `lib/ownPath`) where to go afterwards; `?error=<code>` from a provider that sent the person back without a session. Wrapped in Suspense (fallback nothing).

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | AuthShell (brand link, language switch) | link, toggle | `app/_shared/AuthShell.tsx` | see S1.1-S1.2 | always |
| 2 | Heading h1 "Bienvenido de nuevo" | heading | `app/_shared/SignInScreen.tsx` | `auth.signInTitle` | always |
| 3 | Subtitle "Accede para ver tu plan de hoy." | text | same | `auth.signInSubtitle` | always |
| 4 | Legal notice (sign-in variant) with the two links and the age line | text, link | `components/LegalNotice/LegalNotice.tsx` | see S2.1-S2.4 | only when at least one provider is drawn |
| 5 | Provider buttons, their failure alert and the "o con tu correo" divider | button, notice, text | `components/SocialSignIn/SocialSignIn.tsx` | see S3.1-S3.3 | per providers the API lists |
| 6 | Arrival error alert from a provider's return (`?error=`): `account_not_linked` gives "Ya hay una cuenta con esa dirección. Entra como la creaste o, si fue con contraseña, restablécela en «¿Has olvidado tu contraseña?»."; `access_denied` (pressing Cancel at the provider) shows nothing; any other code gives "No hemos podido completar el acceso. Inténtalo de nuevo o entra con tu correo." (`role="alert"`) | notice | `components/SignInForm/SignInForm.tsx` (`arrivalError`) | `auth.socialNotLinked`, `auth.socialFailed` | on arrival with `?error=` set; replaced by any later form error |
| 7 | Form alert (`role="alert"`, remounted on each submit so a repeat is announced again) | notice | same | see rows 15-19 | after a refused attempt that is not a credentials refusal, or after a refused passkey from autofill |
| 8 | Field "Correo electrónico" (`type=email`, `autocomplete="username webauthn"` so the browser offers passkeys among suggestions, required) | field | same | `auth.email` | always |
| 9 | Field "Contraseña" (`type=password`, `autocomplete=current-password`, required); error shown on the field, cleared on edit | field | same | `auth.password` | always |
| 10 | Link "¿Has olvidado tu contraseña?" to `/recuperar` (unprefixed; the proxy sends English readers to `/en/recuperar`) | link | same | `auth.forgotPassword` | always |
| 11 | Submit button "Acceder", label "Accediendo…" with spinner while pending; disabled while the passkey prompt runs | button | same | `auth.signIn`, `auth.signingIn` | always |
| 12 | Passkey error alert above the passkey button (`role="alert"`) | notice | same | `passkeys.signInFailed`, `auth.tooManyAttempts` | after a refused passkey sign-in started from the button |
| 13 | Secondary button "Entrar con llave de acceso" (spinner while its prompt runs; disabled while the password submit runs) | button | same | `passkeys.signIn` | only in a browser that supports WebAuthn (appears after the first client render) |
| 14 | Footer line "¿Aún no tienes cuenta?" with link "Crea la tuya" to `/registro` (unprefixed) | text, link | same | `auth.noAccount`, `auth.toSignUp` | always |
| 15 | State: wrong password, unknown address, or unconfirmed account with the right password (API 401) gives one message on the password field: "Correo o contraseña incorrectos. Si aún no has confirmado tu dirección y la contraseña era la buena, te enviamos el enlace de nuevo (como mucho tres veces por hora; mira también en el correo no deseado)." | notice (field error) | same, `lib/authAnswer.ts` (`signInRefusal`) | `auth.invalidCredentials` | on a 401 |
| 16 | State: rate limited (429) "Demasiados intentos; prueba dentro de un rato." in the alert | notice | same | `auth.signInPaused` | on a 429 |
| 17 | State: any other failure "No hemos podido iniciar sesión (error {status}). Inténtalo de nuevo en un momento." in the alert | notice | same | `auth.signInUnavailable` | any other status |
| 18 | State: passkey refused. A prompt the person closes says nothing; a 429 gives "Demasiados intentos seguidos. Espera un momento y vuelve a probar."; anything else "No se pudo entrar con la llave de acceso. Prueba otra vez o entra con tu contraseña." (button path: in row 12; autofill path: in the form alert, row 7) | notice | same, `lib/passkey.ts` | `auth.tooManyAttempts`, `passkeys.signInFailed` | on a passkey refusal |
| 19 | State: two-factor on. The password was right but no session exists: navigates to `/acceder/codigo` (language-prefixed), carrying `siguiente` | status (navigation) | same | — | when the API answers a two-factor redirect |
| 20 | State: success. Clears the previous user's offline copies, syncs the browser language from the profile, navigates to `siguiente` (own path) or `/inicio`, refreshes | status (navigation) | same | — | on a signed-in answer, or a completed passkey sign-in |

## /acceder/codigo and /en/acceder/codigo  — Two-factor code (apps/web/src/app/_shared/TwoFactorScreen.tsx + apps/web/src/components/TwoFactorChallenge/TwoFactorChallenge.tsx; pages apps/web/src/app/(es)/(auth)/acceder/codigo/page.tsx, apps/web/src/app/en/(auth)/acceder/codigo/page.tsx)
Second step of a sign-in with two-factor on. Needs the short-lived two-factor cookie: without it (and without a session) the proxy sends the visit back to `/acceder`; with a session it redirects to `/inicio`. Tab title `pages['/acceder/codigo']` ("Verificación en dos pasos"), `noindex`. Reads `?siguiente=`. Suspense, fallback nothing. No autofocus (the route announcer focuses the title).

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | AuthShell | link, toggle | `app/_shared/AuthShell.tsx` | see S1.1-S1.2 | always |
| 2 | Heading h1 "Verificación en dos pasos" | heading | `app/_shared/TwoFactorScreen.tsx` | `twoFactor.challengeTitle` | always |
| 3 | Subtitle, authenticator mode: "Tu cuenta tiene activada la verificación en dos pasos. Escribe el código que muestra ahora tu app de autenticación." | text | `components/TwoFactorChallenge/TwoFactorChallenge.tsx` | `twoFactor.challengeSubtitle` | method = authenticator code (default) |
| 4 | Subtitle, backup mode: "Escribe uno de los códigos de respaldo que guardaste al activarla. Cada uno sirve una sola vez." | text | same | `twoFactor.challengeBackupSubtitle` | method = backup code |
| 5 | Form alert (`role="alert"`, remounted per submit) carrying the same text as the field error or a non-field refusal | notice | same | see rows 12-17 | after a refusal |
| 6 | Field "Código de verificación" (text, `autocomplete=one-time-code`, numeric keyboard, enter key hint "go", required) with hint "El código de 6 cifras que muestra tu app de autenticación."; the hint is replaced by the error when present. One field, no length cap (a pasted `123 456` is not cut); spaces, dots and dashes are stripped | field | same | `twoFactor.code`, `twoFactor.codeHint` | authenticator mode |
| 7 | Field "Código de respaldo" (text, no autocapitalise / autocorrect / spellcheck, not translated, required) with hint "Uno de los 10 que guardaste: 10 letras y números con un guion."; 10 characters without the dash are accepted and the dash is added | field | same | `twoFactor.backupCode`, `twoFactor.backupCodeHint` | backup mode |
| 8 | Checkbox "Confiar en este dispositivo 30 días" with description "No te pediremos el código en este navegador durante 30 días. No lo marques en un dispositivo compartido." (off by default) | toggle | same, `ui/components/Checkbox` | `twoFactor.trustDevice`, `twoFactor.trustDeviceHint` | always while the form is shown |
| 9 | Submit button "Verificar", label "Verificando…" with spinner while pending | button | same | `twoFactor.verify`, `twoFactor.verifying` | always while the form is shown |
| 10 | Tertiary button switching method: "Usar un código de respaldo" in authenticator mode, "Usar el código de la app" in backup mode (disabled while pending; focus moves to the new field) | button | same | `twoFactor.useBackup`, `twoFactor.useApp` | always while the form is shown |
| 11 | Link "Volver a acceder" to `/acceder` in the current language, keeping `siguiente`; always a way out | link | same | `auth.backToSignIn` | always |
| 12 | Field error: authenticator code not 6 digits "El código tiene 6 cifras." | notice (field error) | same, `lib/twoFactor.ts` | `twoFactor.codeMissing` | client check on submit, authenticator mode |
| 13 | Field error: backup code malformed "Un código de respaldo son 10 letras y números con un guion, como abcde-12345." | notice (field error) | same | `twoFactor.backupCodeMissing` | client check on submit, backup mode |
| 14 | Field error: wrong authenticator code "El código no es correcto. Escribe el que muestra la app ahora; si sigue fallando, comprueba que la hora del móvil es automática." | notice (field error) | same | `twoFactor.wrongCode` | API `INVALID_CODE` |
| 15 | Field error: wrong or used backup code "Ese código de respaldo no es válido o ya se usó." | notice (field error) | same | `twoFactor.wrongBackupCode` | API `INVALID_BACKUP_CODE` |
| 16 | Alert only, rate limited "Demasiados intentos seguidos. Espera un momento y vuelve a probar."; other failure "No hemos podido iniciar sesión (error {status}). Inténtalo de nuevo en un momento." | notice | same | `auth.tooManyAttempts`, `auth.signInUnavailable` | on a 429, or any other failed status |
| 17 | State, form replaced: the pending sign-in is gone. A focused paragraph with the reason and a primary button "Volver a acceder" (keeping `siguiente`). Reasons: "Demasiados códigos incorrectos en este acceso. Vuelve a acceder para empezar de nuevo." (`TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE`); "Demasiados intentos fallidos. Espera 15 minutos y vuelve a acceder." (`ACCOUNT_TEMPORARILY_LOCKED`); "Ha pasado demasiado tiempo. Vuelve a acceder." (`INVALID_TWO_FACTOR_COOKIE`) | notice, link (button look) | same, `components/CtaLink/CtaLink.tsx` | `twoFactor.attemptsSpent`, `twoFactor.locked`, `twoFactor.expired`, `auth.backToSignIn` | after those API codes |
| 18 | State, success: clears offline copies, syncs language from the profile, navigates to `siguiente` or `/inicio` | status (navigation) | same | — | on a correct code |

## /registro and /en/registro  — Create account (apps/web/src/app/_shared/RegisterScreen.tsx; pages apps/web/src/app/(es)/(auth)/registro/page.tsx, apps/web/src/app/en/(auth)/registro/page.tsx)
Signed-out visitors; with a session the proxy redirects to `/inicio`. Tab title `pages['/registro']` ("Crear tu cuenta"), indexable, with description. Providers come from the server page (`signInProviders()`). Sign-up opens no session: the screen only ever says "check your email".

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | AuthShell | link, toggle | `app/_shared/AuthShell.tsx` | see S1.1-S1.2 | always |
| 2 | Heading h1 "Crea tu cuenta" | heading | `app/_shared/RegisterScreen.tsx` | `auth.createAccount` | form state |
| 3 | Subtitle "Unos minutos de preguntas y tendrás tu primer plan de catorce días." | text | same | `auth.createAccountSubtitle` | form state |
| 4 | Legal notice (sign-up variant) with both links and the age line, above every account-creating control | text, link | `components/LegalNotice/LegalNotice.tsx` | see S2.1-S2.4 | form state, always |
| 5 | Provider buttons, failure alert, "o con tu correo" divider; new accounts go to `/onboarding` | button, notice, text | `components/SocialSignIn/SocialSignIn.tsx` | see S3.1-S3.3 | per providers the API lists |
| 6 | Form alert (`role="alert"`, remounted per submit) | notice | `app/_shared/RegisterScreen.tsx` | see rows 14-16 | after a refusal |
| 7 | Field "Nombre" (text, `autocomplete=name`, required, keeps what was typed after "Usar otro correo") | field | same | `auth.name` | form state |
| 8 | Field "Correo electrónico" (email, `autocomplete=email`, required; refocused when coming back from the sent state) | field | same | `auth.email` | form state |
| 9 | Field "Contraseña" (password, `autocomplete=new-password`, min 12 / max 128 declared via `passwordrules`, required) with the meter's hints as description; the refusal is shown on the field and cleared on edit | field | same | `auth.password` | form state |
| 10 | PasswordMeter (bar, level, missing count, hint) | figure, status, text | `components/PasswordMeter/PasswordMeter.tsx` | see S4.1-S4.4 | form state |
| 11 | Submit button "Crear mi plan", label "Creando tu cuenta…" with spinner while pending | button | `app/_shared/RegisterScreen.tsx` | `auth.signUp`, `auth.signUpPending` | form state |
| 12 | Footer "¿Ya tienes cuenta?" with link "Accede" to `/acceder` in the current language | text, link | same | `auth.haveAccount`, `auth.toSignIn` | form state |
| 13 | State, validation: password under 12 or over 128 characters is refused before sending, on the field and in the alert | notice | same, `lib/newPassword.ts` | `auth.passwordTooShort`, `auth.passwordTooLong` | on submit |
| 14 | State, API password refusals (has-context, compromised) on the field and in the alert | notice | same | `auth.passwordHasContext`, `auth.passwordCompromised` | on those API codes |
| 15 | State, rate limited "Demasiados intentos seguidos. Espera un momento y vuelve a probar." in the alert | notice | same | `auth.tooManyAttempts` | on a 429 |
| 16 | State, generic failure "No hemos podido crear la cuenta. Inténtalo de nuevo." in the alert. There is deliberately no "email already registered" message (account enumeration) | notice | same | `auth.signUpFailed` | any other refusal |
| 17 | State "check your email" (replaces the form on the same page; focus moves to its heading, tab title becomes "Revisa tu correo · NutrIA"): heading h1 "Revisa tu correo" | heading | same, `lib/authAnswer.ts` (`arriveAtSent`) | `auth.checkEmail` | after a successful or indistinguishable answer |
| 18 | Sent message (success box) "Si {email} es correcta, te llegará un correo en unos minutos. Abre el enlace, confirma tu correo y luego inicia sesión." | notice | same | `auth.signUpSent` | sent state |
| 19 | Note for iPhone and home-screen installs "En iPhone el enlace se abre en Safari. Confirma allí tu correo y, si usas NutrIA desde la pantalla de inicio, vuelve después a la app e inicia sesión con tu correo y tu contraseña." | text | same | `auth.signUpSentInstalled` | sent state |
| 20 | Secondary button "Usar otro correo": back to the form with name and email as typed, focus on the email field | button | same | `auth.useAnotherEmail` | sent state |
| 21 | Link "Volver a acceder" to `/acceder` | link | same | `auth.backToSignIn` | sent state |
| 22 | Side effect on success: clears offline copies of a previous user on this device | status (invisible) | same | — | on success |

## /recuperar and /en/recuperar  — Recover password (apps/web/src/app/_shared/RecoverScreen.tsx; pages apps/web/src/app/(es)/(auth)/recuperar/page.tsx, apps/web/src/app/en/(auth)/recuperar/page.tsx)
Public, client-only form. Tab title `pages['/recuperar']` ("Recuperar tu contraseña"), `noindex`. The request carries the reading language (`Accept-Language`) and a `redirectTo` of the reset page in that language.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | AuthShell | link, toggle | `app/_shared/AuthShell.tsx` | see S1.1-S1.2 | always |
| 2 | Heading h1 "Recuperar contraseña" | heading | `app/_shared/RecoverScreen.tsx` | `auth.recoverTitle` | form state |
| 3 | Subtitle "Escribe tu correo y te enviaremos un enlace para elegir una nueva." | text | same | `auth.recoverSubtitle` | form state |
| 4 | Field "Correo electrónico" (email, `autocomplete=email`, required; no client validation) | field | same | `auth.email` | form state |
| 5 | Submit button "Enviar enlace", label "Enviando…" with spinner while pending | button | same | `auth.sendLink`, `auth.sending` | form state |
| 6 | Link "Volver a acceder" to `/acceder` in the current language | link | same | `auth.backToSignIn` | form state |
| 7 | State, sent: heading h1 "Revisa tu correo" | heading | same | `auth.checkEmail` | after submit, always the same whether or not the address exists |
| 8 | Sent message (success box) "Si existe una cuenta con ese correo, te hemos enviado un enlace para restablecer la contraseña. Caduca en una hora." | notice | same | `auth.recoverSent` | sent state |
| 9 | Link "Volver a acceder" | link | same | `auth.backToSignIn` | sent state |
| 10 | No error state: the call's result is ignored on purpose; there is no rate-limit or failure message on this screen | — | same | — | — |

## /restablecer and /en/restablecer  — Choose a new password (apps/web/src/app/_shared/ResetScreen.tsx + apps/web/src/components/ResetPasswordForm/ResetPasswordForm.tsx; pages apps/web/src/app/(es)/(auth)/restablecer/page.tsx, apps/web/src/app/en/(auth)/restablecer/page.tsx)
Where the mailed reset link lands (`?token=`). Tab title `pages['/restablecer']` ("Elegir una contraseña nueva"), `noindex`. Suspense, fallback nothing.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | AuthShell | link, toggle | `app/_shared/AuthShell.tsx` | see S1.1-S1.2 | always |
| 2 | Heading h1 "Elige una contraseña nueva" | heading | `app/_shared/ResetScreen.tsx` | `auth.chooseNewPassword` | always |
| 3 | Subtitle "Después podrás acceder con ella. Si tenías llaves de acceso, las quitamos: podrás añadirlas de nuevo desde tu perfil." | text | same | `auth.chooseNewPasswordSubtitle` | always |
| 4 | State, no token in the address: alert "Este enlace no es válido o ha caducado." and link "Pedir un enlace nuevo" to `/recuperar` in the current language; no form | notice, link | `components/ResetPasswordForm/ResetPasswordForm.tsx` | `auth.invalidLink`, `auth.askNewLink` | when `?token` is missing |
| 5 | Form alert (`role="alert"`, remounted per submit) | notice | same | see rows 11-14 | after a refusal |
| 6 | Link "Pedir un enlace nuevo" above the fields | link | same | `auth.askNewLink` | after the API says the token is invalid or expired (`INVALID_TOKEN`) |
| 7 | Field "Nueva contraseña" (password, `autocomplete=new-password`, min/max via `passwordrules`, required; error on the field, cleared on edit) | field | same | `auth.newPassword` | token present |
| 8 | PasswordMeter | figure, status, text | `components/PasswordMeter/PasswordMeter.tsx` | see S4.1-S4.4 | token present |
| 9 | Field "Repite la contraseña" (password, `autocomplete=new-password`, required; error on the field, cleared on edit) | field | same | `auth.confirmPassword` | token present |
| 10 | Submit button "Guardar contraseña", label "Guardando…" with spinner while pending | button | same | `auth.savePassword`, `common.saving` | token present |
| 11 | Validation: length under 12 or over 128 on the new-password field and alert | notice | same | `auth.passwordTooShort`, `auth.passwordTooLong` | on submit |
| 12 | Validation: confirmation differs "Las contraseñas no coinciden." on the confirm field and alert | notice | same | `auth.passwordsDoNotMatch` | on submit |
| 13 | API refusals on the new-password field: has-context, compromised; an unclassified failure "Algo ha ido mal por nuestra parte. Inténtalo de nuevo en un momento."; a 429 "Demasiados intentos seguidos. Espera un momento y vuelve a probar." | notice | same | `auth.passwordHasContext`, `auth.passwordCompromised`, `errors.internal`, `auth.tooManyAttempts` | after the API answers |
| 14 | Expired or spent link: alert "Este enlace no es válido o ha caducado." plus row 6 | notice | same | `auth.invalidLink` | `INVALID_TOKEN` |
| 15 | Success: navigates to `/acceder` in the current language. No confirmation message on this screen | status (navigation) | same | — | on success |

## /cambiar-contrasena and /en/cambiar-contrasena  — Forced password change (apps/web/src/app/_shared/ForcedPasswordScreen.tsx + apps/web/src/components/ChangePasswordForm/ChangePasswordForm.tsx; pages apps/web/src/app/(es)/(auth)/cambiar-contrasena/page.tsx, apps/web/src/app/en/(auth)/cambiar-contrasena/page.tsx)
Per-request (`force-dynamic`). Where an account whose password turned up in a breach is held. Server-side redirects: no user to `/acceder`; locks not open (not activated or email unverified) to `/pendiente`; no change required to `/inicio`. Without a session cookie the proxy redirects to `/acceder?siguiente=…`. Tab title `pages['/cambiar-contrasena']` ("Cambia tu contraseña"), `noindex`. The same form (`ChangePasswordForm`) is also used unforced inside the profile's Security card (documented with the profile screen, not here).

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | AuthShell | link, toggle | `app/_shared/AuthShell.tsx` | see S1.1-S1.2 | always |
| 2 | Heading h1 "Cambia tu contraseña" | heading | `app/_shared/ForcedPasswordScreen.tsx` | `security.forcedTitle` | always |
| 3 | Intro (why it is forced: password found in known breaches, nothing implies someone got in; saving it signs out other devices and removes passkeys) | text | `components/ChangePasswordForm/ChangePasswordForm.tsx` | `security.forcedBody` | form state only (gone once changed) |
| 4 | Hidden username field holding the account's email, for password managers (never shown or sent) | field (hidden) | same | — | form state |
| 5 | Form alert (`role="alert"`) | notice | same | see rows 12-16 | after a refusal |
| 6 | Status line for the confirmation (visually hidden until it has words; `role="status"`) | status | same | `security.passwordChanged` | after a successful change in the unforced use; on this screen the confirmation block replaces the form (row 17) |
| 7 | Field "Contraseña actual" (password, `autocomplete=current-password`, required; error on field) | field | same | `security.currentPassword` | form state |
| 8 | Field "Nueva contraseña" (password, `autocomplete=new-password`, required, min/max) | field | same | `auth.newPassword` | form state |
| 9 | PasswordMeter | figure, status, text | `components/PasswordMeter/PasswordMeter.tsx` | see S4.1-S4.4 | form state |
| 10 | Field "Repite la contraseña" (password, `autocomplete=new-password`, required) | field | same | `auth.confirmPassword` | form state |
| 11 | Submit button "Cambiar contraseña", label "Guardando…" with spinner | button | same | `security.changePassword`, `common.saving` | form state |
| 12 | Validation: current password empty "Escribe tu contraseña actual." (focus to that field) | notice | same | `security.currentPasswordMissing` | on submit |
| 13 | Validation: new password length (too short / too long) | notice | same | `auth.passwordTooShort`, `auth.passwordTooLong` | on submit |
| 14 | Validation: confirmation differs | notice | same | `auth.passwordsDoNotMatch` | on submit |
| 15 | API refusals: has-context, compromised on the new field; wrong current password "La contraseña actual no es correcta." on the current field | notice | same | `auth.passwordHasContext`, `auth.passwordCompromised`, `security.wrongCurrentPassword` | after the API answers |
| 16 | 429 "Demasiados intentos seguidos. Espera un momento y vuelve a probar."; any other failure "Algo ha ido mal por nuestra parte. Inténtalo de nuevo en un momento." (alert only) | notice | same | `auth.tooManyAttempts`, `errors.internal` | after the API answers |
| 17 | State, changed: the form is replaced by a focused success box "Contraseña cambiada. Hemos cerrado la sesión en tus otros dispositivos." and a primary link "Continuar" to `/inicio` | notice, link | same | `security.passwordChanged`, `common.continue` | forced mode after success |
| 18 | Link-button "Cerrar sesión" (signs out: forgets push on this device, ends the session, forgets offline copies, goes to `/`) | button | `components/SignOutLink/SignOutLink.tsx` | `security.forcedSignOut` | form state and (below the confirmation) always on this screen |

## /pendiente and /en/pendiente  — Account pending (apps/web/src/app/_shared/PendingScreen.tsx; pages apps/web/src/app/(es)/(auth)/pendiente/page.tsx, apps/web/src/app/en/(auth)/pendiente/page.tsx)
Per-request (`force-dynamic`). Where a signed-in account waits while one of its two locks is closed (email unconfirmed; owner has not opened the account). Redirects: no user to `/acceder`; both locks open to `/inicio`. Without a session cookie the proxy redirects to `/acceder?siguiente=/pendiente`. Tab title `pages['/pendiente']` ("Cuenta pendiente"), `noindex`. Heading and body vary by state; `{email}` is the account's address.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | AuthShell | link, toggle | `app/_shared/AuthShell.tsx` | see S1.1-S1.2 | always |
| 2 | Heading h1 "Cuenta pendiente de activación" | heading | `app/_shared/PendingScreen.tsx` | `auth.pendingTitle` | email confirmed, account not yet activated |
| 3 | Heading h1 "Confirma tu correo" | heading | same | `auth.pendingConfirmTitle` | email not confirmed |
| 4 | Body "Estamos abriendo NutrIA poco a poco. Activaremos tu cuenta ({email}) en cuanto podamos y te avisaremos por correo." | text | same | `auth.pendingBody` | email confirmed, owner has not opened the account |
| 5 | Body "Te hemos enviado un enlace a {email}. Ábrelo y vuelve aquí, o inicia sesión en el dispositivo donde lo abras: no hace falta nada más." | text | same | `auth.pendingConfirmBody` | email not confirmed, and confirming is the last step (account already activated, or automatic activation is on) |
| 6 | Body "Te hemos enviado un enlace a {email}. Confírmalo y, en cuanto abramos tu cuenta, inicia sesión para empezar." | text | same | `auth.pendingConfirmWaitBody` | email not confirmed and the owner still has to open the account (also the case when the settings could not be read) |
| 7 | Secondary button "Volver a comprobar": a full document load of `/inicio` (not client navigation), spinner while it loads; the spinner is reset when the page is restored from the back-forward cache | button | `components/CheckAgainButton/CheckAgainButton.tsx` | `auth.pendingCheck` | always |
| 8 | Link-button "Cerrar sesión": forgets push on this device, signs out, forgets offline copies, goes to `/` | button | `components/SignOutLink/SignOutLink.tsx` | `auth.pendingSignOut` | always |

## /verificar-email and /en/verificar-email  — Email confirmed (apps/web/src/app/_shared/VerifyEmailScreen.tsx + apps/web/src/components/EmailConfirmed/EmailConfirmed.tsx, EmailConfirmedFromLink.tsx; pages apps/web/src/app/(es)/(auth)/verificar-email/page.tsx, apps/web/src/app/en/(auth)/verificar-email/page.tsx)
Where every confirmation link lands after the API verified it. Signs nobody in. Static; the confirmed state is the Suspense fallback and `?error` (any value) switches to the refused state. Focus goes to the heading. Tab title `pages['/verificar-email']` ("Correo confirmado"), `noindex`.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | AuthShell | link, toggle | `app/_shared/AuthShell.tsx` | see S1.1-S1.2 | always |
| 2 | Heading h1 "Correo confirmado" | heading | `components/EmailConfirmed/EmailConfirmed.tsx` | `auth.verifyTitle` | confirmed state |
| 3 | Success box "Ahora inicia sesión con tu correo y tu contraseña." | notice | same | `auth.verifyBody` | confirmed state |
| 4 | Warning line "¿No creaste tú la cuenta, o no sabes su contraseña? No la adivines:" followed by link "restablécela ahora mismo, y se cerrará cualquier otra sesión abierta en ella." to `/recuperar` in the current language | text, link | same | `auth.verifyNotYours`, `auth.verifyReset` | confirmed state |
| 5 | Heading h1 "Este enlace ya no sirve" | heading | same | `auth.verifyFailedTitle` | refused state (`?error` present: expired or already used) |
| 6 | Plain paragraph "Puede que haya caducado o que ya lo hayas usado. Si ya confirmaste tu correo, inicia sesión." | text | same | `auth.verifyFailedBody` | refused state |
| 7 | Link "Iniciar sesión" to `/acceder` in the current language | link | same | `auth.verifySignIn` | both states |

## Counts

Routes covered: 8 Spanish plus 8 English twins (16 URLs) on 8 screens, plus the two layouts and one loading file. Rows: S1 4, S2 4, S3 3, S4 4 plus a 4-line refusal table (15); `/acceder` 20; `/acceder/codigo` 18; `/registro` 22; `/recuperar` 10; `/restablecer` 15; `/cambiar-contrasena` 18; `/pendiente` 8; `/verificar-email` 7. Total 133 rows (the four shared blocks are counted once).

## Not sure

- `ui/components/Button` `loading` rendering (spinner markup, whether the label stays in the accessibility tree, `aria-busy`) was not read; recorded only as "spinner".
- `ui/components/Label` was not read: if it draws a required marker (asterisk) for `required` fields, that is a perceivable element on every field here and is not listed.
- The `Checkbox` primitive (`packages/ui/src/components/Checkbox/Checkbox.tsx`) is Radix based; its checked mark is not described.
- `lib/passkey.ts` `CANCELLED` code set (what counts as "the person closed the prompt") was read only as a name.
- `AuthForm.module.css` breakpoints and the card width (`AuthShell.module.css`) were not read; there may be responsive hiding I have not seen. The language switch is not hidden by any rule I saw.
- Better Auth email-verification and reset-link endpoints live in the API (outside this scope); only their landing pages are inventoried. The sign-up conveyance of "check your email" is the same text for new and existing addresses by design.
- On `/pendiente` the account's address appears in the body; the `{email}` value is user data, not a dictionary string.
- `lib/auth-client.ts` social/passkey plugin behaviour on a 429 versus a cancelled prompt was assumed from the callers' comments.
- The `ChangePasswordForm` unforced usage inside the profile (Security card) shares rows 4-16 of `/cambiar-contrasena` but is a different screen: its inventory belongs with the profile.
- Whether a signed-in person who opens `/recuperar`, `/restablecer` or `/verificar-email` is redirected: the proxy does not redirect them (only `/acceder`, `/acceder/codigo`, `/registro`), so these three remain reachable signed in. Recorded as the current behaviour.
