import { absoluteCallback } from './PasswordResetMail.js';
import { recipientLocale } from '../../email/services/RecipientLocale.js';
import { verifyEmail } from '../../email/templates/VerifyEmail.js';

import type { Env } from '../../../config/index.js';
import type { EmailService } from '../../email/services/Email.service.js';

/** The environments where a verification link may be written to the log: the ones nobody else reads. */
const LINK_TO_LOG: ReadonlySet<Env['NODE_ENV']> = new Set(['development', 'test']);

/**
 * Better Auth's `sendVerificationEmail` hook, as a function that can be
 * exercised without standing up Better Auth.
 *
 * Nobody has a profile at sign-up, so this is the one mail whose language the
 * request really does decide — but a resent confirmation reaches an account
 * that has one, and then the profile is the better answer. `recipientLocale`
 * owns that order.
 *
 * With no mail configured the link goes to the log in development and test:
 * that is what makes sign-up work locally. Nowhere else. The link carries the
 * verification token, and with `autoSignInAfterVerification` on, opening it is
 * a signed-in session for that account — so on any other host the line says a
 * confirmation was due and nothing more.
 *
 * Which host this is comes from the validated `Env` the caller holds, never
 * from `process.env`. `Env.validation.ts` refuses to boot a production
 * deployment whose `NODE_ENV` is anything but `production`, and `preflight`
 * runs that check before a deploy succeeds; that refusal is the guarantee this
 * gate rests on, not a default.
 */
export async function sendVerificationMail(
  mailer: Pick<EmailService, 'configured' | 'send'>,
  {
    acceptLanguage,
    appUrl,
    nodeEnv,
    to,
    url: issued,
    userId
  }: { acceptLanguage: string | null; appUrl: string; nodeEnv: Env['NODE_ENV']; to: string; url: string; userId: string }
): Promise<void> {
  const locale = await recipientLocale(userId, acceptLanguage);
  const url = absoluteCallback(issued, appUrl, locale);

  if (!mailer.configured) {
    console.info(
      LINK_TO_LOG.has(nodeEnv)
        ? `[auth] no SMTP configured; verification url for ${userId}: ${url}`
        : `[auth] no SMTP configured; verification link for ${userId} suppressed`
    );

    return;
  }

  const sent = await mailer.send({ ...verifyEmail({ locale, url }), to });

  console.info(`[auth] verification ${sent ? 'mail sent' : 'mail NOT sent'} (user ${userId})`);
}
