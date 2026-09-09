import { accountWaitingEmail } from '../email/templates/AccountWaiting.js';

import type { EmailLocale } from '../email/templates/Layout.js';
import type { EmailService } from '../email/Email.service.js';

const OWNER_LOCALE: EmailLocale = 'es-ES';

/**
 * Tells the owner that an account is waiting to be opened (`0017`, `0029`).
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
  account: { readonly id: string; readonly email: string; }
): Promise<void> {
  if (!ownerEmail || !mailer.configured) {return;}

  try {
    const sent = await mailer.send({ ...accountWaitingEmail({ email: account.email, locale: OWNER_LOCALE }), to: ownerEmail });

    console.info(`[auth] owner ${sent ? 'notified' : 'NOT notified'} of a waiting account (user ${account.id})`);
  } catch (error) {
    console.info(`[auth] owner notice failed (user ${account.id}): ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}
