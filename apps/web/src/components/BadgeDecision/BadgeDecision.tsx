'use client';
import { useId, useRef, useState } from 'react';

import styles from './BadgeDecision.module.css';

import { Button } from 'ui/components/Button';
import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { BadgeRemovalForm } from 'components/BadgeRemovalForm';

import { BADGE_GRACE_DAYS } from 'core/entities/Professional';

import { api, ApiError, messageFor } from 'lib/api';
import { formatInstant, interpolate } from 'lib/format';

import type { BadgeActs } from 'lib/badgeActs';
import type { BadgeRecordView } from 'core/controllers/Professional';

interface BadgeDecisionProps {
  acts: BadgeActs;
  /** The college and the number of the check being decided: the application's, or the standing badge's. */
  decided: { number: string; register: string };
  /** An act went through: what to say, once the page has read the record again. */
  onDone: (message: string) => void;
  /** There was nothing of that kind to decide any more. */
  onStale: () => void;
  record: BadgeRecordView;
}

/**
 * Step 3 of the badge's check (sheet «ConsolaDistintivo»): the decision, one pair
 * side by side — the refusal on the left, the badge on the right, which is the one
 * primary — and under it what is recorded and when the badge will be looked at again.
 *
 * An act is drawn only when the API would take it (`badgeActs`): the badge cannot be
 * given before the person has entered the code, and a standing badge is confirmed only
 * when its yearly check is due. When it cannot yet be given, the card says what it
 * waits for. The refusal and the withdrawal ask for their reasons first
 * (`BadgeRemovalForm`); confirming is one press and says when the next check falls.
 */
export function BadgeDecision({ acts, decided, onDone, onStale, record }: BadgeDecisionProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.adminBadge.decide;
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const removeButton = useRef<HTMLButtonElement>(null);
  const formId = useId();
  const renewing = acts.mode === 'standing';

  async function confirm() {
    setPending(true);
    setError(undefined);

    try {
      const answer = await api<BadgeRecordView>(`/admin/professionals/${encodeURIComponent(record.userId)}/badge/confirm`, { method: 'POST' });
      const date = answer.badge ? formatInstant(Date.parse(answer.badge.dueAt), locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

      onDone(interpolate(renewing ? t.renewed : t.confirmed, { date }));
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'NOT_FOUND') {
        onStale();
      } else {
        setError(messageFor(caught, dictionary));
        setPending(false);
      }
    }
  }

  function closeForm() {
    setOpen(false);
    removeButton.current?.focus();
  }

  if (acts.removal === null) {
    return null;
  }

  const removal = acts.removal;

  return (
    <div className={styles.decide}>
      {!acts.canConfirm && acts.mode === 'application' ? <Text size="sm">{t.waiting}</Text> : null}

      <div className={`${styles.pair} button-row`}>
        <Button
          aria-controls={open ? formId : undefined}
          aria-expanded={open}
          disabled={pending}
          onClick={() => setOpen(current => !current)}
          ref={removeButton}
          type="button"
          variant="secondary"
        >
          {removal === 'fail' ? dictionary.adminBadge.removal.titleFail : t.withdraw}
        </Button>
        {acts.canConfirm ? (
          <Button aria-disabled={pending || undefined} loading={pending} onClick={() => void confirm()} type="button">
            {renewing ? t.renew : t.confirm}
          </Button>
        ) : null}
      </div>

      {error ? (
        <Note as="p" layout="inline" role="alert" tone="error" toneLabel={dictionary.common.noteTone.error}>
          {error}
        </Note>
      ) : null}

      {open ? (
        <BadgeRemovalForm
          decided={decided}
          kind={removal}
          onCancel={closeForm}
          onDone={outcome => {
            if (outcome === 'stale') {
              onStale();
            } else {
              onDone(removal === 'fail' ? dictionary.adminBadge.removal.refusedDone : dictionary.adminBadge.removal.withdrawnDone);
            }
          }}
          record={record}
          rootId={formId}
        />
      ) : null}

      <Text size="sm" tone="secondary">
        {interpolate(t.what, { days: BADGE_GRACE_DAYS })}
      </Text>
    </div>
  );
}
