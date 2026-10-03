import { webUrl } from 'core/domain/WebUrl';

import { existingAccountSignUpEmail } from '../../email/templates/ExistingAccountSignUp.js';
import { recipientLocale } from '../../email/services/RecipientLocale.js';

import type { EmailService } from '../../email/services/Email.service.js';

/** Where the owner of the address goes: the account they already have, or a new password for it. */
const SIGN_IN_PATH = '/acceder';
const RECOVER_PATH = '/recuperar';

/**
 * Better Auth's `onExistingUserSignUp` (PLAN 011 phase 8): somebody signed up
 * with an address that already has an account. The answer they got is the
 * one a new address gets; the owner of the address is told here instead.
 *
 * Better Auth hands it to `runInBackgroundOrAwait`, so it runs after the
 * response through `BackgroundTaskService`, as the new address's verification
 * mail does: neither answer waits for SMTP. In the account's stored language,
 * else the request's. With no mail configured, one line says so; neither line
 * carries the address or anything the sign-up typed.
 */
export async function sendExistingAccountMail(
  mailer: Pick<EmailService, 'configured' | 'send'>,
  { acceptLanguage, appUrl, to, userId }: { acceptLanguage: string | null; appUrl: string; to: string; userId: string }
): Promise<void> {
  if (!mailer.configured) {
    console.info(`[auth] sign-up with an existing address (user ${userId}); no SMTP configured, mail not sent`);

    return;
  }

  const locale = await recipientLocale(userId, acceptLanguage);
  const sent = await mailer.send({
    ...existingAccountSignUpEmail({ locale, recoverUrl: webUrl(appUrl, RECOVER_PATH, locale), signInUrl: webUrl(appUrl, SIGN_IN_PATH, locale) }),
    to
  });

  console.info(`[auth] sign-up with an existing address ${sent ? 'mail sent' : 'mail NOT sent'} (user ${userId})`);
}
