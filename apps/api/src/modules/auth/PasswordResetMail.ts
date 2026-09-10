import { webUrl } from 'core/domain/WebUrl';

import { passwordResetEmail } from '../email/templates/PasswordReset.js';
import { recipientLocale } from '../email/RecipientLocale.js';

import type { EmailService } from '../email/Email.service.js';

/**
 * The link Better Auth issues carries the page to land on as `callbackURL`.
 * The web app names it as a path, and Better Auth resolves a path against the
 * host *it* received the request on — which, behind the proxy, is the API's
 * own host, where `/restablecer` does not exist. In production the mailed link
 * ended on the API's 404 page. So the page is made absolute on `APP_URL`, the
 * one place that says where the web app lives, before the link leaves.
 *
 * And in the recipient's language: the web app serves Spanish at the root and
 * every other language behind its own segment, so the same path is a different
 * page in each. `webUrl` owns that rule; a path that already names a language
 * is left as the caller wrote it.
 */
export function absoluteCallback(url: string, appUrl: string, locale: string | null): string {
  try {
    const parsed = new URL(url);
    const callback = parsed.searchParams.get('callbackURL');

    if (callback?.startsWith('/')) {parsed.searchParams.set('callbackURL', webUrl(appUrl, callback, locale));}

    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Better Auth's `sendResetPassword` hook, as a function that can be exercised
 * without standing up Better Auth.
 *
 * It never throws. The web form always answers "if that account exists, we
 * have sent a link" — and Better Auth only calls this hook when the account
 * *does* exist, so an error escaping here would turn into a response that
 * differs between registered and unregistered addresses. A failure is logged
 * for the owner, not surfaced to the requester.
 *
 * With no mail configured the link goes to the log, as it always did: that is
 * what makes password reset work in local development.
 */
export async function sendPasswordResetMail(
  mailer: Pick<EmailService, 'configured' | 'send'>,
  { acceptLanguage, appUrl, to, url: issued, userId }: { acceptLanguage: string | null; appUrl: string; to: string; url: string; userId: string }
): Promise<void> {
  const locale = await recipientLocale(userId, acceptLanguage);
  const url = absoluteCallback(issued, appUrl, locale);

  if (!mailer.configured) {
    console.info(`[auth] password reset requested (user ${userId}); no SMTP configured, url: ${url}`);

    return;
  }

  const sent = await mailer.send({ ...passwordResetEmail({ locale, url }), to });

  console.info(`[auth] password reset ${sent ? 'mail sent' : 'mail NOT sent'} (user ${userId})`);
}
