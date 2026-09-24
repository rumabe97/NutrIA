'use client';
import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './ProfessionalList.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';
import { formatDate, formatNumber, interpolate } from 'lib/format';

import type { ProfessionalAccountView } from 'core/controllers/Professional';

/**
 * Every professional the owner has granted (`0059`): the address, the
 * collegiate number, since when, and their links counted by status — counts,
 * never a client (`0028`). Taking a grant back is confirmed on the row first,
 * with what it does said before it is done.
 */
export function ProfessionalList({ professionals }: Readonly<{ professionals: readonly ProfessionalAccountView[] }>) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.admin;
  const [confirming, setConfirming] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const confirmHeading = useRef<HTMLParagraphElement>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const previous = useRef<string>(undefined);

  // Focus follows the swap between a row's button and its confirm, both ways; nothing moves on first render.
  useEffect(() => {
    if (confirming) {
      confirmHeading.current?.focus();
    } else if (previous.current) {
      triggers.current.get(previous.current)?.focus();
    }

    previous.current = confirming;
  }, [confirming]);

  async function revoke(userId: string) {
    setPending(true);
    setError(undefined);

    try {
      await api(`/admin/accounts/${encodeURIComponent(userId)}/professional`, { method: 'DELETE' });
      setConfirming(undefined);
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setPending(false);
    }
  }

  if (professionals.length === 0) {
    return (
      <Text size="sm" tone="tertiary">
        {t.professionalsEmpty}
      </Text>
    );
  }

  return (
    <div className={styles.root}>
      <ul className={styles.list}>
        {professionals.map(professional => (
          <li className={styles.row} key={professional.userId}>
            <div className={styles.line}>
              <span className={styles.who}>
                <span className={styles.email}>{professional.email}</span>
                <Text as="span" size="xs" tone="secondary">
                  {interpolate(t.professionalGranted, {
                    date: formatDate(professional.grantedAt.slice(0, 10), locale, { day: 'numeric', month: 'short', year: 'numeric' }),
                    number: professional.collegiateNumber
                  })}
                </Text>
                <Text as="span" className={styles.counts} size="xs" tone="tertiary">
                  {interpolate(t.professionalLinks, {
                    active: formatNumber(professional.links.active, locale),
                    ended: formatNumber(professional.links.ended, locale),
                    paused: formatNumber(professional.links.paused, locale)
                  })}
                </Text>
              </span>

              {confirming === professional.userId ? null : (
                <Button
                  aria-label={interpolate(t.professionalRevokeFor, { email: professional.email })}
                  disabled={pending}
                  onClick={() => {
                    setError(undefined);
                    setConfirming(professional.userId);
                  }}
                  ref={element => {
                    if (element) {
                      triggers.current.set(professional.userId, element);
                    } else {
                      triggers.current.delete(professional.userId);
                    }
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {t.professionalRevoke}
                </Button>
              )}
            </div>

            {confirming === professional.userId ? (
              <div className={styles.confirm}>
                <Text ref={confirmHeading} size="sm" tabIndex={-1} weight="medium">
                  {interpolate(t.professionalRevokeTitle, { email: professional.email })}
                </Text>
                <Text size="sm" tone="secondary">
                  {t.professionalRevokeBody}
                </Text>
                <div className={styles.actions}>
                  <Button loading={pending} onClick={() => void revoke(professional.userId)} size="sm" type="button" variant="destructive">
                    {t.professionalRevokeConfirm}
                  </Button>
                  <Button disabled={pending} onClick={() => setConfirming(undefined)} size="sm" type="button" variant="secondary">
                    {dictionary.common.cancel}
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {error ? (
        <Text className={styles.error} role="alert" size="xs">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
