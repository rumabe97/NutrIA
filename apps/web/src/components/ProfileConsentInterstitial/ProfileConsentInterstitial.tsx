'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './ProfileConsentInterstitial.module.css';

import { Button } from 'ui/components/Button';
import { useDictionary } from 'i18n/LocaleProvider';

import { ProfileConsentFields } from 'components/ProfileConsentFields';

import { api, messageFor } from 'lib/api';

import type { FormEvent } from 'react';

/**
 * The one-time screen an existing account meets before `/inicio` once the
 * server says its health-data consent (`docs/legal/textos/05-consentimientos-cliente.md`
 * § A) is still missing — an account that finished onboarding before this
 * consent existed, so the allergies step never asked. New accounts never see
 * this: they give the same consent on that step itself, and `redirect` below
 * only fires for someone whose onboarding the server already calls complete.
 */
export function ProfileConsentInterstitial() {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.profileConsent;
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    if (new FormData(event.currentTarget).get('profileConsentGiven') !== 'on') {
      setError(t.note);

      return;
    }

    setPending(true);

    try {
      await api('/profile/consent', { method: 'PATCH' });
      router.push('/inicio');
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, dictionary));
      setPending(false);
    }
  }

  return (
    <div className={styles.shell}>
      <h1 className={styles.title}>{t.title}</h1>

      {/* `noValidate`: the browser's own required-field bubble is in whatever
          language the browser is set to, not the reader's chosen locale, and
          it would also pre-empt this handler before `t.note` ever showed. */}
      <form noValidate={true} onSubmit={onSubmit}>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <ProfileConsentFields />

        <div className={styles.actions}>
          <Button loading={pending} type="submit">
            {pending ? dictionary.common.saving : t.continue}
          </Button>
        </div>
      </form>
    </div>
  );
}
