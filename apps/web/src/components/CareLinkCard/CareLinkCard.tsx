'use client';
import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './CareLinkCard.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';
import { CareHealthSwitch } from 'components/CareHealthSwitch';

import { api, messageFor } from 'lib/api';
import { formatInstant, interpolate } from 'lib/format';

import type { CareLinkView } from 'core/controllers/Care';

interface CareLinkCardProps {
  link: CareLinkView;
}

/**
 * The client's own link (PRD 004, criterion 4): who, what is shared, since
 * when, and the one way to end it — from this side, whatever the `professional`
 * switch says, because consent is revocable.
 */
export function CareLinkCard({ link }: CareLinkCardProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.care;
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const confirmHeadingRef = useRef<HTMLParagraphElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);

  // `shares` is `CareShared | CareHealthShared`, two disjoint key sets that
  // together name every label the professional may see under this link.
  const labels: Record<string, string> = { ...t.shares, ...t.healthShares };
  const shared = link.shares.map(share => labels[share]);

  // Neither transition between the trigger and the confirm block moves the
  // DOM's focused node on its own — a keyboard or screen-reader user would
  // otherwise be dropped at `<body>` right when the prompt appears or closes.
  // Skipped on mount: nothing has moved yet, and stealing focus from a page
  // that just loaded would be its own bug.
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

  async function end() {
    setError(undefined);
    setPending(true);

    try {
      await api(`/care/links/${link.id}`, { method: 'DELETE' });
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, dictionary));
      setPending(false);
    }
  }

  return (
    <Card as="section" className={styles.card}>
      <h3 className={styles.title}>{t.linkTitle}</h3>

      <Text weight="medium">{link.professionalName}</Text>
      <Text size="sm" tone="secondary">
        {interpolate(t.linkSince, { date: formatInstant(Date.parse(link.since), locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}
      </Text>
      <Text size="sm" tone="secondary">
        {interpolate(t.whatIsShared, { list: shared.join(', ') })}
      </Text>

      <div className={styles.healthShare}>
        <CareHealthSwitch sharesHealth={link.sharesHealth} />
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {confirming ? (
        <div className={styles.confirm}>
          <Text ref={confirmHeadingRef} size="sm" tabIndex={-1} tone="secondary">
            {interpolate(t.endConfirmTitle, { professional: link.professionalName })}
          </Text>
          <Text size="sm" tone="tertiary">
            {t.endConfirmBody}
          </Text>
          <div className={styles.actions}>
            <Button loading={pending} onClick={() => void end()} type="button" variant="destructive">
              {t.endConfirmCta}
            </Button>
            <Button disabled={pending} onClick={() => setConfirming(false)} type="button" variant="secondary">
              {dictionary.common.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <Button onClick={() => setConfirming(true)} ref={triggerRef} type="button" variant="secondary">
            {t.end}
          </Button>
        </div>
      )}
    </Card>
  );
}
