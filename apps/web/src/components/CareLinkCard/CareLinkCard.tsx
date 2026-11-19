'use client';
import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './CareLinkCard.module.css';

import { Button } from 'ui/components/Button';
import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';
import { CareHealthSwitch } from 'components/CareHealthSwitch';
import { CareReconsent } from 'components/CareReconsent';

import { api, messageFor } from 'lib/api';
import { formatInstant, interpolate } from 'lib/format';
import { professionalLabel, withProfessional } from 'lib/professionalName';

import type { CareLinkView } from 'core/controllers/Care';

interface CareLinkCardProps {
  link: CareLinkView;
}

/**
 * The client's own link (PRD 004, criterion 4): who, what is shared, since
 * when, and the one way to end it — from this side, whatever the `professional`
 * switch says, because consent is revocable.
 *
 * «Tu profesional» whatever the tier (PRD 025 criterion 19, legal C3), with the
 * fixed notice under the name while the practitioner holds no badge
 * (`textos/05` § F.1), and the offer to widen the link while a badge stands on a
 * plan-only link (`reconsentOffered`, § F.4).
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
  // Under a `plan` scope — no badge now, or consent to the plan-only list (`0111` § 4) — `shares`
  // is empty and what the link opens is `sharesPlan`: name that, never an empty "Comparte:".
  const shared = link.scope === 'plan' ? link.sharesPlan.map(share => t.sharesPlan[share]) : link.shares.map(share => labels[share]);
  // The health line opens only under `full`; turning it on elsewhere is refused. A line already
  // on stays here so the person can always take it back.
  const offersHealth = link.scope === 'full' || link.sharesHealth;

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

      <Text weight="medium">{professionalLabel(link.professionalName, t.professionalUnnamed)}</Text>
      {link.professionalVerified ? null : <span className={styles.notice}>{t.invitationNotice}</span>}
      <Text size="sm" tone="secondary">
        {interpolate(t.linkSince, { date: formatInstant(Date.parse(link.since), locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}
      </Text>
      <Text size="sm" tone="secondary">
        {interpolate(t.whatIsShared, { list: shared.join(', ') })}
      </Text>

      {offersHealth ? (
        <div className={styles.healthShare}>
          <CareHealthSwitch professionalName={link.professionalName} sharesHealth={link.sharesHealth} visible={link.scope === 'full'} />
        </div>
      ) : null}

      {link.reconsentOffered ? <CareReconsent professionalName={link.professionalName} /> : null}

      {error ? (
        <Note as="p" layout="inline" role="alert" tone="error" toneLabel={dictionary.common.noteTone.error}>
          {error}
        </Note>
      ) : null}

      {confirming ? (
        <div className={styles.confirm}>
          <Text ref={confirmHeadingRef} size="sm" tabIndex={-1} tone="secondary">
            {withProfessional(t.endConfirmTitle, link.professionalName, t.professionalUnnamed)}
          </Text>
          <Text size="sm" tone="tertiary">
            {withProfessional(t.endConfirmBody, link.professionalName, t.professionalUnnamed)}
          </Text>
          <div className={`${styles.actions} button-row`}>
            <Button loading={pending} onClick={() => void end()} type="button" variant="destructive">
              {t.endConfirmCta}
            </Button>
            <Button disabled={pending} onClick={() => setConfirming(false)} type="button" variant="secondary">
              {dictionary.common.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div className={`${styles.actions} button-row`}>
          <Button onClick={() => setConfirming(true)} ref={triggerRef} type="button" variant="secondary">
            {t.end}
          </Button>
        </div>
      )}
    </Card>
  );
}
