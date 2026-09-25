'use client';
import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './ProfileConsentCard.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';

import { api, messageFor } from 'lib/api';

/**
 * Withdrawing the health-data consent (`docs/legal/textos/05-consentimientos-cliente.md`
 * § A) deletes what it covers — allergies, intolerances, weight, height, goal
 * and eating style — and sends the account back to the onboarding step that
 * asks for it again, the same shape `HealthPanel`'s withdraw already has for
 * conditions, medication and supplements, but with the confirmation step that
 * one lacks: this one also erases what a plan is calculated from.
 */
export function ProfileConsentCard() {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.profile;
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const confirmHeadingRef = useRef<HTMLParagraphElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);

  // Same reasoning as `CareLinkCard`: neither transition moves focus on its
  // own, and a keyboard or screen-reader user would otherwise be dropped at
  // `<body>` right when the prompt appears or closes. Skipped on mount.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;

      return;
    }

    if (confirming) {
      confirmHeadingRef.current?.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [confirming]);

  async function withdraw() {
    setError(undefined);
    setPending(true);

    try {
      await api('/profile/consent', { method: 'DELETE' });
      router.push('/onboarding');
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, dictionary));
      setPending(false);
    }
  }

  return (
    <Card as="section" className={styles.card}>
      <h3 className={styles.title}>{t.profileConsentTitle}</h3>
      <Text size="sm" tone="secondary">
        {dictionary.profileConsent.body}
      </Text>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {confirming ? (
        <div className={styles.confirm}>
          <Text ref={confirmHeadingRef} size="sm" tabIndex={-1} tone="secondary">
            {t.profileConsentWithdrawTitle}
          </Text>
          <Text size="sm" tone="tertiary">
            {t.profileConsentWithdrawBody}
          </Text>
          <div className={styles.actions}>
            <Button loading={pending} onClick={() => void withdraw()} type="button" variant="destructive">
              {t.profileConsentWithdrawConfirm}
            </Button>
            <Button disabled={pending} onClick={() => setConfirming(false)} type="button" variant="secondary">
              {dictionary.common.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <Button onClick={() => setConfirming(true)} ref={triggerRef} type="button" variant="secondary">
            {t.profileConsentWithdraw}
          </Button>
        </div>
      )}
    </Card>
  );
}
