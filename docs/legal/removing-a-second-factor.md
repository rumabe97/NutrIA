# Procedure: removing the second factor from an account that has lost it

> **Purpose**: what the owner does, in order, when somebody writes to say they have lost their phone and their backup codes and cannot get in. **Audience**: the owner (who approves it before project 011's phase 4 ships); the lead and the agents, for reference. **Committed**: yes: with nobody's name, email or address; account addresses are never copied into the repository. **Maintained by**: the `legal` agent.
>
> **I am not a lawyer.** Every rule cites its source; anything open to interpretation is marked **[lawyer]**.
>
> The mail templates below stay in Spanish and English as they are: they are what a person is sent, not the repository's own voice.

**How the machinery works** (011 phase 4's contract): the owner requests the removal from the console; the system writes to the account's address **immediately**; if the person signs in with a code before then, the request cancels itself; if not, the daily sweep carries it out **the first time it runs after 48 hours** (between 48 and 72). The owner cannot shorten the wait. **Careful**: an account with a trusted device (30 days) or with Google linked is not asked for a code on sign-in, so signing in cancels nothing; that person has to write from the account's address and the owner cancels (§ 5).

## 1. The card

1. The request arrives **from the account's address**, and only from there. Otherwise nothing is done (§ 2).
2. Check the headers (§ 2). If something does not add up, ask for nothing and answer to the account's address (§ 5).
3. Request the removal in the console. **Never** ask for a password, codes or documents (§ 3).
4. Answer "received" with the date the console gives you (§ 4).
5. If the account writes "it wasn't me": **Cancel** first, ask afterwards (§ 5).
6. Note the expiry date of your copy of the mail (§ 6).

## 2. Checking the request is the account's

The removal is only requested if the mail comes from **exactly the same address** as the account's in the console. In Gmail: ⋮ beside "Reply" → **Show original**.

| Look at | It must be | A warning sign |
| --- | --- | --- |
| **From** (`From`) | The account's address, **character by character** (copy it from the console, not the other way round) | Another domain or ending (`.co` for `.com`), `rn` for `m`, `l` for `I`, `0` for `o`, letters from another alphabet, a `+something` the account does not have; a name that looks like the person's but a different address |
| **Reply-To** (`Reply-To`) | Absent, or identical to `From` | Any other address: the reply would go to a third party |
| **SPF**, **DKIM**, **DMARC** | All three at **PASS**, and the signed domain is `From`'s | A FAIL, a NEUTRAL, or a `mailed-by`/`signed-by` from a domain that is not `From`'s |

SPF/DKIM at PASS only proves the sender **has not spoofed the domain**; it does not prove they are the person. That is why the exact address is the check that matters, and the headers protect it from spoofing.

If the request arrives **from another address** (the person "has lost the email too"), nothing is done: there is no proportionate way of knowing they are the account holder. They are answered, **at the account's address** (not the one that wrote), with template D.

Always answer by writing a new mail to the address the console shows, never with "Reply" if there is a `Reply-To`.

<!-- Fuente: RGPD art. 32.1 (medidas apropiadas al riesgo: la dirección de la cuenta es el único canal que el sistema conoce de la persona; una cuenta con segundo factor protege datos de salud, art. 9) y 5.1.f (integridad y confidencialidad). La lista de señales (homoglifos, `Reply-To`, SPF/DKIM/DMARC) es buena práctica de seguridad, no un requisito legal. «No hay forma proporcionada»: ver § 3 y § 8. -->

## 3. What you ask for and what you do not

**You ask for**: nothing beyond the request, from the account's address.

**You never ask for or accept**: the password; any code (the app's, a backup one, one from a recovery mail); screenshots of the authenticator app; any recovery link; health data; their IP. If they are sent to you, do not use them and do not copy them anywhere; delete the mail and say so in your answer.

**Identity documents: no.** A national ID sent by mail does not prove that whoever is writing controls the account (only that an ID exists) and it adds a datum NutrIA neither has nor needs (art. 5.1.c). Control of the email address is the only link to the account, and the 48-to-72-hour wait with a notice to that address is the safeguard. Only if a law or an authority ever required it for this case would the minimum be asked for and deleted on closing; today no rule imposes it.

<!-- Fuente: RGPD art. 5.1.c (minimización) y 32.1; art. 12.6 («cuando el responsable… tenga dudas razonables en relación con la identidad de la persona física que cursa la solicitud a que se refieren los artículos 15 a 21, podrá solicitar que se facilite la información adicional necesaria para confirmar la identidad del interesado», texto del DOUE verificado el 2026-10-01): el art. 12.6 se refiere a las solicitudes de los **derechos de los arts. 15 a 21**; quitar el segundo factor no es una de ellas, así que el art. 12 solo sirve de **analogía** (si hay dudas, se pide lo mínimo necesario). Interpretación a confirmar con un abogado [abogado]: que no pedir identidad sea proporcionado aquí, y que un DNI por correo no sea una medida mejor que la dirección + demora. No cito una resolución de la AEPD concreta sobre el DNI: no la he verificado. -->

## 4. What you answer, at each step

Templates ready to paste. Write them in the language the person wrote in. Add nothing else (not what data the account holds, not whether it has a plan, nothing about health). ⟦fecha⟧ is the one the console shows.

### A. Received and scheduled

> **es** — Asunto: Tu petición para quitar la verificación en dos pasos
>
> Hola. Hemos recibido tu petición. Te acabamos de escribir un correo del sistema a esta misma dirección. A partir del ⟦fecha⟧ (y como mucho 24 horas después) quitaremos la verificación en dos pasos de tu cuenta. Si recuperas el teléfono o un código de respaldo, entra con él antes y la petición se cancela sola. Nunca te pediremos tu contraseña ni ningún código. Si al entrar no te pide el código (por ejemplo, en un dispositivo de confianza o con Google), la petición no se cancela: respóndenos a este correo y la cancelamos. Si no fuiste tú, responde «no fui yo» a este correo y la cancelamos al momento.
>
> **en** — Subject: Your request to remove two-step verification
>
> Hello. We have received your request. We have just sent you a system email to this same address. From ⟦date⟧ (and at most 24 hours later) we will remove two-step verification from your account. If you get your phone or a backup code back, sign in with it before then and the request cancels itself. We will never ask for your password or for any code. If signing in does not ask you for the code (for example, on a trusted device or with Google), the request is not cancelled: reply to this email and we will cancel it. If it was not you, reply «it wasn't me» to this email and we will cancel it right away.

### B. Cancelled

If the cancellation came from the person signing in with a code, the system writes to them already; there is no need to answer. If they asked for it by mail, or you cancelled it (§ 5):

> **es** — Hemos cancelado la petición: tu verificación en dos pasos sigue activa. Si quieres volver a pedirla, escríbenos desde esta dirección.
>
> **en** — We have cancelled the request: your two-step verification stays on. If you want to ask again, write to us from this address.

### C. Done

The system writes "We have removed your two-step verification". Answer (optional, but it closes the case):

> **es** — Hecho: hemos quitado la verificación en dos pasos de tu cuenta. Entra con tu contraseña y, desde tu perfil, vuelve a activarla con tu teléfono cuando quieras. Si no fuiste tú quien lo pidió, cambia tu contraseña ahora y escríbenos.
>
> **en** — Done: we have removed two-step verification from your account. Sign in with your password and, from your profile, turn it on again with your phone whenever you want. If you did not ask for this, change your password now and write to us.

### D. We cannot do it (another address, or headers that do not add up)

Sent **to the account's address**, not to the sender's:

> **es** — Hemos recibido una petición para quitar la verificación en dos pasos de esta cuenta que no venía de esta dirección, y no la hemos tramitado. Si fuiste tú, escríbenos desde esta dirección. Si no, no tienes que hacer nada; si quieres, cambia tu contraseña.
>
> **en** — We received a request to remove two-step verification from this account that did not come from this address, and we have not acted on it. If it was you, write to us from this address. If not, you do not need to do anything; you may change your password if you like.

<!-- Fuente: RGPD art. 12.1 (información clara y sencilla; aquí por analogía, § 3) y 32.1; los correos del sistema (petición, cancelada, hecha) son mensajes de servicio de seguridad (art. 6.1.b/f; LSSI art. 21 no aplica: no son comunicaciones comerciales) y no se pueden desactivar. «Como mucho 24 horas después» es el reflejo del cron diario (contrato 011 fase 4): si el cron cambia de frecuencia, cambia la frase. -->

## 5. If the account writes "it wasn't me"

However it arrives (replying to your mail or to the system's):

1. **Cancel at once** in the console ("Cancel"). Without asking for proof: cancelling protects the account holder and the worst consequence is a delay.
2. Answer with template B **to the account's address**.
3. Add: that they change their password and revoke the other sessions from their profile.
4. **Do not** request the removal for that account again until the holder asks again and the headers add up.
5. Note in the breach register (`breach-procedure.md` § 8) that there was an unrecognised request: an attempt to take over an account with health data, even one that was stopped, has to be **recorded**; if there were any sign that somebody got in, apply the breach procedure from the start.

<!-- Fuente: RGPD art. 32.1.b-d (capacidad de restaurar y de verificar), 33.5 (documentar toda brecha, incluso la que no se notifica) y 4.12; la decisión de cancelar sin pruebas es de proporcionalidad: la cancelación solo prolonga la protección. -->

## 6. What records exist

| Record | What it says | Period |
| --- | --- | --- |
| `audit_logs` `auth.2fa_removal_requested` | That the owner requested the removal for that account, and when. The account, only in `actorId`/`subjectUserId`; no IP; an empty `entityId` | 12 months (the `auth.*` purge, phase 7); when the account is deleted, the row is left with no person |
| `audit_logs` `auth.2fa_removal_cancelled` (`by`: `owner` or `account`) | That it was cancelled, by whom and when | The same |
| `audit_logs` `auth.2fa_removed_by_owner` | That the sweep carried it out, and when (an empty actor) | The same |
| The `two_factor_removal` row | The live request: who asked for it, when, when it falls due | While it is pending; the code deletes or closes it when it runs |
| **Your inbox** | The request and your replies: they hold the person's address | **12 months** from the case being closed, and then they are deleted. They are not copied into any repository, issue or chat |

<!-- Fuente: RGPD art. 5.1.e y 5.2; `analysis.md` § 4.1 bis (mismo plazo y mismas condiciones que las demás filas `auth.*`; la purga a 12 meses aún se construye: hasta que exista, `/privacidad` no publica el número); contrato 011 fase 4 (forma de las filas). El plazo de 12 meses para el correo es el de las filas, para que el correo no sobreviva a lo que lo explica. -->

## 7. Legal basis

- **Art. 6.1.b GDPR**: restoring access to the account the person has with NutrIA is part of the service contracted.
- **Art. 6.1.f**: the legitimate interest (*interés legítimo*) in **a false request not carrying away an account's protection**. The balancing: only the account's address is processed, and it is already held.
- **Art. 32.1**: the three measures (the exact address, an immediate notice to that address with a 48-to-72-hour wait and cancellation by code, and the record) are the technical and organisational answer to the risk of somebody impersonating the holder of an account that holds health data.
- **Art. 12** only by analogy (§ 3).
- **Art. 13**: `/privacidad` tells it in one sentence (`textos/02-politica-privacidad.md`, ⟦quitar-dos-pasos⟧).

## 8. The risk that is left, and what has to be confirmed with a lawyer

**P2, residual risk**: if whoever asks for the removal **controls the account's inbox** (the typical takeover: password and mail compromised), the notice reaches the attacker, and the 48 to 72 hours protect nothing. The wait only protects while the holder is still reading their mail. This procedure cannot close that gap without asking for data NutrIA does not have (§ 3). The owner accepts it or decides otherwise: for example, **refusing** to remove the factor if the account has an active practice plan or recent payments. That is his decision; today this document does not impose it.

To take to a lawyer in an hour **[lawyer]**:
1. That art. 12.6 GDPR neither obliges nor authorises here and that not asking for identity is proportionate (§ 3).
2. Whether § 8's residual risk is reasonable for an account with health data, or whether a second check is needed.
3. Whether keeping the mail for 12 months is proportionate, or whether less is enough.
4. That cancelling without proof on an "it wasn't me" is the prudent thing (§ 5).

**What the owner must approve**: this document as it stands, or with whatever changes he wants, before the "Remove the second factor" button reaches production.
