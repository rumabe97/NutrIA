import { accountWaitingEmail } from '../../email/templates/AccountWaiting.js';
import { activationToken } from './ActivationLink.js';

import type { EmailLocale } from '../../email/templates/Layout.js';
import type { EmailService } from '../../email/services/Email.service.js';

const OWNER_LOCALE: EmailLocale = 'es-ES';

/**
 * Tells the owner that an account is waiting to be opened (`0017`, `0029`).
 *
 * Sent when somebody confirms their address and the door is shut, which is the
 * only moment there is anything for the owner to do (`0031`, amended). Not on
 * sign-up: with the door open the account opens itself, and with it shut there
 * is no sign-up to report.
 *
 * Never throws and is never awaited by the caller: a sign-up that failed
 * because the owner's inbox was unreachable would be the product punishing a
 * user for an operator's problem. A failure here is a line in the log and a
 * person who waits a little longer.
 *
 * Silent without `OWNER_EMAIL`, like every other mail without `SMTP_HOST`.
 */
export async function notifyOwnerOfWaitingAccount(
  mailer: Pick<EmailService, 'configured' | 'send'>,
  ownerEmail: string | undefined,
  account: { readonly id: string; readonly email: string },
  link: { readonly apiUrl: string; readonly secret: string }
): Promise<void> {
  if (!ownerEmail || !mailer.configured) {
    return;
  }

  try {
    // One click, signed and expiring: the owner opens the account from their
    // phone instead of finding a database client (`0030`).
    const url = `${link.apiUrl}/admin/activate?token=${activationToken(account.id, link.secret)}`;
    const sent = await mailer.send({ ...accountWaitingEmail({ email: account.email, locale: OWNER_LOCALE, url }), to: ownerEmail });

    console.info(`[auth] owner ${sent ? 'notified' : 'NOT notified'} of a waiting account (user ${account.id})`);
  } catch (error) {
    console.info(`[auth] owner notice failed (user ${account.id}): ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}
