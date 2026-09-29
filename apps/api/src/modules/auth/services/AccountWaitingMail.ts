import { accountWaitingEmail } from '../../email/templates/AccountWaiting.js';

import type { EmailLocale } from '../../email/templates/Layout.js';
import type { EmailService } from '../../email/services/Email.service.js';

const OWNER_LOCALE: EmailLocale = 'es-ES';

/** The console page that lists the accounts waiting to be opened. */
const WAITING_ACCOUNTS_PATH = '/admin/cuentas?activated=no';

/**
 * Tells the owner that an account is waiting to be opened (`0017`, `0029`).
 *
 * Sent when somebody confirms their address and the door is shut, which is the
 * only moment there is anything for the owner to do (`0031`, amended). Not on
 * sign-up: with the door open the account opens itself, and with it shut there
 * is no sign-up to report.
 *
 * The mail names nobody and carries no activation link: it points at the
 * console's Cuentas filtered to the waiting accounts, where the owner sees who
 * it is and opens the account. It does not even take the account, so nothing
 * about the person can reach it. `GET /admin/activate` still honours the links
 * in mails sent before this change until they expire; no new mail issues one.
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
  link: (path: string) => string
): Promise<void> {
  if (!ownerEmail || !mailer.configured) {
    return;
  }

  try {
    const sent = await mailer.send({ ...accountWaitingEmail({ locale: OWNER_LOCALE, url: link(WAITING_ACCOUNTS_PATH) }), to: ownerEmail });

    // No user id in the line: the mail no longer names the account, and the
    // log has no business doing what the mail was changed not to.
    console.info(`[auth] owner ${sent ? 'notified' : 'NOT notified'} of a waiting account`);
  } catch (error) {
    // The class only: a mail error's message can carry the recipient's address.
    console.info(`[auth] owner notice failed: ${error instanceof Error ? error.constructor.name : 'unknown error'}`);
  }
}
