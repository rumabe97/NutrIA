'use client';
import { useState } from 'react';

import styles from './SocialSignIn.module.css';

import { Button } from 'ui/components/Button';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';
import { withLocale } from 'i18n/routes';

import { forgetOfflineCopies } from 'lib/offline';
import { interpolate } from 'lib/format';
import { markArrival } from 'lib/arrival';
import { signIn } from 'lib/auth-client';

import { ProviderMark } from './ProviderMark';

import type { SocialProvider } from 'lib/sign-in-providers';

/** A provider's name is a trademark, not copy: it reads the same in every language. */
const PROVIDER_NAMES: Record<SocialProvider, string> = { apple: 'Apple', google: 'Google' };

/**
 * Only a path on this site. `siguiente` arrives in the address bar, so anybody
 * can write it; the API refuses a callback on an origin it does not trust, and
 * this keeps the question from being asked.
 */
function ownPath(path: string | undefined, fallback: string): string {
  return path?.startsWith('/') && !path.startsWith('//') ? path : fallback;
}

/**
 * "Continue with…", once per provider the API has credentials for (`0058`).
 *
 * With none — the shipped default — this renders nothing at all, divider
 * included, and the page is the form it always was.
 *
 * Every button is `secondary`, and they are all the same size: the form's
 * submit stays the one primary action on the screen, and no provider is drawn
 * louder than another, which is also what Apple asks of any page that offers
 * theirs beside somebody else's.
 */
export function SocialSignIn({ next, providers }: Readonly<{ next?: string; providers: readonly SocialProvider[] }>) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const [error, setError] = useState(false);
  const [leaving, setLeaving] = useState<SocialProvider | null>(null);

  if (providers.length === 0) {
    return null;
  }

  async function leaveFor(provider: SocialProvider) {
    setError(false);
    setLeaving(provider);

    // Whoever used this device before leaves no copy of their plan behind for
    // the next person (`0053`) — done now, because this tab does not come back
    // to this screen. The note is what tells the app shell it has just arrived.
    await forgetOfflineCopies();
    markArrival();

    // Absolute, on this origin: a relative address is resolved against the
    // API's own, which in development is another port.
    const here = window.location.origin;
    const { error: refused } = await signIn.social({
      callbackURL: `${here}${ownPath(next, '/inicio')}`,
      errorCallbackURL: `${here}${withLocale('/acceder', locale)}`,
      newUserCallbackURL: `${here}/onboarding`,
      provider
    });

    // On success the client is already navigating to the provider, and the
    // button stays busy until the page is gone.
    if (refused) {
      setLeaving(null);
      setError(true);
    }
  }

  return (
    <div className={styles.group}>
      {error ? (
        <p className={styles.error} role="alert">
          {dictionary.auth.socialFailed}
        </p>
      ) : null}

      {providers.map(provider => (
        <Button
          className={styles.provider}
          disabled={leaving === null ? false : leaving !== provider}
          key={provider}
          loading={leaving === provider}
          onClick={() => void leaveFor(provider)}
          type="button"
          variant="secondary"
        >
          {leaving === provider ? null : <ProviderMark provider={provider} />}
          {interpolate(dictionary.auth.continueWith, { provider: PROVIDER_NAMES[provider] })}
        </Button>
      ))}

      <p className={styles.divider}>{dictionary.auth.orWithEmail}</p>
    </div>
  );
}
