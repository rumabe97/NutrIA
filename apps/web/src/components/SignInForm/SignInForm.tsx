'use client';
import { Fragment, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import styles from 'components/AuthForm/AuthForm.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';
import { withLocale } from 'i18n/routes';

import { LegalNotice } from 'components/LegalNotice';
import { SocialSignIn } from 'components/SocialSignIn';

import { forgetOfflineCopies } from 'lib/offline';
import { interpolate } from 'lib/format';
import { ownPath } from 'lib/ownPath';
import { passkeyAutofillAvailable, passkeySignInRefusal, passkeysSupported, unchanging } from 'lib/passkey';
import { signIn } from 'lib/auth-client';
import { syncLocaleFromProfile } from 'lib/locale-sync';

import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { FormEvent } from 'react';
import type { SocialProvider } from 'lib/sign-in-providers';

/**
 * What to say to somebody a provider sent back without a session (`0058`).
 *
 * Better Auth returns them to this page with `?error=`. Two codes are worth
 * their own words. `account_not_linked` is an address that already has an
 * account nobody confirmed: joining them would hand the account to whoever
 * arrives, so the way in is the password, and the page says so. `access_denied`
 * is somebody pressing Cancel at the provider, which is not an error and gets no
 * red box. Everything else is one sentence that offers the form.
 */
function arrivalError(code: string | null, dictionary: Dictionary): string | undefined {
  if (!code || code === 'access_denied') {
    return undefined;
  }

  return code === 'account_not_linked' ? dictionary.auth.socialNotLinked : dictionary.auth.socialFailed;
}

/**
 * Reads `?siguiente` so the proxy's redirect returns the user to where they
 * were headed. That needs useSearchParams, which is why this is a separate
 * client component behind a Suspense boundary rather than part of the page.
 */
export function SignInForm({ providers = [] }: Readonly<{ providers?: readonly SocialProvider[] }>) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const params = useSearchParams();
  const [error, setError] = useState<string | undefined>(() => arrivalError(params.get('error'), dictionary));
  const [pending, setPending] = useState(false);
  const passkeys = useSyncExternalStore(unchanging, passkeysSupported, () => false);
  const [passkeyPending, setPasskeyPending] = useState(false);
  // The button's own refusal, said above the button: at 320px the form's alert is off-screen from it.
  const [passkeyError, setPasskeyError] = useState<string>();
  // A sign-in with a passkey already went through: the autofill prompt that is still open
  // must not start a second one.
  const arrived = useRef(false);

  /**
   * After any sign-in that left a session: what a password sign-in does next. A 409 the
   * API keeps for this account (an unverified address, a password to change, onboarding
   * not finished) is the next page's to route, not this form's.
   */
  const enter = useCallback(async () => {
    // Whoever used this device before leaves no copy of their plan behind for
    // the next person, even one who never signed out (`0053`).
    await forgetOfflineCopies();

    // The profile column is the durable preference; the cookie is only a cache of
    // it. Syncing here is what makes a language chosen on one device survive
    // signing in on another — without it the new device keeps whatever its
    // browser negotiated.
    await syncLocaleFromProfile();

    router.push(ownPath(params.get('siguiente') ?? undefined, '/inicio'));
    router.refresh();
  }, [params, router]);

  /**
   * A passkey sign-in: from the button (`autoFill` false), or from the email field's
   * suggestions, which the browser offers while the page is open (conditional UI). A
   * prompt closed without finishing says nothing; any refusal says one sentence that
   * never tells whether the key was known.
   */
  const withPasskey = useCallback(
    async (autoFill: boolean) => {
      const { error: passkeyError } = await signIn.passkey({ autoFill });

      if (passkeyError) {
        const message = passkeySignInRefusal(passkeyError, dictionary);

        // From the field's suggestions, the form's alert by the field; from the button, by the button.
        if (message) {
          (autoFill ? setError : setPasskeyError)(message);
        }

        return false;
      }

      arrived.current = true;
      await enter();

      return true;
    },
    [dictionary, enter]
  );

  // The server cannot know whether the browser has WebAuthn: the button arrives after
  // the first client render, and the field's suggestions start listening then.
  useEffect(() => {
    if (passkeys) {
      void passkeyAutofillAvailable().then(available => (available ? withPasskey(true) : false));
    }
  }, [passkeys, withPasskey]);

  async function onPasskey() {
    setError(undefined);
    setPasskeyError(undefined);
    setPasskeyPending(true);

    // Starting this prompt ends the autofill one, which answers as cancelled.
    if (await withPasskey(false)) {
      // The button keeps its spinner until the page changes.
      return;
    }

    setPasskeyPending(false);

    // The field offers the passkeys again, unless somebody signed in meanwhile.
    if (!arrived.current && (await passkeyAutofillAvailable())) {
      void withPasskey(true);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPasskeyError(undefined);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const { data, error: signInError } = await signIn.email({ email: String(form.get('email')), password: String(form.get('password')) });

    if (signInError) {
      setPending(false);

      // One message for wrong password and unknown account alike: telling them
      // apart turns this form into an account-enumeration oracle. A 429 is a
      // wait — the per-IP limit or the per-address brake, the same answer for
      // an address with an account and one without (PLAN 011 phase 7). Anything
      // else that is *not* a refusal — the service down, a rejected origin, a
      // database the API cannot reach — says so instead: for a whole afternoon
      // those read as "wrong password" and sent the owner looking in the wrong place.
      setError(
        signInError.status === 401
          ? dictionary.auth.invalidCredentials
          : signInError.status === 429
            ? dictionary.auth.signInPaused
            : interpolate(dictionary.auth.signInUnavailable, { status: signInError.status })
      );

      return;
    }

    // Two-factor on: the password was right, but Better Auth answered with no session —
    // only a short-lived cookie that the challenge's routes accept. Never `/inicio` from
    // here: there is nobody signed in yet. The button keeps its spinner until the page
    // changes, so a second press cannot start a second sign-in.
    if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) {
      const next = params.get('siguiente');

      router.push(`${withLocale('/acceder/codigo', locale)}${next ? `?${new URLSearchParams({ siguiente: next }).toString()}` : ''}`);

      return;
    }

    await enter();
    setPending(false);
  }

  return (
    <Fragment>
      {/* Only when a provider button exists: that is what can create an account here. */}
      {providers.length > 0 ? <LegalNotice variant="signIn" /> : null}

      <SocialSignIn next={params.get('siguiente') ?? undefined} providers={providers} />

      <form className={styles.form} noValidate={true} onSubmit={onSubmit}>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        {/* `webauthn` last: the browser offers this site's passkeys among the field's suggestions. */}
        <Input autoComplete="username webauthn" label={dictionary.auth.email} name="email" required={true} type="email" />
        <Input autoComplete="current-password" label={dictionary.auth.password} name="password" required={true} type="password" />

        <Link className={`${styles.link} ${styles.forgot}`} href="/recuperar">
          {dictionary.auth.forgotPassword}
        </Link>

        <Button disabled={passkeyPending} loading={pending} type="submit">
          {pending ? dictionary.auth.signingIn : dictionary.auth.signIn}
        </Button>

        {/* Only in a browser that can use one; the form's submit stays the one primary. */}
        {passkeyError ? (
          <p className={styles.error} role="alert">
            {passkeyError}
          </p>
        ) : null}
        {passkeys ? (
          <Button disabled={pending} loading={passkeyPending} onClick={() => void onPasskey()} type="button" variant="secondary">
            {dictionary.passkeys.signIn}
          </Button>
        ) : null}

        <div className={styles.footer}>
          <Text size="sm" tone="secondary">
            {dictionary.auth.noAccount}{' '}
            <Link className={styles.link} href="/registro">
              {dictionary.auth.toSignUp}
            </Link>
          </Text>
        </div>
      </form>
    </Fragment>
  );
}
