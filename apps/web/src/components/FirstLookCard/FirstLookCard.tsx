'use client';
import { Fragment, useId, useRef, useState } from 'react';

import styles from './FirstLookCard.module.css';

import { Button } from 'ui/components/Button';
import { Note } from 'ui/components/Note';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';
import { HideProfileForm } from 'components/HideProfileForm';

import { api, ApiError, messageFor } from 'lib/api';
import { formatInstant, formatList, formatNumber, interpolate } from 'lib/format';

import type { QueuedProfileView } from 'core/controllers/Professional';

interface FirstLookCardProps {
  /** The card is done: the profile was marked seen, hidden, or was not on the queue any more. */
  onDone: (outcome: 'hidden' | 'seen' | 'stale', profile: QueuedProfileView) => void;
  profile: QueuedProfileView;
}

/**
 * One profile of the first look (PRD 025 criterion 18; sheet «ConsolaPerfiles»):
 * what the person wrote, as they wrote it, what the word filter says, whether a
 * badge stands, and the one pair of acts — «No publicar» on the left, «Publicar» on
 * the right, side by side. Marking it seen is not an endorsement and gates nothing,
 * and the page says so once, under the list; not publishing is hiding, so it asks
 * for the reasons first, in the form that opens under the pair.
 *
 * What the card draws is what the API sends: the account's address, the profile's
 * own words, the state of the badge and the words the filter withholds. Never a client.
 */
export function FirstLookCard({ onDone, profile }: FirstLookCardProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.adminProfiles;
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const hideButton = useRef<HTMLButtonElement>(null);
  const formId = useId();
  const day = (iso: string) => formatInstant(Date.parse(iso), locale, { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' });
  const price =
    profile.priceCents === null || profile.priceUnit === null
      ? null
      : `${formatNumber(profile.priceCents / 100, locale, { currency: 'EUR', style: 'currency' })} ${dictionary.practice.profilePriceUnit[profile.priceUnit]}`;
  // The words in the filter's form (the API sends no other): in Spanish, and said to be the filter's.
  const [wordsBefore, wordsAfter] = t.card.words.split('{words}');
  const hiddenReasons = profile.hidden?.reasons.map(reason => dictionary.adminAudit.profileHiddenReason[reason]) ?? [];

  async function publish() {
    setPending(true);
    setError(undefined);

    try {
      await api(`/admin/professionals/${encodeURIComponent(profile.userId)}/profile/seen`, { method: 'POST' });
      onDone('seen', profile);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'NOT_FOUND') {
        onDone('stale', profile);
      } else {
        setError(messageFor(caught, dictionary));
        setPending(false);
      }
    }
  }

  function closeForm() {
    setOpen(false);
    hideButton.current?.focus();
  }

  return (
    <Card as="li" className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.name} data-first-look-heading="" tabIndex={-1}>
          <span lang="es">{profile.displayName}</span>
        </h2>
        {profile.queuedAt ? <span className={styles.when}>{interpolate(t.card.queued, { date: day(profile.queuedAt) })}</span> : null}
      </div>

      <p className={styles.meta}>
        {[price, profile.badged ? t.card.badged : t.card.unbadged, interpolate(t.card.account, { email: profile.email })]
          .filter((part): part is string => part !== null)
          .join(' · ')}
      </p>

      <blockquote className={styles.quote} lang="es">
        {profile.studies ?? <span className={styles.none}>{t.card.noStudies}</span>}
      </blockquote>

      {profile.hidden ? (
        <Note as="p" tone="info" toneLabel={dictionary.common.noteTone.info}>
          {interpolate(t.card.hidden, { date: day(profile.hidden.at), reasons: formatList(hiddenReasons, locale) })} {t.decide.publishHidden}
        </Note>
      ) : null}

      {profile.withheld.length > 0 ? (
        <Note as="p" tone="warning" toneLabel={dictionary.common.noteTone.warning}>
          {wordsBefore}
          {profile.withheld.map((word, index) => (
            <Fragment key={`${word.field}-${word.word}`}>
              {index > 0 ? ', ' : null}
              <span lang="es">«{word.word}»</span> {t.card.wordsField[word.field]}
            </Fragment>
          ))}
          {wordsAfter} {t.card.wordsForm}
        </Note>
      ) : (
        // Information about the profile, not a finished act: a note, not «Hecho».
        <Note as="p" tone="info" toneLabel={dictionary.common.noteTone.info}>
          {t.card.noWords}
        </Note>
      )}

      {/* The sheet's pair: «No publicar» (the quiet one) left, «Publicar» right. Side by side from 320px; the labels wrap inside their buttons. */}
      <div className={`${styles.decide} button-row`}>
        <Button
          aria-controls={open ? formId : undefined}
          aria-expanded={open}
          disabled={pending}
          onClick={() => setOpen(current => !current)}
          ref={hideButton}
          type="button"
          variant="secondary"
        >
          {t.decide.hide}
        </Button>
        <Button aria-disabled={pending || undefined} loading={pending} onClick={() => void publish()} type="button">
          {t.decide.publish}
        </Button>
      </div>

      {error ? (
        <Note as="p" layout="inline" role="alert" tone="error" toneLabel={dictionary.common.noteTone.error}>
          {error}
        </Note>
      ) : null}

      {open ? (
        <HideProfileForm
          onCancel={closeForm}
          onDone={outcome => onDone(outcome === 'hidden' ? 'hidden' : 'stale', profile)}
          profile={profile}
          rootId={formId}
        />
      ) : null}
    </Card>
  );
}
