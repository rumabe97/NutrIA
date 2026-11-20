'use client';
import { useEffect, useRef, useState } from 'react';

import styles from './FirstLookQueue.module.css';

import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { EmptyState } from 'components/EmptyState';
import { FirstLookCard } from 'components/FirstLookCard';

import { interpolate } from 'lib/format';

import type { QueuedProfileView } from 'core/controllers/Professional';

interface FirstLookQueueProps {
  profiles: readonly QueuedProfileView[];
}

/**
 * The first-look queue (PRD 025 criterion 18): the profiles waiting, each its own
 * card, oldest first. A card that is done — seen, hidden, or found to be off the
 * queue already — leaves the list at once, and the result is said in one region
 * that stays mounted, so a screen reader hears it and nobody is thrown to the top
 * of the page. Focus goes to the card now in the place of the one that left — the next,
 * or the last when it was the last — or to the region when none is left.
 *
 * Marking one seen is not approval, and the page says so once, under the list.
 */
export function FirstLookQueue({ profiles }: FirstLookQueueProps) {
  const dictionary = useDictionary();
  const t = dictionary.adminProfiles;
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLDivElement>(null);
  // The place of the card that left: focus goes to the card now at that place (accessibility review, P2-7).
  const leftAt = useRef<number | null>(null);
  const left = profiles.filter(profile => !gone.has(profile.userId));

  useEffect(() => {
    if (leftAt.current === null) {
      return;
    }

    const headings = [...(root.current?.querySelectorAll<HTMLElement>('[data-first-look-heading]') ?? [])];
    const next = headings[Math.min(leftAt.current, headings.length - 1)];

    leftAt.current = null;
    (next ?? status.current)?.focus();
  }, [gone]);

  function done(outcome: 'hidden' | 'seen' | 'stale', profile: QueuedProfileView) {
    const words = { hidden: t.hide.done, seen: t.decide.published, stale: t.decide.stale }[outcome];

    leftAt.current = left.findIndex(entry => entry.userId === profile.userId);
    setMessage(interpolate(words, { name: profile.displayName }));
    setGone(current => new Set([...current, profile.userId]));
  }

  return (
    <div className={styles.queue} ref={root}>
      {/* Mounted before anything is said, so the first message is announced too. */}
      <div aria-label={t.status} className={styles.status} ref={status} role="status" tabIndex={-1}>
        {message ? (
          <Note as="p" tone="success" toneLabel={dictionary.common.noteTone.success}>
            {message}
          </Note>
        ) : null}
      </div>

      {left.length === 0 ? (
        <EmptyState body={t.empty.body} title={t.empty.title} />
      ) : (
        <ul className={styles.list} role="list">
          {left.map(profile => (
            <FirstLookCard key={profile.userId} onDone={done} profile={profile} />
          ))}
        </ul>
      )}

      {left.length > 0 ? (
        <Text size="sm" tone="secondary">
          {t.decide.note}
        </Text>
      ) : null}
    </div>
  );
}
