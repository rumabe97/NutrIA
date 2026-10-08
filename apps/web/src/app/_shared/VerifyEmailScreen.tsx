import { Suspense } from 'react';

import { EmailConfirmed, EmailConfirmedFromLink } from 'components/EmailConfirmed';

/**
 * Where every confirmation link lands (`VerificationMail.ts`, `VERIFIED_PAGE`).
 * Verification itself happens on the API — the mailed link hits Better Auth's
 * own endpoint, which redirects here — and signs nobody in, so this page says
 * the address is confirmed and the next step is to sign in. Static: the
 * confirmed page is the fallback, and only a refused link (`?error`) changes it.
 */
export function VerifyEmailScreen() {
  return (
    <Suspense fallback={<EmailConfirmed refused={false} />}>
      <EmailConfirmedFromLink />
    </Suspense>
  );
}
